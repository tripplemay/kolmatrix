/**
 * BM2-F006 · Server-side batch send with sleep guard.
 *
 * Callers hand us an already-resolved set of KolCampaign rows +
 * subject/body per row. We iterate sequentially, sleeping between
 * sends to honour the 10 msg/min throttle from spec §F006, write
 * one EmailLog per attempt, and transactionally bump the
 * KolCampaign.status to "contacted" when the current value is an
 * earlier stage (pending / quoted), emitting audit_log entries in
 * the same withTenant transaction.
 *
 * Fire-and-forget event_log is emitted outside the transaction
 * so failures there don't roll back business state.
 */
import { withTenant } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { logEvent } from "@/lib/events/log";

import { KOL_CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/kol-campaign-status";

import { FROM_ADDRESS, SendEmailError, sendEmail } from "./resend";

const THROTTLE_MS = 6_000; // 10 messages / minute

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BatchSendItem {
  kolCampaignId: string;
  kolId: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  templateId?: string | null;
  aiCustomized?: boolean;
}

export interface BatchSendResult {
  sent: number;
  mocked: number;
  failed: number;
  items: Array<{
    kolId: string;
    status: "sent" | "mock_sent" | "failed";
    error?: string;
    providerMessageId?: string | null;
    emailLogId?: string;
    // BL-100-F002 (ADR-020 D4) — true when a job retry found this
    // (batchId,kolId) already sent and skipped the resend.
    skipped?: boolean;
  }>;
}

// Only forward statuses that are strictly "before contacted" in the
// 6-stage lifecycle advance to "contacted"; later stages stay put so
// a signed/delivered KOL isn't demoted by a follow-up send.
const FORWARDING_STATES = new Set<string>([
  // Everything before "contacted" in KOL_CAMPAIGN_STATUS_VALUES.
  ...KOL_CAMPAIGN_STATUS_VALUES.slice(
    0,
    KOL_CAMPAIGN_STATUS_VALUES.indexOf("contacted")
  ),
]);

export async function batchSendOutreach(
  tenantId: string,
  actorId: string,
  campaignId: string,
  items: BatchSendItem[],
  // BL-100-F002 (ADR-020 D3/D4) — the async send batch this run belongs
  // to. Persisted on every email_log row + used for the (batchId,kolId)
  // idempotency guard so a BullMQ job retry never re-sends an address
  // that already went out. `null` = legacy / non-batch send (no guard).
  batchId: string | null,
  opts: { throttleMs?: number; skipSleep?: boolean } = {}
): Promise<BatchSendResult> {
  const throttle = opts.throttleMs ?? THROTTLE_MS;
  const out: BatchSendResult = {
    sent: 0,
    mocked: 0,
    failed: 0,
    items: [],
  };

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;

    // D4 idempotency — when this run is part of a batch, skip any KOL
    // that already has a sent / mock_sent row for the same batch so a
    // job retry is a no-op rather than a duplicate send. A prior `failed`
    // row is NOT a skip: retries should re-attempt it.
    if (batchId) {
      const already = await withTenant(tenantId, (tx) =>
        tx.emailLog.findFirst({
          where: {
            tenantId,
            campaignId,
            kolId: item.kolId,
            batchId,
            status: { in: ["sent", "mock_sent"] },
          },
          select: { id: true, status: true },
        })
      );
      if (already) {
        const status = already.status === "mock_sent" ? "mock_sent" : "sent";
        out.items.push({
          kolId: item.kolId,
          status,
          emailLogId: already.id,
          skipped: true,
        });
        if (status === "mock_sent") out.mocked += 1;
        else out.sent += 1;
        continue;
      }
    }

    let providerMessageId: string | null = null;
    let mocked = false;
    let errorMessage: string | null = null;

    try {
      const res = await sendEmail({
        to: item.toAddress,
        subject: item.subject,
        bodyText: item.bodyText,
      });
      providerMessageId = res.providerMessageId;
      mocked = res.mocked;
    } catch (err) {
      if (err instanceof SendEmailError) {
        errorMessage = `${err.code}: ${err.message}`;
      } else {
        errorMessage = (err as Error).message;
      }
    }

    // Persist EmailLog + KolCampaign status bump inside the tenant
    // transaction so a DB hiccup cannot leave an email "sent" with
    // no audit trail.
    const dbOut = await withTenant(tenantId, async (tx) => {
      // BL-099-F003 (ADR-018 D2) — snapshot the template name as-sent.
      // email_log no longer FK-joins email_template, so freeze the
      // current Asset name here; it survives rename/delete + the F005
      // table drop. null when no template (free-typed send) or the
      // template asset is gone.
      let templateName: string | null = null;
      if (item.templateId) {
        const tpl = await tx.asset.findUnique({
          where: { id: item.templateId },
          select: { name: true },
        });
        templateName = tpl?.name ?? null;
      }

      const emailLog = await tx.emailLog.create({
        data: {
          tenantId,
          campaignId,
          kolId: item.kolId,
          templateId: item.templateId ?? null,
          templateName,
          batchId, // BL-100-F002 — associate this row with the send batch
          aiCustomized: item.aiCustomized ?? false,
          toAddress: item.toAddress,
          fromAddress: FROM_ADDRESS,
          subject: item.subject,
          bodyHtml: item.bodyText, // MVP: HTML == text (plain)
          provider: "resend",
          providerMessageId,
          status: errorMessage
            ? "failed"
            : mocked
              ? "mock_sent"
              : "sent",
          sentAt: errorMessage ? null : new Date(),
          bounceReason: errorMessage ?? null,
        },
        select: { id: true },
      });

      // Advance KolCampaign.status if currently in an earlier stage.
      const link = await tx.kolCampaign.findUnique({
        where: {
          tenantId_kolId_campaignId: {
            tenantId,
            kolId: item.kolId,
            campaignId,
          },
        },
        select: { id: true, status: true },
      });
      let statusChangedTo: string | null = null;
      let auditedLinkId: string | null = null;
      let previousStatus: string | null = null;
      if (
        !errorMessage &&
        link &&
        FORWARDING_STATES.has(link.status)
      ) {
        await tx.kolCampaign.update({
          where: { id: link.id },
          data: { status: "contacted" },
        });
        statusChangedTo = "contacted";
        auditedLinkId = link.id;
        previousStatus = link.status;
      }

      return {
        emailLogId: emailLog.id,
        statusChangedTo,
        auditedLinkId,
        previousStatus,
      };
    });

    // Persist the audit AFTER the tx commits (so the row is visible)
    // and AWAIT it so callers / tests don't see racy partial writes.
    // logAudit has its own try/catch so failure here can't tank the
    // batch.
    if (dbOut.auditedLinkId && dbOut.previousStatus) {
      await logAudit({
        actorId,
        action: "campaign.kol.status_changed",
        targetType: "kol_campaign",
        targetId: dbOut.auditedLinkId,
        tenantId,
        before: { status: dbOut.previousStatus },
        after: { status: "contacted" },
      });
    }

    out.items.push({
      kolId: item.kolId,
      status: errorMessage ? "failed" : mocked ? "mock_sent" : "sent",
      error: errorMessage ?? undefined,
      providerMessageId,
      emailLogId: dbOut.emailLogId,
    });
    if (errorMessage) out.failed += 1;
    else if (mocked) out.mocked += 1;
    else out.sent += 1;

    void logEvent({
      type: "email.sent",
      tenantId,
      actorId,
      resourceId: dbOut.emailLogId,
      payload: {
        kolId: item.kolId,
        campaignId,
        mocked,
        aiCustomized: item.aiCustomized ?? false,
        templateId: item.templateId ?? null,
        status: errorMessage
          ? "failed"
          : mocked
            ? "mock_sent"
            : "sent",
      },
    });

    // Sleep between sends to honour throttle; skip after the last
    // item and when caller opts out (tests).
    if (i < items.length - 1 && !opts.skipSleep) {
      await sleep(throttle);
    }
  }

  return out;
}

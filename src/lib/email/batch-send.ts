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
      const emailLog = await tx.emailLog.create({
        data: {
          tenantId,
          campaignId,
          kolId: item.kolId,
          templateId: item.templateId ?? null,
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
        // audit_log is fire-and-forget inside tx helper, but
        // logAudit itself catches errors so it's safe to await here.
        void logAudit({
          actorId,
          action: "campaign.kol.status_changed",
          targetType: "kol_campaign",
          targetId: link.id,
          tenantId,
          before: { status: link.status },
          after: { status: "contacted" },
        });
      }

      return { emailLogId: emailLog.id, statusChangedTo };
    });

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

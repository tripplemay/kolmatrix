"use server";

/**
 * BL-066-F004 · AI recommendation accept / skip server actions.
 *
 * Powers the AiRecommendationPanel (F003) "Accept" button. Writes a
 * kol_campaign row with source="ai_smart_match", status="pending"
 * (initial 6-value contact lifecycle stage — spec wording
 * "not_contacted" maps to the schema's "pending" default), and emits
 * an audit_log row "campaign.kol_accepted_via_ai".
 *
 * Idempotent: duplicate Accept on the same (campaignId, kolId) tuple
 * returns ok silently (no second kol_campaign row, no second audit
 * entry). This differs from the legacy addKolToCampaign which threw
 * "already_linked" — the F003 client may submit the same kolId twice
 * if the user double-clicks before router.refresh lands.
 *
 * skipKolAction is a server-action framework reserved for BL-067 C3
 * (where Skip emits a personalization signal to a future kol_campaign
 * metadata table). For BL-066 the panel keeps Skip purely client-side
 * (per audit §裁决 #E client-state status), so this action is a no-op
 * placeholder that returns ok and logs nothing.
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { logAudit } from "@/lib/audit/log";
import { withTenant } from "@/lib/db";
import { rateLimitBatchSend } from "@/lib/rate-limit-batch";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RecommendActionResult =
  | { ok: true; kolCampaignId: string; deduped?: boolean }
  | { ok: false; error: RecommendError; retryAfter?: number };

export type RecommendError =
  | "unauthorized"
  | "validation_failed"
  | "campaign_not_found"
  | "kol_not_found"
  | "rate_limit_exceeded"
  | "db_error";

interface AcceptInput {
  campaignId: string;
  kolId: string;
  matchScore?: number | null;
}

async function requireSession(): Promise<
  { tenantId: string; userId: string } | null
> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (
    !tenantId ||
    !UUID_RE.test(tenantId) ||
    !userId ||
    !UUID_RE.test(userId)
  ) {
    return null;
  }
  return { tenantId, userId };
}

export async function acceptKolToCampaignAction(
  input: AcceptInput
): Promise<RecommendActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };

  if (!UUID_RE.test(input.campaignId) || !UUID_RE.test(input.kolId)) {
    return { ok: false, error: "validation_failed" };
  }
  if (
    input.matchScore != null &&
    (!Number.isFinite(input.matchScore) ||
      input.matchScore < 0 ||
      input.matchScore > 100)
  ) {
    return { ok: false, error: "validation_failed" };
  }

  const rl = await rateLimitBatchSend(session.userId);
  if (!rl.ok) {
    return {
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: rl.retryAfter,
    };
  }

  try {
    const outcome = await withTenant(session.tenantId, async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        return { ok: false as const, error: "campaign_not_found" as const };
      }

      const kol = await tx.kol.findUnique({
        where: { id: input.kolId },
        select: { id: true },
      });
      if (!kol) {
        return { ok: false as const, error: "kol_not_found" as const };
      }

      const existing = await tx.kolCampaign.findUnique({
        where: {
          tenantId_kolId_campaignId: {
            tenantId: session.tenantId,
            kolId: input.kolId,
            campaignId: input.campaignId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        return {
          ok: true as const,
          kolCampaignId: existing.id,
          deduped: true as const,
        };
      }

      const link = await tx.kolCampaign.create({
        data: {
          tenantId: session.tenantId,
          campaignId: input.campaignId,
          kolId: input.kolId,
          status: "pending",
          source: "ai_smart_match",
          matchScore:
            input.matchScore == null ? null : Math.round(input.matchScore),
        },
        select: { id: true },
      });

      return { ok: true as const, kolCampaignId: link.id, deduped: false };
    });

    if (!outcome.ok) return outcome;

    if (!outcome.deduped) {
      void logAudit({
        actorId: session.userId,
        action: "campaign.kol_accepted_via_ai",
        targetType: "kol_campaign",
        targetId: outcome.kolCampaignId,
        tenantId: session.tenantId,
        after: {
          campaignId: input.campaignId,
          kolId: input.kolId,
          source: "ai_smart_match",
          matchScore: input.matchScore ?? null,
        },
      });
    }

    revalidatePath(`/[locale]/campaigns/${input.campaignId}`, "page");

    return outcome.deduped
      ? { ok: true, kolCampaignId: outcome.kolCampaignId, deduped: true }
      : { ok: true, kolCampaignId: outcome.kolCampaignId };
  } catch (err) {
    console.error("[acceptKolToCampaignAction] db error:", err);
    return { ok: false, error: "db_error" };
  }
}

export async function skipKolAction(input: {
  campaignId: string;
  kolId: string;
}): Promise<RecommendActionResult> {
  // BL-066-F004 audit §裁决 #E: Skip is client-state-only for the BL-066
  // batch. This action is a reserved framework slot — BL-067 C3 will fill
  // it in to write a kol_campaign extra-metadata row that feeds the
  // personalization-learning loop. Until then it is a deliberate no-op
  // (we keep the typed input so the F003 client can call with the same
  // shape Accept uses, and so BL-067 doesn't have to migrate callsites).
  void input;
  const session = await requireSession();
  if (!session) return { ok: false, error: "unauthorized" };
  return { ok: true, kolCampaignId: "" };
}

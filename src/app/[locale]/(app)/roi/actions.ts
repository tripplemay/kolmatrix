"use server";

/**
 * BM2-F009 · /roi Server Actions.
 *
 * `generateRoiInsightsAction` — wraps `generateRoiInsights` with
 * tenant-scoped auth + event_log telemetry. Pulls fresh summary +
 * top 25 completed campaigns at call time so the AI sees the same
 * data the user is looking at (no stale snapshot from page load).
 */
import { auth } from "@/auth";
import { logEvent } from "@/lib/events/log";
import { rateLimitAi } from "@/lib/rate-limit-ai";
import {
  generateRoiInsights,
  RoiInsightsError,
  type RoiInsightItem,
} from "@/lib/roi/insights";
import {
  loadRoiCampaigns,
  loadRoiSummary,
} from "@/lib/roi/queries";

export type RoiInsightsActionResult =
  | { ok: true; insights: RoiInsightItem[]; traceId?: string }
  | { ok: false; error: string; retryAfter?: number };

export async function generateRoiInsightsAction(
  locale: "en" | "zh"
): Promise<RoiInsightsActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId) return { ok: false, error: "unauthorized" };

  // BL-035-F003: per-tenant AI rate limit (10/min + 100/day). Redis
  // outage fails open — cost-cap (BL-034 F005) is the secondary guard.
  const rl = await rateLimitAi(tenantId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  void logEvent({
    type: "roi.insights_clicked",
    tenantId,
    actorId: userId ?? undefined,
  });

  try {
    const [summary, campaigns] = await Promise.all([
      loadRoiSummary(tenantId),
      loadRoiCampaigns(tenantId),
    ]);

    const result = await generateRoiInsights({
      campaigns: campaigns.slice(0, 25).map((c) => ({
        name: c.name,
        product: c.productName,
        spendTotal: c.spendTotal,
        revenueRecorded: c.revenueRecorded,
        roiPercent: c.roiPercent,
        startedAt: null,
        closedAt: c.closedAt,
        kolCount: 0,
      })),
      summary: {
        totalSpend: summary.totalSpend,
        totalRevenue: summary.totalRevenue,
        avgRoiPercent: summary.avgRoiPercent,
        topCampaignName: summary.topCampaign?.name ?? null,
        topCampaignRoi: summary.topCampaign?.roiPercent ?? null,
      },
      locale,
    });

    void logEvent({
      type: "roi.insights_generated",
      tenantId,
      actorId: userId ?? undefined,
      payload: {
        traceId: result.traceId ?? null,
        count: result.insights.length,
      },
    });

    return { ok: true, insights: result.insights, traceId: result.traceId };
  } catch (err) {
    const code = err instanceof RoiInsightsError ? err.code : "generic";
    void logEvent({
      type: "roi.insights_failed",
      tenantId,
      actorId: userId ?? undefined,
      payload: { code },
    });
    return { ok: false, error: code };
  }
}

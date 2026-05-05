"use server";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { logEvent } from "@/lib/events/log";
import { rateLimitAi } from "@/lib/rate-limit-ai";
import {
  DatabaseIntelligenceError,
  type DatabaseIntelligenceInsight,
  generateDatabaseIntelligence,
} from "@/lib/kol-database/intelligence";

export type DatabaseInsightsActionResult =
  | { ok: true; insights: DatabaseIntelligenceInsight[]; traceId?: string }
  | { ok: false; error: string; retryAfter?: number };

function tierForValueScore(valueScore: number | null): string {
  if (valueScore == null) return "unrated";
  if (valueScore >= 80) return "high";
  if (valueScore >= 60) return "medium";
  return "low";
}

export async function generateDatabaseInsightsAction(
  locale: string
): Promise<DatabaseInsightsActionResult> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  const userId = session?.user?.id;
  if (!tenantId) return { ok: false, error: "unauthorized" };

  // BL-035-F003: per-tenant AI rate limit (10/min + 100/day).
  const rl = await rateLimitAi(tenantId);
  if (!rl.ok) {
    return { ok: false, error: "rate_limit_exceeded", retryAfter: rl.retryAfter };
  }

  void logEvent({
    type: "database.insights_clicked",
    tenantId,
    actorId: userId ?? undefined,
  });

  try {
    const rows = await withTenant(tenantId, (tx) =>
      tx.kol.findMany({
        where: {
          isSaved: true,
          deletedAt: null,
          isSuspicious: false,
        },
        select: {
          countryCode: true,
          categories: true,
          relationshipStatus: true,
          valueScore: true,
        },
      })
    );

    const byRegion = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byTier = new Map<string, number>();
    const byRelationshipStatus = new Map<string, number>();

    for (const row of rows) {
      const region = row.countryCode ?? "unknown";
      byRegion.set(region, (byRegion.get(region) ?? 0) + 1);

      const tier = tierForValueScore(row.valueScore);
      byTier.set(tier, (byTier.get(tier) ?? 0) + 1);

      byRelationshipStatus.set(
        row.relationshipStatus,
        (byRelationshipStatus.get(row.relationshipStatus) ?? 0) + 1
      );

      if (row.categories.length === 0) {
        byCategory.set("Other", (byCategory.get("Other") ?? 0) + 1);
      } else {
        for (const cat of row.categories) {
          byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
        }
      }
    }

    const result = await generateDatabaseIntelligence({
      locale,
      snapshot: {
        total: rows.length,
        byRegion: [...byRegion.entries()].map(([region, count]) => ({ region, count })),
        byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
        byTier: [...byTier.entries()].map(([tier, count]) => ({ tier, count })),
        byRelationshipStatus: [...byRelationshipStatus.entries()].map(([status, count]) => ({
          status,
          count,
        })),
      },
    });

    void logEvent({
      type: "database.insights_generated",
      tenantId,
      actorId: userId ?? undefined,
      payload: {
        traceId: result.traceId ?? null,
        count: result.insights.length,
      },
    });

    return { ok: true, insights: result.insights, traceId: result.traceId };
  } catch (err) {
    const code = err instanceof DatabaseIntelligenceError ? err.code : "generic";
    void logEvent({
      type: "database.insights_failed",
      tenantId,
      actorId: userId ?? undefined,
      payload: { code },
    });
    return { ok: false, error: code };
  }
}

/**
 * BL-067-F002 · Asset-backed cache for /campaigns/[id] explainability.
 *
 * Two cache "kinds" share the same Asset table with type-based partitioning:
 *   - `ai_recommendation_explanation_short`  — 1-sentence ≤80 char per locale
 *   - `ai_recommendation_explanation_detailed` — 5-segment ≤200 char per locale
 *
 * Cache key (per spec §5 不变量 #2 — three-tuple `(campaignId, kolId, locale)`)
 * is encoded into `Asset.name` as:
 *   `explain-{short|detailed}/{campaignId}/{kolId}/{locale}`
 *
 * This lets us reuse the existing `(tenantId, type, status)` composite index
 * for the lookup prefix and apply a final equality filter on `name` — no new
 * JSONB GIN index needed.
 *
 * TTL: 24h strict from `Asset.createdAt` (per spec §5 不变量 #3 — no sliding
 * window). Garbage collection is per-day cron via
 * `scripts/cleanup-expired-explanation-assets.ts` (06:30 BJT, avoiding the
 * kol-sync-daily 04:00-06:00 BJT window).
 *
 * RLS: All reads + writes go through `withTenant(tenantId, ...)` so the
 * BL-034-era `asset_tenant_isolation` policy (tenant_id = current_setting('app.tenant_id')
 * OR tenant_id IS NULL) lets the rows through. Calling without `withTenant`
 * results in zero-row reads (silent miss) and INSERT failures with
 * `app.tenant_id` unset — both safe defaults.
 */
import { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";

/** TTL boundary: rows with `createdAt > now - TTL_MS` are still valid. */
export const TTL_MS = 24 * 60 * 60 * 1000;

export interface DetailedExplanationSegments {
  matchScore: string;
  categoryFit: string;
  recentActivity: string;
  audienceFit: string;
  brandHistory: string;
}

export interface ExplanationMetadata {
  /** Total tokens consumed (prompt + completion). */
  tokenUsage?: number;
  /** Cost in USD as returned by aigcgateway (or 0 if unavailable). */
  costUsd?: number;
  /** aigcgateway trace id for cross-system audit lookup. */
  traceId?: string | null;
}

/** Compose the cache key encoded into `Asset.name`. */
export function cacheName(
  kind: "short" | "detailed",
  campaignId: string,
  kolId: string,
  locale: string,
): string {
  return `explain-${kind}/${campaignId}/${kolId}/${locale}`;
}

function buildMetadata(
  kolId: string,
  campaignId: string,
  locale: string,
  metadata: ExplanationMetadata | undefined,
  now: Date,
): Record<string, unknown> {
  return {
    kolId,
    campaignId,
    locale,
    generatedAt: now.toISOString(),
    tokenUsage: metadata?.tokenUsage ?? null,
    costUsd: metadata?.costUsd ?? null,
    traceId: metadata?.traceId ?? null,
  };
}

/**
 * Read the cached short explanation (1 sentence) for a given KOL+campaign+locale,
 * or `null` on cache miss / expired (>24h).
 */
export async function readShortExplanation(
  tenantId: string,
  campaignId: string,
  kolId: string,
  locale: string,
  now: () => number = Date.now,
): Promise<string | null> {
  const name = cacheName("short", campaignId, kolId, locale);
  const expireBefore = new Date(now() - TTL_MS);

  const row = await withTenant(tenantId, (tx) =>
    tx.asset.findFirst({
      where: {
        tenantId,
        type: "ai_recommendation_explanation_short",
        name,
        createdAt: { gt: expireBefore },
      },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    }),
  );

  if (!row) return null;
  const text = (row.content as { text?: unknown } | null)?.text;
  return typeof text === "string" ? text : null;
}

/**
 * Write one short-explanation cache row (one row per locale). Caller is
 * expected to invoke this 5× (once per locale) inside the F005 worker.
 */
export async function writeShortExplanation(
  tenantId: string,
  campaignId: string,
  kolId: string,
  locale: string,
  content: string,
  metadata?: ExplanationMetadata,
  now: () => Date = () => new Date(),
): Promise<void> {
  const name = cacheName("short", campaignId, kolId, locale);
  await withTenant(tenantId, (tx) =>
    tx.asset.create({
      data: {
        tenantId,
        type: "ai_recommendation_explanation_short",
        name,
        content: { text: content } as Prisma.InputJsonValue,
        source: "ai_generated",
        status: "published",
        metadata: buildMetadata(
          kolId,
          campaignId,
          locale,
          metadata,
          now(),
        ) as Prisma.InputJsonValue,
      },
    }),
  );
}

/**
 * Read the cached detailed explanation (5 segments) for a given
 * KOL+campaign+locale, or `null` on cache miss / expired / malformed payload.
 */
export async function readDetailedExplanation(
  tenantId: string,
  campaignId: string,
  kolId: string,
  locale: string,
  now: () => number = Date.now,
): Promise<DetailedExplanationSegments | null> {
  const name = cacheName("detailed", campaignId, kolId, locale);
  const expireBefore = new Date(now() - TTL_MS);

  const row = await withTenant(tenantId, (tx) =>
    tx.asset.findFirst({
      where: {
        tenantId,
        type: "ai_recommendation_explanation_detailed",
        name,
        createdAt: { gt: expireBefore },
      },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    }),
  );

  if (!row) return null;
  const c = row.content as Record<string, unknown> | null;
  if (!c) return null;
  if (
    typeof c.matchScore !== "string" ||
    typeof c.categoryFit !== "string" ||
    typeof c.recentActivity !== "string" ||
    typeof c.audienceFit !== "string" ||
    typeof c.brandHistory !== "string"
  ) {
    return null;
  }
  return {
    matchScore: c.matchScore,
    categoryFit: c.categoryFit,
    recentActivity: c.recentActivity,
    audienceFit: c.audienceFit,
    brandHistory: c.brandHistory,
  };
}

/**
 * Write one detailed-explanation cache row (one row per locale). Caller is
 * expected to invoke this 5× inside the F004 server action.
 */
export async function writeDetailedExplanation(
  tenantId: string,
  campaignId: string,
  kolId: string,
  locale: string,
  segments: DetailedExplanationSegments,
  metadata?: ExplanationMetadata,
  now: () => Date = () => new Date(),
): Promise<void> {
  const name = cacheName("detailed", campaignId, kolId, locale);
  await withTenant(tenantId, (tx) =>
    tx.asset.create({
      data: {
        tenantId,
        type: "ai_recommendation_explanation_detailed",
        name,
        content: { ...segments } as unknown as Prisma.InputJsonValue,
        source: "ai_generated",
        status: "published",
        metadata: buildMetadata(
          kolId,
          campaignId,
          locale,
          metadata,
          now(),
        ) as Prisma.InputJsonValue,
      },
    }),
  );
}

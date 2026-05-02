/**
 * BIx-mvp-polish-pass F004-P3 · Tiered refresh selector.
 *
 * Replaces the lastSyncedAt-asc FIFO that B6 shipped with a
 * value-aware schedule:
 *
 *   Tier 1  · top 50 by valueScore  → every 3 days
 *   Tier 2  · rank 51-500           → every 7 days
 *   Tier 3  · rank 500+ FIFO        → every 21 days
 *   Flagged · isSuspicious=true     → forced into every batch
 *
 * Each tier is split into N daily buckets (3/7/21) so the cost stays
 * roughly flat day-to-day and a full rotation completes inside the
 * tier's cycle. Picking is deterministic on a given date so a cron
 * miss only delays a bucket by one day.
 *
 * Cost: with `MAX_TOTAL_REFRESH=200` the batch hits ⌈200/50⌉=4
 * channels.list calls per day — same quota envelope as the old FIFO
 * but the *valuable* channels stay fresh while the long-tail backs
 * off to 3-week cadence.
 *
 * Pure tier-pick logic lives in `pickTieredRefreshIds` so unit tests
 * can drive it without a Postgres testcontainer; the Prisma-backed
 * fetcher (`fetchTieredRefreshIds`) is a thin orchestration layer
 * around it.
 */
import type { PrismaClient } from "@prisma/client";

export const TIER1_TOP_N = 50;
export const TIER1_CYCLE_DAYS = 3;
export const TIER2_TOP_N = 500;
export const TIER2_CYCLE_DAYS = 7;
export const TIER3_CYCLE_DAYS = 21;
export const FLAGGED_CAP = 100;
export const DEFAULT_MAX_TOTAL_REFRESH = 200;

export interface TieredRefreshInput {
  /** External ids of the top 50 by valueScore (Tier 1). Order matters
   *  — the same input order on day 1 / day 2 / day 3 produces
   *  disjoint slices that cover the whole list once. */
  tier1: readonly string[];
  /** External ids of rank 51-500 by valueScore (Tier 2). Up to 450. */
  tier2: readonly string[];
  /** External ids of rank 500+ ordered lastSyncedAt asc (Tier 3).
   *  Caller may pre-trim — typical caller passes the entire long-tail
   *  and lets `pickTieredRefreshIds` slice today's bucket. */
  tier3: readonly string[];
  /** External ids of `isSuspicious=true` rows. Always included
   *  (capped at FLAGGED_CAP for safety). */
  flagged: readonly string[];
  /** UTC date — pinned for tests, defaults to `new Date()` in
   *  production. */
  date: Date;
  /** Hard cap so a single day never burns more than ⌈cap/50⌉ quota
   *  units even if all four tiers happen to pile up. */
  maxTotal?: number;
}

/**
 * Return today's deterministic refresh slate. Order: flagged first
 * (forced visibility), then Tier 1, then Tier 2, then Tier 3 — so a
 * `maxTotal` truncation degrades the long-tail before it touches the
 * valuable cohorts. Duplicate ids across tiers (e.g. a flagged top-50
 * channel) are deduped while preserving first-seen order.
 */
export function pickTieredRefreshIds(input: TieredRefreshInput): string[] {
  const dayOfYear = computeDayOfYear(input.date);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (ids: readonly string[]) => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  };

  // Flagged rows always run, capped so a sudden flood doesn't blow
  // the daily budget. The cap is a safety net — typical workloads
  // see < 10 flagged at a time.
  push(input.flagged.slice(0, FLAGGED_CAP));

  // Tier 1 — bucket = dayOfYear mod 3. Slice into 3 even-ish chunks.
  push(pickBucketSlice(input.tier1, dayOfYear, TIER1_CYCLE_DAYS));

  // Tier 2 — bucket = dayOfYear mod 7.
  push(pickBucketSlice(input.tier2, dayOfYear, TIER2_CYCLE_DAYS));

  // Tier 3 — bucket = dayOfYear mod 21. Caller already sorted by
  // lastSyncedAt asc so the slice naturally rotates the long-tail.
  push(pickBucketSlice(input.tier3, dayOfYear, TIER3_CYCLE_DAYS));

  const cap = input.maxTotal ?? DEFAULT_MAX_TOTAL_REFRESH;
  return out.slice(0, cap);
}

/**
 * Split `ids` into `cycleDays` evenly-sized buckets and return the
 * one indexed by `dayOfYear % cycleDays`. The slice boundaries are
 * computed via floor/ceil so every id is covered exactly once over
 * a full cycle, even when the list size doesn't divide cleanly.
 */
export function pickBucketSlice(
  ids: readonly string[],
  dayOfYear: number,
  cycleDays: number
): readonly string[] {
  if (ids.length === 0 || cycleDays <= 0) return [];
  const bucket = ((dayOfYear % cycleDays) + cycleDays) % cycleDays;
  const start = Math.floor((ids.length * bucket) / cycleDays);
  const end = Math.floor((ids.length * (bucket + 1)) / cycleDays);
  return ids.slice(start, end);
}

function computeDayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

// ---------------------------------------------------------------------
// Prisma orchestration
// ---------------------------------------------------------------------

export interface FetchTieredRefreshOpts {
  tenantId: string;
  /** Platform filter — adapter-specific (only "youtube" today). */
  platform: string;
  date?: Date;
  maxTotal?: number;
}

/**
 * Pull each tier from Postgres and feed `pickTieredRefreshIds`. Stays
 * thin so the value-aware ordering logic is unit-testable in
 * isolation; integration coverage hits the Prisma path through the
 * daily orchestrator suite.
 */
export async function fetchTieredRefreshIds(
  prisma: PrismaClient,
  opts: FetchTieredRefreshOpts
): Promise<string[]> {
  const where = {
    tenantId: opts.tenantId,
    platform: opts.platform,
    externalId: { not: null },
  } as const;

  // Step 1: pull the top 500 by valueScore in one query — slices
  // [0,50) → Tier 1; [50,500) → Tier 2; ids feed Tier 3's exclusion.
  const top500 = await prisma.kol.findMany({
    where,
    orderBy: [{ valueScore: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: TIER2_TOP_N,
    select: { id: true, externalId: true },
  });
  const top500Ids = top500.map((r) => r.id);

  // Step 2: Tier 3 (rank 500+) ordered by lastSyncedAt asc + flagged.
  const maxTotal = opts.maxTotal ?? DEFAULT_MAX_TOTAL_REFRESH;
  const [tier3Rows, flaggedRows] = await Promise.all([
    prisma.kol.findMany({
      where: { ...where, id: { notIn: top500Ids } },
      orderBy: [{ lastSyncedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      // 21× daily target keeps the in-memory bucket pick cheap while
      // still covering the cycle.
      take: 21 * maxTotal,
      select: { externalId: true },
    }),
    prisma.kol.findMany({
      where: { ...where, isSuspicious: true },
      take: FLAGGED_CAP,
      select: { externalId: true },
    }),
  ]);

  const onlyIds = (rows: ReadonlyArray<{ externalId: string | null }>): readonly string[] =>
    rows.map((r) => r.externalId).filter((id): id is string => Boolean(id));

  const tier1 = onlyIds(top500.slice(0, TIER1_TOP_N));
  const tier2 = onlyIds(top500.slice(TIER1_TOP_N, TIER2_TOP_N));

  return pickTieredRefreshIds({
    tier1,
    tier2,
    tier3: onlyIds(tier3Rows),
    flagged: onlyIds(flaggedRows),
    date: opts.date ?? new Date(),
    maxTotal,
  });
}

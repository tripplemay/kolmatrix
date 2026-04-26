/**
 * BM2-F007 · Pure-function CRM aggregators.
 *
 * Funnel chain (per Planner adjudication §13 #G:B):
 *   Total Pipeline → Contacted → Negotiated → Long-term Partners
 *
 *   Total Pipeline    = Σ all 6 status buckets
 *   Contacted         = first_contact + negotiating + long_term
 *   Negotiated        = negotiating + long_term
 *   Long-term Partners = long_term
 *
 * Conversion percent for each downstream step is `n / previous_n`,
 * gracefully degrading to `null` when the upstream step is zero.
 */
import {
  RELATIONSHIP_STATUSES,
  type RelationshipStatus,
} from "@/lib/kol/filters";

export interface StageBucket {
  status: RelationshipStatus;
  count: number;
}

export interface FunnelStep {
  /** Stable key used for translation lookup (e.g., "totalPipeline"). */
  key: "totalPipeline" | "contacted" | "negotiated" | "longTerm";
  count: number;
  /** Percent of the *previous* step. Null on step 0 and on div-by-zero. */
  conversionPercent: number | null;
}

/**
 * Fill missing buckets so the UI always renders 6 ordered rows even
 * when a tenant has 0 KOLs in some stage.
 */
export function fillStageDistribution(
  raw: Array<{ status: string; count: number }>
): StageBucket[] {
  const lookup = new Map<string, number>();
  for (const r of raw) lookup.set(r.status, r.count);
  return RELATIONSHIP_STATUSES.map((status) => ({
    status,
    count: lookup.get(status) ?? 0,
  }));
}

export function stagesToFunnel(buckets: StageBucket[]): FunnelStep[] {
  const lookup = new Map<RelationshipStatus, number>();
  for (const b of buckets) lookup.set(b.status, b.count);
  const totalPipeline = buckets.reduce((acc, b) => acc + b.count, 0);
  const contacted =
    (lookup.get("first_contact") ?? 0) +
    (lookup.get("negotiating") ?? 0) +
    (lookup.get("long_term") ?? 0);
  const negotiated =
    (lookup.get("negotiating") ?? 0) + (lookup.get("long_term") ?? 0);
  const longTerm = lookup.get("long_term") ?? 0;

  const pct = (n: number, prev: number): number | null => {
    if (prev <= 0) return null;
    return Math.round((n / prev) * 1000) / 10;
  };

  return [
    { key: "totalPipeline", count: totalPipeline, conversionPercent: null },
    {
      key: "contacted",
      count: contacted,
      conversionPercent: pct(contacted, totalPipeline),
    },
    {
      key: "negotiated",
      count: negotiated,
      conversionPercent: pct(negotiated, contacted),
    },
    {
      key: "longTerm",
      count: longTerm,
      conversionPercent: pct(longTerm, negotiated),
    },
  ];
}

/**
 * Bucket "signed/long_term"-bound audit_log rows into 14 daily slots
 * for the CRM Cumulative Spend sparkline (per §13.1 spendSparkline
 * data-source ruling: this proxies "new commitments per day" rather
 * than literal dollars, so the UI labels it accordingly).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export function bucketCommitments14d(
  events: Array<{ createdAt: Date; afterStatus: string | null }>,
  /**
   * Reference timestamp anchoring the rolling 14-day window. Defaults
   * to `Date.now()`, but tests pass an explicit value to avoid the
   * clock-drift flake CI surfaced in run 24959893338: when the test
   * builds `events` with one snapshot of `Date.now()` and the function
   * takes its own moments later, the boundary event near `13 * DAY_MS`
   * back can fall on either side of `start` depending on cold-runner
   * scheduling.
   */
  now: number = Date.now()
): number[] {
  const bins = new Array(14).fill(0);
  const start = now - 13 * DAY_MS; // 14 days inclusive
  for (const e of events) {
    if (
      e.afterStatus !== "signed" &&
      e.afterStatus !== "long_term"
    ) {
      continue;
    }
    const t = e.createdAt.getTime();
    if (t < start) continue;
    const idx = Math.min(13, Math.floor((t - start) / DAY_MS));
    if (idx >= 0) bins[idx] += 1;
  }
  return bins;
}

/**
 * KPI trend & sparkline computation (BL-052 F002 / Part A · BL-050).
 *
 * Reads `kpi_daily_snapshot` rows written by the daily cron
 * (scripts/kpi-snapshot-daily.ts) and produces the inputs the
 * dashboard's StatCard chips render:
 *   - direction / percent : 7-day-vs-prior-7-day delta
 *   - sparkline           : trailing 30-day series for the bar chart
 *   - hasEnoughData       : false until the table has TREND_WINDOW_DAYS
 *                           snapshots — UI then shows fallback "—" +
 *                           tooltip (D4 lock).
 *
 * The compute helpers are pure (no Prisma). loadKpiTrends is the only
 * function that touches the database; tests mock the tenant tx client.
 */
import type { TenantPrisma } from "@/lib/db";

export const TREND_WINDOW_DAYS = 7;
export const SPARKLINE_DAYS = 30;

export type TrendDirection = "up" | "down" | "flat";

export interface KpiTrend {
  direction: TrendDirection;
  /** Rounded to 1 decimal place. 0 when direction === "flat". */
  percent: number;
  /** Trailing SPARKLINE_DAYS daily values, oldest → newest. */
  sparkline: number[];
  /**
   * False when the snapshot history is shorter than TREND_WINDOW_DAYS,
   * so the UI knows to render the "data accumulating" fallback instead
   * of a misleading 0% chip.
   */
  hasEnoughData: boolean;
}

export interface KpiSnapshotPoint {
  snapshotDate: Date;
  kolCount: number;
  activeCampaigns: number;
  emailsSent7d: number;
  productCount: number;
}

export type KpiMetricKey = Exclude<keyof KpiSnapshotPoint, "snapshotDate">;

const METRIC_KEYS: KpiMetricKey[] = [
  "kolCount",
  "activeCampaigns",
  "emailsSent7d",
  "productCount",
];

/**
 * Compute direction + percent change between `current` and `reference`.
 * `reference` may be null (no prior data) — caller treats that as the
 * hasEnoughData=false branch and never renders the percent.
 */
export function computeKpiTrend(
  current: number,
  reference: number | null
): { direction: TrendDirection; percent: number } {
  if (reference == null || reference === 0) {
    if (current === 0) return { direction: "flat", percent: 0 };
    return { direction: "up", percent: 0 };
  }
  const delta = current - reference;
  if (delta === 0) return { direction: "flat", percent: 0 };
  const percent = Math.round((Math.abs(delta) / reference) * 1000) / 10;
  return { direction: delta > 0 ? "up" : "down", percent };
}

/**
 * Build a length-`days` sparkline ending at today.
 *
 * - history must be sorted oldest → newest by snapshotDate.
 * - Days with no snapshot inherit the previous-known value; days before
 *   the first snapshot fill with 0 (cold start).
 */
export function computeSparkline(
  history: { snapshotDate: Date; value: number }[],
  days: number
): number[] {
  if (days <= 0) return [];

  const byKey = new Map<string, number>();
  for (const p of history) {
    byKey.set(toDateKey(p.snapshotDate), p.value);
  }

  const today = startOfUtcDay(new Date());
  const out: number[] = new Array(days).fill(0);
  let last = 0;
  let seenAny = false;

  for (let i = 0; i < days; i++) {
    const day = new Date(today.getTime() - (days - 1 - i) * MS_PER_DAY);
    const key = toDateKey(day);
    const v = byKey.get(key);
    if (v !== undefined) {
      last = v;
      seenAny = true;
      out[i] = v;
    } else {
      out[i] = seenAny ? last : 0;
    }
  }
  return out;
}

/**
 * Load the trailing snapshot history for a tenant and compute the 4
 * KPI trend objects the dashboard renders.
 *
 * Caller is expected to be inside `withTenant(...)` so RLS pins reads.
 */
export async function loadKpiTrends(
  tx: TenantPrisma,
  tenantId: string
): Promise<Record<KpiMetricKey, KpiTrend>> {
  // Load enough history for both the 30-day sparkline AND the
  // 7-vs-prior-7 trend window. Take a small buffer so an unlucky
  // missing day at the boundary still gets a correctly anchored
  // reference point.
  const buffer = 2;
  const horizon = SPARKLINE_DAYS + TREND_WINDOW_DAYS + buffer;
  const cutoff = new Date(Date.now() - horizon * MS_PER_DAY);

  const rows = await tx.kpiDailySnapshot.findMany({
    where: { tenantId, snapshotDate: { gte: cutoff } },
    orderBy: { snapshotDate: "asc" },
    select: {
      snapshotDate: true,
      kolCount: true,
      activeCampaigns: true,
      emailsSent7d: true,
      productCount: true,
    },
  });

  const points: KpiSnapshotPoint[] = rows.map((r) => ({
    snapshotDate: r.snapshotDate,
    kolCount: r.kolCount,
    activeCampaigns: r.activeCampaigns,
    emailsSent7d: r.emailsSent7d,
    productCount: r.productCount,
  }));

  const result = {} as Record<KpiMetricKey, KpiTrend>;
  for (const key of METRIC_KEYS) {
    result[key] = buildTrend(points, key);
  }
  return result;
}

function buildTrend(points: KpiSnapshotPoint[], metric: KpiMetricKey): KpiTrend {
  const sparkline = computeSparkline(
    points.map((p) => ({ snapshotDate: p.snapshotDate, value: p[metric] })),
    SPARKLINE_DAYS
  );

  // hasEnoughData requires at least TREND_WINDOW_DAYS distinct
  // snapshots so a 7-vs-prior-7 comparison is meaningful.
  if (points.length < TREND_WINDOW_DAYS) {
    return { direction: "flat", percent: 0, sparkline, hasEnoughData: false };
  }

  const lastIdx = points.length - 1;
  const current = points[lastIdx][metric];
  // Reference = the snapshot exactly TREND_WINDOW_DAYS rows back from
  // today. When history is exactly TREND_WINDOW_DAYS long, fall back to
  // the oldest available row so the chip still computes a delta instead
  // of going flat. Each snapshot carries a 7-day-aware metric already
  // (emails_sent_7d is a rolling 7d total written daily), so the
  // anchor row is the right comparable for both count- and rate-based
  // KPIs.
  const referenceIdx = Math.max(0, lastIdx - TREND_WINDOW_DAYS);
  const reference = points[referenceIdx][metric];
  const { direction, percent } = computeKpiTrend(current, reference);
  return { direction, percent, sparkline, hasEnoughData: true };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toDateKey(d: Date): string {
  const u = startOfUtcDay(d);
  return `${u.getUTCFullYear()}-${u.getUTCMonth() + 1}-${u.getUTCDate()}`;
}

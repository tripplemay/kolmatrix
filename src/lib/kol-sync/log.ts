/**
 * B6-kol-daily-sync F004 · Structured log line + alert classification.
 *
 * Pure functions — the daily script writes the JSON line to
 * /var/log/kolmatrix-kol-sync.log via fs.appendFileSync, and any
 * downstream alerting (Sentry / Slack — not in B6 scope) reads the
 * `level` field to decide whether to page.
 *
 * Alert thresholds (per spec §F004 + docs/dev/kol-sync-runbook.md):
 *   quota_consumed > 3,000 →  WARN
 *   discover_count = 0     →  WARN today; ALERT only when 3 days in
 *                              a row are 0 (caller passes the streak
 *                              count from prior log lines)
 *   errors.length > 0      →  WARN
 *   duration_ms > 300,000  →  WARN
 */

export type LogLevel = "INFO" | "WARN" | "ALERT";

/** BIx-F004-P5 · per-(region, keyword) discover observability row. */
export interface PerMatrixEntry {
  region: string;
  keyword: string;
  /** Page reached on this run (1, 2, or 3 — see BIx-F004-P2 cursor). */
  page: number;
  found: number;
  newAfterDedupe: number;
  filterRejections: number;
}

/** BIx-F004-P5 · summary of the top-100 engagement batch run. */
export interface EngagementBatchStats {
  topKolsProcessed: number;
  engagementUpdated: number;
  latestVideosUpdated: number;
  channelsWithoutPlaylist: number;
  apiCallStats: { channels: number; playlistItems: number; videos: number };
}

export interface DailyLogLineInput {
  timestamp: string;
  endedAt: string;
  adapters: ReadonlyArray<{ name: string; healthy: boolean }>;
  discoverCount: number;
  refreshCount: number;
  inserted: number;
  updated: number;
  skipped: number;
  dedupeSkipped: number;
  estimatedQuotaConsumed: number;
  /** 10K daily quota - estimated consumed - safety buffer. Adapter
   *  layer doesn't have a real "remaining" reading, so we report a
   *  conservative estimate. */
  estimatedQuotaRemaining: number;
  errors: readonly string[];
  /** Streak of prior days with discoverCount = 0. The current run is
   *  not yet included (caller passes 0 on a fresh deployment). */
  zeroDiscoverStreakBefore: number;
  /** BIx-F004-P5 · per-cell discover stats. Optional so older log
   *  consumers / dry-runs that don't track this still serialize. */
  perMatrix?: readonly PerMatrixEntry[];
  /** BIx-F004-P5 · engagement batch summary. Optional for the same
   *  reason as `perMatrix`. */
  engagementBatchStats?: EngagementBatchStats;
}

export interface DailyLogLine extends DailyLogLineInput {
  durationMs: number;
  level: LogLevel;
  alerts: readonly string[];
}

// BIx-F004-P5 · BIx-F004 lifted nominal day to ~9,000u (matrix +
// publishedAfter + engagement batch). Threshold sits ~500u above the
// observed P95 so a "runaway adapter" still trips it.
const QUOTA_WARN_THRESHOLD = 9_500;
const ZERO_DISCOVER_ALERT_STREAK = 3; // 3 days in a row → ALERT
const DURATION_WARN_MS = 300_000; // 5 min

export function classifyDailyRun(input: DailyLogLineInput): DailyLogLine {
  const durationMs =
    new Date(input.endedAt).getTime() - new Date(input.timestamp).getTime();
  const alerts: string[] = [];
  if (input.estimatedQuotaConsumed > QUOTA_WARN_THRESHOLD) {
    alerts.push(
      `quota_consumed=${input.estimatedQuotaConsumed} > ${QUOTA_WARN_THRESHOLD} (likely runaway adapter)`
    );
  }
  if (input.discoverCount === 0) {
    const futureStreak = input.zeroDiscoverStreakBefore + 1;
    alerts.push(
      `discover_count=0 (streak=${futureStreak}/${ZERO_DISCOVER_ALERT_STREAK})`
    );
  }
  if (input.errors.length > 0) {
    alerts.push(`errors=${input.errors.length}`);
  }
  if (durationMs > DURATION_WARN_MS) {
    alerts.push(`duration_ms=${durationMs} > ${DURATION_WARN_MS}`);
  }

  let level: LogLevel = "INFO";
  if (alerts.length > 0) level = "WARN";
  // Escalate to ALERT only when the zero-discover streak crosses the
  // 3-day floor — a single empty day might just be a quota quirk.
  if (
    input.discoverCount === 0 &&
    input.zeroDiscoverStreakBefore + 1 >= ZERO_DISCOVER_ALERT_STREAK
  ) {
    level = "ALERT";
  }
  return { ...input, durationMs, level, alerts };
}

export function formatDailyLogLineJson(line: DailyLogLine): string {
  return JSON.stringify(line);
}

/**
 * Walk the existing log file (newline-delimited JSON) and count the
 * trailing days where `discover_count === 0`. Used by the daily
 * script to feed `zeroDiscoverStreakBefore` into classifyDailyRun.
 *
 * Tolerates malformed lines (returns the streak so far). Empty file
 * or missing file → 0.
 */
export function countTrailingZeroDiscoverStreak(rawLog: string): number {
  const lines = rawLog
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  let streak = 0;
  // Walk backwards from the most recent line.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let parsed: { discover_count?: number; discoverCount?: number } | null = null;
    try {
      parsed = JSON.parse(lines[i]!);
    } catch {
      // Bad line → stop counting; we can't trust the prefix.
      break;
    }
    const count = parsed?.discover_count ?? parsed?.discoverCount;
    if (count === 0) streak += 1;
    else break;
  }
  return streak;
}

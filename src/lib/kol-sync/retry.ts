/**
 * B6-kol-daily-sync F004 · Generic exponential backoff retry helper.
 *
 * Owns the 30s / 2min / 5min backoff schedule the spec calls for
 * (same as BM2 F006). Lives in lib/ rather than the daily script so
 * (a) the dispatcher can wrap each adapter call without circular
 * imports, and (b) `scripts/seed-kol-from-youtube.ts` re-exports
 * from here — one source of truth for the retry semantics across
 * the kol-seed-redo + B6 paths.
 *
 * `sleep` is injectable so tests can drive the schedule synchronously
 * rather than waiting 7.5 minutes for the worst-case path.
 */

/** 30s / 2min / 5min — three retries before surfacing the error. */
export const DEFAULT_BACKOFFS_MS: readonly number[] = [30_000, 120_000, 300_000];

export interface RetryOpts {
  backoffsMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, err: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {}
): Promise<T> {
  const backoffs = opts.backoffsMs ?? DEFAULT_BACKOFFS_MS;
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= backoffs.length; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === backoffs.length) break;
      opts.onRetry?.(attempt + 1, err);
      await sleep(backoffs[attempt]!);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

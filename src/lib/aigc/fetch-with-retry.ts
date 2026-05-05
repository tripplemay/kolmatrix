/**
 * BL-035-F010 · Shared `fetch` wrapper for aigcgateway `/actions/run`
 * callers (campaigns/suggestions, email/customize, kol-database/intelligence,
 * roi/insights, weekly-report/generate). Behaviour matches the previously
 * duplicated locals (timeout via AbortController, single retry on 5xx/429
 * and on transport errors, 4xx returned terminally) and adds a randomised
 * jitter ([0, 250) ms) on the retry sleep — `framework/harness/CHANGELOG.md`
 * v0.9.12 §AI-M4 calls out the thundering-herd risk when many callers
 * retry in lockstep.
 *
 * `resolveAigcV1BaseUrl` is re-exported for the same single-import
 * ergonomic that the spec asks for.
 */
import "dotenv/config";
import { resolveAigcV1BaseUrl } from "@/lib/aigc/base-url";

export { resolveAigcV1BaseUrl };

export interface FetchWithRetryOpts {
  /** Per-attempt timeout. Default: AIGC_TIMEOUT_MS env or 10_000. */
  timeoutMs?: number;
  /** Retry once on 5xx / 429. Default: true. */
  retryOn5xx?: boolean;
  /** Retry attempts (in addition to the initial attempt). Default: 1. */
  retries?: number;
  /** Sleep before each retry (jitter is added on top). Default: 500. */
  retryDelayMs?: number;
  /** Internal: stub fetch in tests. */
  fetchImpl?: typeof fetch;
  /** Internal: stub the [0, 250) jitter so tests are deterministic. */
  jitterImpl?: () => number;
  /** Internal: stub the sleep so tests don't actually wait. */
  sleepImpl?: (ms: number) => Promise<void>;
}

export const DEFAULT_RETRY_DELAY_MS = 500;
export const JITTER_MAX_MS = 250;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 1;

function resolveTimeoutMs(): number {
  const raw = process.env.AIGC_TIMEOUT_MS;
  const parsed = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export function defaultJitter(): number {
  return Math.random() * JITTER_MAX_MS;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout + single retry on 5xx / 429 / transport error.
 * Returns the final `Response` (which may be a 4xx — caller decides).
 * Throws the underlying error when all retries failed in transport.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: FetchWithRetryOpts = {},
): Promise<Response> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const timeoutMs = opts.timeoutMs ?? resolveTimeoutMs();
  const retryOn5xx = opts.retryOn5xx ?? true;
  const baseDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const jitterImpl = opts.jitterImpl ?? defaultJitter;
  const sleepImpl = opts.sleepImpl ?? defaultSleep;

  let lastTransportErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
      // 4xx is terminal (bad input / auth) — return immediately.
      const isRetryable = res.status >= 500 || res.status === 429;
      if (!isRetryable || !retryOn5xx) return res;
      if (attempt === retries) return res;
      await sleepImpl(baseDelayMs + jitterImpl());
    } catch (err) {
      clearTimeout(timer);
      lastTransportErr = err;
      if (attempt === retries) throw err;
      await sleepImpl(baseDelayMs + jitterImpl());
    }
  }

  throw lastTransportErr instanceof Error
    ? lastTransportErr
    : new Error("fetchWithRetry: unreachable");
}

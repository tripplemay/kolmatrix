/**
 * B6-kol-daily-sync F001 · Adapter dispatcher.
 *
 * Walks every registered adapter and runs `discover` (delta crawl) or
 * `refresh` (re-fetch existing externalIds) against each. Returns a
 * structured report rather than throwing — one adapter going down
 * should never silently take the whole daily sync with it. F004 layers
 * retry / backoff on top of the adapter calls; this file stays
 * ignorant of that detail so unit tests can drive it directly.
 */
import { withRetry } from "./retry";
import type {
  AdapterOutcome,
  DailySyncOpts,
  HealthCheckResult,
  KolSyncAdapter,
  RawKolData,
  RefreshOpts,
  RefreshReport,
  SyncReport,
} from "./types";

export class KolSyncDispatcher {
  private readonly adapters = new Map<string, KolSyncAdapter>();

  constructor(adapters: readonly KolSyncAdapter[] = []) {
    for (const a of adapters) this.register(a);
  }

  /** Register a fresh adapter. Throws on duplicate name so silent
   *  shadowing of an existing source is impossible. */
  register(adapter: KolSyncAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`KolSyncDispatcher: adapter already registered: ${adapter.name}`);
    }
    this.adapters.set(adapter.name, adapter);
  }

  list(): readonly KolSyncAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Probe every adapter. A throwing `healthCheck()` is reported as
   * `{ healthy: false, details.error }` rather than rejecting — the
   * caller wants a complete picture across sources.
   */
  async healthCheckAll(): Promise<Record<string, HealthCheckResult>> {
    const out: Record<string, HealthCheckResult> = {};
    for (const [name, adapter] of this.adapters) {
      try {
        out[name] = await adapter.healthCheck();
      } catch (err) {
        out[name] = {
          healthy: false,
          details: { error: err instanceof Error ? err.message : String(err) },
        };
      }
    }
    return out;
  }

  /**
   * Daily delta crawl. One adapter throwing surfaces as a non-OK
   * outcome unless `failFast` is set; the rest still get to run.
   * When `opts.retry` is provided each adapter call is wrapped in
   * the 30s/2min/5min backoff (F004) — the outcome still surfaces
   * `ok: false` if all retries fail.
   */
  async runDailySync(opts: DailySyncOpts = {}): Promise<SyncReport> {
    const startedAt = new Date().toISOString();
    const outcomes: AdapterOutcome<RawKolData[]>[] = [];
    for (const [name, adapter] of this.adapters) {
      const params = opts.perAdapterParams?.[name] ?? {};
      try {
        const data = opts.retry
          ? await withRetry(() => adapter.discover(params), opts.retry)
          : await adapter.discover(params);
        outcomes.push({ adapter: name, ok: true, data });
      } catch (err) {
        outcomes.push({
          adapter: name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        if (opts.failFast) break;
      }
    }
    return {
      startedAt,
      endedAt: new Date().toISOString(),
      outcomes,
      totals: tallyOutcomes(outcomes, "discover"),
    };
  }

  /**
   * Re-fetch known externalIds per adapter. Adapters with an empty
   * (or missing) id list skip cleanly — useful when only one source
   * is on the refresh rota for the day. Same retry semantics as
   * runDailySync.
   */
  async runRefresh(opts: RefreshOpts): Promise<RefreshReport> {
    const startedAt = new Date().toISOString();
    const outcomes: AdapterOutcome<RawKolData[]>[] = [];
    for (const [name, adapter] of this.adapters) {
      const ids = opts.perAdapterIds[name] ?? [];
      if (ids.length === 0) continue;
      try {
        const data = opts.retry
          ? await withRetry(() => adapter.refresh(ids), opts.retry)
          : await adapter.refresh(ids);
        outcomes.push({ adapter: name, ok: true, data });
      } catch (err) {
        outcomes.push({
          adapter: name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        if (opts.failFast) break;
      }
    }
    return {
      startedAt,
      endedAt: new Date().toISOString(),
      outcomes,
      totals: tallyOutcomes(outcomes, "refresh"),
    };
  }
}

function tallyOutcomes(
  outcomes: readonly AdapterOutcome<RawKolData[]>[],
  kind: "discover"
): SyncReport["totals"];
function tallyOutcomes(
  outcomes: readonly AdapterOutcome<RawKolData[]>[],
  kind: "refresh"
): RefreshReport["totals"];
function tallyOutcomes(
  outcomes: readonly AdapterOutcome<RawKolData[]>[],
  kind: "discover" | "refresh"
) {
  const successCount = outcomes.reduce(
    (s, o) => (o.ok ? s + o.data.length : s),
    0
  );
  const failedAdapters = outcomes.filter((o) => !o.ok).length;
  return kind === "discover"
    ? { discoverCount: successCount, failedAdapters }
    : { refreshCount: successCount, failedAdapters };
}

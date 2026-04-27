/**
 * B6-kol-daily-sync F001 · In-memory mock adapter.
 *
 * Lives in src/ rather than tests/ so future scripts (e.g. a local
 * smoke driver) can wire it up too. The adapter is fully deterministic
 * and emits the channels you hand to the constructor — `discover`
 * filters by region/keyword, `refresh` projects by externalId.
 */
import type {
  HealthCheckResult,
  KolSyncAdapter,
  RawKolData,
  SyncParams,
} from "../types";

export interface MockKolSyncAdapterOpts {
  name?: string;
  source?: string;
  channels: readonly RawKolData[];
  /** When set, every call to `discover` / `refresh` / `healthCheck`
   *  rejects with this error. Used to drive the dispatcher's failure
   *  branch in tests. */
  fail?: Error | null;
}

export class MockKolSyncAdapter implements KolSyncAdapter {
  readonly name: string;
  readonly source: string;

  private readonly channels: readonly RawKolData[];
  private readonly fail: Error | null;

  constructor(opts: MockKolSyncAdapterOpts) {
    this.name = opts.name ?? "mock";
    this.source = opts.source ?? "mock-source";
    this.channels = opts.channels;
    this.fail = opts.fail ?? null;
  }

  async discover(params: SyncParams): Promise<RawKolData[]> {
    if (this.fail) throw this.fail;
    return this.channels.filter((c) => {
      if (params.region && c.country !== params.region) return false;
      if (params.minSubscribers != null && c.subscriberCount < params.minSubscribers) {
        return false;
      }
      if (params.keywords && params.keywords.length > 0) {
        const hay = `${c.displayName} ${c.description ?? ""}`.toLowerCase();
        const hit = params.keywords.some((k) => hay.includes(k.toLowerCase()));
        if (!hit) return false;
      }
      return true;
    });
  }

  async refresh(externalIds: readonly string[]): Promise<RawKolData[]> {
    if (this.fail) throw this.fail;
    const set = new Set(externalIds);
    return this.channels.filter((c) => set.has(c.externalId));
  }

  async healthCheck(): Promise<HealthCheckResult> {
    if (this.fail) throw this.fail;
    return { healthy: true, details: { channels: this.channels.length } };
  }
}

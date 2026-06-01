/**
 * BL-075-F003/F004 · Enrichment stage shared between the daily sync
 * (scripts/kol-sync-daily.ts) and the one-shot backfill
 * (scripts/kol-enrichment-backfill.ts).
 *
 * Walks every active gaming KOL in `tenantId` with a NULL/blank
 * `country_code` or `language`, calls `enrichKol()`, then writes the
 * resolved value back together with an `kol.enriched` audit_log entry.
 * Concurrency is bounded so the LLM rate limit cannot be tripped by
 * the daily 100-row batch nor the one-shot 1397-row backfill.
 *
 * The function is reusable rather than embedded in `kol-sync-daily.ts`
 * so the backfill can call the same path and report the same stats
 * shape — the audit trail must be identical between the two callers.
 *
 * Failure semantics:
 *   - enrichKol never throws (see src/lib/kol/enrichment.ts). On
 *     repeated null results we keep counting `scanned` but not
 *     `enriched`. The caller's report surfaces fill_rate so a stuck
 *     fallback path is visible.
 *   - DB write failures inside a single row's transaction are logged
 *     and counted as `failedCount`; the loop keeps going so a single
 *     bad row never blocks the batch.
 */
import type { PrismaClient } from "@prisma/client";

import {
  enrichKol,
  pickTopAudienceCountry,
  type EnrichKolDeps,
} from "@/lib/kol/enrichment";

export interface EnrichStageOpts {
  prisma: PrismaClient;
  tenantId: string;
  /** Bound on parallel LLM calls. Default 5 mirrors BL-068/BL-069 callers. */
  concurrency?: number;
  /** Skip DB writes; useful for backfill `--dry-run`. */
  dryRun?: boolean;
  /** Log line writer. Defaults to console.log. */
  logger?: (msg: string) => void;
  /** Test-only LLM stub forwarded into enrichKol(). */
  llm?: EnrichKolDeps["llm"];
  /** Progress reporter, called after every N rows when set. */
  onProgress?: (done: number, total: number) => void;
  /** Hard cap on rows processed (mostly for tests / smoke runs). */
  limit?: number;
  /**
   * BL-075-F004 prod dry-run finding (2026-05-26): aigcgateway enforces
   * a 30 RPM cap per API key (HTTP 429 + `retryAfterSeconds: 60`). With
   * the default concurrency=5 the backfill burst-trips the cap on the
   * very first wave, every retry waits 1.5s while another concurrent
   * worker fires, so most calls just fail. We serialise the dispatch
   * point so at most one LLM call fires every `minLlmIntervalMs`,
   * regardless of `concurrency`. Default 2100ms ≈ 28.5 RPM, comfortably
   * under the 30 RPM cap. The local franc + audience-geo paths are not
   * gated — they run at full concurrency. Pass 0 to disable the gate
   * (only safe in unit tests with a stub LLM).
   */
  minLlmIntervalMs?: number;
}

export interface EnrichStageStats {
  scanned: number;
  enrichedLanguage: number;
  enrichedCountry: number;
  enrichedBoth: number;
  llmCallCount: number;
  failedCount: number;
  /** Best-effort USD cost estimate based on the BL-075-F002 Action's
   *  measured ~$0.0009/call (input ~770 tok + output ~22 tok @ Claude
   *  Haiku 4.5 pricing). The audit trail records actual token usage
   *  per call via `runAigcAction`'s `recordAiUsage`, so this is for
   *  the operator's at-a-glance log line, not the billing source of
   *  truth. */
  estimatedLlmCostUsd: number;
  sources: {
    audienceGeoTop1: number;
    llm: number;
    fallbackNull: number;
  };
}

const DEFAULT_CONCURRENCY = 5;
const COST_PER_LLM_CALL_USD = 0.0009;
const DEFAULT_MIN_LLM_INTERVAL_MS = 2100;

/**
 * Minimal in-process dispatcher gate so concurrent workers can ask
 * "is it my turn to call the LLM yet?" without rolling their own
 * timestamps. Returns a sleep promise that resolves at the next
 * permitted dispatch time and advances the cursor by `intervalMs`.
 */
function makeLlmRateGate(intervalMs: number): () => Promise<void> {
  let nextReadyAt = 0;
  return async function acquire(): Promise<void> {
    if (intervalMs <= 0) return;
    const now = Date.now();
    const target = nextReadyAt > now ? nextReadyAt : now;
    nextReadyAt = target + intervalMs;
    const waitMs = target - now;
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
  };
}

interface KolRow {
  id: string;
  bio: string | null;
  displayName: string;
  handle: string;
  audienceGeoDist: unknown;
  platform: string;
  categories: string[];
  countryCode: string | null;
  language: string | null;
}

function normaliseAudienceGeo(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries: Array<[string, number]> = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) entries.push([key, n]);
  }
  if (entries.length === 0) return null;
  return Object.fromEntries(entries);
}

async function processOne(
  row: KolRow,
  opts: EnrichStageOpts,
  stats: EnrichStageStats,
  acquireLlmSlot: () => Promise<void>,
): Promise<void> {
  const audienceGeo = normaliseAudienceGeo(row.audienceGeoDist);
  // Predict whether enrichKol would invoke the LLM: it does NOT when
  // either (a) the column is already populated (caller filtered NULL
  // so this is rare but possible mid-run), or (b) the audience-geo
  // top-1 path returns a country at ≥40%. Anything else falls through
  // to the LLM and must wait for a token from the dispatcher gate.
  const wouldHitLlm =
    !row.countryCode && pickTopAudienceCountry(audienceGeo) === null;
  if (wouldHitLlm) {
    await acquireLlmSlot();
  }

  const result = await enrichKol(
    {
      bio: row.bio,
      displayName: row.displayName,
      handle: row.handle,
      audienceGeoDist: audienceGeo,
      platform: row.platform,
      categories: row.categories,
    },
    { llm: opts.llm, tenantId: opts.tenantId },
  );

  if (result.source.country === "llm") stats.llmCallCount += 1;
  if (result.source.country === "audience-geo-top1") {
    stats.sources.audienceGeoTop1 += 1;
  } else if (result.source.country === "llm") {
    stats.sources.llm += 1;
  } else {
    stats.sources.fallbackNull += 1;
  }

  // BL-081-F003 — country enrichment was attempted this pass whenever the
  // row arrived without a country (the audience-geo / LLM / fallback path
  // all ran). Stamp country_enrichment_attempted_at = NOW() regardless of
  // whether a country was resolved, so a null LLM result stops
  // re-triggering the daily scan (root cause R3). Rows pulled in solely
  // for language enrichment (country already populated) don't touch it.
  const countryAttempted = !row.countryCode;
  const attemptedAt = countryAttempted ? new Date() : null;

  const before = {
    language: row.language,
    country_code: row.countryCode,
  };
  // Only carry forward fields the enrichment actually filled. Never
  // clobber an already-populated value with a NULL — the script is
  // additive.
  const after = {
    language: result.language ?? row.language,
    country_code: result.country ?? row.countryCode,
    enrichment_attempted_at: attemptedAt ? attemptedAt.toISOString() : null,
  };

  const updateData: {
    language?: string;
    countryCode?: string;
    countryEnrichmentAttemptedAt?: Date;
  } = {};
  if (result.language && !row.language) updateData.language = result.language;
  if (result.country && !row.countryCode) updateData.countryCode = result.country;
  // The marker IS the fix: write it on every country attempt (success or
  // null) so the F003 gate excludes this row on the next run instead of
  // re-attempting the LLM daily.
  if (attemptedAt) updateData.countryEnrichmentAttemptedAt = attemptedAt;

  // Skip only when nothing at all would be written — e.g. a row pulled in
  // purely for language enrichment (country already populated) whose franc
  // pass yielded nothing. Country-candidate rows always carry at least the
  // attempted marker, so they always write.
  if (Object.keys(updateData).length === 0) return;

  if (result.language && !row.language) stats.enrichedLanguage += 1;
  if (result.country && !row.countryCode) stats.enrichedCountry += 1;
  if (result.language && !row.language && result.country && !row.countryCode) {
    stats.enrichedBoth += 1;
  }

  if (opts.dryRun) return;

  try {
    await opts.prisma.$transaction(async (tx) => {
      await tx.kol.update({
        where: { id: row.id },
        data: updateData,
      });
      await tx.auditLog.create({
        data: {
          tenantId: opts.tenantId,
          actorUserId: null,
          action: "kol.enriched",
          resourceType: "kol",
          resourceId: row.id,
          payload: {
            before,
            after,
            source: result.source,
            confidence: {
              language: result.languageConfidence,
              country: result.countryConfidence,
            },
          },
        },
      });
    });
  } catch (err) {
    stats.failedCount += 1;
    (opts.logger ?? console.log)(
      `[enrichment-stage] kol=${row.id} write failed: ${(err as Error).message}`,
    );
  }
}

/**
 * Drain `rows` through `processOne` with at most `concurrency` calls
 * in flight at once. Returns when every row has resolved (success or
 * caught failure). Order of completion is not guaranteed; the caller
 * only inspects aggregate stats.
 */
async function runWithConcurrency(
  rows: KolRow[],
  concurrency: number,
  worker: (row: KolRow, index: number) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let nextIndex = 0;
  let done = 0;
  const total = rows.length;

  async function pull(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= total) return;
      await worker(rows[i]!, i);
      done += 1;
      if (onProgress && (done % 100 === 0 || done === total)) {
        onProgress(done, total);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, total) },
    () => pull(),
  );
  await Promise.all(workers);
}

export async function enrichKolsForTenant(
  opts: EnrichStageOpts,
): Promise<EnrichStageStats> {
  const log = opts.logger ?? ((m: string) => console.log(m));
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;

  const stats: EnrichStageStats = {
    scanned: 0,
    enrichedLanguage: 0,
    enrichedCountry: 0,
    enrichedBoth: 0,
    llmCallCount: 0,
    failedCount: 0,
    estimatedLlmCostUsd: 0,
    sources: { audienceGeoTop1: 0, llm: 0, fallbackNull: 0 },
  };

  const rows: KolRow[] = await opts.prisma.kol.findMany({
    where: {
      tenantId: opts.tenantId,
      deletedAt: null,
      isSuspicious: false,
      OR: [
        { countryCode: null },
        { countryCode: "" },
        { language: null },
        { language: "" },
      ],
      // BL-081-F003 — silent-retry-storm gate (root cause R3). Skip KOLs
      // already attempted for country enrichment, UNLESS fresher source
      // data has arrived since the attempt (last_synced_at >
      // country_enrichment_attempted_at — e.g. a re-sync that may have
      // updated bio / audience_geo). processOne now stamps the marker on
      // EVERY attempt (including null LLM results), so a KOL the LLM
      // can't resolve drops out of this scan next run instead of being
      // re-attempted daily. Field-reference comparison (Prisma 5+).
      AND: [
        {
          OR: [
            { countryEnrichmentAttemptedAt: null },
            {
              // `?.` so unit fakes that don't expose `kol.fields` (they
              // ignore the where and return canned rows anyway) don't
              // throw building this; the real PrismaClient always has it.
              lastSyncedAt: {
                gt: opts.prisma.kol.fields?.countryEnrichmentAttemptedAt,
              },
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      bio: true,
      displayName: true,
      handle: true,
      audienceGeoDist: true,
      platform: true,
      categories: true,
      countryCode: true,
      language: true,
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  stats.scanned = rows.length;
  if (rows.length === 0) {
    log(`[enrichment-stage] tenant=${opts.tenantId} no NULL country/language KOLs to enrich`);
    return stats;
  }

  const minLlmIntervalMs =
    opts.minLlmIntervalMs ?? DEFAULT_MIN_LLM_INTERVAL_MS;
  const acquireLlmSlot = makeLlmRateGate(minLlmIntervalMs);

  log(
    `[enrichment-stage] tenant=${opts.tenantId} scanning ${rows.length} KOL${rows.length === 1 ? "" : "s"} (concurrency=${concurrency}, llm_gap_ms=${minLlmIntervalMs}, dryRun=${opts.dryRun ?? false})`,
  );

  await runWithConcurrency(
    rows,
    concurrency,
    (row) => processOne(row, opts, stats, acquireLlmSlot),
    opts.onProgress,
  );

  stats.estimatedLlmCostUsd = stats.llmCallCount * COST_PER_LLM_CALL_USD;
  log(
    `[enrichment-stage] tenant=${opts.tenantId} DONE scanned=${stats.scanned} lang+=${stats.enrichedLanguage} country+=${stats.enrichedCountry} llm_calls=${stats.llmCallCount} cost_est=$${stats.estimatedLlmCostUsd.toFixed(4)} failed=${stats.failedCount}`,
  );
  return stats;
}

export const __TEST_ONLY__ = {
  normaliseAudienceGeo,
  makeLlmRateGate,
  COST_PER_LLM_CALL_USD,
  DEFAULT_MIN_LLM_INTERVAL_MS,
};

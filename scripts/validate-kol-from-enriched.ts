/**
 * MVP-kol-seed-redo F002 (path 2) · Validate the enriched-final seed.
 *
 * Reads `docs/kol-seed-enriched-final.json`, takes the 415 gaming
 * entries, looks each handle up against YouTube via `channels.list`
 * (with `forHandle`) to fetch live channel statistics, and reports
 * which entries are actually real KOLs by today's threshold
 * (subscriberCount ≥ 10K).
 *
 * Output:
 *   - docs/kol-seed-enriched-validation-{YYYY-MM-DD}.json — per-entry
 *     audit with the live YouTube stats (or the failure reason when
 *     the handle no longer resolves)
 *   - a stdout summary table grouped by status
 *
 * Quota cost: 1 call × 1 unit per gaming entry. 415 entries → 415 units,
 * well under the daily 10,000 budget.
 *
 * Usage:
 *   npm run validate:kol-enriched              (live, writes JSON)
 *   npm run validate:kol-enriched:dry          (no API, no writes)
 *   npm run validate:kol-enriched -- --limit 25
 */
import "dotenv/config";

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { google, youtube_v3 } from "googleapis";

import {
  FILTER_MIN_SUBSCRIBERS,
  isGamingTopic,
  todayUtc,
  withRetry,
  type RetryOpts,
} from "./seed-kol-from-youtube";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type ValidationStatus =
  | "real_kol"
  | "below_threshold"
  | "non_gaming_topic"
  | "handle_not_found"
  | "no_statistics";

export interface EnrichedEntry {
  idx: number;
  name: string;
  url: string;
  region: string;
  followers: number;
  is_gaming: boolean;
  confidence: "high" | "medium" | "low";
}

export interface ValidationResult {
  idx: number;
  enrichedName: string;
  handle: string;
  enrichedFollowers: number;
  liveSubscriberCount: number | null;
  liveVideoCount: number | null;
  liveCountry: string | null;
  liveTopicCategories: string[] | null;
  status: ValidationStatus;
  channelId: string | null;
}

export interface CliArgs {
  dryRun: boolean;
  limit?: number;
  /** When true, validate the AI-tagged non-gaming subset instead. Used
   *  to confirm the AI tagger's negative calls (i.e. our seed's 2,109
   *  non-gaming entries don't contain hidden gaming KOLs). */
  nonGamingOnly: boolean;
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false, nonGamingOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`--limit must be a positive integer`);
      }
      args.limit = n;
    } else if (a === "--non-gaming-only") {
      args.nonGamingOnly = true;
    }
  }
  return args;
}

// ---------------------------------------------------------------------
// Handle parsing
// ---------------------------------------------------------------------

/**
 * Pull the `@handle` segment out of a YouTube URL. Returns the leading
 * `@` so callers can pass straight to `channels.list?forHandle=@xxx`.
 * Returns null if the URL doesn't contain a recognisable handle.
 */
export function parseHandle(url: string): string | null {
  const m = /\/@([A-Za-z0-9._-]+)/.exec(url);
  return m ? `@${m[1]}` : null;
}

// ---------------------------------------------------------------------
// YouTube client (just the one call we need)
// ---------------------------------------------------------------------

export interface ValidationClient {
  fetchByHandle(handle: string): Promise<youtube_v3.Schema$Channel | null>;
}

export function createValidationClient(apiKey: string): ValidationClient {
  const yt = google.youtube({ version: "v3", auth: apiKey });
  return {
    async fetchByHandle(handle) {
      const res = await yt.channels.list({
        part: ["snippet", "statistics", "topicDetails"],
        forHandle: handle,
        maxResults: 1,
      });
      const items = res.data.items ?? [];
      return items[0] ?? null;
    },
  };
}

// ---------------------------------------------------------------------
// Classification (pure)
// ---------------------------------------------------------------------

export function classifyChannel(
  raw: youtube_v3.Schema$Channel | null,
  entry: EnrichedEntry
): ValidationResult {
  const handle = parseHandle(entry.url) ?? `@${entry.name.replace(/\s+/g, "")}`;
  if (!raw || !raw.id) {
    return {
      idx: entry.idx,
      enrichedName: entry.name,
      handle,
      enrichedFollowers: entry.followers,
      liveSubscriberCount: null,
      liveVideoCount: null,
      liveCountry: null,
      liveTopicCategories: null,
      status: "handle_not_found",
      channelId: null,
    };
  }
  const stats = raw.statistics;
  if (!stats) {
    return {
      idx: entry.idx,
      enrichedName: entry.name,
      handle,
      enrichedFollowers: entry.followers,
      liveSubscriberCount: null,
      liveVideoCount: null,
      liveCountry: raw.snippet?.country ?? null,
      liveTopicCategories: raw.topicDetails?.topicCategories ?? null,
      status: "no_statistics",
      channelId: raw.id,
    };
  }
  const subs = parseIntSafe(stats.subscriberCount);
  const videoCount = parseIntSafe(stats.videoCount);
  const topics = raw.topicDetails?.topicCategories ?? [];
  const result: ValidationResult = {
    idx: entry.idx,
    enrichedName: entry.name,
    handle,
    enrichedFollowers: entry.followers,
    liveSubscriberCount: subs,
    liveVideoCount: videoCount,
    liveCountry: raw.snippet?.country ?? null,
    liveTopicCategories: topics,
    status: "real_kol",
    channelId: raw.id,
  };
  if (subs < FILTER_MIN_SUBSCRIBERS) result.status = "below_threshold";
  else if (!isGamingTopic(topics)) result.status = "non_gaming_topic";
  return result;
}

function parseIntSafe(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------

export interface ValidateOpts {
  client: ValidationClient;
  retry?: RetryOpts;
  onResult?: (r: ValidationResult) => void;
}

export async function runValidate(
  entries: EnrichedEntry[],
  opts: ValidateOpts
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const entry of entries) {
    const handle = parseHandle(entry.url);
    if (!handle) {
      const r: ValidationResult = {
        idx: entry.idx,
        enrichedName: entry.name,
        handle: entry.url,
        enrichedFollowers: entry.followers,
        liveSubscriberCount: null,
        liveVideoCount: null,
        liveCountry: null,
        liveTopicCategories: null,
        status: "handle_not_found",
        channelId: null,
      };
      results.push(r);
      opts.onResult?.(r);
      continue;
    }
    let raw: youtube_v3.Schema$Channel | null = null;
    try {
      raw = await withRetry(
        () => opts.client.fetchByHandle(handle),
        opts.retry
      );
    } catch {
      raw = null;
    }
    const r = classifyChannel(raw, entry);
    results.push(r);
    opts.onResult?.(r);
  }
  return results;
}

// ---------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------

export interface ValidationSummary {
  total: number;
  byStatus: Record<ValidationStatus, number>;
  /** Real KOLs that survived all gates (sorted desc by subs). */
  realKols: ValidationResult[];
}

export function summarize(results: ValidationResult[]): ValidationSummary {
  const byStatus: Record<ValidationStatus, number> = {
    real_kol: 0,
    below_threshold: 0,
    non_gaming_topic: 0,
    handle_not_found: 0,
    no_statistics: 0,
  };
  for (const r of results) byStatus[r.status] += 1;
  const realKols = results
    .filter((r) => r.status === "real_kol")
    .sort(
      (a, b) => (b.liveSubscriberCount ?? 0) - (a.liveSubscriberCount ?? 0)
    );
  return { total: results.length, byStatus, realKols };
}

// ---------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------

export function loadGamingEntries(jsonPath: string): EnrichedEntry[] {
  return loadEntries(jsonPath, { nonGaming: false });
}

export function loadEntries(
  jsonPath: string,
  opts: { nonGaming: boolean }
): EnrichedEntry[] {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    results: EnrichedEntry[];
  };
  const target = !opts.nonGaming;
  return raw.results.filter((r) => r.is_gaming === target);
}

export function outputPath(
  date: string = todayUtc(),
  variant: "gaming" | "nongaming" = "gaming"
): string {
  // Gaming variant keeps the unsuffixed name (the path 2 default,
  // already committed). Non-gaming gets a `-nongaming` suffix so the
  // two audit reports can sit side-by-side.
  const suffix = variant === "nongaming" ? "-nongaming" : "";
  return resolve(
    __dirname,
    "..",
    `docs/kol-seed-enriched-validation${suffix}-${date}.json`
  );
}

export function formatOutputJson(
  results: ValidationResult[],
  summary: ValidationSummary,
  generatedAt: string
): string {
  return (
    JSON.stringify(
      {
        version: 1,
        generatedAt,
        summary,
        results,
      },
      null,
      2
    ) + "\n"
  );
}

// ---------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = resolve(__dirname, "..", "docs/kol-seed-enriched-final.json");
  const variant: "gaming" | "nongaming" = args.nonGamingOnly ? "nongaming" : "gaming";
  let entries = loadEntries(inputPath, { nonGaming: args.nonGamingOnly });
  if (args.limit) entries = entries.slice(0, args.limit);

  console.log(
    `[validate-kol-enriched] variant=${variant} entries to validate: ${entries.length}`
  );
  console.log(
    `[validate-kol-enriched] quota cost (live): ~${entries.length} units (1u per channels.list call)`
  );

  if (args.dryRun) {
    console.log(`[validate-kol-enriched] DRY-RUN — no API, no writes.`);
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not set. Same setup as seed:kol-youtube — see scripts/seed-kol-from-youtube.ts."
    );
  }

  const client = createValidationClient(apiKey);
  let progressCount = 0;
  const results = await runValidate(entries, {
    client,
    retry: {
      onRetry: (attempt, err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[validate-kol-enriched] retry #${attempt}: ${msg.slice(0, 120)}`
        );
      },
    },
    onResult: () => {
      progressCount += 1;
      if (progressCount % 50 === 0) {
        console.log(
          `[validate-kol-enriched] processed ${progressCount}/${entries.length}`
        );
      }
    },
  });

  const summary = summarize(results);
  const path = outputPath(undefined, variant);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    formatOutputJson(results, summary, new Date().toISOString()),
    "utf8"
  );

  console.log(`\n[validate-kol-enriched] DONE — ${path}`);
  console.log(`[validate-kol-enriched] total=${summary.total}`);
  for (const [status, n] of Object.entries(summary.byStatus)) {
    console.log(`  ${status.padEnd(20)} ${n}`);
  }
  if (summary.realKols.length > 0) {
    console.log(
      `\n[validate-kol-enriched] top 5 real KOLs (by live subs):`
    );
    for (const r of summary.realKols.slice(0, 5)) {
      console.log(
        `  ${r.handle.padEnd(30)} ${(r.liveSubscriberCount ?? 0).toLocaleString().padStart(12)} subs (was ${r.enrichedFollowers.toLocaleString()})`
      );
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[validate-kol-enriched] fatal: ${err instanceof Error ? err.message : err}`
    );
    process.exitCode = 1;
  });
}

/**
 * BL-086-F003 · One-shot manual_seed harvest of the legacy youtube-api-daily
 * channel ids into the apify-kol fork.
 *
 * Context (diagnostic 2026-06-06 §3.4): the old `youtube-api-daily` source was
 * fully soft-deleted on 5/8, but it holds ~2535 UC channel ids that exist ONLY
 * there (922 ≥100k followers, 264 ≥1M — SEA/India mobile-gaming超级大号). They
 * are structurally unreachable for email via the old YouTube Data API. The fix
 * is to feed those UC ids to the new source via `manual_seed` (POST /admin/seeds,
 * historical hit-rate 96%) so the fork re-scrapes them → coverage + emails +
 * freshness.
 *
 * ⚠️ YouTube manual_seed treats a non-URL `username` as an @handle and builds
 * `https://www.youtube.com/@{username}` (see fork pipeline/manual-seed-scrape.ts).
 * A bare UC id would become an invalid `@UC…` handle URL and never resolve. The
 * fork DOES pass through full URLs untouched and resolves them via
 * `get_channel_id_v2`, so we wrap every UC id as a canonical channel URL
 * `https://www.youtube.com/channel/{UC_id}` before feeding it.
 *
 * Selection: kolmatrix rows with metadata.source='youtube-api-daily',
 * platform='youtube', external_id LIKE 'UC%' (the old source stored the UC id
 * in external_id), MINUS any UC id already present as an apify-kol
 * platform_user_id (the 49-row overlap). Read-only on kolmatrix; the only
 * writes happen fork-side via the admin API.
 *
 * Idempotent + resumable: a JSON checkpoint records every UC id already fed
 * (with its returned jobIds). Re-running skips them, so an interrupted run is
 * safe to restart. The fork additionally dedupes manual_seed targets that
 * already exist in its own DB, so double-feeding is harmless.
 *
 * Real scraping only happens once the fork's TikHub balance is topped up; the
 * pre-charge acceptance is "ids correctly enqueued (jobIds returned) + script
 * re-runnable".
 *
 * Usage:
 *   npx tsx scripts/bl086-manual-seed-harvest.ts --dry-run
 *   npx tsx scripts/bl086-manual-seed-harvest.ts --limit=2        # tiny live smoke
 *   npx tsx scripts/bl086-manual-seed-harvest.ts                  # full ~2535
 *   npx tsx scripts/bl086-manual-seed-harvest.ts --batch-size=100 --sleep-ms=1500
 *
 * Env: DATABASE_ADMIN_URL (preferred) or DATABASE_URL, plus APIFY_KOL_BASE_URL
 * (default http://localhost:3003) + APIFY_KOL_ADMIN_API_KEY (the fork's
 * ADMIN_API_KEY). Exit 0 always (operator reads report); exit 1 on missing env.
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Fork service is published on host port 3004 (container 3003); kolmatrix
// .env.production sets APIFY_KOL_BASE_URL=http://localhost:3004 which overrides
// this default. Kept in sync so a no-env local run still targets the right port.
const DEFAULT_BASE_URL = "http://localhost:3004";
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_SLEEP_MS = 1_500;
const DEFAULT_CHECKPOINT = ".bl086-manual-seed-checkpoint.json";

export interface HarvestArgs {
  dryRun: boolean;
  batchSize: number;
  sleepMs: number;
  limit: number | null;
  tenantId: string | null;
  checkpointPath: string;
}

export function parseArgs(argv: readonly string[]): HarvestArgs {
  const args: HarvestArgs = {
    dryRun: false,
    batchSize: DEFAULT_BATCH_SIZE,
    sleepMs: DEFAULT_SLEEP_MS,
    limit: null,
    tenantId: null,
    checkpointPath: DEFAULT_CHECKPOINT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run" || a === "--dry") args.dryRun = true;
    else if (a.startsWith("--batch-size=")) args.batchSize = clampInt(a.slice("--batch-size=".length), DEFAULT_BATCH_SIZE);
    else if (a.startsWith("--sleep-ms=")) args.sleepMs = clampInt(a.slice("--sleep-ms=".length), DEFAULT_SLEEP_MS);
    else if (a.startsWith("--limit=")) args.limit = clampInt(a.slice("--limit=".length), 0) || null;
    else if (a.startsWith("--tenant=")) args.tenantId = a.slice("--tenant=".length);
    else if (a === "--tenant") args.tenantId = argv[++i] ?? null;
    else if (a.startsWith("--checkpoint=")) args.checkpointPath = a.slice("--checkpoint=".length);
  }
  return args;
}

function clampInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Wrap a bare UC channel id into the canonical channel URL the fork resolves. */
export function toChannelUrl(ucId: string): string {
  return `https://www.youtube.com/channel/${ucId}`;
}

/** Split an array into fixed-size chunks (last chunk may be shorter). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface HarvestDeps {
  /** Read-only: distinct legacy UC ids to feed (overlap already excluded). */
  loadUcIds: () => Promise<string[]>;
  /** POST one batch of channel URLs to the fork → returned jobIds. */
  postSeeds: (channelUrls: string[]) => Promise<{ jobIds: number[] }>;
  /** UC ids already fed in a prior run (checkpoint) — skipped this run. */
  alreadyFed: ReadonlySet<string>;
  /** Persist a freshly-fed batch to the checkpoint (called per success). */
  recordFed: (ucIds: string[], jobIds: number[]) => void;
  batchSize: number;
  sleepMs: number;
  /** Cap pending ids (smoke test). null = no cap. */
  limit: number | null;
  dryRun: boolean;
  sleep: (ms: number) => Promise<void>;
  logger: (msg: string) => void;
}

export interface HarvestResult {
  totalUcIds: number;
  alreadyFedCount: number;
  pendingCount: number;
  plannedBatches: number;
  fedCount: number;
  jobIds: number[];
  failedBatches: number;
  dryRun: boolean;
}

export async function runManualSeedHarvest(
  deps: HarvestDeps,
): Promise<HarvestResult> {
  const all = await deps.loadUcIds();
  const totalUcIds = all.length;

  let pending = all.filter((id) => !deps.alreadyFed.has(id));
  const alreadyFedCount = totalUcIds - pending.length;
  if (deps.limit != null) pending = pending.slice(0, deps.limit);

  const batches = chunk(pending, deps.batchSize);
  const result: HarvestResult = {
    totalUcIds,
    alreadyFedCount,
    pendingCount: pending.length,
    plannedBatches: batches.length,
    fedCount: 0,
    jobIds: [],
    failedBatches: 0,
    dryRun: deps.dryRun,
  };

  deps.logger(
    `[manual-seed-harvest] total=${totalUcIds} alreadyFed=${alreadyFedCount} pending=${pending.length} batches=${batches.length} (size=${deps.batchSize}) dryRun=${deps.dryRun}`,
  );

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i]!;
    const urls = batch.map(toChannelUrl);
    if (deps.dryRun) {
      deps.logger(`[manual-seed-harvest] (dry-run) batch ${i + 1}/${batches.length} would feed ${batch.length} channel URLs`);
      continue;
    }
    try {
      const { jobIds } = await deps.postSeeds(urls);
      deps.recordFed(batch, jobIds);
      result.fedCount += batch.length;
      result.jobIds.push(...jobIds);
      deps.logger(`[manual-seed-harvest] batch ${i + 1}/${batches.length} fed ${batch.length} → jobIds=${jobIds.join(",")}`);
    } catch (err) {
      result.failedBatches += 1;
      deps.logger(
        `[manual-seed-harvest] batch ${i + 1}/${batches.length} FAILED (${err instanceof Error ? err.message : err}) — not checkpointed, re-run to retry`,
      );
    }
    if (i < batches.length - 1) await deps.sleep(deps.sleepMs);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Checkpoint persistence
// ---------------------------------------------------------------------------

interface Checkpoint {
  fed: string[];
  jobIds: number[];
}

function loadCheckpoint(path: string): Checkpoint {
  if (!existsSync(path)) return { fed: [], jobIds: [] };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Checkpoint>;
    return {
      fed: Array.isArray(raw.fed) ? raw.fed : [],
      jobIds: Array.isArray(raw.jobIds) ? raw.jobIds : [],
    };
  } catch {
    return { fed: [], jobIds: [] };
  }
}

function saveCheckpoint(path: string, cp: Checkpoint): void {
  writeFileSync(path, JSON.stringify(cp, null, 2));
}

// ---------------------------------------------------------------------------
// DB read
// ---------------------------------------------------------------------------

/** Distinct legacy UC ids, minus any already present as an apify-kol PUID. */
async function loadLegacyUcIds(
  prisma: PrismaClient,
  tenantId: string,
): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ external_id: string }>>(
    `SELECT DISTINCT k.external_id
       FROM kol k
      WHERE k.tenant_id = $1::uuid
        AND k.metadata->>'source' = 'youtube-api-daily'
        AND k.platform = 'youtube'
        AND k.external_id LIKE 'UC%'
        AND NOT EXISTS (
          SELECT 1 FROM kol a
           WHERE a.tenant_id = k.tenant_id
             AND a.metadata->>'source' = 'apify-kol'
             AND a.platform = 'youtube'
             AND a.platform_user_id = k.external_id
        )
      ORDER BY k.external_id`,
    tenantId,
  );
  return rows.map((r) => r.external_id);
}

// ---------------------------------------------------------------------------
// Fork admin API
// ---------------------------------------------------------------------------

async function postSeedsToFork(
  baseUrl: string,
  adminKey: string,
  channelUrls: string[],
): Promise<{ jobIds: number[] }> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/admin/seeds`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": adminKey,
    },
    body: JSON.stringify({ handles: { youtube: channelUrls } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /admin/seeds ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { jobIds?: number[] };
  return { jobIds: Array.isArray(body.jobIds) ? body.jobIds : [] };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[bl086-manual-seed-harvest] starting (dryRun=${args.dryRun} batchSize=${args.batchSize} sleepMs=${args.sleepMs} limit=${args.limit ?? "none"})`,
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const baseUrl = process.env.APIFY_KOL_BASE_URL ?? DEFAULT_BASE_URL;
  const adminKey = process.env.APIFY_KOL_ADMIN_API_KEY;
  if (!conn) {
    console.error("[bl086-manual-seed-harvest] DATABASE_URL not set, refusing to run");
    process.exitCode = 1;
    return;
  }
  if (!args.dryRun && !adminKey) {
    console.error(
      "[bl086-manual-seed-harvest] APIFY_KOL_ADMIN_API_KEY missing (required unless --dry-run)",
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conn }) });
  const checkpoint = loadCheckpoint(args.checkpointPath);
  const alreadyFed = new Set(checkpoint.fed);

  try {
    const tenantSlug = process.env.KOL_SYNC_DEMO_TENANT_SLUG ?? "demo";
    let tenantId = args.tenantId;
    if (!tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        console.error(`[bl086-manual-seed-harvest] tenant not found: ${tenantSlug}`);
        process.exitCode = 1;
        return;
      }
      tenantId = tenant.id;
    }

    const result = await runManualSeedHarvest({
      loadUcIds: () => loadLegacyUcIds(prisma, tenantId!),
      postSeeds: (urls) => postSeedsToFork(baseUrl, adminKey!, urls),
      alreadyFed,
      recordFed: (ucIds, jobIds) => {
        checkpoint.fed.push(...ucIds);
        checkpoint.jobIds.push(...jobIds);
        saveCheckpoint(args.checkpointPath, checkpoint);
      },
      batchSize: args.batchSize,
      sleepMs: args.sleepMs,
      limit: args.limit,
      dryRun: args.dryRun,
      sleep,
      logger: (m) => console.log(m),
    });

    console.log("");
    console.log("== BL-086-F003 manual_seed harvest report ==");
    console.log(`dryRun:        ${result.dryRun}`);
    console.log(`total UC ids:  ${result.totalUcIds}`);
    console.log(`already fed:   ${result.alreadyFedCount}`);
    console.log(`pending:       ${result.pendingCount}`);
    console.log(`planned batch: ${result.plannedBatches}`);
    console.log(`fed this run:  ${result.fedCount}`);
    console.log(`failed batch:  ${result.failedBatches}`);
    console.log(`jobIds:        ${result.jobIds.length} created`);
    if (result.dryRun) {
      console.log("(dry-run — nothing fed. Re-run without --dry-run to enqueue.)");
    } else {
      console.log(`(checkpoint: ${args.checkpointPath} — re-run resumes from here.)`);
    }
    if (result.failedBatches > 0) {
      console.log(`⚠️ ${result.failedBatches} batch(es) failed — re-run to retry (checkpoint skips successes).`);
    }
  } catch (err) {
    console.error(
      `[bl086-manual-seed-harvest] fatal: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[bl086-manual-seed-harvest] outer-guard: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  });
}

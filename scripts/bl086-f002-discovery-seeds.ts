/**
 * BL-086-F002 · Discovery seed rebalance against the apify-kol fork.
 *
 * Context (diagnostic 2026-06-06 §3.4): the hashtag discovery engine has a
 * decent hit-rate (~11%) but its budget is split across 30 fixed seeds, many
 * of which produce nothing while the India/SEA mobile-gaming long tail (Free
 * Fire / Mobile Legends — the exact segment the legacy youtube-api-daily source
 * covered) is entirely unseeded. This rebalances the seed set via the fork's
 * `/admin/schedules` API:
 *
 *   1. DISABLE dead seeds (全期 0 产出): instagram esports/streamer/pcgaming/
 *      valorant/fortnite/dota2 + youtube "mobile gaming"/dota2.
 *   2. RAISE per-run limit 100→300 on the proven high-output tiktok seeds
 *      (gaming/valorant/fortnite/leagueoflegends).
 *   3. ADD SEA/mobile-gaming hashtag seeds (6 core games + 3 regional variants)
 *      on tiktok + youtube — the productive platforms (IG skipped: 38% import
 *      pass-rate + its existing seeds are the dead ones).
 *
 * Seeds are persistent config (unlike one-shot manual_seed jobs), so applying
 * pre-charge is safe: they sit enabled and activate on the next scheduler tick
 * once the TikHub balance is topped up.
 *
 * Idempotent: each change is a no-op if already in the desired state (disabled
 * already / limit already ≥300 / a seed with that platform+searchValue exists).
 * Re-runnable. A full pre-change snapshot of every schedule is written for
 * rollback before any mutation.
 *
 * Usage:
 *   npx tsx scripts/bl086-f002-discovery-seeds.ts --dry-run
 *   npx tsx scripts/bl086-f002-discovery-seeds.ts
 *   npx tsx scripts/bl086-f002-discovery-seeds.ts --snapshot=/tmp/bl086-f002-snapshot.json
 *
 * Env: APIFY_KOL_BASE_URL (default http://localhost:3004) +
 * APIFY_KOL_ADMIN_API_KEY (the fork's ADMIN_API_KEY). Exit 0 always (operator
 * reads report); exit 1 on missing env.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

const DEFAULT_BASE_URL = "http://localhost:3004";
const DEFAULT_SNAPSHOT = ".bl086-f002-snapshot.json";
const NEW_SEED_CRON = "0 2 * * *"; // daily 02:00 UTC, matches existing seeds
const RAISE_LIMIT_TO = 300;
const NEW_SEED_LIMIT = 100;

export type Platform = "instagram" | "tiktok" | "youtube" | "x";

export interface SeedConfig {
  platform: Platform;
  searchValue: string;
  limit?: number;
}

export interface ScheduleView {
  id: string | number;
  name: string;
  description?: string;
  cronExpression: string;
  kind: string;
  config: SeedConfig;
  enabled: boolean;
}

// --- The plan (decided with the user 2026-06-06: limit→300, new on TT+YT) ---

export const DISABLE_SEEDS: SeedConfig[] = [
  { platform: "instagram", searchValue: "esports" },
  { platform: "instagram", searchValue: "streamer" },
  { platform: "instagram", searchValue: "pcgaming" },
  { platform: "instagram", searchValue: "valorant" },
  { platform: "instagram", searchValue: "fortnite" },
  { platform: "instagram", searchValue: "dota2" },
  { platform: "youtube", searchValue: "mobile gaming" },
  { platform: "youtube", searchValue: "dota2" },
];

export const RAISE_LIMIT_SEEDS: SeedConfig[] = [
  { platform: "tiktok", searchValue: "gaming" },
  { platform: "tiktok", searchValue: "valorant" },
  { platform: "tiktok", searchValue: "fortnite" },
  { platform: "tiktok", searchValue: "leagueoflegends" },
];

// 6 core mobile-gaming titles + 3 regional variants (Hindi/Portuguese/Indonesian
// per diagnostic §2 India/SEA blind spot).
export const NEW_KEYWORDS: string[] = [
  "free fire",
  "mobile legends",
  "pubg mobile",
  "garena",
  "minecraft",
  "roblox",
  "free fire india",
  "free fire brasil",
  "mobile legends indonesia",
];
export const NEW_PLATFORMS: Platform[] = ["tiktok", "youtube"];

function key(platform: string, searchValue: string): string {
  return `${platform}::${searchValue.toLowerCase()}`;
}

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-");
}

export interface DisableAction {
  id: string | number;
  name: string;
}
export interface RaiseAction {
  id: string | number;
  name: string;
  from: number | undefined;
  to: number;
  config: SeedConfig;
}
export interface AddAction {
  name: string;
  platform: Platform;
  searchValue: string;
}

export interface SeedPlan {
  disable: DisableAction[];
  raise: RaiseAction[];
  add: AddAction[];
  skipped: string[];
  warnings: string[];
}

/** Pure: diff the desired plan against current schedules (idempotent). */
export function planSeedChanges(current: readonly ScheduleView[]): SeedPlan {
  const byKey = new Map<string, ScheduleView>();
  for (const s of current) byKey.set(key(s.config.platform, s.config.searchValue), s);

  const plan: SeedPlan = { disable: [], raise: [], add: [], skipped: [], warnings: [] };

  for (const t of DISABLE_SEEDS) {
    const s = byKey.get(key(t.platform, t.searchValue));
    if (!s) {
      plan.warnings.push(`disable target not found: ${t.platform}/${t.searchValue}`);
    } else if (!s.enabled) {
      plan.skipped.push(`already disabled: ${s.name}`);
    } else {
      plan.disable.push({ id: s.id, name: s.name });
    }
  }

  for (const t of RAISE_LIMIT_SEEDS) {
    const s = byKey.get(key(t.platform, t.searchValue));
    if (!s) {
      plan.warnings.push(`raise target not found: ${t.platform}/${t.searchValue}`);
    } else if ((s.config.limit ?? 0) >= RAISE_LIMIT_TO) {
      plan.skipped.push(`limit already ≥${RAISE_LIMIT_TO}: ${s.name}`);
    } else {
      plan.raise.push({
        id: s.id,
        name: s.name,
        from: s.config.limit,
        to: RAISE_LIMIT_TO,
        config: { ...s.config, limit: RAISE_LIMIT_TO },
      });
    }
  }

  for (const kw of NEW_KEYWORDS) {
    for (const platform of NEW_PLATFORMS) {
      const existing = byKey.get(key(platform, kw));
      if (existing) {
        plan.skipped.push(`seed already exists: ${existing.name}`);
      } else {
        plan.add.push({ name: `daily-${platform}-${slug(kw)}`, platform, searchValue: kw });
      }
    }
  }

  return plan;
}

export interface SeedDeps {
  fetchSchedules: () => Promise<ScheduleView[]>;
  patchSchedule: (id: string | number, body: Record<string, unknown>) => Promise<void>;
  postSchedule: (body: Record<string, unknown>) => Promise<void>;
  writeSnapshot: (schedules: ScheduleView[]) => void;
  dryRun: boolean;
  logger: (msg: string) => void;
}

export interface SeedResult extends SeedPlan {
  applied: { disabled: number; raised: number; added: number };
  dryRun: boolean;
}

export async function runSeedRebalance(deps: SeedDeps): Promise<SeedResult> {
  const current = await deps.fetchSchedules();
  deps.writeSnapshot(current);
  const plan = planSeedChanges(current);

  deps.logger(
    `[f002-seeds] current=${current.length} → disable=${plan.disable.length} raise=${plan.raise.length} add=${plan.add.length} skipped=${plan.skipped.length} warnings=${plan.warnings.length} dryRun=${deps.dryRun}`,
  );
  for (const w of plan.warnings) deps.logger(`[f002-seeds] ⚠️ ${w}`);

  const applied = { disabled: 0, raised: 0, added: 0 };
  if (deps.dryRun) {
    for (const d of plan.disable) deps.logger(`[f002-seeds] (dry) disable ${d.name}`);
    for (const r of plan.raise) deps.logger(`[f002-seeds] (dry) raise ${r.name} ${r.from}→${r.to}`);
    for (const a of plan.add) deps.logger(`[f002-seeds] (dry) add ${a.name}`);
    return { ...plan, applied, dryRun: true };
  }

  for (const d of plan.disable) {
    await deps.patchSchedule(d.id, { enabled: false });
    applied.disabled += 1;
    deps.logger(`[f002-seeds] disabled ${d.name}`);
  }
  for (const r of plan.raise) {
    await deps.patchSchedule(r.id, { config: r.config });
    applied.raised += 1;
    deps.logger(`[f002-seeds] raised ${r.name} ${r.from}→${r.to}`);
  }
  for (const a of plan.add) {
    await deps.postSchedule({
      name: a.name,
      description: `BL-086-F002 SEA/mobile-gaming seed daily 02:00 UTC ${a.platform}/${a.searchValue}`,
      cronExpression: NEW_SEED_CRON,
      kind: "hashtag",
      config: { platform: a.platform, searchValue: a.searchValue, limit: NEW_SEED_LIMIT },
      enabled: true,
    });
    applied.added += 1;
    deps.logger(`[f002-seeds] added ${a.name}`);
  }
  return { ...plan, applied, dryRun: false };
}

// ---------------------------------------------------------------------------
// IO wiring
// ---------------------------------------------------------------------------

interface Args {
  dryRun: boolean;
  snapshotPath: string;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { dryRun: false, snapshotPath: DEFAULT_SNAPSHOT };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run" || a === "--dry") args.dryRun = true;
    else if (a.startsWith("--snapshot=")) args.snapshotPath = a.slice("--snapshot=".length);
  }
  return args;
}

function makeApi(baseUrl: string, adminKey: string) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = { "content-type": "application/json", "x-api-key": adminKey };
  return {
    fetchSchedules: async (): Promise<ScheduleView[]> => {
      const res = await fetch(`${root}/admin/schedules`, { headers });
      if (!res.ok) throw new Error(`GET /admin/schedules ${res.status}`);
      return (await res.json()) as ScheduleView[];
    },
    patchSchedule: async (id: string | number, body: Record<string, unknown>) => {
      const res = await fetch(`${root}/admin/schedules/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PATCH /admin/schedules/${id} ${res.status}: ${(await res.text()).slice(0, 160)}`);
    },
    postSchedule: async (body: Record<string, unknown>) => {
      const res = await fetch(`${root}/admin/schedules`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`POST /admin/schedules ${res.status}: ${(await res.text()).slice(0, 160)}`);
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[bl086-f002-discovery-seeds] starting (dryRun=${args.dryRun})`);

  const baseUrl = process.env.APIFY_KOL_BASE_URL ?? DEFAULT_BASE_URL;
  const adminKey = process.env.APIFY_KOL_ADMIN_API_KEY;
  if (!adminKey) {
    console.error("[bl086-f002-discovery-seeds] APIFY_KOL_ADMIN_API_KEY missing, refusing to run");
    process.exitCode = 1;
    return;
  }

  const api = makeApi(baseUrl, adminKey);
  try {
    const result = await runSeedRebalance({
      fetchSchedules: api.fetchSchedules,
      patchSchedule: api.patchSchedule,
      postSchedule: api.postSchedule,
      writeSnapshot: (schedules) => {
        writeFileSync(args.snapshotPath, JSON.stringify(schedules, null, 2));
        console.log(`[bl086-f002-discovery-seeds] snapshot → ${args.snapshotPath} (${schedules.length} schedules)`);
      },
      dryRun: args.dryRun,
      logger: (m) => console.log(m),
    });

    console.log("");
    console.log("== BL-086-F002 discovery seed rebalance report ==");
    console.log(`dryRun:    ${result.dryRun}`);
    console.log(`disable:   ${result.disable.length} (${result.applied.disabled} applied)`);
    console.log(`raise→${RAISE_LIMIT_TO}: ${result.raise.length} (${result.applied.raised} applied)`);
    console.log(`add:       ${result.add.length} (${result.applied.added} applied)`);
    console.log(`skipped (idempotent no-op): ${result.skipped.length}`);
    if (result.warnings.length) console.log(`⚠️ warnings: ${result.warnings.length}`);
    if (result.dryRun) console.log("(dry-run — nothing changed. Re-run without --dry-run to apply.)");
  } catch (err) {
    console.error(`[bl086-f002-discovery-seeds] fatal: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[bl086-f002-discovery-seeds] outer-guard: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}

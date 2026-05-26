/**
 * BL-075-F004 · One-shot KOL country / language backfill.
 *
 * Walks every tenant's KOLs with a NULL/blank country_code or language,
 * runs the shared `enrichKolsForTenant` helper (same code path the
 * daily sync uses in F003 — keeps the audit_log shape identical), and
 * reports per-tenant + aggregate fill rates so we can paste the
 * numbers straight into the BL-075 signoff doc.
 *
 * Usage:
 *   npx tsx scripts/kol-enrichment-backfill.ts --dry-run
 *   npx tsx scripts/kol-enrichment-backfill.ts
 *   npx tsx scripts/kol-enrichment-backfill.ts --tenant=<uuid>
 *   npx tsx scripts/kol-enrichment-backfill.ts --concurrency=3 --limit-per-tenant=50
 *
 * Env requirements:
 *   - AIGCGATEWAY_BASE_URL / AIGCGATEWAY_API_KEY
 *   - AIGCGATEWAY_KOL_COUNTRY_ACTION_ID  (BL-075-F002)
 *   - DATABASE_ADMIN_URL (preferred) or DATABASE_URL
 *
 * Exit code is always 0 — the operator reads the per-tenant report to
 * decide what to do, the same convention `kol-sync-daily.ts` uses for
 * cron friendliness. A non-zero exit only fires when env is missing
 * (so deploy automation surfaces the misconfig immediately).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  enrichKolsForTenant,
  type EnrichStageStats,
} from "../src/lib/kol-sync/enrichment-stage";

interface CliArgs {
  dryRun: boolean;
  tenantId: string | null;
  concurrency: number;
  limitPerTenant: number | null;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    tenantId: null,
    concurrency: 5,
    limitPerTenant: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--dry-run" || a === "--dry") {
      args.dryRun = true;
    } else if (a.startsWith("--tenant=")) {
      args.tenantId = a.slice("--tenant=".length);
    } else if (a === "--tenant") {
      args.tenantId = argv[++i] ?? null;
    } else if (a.startsWith("--concurrency=")) {
      const n = Number(a.slice("--concurrency=".length));
      if (!Number.isFinite(n) || n < 1 || n > 50) {
        throw new Error(`--concurrency must be 1..50, got "${a}"`);
      }
      args.concurrency = n;
    } else if (a.startsWith("--limit-per-tenant=")) {
      const n = Number(a.slice("--limit-per-tenant=".length));
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`--limit-per-tenant must be >=1, got "${a}"`);
      }
      args.limitPerTenant = n;
    }
  }
  return args;
}

interface TenantTarget {
  id: string;
  name: string;
  pendingCount: number;
}

interface PerTenantResult {
  tenant: TenantTarget;
  stats: EnrichStageStats;
  durationMs: number;
}

async function listPendingTenants(
  prisma: PrismaClient,
  filterTenantId: string | null,
): Promise<TenantTarget[]> {
  const where = `
    deleted_at IS NULL
    AND is_suspicious = false
    AND (country_code IS NULL OR length(btrim(country_code)) = 0
         OR language IS NULL OR length(btrim(language)) = 0)
  `;
  const params: unknown[] = [];
  let extra = "";
  if (filterTenantId) {
    extra = ` AND tenant_id = $1::uuid `;
    params.push(filterTenantId);
  }
  const rows = (await prisma.$queryRawUnsafe(
    `
    SELECT k.tenant_id::text AS tenant_id, t.name AS tenant_name,
           COUNT(*)::int AS pending
    FROM kol k
    JOIN tenant t ON t.id = k.tenant_id
    WHERE ${where} ${extra}
    GROUP BY k.tenant_id, t.name
    ORDER BY pending DESC
    `,
    ...params,
  )) as Array<{ tenant_id: string; tenant_name: string; pending: number }>;

  return rows.map((r) => ({
    id: r.tenant_id,
    name: r.tenant_name,
    pendingCount: Number(r.pending),
  }));
}

async function snapshotFillRate(
  prisma: PrismaClient,
  filterTenantId: string | null,
): Promise<{ total: number; countryFilled: number; languageFilled: number }> {
  const params: unknown[] = [];
  let extra = "";
  if (filterTenantId) {
    extra = " AND tenant_id = $1::uuid ";
    params.push(filterTenantId);
  }
  const rows = (await prisma.$queryRawUnsafe(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE country_code IS NOT NULL AND length(btrim(country_code)) > 0
      )::int AS country_filled,
      COUNT(*) FILTER (
        WHERE language IS NOT NULL AND length(btrim(language)) > 0
      )::int AS language_filled
    FROM kol
    WHERE deleted_at IS NULL AND is_suspicious = false ${extra}
    `,
    ...params,
  )) as Array<{ total: number; country_filled: number; language_filled: number }>;
  const r = rows[0] ?? { total: 0, country_filled: 0, language_filled: 0 };
  return {
    total: Number(r.total),
    countryFilled: Number(r.country_filled),
    languageFilled: Number(r.language_filled),
  };
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "n/a";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function aggregate(results: PerTenantResult[]): EnrichStageStats {
  const out: EnrichStageStats = {
    scanned: 0,
    enrichedLanguage: 0,
    enrichedCountry: 0,
    enrichedBoth: 0,
    llmCallCount: 0,
    failedCount: 0,
    estimatedLlmCostUsd: 0,
    sources: { audienceGeoTop1: 0, llm: 0, fallbackNull: 0 },
  };
  for (const { stats } of results) {
    out.scanned += stats.scanned;
    out.enrichedLanguage += stats.enrichedLanguage;
    out.enrichedCountry += stats.enrichedCountry;
    out.enrichedBoth += stats.enrichedBoth;
    out.llmCallCount += stats.llmCallCount;
    out.failedCount += stats.failedCount;
    out.estimatedLlmCostUsd += stats.estimatedLlmCostUsd;
    out.sources.audienceGeoTop1 += stats.sources.audienceGeoTop1;
    out.sources.llm += stats.sources.llm;
    out.sources.fallbackNull += stats.sources.fallbackNull;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[kol-enrichment-backfill] starting (dryRun=${args.dryRun}` +
      ` tenant=${args.tenantId ?? "ALL"} concurrency=${args.concurrency}` +
      ` limitPerTenant=${args.limitPerTenant ?? "ALL"})`,
  );

  const conn = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    console.error("[kol-enrichment-backfill] DATABASE_URL not set, refusing to run");
    process.exitCode = 1;
    return;
  }
  if (!process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID) {
    console.warn(
      "[kol-enrichment-backfill] WARN — AIGCGATEWAY_KOL_COUNTRY_ACTION_ID is not set." +
        " Country LLM fallback will be skipped; only audience-geo top-1 + language will run.",
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: conn }),
  });

  try {
    const beforeFill = await snapshotFillRate(prisma, args.tenantId);
    console.log(
      `[kol-enrichment-backfill] BEFORE: total=${beforeFill.total}` +
        ` country_filled=${beforeFill.countryFilled} (${pct(beforeFill.countryFilled, beforeFill.total)})` +
        ` language_filled=${beforeFill.languageFilled} (${pct(beforeFill.languageFilled, beforeFill.total)})`,
    );

    const tenants = await listPendingTenants(prisma, args.tenantId);
    if (tenants.length === 0) {
      console.log(
        "[kol-enrichment-backfill] no tenants have NULL country/language KOLs — exiting clean",
      );
      process.exitCode = 0;
      return;
    }
    console.log(
      `[kol-enrichment-backfill] ${tenants.length} tenant(s) with pending KOLs:`,
    );
    for (const t of tenants) {
      console.log(`  - ${t.name} (${t.id}) — pending=${t.pendingCount}`);
    }

    const results: PerTenantResult[] = [];
    for (const tenant of tenants) {
      const start = Date.now();
      const stats = await enrichKolsForTenant({
        prisma,
        tenantId: tenant.id,
        concurrency: args.concurrency,
        dryRun: args.dryRun,
        limit: args.limitPerTenant ?? undefined,
        logger: (m) => console.log(m),
        onProgress: (done, total) => {
          console.log(
            `  [progress] tenant=${tenant.name} ${done}/${total} (${pct(done, total)})`,
          );
        },
      });
      results.push({
        tenant,
        stats,
        durationMs: Date.now() - start,
      });
    }

    const totals = aggregate(results);
    const afterFill = args.dryRun
      ? beforeFill
      : await snapshotFillRate(prisma, args.tenantId);

    console.log("");
    console.log("== BL-075-F004 backfill report ==");
    console.log(`dryRun: ${args.dryRun}`);
    console.log(`tenants processed: ${results.length}`);
    console.log(`total scanned: ${totals.scanned}`);
    console.log(
      `enriched: language+=${totals.enrichedLanguage}` +
        ` country+=${totals.enrichedCountry}` +
        ` both+=${totals.enrichedBoth}` +
        ` failed=${totals.failedCount}`,
    );
    console.log(
      `country sources: audience-geo-top1=${totals.sources.audienceGeoTop1}` +
        ` llm=${totals.sources.llm}` +
        ` fallback-null=${totals.sources.fallbackNull}`,
    );
    console.log(
      `LLM calls: ${totals.llmCallCount}` +
        ` estimated cost: $${totals.estimatedLlmCostUsd.toFixed(4)}`,
    );
    console.log("");
    console.log("fill-rate transition (active gaming, deleted_at NULL, !is_suspicious):");
    console.log(
      `  language: ${beforeFill.languageFilled}/${beforeFill.total}` +
        ` (${pct(beforeFill.languageFilled, beforeFill.total)}) ` +
        `→ ${afterFill.languageFilled}/${afterFill.total}` +
        ` (${pct(afterFill.languageFilled, afterFill.total)})`,
    );
    console.log(
      `  country:  ${beforeFill.countryFilled}/${beforeFill.total}` +
        ` (${pct(beforeFill.countryFilled, beforeFill.total)}) ` +
        `→ ${afterFill.countryFilled}/${afterFill.total}` +
        ` (${pct(afterFill.countryFilled, afterFill.total)})`,
    );
    console.log("");
    console.log("per-tenant breakdown:");
    for (const r of results) {
      console.log(
        `  ${r.tenant.name} (${r.tenant.id})` +
          ` scanned=${r.stats.scanned}` +
          ` lang+=${r.stats.enrichedLanguage}` +
          ` country+=${r.stats.enrichedCountry}` +
          ` llm=${r.stats.llmCallCount}` +
          ` failed=${r.stats.failedCount}` +
          ` cost=$${r.stats.estimatedLlmCostUsd.toFixed(4)}` +
          ` ${(r.durationMs / 1000).toFixed(1)}s`,
      );
    }
  } catch (err) {
    console.error(
      `[kol-enrichment-backfill] fatal: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `[kol-enrichment-backfill] outer-guard: ${err instanceof Error ? err.message : err}`,
    );
    process.exitCode = 1;
  });
}

#!/usr/bin/env npx tsx
/**
 * BL-032-F002 · One-time backfill — convert bracket-style placeholders
 * in `Asset` rows (source='ai_generated', type='email') to Mustache
 * tokens so the existing substitution layer (variable-substitute.ts:25
 * regex `/\{\{...\}\}/g`) can replace them at send time.
 *
 * Why — pre-BL-032, the KB AI prompt did not constrain placeholder
 * syntax, so AI returned `[Creator Name]` etc. The substitution layer
 * left them as literal strings in the sent email. F001 closes the
 * generation hole; F002 rescues already-persisted rows.
 *
 * Usage:
 *   # Dry-run (default — prints stats, writes nothing):
 *   npx tsx scripts/convert-bracket-tokens-to-mustache.ts
 *
 *   # Real run (writes asset.content + propagates to email_template
 *   # via dualWriteEmailTemplateOnUpdate):
 *   npx tsx scripts/convert-bracket-tokens-to-mustache.ts --execute
 *
 * Idempotency — content-self-check (spec §D3): any row already in
 * Mustache form has no white-listed bracket and skips. Re-running
 * --execute is a full no-op for converted rows. No metadata.convertedAt
 * marker is written.
 *
 * Mapping (spec §D2 — BL-033-F002 added 5th mapping for [DATE]):
 *   [Creator Name] / [KOL Name] / [Creator]  →  {{kol.name}}
 *   [Your Name]                              →  {{marketer.name}}
 *   [DATE]                                   →  {{date}}  (BL-033-F002)
 *
 * RLS — sibling pattern from BL-031-F003 (D3): tenant.findMany on the
 * base prisma client (tenant table has no RLS), then per-tenant
 * withTenant for the asset scan + update so kolmatrix_app's
 * tenant_isolation policy returns each tenant's rows under that scope.
 *
 * Rollback — restore from `pg_dump -t asset -t email_template`
 * captured before --execute, OR run a reverse SQL UPDATE swapping
 * `{{kol.name}}` / `{{marketer.name}}` back to the original brackets
 * (lossy if the original variant differed across rows; pg_dump is
 * preferred).
 */
import "dotenv/config";

import { Prisma } from "@prisma/client";

import { prisma, withTenant } from "@/lib/db";
import { updateAsset } from "@/lib/assets/mutations";

interface ConvertStats {
  tenantsScanned: number;
  candidates: number;
  updated: number;
  skipped: number;
  mirrorsAttempted: number;
}

interface AssetScanRow {
  id: string;
  content: Prisma.JsonValue;
}

// Spec §D2 white-list — order matters only because [Creator Name] is a
// strict superset substring of [Creator]; replacing the longer form
// first prevents partial overlaps when both appear in the same string.
// `g` for global; case-sensitive matches the 5 distinct variants
// observed in prod (BL-032 Phase 1 grep + BL-033 [DATE] residual).
const BRACKET_TO_MUSTACHE: ReadonlyArray<readonly [RegExp, string]> = [
  [/\[Creator Name\]/g, "{{kol.name}}"],
  [/\[KOL Name\]/g, "{{kol.name}}"],
  [/\[Creator\]/g, "{{kol.name}}"],
  [/\[Your Name\]/g, "{{marketer.name}}"],
  // BL-033-F002 — close BL-032 Soft-watch S1; SubstituteVariables now requires `date`.
  [/\[DATE\]/g, "{{date}}"],
];

export function applyMapping(text: string): string {
  let out = text;
  for (const [re, repl] of BRACKET_TO_MUSTACHE) {
    out = out.replace(re, repl);
  }
  return out;
}

export function hasAnyBracket(content: Record<string, unknown>): boolean {
  const subject = typeof content.subject === "string" ? content.subject : "";
  const body = typeof content.body === "string" ? content.body : "";
  return BRACKET_TO_MUSTACHE.some(([re]) => {
    re.lastIndex = 0; // /g regex state reset for repeated tests
    const found = re.test(subject) || re.test(body);
    re.lastIndex = 0;
    return found;
  });
}

export function convertContent(
  content: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...content };
  if (typeof next.subject === "string") {
    next.subject = applyMapping(next.subject);
  }
  if (typeof next.body === "string") {
    next.body = applyMapping(next.body);
  }
  return next;
}

export async function scanAssets(tenantId: string): Promise<AssetScanRow[]> {
  // SQL pre-filter on the 5 white-listed brackets so per-tenant scan
  // returns only candidates (15-row prod scale, but staging may grow;
  // ILIKE on JSONB ::text is cheap at this size). BL-033-F002 added
  // [DATE] to close BL-032 Soft-watch S1. App-side hasAnyBracket
  // re-checks for safety after JSON shape divergence.
  return withTenant(tenantId, (tx) =>
    tx.$queryRaw<AssetScanRow[]>`
      SELECT id, content
      FROM asset
      WHERE source = 'ai_generated'
        AND type = 'email'
        AND (
          content::text ILIKE '%[Creator Name]%'
          OR content::text ILIKE '%[KOL Name]%'
          OR content::text ILIKE '%[Creator]%'
          OR content::text ILIKE '%[Your Name]%'
          OR content::text ILIKE '%[DATE]%'
        )
      ORDER BY id ASC
    `
  );
}

export async function convertTenant(
  tenantId: string,
  execute: boolean,
  stats: ConvertStats
): Promise<void> {
  const candidates = await scanAssets(tenantId);
  stats.candidates += candidates.length;

  if (candidates.length === 0) return;

  await withTenant(tenantId, async (tx) => {
    for (const asset of candidates) {
      const content = (asset.content ?? {}) as Record<string, unknown>;
      if (!hasAnyBracket(content)) {
        // SQL ILIKE matched something else (e.g. JSON-encoded escapes)
        // or row already converted between scan + write. Skip safely.
        stats.skipped += 1;
        continue;
      }
      const newContent = convertContent(content);
      if (!execute) {
        stats.updated += 1;
        continue;
      }
      // updateAsset triggers dualWriteEmailTemplateOnUpdate when
      // asset.type='email' (mutations.ts:323-331). The mirror update
      // uses updateMany — silent count=0 if mirror is missing; we
      // count attempts in stats and let the caller compare to
      // post-run email_template inspection if doubt arises.
      await updateAsset(tx, asset.id, {
        content: newContent as unknown as Prisma.InputJsonValue,
      });
      stats.updated += 1;
      stats.mirrorsAttempted += 1;
    }
  });
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const stats: ConvertStats = {
    tenantsScanned: 0,
    candidates: 0,
    updated: 0,
    skipped: 0,
    mirrorsAttempted: 0,
  };

  console.log(
    `[BL-032-F002 backfill] Mode: ${execute ? "EXECUTE (writes asset.content + email_template mirror)" : "DRY-RUN (no DB writes)"}`
  );

  const tenants = await prisma.tenant.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  stats.tenantsScanned = tenants.length;
  console.log(`[BL-032-F002 backfill] Tenants scanned: ${tenants.length}`);

  for (const { id: tenantId } of tenants) {
    await convertTenant(tenantId, execute, stats);
  }

  console.log("\n[BL-032-F002 backfill] === Summary ===");
  console.log(`  Mode:                       ${execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`  Tenants scanned:            ${stats.tenantsScanned}`);
  console.log(`  Candidates (bracket found): ${stats.candidates}`);
  console.log(
    `  Assets ${execute ? "updated" : "would update"}:      ${stats.updated}`
  );
  console.log(`  Assets skipped (no bracket): ${stats.skipped}`);
  console.log(
    `  Email template mirrors:     ${stats.mirrorsAttempted} attempted (1 per asset.update; dualWriteEmailTemplateOnUpdate uses updateMany — silent count=0 if mirror missing)`
  );
}

// vitest sets NODE_ENV=test; tests import the helpers without
// triggering the CLI. Mirrors the pattern in
// migrate-product-aiassets-to-asset.ts.
if (process.env.NODE_ENV !== "test") {
  main()
    .catch((err) => {
      console.error("[BL-032-F002 backfill] FATAL:", err);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}

export { BRACKET_TO_MUSTACHE, type ConvertStats, type AssetScanRow };

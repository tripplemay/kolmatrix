#!/usr/bin/env npx tsx
/**
 * BL-099-F002 · One-time migration of historical USER email_template
 * rows into the unified `Asset` table (ADR-018 D3 — 防数据丢失).
 *
 * Background — before BL-099-F001 the template write path only wrote
 * to `email_template`, so ~16 user-created templates on prod never
 * landed in `Asset` and vanished from the Asset-sourced composer /
 * workspace list. F001 fixed the live path; this script rescues the
 * already-orphaned rows before F005 drops the email_template table.
 *
 * Scope:
 *   - migrates email_template WHERE type='user' → Asset(type=email,
 *     source=user_created, status=published, tenant-matched).
 *   - the 10 legacy type='system' rows are NOT migrated: the 10
 *     system_seed Assets are the canonical source; the legacy system
 *     rows are stale copies safe to drop with the table (ADR-018 D3).
 *
 * Usage:
 *   # Dry run (default — prints stats + per-tenant before/after, no writes)
 *   npx tsx scripts/bl099-f002-migrate-user-templates.ts
 *   # Real run
 *   npx tsx scripts/bl099-f002-migrate-user-templates.ts --execute
 *
 * Idempotency / dedup — a user template is skipped when an Asset
 * already represents it, by any of:
 *   1. id match (asset.id = email_template.id — native dual-write rows
 *      where createAsset wrote asset.id = email_template.id)
 *   2. migration marker (asset.metadata.migrated_from_email_template_id
 *      = email_template.id — written by a previous run of this script)
 *   3. content match (same tenant, type=email, non-system, identical
 *      subject + body — the user re-created it via the F001 path)
 * So re-running --execute never produces duplicate Assets.
 *
 * RLS — email_template + asset both have tenant_isolation policies, so
 * the cross-tenant scan lists tenants via `prisma.tenant.findMany` (the
 * tenant lookup table has no RLS) then reads + writes inside
 * `withTenant(tenantId, …)`. Same pattern as
 * migrate-product-aiassets-to-asset.ts; see
 * framework/harness/database-patterns.md for the RLS bypass matrix.
 *
 * variables — historical email_template.variables is free-form JSON
 * (the old UI JSON.stringify'd whatever it had). The Asset content
 * schema requires `{ token, description?, required? }[]`, so we
 * sanitize: keep only well-formed entries, drop the rest. The user's
 * core content (name / subject / body / locale) is always preserved;
 * malformed variable metadata degrades to [] rather than failing the
 * whole row.
 */
import "dotenv/config";

import { Prisma } from "@prisma/client";

import { createAsset } from "@/lib/assets/mutations";
import { prisma, withTenant } from "@/lib/db";

export interface MigrationStats {
  tenantsScanned: number;
  userTemplatesScanned: number;
  created: number;
  skipped: number;
  failed: number;
}

export interface UserTemplateRow {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  body: string;
  variables: Prisma.JsonValue;
  locale: string;
}

export interface SanitizedVariable {
  token: string;
  description?: string;
  required?: boolean;
}

/**
 * Keep only entries that satisfy the Asset content variable schema
 * ({ token: string, description?: string, required?: boolean }); drop
 * anything malformed. Non-array input → [].
 */
export function sanitizeVariables(raw: Prisma.JsonValue): SanitizedVariable[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedVariable[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    if (typeof r.token !== "string" || r.token.length === 0) continue;
    const item: SanitizedVariable = { token: r.token };
    if (typeof r.description === "string") item.description = r.description;
    if (typeof r.required === "boolean") item.required = r.required;
    out.push(item);
  }
  return out;
}

/**
 * Returns an existing Asset id when this user template is already
 * represented (id / migration-marker / content match), else null.
 * Runs inside the caller's withTenant scope so RLS limits the search
 * to the same tenant.
 */
export async function findExistingAsset(
  tx: Prisma.TransactionClient,
  et: Pick<UserTemplateRow, "id" | "subject" | "body">
): Promise<{ id: string } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM asset
    WHERE type = 'email'
      AND source <> 'system_seed'
      AND (
        id = ${et.id}::uuid
        OR metadata->>'migrated_from_email_template_id' = ${et.id}
        OR (content->>'subject' = ${et.subject} AND content->>'body' = ${et.body})
      )
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function scanUserTemplates(): Promise<UserTemplateRow[]> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const rows: UserTemplateRow[] = [];
  for (const { id: tenantId } of tenants) {
    const tRows = await withTenant(tenantId, (tx) =>
      tx.emailTemplate.findMany({
        where: { type: "user" },
        select: {
          id: true,
          tenantId: true,
          name: true,
          subject: true,
          body: true,
          variables: true,
          locale: true,
        },
        orderBy: { id: "asc" },
      })
    );
    for (const r of tRows) {
      // type='user' rows always carry a tenantId; guard for safety.
      if (r.tenantId) rows.push(r as UserTemplateRow);
    }
  }
  return rows;
}

export async function migrateUserTemplate(
  et: UserTemplateRow,
  execute: boolean,
  stats: MigrationStats
): Promise<void> {
  await withTenant(et.tenantId, async (tx) => {
    const existing = await findExistingAsset(tx, et);
    if (existing) {
      stats.skipped += 1;
      return;
    }
    if (!execute) {
      stats.created += 1; // "would create" in dry-run
      return;
    }
    await createAsset(tx, et.tenantId, {
      type: "email",
      name: et.name,
      content: {
        subject: et.subject,
        body: et.body,
        locale: et.locale,
        variables: sanitizeVariables(et.variables),
      },
      source: "user_created",
      status: "published",
      metadata: { migrated_from_email_template_id: et.id },
    });
    stats.created += 1;
  });
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const stats: MigrationStats = {
    tenantsScanned: 0,
    userTemplatesScanned: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  console.log(
    `[BL-099-F002 migrate] Mode: ${execute ? "EXECUTE (writes Asset rows)" : "DRY-RUN (no DB writes)"}`
  );

  const templates = await scanUserTemplates();
  stats.userTemplatesScanned = templates.length;
  const tenantSet = new Set(templates.map((t) => t.tenantId));
  stats.tenantsScanned = tenantSet.size;
  console.log(
    `[BL-099-F002 migrate] Found ${templates.length} user email_template row(s) across ${tenantSet.size} tenant(s)`
  );

  for (const et of templates) {
    try {
      await migrateUserTemplate(et, execute, stats);
    } catch (err) {
      stats.failed += 1;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[BL-099-F002 migrate] template=${et.id} (tenant=${et.tenantId}) FAILED: ${msg}`
      );
    }
  }

  // Per-tenant no-loss check: visible user Assets must be ≥ the user
  // email_template count after migration.
  console.log("\n[BL-099-F002 migrate] === Per-tenant user-template counts ===");
  for (const tenantId of [...tenantSet].sort()) {
    const etCount = templates.filter((t) => t.tenantId === tenantId).length;
    const assetCount = await withTenant(tenantId, (tx) =>
      tx.asset.count({
        where: { type: "email", source: { not: "system_seed" }, status: "published" },
      })
    );
    const ok = execute ? assetCount >= etCount : true;
    console.log(
      `  tenant=${tenantId}  email_template(user)=${etCount}  asset(user,published)=${assetCount}  ${ok ? "OK" : "⚠️ LOSS"}`
    );
  }

  console.log("\n[BL-099-F002 migrate] === Summary ===");
  console.log(`  Mode:                ${execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`  Tenants scanned:     ${stats.tenantsScanned}`);
  console.log(`  User templates:      ${stats.userTemplatesScanned}`);
  console.log(
    `  Assets ${execute ? "created" : "would create"}: ${stats.created}`
  );
  console.log(`  Skipped (deduped):   ${stats.skipped}`);
  console.log(`  Failed:              ${stats.failed}`);
  if (stats.failed > 0) process.exitCode = 1;
}

// tsx ESM transform doesn't keep `require.main === module`; key off
// NODE_ENV='test' so vitest can import helpers without running the CLI.
if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("[BL-099-F002 migrate] FATAL:", err);
    process.exit(1);
  });
}

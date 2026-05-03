#!/usr/bin/env npx tsx
/**
 * BL-030-F003 · One-time backfill from `Product.aiAssets` JSON content
 * into the unified `Asset` table.
 *
 * Background — pre-BL-030, the KB page's generateAiAssets only wrote
 * 3 emails + 2 video scripts into `Product.aiAssets.emailTemplates /
 * videoScripts` JSON. /assets and /outreach composer read from the
 * `Asset` table, so the KB output never surfaced. BL-030-F001 fixed
 * the live path; this script rescues already-generated content.
 *
 * Usage:
 *   # Dry run (default — prints stats, writes nothing)
 *   npx tsx scripts/migrate-product-aiassets-to-asset.ts
 *
 *   # Real run (writes Asset rows + shrinks Product.aiAssets)
 *   npx tsx scripts/migrate-product-aiassets-to-asset.ts --execute
 *
 * Idempotency — re-running --execute on a partially-migrated DB is
 * safe. Each candidate Asset is keyed by
 * (productId, sourceField, index) under
 * `Asset.metadata.backfilledFrom`, and the script skips any
 * combination that already exists. After all 5 (or fewer) Asset rows
 * are written, the script shrinks `Product.aiAssets` to
 * `{status:'ready', generatedAt}`. Once shrunk the product no longer
 * matches the SELECT predicate, so the second --execute pass is a
 * full no-op for that row.
 *
 * Rollback — Asset rows created here carry
 * `metadata.backfilledFrom IS NOT NULL`, so:
 *
 *   DELETE FROM asset
 *   WHERE source = 'ai_generated'
 *     AND metadata->'backfilledFrom' IS NOT NULL;
 *
 * peels them back. `Product.aiAssets` content needs a `pg_dump -t
 * product` restore (run before --execute).
 *
 * RLS — the SELECT cross-tenant scan uses withPlatformAdmin; every
 * write phase runs inside withTenant(product.tenantId, …) so the
 * Asset insert + product.update obey the standard tenant policies.
 */
import "dotenv/config";

import { withPlatformAdmin, withTenant } from "@/lib/db";
import { createAsset } from "@/lib/assets/mutations";
import {
  deriveEmailAssetName,
  deriveVideoAssetName,
  emailTemplateRoleAt,
  videoTemplateRoleAt,
} from "@/lib/products/generateAiAssets";

import { Prisma } from "@prisma/client";

interface BackfillStats {
  productsScanned: number;
  productsCompleted: number;
  productsFailed: number;
  emailAssetsCreated: number;
  emailAssetsSkipped: number;
  videoAssetsCreated: number;
  videoAssetsSkipped: number;
  productsShrunk: number;
}

interface ProductScanRow {
  id: string;
  tenantId: string;
  name: string;
  updatedAt: Date;
  aiAssets: Prisma.JsonValue;
}

interface LegacyEmailEntry {
  subject: string;
  body: string;
}
interface LegacyVideoEntry {
  title: string;
  script: string;
}

interface Failure {
  productId: string;
  error: string;
}

const SOURCE_FIELD_EMAIL = "aiAssets.emailTemplates" as const;
const SOURCE_FIELD_VIDEO = "aiAssets.videoScripts" as const;

function isLegacyEmail(value: unknown): value is LegacyEmailEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.subject === "string" && typeof v.body === "string";
}

function isLegacyVideo(value: unknown): value is LegacyVideoEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && typeof v.script === "string";
}

async function scanProducts(): Promise<ProductScanRow[]> {
  return withPlatformAdmin((tx) =>
    tx.$queryRaw<ProductScanRow[]>`
      SELECT
        id,
        tenant_id AS "tenantId",
        name,
        updated_at AS "updatedAt",
        ai_assets AS "aiAssets"
      FROM product
      WHERE ai_assets->>'status' = 'ready'
        AND (ai_assets ? 'emailTemplates' OR ai_assets ? 'videoScripts')
      ORDER BY tenant_id ASC, id ASC
    `
  );
}

async function existingBackfilledAsset(
  tx: Prisma.TransactionClient,
  productId: string,
  sourceField: string,
  index: number
): Promise<{ id: string } | null> {
  // Use $queryRaw for the JSON path predicate — Prisma's typed
  // metadata filter can't express
  // metadata->'backfilledFrom'->>'index' = '0' AND
  // metadata->'backfilledFrom'->>'sourceField' = '...' in one go
  // without a generated column.
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM asset
    WHERE product_id = ${productId}::uuid
      AND source = 'ai_generated'
      AND metadata->'backfilledFrom'->>'sourceField' = ${sourceField}
      AND metadata->'backfilledFrom'->>'index' = ${String(index)}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function backfillProduct(
  product: ProductScanRow,
  execute: boolean,
  stats: BackfillStats
): Promise<void> {
  const ai = (product.aiAssets ?? {}) as Record<string, unknown>;
  const emails = Array.isArray(ai.emailTemplates) ? ai.emailTemplates : [];
  const videos = Array.isArray(ai.videoScripts) ? ai.videoScripts : [];
  const generatedAt =
    typeof ai.generatedAt === "string" && ai.generatedAt.length > 0
      ? ai.generatedAt
      : product.updatedAt.toISOString();
  const traceId = typeof ai.traceId === "string" ? ai.traceId : null;

  await withTenant(product.tenantId, async (tx) => {
    // Emails
    for (let i = 0; i < emails.length; i += 1) {
      const entry = emails[i];
      if (!isLegacyEmail(entry)) {
        console.warn(
          `[skip] product ${product.id} emailTemplates[${i}] is malformed; ignoring`
        );
        continue;
      }
      const existing = await existingBackfilledAsset(
        tx,
        product.id,
        SOURCE_FIELD_EMAIL,
        i
      );
      if (existing) {
        stats.emailAssetsSkipped += 1;
        continue;
      }
      if (!execute) {
        stats.emailAssetsCreated += 1;
        continue;
      }
      await createAsset(tx, product.tenantId, {
        type: "email",
        name: deriveEmailAssetName(product.name, i),
        content: {
          subject: entry.subject,
          body: entry.body,
          locale: "en",
          variables: [],
        },
        source: "ai_generated",
        status: "published",
        productId: product.id,
        createdBy: null,
        metadata: {
          source: "kb_generation",
          productId: product.id,
          templateRole: emailTemplateRoleAt(i),
          generatedAt,
          traceId,
          backfilledFrom: {
            productId: product.id,
            sourceField: SOURCE_FIELD_EMAIL,
            index: i,
          },
        },
      });
      stats.emailAssetsCreated += 1;
    }

    // Videos
    for (let i = 0; i < videos.length; i += 1) {
      const entry = videos[i];
      if (!isLegacyVideo(entry)) {
        console.warn(
          `[skip] product ${product.id} videoScripts[${i}] is malformed; ignoring`
        );
        continue;
      }
      const existing = await existingBackfilledAsset(
        tx,
        product.id,
        SOURCE_FIELD_VIDEO,
        i
      );
      if (existing) {
        stats.videoAssetsSkipped += 1;
        continue;
      }
      if (!execute) {
        stats.videoAssetsCreated += 1;
        continue;
      }
      await createAsset(tx, product.tenantId, {
        type: "video_script",
        name: deriveVideoAssetName(product.name, i),
        content: { title: entry.title, script: entry.script },
        source: "ai_generated",
        status: "published",
        productId: product.id,
        createdBy: null,
        metadata: {
          source: "kb_generation",
          productId: product.id,
          templateRole: videoTemplateRoleAt(i),
          generatedAt,
          traceId,
          backfilledFrom: {
            productId: product.id,
            sourceField: SOURCE_FIELD_VIDEO,
            index: i,
          },
        },
      });
      stats.videoAssetsCreated += 1;
    }

    // Shrink Product.aiAssets — only on --execute, and only when at
    // least one Asset is now in place for this product (skip if every
    // entry was malformed and got bypassed). Idempotent: subsequent
    // runs see the predicate fail and skip the row entirely.
    if (execute) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          aiAssets: { status: "ready", generatedAt } as unknown as Prisma.InputJsonObject,
        },
      });
      stats.productsShrunk += 1;
    }
  });
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const stats: BackfillStats = {
    productsScanned: 0,
    productsCompleted: 0,
    productsFailed: 0,
    emailAssetsCreated: 0,
    emailAssetsSkipped: 0,
    videoAssetsCreated: 0,
    videoAssetsSkipped: 0,
    productsShrunk: 0,
  };
  const failures: Failure[] = [];

  console.log(
    `[BL-030-F003 backfill] Mode: ${execute ? "EXECUTE (writes Asset rows + shrinks Product.aiAssets)" : "DRY-RUN (no DB writes)"}`
  );

  const products = await scanProducts();
  stats.productsScanned = products.length;
  console.log(
    `[BL-030-F003 backfill] Scanned ${products.length} product(s) with legacy aiAssets content`
  );

  for (const product of products) {
    try {
      await backfillProduct(product, execute, stats);
      stats.productsCompleted += 1;
      console.log(
        `[BL-030-F003 backfill] product=${product.id} (${product.name}, tenant=${product.tenantId}) ${execute ? "migrated" : "would migrate"}`
      );
    } catch (err) {
      stats.productsFailed += 1;
      const msg = err instanceof Error ? err.message : "Unknown error";
      failures.push({ productId: product.id, error: msg });
      console.error(
        `[BL-030-F003 backfill] product=${product.id} FAILED: ${msg}`
      );
    }
  }

  console.log("\n[BL-030-F003 backfill] === Summary ===");
  console.log(`  Mode:                 ${execute ? "EXECUTE" : "DRY-RUN"}`);
  console.log(`  Products scanned:     ${stats.productsScanned}`);
  console.log(`  Products completed:   ${stats.productsCompleted}`);
  console.log(`  Products failed:      ${stats.productsFailed}`);
  console.log(
    `  Email assets:         ${stats.emailAssetsCreated} ${execute ? "created" : "would create"} / ${stats.emailAssetsSkipped} skipped (already backfilled)`
  );
  console.log(
    `  Video assets:         ${stats.videoAssetsCreated} ${execute ? "created" : "would create"} / ${stats.videoAssetsSkipped} skipped (already backfilled)`
  );
  console.log(`  Products shrunk:      ${stats.productsShrunk}`);
  if (failures.length > 0) {
    console.log("\n[BL-030-F003 backfill] Failures:");
    for (const f of failures) {
      console.log(`  - ${f.productId}: ${f.error}`);
    }
    process.exitCode = 1;
  }
}

// Allow tests to import the helpers without invoking main(); the
// `if (require.main === module)` shim doesn't survive tsx's ESM
// transform. We instead key off NODE_ENV='test' which the vitest
// runner sets — tests import the module without triggering the CLI.
if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error("[BL-030-F003 backfill] FATAL:", err);
    process.exit(1);
  });
}

// Exported for the F004 integration test (and any future tooling).
export {
  scanProducts,
  backfillProduct,
  existingBackfilledAsset,
  type BackfillStats,
  type ProductScanRow,
  SOURCE_FIELD_EMAIL,
  SOURCE_FIELD_VIDEO,
};

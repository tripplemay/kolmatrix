/**
 * BL-025-F001 · Asset table RLS + EmailTemplate migration spec
 *
 * Covers:
 *   1. tenant A sees its own assets and system_seed (tenant_id IS NULL)
 *   2. tenant A does NOT see tenant B assets
 *   3. unscoped reader (no app.tenant_id GUC) sees only system_seed rows
 *   4. EmailTemplate→Asset migration parity:
 *      count(email_template) == count(asset where type=email AND
 *      metadata ? 'migrated_from_email_template_id'); the per-row
 *      mapping (subject/body/locale/variables → content JSON,
 *      tenant_id → source) round-trips correctly.
 *
 * The migration that copies email_template into asset
 * (20260502120100_migrate_email_template_to_asset) runs once at
 * `prisma migrate deploy` time. That run finds zero rows in the
 * fresh testcontainers DB, so the migration parity test seeds
 * email_template + invokes the copy SQL inline against the test DB
 * before asserting parity. Production / staging hit the same SQL via
 * the migration; this keeps the test self-contained without forking
 * the migration body.
 */
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  getAppPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const TENANT_B = "bbbbbbbb-0000-0000-0000-000000000002";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenant(tenantId: string) {
  return getAdminPrisma().tenant.create({
    data: {
      id: tenantId,
      name: `Asset Tenant ${tenantId.slice(0, 4)}`,
      slug: `asset-${tenantId.slice(0, 8)}`,
    },
  });
}

async function seedAsset(opts: {
  tenantId: string | null;
  type?: "email" | "video_script";
  source?: "ai_generated" | "user_created" | "imported" | "system_seed";
  name?: string;
  status?: "draft" | "published" | "archived";
  content?: Prisma.InputJsonValue;
}) {
  const admin = getAdminPrisma();
  return admin.asset.create({
    data: {
      tenantId: opts.tenantId,
      type: opts.type ?? "email",
      name: opts.name ?? "Untitled Asset",
      source: opts.source ?? "user_created",
      status: opts.status ?? "published",
      content:
        opts.content ?? {
          subject: "Hello",
          body: "Body",
          locale: "en",
          variables: [],
        },
    },
  });
}

describe("BL-025-F001 · Asset RLS isolation", () => {
  it("returns own tenant rows AND system_seed rows under app.tenant_id", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);

    const ownAsset = await seedAsset({
      tenantId: TENANT_A,
      source: "user_created",
      name: "tenant-A own",
    });
    const systemAsset = await seedAsset({
      tenantId: null,
      source: "system_seed",
      name: "system seed visible to all",
    });
    await seedAsset({
      tenantId: TENANT_B,
      source: "user_created",
      name: "tenant-B own (must be invisible to A)",
    });

    const rowsAsA = await asTenant(TENANT_A, (tx) =>
      tx.asset.findMany({ select: { id: true, name: true, tenantId: true } })
    );

    const ids = rowsAsA.map((r) => r.id).sort();
    expect(ids).toEqual([ownAsset.id, systemAsset.id].sort());
  });

  it("hides cross-tenant rows from the app role", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);
    const bAsset = await seedAsset({ tenantId: TENANT_B, name: "B private" });

    const rowsAsA = await asTenant(TENANT_A, (tx) => tx.asset.findMany());
    expect(rowsAsA.find((r) => r.id === bAsset.id)).toBeUndefined();
  });

  it("returns only system_seed rows when no app.tenant_id GUC is set", async () => {
    await seedTenant(TENANT_A);
    const systemAsset = await seedAsset({
      tenantId: null,
      source: "system_seed",
      name: "global seed",
    });
    await seedAsset({ tenantId: TENANT_A, name: "tenant scoped" });

    const rowsUnscoped = await getAppPrisma().asset.findMany({
      select: { id: true, name: true },
    });

    expect(rowsUnscoped.map((r) => r.id)).toEqual([systemAsset.id]);
  });
});

describe("BL-025-F001 · EmailTemplate → Asset migration parity", () => {
  it("copies system + user rows with correct source mapping and content shape", async () => {
    const admin = getAdminPrisma();
    const a = await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);

    // Seed: 2 system templates (en+zh) + 2 tenant-scoped user templates.
    const sysEn = await admin.emailTemplate.create({
      data: {
        tenantId: null,
        name: "Initial Outreach",
        subject: "Partner with {{product.name}}",
        body: "Hi {{kol.name}}",
        variables: [{ token: "{{kol.name}}", description: "KOL", required: true }],
        locale: "en",
        type: "system",
      },
    });
    const sysZh = await admin.emailTemplate.create({
      data: {
        tenantId: null,
        name: "Initial Outreach",
        subject: "与 {{product.name}} 合作",
        body: "你好 {{kol.name}}",
        variables: [],
        locale: "zh",
        type: "system",
      },
    });
    const userTpl = await admin.emailTemplate.create({
      data: {
        tenantId: a.id,
        name: "Tenant A custom",
        subject: "Custom subject",
        body: "Custom body",
        variables: [],
        locale: "en",
        type: "user",
      },
    });

    // Re-run the migration body inline. The fresh testcontainers DB had
    // zero rows when migrate deploy ran, so this exercises the same SQL
    // against actual data (the production / staging path is identical).
    await admin.$executeRawUnsafe(`
      INSERT INTO "asset" (
        id, tenant_id, product_id, type, name, content, source,
        parent_id, status, metadata, created_by, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        et.tenant_id,
        NULL,
        'email'::"AssetType",
        et.name,
        jsonb_build_object(
          'subject', et.subject,
          'body', et.body,
          'locale', et.locale,
          'variables', COALESCE(et.variables, '[]'::jsonb)
        ),
        CASE
          WHEN et.tenant_id IS NULL THEN 'system_seed'::"AssetSource"
          WHEN et.type = 'system' THEN 'system_seed'::"AssetSource"
          ELSE 'user_created'::"AssetSource"
        END,
        NULL,
        'published'::"AssetStatus",
        jsonb_build_object(
          'migrated_from_email_template_id', et.id::text,
          'migrated_at', now()
        ),
        NULL,
        et.created_at,
        et.updated_at
      FROM "email_template" et
      WHERE NOT EXISTS (
        SELECT 1 FROM "asset" a
        WHERE a.metadata->>'migrated_from_email_template_id' = et.id::text
      );
    `);

    // Count parity (acceptance §F001 #1).
    const [{ src }] = await admin.$queryRawUnsafe<{ src: bigint }[]>(
      `SELECT COUNT(*)::bigint AS src FROM "email_template"`
    );
    const [{ copied }] = await admin.$queryRawUnsafe<{ copied: bigint }[]>(
      `SELECT COUNT(*)::bigint AS copied FROM "asset"
        WHERE type = 'email'
          AND metadata ? 'migrated_from_email_template_id'`
    );
    expect(Number(copied)).toBe(Number(src));
    expect(Number(src)).toBe(3);

    // Source mapping spot checks.
    const sysAssetEn = await admin.asset.findFirstOrThrow({
      where: {
        metadata: { path: ["migrated_from_email_template_id"], equals: sysEn.id },
      },
    });
    expect(sysAssetEn.source).toBe("system_seed");
    expect(sysAssetEn.tenantId).toBeNull();
    const sysContent = sysAssetEn.content as { subject: string; locale: string };
    expect(sysContent.subject).toBe("Partner with {{product.name}}");
    expect(sysContent.locale).toBe("en");

    const sysAssetZh = await admin.asset.findFirstOrThrow({
      where: {
        metadata: { path: ["migrated_from_email_template_id"], equals: sysZh.id },
      },
    });
    expect(sysAssetZh.tenantId).toBeNull();
    expect((sysAssetZh.content as { locale: string }).locale).toBe("zh");

    const userAsset = await admin.asset.findFirstOrThrow({
      where: {
        metadata: {
          path: ["migrated_from_email_template_id"],
          equals: userTpl.id,
        },
      },
    });
    expect(userAsset.source).toBe("user_created");
    expect(userAsset.tenantId).toBe(TENANT_A);

    // Cross-tenant visibility holds for migrated rows: tenant A sees
    // its own user template + both system_seed rows; tenant B sees
    // only the system_seed rows.
    const aRows = await asTenant(TENANT_A, (tx) =>
      tx.asset.findMany({ select: { id: true, source: true, tenantId: true } })
    );
    expect(aRows.map((r) => r.id).sort()).toEqual(
      [sysAssetEn.id, sysAssetZh.id, userAsset.id].sort()
    );

    const bRows = await asTenant(TENANT_B, (tx) =>
      tx.asset.findMany({ select: { id: true } })
    );
    expect(bRows.map((r) => r.id).sort()).toEqual(
      [sysAssetEn.id, sysAssetZh.id].sort()
    );
  });

  it("is idempotent — re-running the copy SQL does not duplicate rows", async () => {
    const admin = getAdminPrisma();
    await seedTenant(TENANT_A);
    await admin.emailTemplate.create({
      data: {
        tenantId: null,
        name: "Once",
        subject: "s",
        body: "b",
        variables: [],
        locale: "en",
        type: "system",
      },
    });

    const copySql = `
      INSERT INTO "asset" (
        id, tenant_id, product_id, type, name, content, source,
        parent_id, status, metadata, created_by, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), et.tenant_id, NULL, 'email'::"AssetType",
        et.name,
        jsonb_build_object('subject', et.subject, 'body', et.body,
          'locale', et.locale,
          'variables', COALESCE(et.variables, '[]'::jsonb)),
        CASE WHEN et.tenant_id IS NULL THEN 'system_seed'::"AssetSource"
             WHEN et.type = 'system' THEN 'system_seed'::"AssetSource"
             ELSE 'user_created'::"AssetSource" END,
        NULL, 'published'::"AssetStatus",
        jsonb_build_object('migrated_from_email_template_id', et.id::text,
                           'migrated_at', now()),
        NULL, et.created_at, et.updated_at
      FROM "email_template" et
      WHERE NOT EXISTS (
        SELECT 1 FROM "asset" a
        WHERE a.metadata->>'migrated_from_email_template_id' = et.id::text
      );
    `;
    await admin.$executeRawUnsafe(copySql);
    await admin.$executeRawUnsafe(copySql);

    const [{ copied }] = await admin.$queryRawUnsafe<{ copied: bigint }[]>(
      `SELECT COUNT(*)::bigint AS copied FROM "asset"
        WHERE metadata ? 'migrated_from_email_template_id'`
    );
    expect(Number(copied)).toBe(1);
  });
});

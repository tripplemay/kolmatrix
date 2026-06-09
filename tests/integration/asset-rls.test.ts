/**
 * BL-025-F001 · Asset table RLS spec
 *
 * Covers:
 *   1. tenant A sees its own assets and system_seed (tenant_id IS NULL)
 *   2. tenant A does NOT see tenant B assets
 *   3. unscoped reader (no app.tenant_id GUC) sees only system_seed rows
 *
 * BL-099-F005 (ADR-018): the EmailTemplate→Asset migration parity suite
 * was removed — the legacy `email_template` table (and its one-shot copy
 * migration) were dropped, and Asset is now the single source of truth.
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
      content: opts.content ?? {
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

// BL-099-F005 (ADR-018): the legacy `email_template` table was dropped and
// Asset is now the single source of truth. The original
// "EmailTemplate → Asset migration parity" describe seeded email_template
// rows and replayed the one-shot copy migration SQL
// (20260502120100_migrate_email_template_to_asset) against them — both the
// source table and that migration no longer exist, so the entire describe
// (count-parity + source/content mapping spot checks + copy idempotency)
// has been deleted. Pure-Asset RLS coverage above is unaffected.

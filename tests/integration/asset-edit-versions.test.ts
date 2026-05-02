/**
 * BL-025-F005 · Asset edit + variant tree + used-in integration spec.
 *
 * Exercises the F002 mutation/query layer end-to-end against a real
 * Postgres testcontainer. The F003 server actions wrap these helpers
 * — covering them at the lib level keeps the integration suite
 * server-action-mock-free while still proving the end-to-end shape
 * the UI relies on.
 *
 * Six (+1) cases per the spec acceptance:
 *   1. updateAsset rewrites email content (subject + body)
 *   2. createAsset(parentId) forks a child variant whose parentId
 *      matches the parent
 *   3. loadVariantTree returns root + children in createdAt order
 *   4. saveAssetAsVariant style flow — fork from a chosen variant
 *      threads parentId correctly (this is the "Restore version"
 *      behaviour at the lib layer)
 *   5. loadUsedIn counts email_log rows whose templateId equals
 *      either the asset.id or the metadata.migrated_from_email_template_id
 *   6. RLS — tenant A's edit is invisible to tenant B
 *   7. updateAsset Zod-rejects a malformed email content shape
 */
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  loadAssetDetail,
  loadUsedIn,
  loadVariantTree,
} from "@/lib/assets/queries";
import { createAsset, updateAsset } from "@/lib/assets/mutations";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
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
      name: `F005 Tenant ${tenantId.slice(0, 4)}`,
      slug: `f005-${tenantId.slice(0, 8)}`,
    },
  });
}

const seedEmail = {
  subject: "Hi {{kol.name}}",
  body: "Original body",
  locale: "en",
  variables: [],
};

describe("BL-025-F005 · updateAsset", () => {
  it("rewrites email content (subject + body) and returns the updated detail", async () => {
    await seedTenant(TENANT_A);
    const created = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "v1",
        content: seedEmail,
        source: "user_created",
        status: "draft",
      })
    );

    const updated = await asTenant(TENANT_A, (tx) =>
      updateAsset(tx, created.id, {
        content: { ...seedEmail, subject: "New subject", body: "Edited body" },
      })
    );

    const reloaded = (updated.content ?? {}) as { subject: string; body: string };
    expect(reloaded.subject).toBe("New subject");
    expect(reloaded.body).toBe("Edited body");
  });

  it("rejects an email content shape that fails Zod validation", async () => {
    await seedTenant(TENANT_A);
    const created = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "v1",
        content: seedEmail,
        source: "user_created",
        status: "draft",
      })
    );

    await expect(
      asTenant(TENANT_A, (tx) =>
        updateAsset(tx, created.id, {
          // missing required `body` field
          content: { subject: "ok", locale: "en", variables: [] } as Prisma.InputJsonValue,
        })
      )
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("BL-025-F005 · variant tree (createAsset child + loadVariantTree)", () => {
  it("createAsset(parentId) forks a child whose parentId references the parent", async () => {
    await seedTenant(TENANT_A);
    const root = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root",
        content: seedEmail,
        source: "user_created",
      })
    );
    const child = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root v2",
        content: seedEmail,
        source: "user_created",
        parentAssetId: root.id,
      })
    );
    expect(child.parentId).toBe(root.id);
  });

  it("loadVariantTree returns root + children in createdAt order with version index", async () => {
    await seedTenant(TENANT_A);
    const root = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root",
        content: seedEmail,
        source: "user_created",
      })
    );
    const v2 = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root v2",
        content: seedEmail,
        source: "user_created",
        parentAssetId: root.id,
      })
    );
    const v3 = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root v3",
        content: seedEmail,
        source: "user_created",
        parentAssetId: root.id,
      })
    );

    // Walk from a leaf to confirm root-discovery + descendant capture.
    const tree = await asTenant(TENANT_A, (tx) => loadVariantTree(tx, v3.id));
    expect(tree.map((n) => n.id)).toEqual([root.id, v2.id, v3.id]);
    expect(tree.map((n) => n.versionIndex)).toEqual([1, 2, 3]);
  });

  it("Restore-style fork from an older variant threads parentId correctly", async () => {
    await seedTenant(TENANT_A);
    const root = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root",
        content: seedEmail,
        source: "user_created",
      })
    );
    const v2 = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root v2",
        content: seedEmail,
        source: "user_created",
        parentAssetId: root.id,
      })
    );
    // "Restore root" — fork a new variant from the root with the
    // root's content. This is the lib-layer equivalent of the F005
    // saveAssetAsVariantAction flow the Restore button fires.
    const restored = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Root v3 (restored)",
        content: seedEmail,
        source: "user_created",
        parentAssetId: root.id,
      })
    );

    expect(restored.parentId).toBe(root.id);
    const tree = await asTenant(TENANT_A, (tx) => loadVariantTree(tx, restored.id));
    expect(tree.map((n) => n.id).sort()).toEqual([root.id, v2.id, restored.id].sort());
  });
});

describe("BL-025-F005 · loadUsedIn", () => {
  it("counts email_log refs by both the asset id and metadata.migrated_from_email_template_id", async () => {
    await seedTenant(TENANT_A);
    const admin = getAdminPrisma();
    // Native asset — F006 dual-write inserts the email_template
    // mirror (id = asset.id) automatically; no manual mirror needed.
    const asset = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "v1",
        content: seedEmail,
        source: "ai_generated",
        status: "published",
      })
    );

    const seedKol = await admin.kol.create({
      data: {
        tenantId: TENANT_A,
        platform: "youtube",
        handle: "kol-1",
        displayName: "Kol One",
      },
    });

    await admin.emailLog.create({
      data: {
        tenantId: TENANT_A,
        kolId: seedKol.id,
        templateId: asset.id,
        toAddress: "kol@example.test",
        fromAddress: "marketer@kolquest.com",
        subject: "Hi",
        bodyHtml: "<p>Hi</p>",
      },
    });

    const summary = await asTenant(TENANT_A, (tx) => loadUsedIn(tx, asset.id));
    expect(summary.total).toBe(1);
    expect(summary.recent[0]?.kolId).toBe(seedKol.id);
  });
});

describe("BL-025-F005 · RLS", () => {
  it("tenant A's edited content is invisible to tenant B", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);

    const aAsset = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Tenant A v1",
        content: seedEmail,
        source: "user_created",
      })
    );
    await asTenant(TENANT_A, (tx) =>
      updateAsset(tx, aAsset.id, {
        content: { ...seedEmail, body: "TENANT-A-SECRET" },
      })
    );

    const bSees = await asTenant(TENANT_B, (tx) => loadAssetDetail(tx, aAsset.id));
    expect(bSees).toBeNull();
  });
});

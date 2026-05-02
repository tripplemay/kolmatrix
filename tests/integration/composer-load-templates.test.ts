/**
 * BL-025-F006 · Composer reader + dual-write integration spec.
 *
 * Six cases (spec acceptance):
 *   1. createAsset(email) writes both rows (asset + email_template
 *      mirror)
 *   2. updateAsset(content) propagates the new subject/body into the
 *      email_template mirror keyed on asset.id
 *   3. Migrated asset (metadata.migrated_from_email_template_id set):
 *      updateAsset finds the original email_template row by the
 *      legacy id, not asset.id
 *   4. deleteAsset drops both rows (and email_log.template_id is
 *      ON DELETE SET NULL so historical rows survive)
 *   5. loadOutreachTemplates surfaces asset-backed rows with the
 *      system / user scope mapping intact
 *   6. RLS isolation — tenant A's writes are invisible to tenant B
 */
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadOutreachTemplates } from "@/lib/email/templates";
import {
  createAsset,
  deleteAsset,
  updateAsset,
} from "@/lib/assets/mutations";

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
      name: `F006 Tenant ${tenantId.slice(0, 4)}`,
      slug: `f006-${tenantId.slice(0, 8)}`,
    },
  });
}

const seedEmail = {
  subject: "Hi {{kol.name}}",
  body: "Original body",
  locale: "en",
  variables: [{ token: "{{kol.name}}", required: true }],
};

describe("BL-025-F006 · dual-write to email_template", () => {
  it("createAsset(email) inserts an email_template mirror keyed on asset.id", async () => {
    await seedTenant(TENANT_A);
    const created = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Outreach v1",
        content: seedEmail,
        source: "user_created",
        status: "published",
      })
    );

    const mirror = await getAdminPrisma().emailTemplate.findUnique({
      where: { id: created.id },
    });
    expect(mirror).not.toBeNull();
    expect(mirror!.tenantId).toBe(TENANT_A);
    expect(mirror!.subject).toBe(seedEmail.subject);
    expect(mirror!.body).toBe(seedEmail.body);
    expect(mirror!.locale).toBe("en");
    expect(mirror!.type).toBe("user");
  });

  it("createAsset(video_script) does NOT touch email_template", async () => {
    await seedTenant(TENANT_A);
    const created = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "video_script",
        name: "Trailer v1",
        content: { title: "Trailer", script: "Scene 1" },
        source: "user_created",
      })
    );
    const mirror = await getAdminPrisma().emailTemplate.findUnique({
      where: { id: created.id },
    });
    expect(mirror).toBeNull();
  });

  it("updateAsset(content) propagates subject+body to the email_template mirror", async () => {
    await seedTenant(TENANT_A);
    const created = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "v1",
        content: seedEmail,
        source: "user_created",
      })
    );
    await asTenant(TENANT_A, (tx) =>
      updateAsset(tx, created.id, {
        content: { ...seedEmail, subject: "New subject", body: "Edited body" },
      })
    );
    const mirror = await getAdminPrisma().emailTemplate.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(mirror.subject).toBe("New subject");
    expect(mirror.body).toBe("Edited body");
  });

  it("migrated asset's update finds email_template by metadata.migrated_from_email_template_id", async () => {
    await seedTenant(TENANT_A);
    const admin = getAdminPrisma();
    // Stand up a legacy email_template row first.
    const legacy = await admin.emailTemplate.create({
      data: {
        tenantId: TENANT_A,
        name: "Legacy",
        subject: "Old subject",
        body: "Old body",
        variables: [],
        locale: "en",
        type: "user",
      },
    });
    // Create the asset with the metadata pointer + skip the on-create
    // mirror by inserting directly via admin (the dual-write helper
    // would otherwise try to create a SECOND row with the asset's id,
    // which is fine but we want to assert migrated behavior).
    const asset = await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        type: "email",
        name: "Migrated v1",
        content: seedEmail as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
        metadata: { migrated_from_email_template_id: legacy.id } as Prisma.InputJsonValue,
      },
    });

    await asTenant(TENANT_A, (tx) =>
      updateAsset(tx, asset.id, {
        content: { ...seedEmail, subject: "Migrated subject" },
      })
    );

    const updatedLegacy = await admin.emailTemplate.findUniqueOrThrow({
      where: { id: legacy.id },
    });
    expect(updatedLegacy.subject).toBe("Migrated subject");
  });

  it("deleteAsset drops the email_template mirror as well", async () => {
    await seedTenant(TENANT_A);
    const created = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Doomed v1",
        content: seedEmail,
        source: "user_created",
      })
    );
    expect(
      await getAdminPrisma().emailTemplate.findUnique({ where: { id: created.id } })
    ).not.toBeNull();

    await asTenant(TENANT_A, (tx) => deleteAsset(tx, created.id));

    expect(
      await getAdminPrisma().emailTemplate.findUnique({ where: { id: created.id } })
    ).toBeNull();
  });
});

describe("BL-025-F006 · loadOutreachTemplates delegates to asset table", () => {
  it("returns asset-backed rows with system / user scope intact", async () => {
    await seedTenant(TENANT_A);
    // Seed a system_seed asset (tenantId IS NULL) + a tenant-scoped
    // user-created asset; both must surface, scopes preserved.
    const admin = getAdminPrisma();
    const sys = await admin.asset.create({
      data: {
        tenantId: null,
        type: "email",
        name: "System Initial Outreach",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "system_seed",
        status: "published",
      },
    });
    const user = await admin.asset.create({
      data: {
        tenantId: TENANT_A,
        type: "email",
        name: "Tenant A Custom",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "user_created",
        status: "published",
      },
    });

    const rows = await asTenant(TENANT_A, (tx) =>
      loadOutreachTemplates(tx, TENANT_A, "en")
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(sys.id);
    expect(ids).toContain(user.id);
    const sysRow = rows.find((r) => r.id === sys.id)!;
    const userRow = rows.find((r) => r.id === user.id)!;
    expect(sysRow.scope).toBe("system");
    expect(userRow.scope).toBe("user");
  });

  it("falls back to en system seeds when zh has none", async () => {
    await seedTenant(TENANT_A);
    const admin = getAdminPrisma();
    await admin.asset.create({
      data: {
        tenantId: null,
        type: "email",
        name: "EN System",
        content: { ...seedEmail, locale: "en" } as Prisma.InputJsonValue,
        source: "system_seed",
        status: "published",
      },
    });
    const rows = await asTenant(TENANT_A, (tx) =>
      loadOutreachTemplates(tx, TENANT_A, "zh")
    );
    expect(rows.find((r) => r.scope === "system" && r.locale === "en")).toBeDefined();
  });
});

describe("BL-025-F006 · RLS isolation across dual-write", () => {
  it("tenant A's email_template mirror is invisible to tenant B's composer reads", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);

    const aAsset = await asTenant(TENANT_A, (tx) =>
      createAsset(tx, TENANT_A, {
        type: "email",
        name: "Tenant A v1",
        content: seedEmail,
        source: "user_created",
        status: "published",
      })
    );

    const bRows = await asTenant(TENANT_B, (tx) =>
      loadOutreachTemplates(tx, TENANT_B, "en")
    );
    expect(bRows.find((r) => r.id === aAsset.id)).toBeUndefined();
  });
});

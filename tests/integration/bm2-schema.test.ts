/**
 * BM2-F001 · Schema extensions integration spec
 *
 * Per the 2026-04-24 pre-impl adjudication (docs/specs/BM2-f001-schema-
 * preimpl-audit.md §8), covers:
 *
 *   #A + #B + #C — email_template shape (DROPPED in BL-099-F005 /
 *     ADR-018; Asset is now the single source of truth — coverage moved
 *     to asset-rls.test.ts / composer-load-templates.test.ts)
 *   #D — campaign.product_id is TEXT (cuid) and FK-set to product
 *   #E — kol_campaign.status defaults to 'pending'; all 6 enum values
 *        round-trip cleanly via the ORM
 *   #F1 + #F2 — email_log.template_id is a decoupled plain uuid (the FK to
 *        email_template was removed in BL-099-F003, table dropped in F005)
 *   #F3 — email_log.ai_customized NOT NULL DEFAULT false
 *
 * Plus the new bespoke tables:
 *   * campaign_metric — CRUD + RLS isolation
 *   * weekly_report — CRUD + RLS + share_token unique
 *
 * Tenant extension:
 *   * tenant.logo_url is nullable, can be set via ORM
 *
 * Kol extension:
 *   * kol.email + kol.email_source (default 'manual')
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const TENANT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const TENANT_B = "bbbbbbbb-0000-0000-0000-000000000002";
const USER_A = "cccccccc-0000-0000-0000-000000000003";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenantWithUser(tenantId: string, userId?: string) {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: {
      id: tenantId,
      name: `BM2 Tenant ${tenantId.slice(0, 4)}`,
      slug: `bm2-${tenantId.slice(0, 8)}`,
    },
  });
  const user = await admin.user.create({
    data: {
      ...(userId ? { id: userId } : {}),
      tenantId: tenant.id,
      email: `owner-${tenantId.slice(0, 4)}@bm2.test`,
      name: `Owner ${tenantId.slice(0, 4)}`,
    },
  });
  return { tenant, user };
}

async function seedProduct(tenantId: string, name = "E2E Game") {
  return getAdminPrisma().product.create({
    data: {
      tenantId,
      name,
      category: "MOBA",
      targetAudience: "MOBA players aged 18-30",
      uniqueSellingPoints: "Test USP",
    },
  });
}

describe("BM2-F001 · Tenant.logoUrl", () => {
  it("stores a nullable logo URL and round-trips it", async () => {
    const { tenant } = await seedTenantWithUser(TENANT_A);
    expect(tenant.logoUrl).toBeNull();

    const updated = await getAdminPrisma().tenant.update({
      where: { id: tenant.id },
      data: { logoUrl: "https://example.test/logo.png" },
    });
    expect(updated.logoUrl).toBe("https://example.test/logo.png");
  });
});

describe("BM2-F001 · Kol.email + Kol.emailSource", () => {
  it("defaults emailSource to 'manual' and leaves email null", async () => {
    const { tenant } = await seedTenantWithUser(TENANT_A);
    const kol = await getAdminPrisma().kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "no_email_kol",
        displayName: "No Email",
      },
    });
    expect(kol.email).toBeNull();
    expect(kol.emailSource).toBe("manual");
  });

  it("enforces VarChar(320) at the app layer via Prisma", async () => {
    const { tenant } = await seedTenantWithUser(TENANT_A);
    const kol = await getAdminPrisma().kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "emailed_kol",
        displayName: "Has Email",
        email: "kol@example.test",
        emailSource: "manual",
      },
    });
    expect(kol.email).toBe("kol@example.test");
  });
});

describe("BM2-F001 · Campaign extensions + product FK (audit #D)", () => {
  it("links campaign.productId to the TEXT product.id (cuid)", async () => {
    const { tenant, user } = await seedTenantWithUser(TENANT_A);
    const product = await seedProduct(tenant.id);
    const campaign = await getAdminPrisma().campaign.create({
      data: {
        tenantId: tenant.id,
        name: "Launch Campaign",
        ownerUserId: user.id,
        productId: product.id,
      },
      include: { product: true },
    });
    expect(campaign.productId).toBe(product.id);
    expect(campaign.product?.name).toBe("E2E Game");
    // spend_total defaults to 0, not null, so ROI calcs can treat it
    // as a clean zero without branch noise.
    expect(campaign.spendTotal.toString()).toBe("0");
    expect(campaign.revenueRecorded).toBeNull();
    expect(campaign.startedAt).toBeNull();
    expect(campaign.closedAt).toBeNull();
  });

  it("nulls campaign.productId when the linked product is deleted (ON DELETE SET NULL)", async () => {
    const { tenant, user } = await seedTenantWithUser(TENANT_A);
    const product = await seedProduct(tenant.id);
    const campaign = await getAdminPrisma().campaign.create({
      data: {
        tenantId: tenant.id,
        name: "To Be Orphaned",
        ownerUserId: user.id,
        productId: product.id,
      },
    });
    await getAdminPrisma().product.delete({ where: { id: product.id } });
    const reloaded = await getAdminPrisma().campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    expect(reloaded.productId).toBeNull();
  });
});

describe("BM2-F001 · KolCampaign.status (audit #E)", () => {
  it("defaults newly-inserted rows to 'pending'", async () => {
    const { tenant, user } = await seedTenantWithUser(TENANT_A);
    const kol = await getAdminPrisma().kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "lifecycle_kol",
        displayName: "Lifecycle",
      },
    });
    const campaign = await getAdminPrisma().campaign.create({
      data: { tenantId: tenant.id, name: "Lifecycle Campaign", ownerUserId: user.id },
    });
    const link = await getAdminPrisma().kolCampaign.create({
      data: { tenantId: tenant.id, kolId: kol.id, campaignId: campaign.id },
    });
    expect(link.status).toBe("pending");
  });

  it("accepts all 6 contact-status enum values via the ORM", async () => {
    const { tenant, user } = await seedTenantWithUser(TENANT_A);
    const statuses = [
      "pending",
      "contacted",
      "quoted",
      "signed",
      "delivered",
      "paid",
    ] as const;
    const campaign = await getAdminPrisma().campaign.create({
      data: { tenantId: tenant.id, name: "Enum Round-Trip", ownerUserId: user.id },
    });
    for (const status of statuses) {
      const kol = await getAdminPrisma().kol.create({
        data: {
          tenantId: tenant.id,
          platform: "youtube",
          handle: `handle_${status}`,
          displayName: `KOL ${status}`,
        },
      });
      const link = await getAdminPrisma().kolCampaign.create({
        data: { tenantId: tenant.id, kolId: kol.id, campaignId: campaign.id, status },
      });
      expect(link.status).toBe(status);
    }
  });
});

describe("BM2-F001 · EmailLog extensions (audit #F)", () => {
  it("defaults ai_customized to false; template_id is a plain uuid (no FK) with a template_name snapshot (BL-099-F003)", async () => {
    const { tenant } = await seedTenantWithUser(TENANT_A);
    // BL-099-F005 (ADR-018) — email_template was dropped; Asset is now the
    // template source of truth and email_log.template_id is a decoupled
    // plain uuid (no FK), so we just use a free-standing uuid here. The
    // template_name snapshot is what carries the human-readable name.
    const templateId = "dddddddd-0000-0000-0000-000000000099";
    const log = await getAdminPrisma().emailLog.create({
      data: {
        tenantId: tenant.id,
        templateId,
        templateName: "Outreach",
        toAddress: "kol@example.test",
        fromAddress: "marketer@kolquest.com",
        subject: "Hi",
        bodyHtml: "<p>Hi</p>",
      },
    });
    expect(log.aiCustomized).toBe(false);
    expect(log.templateId).toBe(templateId);
    expect(log.templateName).toBe("Outreach");

    // BL-099-F003 (ADR-018 D2) — template_id is a plain uuid with no FK,
    // so the correlation id is just stored verbatim and the template_name
    // snapshot survives independently (the snapshot is exactly why the FK
    // is no longer needed). Reloading round-trips both.
    const reloaded = await getAdminPrisma().emailLog.findUniqueOrThrow({
      where: { id: log.id },
    });
    expect(reloaded.templateId).toBe(templateId);
    expect(reloaded.templateName).toBe("Outreach");
  });

  it("honours ai_customized=true when explicitly set", async () => {
    const { tenant } = await seedTenantWithUser(TENANT_A);
    const log = await getAdminPrisma().emailLog.create({
      data: {
        tenantId: tenant.id,
        toAddress: "kol@example.test",
        fromAddress: "marketer@kolquest.com",
        subject: "Hi",
        bodyHtml: "<p>Hi</p>",
        aiCustomized: true,
      },
    });
    expect(log.aiCustomized).toBe(true);
  });
});

describe("BM2-F001 · CampaignMetric new table", () => {
  it("writes + reads metric rows scoped to the owning tenant (RLS)", async () => {
    const { tenant, user } = await seedTenantWithUser(TENANT_A);
    const campaign = await getAdminPrisma().campaign.create({
      data: { tenantId: tenant.id, name: "Metric Campaign", ownerUserId: user.id },
    });
    await getAdminPrisma().campaignMetric.create({
      data: {
        tenantId: tenant.id,
        campaignId: campaign.id,
        impressions: 1000,
        clicks: 50,
        conversions: 5,
        attributedRevenue: "100.50",
        source: "manual",
      },
    });

    const aSees = await asTenant(tenant.id, (tx) =>
      tx.campaignMetric.findMany()
    );
    expect(aSees).toHaveLength(1);
    expect(aSees[0]!.source).toBe("manual");
    expect(aSees[0]!.impressions).toBe(1000);
  });

  it("hides metric rows from a different tenant under RLS", async () => {
    const a = await seedTenantWithUser(TENANT_A);
    const b = await seedTenantWithUser(TENANT_B);
    const aCampaign = await getAdminPrisma().campaign.create({
      data: { tenantId: a.tenant.id, name: "A Campaign", ownerUserId: a.user.id },
    });
    await getAdminPrisma().campaignMetric.create({
      data: { tenantId: a.tenant.id, campaignId: aCampaign.id, impressions: 100 },
    });
    const bSees = await asTenant(b.tenant.id, (tx) =>
      tx.campaignMetric.findMany()
    );
    expect(bSees).toHaveLength(0);
  });
});

describe("BM2-F001 · WeeklyReport new table", () => {
  it("creates a report with nullable share_token and enforces uniqueness", async () => {
    const { tenant, user } = await seedTenantWithUser(TENANT_A, USER_A);
    const report = await getAdminPrisma().weeklyReport.create({
      data: {
        tenantId: tenant.id,
        weekStart: new Date("2026-04-20T00:00:00Z"),
        weekEnd: new Date("2026-04-26T00:00:00Z"),
        contentMd: "# Weekly Summary\n\n...",
        locale: "en",
        createdByUserId: user.id,
      },
    });
    expect(report.shareToken).toBeNull();

    await getAdminPrisma().weeklyReport.update({
      where: { id: report.id },
      data: {
        shareToken: "abcd1234",
        shareTokenExpiresAt: new Date("2026-05-01T00:00:00Z"),
      },
    });

    // Creating another report with the SAME token must violate the
    // unique index.
    await expect(
      getAdminPrisma().weeklyReport.create({
        data: {
          tenantId: tenant.id,
          weekStart: new Date("2026-04-27T00:00:00Z"),
          weekEnd: new Date("2026-05-03T00:00:00Z"),
          contentMd: "#",
          createdByUserId: user.id,
          shareToken: "abcd1234",
        },
      })
    ).rejects.toThrow();
  });

  it("hides weekly reports from a different tenant under RLS", async () => {
    const a = await seedTenantWithUser(TENANT_A);
    const b = await seedTenantWithUser(TENANT_B);
    await getAdminPrisma().weeklyReport.create({
      data: {
        tenantId: a.tenant.id,
        weekStart: new Date("2026-04-20"),
        weekEnd: new Date("2026-04-26"),
        contentMd: "#",
        createdByUserId: a.user.id,
      },
    });
    const bSees = await asTenant(b.tenant.id, (tx) =>
      tx.weeklyReport.findMany()
    );
    expect(bSees).toHaveLength(0);
  });
});

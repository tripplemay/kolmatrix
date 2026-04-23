/**
 * F007 RLS isolation suite — exercises the 6 tenant-scoped tables installed
 * by migration 20260418000000_init and proves:
 *   1. Two tenants' data never leak across tenant boundaries when queried
 *      through the `kolmatrix_app` role (which obeys RLS).
 *   2. An unauthenticated query (no `app.tenant_id` SET LOCAL) returns 0
 *      rows — the "default deny" baseline.
 *
 * Uses the admin client (postgres superuser, bypasses RLS) to seed both
 * tenants, then switches to the app client via `asTenant` / raw findMany
 * to assert what each caller actually sees.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { makeCampaign, makeKol, makeTenant, makeUser } from "../fixtures";
import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  getAppPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

type SeedResult = {
  tenantId: string;
  userId: string;
  kolId: string;
  campaignId: string;
  kolCampaignId: string;
  emailTemplateId: string;
  emailLogId: string;
};

async function seedTenant(label: string): Promise<SeedResult> {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({ data: makeTenant({ slug: `rls-${label}` }) });
  const user = await admin.user.create({ data: makeUser({ tenantId: tenant.id }) });
  const kol = await admin.kol.create({ data: makeKol({ tenantId: tenant.id }) });
  const campaign = await admin.campaign.create({
    data: makeCampaign({ tenantId: tenant.id, ownerUserId: user.id }),
  });
  const kolCampaign = await admin.kolCampaign.create({
    data: {
      tenantId: tenant.id,
      kolId: kol.id,
      campaignId: campaign.id,
      status: "candidate",
    },
  });
  const emailTemplate = await admin.emailTemplate.create({
    data: {
      tenantId: tenant.id,
      name: `template-${label}`,
      subject: "Hi",
      body: "Hi",
      variables: [],
      type: "user",
    },
  });
  const emailLog = await admin.emailLog.create({
    data: {
      tenantId: tenant.id,
      campaignId: campaign.id,
      kolId: kol.id,
      templateId: emailTemplate.id,
      toAddress: `kol-${label}@example.test`,
      fromAddress: `outreach-${label}@example.test`,
      subject: "Hi",
      bodyHtml: "<p>Hi</p>",
    },
  });
  return {
    tenantId: tenant.id,
    userId: user.id,
    kolId: kol.id,
    campaignId: campaign.id,
    kolCampaignId: kolCampaign.id,
    emailTemplateId: emailTemplate.id,
    emailLogId: emailLog.id,
  };
}

describe("RLS — cross-tenant isolation across all 6 tenant-scoped tables", () => {
  let A: SeedResult;
  let B: SeedResult;

  beforeAll(async () => {
    await setupTestDb();
    await cleanDb();
    A = await seedTenant("A");
    B = await seedTenant("B");
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("user table — tenant A sees only A's user; cannot find B's user by id", async () => {
    const aSees = await asTenant(A.tenantId, (tx) => tx.user.findMany());
    expect(aSees.map((u) => u.id)).toEqual([A.userId]);

    const crossLookup = await asTenant(A.tenantId, (tx) =>
      tx.user.findUnique({ where: { id: B.userId } })
    );
    expect(crossLookup).toBeNull();
  });

  it("kol table — tenant A sees only A's kol; B's kol is invisible", async () => {
    const aSees = await asTenant(A.tenantId, (tx) => tx.kol.findMany());
    expect(aSees.map((k) => k.id)).toEqual([A.kolId]);

    const bSees = await asTenant(B.tenantId, (tx) => tx.kol.findMany());
    expect(bSees.map((k) => k.id)).toEqual([B.kolId]);
  });

  it("campaign table — tenant A sees only A's campaign", async () => {
    const aSees = await asTenant(A.tenantId, (tx) => tx.campaign.findMany());
    expect(aSees.map((c) => c.id)).toEqual([A.campaignId]);

    const aLookupB = await asTenant(A.tenantId, (tx) =>
      tx.campaign.findUnique({ where: { id: B.campaignId } })
    );
    expect(aLookupB).toBeNull();
  });

  it("kol_campaign table — tenant A sees only A's junction row", async () => {
    const aSees = await asTenant(A.tenantId, (tx) => tx.kolCampaign.findMany());
    expect(aSees.map((kc) => kc.id)).toEqual([A.kolCampaignId]);
  });

  it("email_template table — tenant A cannot read B's template", async () => {
    const aSees = await asTenant(A.tenantId, (tx) => tx.emailTemplate.findMany());
    expect(aSees.map((t) => t.id)).toEqual([A.emailTemplateId]);
  });

  it("email_log table — tenant A cannot read B's log", async () => {
    const aSees = await asTenant(A.tenantId, (tx) => tx.emailLog.findMany());
    expect(aSees.map((l) => l.id)).toEqual([A.emailLogId]);
  });

  it("unscoped queries (no app.tenant_id) return 0 rows across every table", async () => {
    // Post-F008 RLS fix: NULLIF(current_setting(...), '')::uuid degrades
    // the empty-string / missing-GUC cases to NULL, and `tenant_id = NULL`
    // is NULL (filtered). Default-deny is now STABLE — no try/catch
    // needed, no dependency on whether the session has ever touched the
    // custom GUC.
    const app = getAppPrisma();
    expect(await app.user.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await app.kol.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await app.campaign.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await app.kolCampaign.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await app.emailTemplate.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await app.emailLog.findMany({ select: { id: true } })).toHaveLength(0);
  });
});

/**
 * BL-034 F003 · audit_log RLS isolation regression spec.
 *
 * Migration `20260505010000_audit_event_log_rls` enabled RLS on
 * audit_log with policy:
 *   USING (tenant_id IS NULL
 *          OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
 *
 * This suite proves three properties via the kolmatrix_app role
 * (RLS-enforced) running through the production withTenant() helper:
 *   1. tenant A writes are invisible to tenant B
 *   2. platform-level rows (tenant_id NULL) follow the design decision
 *      D3: visible to every withTenant context (D3 says "platform events
 *      = global visibility"). Admin client always sees them.
 *   3. The ai-suggestions-actions.ts:64 read pattern (filter by
 *      resourceId) cannot leak across tenants even when resourceIds
 *      collide, because withTenant + RLS strip the foreign rows AND the
 *      defense-in-depth tenantId filter further pins the query.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asTenant, cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type LogAuditFn = typeof import("@/lib/audit/log").logAudit;

let logAudit: LogAuditFn;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const ACTOR_A = "44444444-4444-4444-4444-444444444444";
const ACTOR_B = "55555555-5555-5555-5555-555555555555";
const SHARED_RESOURCE_ID = "99999999-9999-9999-9999-999999999999";

beforeAll(async () => {
  await setupTestDb();
  // Pre-create both tenants so any assertion that checks them via the
  // tenant table (or future FK additions) does not surprise the test.
  const admin = getAdminPrisma();
  for (const [id, slug] of [
    [TENANT_A, "rls-a"],
    [TENANT_B, "rls-b"],
  ] as const) {
    await admin.tenant.upsert({
      where: { id },
      update: {},
      create: { id, slug, name: `RLS Tenant ${slug}` },
    });
  }
  ({ logAudit } = await import("@/lib/audit/log"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  // cleanDb does not truncate audit_log; do it via the admin client so
  // RLS does not block.
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log" RESTART IDENTITY`);
});

afterAll(async () => {
  await cleanDb();
});

describe("audit_log RLS — BL-034 F003", () => {
  it("blocks tenant B from reading tenant A audit rows", async () => {
    await logAudit({
      tenantId: TENANT_A,
      actorId: ACTOR_A,
      action: "campaign.touched",
      targetType: "campaign",
      targetId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    const fromB = await asTenant(TENANT_B, (tx) =>
      tx.auditLog.findMany({ where: { action: "campaign.touched" } }),
    );
    expect(fromB).toHaveLength(0);

    // Sanity: admin (superuser) bypasses RLS and still sees the row.
    const fromAdmin = await getAdminPrisma().auditLog.findMany({
      where: { action: "campaign.touched" },
    });
    expect(fromAdmin).toHaveLength(1);
    expect(fromAdmin[0]!.tenantId).toBe(TENANT_A);
  });

  it("makes platform-level audit rows (tenant_id NULL) visible to every tenant + admin (D3)", async () => {
    await logAudit({
      actorId: ACTOR_A,
      action: "platform.config_changed",
      targetType: "platform_config",
      targetId: "00000000-0000-0000-0000-000000000000",
    });

    // Platform row visible from tenant A (D3: "platform events = global")
    const fromA = await asTenant(TENANT_A, (tx) =>
      tx.auditLog.findMany({ where: { action: "platform.config_changed" } }),
    );
    expect(fromA).toHaveLength(1);
    expect(fromA[0]!.tenantId).toBeNull();

    // ...and from tenant B
    const fromB = await asTenant(TENANT_B, (tx) =>
      tx.auditLog.findMany({ where: { action: "platform.config_changed" } }),
    );
    expect(fromB).toHaveLength(1);

    // ...and from admin
    const fromAdmin = await getAdminPrisma().auditLog.findMany({
      where: { action: "platform.config_changed" },
    });
    expect(fromAdmin).toHaveLength(1);
  });

  it("ai-suggestions findMany pattern is safe across tenants even with shared resourceId", async () => {
    // Tenant A writes a campaign-touch audit
    await logAudit({
      tenantId: TENANT_A,
      actorId: ACTOR_A,
      action: "campaign.ai_suggestion_loaded",
      targetType: "campaign",
      targetId: SHARED_RESOURCE_ID,
    });
    // Tenant B writes their own audit with the SAME resourceId (extreme edge
    // case: collision could occur if resourceId weren't tenant-scoped).
    await logAudit({
      tenantId: TENANT_B,
      actorId: ACTOR_B,
      action: "campaign.ai_suggestion_loaded",
      targetType: "campaign",
      targetId: SHARED_RESOURCE_ID,
    });

    // Mirror the ai-suggestions-actions.ts:64 query *without* a tenantId
    // filter (defense-in-depth removed). Even so, RLS strips the foreign
    // tenant's row.
    const tenantBView = await asTenant(TENANT_B, (tx) =>
      tx.auditLog.findMany({
        where: {
          OR: [
            { resourceType: "campaign", resourceId: SHARED_RESOURCE_ID },
            {
              resourceType: "kol_campaign",
              payload: { path: ["after", "campaignId"], equals: SHARED_RESOURCE_ID },
            },
          ],
        },
      }),
    );
    expect(tenantBView).toHaveLength(1);
    expect(tenantBView[0]!.tenantId).toBe(TENANT_B);
    expect(tenantBView[0]!.actorUserId).toBe(ACTOR_B);

    // With the explicit tenantId filter (the BL-034 patch), result is the
    // same — the explicit filter is a belt-and-braces backstop in case a
    // future refactor accidentally drops the withTenant() wrapper.
    const tenantBExplicit = await asTenant(TENANT_B, (tx) =>
      tx.auditLog.findMany({
        where: {
          tenantId: TENANT_B,
          OR: [
            { resourceType: "campaign", resourceId: SHARED_RESOURCE_ID },
            {
              resourceType: "kol_campaign",
              payload: { path: ["after", "campaignId"], equals: SHARED_RESOURCE_ID },
            },
          ],
        },
      }),
    );
    expect(tenantBExplicit).toHaveLength(1);
    expect(tenantBExplicit[0]!.tenantId).toBe(TENANT_B);

    // And admin still sees both rows (no RLS).
    const adminView = await getAdminPrisma().auditLog.findMany({
      where: { resourceId: SHARED_RESOURCE_ID },
      orderBy: { tenantId: "asc" },
    });
    expect(adminView).toHaveLength(2);
  });
});

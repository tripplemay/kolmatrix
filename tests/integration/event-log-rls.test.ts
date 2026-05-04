/**
 * BL-034 F003 · event_log RLS isolation regression spec.
 *
 * Mirror of audit-log-rls.test.ts for event_log. Same policy template
 * (NULLIF + tenant_id IS NULL double branch, D3) but applied through
 * logEvent() instead of logAudit().
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { asTenant, cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type LogEventFn = typeof import("@/lib/events/log").logEvent;

let logEvent: LogEventFn;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const ACTOR_A = "44444444-4444-4444-4444-444444444444";

beforeAll(async () => {
  await setupTestDb();
  const admin = getAdminPrisma();
  for (const [id, slug] of [
    [TENANT_A, "evt-rls-a"],
    [TENANT_B, "evt-rls-b"],
  ] as const) {
    await admin.tenant.upsert({
      where: { id },
      update: {},
      create: { id, slug, name: `Evt RLS Tenant ${slug}` },
    });
  }
  ({ logEvent } = await import("@/lib/events/log"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
});

afterAll(async () => {
  await cleanDb();
});

describe("event_log RLS — BL-034 F003", () => {
  it("blocks tenant B from reading tenant A event rows", async () => {
    await logEvent({
      type: "kol.created",
      tenantId: TENANT_A,
      actorId: ACTOR_A,
      resourceId: "kol-1",
      payload: { source: "test" },
    });

    const fromB = await asTenant(TENANT_B, (tx) =>
      tx.eventLog.findMany({ where: { type: "kol.created" } }),
    );
    expect(fromB).toHaveLength(0);

    const fromAdmin = await getAdminPrisma().eventLog.findMany({
      where: { type: "kol.created" },
    });
    expect(fromAdmin).toHaveLength(1);
    expect(fromAdmin[0]!.tenantId).toBe(TENANT_A);
  });

  it("makes platform-level event rows visible to every tenant + admin (D3)", async () => {
    await logEvent({
      type: "platform.heartbeat",
      payload: { ts: Date.now() },
    });

    const fromA = await asTenant(TENANT_A, (tx) =>
      tx.eventLog.findMany({ where: { type: "platform.heartbeat" } }),
    );
    expect(fromA).toHaveLength(1);
    expect(fromA[0]!.tenantId).toBeNull();

    const fromB = await asTenant(TENANT_B, (tx) =>
      tx.eventLog.findMany({ where: { type: "platform.heartbeat" } }),
    );
    expect(fromB).toHaveLength(1);

    const fromAdmin = await getAdminPrisma().eventLog.findMany({
      where: { type: "platform.heartbeat" },
    });
    expect(fromAdmin).toHaveLength(1);
  });
});

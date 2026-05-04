/**
 * BI4-F002 · event_log + logEvent() integration spec
 *
 * Contract covered:
 *   1. logEvent() persists a row with every provided field
 *   2. failures inside logEvent() are swallowed — main flow
 *      sees a resolved promise even when the DB call blows up
 *   3. queries by (tenantId, type, createdAt) are covered by the
 *      composite index and return rows filtered + ordered correctly
 *   4. optional fields (tenantId / actorId / resourceId) tolerate null
 *
 * Follows the BAux1-F004 pattern: setupTestDb() mutates DATABASE_URL
 * before we dynamic-import logEvent so the Prisma singleton inside
 * src/lib/db.ts resolves to the Testcontainers URL rather than
 * whatever DATABASE_URL was in the env at Vitest boot.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type LogEventFn = typeof import("@/lib/events/log").logEvent;
type PrismaModule = typeof import("@/lib/db");

let logEvent: LogEventFn;
let prismaModule: PrismaModule;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const ACTOR_ID = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  await setupTestDb();
  prismaModule = await import("@/lib/db");
  ({ logEvent } = await import("@/lib/events/log"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  // cleanDb() leaves event_log alone (platform-level, not in its
  // business-table sweep); wipe it here so each test starts blank.
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
});

describe("logEvent()", () => {
  it("persists a row with every provided field", async () => {
    await logEvent({
      type: "kol.created",
      tenantId: TENANT_A,
      actorId: ACTOR_ID,
      resourceId: "kol-abc",
      payload: { source: "manual", platform: "youtube" },
    });

    const rows = await getAdminPrisma().eventLog.findMany({ where: { type: "kol.created" } });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.type).toBe("kol.created");
    expect(row.tenantId).toBe(TENANT_A);
    expect(row.actorId).toBe(ACTOR_ID);
    expect(row.resourceId).toBe("kol-abc");
    expect(row.payload).toEqual({ source: "manual", platform: "youtube" });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("swallows DB errors so the caller's main flow is unaffected", async () => {
    // BL-034 F003: tenant-scoped writes flow through withTenant() →
    // tx.eventLog.create, which bypasses a spy on the singleton's
    // eventLog.create. Drive the test through the platform-level path
    // (no tenantId) where the bare client is still in play so the spy
    // can simulate the connection failure.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const createSpy = vi
      .spyOn(prismaModule.prisma.eventLog, "create")
      .mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      logEvent({ type: "kol.created", payload: { x: 1 } })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0] ?? "")).toContain("kol.created");

    createSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("supports filtered + ordered queries by (tenantId, type, createdAt)", async () => {
    const now = Date.now();
    await logEvent({ type: "kol.created", tenantId: TENANT_A, payload: { seq: 1 } });
    await new Promise((r) => setTimeout(r, 5));
    await logEvent({ type: "kol.created", tenantId: TENANT_A, payload: { seq: 2 } });
    await logEvent({ type: "kol.created", tenantId: TENANT_B, payload: { seq: 3 } });
    await logEvent({ type: "campaign.sent", tenantId: TENANT_A, payload: { seq: 4 } });

    const tenantAKolCreated = await getAdminPrisma().eventLog.findMany({
      where: {
        tenantId: TENANT_A,
        type: "kol.created",
        createdAt: { gte: new Date(now - 1000) },
      },
      orderBy: { createdAt: "asc" },
    });

    expect(tenantAKolCreated).toHaveLength(2);
    expect((tenantAKolCreated[0]!.payload as { seq: number }).seq).toBe(1);
    expect((tenantAKolCreated[1]!.payload as { seq: number }).seq).toBe(2);

    const tenantBRows = await getAdminPrisma().eventLog.findMany({
      where: { tenantId: TENANT_B },
    });
    expect(tenantBRows).toHaveLength(1);
    expect((tenantBRows[0]!.payload as { seq: number }).seq).toBe(3);
  });

  it("accepts null tenantId + null actorId for platform-level events", async () => {
    await logEvent({ type: "system.migration_applied", payload: { version: "20260424000000" } });

    const rows = await getAdminPrisma().eventLog.findMany({
      where: { type: "system.migration_applied" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenantId).toBeNull();
    expect(rows[0]!.actorId).toBeNull();
    expect(rows[0]!.resourceId).toBeNull();
  });
});

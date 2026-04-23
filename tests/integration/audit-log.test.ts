/**
 * BI4-F003 · logAudit() integration spec (sits on top of B0 audit_log)
 *
 * Contract covered:
 *   1. logAudit() with full payload → audit_log row has
 *      action/resource_type/resource_id/actor_user_id + payload.{before,after}
 *   2. sanitizedFields array is persisted in payload when provided
 *   3. queries by (actor_user_id, createdAt) and (resource_type, resource_id)
 *   4. null tenantId is accepted (platform-level audit)
 *   5. Prisma/DB errors are swallowed — caller's main flow keeps going
 *   6. TypeScript enforces actorId required at compile time (type-level test)
 *
 * The TS-type assertion for #6 lives beside the runtime suite but
 * does not run — tsc --noEmit is what enforces it in CI.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type LogAuditFn = typeof import("@/lib/audit/log").logAudit;
type PrismaModule = typeof import("@/lib/db");

let logAudit: LogAuditFn;
let prismaModule: PrismaModule;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const ACTOR = "44444444-4444-4444-4444-444444444444";
const TARGET_KOL = "55555555-5555-5555-5555-555555555555";

beforeAll(async () => {
  await setupTestDb();
  prismaModule = await import("@/lib/db");
  ({ logAudit } = await import("@/lib/audit/log"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  // audit_log is platform-level and not part of cleanDb()'s sweep; wipe
  // per-test so counts and queries are deterministic.
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log" RESTART IDENTITY`);
});

describe("logAudit()", () => {
  it("persists full record with before/after folded into payload", async () => {
    await logAudit({
      actorId: ACTOR,
      action: "user.role_changed",
      targetType: "user",
      targetId: "66666666-6666-6666-6666-666666666666",
      tenantId: TENANT_A,
      before: { role: "marketer" },
      after: { role: "admin" },
      ipAddress: "203.0.113.42",
      userAgent: "Mozilla/5.0",
    });

    const rows = await getAdminPrisma().auditLog.findMany({
      where: { action: "user.role_changed" },
    });
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.tenantId).toBe(TENANT_A);
    expect(row.actorUserId).toBe(ACTOR);
    expect(row.resourceType).toBe("user");
    expect(row.resourceId).toBe("66666666-6666-6666-6666-666666666666");
    expect(row.payload).toEqual({
      before: { role: "marketer" },
      after: { role: "admin" },
    });
    expect(row.ipAddress).toBe("203.0.113.42");
    expect(row.userAgent).toBe("Mozilla/5.0");
  });

  it("records sanitizedFields alongside before/after when provided", async () => {
    await logAudit({
      actorId: ACTOR,
      action: "user.password_reset",
      targetType: "user",
      targetId: "66666666-6666-6666-6666-666666666666",
      tenantId: TENANT_A,
      before: { email: "a@b.com" },
      after: { email: "a@b.com" },
      sanitizedFields: ["hashedPassword", "resetToken"],
    });

    const rows = await getAdminPrisma().auditLog.findMany({
      where: { action: "user.password_reset" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.payload).toEqual({
      before: { email: "a@b.com" },
      after: { email: "a@b.com" },
      sanitizedFields: ["hashedPassword", "resetToken"],
    });
  });

  it("supports queries by actor + time range and by target", async () => {
    const now = Date.now();
    await logAudit({
      actorId: ACTOR,
      action: "kol.deleted",
      targetType: "kol",
      targetId: TARGET_KOL,
      tenantId: TENANT_A,
    });
    await logAudit({
      actorId: ACTOR,
      action: "kol.updated",
      targetType: "kol",
      targetId: TARGET_KOL,
      tenantId: TENANT_A,
      after: { status: "inactive" },
    });
    await logAudit({
      actorId: "99999999-9999-9999-9999-999999999999",
      action: "kol.deleted",
      targetType: "kol",
      targetId: "77777777-7777-7777-7777-777777777777",
      tenantId: TENANT_A,
    });

    const admin = getAdminPrisma();

    const byActor = await admin.auditLog.findMany({
      where: { actorUserId: ACTOR, createdAt: { gte: new Date(now - 1000) } },
      orderBy: { createdAt: "asc" },
    });
    expect(byActor).toHaveLength(2);
    expect(byActor.map((r) => r.action)).toEqual(["kol.deleted", "kol.updated"]);

    const byTarget = await admin.auditLog.findMany({
      where: { resourceType: "kol", resourceId: TARGET_KOL },
    });
    expect(byTarget).toHaveLength(2);
  });

  it("accepts null tenantId for platform-level audit entries", async () => {
    await logAudit({
      actorId: ACTOR,
      action: "platform.config_updated",
      targetType: "platform_config",
      targetId: "00000000-0000-0000-0000-000000000000",
    });

    const rows = await getAdminPrisma().auditLog.findMany({
      where: { action: "platform.config_updated" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenantId).toBeNull();
  });

  it("swallows DB errors so the caller's main flow keeps going", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const createSpy = vi
      .spyOn(prismaModule.prisma.auditLog, "create")
      .mockRejectedValueOnce(new Error("connection refused"));

    await expect(
      logAudit({
        actorId: ACTOR,
        action: "user.role_changed",
        targetType: "user",
        targetId: "66666666-6666-6666-6666-666666666666",
      })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0] ?? "")).toContain("user.role_changed");

    createSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

/**
 * BAux1-F001 · AccessRequest schema smoke suite
 *
 * Asserts the migration-installed `access_request` table behaves per
 * docs/specs/BAux1-auth-pages-spec.md §F001:
 *   1. Basic insert with all required fields succeeds
 *   2. `email` UNIQUE constraint rejects duplicates
 *   3. `@@index([status, createdAt])` lookup by status returns only
 *      matching rows in createdAt order
 *
 * Uses the admin client because this table is NOT tenant-scoped and has
 * no RLS — we don't need `withTestTenant`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

function baseInput(email: string) {
  return {
    email,
    firstName: "Sarah",
    lastName: "Chen",
    company: "Neon Launch Studio",
    role: "Marketing Manager",
    campaignsPerQuarter: "6-20",
    games: "Astra: Midnight Gauntlet",
  };
}

describe("access_request table", () => {
  it("accepts a valid insert and defaults status to 'pending'", async () => {
    const admin = getAdminPrisma();

    const created = await admin.accessRequest.create({
      data: baseInput("sarah@neonlaunch.test"),
    });

    expect(created.id).toMatch(/^c[a-z0-9]{24}$/); // cuid shape
    expect(created.email).toBe("sarah@neonlaunch.test");
    expect(created.status).toBe("pending");
    expect(created.reviewedBy).toBeNull();
    expect(created.reviewedAt).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects a second insert reusing the same email (unique constraint)", async () => {
    const admin = getAdminPrisma();
    const email = "dup@neonlaunch.test";

    await admin.accessRequest.create({ data: baseInput(email) });

    await expect(
      admin.accessRequest.create({
        data: { ...baseInput(email), company: "Second Studio" },
      })
    ).rejects.toThrow(/unique/i);
  });

  it("returns only 'pending' rows ordered by createdAt when queried via the status index", async () => {
    const admin = getAdminPrisma();

    // Two pending, one approved, one rejected — 4 rows across 3 states.
    await admin.accessRequest.create({ data: baseInput("p1@neonlaunch.test") });
    await admin.accessRequest.create({
      data: { ...baseInput("approved@neonlaunch.test"), status: "approved" },
    });
    await admin.accessRequest.create({ data: baseInput("p2@neonlaunch.test") });
    await admin.accessRequest.create({
      data: { ...baseInput("rejected@neonlaunch.test"), status: "rejected" },
    });

    const pending = await admin.accessRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });

    expect(pending).toHaveLength(2);
    expect(pending.map((r) => r.email)).toEqual([
      "p1@neonlaunch.test",
      "p2@neonlaunch.test",
    ]);
  });
});

/**
 * BL-040 F001 · Product.targetAudience NOT NULL contract test
 *
 * PRD §13 Q5 user-locked answer: targetAudience must be required.
 * Coverage:
 *   1. DB-level NOT NULL constraint rejects raw NULL inserts (the migration
 *      `20260507000000_target_audience_required` enforces this).
 *   2. Zod schema rejects empty / whitespace-only strings (existing
 *      defense-in-depth at the application boundary; verified here so the
 *      DB constraint never fires in normal Server Action flow).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createProductSchema } from "@/lib/products/schema";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  // cleanDb() does not truncate product; do it explicitly so each case
  // starts from a known empty state.
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "product" CASCADE`);
});

describe("Product.targetAudience required (BL-040 F001)", () => {
  it("rejects raw INSERT with NULL targetAudience at DB level", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "BL-040 Tenant", slug: `bl040-${Date.now()}` },
    });

    // Bypass Prisma's TypeScript guard with a raw INSERT to confirm the
    // database-level constraint is the actual gate. Prisma create() would
    // throw a type error before reaching the DB after the schema change.
    await expect(
      admin.$executeRawUnsafe(
        `INSERT INTO "product" (id, tenant_id, name, category, target_audience, unique_selling_points, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NULL, $5, NOW(), NOW())`,
        "cltest" + Math.random().toString(36).slice(2, 12),
        tenant.id,
        "NullAudience Game",
        "RPG",
        "USP"
      )
    ).rejects.toThrow(/null value in column "target_audience"|not-null constraint/i);
  });

  it("Zod createProductSchema rejects empty string after trim", () => {
    const result = createProductSchema.safeParse({
      name: "Valid Game",
      category: "RPG",
      targetAudience: "   ",
      uniqueSellingPoints: "Daily tournaments",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const audienceIssue = result.error.issues.find((i) =>
        i.path.includes("targetAudience")
      );
      expect(audienceIssue?.message).toBe("targetAudienceRequired");
    }
  });

  it("Zod createProductSchema accepts minimum 1-character non-whitespace", () => {
    const result = createProductSchema.safeParse({
      name: "Valid Game",
      category: "RPG",
      targetAudience: "a",
      uniqueSellingPoints: "Daily tournaments",
    });

    expect(result.success).toBe(true);
  });
});

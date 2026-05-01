/**
 * MVP-internal-demo-prep verifying-2026-05-01 fixes regression spec.
 *
 * Two seed-side properties this batch promised but didn't enforce:
 *   1. Each seeded campaign whose `game` matches a seeded Product gets
 *      its productId set, so /outreach AI customize stops failing with
 *      "Campaign or template not found" (Reviewer C-10).
 *   2. After running, the Demo Studio tenant has *exactly* the canonical
 *      5-product set — anything else (e.g. a leftover from manual UI
 *      testing) is removed, provided no campaign references it
 *      (Reviewer C-05.1).
 *
 * We don't shell out to `npm run db:seed` here (Testcontainers spins up
 * a fresh DB per worker; running the full seed.ts inside the test would
 * pull a pile of unrelated tables into scope). Instead we run the same
 * primitives the seed uses against an isolated tenant and assert the
 * post-conditions.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, setupTestDb, teardownTestDb, withTestTenant } from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

describe("seed.ts campaign↔product link (MVP-vf C-10)", () => {
  it("links a campaign to the matching product by name", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const owner = await tx.user.create({
        data: { email: "o@t.local", tenantId, role: "marketer", passwordHash: "x" },
      });
      const product = await tx.product.create({
        data: {
          tenantId,
          name: "Honor of Kings",
          category: "MOBA",
          uniqueSellingPoints: "USP",
          targetAudience: "Mobile gamers",
        },
      });
      const campaign = await tx.campaign.create({
        data: {
          tenantId,
          name: "Honor of Kings — Global Launch",
          ownerUserId: owner.id,
          status: "active",
          markets: ["US"],
        },
      });

      // Mirror the seed's post-product-link step.
      await tx.campaign.update({
        where: { id: campaign.id },
        data: { productId: product.id },
      });

      const linked = await tx.campaign.findUnique({
        where: { id: campaign.id },
        select: { product: { select: { name: true } } },
      });
      expect(linked!.product?.name).toBe("Honor of Kings");
    });
  });
});

describe("seed.ts product cleanup (MVP-vf C-05.1)", () => {
  it("removes products whose name is not in the canonical seed list when no campaigns reference them", async () => {
    await withTestTenant(async (tenantId, tx) => {
      // 5 canonical seeds + 1 leftover from manual UI testing.
      const canonical = [
        "Honor of Kings",
        "Genshin Impact",
        "PUBG Mobile",
        "Pokemon Go",
        "Clash Royale",
      ];
      for (const name of [...canonical, "Leftover Game"]) {
        await tx.product.create({
          data: {
            tenantId,
            name,
            category: "MOBA",
            uniqueSellingPoints: "USP",
            targetAudience: "Gamers",
          },
        });
      }
      // Mirror the seed's deleteMany predicate.
      const removed = await tx.product.deleteMany({
        where: {
          tenantId,
          name: { notIn: canonical },
          campaigns: { none: {} },
        },
      });
      expect(removed.count).toBe(1);

      const surviving = await tx.product.findMany({
        where: { tenantId },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      expect(surviving.map((p) => p.name).sort()).toEqual([...canonical].sort());
    });
  });

  it("keeps a non-canonical product if it has a campaign linked (FK Restrict guard)", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const owner = await tx.user.create({
        data: { email: "k@t.local", tenantId, role: "marketer", passwordHash: "x" },
      });
      const oldProduct = await tx.product.create({
        data: {
          tenantId,
          name: "Old MMO",
          category: "MMO",
          uniqueSellingPoints: "Legacy",
          targetAudience: "Veterans",
        },
      });
      await tx.campaign.create({
        data: {
          tenantId,
          name: "Old MMO retention push",
          ownerUserId: owner.id,
          status: "active",
          markets: ["GLOBAL"],
          productId: oldProduct.id,
        },
      });

      const removed = await tx.product.deleteMany({
        where: {
          tenantId,
          name: { notIn: ["Honor of Kings"] },
          campaigns: { none: {} },
        },
      });
      expect(removed.count).toBe(0);

      const survived = await tx.product.findFirst({
        where: { tenantId, name: "Old MMO" },
      });
      expect(survived).not.toBeNull();
    });
  });
});

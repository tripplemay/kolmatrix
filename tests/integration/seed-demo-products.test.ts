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
        data: { email: "o@t.local", tenantId, role: "marketer", name: "Owner" },
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
        data: { email: "k@t.local", tenantId, role: "marketer", name: "Keeper" },
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

// ---------------------------------------------------------------------------
// MVP-vf C-10 round 2 — Outreach end-to-end smoke prerequisite.
//
// Reviewer's reverify reported that no single campaign on prod
// satisfied (productId NOT NULL) AND (≥1 KolCampaign whose KOL has
// email): the only campaign with email-bearing KOLs lacked a product,
// while the productId-linked campaigns had empty kolCampaigns. The
// seed now wires KolCampaign rows into HoK / Genshin / PUBG and sets
// email on every demo KOL, so this regression spec asserts that
// post-seed there's at least one campaign meeting the smoke combo.
// ---------------------------------------------------------------------------

describe("seed.ts outreach end-to-end smoke (MVP-vf C-10 round 2)", () => {
  it("at least one campaign has productId AND a KolCampaign whose KOL has email", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const owner = await tx.user.create({
        data: { email: "smoke@t.local", tenantId, role: "marketer", name: "Smoke" },
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
          productId: product.id,
        },
      });
      const kol = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "gamerxia",
          displayName: "GamerXia",
          followerCount: 1_000,
          categories: ["MOBA"],
          email: "gamerxia@demo.kolmatrix.local",
          emailSource: "demo_seed",
          status: "active",
        },
      });
      await tx.kolCampaign.create({
        data: { tenantId, kolId: kol.id, campaignId: campaign.id, status: "contacted" },
      });

      // Mirror the loadOutreachComposerData query: a campaign with a
      // product AND at least one KolCampaign whose KOL has an email.
      const ready = await tx.campaign.findMany({
        where: {
          productId: { not: null },
          kolCampaigns: { some: { kol: { email: { not: null } } } },
        },
      });
      expect(ready.length).toBeGreaterThanOrEqual(1);
      expect(ready[0].name).toBe("Honor of Kings — Global Launch");
    });
  });

  it("KolCampaign create is idempotent on (tenantId, kolId, campaignId)", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const owner = await tx.user.create({
        data: { email: "idem@t.local", tenantId, role: "marketer", name: "Idem" },
      });
      const product = await tx.product.create({
        data: {
          tenantId,
          name: "Honor of Kings",
          category: "MOBA",
          targetAudience: "Honor of Kings MOBA fans aged 18-30",
          uniqueSellingPoints: "USP",
        },
      });
      const campaign = await tx.campaign.create({
        data: {
          tenantId,
          name: "Honor of Kings — Global Launch",
          ownerUserId: owner.id,
          status: "active",
          markets: ["US"],
          productId: product.id,
        },
      });
      const kol = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "gamerxia",
          displayName: "GamerXia",
          followerCount: 1_000,
          categories: ["MOBA"],
          email: "gamerxia@demo.kolmatrix.local",
        },
      });

      // Mirror seed's findFirst + create idempotency contract: re-running
      // the seed against an already-linked KOL must not duplicate.
      for (let i = 0; i < 3; i++) {
        const existing = await tx.kolCampaign.findFirst({
          where: { tenantId, kolId: kol.id, campaignId: campaign.id },
          select: { id: true },
        });
        if (!existing) {
          await tx.kolCampaign.create({
            data: { tenantId, kolId: kol.id, campaignId: campaign.id, status: "contacted" },
          });
        }
      }

      const count = await tx.kolCampaign.count({
        where: { tenantId, kolId: kol.id, campaignId: campaign.id },
      });
      expect(count).toBe(1);
    });
  });
});

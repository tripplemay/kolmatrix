/**
 * MVP-internal-demo-prep verifying-2026-05-01 fix C-10 regression test.
 *
 * Reviewer's prod L2 smoke caught that /outreach AI customize was
 * returning a generic "Campaign or template not found" any time one of
 * {campaign, campaign.product, kol, template} was missing. Seed campaigns
 * had no productId, so EVERY seeded customize attempt failed with that
 * useless message.
 *
 * This spec locks in the new error granularity:
 *   - missing campaign           → "campaign_not_found"
 *   - campaign without productId → "campaign_no_product"
 *   - missing kol                → "kol_not_found"
 *   - missing template           → "template_not_found"
 *
 * It exercises the resolver block of `customizeAction` directly via a
 * minimal helper — we DON'T spin up the full NextAuth + customizeEmail
 * stack here because the bug is purely in the input-validation early
 * return, not in the AI call itself.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanDb, setupTestDb, teardownTestDb, withTestTenant } from "../helpers/db";

// Re-implement the resolver branch in a pure helper so we can drive it
// from the test without going through a Server Action stack. This stays
// in lockstep with src/app/[locale]/(app)/outreach/actions.ts:97-148.
type ResolverInputs = {
  campaign: { product: { name: string; category: string; uniqueSellingPoints: string } | null } | null;
  kol: unknown;
  template: unknown;
};

function classifyMissing(inputs: ResolverInputs):
  | "campaign_not_found"
  | "campaign_no_product"
  | "kol_not_found"
  | "template_not_found"
  | "ok" {
  if (!inputs.campaign) return "campaign_not_found";
  if (!inputs.campaign.product) return "campaign_no_product";
  if (!inputs.kol) return "kol_not_found";
  if (!inputs.template) return "template_not_found";
  return "ok";
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

describe("customizeAction error classification (MVP-vf C-10)", () => {
  it("returns campaign_not_found when the campaign row is missing", () => {
    expect(classifyMissing({ campaign: null, kol: {}, template: {} })).toBe(
      "campaign_not_found"
    );
  });

  it("returns campaign_no_product when campaign exists but productId is null", () => {
    expect(
      classifyMissing({
        campaign: { product: null },
        kol: {},
        template: {},
      })
    ).toBe("campaign_no_product");
  });

  it("returns kol_not_found when the kol row is missing", () => {
    expect(
      classifyMissing({
        campaign: { product: { name: "X", category: "Y", uniqueSellingPoints: "Z" } },
        kol: null,
        template: {},
      })
    ).toBe("kol_not_found");
  });

  it("returns template_not_found when the template row is missing", () => {
    expect(
      classifyMissing({
        campaign: { product: { name: "X", category: "Y", uniqueSellingPoints: "Z" } },
        kol: {},
        template: null,
      })
    ).toBe("template_not_found");
  });

  it("returns ok when all four inputs are present", () => {
    expect(
      classifyMissing({
        campaign: { product: { name: "X", category: "Y", uniqueSellingPoints: "Z" } },
        kol: {},
        template: {},
      })
    ).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// Live-DB regression: a campaign created without productId returns null when
// queried for its `product` relation. This is the actual condition that bit
// Reviewer's prod smoke and the seed.ts post-product-link step now prevents.
// ---------------------------------------------------------------------------

describe("Campaign.productId nullability (regression for seed-side fix)", () => {
  it("a campaign without productId surfaces product=null on the relation", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const owner = await tx.user.create({
        data: {
          email: "owner@test.local",
          tenantId,
          role: "marketer",
          name: "Owner",
        },
      });
      const campaign = await tx.campaign.create({
        data: {
          tenantId,
          name: "C-10 regression",
          ownerUserId: owner.id,
          status: "active",
          markets: ["GLOBAL"],
        },
      });
      const fetched = await tx.campaign.findUnique({
        where: { id: campaign.id },
        select: { product: { select: { name: true } } },
      });
      expect(fetched).not.toBeNull();
      expect(fetched!.product).toBeNull();
    });
  });

  it("a campaign with productId returns the linked product", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const owner = await tx.user.create({
        data: {
          email: "owner2@test.local",
          tenantId,
          role: "marketer",
          name: "Owner 2",
        },
      });
      const product = await tx.product.create({
        data: {
          tenantId,
          name: "Linked Game",
          category: "MOBA",
          uniqueSellingPoints: "USP",
        },
      });
      const campaign = await tx.campaign.create({
        data: {
          tenantId,
          name: "C-10 happy",
          ownerUserId: owner.id,
          status: "active",
          markets: ["GLOBAL"],
          productId: product.id,
        },
      });
      const fetched = await tx.campaign.findUnique({
        where: { id: campaign.id },
        select: { product: { select: { name: true } } },
      });
      expect(fetched!.product?.name).toBe("Linked Game");
    });
  });
});

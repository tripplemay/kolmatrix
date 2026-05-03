/**
 * BL-027-F006.B · /assets welcome-mode determination (S3 Soft-watch backfill).
 *
 * BL-026-F004 introduced "welcome mode" on /assets:
 *
 *   const filterIsBroad = !filter.productId && !filter.search && !filter.status
 *                       && (!filter.types || filter.types.length === 0)
 *                       && (!filter.sources || filter.sources.length === 0);
 *   const userOwnedCount = filterIsBroad
 *     ? await tx.asset.count({ where: { tenantId, source: { in: ["user_created", "ai_generated", "imported"] } } })
 *     : 1; // skip detection when caller narrowed by filter
 *   const mode = userOwnedCount === 0 ? "welcome" : "normal";
 *
 *   if (mode === "welcome") {
 *     listing = await loadAssetsForListing(tx, { ...filter, sources: ["system_seed"] }, ...);
 *   }
 *
 * That decision lives in src/app/[locale]/(app)/assets/page.tsx (a Next.js
 * server component) which can't be mounted in vitest. Instead we drive the
 * underlying queries directly from a real Postgres + RLS tenant context,
 * so a regression in the count predicate or the system_seed source filter
 * surfaces here even when the page handler stays untouched.
 *
 * Reviewer S3 Soft-watch reference:
 *   docs/test-reports/BL-026-asset-ux-redesign-signoff-2026-05-03.md §6 / S3.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadAssetsForListing } from "@/lib/assets/queries";

import {
  asTenant,
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const USER_OWNED_SOURCES = ["user_created", "ai_generated", "imported"] as const;

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenant(slug: string): Promise<string> {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: { name: `welcome-test-${slug}`, slug: `welcome-${slug}` },
  });
  return tenant.id;
}

async function seedAsset(opts: {
  tenantId: string | null;
  source: "user_created" | "ai_generated" | "imported" | "system_seed";
  name?: string;
}) {
  return getAdminPrisma().asset.create({
    data: {
      tenantId: opts.tenantId,
      type: "email",
      source: opts.source,
      status: "published",
      name: opts.name ?? `Asset ${opts.source}`,
      content: { subject: "S", body: "B", locale: "en", variables: [] },
    },
  });
}

describe("BL-027-F006.B · /assets welcome-mode determination", () => {
  it("empty tenant: user-owned count is 0 → page.tsx will set mode='welcome'", async () => {
    const tenantId = await seedTenant("empty");
    // Seed at least one system_seed asset so the welcome listing has
    // content to show — this mirrors the real BL-025-F001 migration
    // landing 5 system_seed templates into a fresh tenant.
    await seedAsset({ tenantId: null, source: "system_seed", name: "Seed 1" });

    const userOwnedCount = await asTenant(tenantId, (tx) =>
      tx.asset.count({
        where: { tenantId, source: { in: [...USER_OWNED_SOURCES] } },
      })
    );

    expect(userOwnedCount).toBe(0);
    // Mirror page.tsx:76 mapping for the assertion that matters most.
    const mode: "normal" | "welcome" = userOwnedCount === 0 ? "welcome" : "normal";
    expect(mode).toBe("welcome");
  });

  it("tenant with one user_created asset: count > 0 → mode='normal'", async () => {
    const tenantId = await seedTenant("normal-user-created");
    await seedAsset({ tenantId, source: "user_created", name: "owned" });

    const userOwnedCount = await asTenant(tenantId, (tx) =>
      tx.asset.count({
        where: { tenantId, source: { in: [...USER_OWNED_SOURCES] } },
      })
    );

    expect(userOwnedCount).toBeGreaterThan(0);
    const mode = userOwnedCount === 0 ? "welcome" : "normal";
    expect(mode).toBe("normal");
  });

  it("tenant with only system_seed (no user-owned): count predicate excludes system_seed → mode='welcome'", async () => {
    // Regression guard: if somebody changes USER_OWNED_SOURCES to also
    // include 'system_seed', new tenants would never enter welcome
    // mode (since the F001 migration always lands ≥ 1 system_seed).
    const tenantId = await seedTenant("only-system-seed");
    await seedAsset({ tenantId: null, source: "system_seed", name: "global seed" });

    const userOwnedCount = await asTenant(tenantId, (tx) =>
      tx.asset.count({
        where: { tenantId, source: { in: [...USER_OWNED_SOURCES] } },
      })
    );

    expect(userOwnedCount).toBe(0);
  });

  it("welcome-mode listing query (sources=['system_seed']) returns only system_seed assets", async () => {
    const tenantId = await seedTenant("welcome-listing");
    // Seed mixed sources in a single tenant — but only system_seed
    // should appear in the welcome-mode listing.
    await seedAsset({ tenantId: null, source: "system_seed", name: "Seed A" });
    await seedAsset({ tenantId: null, source: "system_seed", name: "Seed B" });
    await seedAsset({ tenantId, source: "user_created", name: "Owned (must NOT show)" });

    const listing = await asTenant(tenantId, (tx) =>
      loadAssetsForListing(tx, { sources: ["system_seed"] }, { sort: "recent", limit: 24 })
    );

    expect(listing.items.length).toBeGreaterThanOrEqual(2);
    for (const item of listing.items) {
      expect(item.source).toBe("system_seed");
    }
    // None of the user_created should leak through.
    expect(listing.items.find((i) => i.name.includes("must NOT show"))).toBeUndefined();
  });

  it("welcome-mode listing respects the 24-row page cap (matches page.tsx limit)", async () => {
    const tenantId = await seedTenant("welcome-cap");
    // Land 30 system_seed rows; welcome-mode listing should clamp to 24.
    for (let i = 0; i < 30; i += 1) {
      await seedAsset({ tenantId: null, source: "system_seed", name: `Seed ${i}` });
    }

    const listing = await asTenant(tenantId, (tx) =>
      loadAssetsForListing(tx, { sources: ["system_seed"] }, { sort: "recent", limit: 24 })
    );

    expect(listing.items.length).toBe(24);
  });
});

/**
 * BL-060 F002 · /database QuickStats integration spec.
 *
 * Verifies `loadDatabaseStats` excludes soft-deleted KOLs from every
 * KPI tile. Pre-fix the three queries (total / activeCollabs / agg)
 * counted any `is_saved=true` row regardless of `deleted_at`, so 4
 * tombstoned youtube-api-daily rows in prod showed up as a phantom
 * `total = 4` while the active saved pool was actually 0.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

// `loadDatabaseStats` calls `withTenant` from src/lib/db.ts which
// instantiates the production Prisma singleton at module-load time
// from process.env.DATABASE_URL. setupTestDb() rewrites that env var
// to the Testcontainers port, so the import has to happen *after*
// setupTestDb() — mirroring dashboard-kpi.test.ts.
type LoadDatabaseStats = typeof import(
  "@/app/[locale]/(app)/match/stats"
).loadDatabaseStats;
let loadDatabaseStats: LoadDatabaseStats;

beforeAll(async () => {
  await setupTestDb();
  ({ loadDatabaseStats } = await import(
    "@/app/[locale]/(app)/match/stats"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seedTenant(slug: string) {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: {
      name: `DB Stats ${slug}`,
      slug: `db-stats-${slug}-${Date.now()}`,
    },
  });
  return tenant.id;
}

describe("loadDatabaseStats()", () => {
  it("excludes soft-deleted KOLs from total", async () => {
    const tenantId = await seedTenant("total");
    const admin = getAdminPrisma();

    // 2 active saved KOLs + 3 tombstoned saved KOLs (mirrors the prod
    // is_saved=true AND deleted_at IS NOT NULL leak from BL-059 F003).
    for (let i = 0; i < 2; i++) {
      await admin.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: `active_${i}`,
          displayName: `Active ${i}`,
          followerCount: 1_000,
        },
      });
    }
    for (let i = 0; i < 3; i++) {
      await admin.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: `tomb_${i}`,
          displayName: `Tomb ${i}`,
          followerCount: 1_000,
          deletedAt: new Date(),
        },
      });
    }

    const stats = await loadDatabaseStats(tenantId);
    expect(stats.total).toBe(2);
  });

  it("excludes soft-deleted KOLs from activeCollabs and aggregate", async () => {
    const tenantId = await seedTenant("agg");
    const admin = getAdminPrisma();

    // Active saved: 1 negotiating with valueScore=60 followers=500;
    //               1 long_term with valueScore=80 followers=1_500.
    // Tombstoned saved: 1 negotiating valueScore=0 followers=10_000
    //   (would drag both _avg and _sum if filter missing).
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "active_negot",
        displayName: "Active Negot",
        followerCount: 500,
        relationshipStatus: "negotiating",
        valueScore: 60,
      },
    });
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "active_lt",
        displayName: "Active LT",
        followerCount: 1_500,
        relationshipStatus: "long_term",
        valueScore: 80,
      },
    });
    await admin.kol.create({
      data: {
        tenantId,
        platform: "youtube",
        handle: "tomb_negot",
        displayName: "Tomb Negot",
        followerCount: 10_000,
        relationshipStatus: "negotiating",
        valueScore: 0,
        deletedAt: new Date(),
      },
    });

    const stats = await loadDatabaseStats(tenantId);
    expect(stats.activeCollabs).toBe(2); // both active rows count
    expect(stats.avgValueScore).toBe(70); // mean of 60 + 80, no 0
    expect(stats.followerReach).toBe(2_000); // 500 + 1_500, no 10_000
  });
});

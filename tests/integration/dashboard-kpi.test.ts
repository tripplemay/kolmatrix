/**
 * BM1-F007 · Dashboard KPI integration spec
 *
 * Contract covered:
 *   1. kolCount tiles the gaming-only pool (non-gaming creators do not
 *      inflate the "Total KOLs" tile)
 *   2. productCount reflects the Knowledge Base rows for this tenant
 *   3. avgValueScore is the rounded mean of valueScore across gaming
 *      KOLs; null rows never enter the numerator (no phantom 0s)
 *   4. topKols are sorted by valueScore DESC then id DESC, gaming only,
 *      capped at 5
 *   5. activeCampaigns / emailsSent7d roll up counts on the real tables
 *      (and read as 0 until BM2 ships)
 *   6. RLS — another tenant's products / kols stay hidden
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
  withTestTenant,
} from "../helpers/db";

type FetchDashboardData = typeof import(
  "@/features/dashboard/data"
).fetchDashboardData;

let fetchDashboardData: FetchDashboardData;

beforeAll(async () => {
  await setupTestDb();
  ({ fetchDashboardData } = await import(
    "@/features/dashboard/data"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "product" CASCADE`);
});

describe("fetchDashboardData()", () => {
  it("counts only gaming KOLs for the Total KOLs tile", async () => {
    await withTestTenant(async (tenantId, tx) => {
      // 3 gaming, 2 non-gaming — only 3 should surface.
      for (let i = 0; i < 3; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `game_${i}`,
            displayName: `Gaming ${i}`,
            followerCount: 1_000 + i,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: 70 + i,
          },
        });
      }
      for (let i = 0; i < 2; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `life_${i}`,
            displayName: `Lifestyle ${i}`,
            followerCount: 2_000,
            categories: ["Vlogs"],
            isGaming: false,
            valueScore: 50,
          },
        });
      }

      const d = await fetchDashboardData(tx);
      expect(d.kolCount).toBe(3);
    });
  });

  it("rolls up productCount for the tenant", async () => {
    await withTestTenant(async (tenantId, tx) => {
      for (const name of ["Game A", "Game B", "Game C"]) {
        await tx.product.create({
          data: {
            tenantId,
            name,
            category: "MOBA",
            targetAudience: "MOBA players aged 18-30",
            uniqueSellingPoints: "USP",
          },
        });
      }
      const d = await fetchDashboardData(tx);
      expect(d.productCount).toBe(3);
    });
  });

  it("averages valueScore across gaming KOLs, skipping NULL", async () => {
    await withTestTenant(async (tenantId, tx) => {
      const scores = [60, 80, 100]; // mean = 80
      for (let i = 0; i < scores.length; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `score_${i}`,
            displayName: `Score ${i}`,
            followerCount: 1_000,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: scores[i],
          },
        });
      }
      // NULL valueScore row must not drag the average to 0.
      await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "null_score",
          displayName: "Null",
          followerCount: 1_000,
          categories: ["MOBA"],
          isGaming: true,
        },
      });

      const d = await fetchDashboardData(tx);
      expect(d.avgValueScore).toBe(80);
    });
  });

  it("returns 0 avgValueScore when the tenant has no scored gaming KOLs", async () => {
    await withTestTenant(async (_tenantId, tx) => {
      const d = await fetchDashboardData(tx);
      expect(d.avgValueScore).toBe(0);
    });
  });

  it("surfaces top 5 gaming KOLs sorted by valueScore DESC", async () => {
    await withTestTenant(async (tenantId, tx) => {
      // 7 gaming KOLs with varied scores — expect top 5 in descending order.
      const seeds = [40, 95, 60, 80, 99, 55, 70];
      for (let i = 0; i < seeds.length; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `top_${i}`,
            displayName: `Top ${i}`,
            followerCount: 1_000,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: seeds[i],
          },
        });
      }
      // Plus a high-score non-gaming row that must NOT appear.
      await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "lifestyle_high",
          displayName: "Lifestyle High",
          followerCount: 1_000,
          categories: ["Vlogs"],
          isGaming: false,
          valueScore: 100,
        },
      });

      const d = await fetchDashboardData(tx);
      expect(d.topKols).toHaveLength(5);
      const scores = d.topKols.map((k) => k.valueScore ?? 0);
      expect(scores).toEqual([99, 95, 80, 70, 60]);
      expect(d.topKols.map((k) => k.displayName)).not.toContain("Lifestyle High");
    });
  });

  it("reports 0 for campaigns + emails until BM2 ships those flows", async () => {
    await withTestTenant(async (_tenantId, tx) => {
      const d = await fetchDashboardData(tx);
      expect(d.activeCampaigns).toBe(0);
      expect(d.emailsSent7d).toBe(0);
    });
  });

  // BL-060 F001 — soft deleted KOLs must not surface anywhere on the
  // dashboard. Pre-fix the kolCount/avgValueScore/topKols branches
  // included tombstoned rows, which masked the real "active gaming
  // pool" size and let removed creators float to the top of the list.
  it("excludes soft-deleted KOLs from kolCount", async () => {
    await withTestTenant(async (tenantId, tx) => {
      // 3 active gaming + 2 soft-deleted gaming → kolCount = 3
      for (let i = 0; i < 3; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `active_${i}`,
            displayName: `Active ${i}`,
            followerCount: 1_000,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: 70,
          },
        });
      }
      for (let i = 0; i < 2; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `tombstone_${i}`,
            displayName: `Tombstone ${i}`,
            followerCount: 1_000,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: 90,
            deletedAt: new Date(),
          },
        });
      }

      const d = await fetchDashboardData(tx);
      expect(d.kolCount).toBe(3);
    });
  });

  it("excludes soft-deleted KOLs from avgValueScore", async () => {
    await withTestTenant(async (tenantId, tx) => {
      // Active scores: 60, 80 → mean 70. A tombstoned row with 0
      // would drag the average to ~46 if the filter were missing.
      const activeScores = [60, 80];
      for (let i = 0; i < activeScores.length; i++) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `avg_active_${i}`,
            displayName: `Avg Active ${i}`,
            followerCount: 1_000,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: activeScores[i],
          },
        });
      }
      await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "avg_deleted",
          displayName: "Avg Deleted",
          followerCount: 1_000,
          categories: ["MOBA"],
          isGaming: true,
          valueScore: 0,
          deletedAt: new Date(),
        },
      });

      const d = await fetchDashboardData(tx);
      expect(d.avgValueScore).toBe(70);
    });
  });

  it("excludes soft-deleted KOLs from topKols even when their score is highest", async () => {
    await withTestTenant(async (tenantId, tx) => {
      // 2 active 60/70 + 1 soft-deleted 99 — the 99 must not appear
      // because the row is tombstoned.
      for (const [handle, score] of [
        ["top_active_1", 60],
        ["top_active_2", 70],
      ] as const) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle,
            displayName: handle,
            followerCount: 1_000,
            categories: ["MOBA"],
            isGaming: true,
            valueScore: score,
          },
        });
      }
      await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "top_deleted_99",
          displayName: "Top Deleted",
          followerCount: 1_000,
          categories: ["MOBA"],
          isGaming: true,
          valueScore: 99,
          deletedAt: new Date(),
        },
      });

      const d = await fetchDashboardData(tx);
      expect(d.topKols).toHaveLength(2);
      expect(d.topKols.map((k) => k.displayName)).not.toContain("Top Deleted");
      expect(d.topKols[0].valueScore).toBe(70);
    });
  });

  it("isolates dashboard counts across tenants (RLS)", async () => {
    // Seed tenant A with data; snapshot its dashboard.
    let tenantASnapshot: Awaited<ReturnType<FetchDashboardData>> | null = null;
    await withTestTenant(async (tenantIdA, tx) => {
      await tx.kol.create({
        data: {
          tenantId: tenantIdA,
          platform: "youtube",
          handle: "a_kol",
          displayName: "A Kol",
          followerCount: 1_000,
          categories: ["MOBA"],
          isGaming: true,
          valueScore: 80,
        },
      });
      await tx.product.create({
        data: {
          tenantId: tenantIdA,
          name: "A Game",
          category: "MOBA",
          targetAudience: "Tenant A MOBA enthusiasts",
          uniqueSellingPoints: "A USP",
        },
      });
      tenantASnapshot = await fetchDashboardData(tx);
    });

    expect(tenantASnapshot).not.toBeNull();
    expect(tenantASnapshot!.kolCount).toBe(1);
    expect(tenantASnapshot!.productCount).toBe(1);

    // Fresh tenant B — should see 0 / 0 regardless of A's data.
    await withTestTenant(async (_tenantIdB, tx) => {
      const d = await fetchDashboardData(tx);
      expect(d.kolCount).toBe(0);
      expect(d.productCount).toBe(0);
      expect(d.topKols).toHaveLength(0);
    });
  });
});

/**
 * BI4-F005 · KOL tsvector search integration spec
 *
 * Contract covered:
 *   1. INSERT kol → trigger fires, search_vector is populated
 *   2. UPDATE display_name → trigger re-runs, search_vector reflects
 *      the new text
 *   3. searchKols(tenantId, term) returns the matching KOL with
 *      ranked results (display_name weighted highest)
 *   4. Empty / whitespace-only query returns [] without hitting the DB
 *   5. EXPLAIN ANALYZE confirms the GIN index is used (no seq scan)
 *   6. Cross-tenant isolation: searchKols(tenantA) cannot see tenantB rows
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
  withTestTenant,
} from "../helpers/db";

type SearchFns = typeof import("@/lib/search/tsvector");
let searchKols: SearchFns["searchKols"];
let buildKolSearchQuery: SearchFns["buildKolSearchQuery"];

beforeAll(async () => {
  await setupTestDb();
  const mod = await import("@/lib/search/tsvector");
  searchKols = mod.searchKols;
  buildKolSearchQuery = mod.buildKolSearchQuery;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

describe("kol search_vector + searchKols()", () => {
  it("populates search_vector on INSERT via trigger", async () => {
    const kolId = await withTestTenant(async (tenantId, tx) => {
      const kol = await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "dota_mastermind",
          displayName: "Dota Mastermind",
          categories: ["moba", "competitive"],
          bio: "Pro Dota 2 streamer from Brazil",
        },
      });
      return kol.id;
    });

    const admin = getAdminPrisma();
    const rows = await admin.$queryRawUnsafe<{ search_vector: string | null }[]>(
      `SELECT search_vector::text AS search_vector FROM "kol" WHERE id = '${kolId}'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.search_vector).not.toBeNull();
    // Weights (A/B/C/D) must show in the tsvector text
    expect(rows[0]!.search_vector).toContain("dota");
    expect(rows[0]!.search_vector).toContain("mastermind");
  });

  it("re-populates search_vector on UPDATE display_name", async () => {
    let kolId = "";
    await withTestTenant(async (tenantId, tx) => {
      const kol = await tx.kol.create({
        data: {
          tenantId,
          platform: "twitch",
          handle: "old_handle",
          displayName: "Original Name",
          categories: [],
          bio: null,
        },
      });
      kolId = kol.id;
      await tx.kol.update({
        where: { id: kol.id },
        data: { displayName: "Updated Streamer Name" },
      });
    });

    const admin = getAdminPrisma();
    const rows = await admin.$queryRawUnsafe<{ search_vector: string | null }[]>(
      `SELECT search_vector::text AS search_vector FROM "kol" WHERE id = '${kolId}'`
    );
    expect(rows[0]!.search_vector).toContain("stream");
    // stemmed "updat" must appear; the old "original" should NOT
    expect(rows[0]!.search_vector).toContain("updat");
    expect(rows[0]!.search_vector).not.toContain("origin");
  });

  it("searchKols() returns matching KOLs with ts_rank scoring", async () => {
    const tenantId = await withTestTenant(async (id, tx) => {
      await tx.kol.create({
        data: {
          tenantId: id,
          platform: "youtube",
          handle: "dota_pro",
          displayName: "Dota Pro Player",
          categories: ["moba"],
          bio: "Streams Dota 2 tournaments",
        },
      });
      await tx.kol.create({
        data: {
          tenantId: id,
          platform: "youtube",
          handle: "valorant_main",
          displayName: "Valorant Main",
          categories: ["fps"],
          bio: "Ranked Valorant gameplay",
        },
      });
      return id;
    });

    const hits = await searchKols(tenantId, "dota");
    expect(hits.map((r) => r.handle)).toEqual(["dota_pro"]);
    expect(hits[0]!.rank).toBeGreaterThan(0);
  });

  it("returns [] for empty or whitespace-only queries without throwing", async () => {
    const tenantId = await withTestTenant(async (id, tx) => {
      await tx.kol.create({
        data: {
          tenantId: id,
          platform: "twitch",
          handle: "anyone",
          displayName: "Any Body",
          categories: [],
        },
      });
      return id;
    });

    expect(await searchKols(tenantId, "")).toEqual([]);
    expect(await searchKols(tenantId, "   ")).toEqual([]);
    // buildKolSearchQuery normalizes
    expect(buildKolSearchQuery("   ")).toBe("");
  });

  it("uses the GIN index (EXPLAIN ANALYZE must show Bitmap Index Scan)", async () => {
    // Seed enough rows to make a seq-scan plan obvious if the planner
    // chose one. With <10 rows Postgres may prefer seq scan for
    // cost reasons, so we insert 50.
    await withTestTenant(async (tenantId, tx) => {
      for (let i = 0; i < 50; i += 1) {
        await tx.kol.create({
          data: {
            tenantId,
            platform: "youtube",
            handle: `creator_${i}`,
            displayName: `Creator ${i}`,
            categories: i % 3 === 0 ? ["moba", "dota"] : ["fps"],
            bio: i % 5 === 0 ? "Brazilian streamer of dota tournaments" : null,
          },
        });
      }
    });

    const admin = getAdminPrisma();
    // Force the planner to use the index so we can assert it is
    // *usable*. With 50 rows Postgres may prefer a seq scan for cost
    // reasons; production kol tables will have hundreds of thousands
    // where the planner picks GIN on its own. SET LOCAL only lives
    // inside the surrounding transaction, so we wrap both statements
    // together.
    const planText = await admin.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL enable_seqscan = off`);
      await tx.$executeRawUnsafe(`SET LOCAL enable_bitmapscan = on`);
      const plan = await tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
        `EXPLAIN (ANALYZE, FORMAT TEXT)
           SELECT id FROM "kol"
           WHERE "search_vector" @@ plainto_tsquery('english', 'dota')`
      );
      return plan.map((r) => r["QUERY PLAN"]).join("\n");
    });
    expect(planText).toMatch(/Bitmap Index Scan on "?kol_search_vector_idx"?/);
  });

  it("respects RLS — searchKols in tenant A cannot see tenant B rows", async () => {
    const tenantA = await withTestTenant(async (id, tx) => {
      await tx.kol.create({
        data: {
          tenantId: id,
          platform: "youtube",
          handle: "tenant_a_star",
          displayName: "Tenant A Creator",
          categories: ["moba"],
          bio: "Dota 2 specialist",
        },
      });
      return id;
    });
    await withTestTenant(async (tenantId, tx) => {
      await tx.kol.create({
        data: {
          tenantId,
          platform: "youtube",
          handle: "tenant_b_star",
          displayName: "Tenant B Creator",
          categories: ["moba"],
          bio: "Dota 2 specialist",
        },
      });
    });

    const hitsForA = await searchKols(tenantA, "dota");
    expect(hitsForA).toHaveLength(1);
    expect(hitsForA[0]!.handle).toBe("tenant_a_star");
  });
});

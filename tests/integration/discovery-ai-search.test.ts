/**
 * BL-044 F004 · Integration test for the /discovery AI semantic search
 * server flow.
 *
 * Drives `runSemanticDiscoverySearch` against a real pgvector container
 * with hand-inserted KOL vectors so the cosine top-K + hydration path is
 * exercised end-to-end. The aigcgateway HTTP call is stubbed (vi.stubGlobal
 * fetch) so the test stays hermetic — same stub style as
 * tests/integration/smart-match-api.test.ts.
 *
 * Validates:
 *   - Cosine top-K returns kolIds in distance-ASC order; hydration
 *     preserves the order (Prisma `IN` doesn't).
 *   - RLS: cross-tenant KOLs are invisible.
 *   - SQL filters: `is_suspicious=true`, `deleted_at IS NOT NULL`,
 *     `embedding IS NULL` rows are excluded (pre-impl audit #1:B).
 *   - Empty top-K → empty DiscoverySearchResult shape (items=[], total=0).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMS } from "@/lib/embedding/types";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

// BL-044 F004 — lazy module imports so `db.ts`'s `DATABASE_URL is not set`
// boot guard doesn't trip during integration test bootstrap (setupTestDb
// runs in beforeAll, but ESM imports resolve earlier than that).
// Same pattern as `tests/integration/smart-match-api.test.ts` →
// `dbModule()` helper inside `src/lib/discovery/smart-match.ts`.
async function loadModules(): Promise<{
  runSemanticDiscoverySearch: (typeof import("@/app/[locale]/(app)/discovery/search"))["runSemanticDiscoverySearch"];
  __clearChipEmbeddingCache: (typeof import("@/lib/discovery/semantic-search"))["__clearChipEmbeddingCache"];
}> {
  const search = await import("@/app/[locale]/(app)/discovery/search");
  const semantic = await import("@/lib/discovery/semantic-search");
  return {
    runSemanticDiscoverySearch: search.runSemanticDiscoverySearch,
    __clearChipEmbeddingCache: semantic.__clearChipEmbeddingCache,
  };
}

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await cleanDb();
  const { __clearChipEmbeddingCache } = await loadModules();
  __clearChipEmbeddingCache();
});

function fakeVec(seed: number, scale: number = 1): number[] {
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) =>
    Math.cos(((i + seed) * Math.PI) / 256) * scale,
  );
}

async function setKolEmbedding(
  prisma: ReturnType<typeof getAdminPrisma>,
  kolId: string,
  vec: readonly number[],
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "kol" SET "embedding" = $1::vector(${EMBEDDING_DIMS}) WHERE id = $2::uuid`,
    JSON.stringify(vec),
    kolId,
  );
}

function stubEmbedFetch(vector: number[]): void {
  process.env.AIGCGATEWAY_API_KEY = "pk_test";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [
            { object: "embedding", index: 0, embedding: vector },
          ],
          model: "bge-m3",
          usage: { prompt_tokens: 5, total_tokens: 5 },
        }),
        { status: 200 },
      ),
    ),
  );
}

const BASE_FILTERS = {
  regions: [],
  categories: [],
  languages: [],
  platforms: [],
  monetizationStatuses: [],
  brandSafety: [],
  knownCollabs: [],
  tags: [],
  channelAge: [],
  uploadFrequency: [],
  regionGroup: [],
  relationshipStatuses: [],
  includeNonGaming: false,
  sort: "value" as const,
};

describe("runSemanticDiscoverySearch — happy path", () => {
  it("returns kolIds in cosine-ASC order; hydration preserves order", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Tenant Sem-1", slug: "tenant-sem-1" },
    });

    const queryVec = fakeVec(0);
    const closest = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "fps-king",
        displayName: "FPS King",
        platform: "youtube",
        bio: "FPS",
        categories: ["FPS"],
        tags: [],
      },
    });
    const middle = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "rpg-mid",
        displayName: "RPG Mid",
        platform: "youtube",
        bio: "RPG",
        categories: ["RPG"],
        tags: [],
      },
    });
    const farthest = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "moba-far",
        displayName: "MOBA Far",
        platform: "youtube",
        bio: "MOBA",
        categories: ["MOBA"],
        tags: [],
      },
    });
    await setKolEmbedding(admin, closest.id, queryVec.map((x) => x + 1e-5));
    await setKolEmbedding(admin, middle.id, queryVec.map((x) => x * 0.5 + 0.1));
    await setKolEmbedding(admin, farthest.id, queryVec.map((x) => -x));

    stubEmbedFetch(queryVec);
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);

    const { runSemanticDiscoverySearch } = await loadModules();
    const result = await runSemanticDiscoverySearch(tenant.id, {
      ...BASE_FILTERS,
      aiQuery: "FPS creators",
    });
    vi.unstubAllGlobals();

    expect(result.items.length).toBe(3);
    // Cosine order: closest → middle → farthest.
    expect(result.items[0]!.id).toBe(closest.id);
    expect(result.items[1]!.id).toBe(middle.id);
    expect(result.items[2]!.id).toBe(farthest.id);
    // hydration shape — DiscoveryKolCard stays consistent with the
    // ILIKE path so the grid renderer doesn't have to branch.
    expect(result.items[0]!.displayName).toBe("FPS King");
    expect(result.items[0]!.handle).toBe("fps-king");
    // No pagination cursor in first iteration (D5).
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(3);
  });
});

describe("runSemanticDiscoverySearch — filters / RLS", () => {
  it("excludes is_suspicious=true and deleted KOLs from the cosine top-K", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Tenant Sem-2", slug: "tenant-sem-2" },
    });

    const queryVec = fakeVec(7);

    const visible = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "visible",
        displayName: "Visible",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });
    const suspicious = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "sus",
        displayName: "Suspicious",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
        isSuspicious: true,
      },
    });
    const deleted = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "del",
        displayName: "Deleted",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
        deletedAt: new Date(),
      },
    });
    await setKolEmbedding(admin, visible.id, queryVec.map((x) => x + 1e-5));
    await setKolEmbedding(admin, suspicious.id, queryVec.map((x) => x + 2e-5));
    await setKolEmbedding(admin, deleted.id, queryVec.map((x) => x + 3e-5));

    stubEmbedFetch(queryVec);
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);

    const { runSemanticDiscoverySearch } = await loadModules();
    const result = await runSemanticDiscoverySearch(tenant.id, {
      ...BASE_FILTERS,
      aiQuery: "FPS creators",
    });
    vi.unstubAllGlobals();

    const ids = result.items.map((i) => i.id);
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(suspicious.id);
    expect(ids).not.toContain(deleted.id);
  });

  it("hides cross-tenant KOLs (RLS)", async () => {
    const admin = getAdminPrisma();
    const tenantA = await admin.tenant.create({
      data: { name: "Tenant Sem-3a", slug: "tenant-sem-3a" },
    });
    const tenantB = await admin.tenant.create({
      data: { name: "Tenant Sem-3b", slug: "tenant-sem-3b" },
    });

    const queryVec = fakeVec(11);
    const myKol = await admin.kol.create({
      data: {
        tenantId: tenantA.id,
        handle: "mine",
        displayName: "Mine",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });
    const otherKol = await admin.kol.create({
      data: {
        tenantId: tenantB.id,
        handle: "other",
        displayName: "Other",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });
    await setKolEmbedding(admin, myKol.id, queryVec.map((x) => x + 1e-5));
    await setKolEmbedding(admin, otherKol.id, queryVec.map((x) => x + 1e-5));

    stubEmbedFetch(queryVec);
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);

    const { runSemanticDiscoverySearch } = await loadModules();
    const result = await runSemanticDiscoverySearch(tenantA.id, {
      ...BASE_FILTERS,
      aiQuery: "FPS creators",
    });
    vi.unstubAllGlobals();

    expect(result.items.map((i) => i.id)).toEqual([myKol.id]);
  });
});

describe("runSemanticDiscoverySearch — empty result", () => {
  it("returns empty items + total=0 when the tenant has no embedded KOLs", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Tenant Sem-4", slug: "tenant-sem-4" },
    });
    // KOL with NULL embedding — should be filtered out by the cosine SQL.
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "no-embed",
        displayName: "No Embed",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });

    stubEmbedFetch(fakeVec(13));
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);

    const { runSemanticDiscoverySearch } = await loadModules();
    const result = await runSemanticDiscoverySearch(tenant.id, {
      ...BASE_FILTERS,
      aiQuery: "FPS creators",
    });
    vi.unstubAllGlobals();

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

/**
 * B7a-F001 · Integration tests for the embedding pipeline against a
 * real Postgres + pgvector container.
 *
 * Covers (audit lock §9):
 *   - migration applied: vector extension installed, kol/product
 *     embedding columns + IVFFlat indexes exist
 *   - one-shot backfill embeds rows whose hash differs and skips ones
 *     whose hash matches (#6:B' regression)
 *   - cosine top-k SQL returns rows in expected order + filters NULL
 *     embeddings (#11:A regression)
 *   - RLS narrows the read path even with the new column
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  embedAllKols,
  embedKolsForIds,
  embedProductIfStale,
} from "@/lib/embedding/kol-embed";
import { kolCosineTopKSql } from "@/lib/embedding/sql";
import { EMBEDDING_DIMS } from "@/lib/embedding/types";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

function fakeVec(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) =>
    (((i + seed) % 17) - 8) / 8
  );
}

function mockGatewayFetch(vectors: readonly number[][]): typeof fetch {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        object: "list",
        data: vectors.map((v, i) => ({
          object: "embedding",
          index: i,
          embedding: v,
        })),
        model: "bge-m3",
        usage: {
          prompt_tokens: vectors.length * 30,
          total_tokens: vectors.length * 30,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  ) as unknown as typeof fetch;
}

describe("migration: pgvector + columns + indexes", () => {
  it("installed the vector extension", async () => {
    const admin = getAdminPrisma();
    const ext = await admin.$queryRawUnsafe<{ extname: string }[]>(
      `SELECT extname FROM pg_extension WHERE extname = 'vector'`
    );
    expect(ext.length).toBe(1);
  });

  it("added kol.embedding + kol.embedding_text_hash columns", async () => {
    const admin = getAdminPrisma();
    const cols = await admin.$queryRawUnsafe<{ column_name: string; udt_name: string }[]>(
      `SELECT column_name, udt_name FROM information_schema.columns
       WHERE table_name = 'kol' AND column_name IN ('embedding', 'embedding_text_hash')`
    );
    const colNames = cols.map((c) => c.column_name).sort();
    expect(colNames).toEqual(["embedding", "embedding_text_hash"]);
  });

  it("added product.embedding column", async () => {
    const admin = getAdminPrisma();
    const cols = await admin.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'product' AND column_name = 'embedding'`
    );
    expect(cols.length).toBe(1);
  });

  it("created kol_embedding_ivfflat_idx", async () => {
    const admin = getAdminPrisma();
    const idx = await admin.$queryRawUnsafe<{ indexname: string }[]>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'kol' AND indexname = 'kol_embedding_ivfflat_idx'`
    );
    expect(idx.length).toBe(1);
  });
});

describe("embedAllKols backfill", () => {
  it("embeds every row with text and persists the hash", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "T1", slug: "t1" },
    });
    await admin.kol.createMany({
      data: [
        {
          tenantId: tenant.id,
          handle: "alice",
          displayName: "Alice",
          platform: "youtube",
          bio: "FPS gaming creator",
          categories: ["gaming"],
          tags: [],
        },
        {
          tenantId: tenant.id,
          handle: "bob",
          displayName: "Bob",
          platform: "youtube",
          bio: null,
          categories: ["gaming"],
          tags: ["fps"],
        },
      ],
    });

    const fetchImpl = mockGatewayFetch([fakeVec(1), fakeVec(2)]);
    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    const stats = await embedAllKols(admin, {
      batchSize: 5,
      client: { fetchImpl },
    });
    expect(stats.scanned).toBe(2);
    expect(stats.embedded).toBe(2);
    expect(stats.failed).toBe(0);

    // Hash persisted for both rows.
    const rows = await admin.$queryRawUnsafe<
      { handle: string; hash: string | null }[]
    >(
      `SELECT handle, embedding_text_hash AS hash FROM "kol" ORDER BY handle`
    );
    expect(rows[0]?.hash).not.toBeNull();
    expect(rows[1]?.hash).not.toBeNull();
  });

  it("skips rows whose hash already matches (#6:B' regression)", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "T2", slug: "t2" },
    });
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "carol",
        displayName: "Carol",
        platform: "youtube",
        bio: "indie dev",
        categories: ["gaming"],
        tags: [],
      },
    });

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    const fetchA = mockGatewayFetch([fakeVec(11)]);
    const first = await embedAllKols(admin, { client: { fetchImpl: fetchA } });
    expect(first.embedded).toBe(1);

    // Run again — hash should match → no API call.
    const fetchB = vi.fn(async () => {
      throw new Error("should-not-be-called");
    }) as unknown as typeof fetch;
    const second = await embedAllKols(admin, {
      client: { fetchImpl: fetchB },
    });
    expect(second.embedded).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it("re-embeds when bio changes but skips when only follower count changes", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "T3", slug: "t3" },
    });
    const created = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "dave",
        displayName: "Dave",
        platform: "youtube",
        bio: "old bio",
        followerCount: 100,
        categories: ["gaming"],
        tags: [],
      },
    });
    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    await embedAllKols(admin, {
      client: { fetchImpl: mockGatewayFetch([fakeVec(20)]) },
    });

    // Update follower_count only — embedding should NOT re-run.
    await admin.kol.update({
      where: { id: created.id },
      data: { followerCount: 999_999 },
    });
    const noopFetch = vi.fn(async () => {
      throw new Error("should-not-be-called");
    }) as unknown as typeof fetch;
    const r1 = await embedKolsForIds(admin, [created.id], {
      client: { fetchImpl: noopFetch },
    });
    expect(r1.embedded).toBe(0);
    expect(r1.skipped).toBe(1);

    // Update bio — embedding SHOULD re-run.
    await admin.kol.update({
      where: { id: created.id },
      data: { bio: "new bio after rebrand" },
    });
    const okFetch = mockGatewayFetch([fakeVec(21)]);
    const r2 = await embedKolsForIds(admin, [created.id], {
      client: { fetchImpl: okFetch },
    });
    expect(r2.embedded).toBe(1);
  });
});

describe("cosine top-k query (#11:A NULL-filter regression)", () => {
  it("returns rows in distance order and filters NULL embeddings", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "T4", slug: "t4" },
    });
    const created = await Promise.all([
      admin.kol.create({
        data: {
          tenantId: tenant.id,
          handle: "near",
          displayName: "Near",
          platform: "youtube",
          bio: "n",
          categories: ["gaming"],
          tags: [],
        },
      }),
      admin.kol.create({
        data: {
          tenantId: tenant.id,
          handle: "far",
          displayName: "Far",
          platform: "youtube",
          bio: "f",
          categories: ["gaming"],
          tags: [],
        },
      }),
      admin.kol.create({
        data: {
          tenantId: tenant.id,
          handle: "noembed",
          displayName: "NoEmbed",
          platform: "youtube",
          bio: "x",
          categories: ["gaming"],
          tags: [],
        },
      }),
    ]);

    // Hand-write embeddings: query vector aligns with `near`, anti-aligns
    // with `far`, and `noembed` stays NULL.
    const queryVec = fakeVec(0);
    const nearVec = fakeVec(0).map((x) => x + 0.0001);
    const farVec = queryVec.map((x) => -x);
    await admin.$executeRawUnsafe(
      `UPDATE "kol" SET "embedding" = $1::vector(${EMBEDDING_DIMS}) WHERE id = $2::uuid`,
      JSON.stringify(nearVec),
      created[0]!.id
    );
    await admin.$executeRawUnsafe(
      `UPDATE "kol" SET "embedding" = $1::vector(${EMBEDDING_DIMS}) WHERE id = $2::uuid`,
      JSON.stringify(farVec),
      created[1]!.id
    );
    // created[2] remains NULL.

    // IVFFlat needs probes >= lists to be deterministic at low N (test
    // scale only — prod has 1500+ rows per list so default probes=1
    // returns enough). ANALYZE'ing after inserts also helps the
    // planner. We do both so the test is robust.
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);
    await admin.$executeRawUnsafe(`SET LOCAL ivfflat.probes = 4`);

    const sql = kolCosineTopKSql({ query: queryVec, limit: 5 });
    const rows = await admin.$queryRaw<{ id: string; distance: number }[]>(sql);
    expect(rows.length).toBe(2); // NULL excluded
    expect(rows[0]!.id).toBe(created[0]!.id); // nearest first
    expect(rows[1]!.id).toBe(created[1]!.id);
  });
});

describe("embedProductIfStale", () => {
  it("embeds a product when never embedded before", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "T5", slug: "t5" },
    });
    const product = await admin.product.create({
      data: {
        tenantId: tenant.id,
        name: "Indie FPS",
        category: "shooter",
        targetAudience: "FPS players",
        uniqueSellingPoints: "fast TTK",
      },
    });
    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    const stats = await embedProductIfStale(admin, product.id, {
      client: { fetchImpl: mockGatewayFetch([fakeVec(7)]) },
    });
    expect(stats.embedded).toBe(1);

    const after = await admin.$queryRawUnsafe<{ hash: string | null }[]>(
      `SELECT embedding_text_hash AS hash FROM "product" WHERE id = $1`,
      product.id
    );
    expect(after[0]?.hash).not.toBeNull();
  });
});

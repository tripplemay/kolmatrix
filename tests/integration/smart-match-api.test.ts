/**
 * B7a-F002 · Integration test for the Smart Match server logic.
 *
 * Drives `runSmartMatch` against a real pgvector container with hand-
 * inserted vectors so the assertions don't need the live aigcgateway.
 * Validates:
 *   - Cosine top-K respects RLS (cross-tenant rows hidden).
 *   - WHERE embedding IS NOT NULL filter (audit lock #11:A).
 *   - WHERE is_suspicious = false filter (B6-F005 UI hide flag).
 *   - Match score ordering matches similarity ordering.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { runSmartMatch, SmartMatchError } from "@/lib/discovery/smart-match";
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

function fakeVec(seed: number, scale: number = 1): number[] {
  // Deterministic, low-amplitude vectors that yield distinct cosine
  // distances per `seed`.
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) =>
    Math.cos(((i + seed) * Math.PI) / 256) * scale
  );
}

async function setEmbedding(
  prisma: ReturnType<typeof getAdminPrisma>,
  table: "kol" | "product",
  id: string,
  vec: readonly number[]
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "embedding" = $1::vector(${EMBEDDING_DIMS}) WHERE id = $2${
      table === "kol" ? "::uuid" : ""
    }`,
    JSON.stringify(vec),
    id
  );
}

describe("runSmartMatch — happy path", () => {
  it("ranks KOLs by cosine similarity to the product embedding", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Tenant A", slug: "tenant-a" },
    });

    const product = await admin.product.create({
      data: {
        tenantId: tenant.id,
        name: "FPS Launch",
        category: "shooter",
        targetAudience: "FPS players",
        uniqueSellingPoints: "fast TTK",
      },
    });
    const productVec = fakeVec(0);
    await setEmbedding(admin, "product", product.id, productVec);

    // Three KOLs at distinct similarity tiers.
    const closest = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "k1",
        displayName: "Closest",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });
    const middle = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "k2",
        displayName: "Middle",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });
    const farthest = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "k3",
        displayName: "Farthest",
        platform: "youtube",
        bio: "x",
        categories: ["gaming"],
        tags: [],
      },
    });
    await setEmbedding(admin, "kol", closest.id, productVec.map((x) => x + 1e-5));
    await setEmbedding(admin, "kol", middle.id, productVec.map((x) => x * 0.5 + 0.1));
    await setEmbedding(admin, "kol", farthest.id, productVec.map((x) => -x));

    // Stub the embed-product step (we already wrote a vector).
    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            object: "list",
            data: [
              {
                object: "embedding",
                index: 0,
                embedding: productVec,
              },
            ],
            model: "bge-m3",
            usage: { prompt_tokens: 5, total_tokens: 5 },
          }),
          { status: 200 }
        )
      )
    );

    // ANALYZE + force probes=4 so IVFFlat returns all rows at this
    // small N (test scale only).
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);

    const result = await runSmartMatch({
      tenantId: tenant.id,
      productId: product.id,
      topK: 5,
      prismaOverride: admin,
    });
    vi.unstubAllGlobals();

    expect(result.product.id).toBe(product.id);
    expect(result.results.length).toBe(3);
    expect(result.results[0]!.id).toBe(closest.id);
    expect(result.results[2]!.id).toBe(farthest.id);
    expect(result.results[0]!.matchScore).toBeGreaterThan(
      result.results[2]!.matchScore
    );
    // Ring score is in [0, 100].
    for (const r of result.results) {
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
      expect(r.matchScore).toBeLessThanOrEqual(100);
    }
  });
});

describe("runSmartMatch — filters & RLS", () => {
  it("excludes KOLs with NULL embedding (audit lock #11:A)", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Tenant B", slug: "tenant-b" },
    });
    const product = await admin.product.create({
      data: {
        tenantId: tenant.id,
        name: "P",
        category: "c",
        targetAudience: "a",
        uniqueSellingPoints: "u",
      },
    });
    const productVec = fakeVec(0);
    await setEmbedding(admin, "product", product.id, productVec);

    const embedded = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "embedded",
        displayName: "Embedded",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
      },
    });
    await setEmbedding(admin, "kol", embedded.id, productVec);

    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "no-embed",
        displayName: "NoEmbed",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
      },
    });

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            object: "list",
            data: [{ object: "embedding", index: 0, embedding: productVec }],
            model: "bge-m3",
            usage: { prompt_tokens: 1, total_tokens: 1 },
          }),
          { status: 200 }
        )
      )
    );
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);
    const result = await runSmartMatch({
      tenantId: tenant.id,
      productId: product.id,
      topK: 5,
      prismaOverride: admin,
    });
    vi.unstubAllGlobals();

    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(embedded.id);
    expect(ids.length).toBe(1);
  });

  it("excludes is_suspicious=true KOLs (B6-F005 UI hide flag)", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Tenant C", slug: "tenant-c" },
    });
    const product = await admin.product.create({
      data: {
        tenantId: tenant.id,
        name: "P",
        category: "c",
        targetAudience: "a",
        uniqueSellingPoints: "u",
      },
    });
    const productVec = fakeVec(0);
    await setEmbedding(admin, "product", product.id, productVec);

    const ok = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "ok",
        displayName: "OK",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
        isSuspicious: false,
      },
    });
    const sus = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "sus",
        displayName: "Sus",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
        isSuspicious: true,
      },
    });
    await setEmbedding(admin, "kol", ok.id, productVec);
    await setEmbedding(admin, "kol", sus.id, productVec);

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            object: "list",
            data: [{ object: "embedding", index: 0, embedding: productVec }],
            model: "bge-m3",
            usage: { prompt_tokens: 1, total_tokens: 1 },
          }),
          { status: 200 }
        )
      )
    );
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);
    const result = await runSmartMatch({
      tenantId: tenant.id,
      productId: product.id, prismaOverride: admin,
    });
    vi.unstubAllGlobals();

    const ids = result.results.map((r) => r.id);
    expect(ids).toContain(ok.id);
    expect(ids).not.toContain(sus.id);
  });

  it("RLS narrows to the calling tenant — cross-tenant KOLs do not appear", async () => {
    const admin = getAdminPrisma();
    const callingTenant = await admin.tenant.create({
      data: { name: "Caller", slug: "caller" },
    });
    const otherTenant = await admin.tenant.create({
      data: { name: "Other", slug: "other" },
    });

    const product = await admin.product.create({
      data: {
        tenantId: callingTenant.id,
        name: "P",
        category: "c",
        targetAudience: "a",
        uniqueSellingPoints: "u",
      },
    });
    const productVec = fakeVec(0);
    await setEmbedding(admin, "product", product.id, productVec);

    const myKol = await admin.kol.create({
      data: {
        tenantId: callingTenant.id,
        handle: "mine",
        displayName: "Mine",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
      },
    });
    await setEmbedding(admin, "kol", myKol.id, productVec);

    const otherKol = await admin.kol.create({
      data: {
        tenantId: otherTenant.id,
        handle: "theirs",
        displayName: "Theirs",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
      },
    });
    await setEmbedding(admin, "kol", otherKol.id, productVec);

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            object: "list",
            data: [{ object: "embedding", index: 0, embedding: productVec }],
            model: "bge-m3",
            usage: { prompt_tokens: 1, total_tokens: 1 },
          }),
          { status: 200 }
        )
      )
    );
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);
    const result = await runSmartMatch({
      tenantId: callingTenant.id,
      productId: product.id, prismaOverride: admin,
    });
    vi.unstubAllGlobals();

    const ids = result.results.map((r) => r.id);
    expect(ids).toEqual([myKol.id]);
  });
});

describe("runSmartMatch — errors", () => {
  it("throws product_not_found for missing product", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "T", slug: "t-err" },
    });
    await expect(
      runSmartMatch({
        tenantId: tenant.id,
        productId: "00000000-0000-0000-0000-000000000000", prismaOverride: admin,
      })
    ).rejects.toBeInstanceOf(SmartMatchError);
  });
});

/**
 * fix-round 1 regression: the production runtime calls runSmartMatch
 * WITHOUT a `prismaOverride` — the app-role `prisma` from db.ts has
 * no tenant GUC set, so any naive `$queryRawUnsafe`/`$executeRaw` on
 * `product`/`kol` returns 0 rows under RLS. The original verifying
 * round failed exactly here ("product vector unreadable after
 * embed"). This test pins the fix: when no override is passed,
 * the function must internally route the embed read/write through
 * `prismaAdmin` (or whatever non-RLS path is in place) so the SQL
 * UPDATE + SELECT actually touch the row.
 */
describe("runSmartMatch — RLS regression (fix-round 1)", () => {
  it("works without prismaOverride (production runtime path)", async () => {
    // setupTestDb populated DATABASE_URL + DATABASE_ADMIN_URL on
    // process.env, so the lazy db.ts + db-admin.ts imports inside
    // runSmartMatch will resolve to the testcontainer.
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "RLS Regression", slug: "rls-reg" },
    });
    const product = await admin.product.create({
      data: {
        tenantId: tenant.id,
        name: "RLS Product",
        category: "shooter",
        targetAudience: "competitive shooter players",
        uniqueSellingPoints: "fast TTK",
      },
    });
    const productVec = fakeVec(0);
    await setEmbedding(admin, "product", product.id, productVec);

    const kol = await admin.kol.create({
      data: {
        tenantId: tenant.id,
        handle: "rls",
        displayName: "Rls",
        platform: "youtube",
        bio: "x",
        categories: [],
        tags: [],
      },
    });
    await setEmbedding(admin, "kol", kol.id, productVec);

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            object: "list",
            data: [
              { object: "embedding", index: 0, embedding: productVec },
            ],
            model: "bge-m3",
            usage: { prompt_tokens: 1, total_tokens: 1 },
          }),
          { status: 200 }
        )
      )
    );
    await admin.$executeRawUnsafe(`ANALYZE "kol"`);

    // No prismaOverride passed — exactly the prod runtime call.
    const result = await runSmartMatch({
      tenantId: tenant.id,
      productId: product.id,
    });
    vi.unstubAllGlobals();

    expect(result.product.id).toBe(product.id);
    expect(result.results.length).toBe(1);
    expect(result.results[0]!.id).toBe(kol.id);
  });
});

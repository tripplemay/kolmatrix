/**
 * BL-034 F004 · embedAllKols soft-delete + tenantId guard regression spec.
 *
 * Three properties under a real Postgres + pgvector container:
 *   1. embedAllKols rejects an invalid tenantId (assertUuid throws)
 *      before any DB read.
 *   2. With tenantId set, soft-deleted KOL rows are excluded from the
 *      scan so the embedding pipeline does not waste API calls / quota.
 *   3. Without tenantId (cross-tenant ops path used by the backfill
 *      script), soft-deleted rows are still excluded.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { embedAllKols } from "@/lib/embedding/kol-embed";
import { EMBEDDING_DIMS } from "@/lib/embedding/types";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

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
  return Array.from({ length: EMBEDDING_DIMS }, (_, i) => (((i + seed) % 17) - 8) / 8);
}

function mockGatewayFetch(vectors: readonly number[][]): typeof fetch {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({
        object: "list",
        data: vectors.map((v, i) => ({ object: "embedding", index: i, embedding: v })),
        model: "bge-m3",
        usage: { prompt_tokens: vectors.length * 30, total_tokens: vectors.length * 30 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  ) as unknown as typeof fetch;
}

describe("embedAllKols — BL-034 F004", () => {
  it("throws when tenantId is not a UUID (assertUuid entry guard)", async () => {
    const admin = getAdminPrisma();
    await expect(
      embedAllKols(admin, { tenantId: "not-a-uuid" }),
    ).rejects.toThrow(/tenantId must be a UUID string/);
  });

  it("with tenantId: soft-deleted KOLs are skipped so only active rows reach the embedder", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "F004 Active", slug: "f004-active" },
    });
    await admin.kol.createMany({
      data: [
        {
          tenantId: tenant.id,
          handle: "active-alpha",
          displayName: "Active Alpha",
          platform: "youtube",
          bio: "alpha bio",
          categories: ["gaming"],
          tags: [],
        },
        {
          tenantId: tenant.id,
          handle: "active-beta",
          displayName: "Active Beta",
          platform: "youtube",
          bio: "beta bio",
          categories: ["gaming"],
          tags: [],
        },
        {
          tenantId: tenant.id,
          handle: "deleted-gamma",
          displayName: "Deleted Gamma",
          platform: "youtube",
          bio: "gamma bio",
          categories: ["gaming"],
          tags: [],
          deletedAt: new Date(),
        },
      ],
    });

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    // Only 2 active rows should be sent → preallocate 2 vectors.
    const fetchImpl = mockGatewayFetch([fakeVec(1), fakeVec(2)]);
    const stats = await embedAllKols(admin, {
      tenantId: tenant.id,
      client: { fetchImpl },
    });

    expect(stats.scanned).toBe(2);
    expect(stats.embedded).toBe(2);
    expect(stats.failed).toBe(0);

    // Soft-deleted row's hash stays NULL (never embedded).
    const rows = await admin.$queryRaw<{ handle: string; hash: string | null }[]>`
      SELECT handle, embedding_text_hash AS hash FROM "kol" ORDER BY handle
    `;
    expect(rows.find((r) => r.handle === "deleted-gamma")?.hash).toBeNull();
    expect(rows.find((r) => r.handle === "active-alpha")?.hash).not.toBeNull();
    expect(rows.find((r) => r.handle === "active-beta")?.hash).not.toBeNull();
  });

  it("without tenantId (cross-tenant ops): still excludes soft-deleted rows", async () => {
    const admin = getAdminPrisma();
    const tenantA = await admin.tenant.create({
      data: { name: "F004 Cross-A", slug: "f004-cross-a" },
    });
    const tenantB = await admin.tenant.create({
      data: { name: "F004 Cross-B", slug: "f004-cross-b" },
    });
    await admin.kol.createMany({
      data: [
        {
          tenantId: tenantA.id,
          handle: "a-active",
          displayName: "A Active",
          platform: "youtube",
          bio: "a bio",
          categories: ["gaming"],
          tags: [],
        },
        {
          tenantId: tenantB.id,
          handle: "b-active",
          displayName: "B Active",
          platform: "youtube",
          bio: "b bio",
          categories: ["gaming"],
          tags: [],
        },
        {
          tenantId: tenantA.id,
          handle: "a-deleted",
          displayName: "A Deleted",
          platform: "youtube",
          bio: "a deleted bio",
          categories: ["gaming"],
          tags: [],
          deletedAt: new Date(),
        },
      ],
    });

    process.env.AIGCGATEWAY_API_KEY = "pk_test";
    const fetchImpl = mockGatewayFetch([fakeVec(11), fakeVec(12)]);
    const stats = await embedAllKols(admin, { client: { fetchImpl } });

    expect(stats.scanned).toBe(2);
    expect(stats.embedded).toBe(2);
  });
});

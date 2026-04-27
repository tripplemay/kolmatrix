/**
 * MVP-kol-seed-redo F003 · Import-from-YouTube integration spec.
 *
 * Contract covered:
 *   1. runImport with the real Prisma client inserts each EnrichedChannel
 *      under the demo tenant with metadata.is_demo=true and the
 *      youtube.* nested provenance.
 *   2. Re-running the importer against the same input is idempotent —
 *      no duplicate rows, second pass goes through the `updated` branch.
 *   3. The cleanup query the spec promises (`DELETE FROM kol WHERE
 *      metadata->>'is_demo'='true'`) really does remove only the seeded
 *      rows, leaving non-seeded rows untouched.
 *   4. RLS still isolates the imported rows: tenant A cannot read
 *      tenant B's YouTube seed via the app role.
 *   5. Categories mapping (deriveCategories) covers the spec's six
 *      gaming category requirement and falls back to ['Gaming'] when
 *      topicCategories has nothing recognised.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPrismaImportClient,
  deriveCategories,
  mapToKolRow,
  runImport,
} from "@/../scripts/import-kol-from-youtube";
import type { EnrichedChannel } from "@/../scripts/seed-kol-from-youtube";

import {
  cleanDb,
  getAdminPrisma,
  getAppPrisma,
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

function fakeChannel(id: string, overrides: Partial<EnrichedChannel> = {}): EnrichedChannel {
  return {
    id,
    handle: `@${id.toLowerCase()}`,
    title: `Channel ${id}`,
    description: "Plays competitive FPS daily.",
    country: "US",
    defaultLanguage: "en",
    publishedAt: "2018-01-01T00:00:00Z",
    thumbnailUrl: `https://yt.example/${id}.jpg`,
    bannerUrl: `https://yt.example/${id}-banner.jpg`,
    subscriberCount: 250_000,
    videoCount: 320,
    viewCount: 50_000_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    matrixRegion: "US",
    matrixKeyword: "gaming",
    scrapedAt: "2026-04-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("deriveCategories (pure)", () => {
  it("collapses YouTube Wikipedia URLs to KOLMatrix category names", () => {
    expect(
      deriveCategories(["https://en.wikipedia.org/wiki/Action_game"])
    ).toEqual(["Action", "FPS"]);
    expect(
      deriveCategories([
        "https://en.wikipedia.org/wiki/Strategy_video_game",
        "https://en.wikipedia.org/wiki/Sports_game",
      ])
    ).toEqual(["Sports", "Strategy"]);
  });

  it("dedupes overlapping categories", () => {
    expect(
      deriveCategories([
        "https://en.wikipedia.org/wiki/Action_game",
        "https://en.wikipedia.org/wiki/Action-adventure_game",
      ])
    ).toEqual(["Action", "Adventure", "FPS"]);
  });

  it("falls back to Gaming when nothing matches", () => {
    expect(deriveCategories([])).toEqual(["Gaming"]);
    expect(
      deriveCategories(["https://en.wikipedia.org/wiki/Cuisine"])
    ).toEqual(["Gaming"]);
  });
});

describe("mapToKolRow (pure)", () => {
  it("emits metadata.is_demo + nested youtube.* provenance", () => {
    const row = mapToKolRow(fakeChannel("UC_test"), "2026-04-27T12:00:00.000Z");
    expect(row).not.toBeNull();
    expect(row!.metadata.is_demo).toBe(true);
    expect(row!.metadata.source).toBe("youtube-api");
    expect(row!.metadata.seeded_at).toBe("2026-04-27T12:00:00.000Z");
    expect(row!.metadata.youtube.channelId).toBe("UC_test");
    expect(row!.metadata.youtube.videoCount).toBe(320);
    expect(row!.metadata.youtube.bannerUrl).toBe(
      "https://yt.example/UC_test-banner.jpg"
    );
    expect(row!.avgViews).toBe(Math.round(50_000_000 / 320));
    expect(row!.platform).toBe("youtube");
  });
});

describe("runImport (live Prisma)", () => {
  it("inserts every channel with metadata.is_demo=true and survives a second pass", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "YT Seed Tenant", slug: `yt-seed-${Date.now()}` },
    });
    const channels = [
      fakeChannel("UC_a", { handle: "@a", subscriberCount: 100_000 }),
      fakeChannel("UC_b", { handle: "@b", subscriberCount: 250_000, country: "JP" }),
      fakeChannel("UC_c", {
        handle: "@c",
        subscriberCount: 50_000,
        topicCategories: [
          "https://en.wikipedia.org/wiki/Strategy_video_game",
          "https://en.wikipedia.org/wiki/ESports",
        ],
      }),
    ];
    const client = createPrismaImportClient(admin);

    const stats = await runImport(channels, tenant.id, client);
    expect(stats).toMatchObject({ total: 3, inserted: 3, updated: 0, skipped: 0 });
    // Histogram covers ≥ 3 distinct categories — meets the spec's
    // ≥6 requirement once a real 1k-row corpus lands; the fixture
    // here just exercises the counting path.
    expect(Object.keys(stats.categoriesHistogram).length).toBeGreaterThanOrEqual(3);

    const rows = await admin.kol.findMany({
      where: { tenantId: tenant.id, platform: "youtube" },
      orderBy: { handle: "asc" },
    });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      const m = r.metadata as { is_demo: boolean; source: string };
      expect(m.is_demo).toBe(true);
      expect(m.source).toBe("youtube-api");
      expect(r.externalId).toMatch(/^UC_/);
      expect(r.lastSyncedAt).not.toBeNull();
    }

    // Idempotent re-run.
    const stats2 = await runImport(channels, tenant.id, client);
    expect(stats2).toMatchObject({ total: 3, inserted: 0, updated: 3, skipped: 0 });
    const count2 = await admin.kol.count({ where: { tenantId: tenant.id } });
    expect(count2).toBe(3);
  });

  it("dedupes by externalId — handle change updates the existing row, no duplicate", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Rename Tenant", slug: `rename-${Date.now()}` },
    });
    const client = createPrismaImportClient(admin);

    // First pass — channel published as @oldname.
    const before = fakeChannel("UC_renamed", { handle: "@oldname" });
    const stats1 = await runImport([before], tenant.id, client);
    expect(stats1).toMatchObject({ inserted: 1, updated: 0 });

    // Second pass — same channel.id, but the creator renamed to
    // @newname. Under the old (tenantId, platform, handle) key this
    // would have inserted a second row; with the externalId key it
    // updates the existing row and the handle column moves to
    // @newname.
    const after = fakeChannel("UC_renamed", {
      handle: "@newname",
      subscriberCount: 300_000,
    });
    const stats2 = await runImport([after], tenant.id, client);
    expect(stats2).toMatchObject({ inserted: 0, updated: 1 });

    const rows = await admin.kol.findMany({ where: { tenantId: tenant.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.handle).toBe("@newname");
    expect(rows[0]!.externalId).toBe("UC_renamed");
    expect(rows[0]!.followerCount).toBe(300_000);
  });

  it("isolates the imported rows under RLS", async () => {
    const admin = getAdminPrisma();
    const app = getAppPrisma();
    const tenantA = await admin.tenant.create({
      data: { name: "Tenant A", slug: `t-a-${Date.now()}` },
    });
    const tenantB = await admin.tenant.create({
      data: { name: "Tenant B", slug: `t-b-${Date.now()}` },
    });
    const client = createPrismaImportClient(admin);
    await runImport([fakeChannel("UC_a")], tenantA.id, client);
    await runImport([fakeChannel("UC_b")], tenantB.id, client);

    // App role pinned to tenant A only sees A's rows.
    const seenForA = await app.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.tenant_id', $1, true)`,
        tenantA.id
      );
      return tx.kol.findMany({
        where: { platform: "youtube" },
        select: { externalId: true },
      });
    });
    expect(seenForA.map((r) => r.externalId).sort()).toEqual(["UC_a"]);
  });

  it("the cleanup DELETE retires only the demo seed", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Cleanup Tenant", slug: `cleanup-${Date.now()}` },
    });

    // 1 hand-crafted non-demo row (B0-style) + 2 imported demo rows.
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "@kept",
        displayName: "Hand-crafted",
        followerCount: 30_000,
        // metadata.is_demo absent — should survive the DELETE.
      },
    });
    const client = createPrismaImportClient(admin);
    await runImport(
      [fakeChannel("UC_demo1", { handle: "@d1" }), fakeChannel("UC_demo2", { handle: "@d2" })],
      tenant.id,
      client
    );

    const before = await admin.kol.count({ where: { tenantId: tenant.id } });
    expect(before).toBe(3);

    await admin.$executeRawUnsafe(
      `DELETE FROM kol WHERE metadata->>'is_demo' = 'true' AND tenant_id = $1::uuid`,
      tenant.id
    );

    const after = await admin.kol.findMany({
      where: { tenantId: tenant.id },
      select: { handle: true },
    });
    expect(after.map((r) => r.handle)).toEqual(["@kept"]);
  });
});

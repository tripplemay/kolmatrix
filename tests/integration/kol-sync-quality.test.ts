/**
 * B6-kol-daily-sync F005 · Quality module + UI hide integration.
 *
 * Drives the writer end-to-end (Prisma + real DB) and verifies the
 * five spec fixtures: spam / zombie / NSFW / dedupe-by-channel-id /
 * suspicious-growth flag, plus that the Discovery filter
 * (`buildKolWhere`) hides flagged rows.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { importRawKolData } from "@/lib/kol-sync/import";
import type { RawKolData } from "@/lib/kol-sync/types";
import { buildKolWhere, parseFilters } from "@/lib/kol/filters";
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

const NOW = new Date("2026-04-28T08:30:00.000Z");

function fakeRaw(overrides: Partial<RawKolData> = {}): RawKolData {
  return {
    externalId: "UC_default",
    platform: "youtube",
    handle: "@default",
    displayName: "Default Channel",
    description: "Plays competitive FPS daily.",
    country: "US",
    language: "en",
    subscriberCount: 50_000,
    videoCount: 200,
    viewCount: 5_000_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    publishedAt: "2018-01-01T00:00:00Z",
    scrapedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("F005 fixtures · pre-write quality filters", () => {
  it("spam: subs < 1,000 → skipped, no row inserted", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Quality Spam", slug: `spam-${Date.now()}` },
    });
    const stats = await importRawKolData(
      admin,
      [fakeRaw({ externalId: "UC_spam", subscriberCount: 500 })],
      { tenantId: tenant.id, source: "youtube-api-daily", isDemo: false, now: () => NOW }
    );
    expect(stats.inserted).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(stats.skippedByReason.spam).toBe(1);
    const count = await admin.kol.count({ where: { tenantId: tenant.id } });
    expect(count).toBe(0);
  });

  it("zombie: lastUploadAt > 90 days → skipped", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Quality Zombie", slug: `zombie-${Date.now()}` },
    });
    const old = new Date(NOW.getTime() - 120 * 24 * 3600_000).toISOString();
    const stats = await importRawKolData(
      admin,
      [fakeRaw({ externalId: "UC_zombie", lastUploadAt: old })],
      { tenantId: tenant.id, source: "youtube-api-daily", isDemo: false, now: () => NOW }
    );
    expect(stats.skippedByReason.zombie).toBe(1);
  });

  it("nsfw: brandSafetyRating in {questionable,unsafe,nsfw} → skipped", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Quality NSFW", slug: `nsfw-${Date.now()}` },
    });
    const stats = await importRawKolData(
      admin,
      [fakeRaw({ externalId: "UC_nsfw", brandSafetyRating: "questionable" })],
      { tenantId: tenant.id, source: "youtube-api-daily", isDemo: false, now: () => NOW }
    );
    expect(stats.skippedByReason.nsfw).toBe(1);
  });

  it("dedupe by externalId: same channel.id with renamed handle → 1 updated row, no duplicate", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Quality Dedupe", slug: `dedupe-${Date.now()}` },
    });
    const opts = { tenantId: tenant.id, source: "youtube-api-daily", isDemo: false, now: () => NOW };

    const first = await importRawKolData(admin, [fakeRaw({ externalId: "UC_dedupe", handle: "@old" })], opts);
    expect(first).toMatchObject({ inserted: 1, updated: 0 });

    const second = await importRawKolData(admin, [fakeRaw({ externalId: "UC_dedupe", handle: "@new", subscriberCount: 80_000 })], opts);
    expect(second).toMatchObject({ inserted: 0, updated: 1 });

    const rows = await admin.kol.findMany({ where: { tenantId: tenant.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.handle).toBe("@new");
    expect(rows[0]!.followerCount).toBe(80_000);
  });
});

describe("F005 fixtures · post-write flags + UI hide", () => {
  it("suspicious_growth: 10× spike sets flag and Discovery filter hides the row", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Quality Growth", slug: `grow-${Date.now()}` },
    });
    const opts = { tenantId: tenant.id, source: "youtube-api-daily", isDemo: false } as const;

    // Initial sync at 50K — no baseline yet, flag does not fire.
    await importRawKolData(
      admin,
      [fakeRaw({ externalId: "UC_grow", subscriberCount: 50_000 })],
      { ...opts, now: () => new Date(NOW.getTime() - 5 * 24 * 3600_000) }
    );

    // Second sync — 10× jump.
    const second = await importRawKolData(
      admin,
      [fakeRaw({ externalId: "UC_grow", subscriberCount: 500_000 })],
      { ...opts, now: () => NOW }
    );
    expect(second.flaggedByKind.suspicious_growth).toBe(1);

    const row = await admin.kol.findFirst({ where: { tenantId: tenant.id } });
    expect(row).not.toBeNull();
    const meta = row!.metadata as { flags?: { suspicious_growth?: boolean } };
    expect(meta.flags?.suspicious_growth).toBe(true);

    // Discovery / Database filter (buildKolWhere) hides flagged rows.
    const where = buildKolWhere(parseFilters(new URLSearchParams()));
    const visible = await admin.kol.count({
      where: { AND: [{ tenantId: tenant.id }, where] },
    });
    expect(visible).toBe(0);
  });

  it("non-flagged rows remain visible under buildKolWhere", async () => {
    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({
      data: { name: "Quality Visible", slug: `vis-${Date.now()}` },
    });
    await importRawKolData(
      admin,
      [
        fakeRaw({ externalId: "UC_a", handle: "@a", country: "US", subscriberCount: 100_000 }),
        fakeRaw({ externalId: "UC_b", handle: "@b", country: "JP", subscriberCount: 250_000 }),
      ],
      { tenantId: tenant.id, source: "youtube-api-daily", isDemo: false, now: () => NOW }
    );
    const where = buildKolWhere(parseFilters(new URLSearchParams()));
    const visible = await admin.kol.count({
      where: { AND: [{ tenantId: tenant.id }, where] },
    });
    expect(visible).toBe(2);
  });
});

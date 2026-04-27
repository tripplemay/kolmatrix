/**
 * B6-kol-daily-sync F005 · Pure quality + weekly-summarize fixtures.
 *
 * Two suites:
 *   1. checkQuality — every spec-mandated rule has a kept-row case
 *      and a skipped-row case, plus the post-write flag computation
 *      (suspicious_growth / declining) is verified end-to-end.
 *   2. summarize (weekly report) — counts, anomaly tally, region /
 *      category histogram, follower stats, grade heuristic, all
 *      from a deterministic fixture set.
 */
import { describe, expect, it } from "vitest";

import { checkQuality } from "@/lib/kol-sync/quality";
import type { RawKolData } from "@/lib/kol-sync/types";
import { formatMarkdown, summarize } from "@/../scripts/kol-quality-weekly";

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
    scrapedAt: "2026-04-28T08:30:00.000Z",
    ...overrides,
  };
}

describe("checkQuality · rule 1 — missing externalId", () => {
  it("skip with reason missing-id", () => {
    const v = checkQuality(fakeRaw({ externalId: "" }), null, NOW);
    expect(v.keep).toBe(false);
    expect(v.keep === false ? v.reason : null).toBe("missing-id");
  });
});

describe("checkQuality · rule 2 — spam (subs < 1,000)", () => {
  it("keeps a row with 1,000 subs (boundary)", () => {
    const v = checkQuality(fakeRaw({ subscriberCount: 1_000 }), null, NOW);
    expect(v.keep).toBe(true);
  });
  it("skips a row with 999 subs", () => {
    const v = checkQuality(fakeRaw({ subscriberCount: 999 }), null, NOW);
    expect(v.keep).toBe(false);
    expect(v.keep === false ? v.reason : null).toBe("spam");
  });
});

describe("checkQuality · rule 3 — zombie (lastUploadAt > 90d)", () => {
  it("no-ops when lastUploadAt is missing (current YouTube path)", () => {
    const v = checkQuality(fakeRaw({}), null, NOW);
    expect(v.keep).toBe(true);
  });
  it("keeps an active channel (60 days ago)", () => {
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 24 * 3600_000).toISOString();
    const v = checkQuality(fakeRaw({ lastUploadAt: sixtyDaysAgo }), null, NOW);
    expect(v.keep).toBe(true);
  });
  it("skips a zombie (120 days ago)", () => {
    const oldUpload = new Date(NOW.getTime() - 120 * 24 * 3600_000).toISOString();
    const v = checkQuality(fakeRaw({ lastUploadAt: oldUpload }), null, NOW);
    expect(v.keep).toBe(false);
    expect(v.keep === false ? v.reason : null).toBe("zombie");
  });
});

describe("checkQuality · rule 4 — NSFW", () => {
  it("keeps when rating is safe", () => {
    expect(checkQuality(fakeRaw({ brandSafetyRating: "safe" }), null, NOW).keep).toBe(true);
  });
  it("skips when rating is questionable / unsafe / nsfw (any case)", () => {
    for (const r of ["questionable", "Unsafe", "NSFW"]) {
      const v = checkQuality(fakeRaw({ brandSafetyRating: r }), null, NOW);
      expect(v.keep).toBe(false);
      expect(v.keep === false ? v.reason : null).toBe("nsfw");
    }
  });
});

describe("checkQuality · post-write flags", () => {
  it("flags.suspicious_growth when followers spike 10×", () => {
    const v = checkQuality(
      fakeRaw({ subscriberCount: 1_000_000 }),
      { followerCount: 50_000, lastSyncedAt: new Date(NOW.getTime() - 10 * 24 * 3600_000) },
      NOW
    );
    expect(v.keep).toBe(true);
    expect(v.flags.suspicious_growth).toBe(true);
  });

  it("does NOT flag suspicious_growth when growth is < 10×", () => {
    const v = checkQuality(
      fakeRaw({ subscriberCount: 480_000 }),
      { followerCount: 50_000, lastSyncedAt: new Date(NOW.getTime() - 10 * 24 * 3600_000) },
      NOW
    );
    expect(v.flags.suspicious_growth).toBeUndefined();
  });

  it("flags.declining when 30-day window shows -50%+ drop", () => {
    const thirtyOneDaysAgo = new Date(NOW.getTime() - 31 * 24 * 3600_000);
    const v = checkQuality(
      fakeRaw({ subscriberCount: 20_000 }),
      { followerCount: 50_000, lastSyncedAt: thirtyOneDaysAgo },
      NOW
    );
    expect(v.flags.declining).toBe(true);
  });

  it("does NOT flag declining when window is too short", () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 3600_000);
    const v = checkQuality(
      fakeRaw({ subscriberCount: 20_000 }),
      { followerCount: 50_000, lastSyncedAt: tenDaysAgo },
      NOW
    );
    expect(v.flags.declining).toBeUndefined();
  });

  it("no flags when there is no existing baseline", () => {
    const v = checkQuality(fakeRaw({ subscriberCount: 1_000_000 }), null, NOW);
    expect(v.flags).toEqual({});
  });
});

describe("summarize (weekly report)", () => {
  function row(overrides: Partial<{
    countryCode: string | null;
    categories: string[];
    followerCount: number;
    metadata: unknown;
  }> = {}) {
    return {
      countryCode: "US",
      categories: ["Action"],
      followerCount: 100_000,
      metadata: { seeded_at: NOW.toISOString() },
      ...overrides,
    };
  }

  it("tallies region / category / followers / anomalies and grades A on 0% anomaly", () => {
    const rows = [
      row({ countryCode: "US", categories: ["Action", "FPS"], followerCount: 100_000 }),
      row({ countryCode: "JP", categories: ["RPG"], followerCount: 200_000 }),
      row({ countryCode: "TW", categories: ["Strategy"], followerCount: 50_000 }),
    ];
    const r = summarize(rows, 7);
    expect(r.total).toBe(3);
    expect(r.addedThisWindow).toBe(3);
    expect(r.byRegion).toEqual({ US: 1, JP: 1, TW: 1 });
    expect(r.byCategory).toEqual({ Action: 1, FPS: 1, RPG: 1, Strategy: 1 });
    expect(r.followers.median).toBe(100_000);
    expect(r.followers.max).toBe(200_000);
    expect(r.followers.min).toBe(50_000);
    expect(r.anomalies).toEqual({ suspicious_growth: 0, declining: 0 });
    expect(r.grade).toBe("A");
  });

  it("grade slides B/C/D as anomaly rate increases", () => {
    function build(anomalyCount: number, totalCount: number) {
      const rows = [];
      for (let i = 0; i < anomalyCount; i += 1) {
        rows.push(
          row({ metadata: { seeded_at: NOW.toISOString(), flags: { suspicious_growth: true } } })
        );
      }
      for (let i = 0; i < totalCount - anomalyCount; i += 1) {
        rows.push(row());
      }
      return summarize(rows, 7);
    }
    // 1% — exactly on the B threshold.
    expect(build(1, 100).grade).toBe("B");
    // 3% — exactly on C.
    expect(build(3, 100).grade).toBe("C");
    // 7% — exactly on D.
    expect(build(7, 100).grade).toBe("D");
  });

  it("formatMarkdown emits a parseable structured block", () => {
    const r = summarize([row()], 7);
    const md = formatMarkdown(r);
    expect(md).toContain("kol-quality weekly");
    expect(md).toContain("**Grade: A**");
    expect(md).toContain("Total KOLs in tenant: 1");
  });
});

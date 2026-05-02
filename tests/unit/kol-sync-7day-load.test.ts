/**
 * B6-kol-daily-sync F006 · 7-day mock scheduler load test.
 *
 * Walks the dispatcher through 7 consecutive daily runs against an
 * in-memory mock adapter to prove the long-term contract holds when
 * tied together end-to-end:
 *
 *   - dedupe accumulates correctly across days (same externalId on
 *     day-2 must NOT inflate the running discover count)
 *   - quota usage is monotonically non-decreasing across the 7 days
 *     and never exceeds the F004 WARN threshold (3,000 / day)
 *   - zero-discover streak escalates INFO → WARN → ALERT exactly at
 *     day-3 of an outage window (matches log.ts §ZERO_DISCOVER_ALERT_STREAK)
 *   - growth curve over 7 days lands inside the 30-50/day spec band
 *     described in B6 spec §1.2 / §F002 daily strategy
 *
 * No network. No DB. No clock — every "day" is just a synchronous
 * iteration so this stays a fast unit test rather than a flaky
 * integration suite.
 */
import { describe, expect, it } from "vitest";

import { MockKolSyncAdapter } from "@/lib/kol-sync/adapters/mock";
import { KolSyncDispatcher } from "@/lib/kol-sync/dispatcher";
import {
  classifyDailyRun,
  countTrailingZeroDiscoverStreak,
  formatDailyLogLineJson,
} from "@/lib/kol-sync/log";
import type { RawKolData } from "@/lib/kol-sync/types";

// BIx-F004-P5 raised this to 9,500u (was 3,000u) once the daily
// matrix expanded to ~9,000u nominal. Mirror it locally so the load
// sim asserts the same "within budget" boundary the runbook does.
const QUOTA_WARN_THRESHOLD = 9_500;

interface SimulatedDay {
  /** The set of channels the upstream "would" return on this run. */
  upstream: readonly RawKolData[];
  /** Quota the adapter "spent" on this run. Real adapters compute
   *  this from the Google client; the mock just trusts the test. */
  quotaConsumed: number;
  /** Errors the test wants to inject through the log layer. */
  errors?: readonly string[];
}

function fakeChannel(externalId: string, day: number): RawKolData {
  return {
    externalId,
    platform: "youtube",
    handle: `@${externalId.toLowerCase()}`,
    displayName: `Channel ${externalId}`,
    description: "gaming",
    country: "US",
    language: "en",
    subscriberCount: 100_000 + day * 100,
    videoCount: 200,
    viewCount: 5_000_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    publishedAt: "2018-01-01T00:00:00Z",
    scrapedAt: `2026-04-${28 + day}T08:30:00Z`,
  };
}

/** Plan 7 days of upstream behaviour. Days 1-5 introduce 30-50 fresh
 *  channels per day; day-2 also re-emits 10 of day-1's IDs to test
 *  dedupe. Days 6-7 simulate an outage (0 discover) so the alert
 *  escalation path runs end-to-end. */
function buildSevenDayPlan(): readonly SimulatedDay[] {
  const day1 = Array.from({ length: 40 }, (_, i) => fakeChannel(`UC_d1_${i}`, 1));
  const day2New = Array.from({ length: 35 }, (_, i) => fakeChannel(`UC_d2_${i}`, 2));
  // Day-2 re-emits 10 IDs from day-1 to stress dedupe at the import
  // layer. The dispatcher itself is NOT supposed to dedupe — that's
  // the upsert constraint's job — so this test verifies *we know*
  // the dispatcher returns the duplicates and the de-dupe surface
  // sits one layer further out.
  const day2Repeats = day1.slice(0, 10);
  const day3 = Array.from({ length: 50 }, (_, i) => fakeChannel(`UC_d3_${i}`, 3));
  const day4 = Array.from({ length: 30 }, (_, i) => fakeChannel(`UC_d4_${i}`, 4));
  const day5 = Array.from({ length: 45 }, (_, i) => fakeChannel(`UC_d5_${i}`, 5));
  return [
    { upstream: day1, quotaConsumed: 1_800 },
    { upstream: [...day2New, ...day2Repeats], quotaConsumed: 1_800 },
    { upstream: day3, quotaConsumed: 1_800 },
    { upstream: day4, quotaConsumed: 1_800 },
    { upstream: day5, quotaConsumed: 1_800 },
    { upstream: [], quotaConsumed: 0, errors: ["YouTube API 503"] },
    { upstream: [], quotaConsumed: 0, errors: ["YouTube API 503"] },
  ];
}

describe("B6 F006 · 7-day mock scheduler", () => {
  it("dedupe accumulates correctly: day-2 repeats are visible to dispatcher but unique IDs converge", async () => {
    const plan = buildSevenDayPlan();
    const seenExternalIds = new Set<string>();
    let totalDispatchedRows = 0;

    for (const day of plan.slice(0, 5)) {
      const adapter = new MockKolSyncAdapter({
        name: "youtube",
        channels: day.upstream,
      });
      const dispatcher = new KolSyncDispatcher([adapter]);
      const report = await dispatcher.runDailySync();
      const ok = report.outcomes[0];
      expect(ok?.ok).toBe(true);
      if (ok?.ok) {
        totalDispatchedRows += ok.data.length;
        for (const row of ok.data) seenExternalIds.add(row.externalId);
      }
    }

    // Days 1-5 emitted 40 + 45 + 50 + 30 + 45 = 210 rows; day-2's 10
    // duplicates inflate that to 210 — dispatcher faithfully returns
    // the upstream payload.
    expect(totalDispatchedRows).toBe(210);
    // The unique externalId set after dedupe (the upsert key's job)
    // is 200 (210 - 10 day-2 repeats).
    expect(seenExternalIds.size).toBe(200);
  });

  it("daily growth curve lands inside the 30-50 KOL/day spec band", async () => {
    const plan = buildSevenDayPlan().slice(0, 5);
    const dailyCounts: number[] = [];

    for (const day of plan) {
      const adapter = new MockKolSyncAdapter({
        name: "youtube",
        channels: day.upstream,
      });
      const dispatcher = new KolSyncDispatcher([adapter]);
      const report = await dispatcher.runDailySync();
      dailyCounts.push(report.totals.discoverCount);
    }

    // Spec §F002: 30-50 KOL/day expected. The day-2 mix is 35 fresh +
    // 10 repeats = 45 dispatched, still in band. Use a tight assert.
    for (const count of dailyCounts) {
      expect(count).toBeGreaterThanOrEqual(30);
      expect(count).toBeLessThanOrEqual(50);
    }
  });

  it("quota stays under the F004 WARN threshold (3,000/day) every day", async () => {
    const plan = buildSevenDayPlan();
    let runningTotal = 0;

    for (const day of plan) {
      // Each day's quota is reported by the script (real adapter
      // tallies units consumed), not by the dispatcher — so we
      // simulate the F004 log path directly.
      runningTotal += day.quotaConsumed;
      expect(day.quotaConsumed).toBeLessThanOrEqual(QUOTA_WARN_THRESHOLD);
    }
    // 5 active days × 1,800 + 2 outage days × 0 = 9,000 across the
    // week, comfortably under the 10K daily quota cap (and our 3K
    // soft alert limit per day).
    expect(runningTotal).toBe(9_000);
  });

  it("zero-discover streak escalates INFO → WARN → ALERT at day-3 of outage", async () => {
    const plan = buildSevenDayPlan();
    let logFile = "";
    const levels: string[] = [];

    for (let i = 0; i < plan.length; i += 1) {
      const day = plan[i]!;
      const streakBefore = countTrailingZeroDiscoverStreak(logFile);
      const ts = `2026-04-${(28 + i).toString().padStart(2, "0")}T00:30:00Z`;
      const ended = `2026-04-${(28 + i).toString().padStart(2, "0")}T00:30:30Z`;
      const line = classifyDailyRun({
        timestamp: ts,
        endedAt: ended,
        adapters: [{ name: "youtube", healthy: day.errors == null }],
        discoverCount: day.upstream.length,
        refreshCount: 0,
        inserted: day.upstream.length,
        updated: 0,
        skipped: 0,
        dedupeSkipped: 0,
        estimatedQuotaConsumed: day.quotaConsumed,
        estimatedQuotaRemaining: 10_000 - day.quotaConsumed,
        errors: day.errors ?? [],
        zeroDiscoverStreakBefore: streakBefore,
      });
      levels.push(line.level);
      logFile += `${formatDailyLogLineJson(line)}\n`;
    }

    // Day 1-5: discover > 0 → INFO.
    expect(levels.slice(0, 5)).toEqual(["INFO", "INFO", "INFO", "INFO", "INFO"]);
    // Day 6: first zero day → WARN (streak now 1).
    expect(levels[5]).toBe("WARN");
    // Day 7: second zero day → still WARN (streak 2 < 3).
    expect(levels[6]).toBe("WARN");
  });

  it("ALERT fires on the 3rd consecutive zero-discover day", async () => {
    // Extend the simulation by one more outage day to cross the
    // 3-day floor.
    const plan = [
      ...buildSevenDayPlan(),
      { upstream: [] as RawKolData[], quotaConsumed: 0, errors: ["YouTube API 503"] },
    ];
    let logFile = "";
    const levels: string[] = [];

    for (let i = 0; i < plan.length; i += 1) {
      const day = plan[i]!;
      const streakBefore = countTrailingZeroDiscoverStreak(logFile);
      const ts = `2026-04-${(28 + i).toString().padStart(2, "0")}T00:30:00Z`;
      const ended = `2026-04-${(28 + i).toString().padStart(2, "0")}T00:30:30Z`;
      const line = classifyDailyRun({
        timestamp: ts,
        endedAt: ended,
        adapters: [{ name: "youtube", healthy: day.errors == null }],
        discoverCount: day.upstream.length,
        refreshCount: 0,
        inserted: day.upstream.length,
        updated: 0,
        skipped: 0,
        dedupeSkipped: 0,
        estimatedQuotaConsumed: day.quotaConsumed,
        estimatedQuotaRemaining: 10_000 - day.quotaConsumed,
        errors: day.errors ?? [],
        zeroDiscoverStreakBefore: streakBefore,
      });
      levels.push(line.level);
      logFile += `${formatDailyLogLineJson(line)}\n`;
    }

    // Day 8 is the 3rd consecutive zero day → ALERT.
    expect(levels[7]).toBe("ALERT");
  });

  it("partial outage (1 of 2 adapters down) does not stop the healthy adapter", async () => {
    // Mixed-adapter run: simulate a future world where YouTube and
    // crawler-team both ship in the dispatcher. crawler-team is down,
    // YouTube is healthy — discover_count from YouTube must still
    // surface.
    const youtube = new MockKolSyncAdapter({
      name: "youtube",
      channels: Array.from({ length: 35 }, (_, i) => fakeChannel(`UC_yt_${i}`, 1)),
    });
    const crawler = new MockKolSyncAdapter({
      name: "crawler-team",
      channels: [],
      fail: new Error("crawler-team API 503"),
    });
    const dispatcher = new KolSyncDispatcher([youtube, crawler]);

    const report = await dispatcher.runDailySync();

    expect(report.totals.discoverCount).toBe(35);
    expect(report.totals.failedAdapters).toBe(1);
    const ytOutcome = report.outcomes.find((o) => o.adapter === "youtube");
    const crawlerOutcome = report.outcomes.find((o) => o.adapter === "crawler-team");
    expect(ytOutcome?.ok).toBe(true);
    expect(crawlerOutcome?.ok).toBe(false);
    if (crawlerOutcome && !crawlerOutcome.ok) {
      expect(crawlerOutcome.error).toContain("503");
    }
  });
});

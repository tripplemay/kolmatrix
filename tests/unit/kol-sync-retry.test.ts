/**
 * B6-kol-daily-sync F004 · Retry + log classifier unit fixtures.
 *
 * Two suites:
 *   1. withRetry — backoff schedule, success / retry / exhaustion,
 *      onRetry observer fires once per attempt, sleep is injectable
 *      (so the spec mandate of 30s/2min/5min stays a unit-testable
 *      fact rather than a 7.5-minute wait).
 *   2. classifyDailyRun + countTrailingZeroDiscoverStreak — every
 *      alert threshold from the runbook (quota / zero-discover /
 *      errors / duration) has a green path and a tripped path; the
 *      streak helper tolerates malformed log lines.
 */
import { describe, expect, it, vi } from "vitest";

import {
  classifyDailyRun,
  countTrailingZeroDiscoverStreak,
  formatDailyLogLineJson,
  type DailyLogLineInput,
} from "@/lib/kol-sync/log";
import { DEFAULT_BACKOFFS_MS, withRetry } from "@/lib/kol-sync/retry";

describe("withRetry", () => {
  it("returns the first successful result without sleeping", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => "ok");
    const out = await withRetry(fn, { sleep });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("default backoff schedule is 30s / 2min / 5min (spec lock)", () => {
    expect(DEFAULT_BACKOFFS_MS).toEqual([30_000, 120_000, 300_000]);
  });

  it("retries with the configured backoff and reports each attempt", async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt += 1;
      if (attempt < 3) throw new Error(`boom ${attempt}`);
      return "ok";
    });
    const out = await withRetry(fn, {
      backoffsMs: [10, 20, 30],
      sleep,
      onRetry,
    });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 20);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
  });

  it("rethrows the last error after exhausting retries (1 initial + N retries)", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error("permanent");
    });
    await expect(withRetry(fn, { backoffsMs: [1, 1, 1], sleep })).rejects.toThrow(/permanent/);
    // 1 initial attempt + 3 retries = 4 calls.
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("rejects with a real Error even when the underlying throw was a string", async () => {
    const fn = vi.fn(async () => {
      // Lib code can throw non-Error values; the helper must wrap them
      // so the catcher always gets a stack to log.

      throw "plain-string";
    });
    await expect(withRetry(fn, { backoffsMs: [], sleep: async () => {} })).rejects.toBeInstanceOf(
      Error
    );
  });
});

describe("classifyDailyRun", () => {
  function baseInput(over: Partial<DailyLogLineInput> = {}): DailyLogLineInput {
    return {
      timestamp: "2026-04-29T00:30:00.000Z",
      endedAt: "2026-04-29T00:30:46.000Z",
      adapters: [{ name: "youtube", healthy: true }],
      discoverCount: 47,
      refreshCount: 200,
      inserted: 35,
      updated: 212,
      skipped: 0,
      dedupeSkipped: 0,
      estimatedQuotaConsumed: 1_815,
      estimatedQuotaRemaining: 8_185,
      errors: [],
      zeroDiscoverStreakBefore: 0,
      ...over,
    };
  }

  it("INFO when every threshold is green", () => {
    const out = classifyDailyRun(baseInput());
    expect(out.level).toBe("INFO");
    expect(out.alerts).toEqual([]);
    expect(out.durationMs).toBe(46_000);
  });

  it("WARN when quota_consumed > 9,500 (BIx-F004-P5 raised threshold)", () => {
    const out = classifyDailyRun(baseInput({ estimatedQuotaConsumed: 9_700 }));
    expect(out.level).toBe("WARN");
    expect(out.alerts.some((a) => a.includes("quota_consumed=9700"))).toBe(true);
  });

  it("WARN on a single zero-discover day, ALERT on the third in a row", () => {
    const day1 = classifyDailyRun(baseInput({ discoverCount: 0, zeroDiscoverStreakBefore: 0 }));
    expect(day1.level).toBe("WARN");
    expect(day1.alerts.some((a) => a.includes("streak=1/3"))).toBe(true);

    const day2 = classifyDailyRun(baseInput({ discoverCount: 0, zeroDiscoverStreakBefore: 1 }));
    expect(day2.level).toBe("WARN");

    const day3 = classifyDailyRun(baseInput({ discoverCount: 0, zeroDiscoverStreakBefore: 2 }));
    expect(day3.level).toBe("ALERT");
    expect(day3.alerts.some((a) => a.includes("streak=3/3"))).toBe(true);
  });

  it("WARN when there is any non-empty error", () => {
    const out = classifyDailyRun(baseInput({ errors: ["upstream 500"] }));
    expect(out.level).toBe("WARN");
    expect(out.alerts.some((a) => a.includes("errors=1"))).toBe(true);
  });

  it("WARN when duration > 5 minutes", () => {
    const out = classifyDailyRun(
      baseInput({
        timestamp: "2026-04-29T00:00:00.000Z",
        endedAt: "2026-04-29T00:06:00.000Z",
      })
    );
    expect(out.level).toBe("WARN");
    expect(out.alerts.some((a) => a.includes("duration_ms=360000"))).toBe(true);
  });

  it("formatDailyLogLineJson stringifies a parseable JSON line", () => {
    const out = classifyDailyRun(baseInput());
    const json = formatDailyLogLineJson(out);
    const round = JSON.parse(json);
    expect(round.level).toBe("INFO");
    expect(round.discoverCount).toBe(47);
  });
});

describe("countTrailingZeroDiscoverStreak", () => {
  function line(discoverCount: number): string {
    return JSON.stringify({ discoverCount });
  }

  it("returns 0 on empty / whitespace input", () => {
    expect(countTrailingZeroDiscoverStreak("")).toBe(0);
    expect(countTrailingZeroDiscoverStreak("\n\n  \n")).toBe(0);
  });

  it("counts the trailing run of zero-discover days only", () => {
    const log = [line(50), line(0), line(0), line(0)].join("\n");
    expect(countTrailingZeroDiscoverStreak(log)).toBe(3);
  });

  it("stops the streak at the first non-zero (older) line", () => {
    const log = [line(0), line(50), line(0), line(0)].join("\n");
    expect(countTrailingZeroDiscoverStreak(log)).toBe(2);
  });

  it("tolerates malformed JSON: stops at the first bad line", () => {
    const log = [line(0), "not-json-at-all", line(0)].join("\n");
    // Walks backward: line(0) → +1, then "not-json" → stop. Streak=1.
    expect(countTrailingZeroDiscoverStreak(log)).toBe(1);
  });

  it("accepts both discoverCount and discover_count keys (legacy compat)", () => {
    const log = [JSON.stringify({ discover_count: 0 }), JSON.stringify({ discover_count: 0 })].join(
      "\n"
    );
    expect(countTrailingZeroDiscoverStreak(log)).toBe(2);
  });
});

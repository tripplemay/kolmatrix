import { describe, expect, it } from "vitest";

import {
  assembleCrawlerControlState,
  loadCrawlerControlState,
} from "@/lib/admin/crawler-control-state";
import type { CrawlerStats } from "@/lib/admin/crawler-monitor-client";

// BL-108-F003 · 状态装配:开关态 + 暂停时长(暂停中才算) + 积压/最近 refresh,
// 以及爬虫不可达的 unknown 降级(不 500)。

const NOW = new Date("2026-06-10T06:00:00Z");

const STATE_ON = {
  scrapingEnabled: true,
  refreshEnabled: true,
  updatedAt: "2026-06-08T06:00:00Z",
  updatedBy: "kimi",
};

const STATS = {
  refreshBacklog: { total: 3215, dueNow: 142 },
  lastRefreshAt: "2026-06-10T02:00:00Z",
} as Pick<CrawlerStats, "refreshBacklog" | "lastRefreshAt">;

describe("assembleCrawlerControlState", () => {
  it("both ON → availability ok, 暂停时长不计", () => {
    const r = assembleCrawlerControlState({ state: STATE_ON, stats: STATS, now: NOW });
    expect(r).toEqual({
      availability: "ok",
      scrapingEnabled: true,
      refreshEnabled: true,
      updatedAt: "2026-06-08T06:00:00Z",
      updatedBy: "kimi",
      pausedDurationMs: null,
      refreshBacklogDueNow: 142,
      lastRefreshAt: "2026-06-10T02:00:00Z",
    });
  });

  it("主开关 OFF → 暂停时长 = now - updatedAt(48h)", () => {
    const r = assembleCrawlerControlState({
      state: { ...STATE_ON, scrapingEnabled: false },
      stats: STATS,
      now: NOW,
    });
    expect(r.pausedDurationMs).toBe(48 * 60 * 60 * 1000);
  });

  it("仅子开关 OFF → 同样算暂停中(refresh 冻结也要可视)", () => {
    const r = assembleCrawlerControlState({
      state: { ...STATE_ON, refreshEnabled: false },
      stats: STATS,
      now: NOW,
    });
    expect(r.pausedDurationMs).toBe(48 * 60 * 60 * 1000);
  });

  it("暂停中但 updatedAt 缺失/非法 → 时长 null 不 NaN", () => {
    const noTs = assembleCrawlerControlState({
      state: { ...STATE_ON, scrapingEnabled: false, updatedAt: null },
      stats: STATS,
      now: NOW,
    });
    expect(noTs.pausedDurationMs).toBeNull();
    const badTs = assembleCrawlerControlState({
      state: { ...STATE_ON, scrapingEnabled: false, updatedAt: "not-a-date" },
      stats: STATS,
      now: NOW,
    });
    expect(badTs.pausedDurationMs).toBeNull();
  });

  it("state 不可达 → unknown 态:开关 null, stats 字段仍尽量给", () => {
    const r = assembleCrawlerControlState({ state: null, stats: STATS, now: NOW });
    expect(r.availability).toBe("unknown");
    expect(r.scrapingEnabled).toBeNull();
    expect(r.refreshEnabled).toBeNull();
    expect(r.refreshBacklogDueNow).toBe(142);
  });

  it("stats 降级 → 积压/最近 refresh null, 开关照常", () => {
    const r = assembleCrawlerControlState({ state: STATE_ON, stats: null, now: NOW });
    expect(r.availability).toBe("ok");
    expect(r.refreshBacklogDueNow).toBeNull();
    expect(r.lastRefreshAt).toBeNull();
  });
});

describe("loadCrawlerControlState", () => {
  it("两路并发拉取, 任一 reject 都吞掉降级(绝不抛)", async () => {
    const ok = await loadCrawlerControlState({
      state: async () => STATE_ON,
      stats: async () => STATS as CrawlerStats,
      now: NOW,
    });
    expect(ok.availability).toBe("ok");
    expect(ok.refreshBacklogDueNow).toBe(142);

    const stateDown = await loadCrawlerControlState({
      state: async () => {
        throw new Error("ECONNREFUSED");
      },
      stats: async () => STATS as CrawlerStats,
      now: NOW,
    });
    expect(stateDown.availability).toBe("unknown");

    const statsDown = await loadCrawlerControlState({
      state: async () => STATE_ON,
      stats: async () => {
        throw new Error("timeout");
      },
      now: NOW,
    });
    expect(statsDown.availability).toBe("ok");
    expect(statsDown.refreshBacklogDueNow).toBeNull();
  });
});

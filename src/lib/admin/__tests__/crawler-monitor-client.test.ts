import { describe, expect, it, vi } from "vitest";

import {
  CrawlerMonitorError,
  computeHealthLights,
  fetchCrawlerStats,
  type CrawlerStats,
} from "@/lib/admin/crawler-monitor-client";

const BASE = "https://apify.test";
const KEY = "admin-key";

function jsonResponse(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

const FULL = {
  tikhubBalanceUsd: 244.71,
  tikhubFreeCreditUsd: 0,
  apifyCostThisMonthUsd: 12.5,
  observedAt: "2026-06-08T00:00:00Z",
  drain: { scrapeQueueByState: [{ state: "created", count: 30 }], manualSeedByStatus: [{ status: "queued", count: 7 }], manualSeedInsertedToday: 64 },
  ingestRateByDay: [{ day: "2026-06-08", count: 93 }],
  scrapeCompositionToday: [{ kind: "refresh", jobs: 800, scraped: 14000, inserted: 120, costUsd: 2.2 }],
  ytEmailByStatus: [{ status: "succeeded", count: 339 }],
  igToday: { scraped: 0, inserted: 0 },
  refreshBacklog: { total: 3215, dueNow: 142 },
  costTodayUsd: 2.7,
};

describe("fetchCrawlerStats", () => {
  it("config error when env missing", async () => {
    await expect(fetchCrawlerStats({ baseUrl: "", apiKey: KEY })).rejects.toMatchObject({ kind: "config" });
    await expect(fetchCrawlerStats({ baseUrl: BASE, apiKey: "" })).rejects.toMatchObject({ kind: "config" });
  });

  it("parses a full /admin/stats response", async () => {
    const stats = await fetchCrawlerStats({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse(FULL) });
    expect(stats.tikhubBalanceUsd).toBe(244.71);
    expect(stats.drain.manualSeedInsertedToday).toBe(64);
    expect(stats.scrapeCompositionToday[0].inserted).toBe(120);
    expect(stats.refreshBacklog.dueNow).toBe(142);
  });

  it("gracefully degrades against an OLD /admin/stats (BL-096 fields absent → defaults)", async () => {
    const OLD = { tikhubBalanceUsd: 100, tikhubFreeCreditUsd: 0, apifyCostThisMonthUsd: 5 };
    const stats = await fetchCrawlerStats({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse(OLD) });
    expect(stats.tikhubBalanceUsd).toBe(100);
    expect(stats.drain.manualSeedInsertedToday).toBe(0);
    expect(stats.ingestRateByDay).toEqual([]);
    expect(stats.scrapeCompositionToday).toEqual([]);
    expect(stats.refreshBacklog).toEqual({ total: 0, dueNow: 0 });
  });

  it("401 → unauthorized; 429 → rate_limit; 500 → transient", async () => {
    await expect(fetchCrawlerStats({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({}, 401) })).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(fetchCrawlerStats({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({}, 429) })).rejects.toMatchObject({ kind: "rate_limit" });
    await expect(fetchCrawlerStats({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({}, 500) })).rejects.toMatchObject({ kind: "transient" });
  });

  it("AbortError → timeout error", async () => {
    const aborting = vi.fn(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }) as unknown as typeof fetch;
    await expect(fetchCrawlerStats({ baseUrl: BASE, apiKey: KEY, fetch: aborting })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("CrawlerMonitorError carries kind", async () => {
    const err = await fetchCrawlerStats({ baseUrl: "", apiKey: KEY }).catch((e) => e);
    expect(err).toBeInstanceOf(CrawlerMonitorError);
  });
});

describe("computeHealthLights", () => {
  const base = (over: Partial<CrawlerStats>): CrawlerStats => ({
    tikhubBalanceUsd: 244, tikhubFreeCreditUsd: 0, apifyCostThisMonthUsd: 0,
    drain: { scrapeQueueByState: [], manualSeedByStatus: [], manualSeedInsertedToday: 0 },
    ingestRateByDay: [],
    scrapeCompositionToday: [{ kind: "refresh", jobs: 800, scraped: 14000, inserted: 120, costUsd: 2 }],
    ytEmailByStatus: [], igToday: { scraped: 10, inserted: 5 },
    refreshBacklog: { total: 0, dueNow: 0 }, costTodayUsd: 0, ...over,
  });

  it("balance: ok / warn / critical / null→warn", () => {
    const st = (b: number | null) => computeHealthLights(base({ tikhubBalanceUsd: b })).find((l) => l.id === "balance")!.status;
    expect(st(244)).toBe("ok");
    expect(st(40)).toBe("warn");
    expect(st(10)).toBe("critical");
    expect(st(null)).toBe("warn");
  });

  it("ingest: critical when jobs ran today but 0 inserted (silent stall)", () => {
    const stall = base({ scrapeCompositionToday: [{ kind: "refresh", jobs: 500, scraped: 9000, inserted: 0, costUsd: 1 }] });
    expect(computeHealthLights(stall).find((l) => l.id === "ingest")!.status).toBe("critical");
    expect(computeHealthLights(base({})).find((l) => l.id === "ingest")!.status).toBe("ok");
  });

  it("instagram: warn when hashtag/manual_seed ran but IG inserted 0 (BL-095 watch)", () => {
    const igZero = base({
      scrapeCompositionToday: [{ kind: "hashtag", jobs: 10, scraped: 200, inserted: 30, costUsd: 1 }],
      igToday: { scraped: 200, inserted: 0 },
    });
    expect(computeHealthLights(igZero).find((l) => l.id === "instagram")!.status).toBe("warn");
  });
});

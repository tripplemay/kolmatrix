import { describe, expect, it, vi } from "vitest";

import {
  fetchCrawlerState,
  patchCrawlerState,
} from "@/lib/admin/crawler-state-client";

// BL-108-F003 · /admin/crawler-state GET/PATCH 客户端。
// 错误分类与 crawler-monitor-client 一致(共用 CrawlerMonitorError)。

const BASE = "https://apify.test";
const KEY = "admin-key";

const STATE = {
  scrapingEnabled: true,
  refreshEnabled: false,
  updatedAt: "2026-06-10T03:00:00.000Z",
  updatedBy: "kimi",
};

function jsonResponse(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("fetchCrawlerState", () => {
  it("config error when env missing", async () => {
    await expect(fetchCrawlerState({ baseUrl: "", apiKey: KEY })).rejects.toMatchObject({ kind: "config" });
    await expect(fetchCrawlerState({ baseUrl: BASE, apiKey: "" })).rejects.toMatchObject({ kind: "config" });
  });

  it("GET 解析开关状态", async () => {
    const fetchMock = jsonResponse(STATE);
    const state = await fetchCrawlerState({ baseUrl: BASE, apiKey: KEY, fetch: fetchMock });
    expect(state).toEqual(STATE);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE}/admin/crawler-state`);
    expect((init as RequestInit).method).toBe("GET");
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": KEY });
  });

  it("401 → unauthorized; 500 → transient; 非 JSON → parse; schema 不符 → parse", async () => {
    await expect(fetchCrawlerState({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({}, 401) })).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(fetchCrawlerState({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({}, 500) })).rejects.toMatchObject({ kind: "transient" });
    const htmlFetch = vi.fn(async () => new Response("<html>oops</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchCrawlerState({ baseUrl: BASE, apiKey: KEY, fetch: htmlFetch })).rejects.toMatchObject({ kind: "parse" });
    await expect(
      fetchCrawlerState({ baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({ scrapingEnabled: "yes" }) }),
    ).rejects.toMatchObject({ kind: "parse" });
  });
});

describe("patchCrawlerState", () => {
  it("PATCH 带 JSON body(开关 + updatedBy)并返回爬虫确认后的状态", async () => {
    const fetchMock = jsonResponse({ ...STATE, scrapingEnabled: false });
    const state = await patchCrawlerState(
      { scrapingEnabled: false, updatedBy: "marketer@kolmatrix.local" },
      { baseUrl: BASE, apiKey: KEY, fetch: fetchMock },
    );
    expect(state.scrapingEnabled).toBe(false);

    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${BASE}/admin/crawler-state`);
    const req = init as RequestInit;
    expect(req.method).toBe("PATCH");
    expect(req.headers).toMatchObject({
      "x-api-key": KEY,
      "content-type": "application/json",
    });
    expect(JSON.parse(String(req.body))).toEqual({
      scrapingEnabled: false,
      updatedBy: "marketer@kolmatrix.local",
    });
  });

  it("爬虫拒绝(503) → transient(UI 据此回滚乐观态)", async () => {
    await expect(
      patchCrawlerState({ refreshEnabled: true, updatedBy: "x" }, { baseUrl: BASE, apiKey: KEY, fetch: jsonResponse({}, 503) }),
    ).rejects.toMatchObject({ kind: "transient", status: 503 });
  });
});

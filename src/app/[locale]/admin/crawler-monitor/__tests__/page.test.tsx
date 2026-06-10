/**
 * BL-096-F002 · /[locale]/admin/crawler-monitor server-component spec.
 *
 * Auth gate (platform_admin renders / marketer + unauth redirect) + fetch
 * error → graceful degrade banner. Health lights + cards render from mocked
 * stats; computeHealthLights stays real (importActual).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { namespace: string }) =>
    (key: string) => `${namespace}.${key}`,
}));

const fetchCrawlerStatsMock = vi.fn();
vi.mock("@/lib/admin/crawler-monitor-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/crawler-monitor-client")>(
    "@/lib/admin/crawler-monitor-client",
  );
  return { ...actual, fetchCrawlerStats: (...a: unknown[]) => fetchCrawlerStatsMock(...a) };
});

vi.mock("../IngestRateChart", () => ({
  IngestRateChart: (props: { data: unknown[] }) => (
    <div data-testid="ingest-chart-stub">stub:{props.data.length}</div>
  ),
}));

// BL-108-F003/F004 — 开关态拉取 + 控制面客户端组件(组件本体有专属 spec,
// 页面层只断言装配结果传入)
const fetchCrawlerStateMock = vi.fn();
vi.mock("@/lib/admin/crawler-state-client", () => ({
  fetchCrawlerState: (...a: unknown[]) => fetchCrawlerStateMock(...a),
}));
vi.mock("../CrawlerPauseControls", () => ({
  CrawlerPauseControls: (props: {
    control: {
      availability: string;
      refreshBacklogDueNow: number | null;
      lastRefreshAt: string | null;
    };
  }) => (
    <div data-testid="pause-controls-stub">
      stub:{props.control.availability}:backlog={String(props.control.refreshBacklogDueNow)}
      :last={String(props.control.lastRefreshAt)}
    </div>
  ),
}));

import CrawlerMonitorPage from "../page";

const platformAdmin = { user: { id: "u1", role: "platform_admin", email: "a@x.com" } };
const marketer = { user: { id: "u2", role: "marketer", email: "m@x.com" } };

const STATS = {
  tikhubBalanceUsd: 244.71, tikhubFreeCreditUsd: 0, apifyCostThisMonthUsd: 12.5,
  drain: { scrapeQueueByState: [{ state: "created", count: 30 }], manualSeedByStatus: [], manualSeedInsertedToday: 64 },
  ingestRateByDay: [{ day: "2026-06-08", count: 93 }],
  scrapeCompositionToday: [{ kind: "refresh", jobs: 800, scraped: 14000, inserted: 120, costUsd: 2.2 }],
  ytEmailByStatus: [{ status: "succeeded", count: 339 }],
  igToday: { scraped: 0, inserted: 0 },
  refreshBacklog: { total: 3215, dueNow: 142 }, costTodayUsd: 2.7,
};

const render = async () =>
  renderToStaticMarkup(await CrawlerMonitorPage({ params: Promise.resolve({ locale: "en" }) }));

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
  fetchCrawlerStatsMock.mockReset();
  fetchCrawlerStateMock.mockReset();
  fetchCrawlerStateMock.mockResolvedValue({
    scrapingEnabled: true,
    refreshEnabled: true,
    updatedAt: "2026-06-10T03:00:00.000Z",
    updatedBy: "kimi",
  });
});
afterEach(() => vi.clearAllMocks());

describe("BL-096-F002 /admin/crawler-monitor", () => {
  it("platform_admin: renders banner + health lights + cards", async () => {
    authMock.mockResolvedValue(platformAdmin);
    fetchCrawlerStatsMock.mockResolvedValue(STATS);
    const html = await render();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("crawler-monitor-readonly-banner");
    expect(html).toContain("crawler-monitor-health");
    expect(html).toContain("card-ingest-rate");
    expect(html).toContain("card-balances");
    expect(html).toContain("ingest-chart-stub");
    expect(html).toContain("pause-controls-stub");
    // 装配复用页面已拉的 stats(dueNow 142), 且只拉一次 /admin/stats
    expect(html).toContain("stub:ok:backlog=142");
    expect(fetchCrawlerStatsMock).toHaveBeenCalledTimes(1);
    expect(html).not.toContain("crawler-monitor-fetch-error");
  });

  it("BL-108-F004: 爬虫 state 不可达 → 控制面收到 unknown 态, 页面不挂", async () => {
    authMock.mockResolvedValue(platformAdmin);
    fetchCrawlerStatsMock.mockResolvedValue(STATS);
    fetchCrawlerStateMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const html = await render();
    expect(html).toContain("stub:unknown");
    expect(html).toContain("card-ingest-rate");
  });

  it("marketer → redirect to /insight", async () => {
    authMock.mockResolvedValue(marketer);
    await expect(render()).rejects.toThrow(/NEXT_REDIRECT:\/en\/insight/);
  });

  it("unauthenticated → redirect to /login", async () => {
    authMock.mockResolvedValue(null);
    await expect(render()).rejects.toThrow(/NEXT_REDIRECT:\/en\/login/);
  });

  it("fetch error → graceful degrade banner, no cards; 暂停控制面独立于 stats 仍渲染", async () => {
    authMock.mockResolvedValue(platformAdmin);
    const { CrawlerMonitorError } = await import("@/lib/admin/crawler-monitor-client");
    fetchCrawlerStatsMock.mockRejectedValue(new CrawlerMonitorError("config", "APIFY_KOL_ADMIN_API_KEY is not set"));
    const html = await render();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("crawler-monitor-fetch-error");
    expect(html).not.toContain("card-ingest-rate");
    // BL-108-F004: 开关可用性独立于 stats — stats 挂了控制面也要在(backlog 降级 null)
    expect(html).toContain("stub:ok:backlog=null");
  });
});

/**
 * BL-108-F003 · 暂停控制面状态装配(server-only)。
 *
 * 把两路上游捏成一个 UI 可直接渲染的结构:
 *   - /admin/crawler-state(开关本体, crawler-state-client)
 *   - /admin/stats(积压 dueNow + lastRefreshAt, crawler-monitor-client)
 *
 * 降级语义(ADR-019 D5 — 爬虫不可达不能把监控页打挂):
 *   - state 拉不到 → availability='unknown', 开关字段 null, UI 显示未知态(不 500)
 *   - stats 拉不到(state 正常) → 开关照常可用, 仅积压/最近 refresh 字段 null
 *
 * 暂停时长:开关处于暂停(主 OFF 或 子 OFF)时才计算, = now - updatedAt
 * (updatedAt 即最近一次翻开关的时刻);开着不算(D6: 把"忘了恢复"做成可视)。
 */
import {
  fetchCrawlerStats,
  type CrawlerStats,
} from "./crawler-monitor-client";
import {
  fetchCrawlerState,
  type CrawlerState,
} from "./crawler-state-client";

export interface CrawlerControlState {
  /** unknown = 爬虫 /admin/crawler-state 不可达(开关态不可信, UI 禁操作) */
  availability: "ok" | "unknown";
  scrapingEnabled: boolean | null;
  refreshEnabled: boolean | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** 任一开关暂停中才有值: now - updatedAt(毫秒) */
  pausedDurationMs: number | null;
  /** 积压过期 refresh 数(kols next_refresh_at<=now); stats 降级时 null */
  refreshBacklogDueNow: number | null;
  /** 最近一次 refresh 入队时间; 无历史或 stats 降级/旧版时 null */
  lastRefreshAt: string | null;
}

export function assembleCrawlerControlState(input: {
  state: CrawlerState | null;
  stats: Pick<CrawlerStats, "refreshBacklog" | "lastRefreshAt"> | null;
  now: Date;
}): CrawlerControlState {
  const { state, stats, now } = input;

  if (!state) {
    return {
      availability: "unknown",
      scrapingEnabled: null,
      refreshEnabled: null,
      updatedAt: null,
      updatedBy: null,
      pausedDurationMs: null,
      refreshBacklogDueNow: stats ? stats.refreshBacklog.dueNow : null,
      lastRefreshAt: stats?.lastRefreshAt ?? null,
    };
  }

  const paused = !state.scrapingEnabled || !state.refreshEnabled;
  let pausedDurationMs: number | null = null;
  if (paused && state.updatedAt) {
    const flippedAt = new Date(state.updatedAt).getTime();
    if (Number.isFinite(flippedAt)) {
      pausedDurationMs = Math.max(0, now.getTime() - flippedAt);
    }
  }

  return {
    availability: "ok",
    scrapingEnabled: state.scrapingEnabled,
    refreshEnabled: state.refreshEnabled,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy,
    pausedDurationMs,
    refreshBacklogDueNow: stats ? stats.refreshBacklog.dueNow : null,
    lastRefreshAt: stats?.lastRefreshAt ?? null,
  };
}

/**
 * 页面 loader:两路并发拉取, 任一失败按上面的降级语义吞掉(绝不抛)。
 * stats 复用监控页同一接口 — 页面本就要拉 stats 时调用方可自己传入,
 * 避免重复请求(见 page.tsx 的用法)。
 */
export async function loadCrawlerControlState(deps?: {
  state?: () => Promise<CrawlerState>;
  stats?: () => Promise<CrawlerStats>;
  now?: Date;
}): Promise<CrawlerControlState> {
  const [stateResult, statsResult] = await Promise.allSettled([
    (deps?.state ?? fetchCrawlerState)(),
    (deps?.stats ?? fetchCrawlerStats)(),
  ]);

  return assembleCrawlerControlState({
    state: stateResult.status === "fulfilled" ? stateResult.value : null,
    stats: statsResult.status === "fulfilled" ? statsResult.value : null,
    now: deps?.now ?? new Date(),
  });
}

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CrawlerMonitorError } from "@/lib/admin/crawler-monitor-client";

// BL-108-F003 · setCrawlerStateAction:admin 鉴权 → PATCH 代理 → 审计 → 优雅错误。

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const patchCrawlerState = vi.fn();
vi.mock("@/lib/admin/crawler-state-client", () => ({
  patchCrawlerState: (...a: unknown[]) => patchCrawlerState(...a),
}));

const logEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));

import { setCrawlerStateAction } from "../actions";

const ADMIN_SESSION = {
  user: { id: "u1", email: "admin@kolmatrix.local", role: "platform_admin", tenantId: "t1" },
};

const STATE = {
  scrapingEnabled: false,
  refreshEnabled: true,
  updatedAt: "2026-06-10T03:00:00.000Z",
  updatedBy: "admin@kolmatrix.local",
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(ADMIN_SESSION);
  patchCrawlerState.mockResolvedValue(STATE);
});

describe("setCrawlerStateAction", () => {
  it("非 admin / 未登录 → unauthorized, 不触代理", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await setCrawlerStateAction({ scrapingEnabled: false })).toEqual({
      ok: false,
      error: "unauthorized",
    });

    authMock.mockResolvedValueOnce({ user: { id: "u2", role: "marketer" } });
    expect(await setCrawlerStateAction({ scrapingEnabled: false })).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(patchCrawlerState).not.toHaveBeenCalled();
  });

  it("无任何开关字段 → invalid_input", async () => {
    expect(await setCrawlerStateAction({})).toEqual({ ok: false, error: "invalid_input" });
    expect(patchCrawlerState).not.toHaveBeenCalled();
  });

  it("翻主开关:updatedBy=登录 email 透传, 审计落 event_log, 返回爬虫确认态", async () => {
    const r = await setCrawlerStateAction({ scrapingEnabled: false });
    expect(r).toEqual({ ok: true, state: STATE });
    expect(patchCrawlerState).toHaveBeenCalledWith({
      scrapingEnabled: false,
      updatedBy: "admin@kolmatrix.local",
    });
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "crawler.state_toggled",
        actorId: "u1",
        payload: expect.objectContaining({ scrapingEnabled: false, resultState: STATE }),
      }),
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("爬虫不可达 → { ok:false, error:kind } 不抛(UI 回滚乐观态)", async () => {
    patchCrawlerState.mockRejectedValueOnce(new CrawlerMonitorError("timeout", "timed out"));
    expect(await setCrawlerStateAction({ refreshEnabled: false })).toEqual({
      ok: false,
      error: "timeout",
    });

    patchCrawlerState.mockRejectedValueOnce(new Error("boom"));
    expect(await setCrawlerStateAction({ refreshEnabled: false })).toEqual({
      ok: false,
      error: "transient",
    });
    expect(logEvent).not.toHaveBeenCalled();
  });
});

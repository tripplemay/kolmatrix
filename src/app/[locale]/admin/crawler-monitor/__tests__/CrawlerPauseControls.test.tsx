/**
 * BL-108-F004 · CrawlerPauseControls 组件 spec。
 *
 * 覆盖:开关渲染语义(checked=暂停) / 主暂停时子置灰 / unknown 禁用 /
 * 确认弹窗流(取消不触 action) / 乐观翻转 + 失败回滚 + 错误条 /
 * 成功后采用爬虫确认态。admin 门禁在 page 层(redirect),见 page.test。
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CrawlerControlState } from "@/lib/admin/crawler-control-state";

const setCrawlerStateAction = vi.fn();
vi.mock("../actions", () => ({
  setCrawlerStateAction: (...a: unknown[]) => setCrawlerStateAction(...a),
}));

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

import { CrawlerPauseControls } from "../CrawlerPauseControls";

const messages = {
  admin: {
    crawlerMonitor: {
      pause: {
        title: "Pause controls",
        statusRunning: "Running",
        statusPaused: "Paused",
        statusUnknown: "Unknown",
        pausedFor: "paused for {duration}",
        durationDays: "{days}d {hours}h",
        durationHours: "{hours}h {minutes}m",
        durationMinutes: "{minutes}m",
        unknownNote: "Crawler unreachable",
        mainLabel: "Pause all crawler scraping",
        mainDesc: "Stops every scrape enqueue.",
        subLabel: "Pause refresh only",
        subDesc: "Freezes metric refresh.",
        subCovered: "Already covered by the main pause switch",
        backlogDueNow: "Overdue refresh backlog",
        lastRefresh: "Last refresh enqueue",
        updatedBy: "Last change by",
        never: "never",
        confirmTitle: "Confirm switch change",
        confirmPauseMain: "PAUSE-MAIN-WARNING",
        confirmResumeMain: "RESUME-MAIN-INFO",
        confirmPauseSub: "PAUSE-SUB-WARNING",
        confirmResumeSub: "RESUME-SUB-INFO",
        confirm: "Confirm",
        cancel: "Cancel",
        applyFailed: "Failed to apply ({error}) — switch reverted.",
      },
    },
  },
};

const BASE: CrawlerControlState = {
  availability: "ok",
  scrapingEnabled: true,
  refreshEnabled: true,
  updatedAt: "2026-06-08T06:00:00Z",
  updatedBy: "kimi",
  pausedDurationMs: null,
  refreshBacklogDueNow: 142,
  lastRefreshAt: "2026-06-10 02:00:00+00",
};

function renderControls(control: Partial<CrawlerControlState> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CrawlerPauseControls control={{ ...BASE, ...control }} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setCrawlerStateAction.mockResolvedValue({
    ok: true,
    state: {
      scrapingEnabled: false,
      refreshEnabled: true,
      updatedAt: "2026-06-10 06:00:00+00",
      updatedBy: "admin@kolmatrix.local",
    },
  });
});

describe("CrawlerPauseControls", () => {
  it("运行中:两开关 unchecked, 状态 Running, 装配字段渲染", () => {
    renderControls();
    expect(screen.getByTestId("pause-status").dataset.state).toBe("running");
    expect(screen.getByTestId("pause-main-switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("pause-refresh-switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("pause-refresh-switch")).not.toBeDisabled();
    expect(screen.getByTestId("pause-backlog").textContent).toBe("142");
    expect(screen.getByTestId("pause-updated-by").textContent).toBe("kimi");
  });

  it("主暂停:子开关置灰且显示已覆盖, 状态 Paused + 时长", () => {
    renderControls({
      scrapingEnabled: false,
      pausedDurationMs: 48 * 60 * 60 * 1000,
    });
    expect(screen.getByTestId("pause-status").dataset.state).toBe("paused");
    expect(screen.getByTestId("pause-main-switch")).toHaveAttribute("aria-checked", "true");
    const sub = screen.getByTestId("pause-refresh-switch");
    expect(sub).toBeDisabled();
    expect(sub).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Already covered by the main pause switch")).toBeInTheDocument();
    expect(screen.getByText("paused for 2d 0h")).toBeInTheDocument();
  });

  it("unknown 态:两开关禁用 + 提示条", () => {
    renderControls({
      availability: "unknown",
      scrapingEnabled: null,
      refreshEnabled: null,
    });
    expect(screen.getByTestId("pause-status").dataset.state).toBe("unknown");
    expect(screen.getByTestId("pause-main-switch")).toBeDisabled();
    expect(screen.getByTestId("pause-refresh-switch")).toBeDisabled();
    expect(screen.getByTestId("pause-unknown-note")).toBeInTheDocument();
  });

  it("确认流:点主开关弹确认(讲清代价), 取消不触 action", async () => {
    renderControls();
    fireEvent.click(screen.getByTestId("pause-main-switch"));
    expect(await screen.findByText("PAUSE-MAIN-WARNING")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("pause-confirm-cancel"));
    await waitFor(() =>
      expect(screen.getByTestId("pause-main-switch")).toHaveAttribute("aria-checked", "false"),
    );
    expect(setCrawlerStateAction).not.toHaveBeenCalled();
  });

  it("确认后乐观翻转 + 调 action + 采用爬虫确认态", async () => {
    renderControls();
    fireEvent.click(screen.getByTestId("pause-main-switch"));
    fireEvent.click(await screen.findByTestId("pause-confirm-accept"));

    await waitFor(() =>
      expect(setCrawlerStateAction).toHaveBeenCalledWith({ scrapingEnabled: false }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("pause-main-switch")).toHaveAttribute("aria-checked", "true"),
    );
    expect(routerRefresh).toHaveBeenCalled();
    expect(screen.queryByTestId("pause-error")).not.toBeInTheDocument();
  });

  it("action 失败:回滚开关 + 错误条(乐观 UI 回滚)", async () => {
    setCrawlerStateAction.mockResolvedValueOnce({ ok: false, error: "timeout" });
    renderControls();
    fireEvent.click(screen.getByTestId("pause-main-switch"));
    fireEvent.click(await screen.findByTestId("pause-confirm-accept"));

    expect(await screen.findByTestId("pause-error")).toHaveTextContent(
      "Failed to apply (timeout) — switch reverted.",
    );
    expect(screen.getByTestId("pause-main-switch")).toHaveAttribute("aria-checked", "false");
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("子开关确认文案区分 refresh 语义", async () => {
    renderControls();
    fireEvent.click(screen.getByTestId("pause-refresh-switch"));
    expect(await screen.findByText("PAUSE-SUB-WARNING")).toBeInTheDocument();
  });
});

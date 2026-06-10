/**
 * BL-108 reverify fix-round 2 · 水合门闸回归。
 *
 * 复现并守门 Codex reverify 的"开关点击不生效"根因:RTL render() 是纯客户端
 * 渲染, 从不经过 SSR+hydrate, 因此测不到"按钮已渲染但 onClick 尚未绑定"的
 * 水合窗口。这里走真实路径 renderToString(SSR) → hydrateRoot(水合) →
 * dispatch click, 锁住:
 *   1. SSR 阶段两开关 disabled(ready=false)→ 未水合窗口点击会被 disabled
 *      拦下(Playwright 标准 click 自动等 enabled), 不再静默丢失;
 *   2. 水合完成(effect → ready=true)后开关 enabled 且点击弹确认 → 交互恢复。
 */
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        initializing: "Initializing controls…",
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
  lastRefreshAt: "2026-06-10T02:00:00Z",
};

function tree() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <CrawlerPauseControls control={BASE} />
    </NextIntlClientProvider>
  );
}

let container: HTMLDivElement | null = null;

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  container?.remove();
  container = null;
});

describe("CrawlerPauseControls 水合门闸", () => {
  it("SSR 阶段两开关 disabled + data-ready=false(杜绝未水合窗口的丢失点击)", () => {
    const html = renderToString(tree());
    const probe = document.createElement("div");
    probe.innerHTML = html;

    const main = probe.querySelector('[data-testid="pause-main-switch"]');
    const sub = probe.querySelector('[data-testid="pause-refresh-switch"]');
    const root = probe.querySelector('[data-testid="crawler-pause-controls"]');

    expect(main).not.toBeNull();
    expect(main!.hasAttribute("disabled")).toBe(true);
    expect(sub!.hasAttribute("disabled")).toBe(true);
    expect(root!.getAttribute("data-ready")).toBe("false");
  });

  it("水合完成后开关 enabled + data-ready=true, 点击主开关弹确认(交互恢复)", async () => {
    const html = renderToString(tree());
    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container!, tree());
    });

    const main = container.querySelector('[data-testid="pause-main-switch"]') as HTMLButtonElement;
    const root = container.querySelector('[data-testid="crawler-pause-controls"]');
    expect(main.disabled).toBe(false);
    expect(root!.getAttribute("data-ready")).toBe("true");

    await act(async () => {
      main.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(document.querySelector('[data-testid="pause-confirm-dialog"]')).not.toBeNull();
  });
});

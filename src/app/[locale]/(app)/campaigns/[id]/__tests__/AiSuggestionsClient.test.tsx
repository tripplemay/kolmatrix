/**
 * BL-020-F002 (CR-2) — AiSuggestionsClient 渲染回退集成 case。
 *
 * safeAiActionLink 单元覆盖在 src/lib/ai/__tests__/safe-link.test.ts 已有 23+
 * 用例。本文件只验证组件的接入路径：缓存里写入恶意 action_link，组件渲染后
 * <a href> 回退到 `/${locale}/campaigns`，不再让 AI 生成的字符串原样穿透。
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The server-action module pulls in next-auth → next/server, which crashes
// when imported in jsdom. We don't exercise the action in this test (the
// "Generate" button hits cache and short-circuits), so a stub is sufficient.
vi.mock("../ai-suggestions-actions", () => ({
  generateCampaignSuggestionsAction: vi.fn(),
}));

// BL-021 fix-1 (BL-047 root cause):
// jsdom's default `window.localStorage` is set as a non-configurable
// getter that returns an object with throwing accessors when running
// under `--pool=forks` on some Linux/Node combinations (Codex CI repro
// 2026-05-07). Install a Map-backed Storage stub before importing the
// component so both the test seed and the component reads see the same
// in-memory store across environments.
beforeAll(() => {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
});

const { AiSuggestionsClient } = await import("../AiSuggestionsClient");

const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const CAMPAIGN_ID = "cmab12cd30001g8l5h3n2q9rs";
const LOCALE = "zh";
const LABELS = {
  generate: "Generate",
  refresh: "Refresh",
  loading: "Loading",
  cachedPrefix: "Cached",
  empty: "Empty",
  error: "Error",
};

function seedCache(actionLink: string) {
  const key = `campaign-suggest-${TENANT_ID}-${CAMPAIGN_ID}`;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      suggestions: [
        {
          priority: "high",
          title: "Test",
          description: "Test description",
          action_link: actionLink,
          action_label: "Open",
        },
      ],
    })
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe("AiSuggestionsClient — safeAiActionLink integration (BL-020-F002)", () => {
  it("falls back to /{locale}/campaigns when action_link is hostile", async () => {
    seedCache("//evil.com/path");

    render(
      <AiSuggestionsClient
        tenantId={TENANT_ID}
        campaignId={CAMPAIGN_ID}
        locale={LOCALE}
        labels={LABELS}
      />
    );

    // The component reads cache lazily via the "Generate" / "Refresh" path
    // (not on mount). Trigger the generate button — readCache hits the
    // seeded localStorage entry, populates state, renders the link.
    const generateButton = screen.getByRole("button", { name: LABELS.generate });
    generateButton.click();

    const link = await screen.findByTestId("campaign-suggestion-link");
    expect(link.getAttribute("href")).toBe(`/${LOCALE}/campaigns`);
  });

  it("preserves a white-listed action_link unchanged", async () => {
    // BL-070-F004 — /outreach was retired (route now 404s). The
    // safe-link whitelist now covers the 4 new IA top-level routes
    // (/brief /match /reach /insight) + kept sub-routes. /reach is
    // the canonical replacement for the legacy /outreach destination.
    seedCache("/reach");

    render(
      <AiSuggestionsClient
        tenantId={TENANT_ID}
        campaignId={CAMPAIGN_ID}
        locale={LOCALE}
        labels={LABELS}
      />
    );

    const generateButton = screen.getByRole("button", { name: LABELS.generate });
    generateButton.click();

    const link = await screen.findByTestId("campaign-suggestion-link");
    expect(link.getAttribute("href")).toBe(`/${LOCALE}/reach`);
  });
});

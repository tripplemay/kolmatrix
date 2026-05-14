/**
 * BL-066-F003 · AiRecommendationPanel unit test.
 *
 * Covers the 4 client-state semantics from features.json F003 acceptance:
 *   - empty state when productId is null
 *   - loading skeleton then active panel after smart-match resolves
 *   - Skip removes the card from the visible-5 (client-state only)
 *   - "Show next 5" cycles via the `replaced` set + refetches when pool drained
 *
 * Mocks: global fetch + next/navigation.useRouter + recommend-actions
 * server action + localStorage (Map-backed to dodge jsdom under
 * --pool=forks flake, same pattern as AiSuggestionsClient.test.tsx).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn(), replace: vi.fn() }),
}));

const acceptMock = vi.fn();
vi.mock("../recommend-actions", () => ({
  acceptKolToCampaignAction: (...args: unknown[]) => acceptMock(...args),
}));

// Map-backed Storage so the panel cache reads + writes stay deterministic.
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
      store.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
});

const { AiRecommendationPanel } = await import("../AiRecommendationPanel");

const LABELS = {
  empty: {
    eyebrow: "AI",
    heading: "No candidates yet",
    body: "body",
    reconnectCta: "Reconnect",
    kbCta: "KB",
    helpLink: "Help",
    info: "info",
  },
  loading: {
    heading: "Loading…",
    badge: "smart-match",
    subtitle: "querying…",
    whyEyebrow: "Why",
    footer: "footer",
  },
  active: {
    heading: "AI Recommended KOLs",
    sourcedFrom: "Sourced from smart-match",
    showNext: "Show next 5",
    whyPrefix: "Why",
    whyTemplate: "match {matchScore}; value {valueScore}",
    acceptCta: "Accept",
    skipCta: "Skip",
    viewProfileCta: "View profile",
    followers: "followers",
    matchScore: "Visible",
    noScore: "n/a",
    errorBanner: "Could not load",
    retryCta: "Retry",
    exhaustedBody: "All done",
  },
};

const TENANT = "11111111-2222-3333-4444-555555555555";
const CAMPAIGN = "ddddeeee-aaaa-bbbb-cccc-111122223333";

function makePool(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `kol-${i}`,
    displayName: `KOL ${i}`,
    handle: `kol_${i}`,
    platform: "youtube",
    avatarUrl: null,
    followerCount: 1000 + i,
    countryCode: "US",
    categories: ["Strategy"],
    matchScore: 90 - i,
    valueScore: 80 - i,
  }));
}

const fetchMock = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  routerRefresh.mockReset();
  acceptMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AiRecommendationPanel (BL-066 F003)", () => {
  it("renders empty state when productId is null", () => {
    render(
      <AiRecommendationPanel
        productId={null}
        campaignId={CAMPAIGN}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />
    );
    expect(
      screen.getByTestId("campaign-ai-recommendation-empty")
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches smart-match on mount and renders the active panel with up to 5 cards", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: makePool(30) }),
    });
    render(
      <AiRecommendationPanel
        productId="prod-1"
        campaignId={CAMPAIGN}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("campaign-ai-recommendation-active")
      ).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId("campaign-ai-recommendation-card");
    expect(cards).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/kols/smart-match");
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ productId: "prod-1", topK: 30 });
  });

  it("Skip removes the KOL from the visible set without a server call", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: makePool(30) }),
    });
    render(
      <AiRecommendationPanel
        productId="prod-1"
        campaignId={CAMPAIGN}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />
    );

    await waitFor(() =>
      expect(
        screen.getAllByTestId("campaign-ai-recommendation-card")
      ).toHaveLength(5)
    );

    const firstCard = screen
      .getAllByTestId("campaign-ai-recommendation-card")[0]!;
    const firstKolId = firstCard.getAttribute("data-kol-id");
    const skipBtn = firstCard.querySelector(
      '[data-testid="campaign-ai-recommendation-skip"]'
    );
    fireEvent.click(skipBtn!);

    await waitFor(() => {
      const remaining = screen
        .getAllByTestId("campaign-ai-recommendation-card")
        .map((el) => el.getAttribute("data-kol-id"));
      expect(remaining).not.toContain(firstKolId);
      expect(remaining).toHaveLength(5); // pool=30, next candidate slides in
    });
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it("'Show next 5' marks the visible batch as replaced and rotates to the next 5", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: makePool(30) }),
    });
    render(
      <AiRecommendationPanel
        productId="prod-1"
        campaignId={CAMPAIGN}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />
    );
    await waitFor(() =>
      expect(
        screen.getAllByTestId("campaign-ai-recommendation-card")
      ).toHaveLength(5)
    );

    const firstBatchIds = screen
      .getAllByTestId("campaign-ai-recommendation-card")
      .map((el) => el.getAttribute("data-kol-id"));

    fireEvent.click(screen.getByTestId("campaign-ai-recommendation-show-next"));

    await waitFor(() => {
      const next = screen
        .getAllByTestId("campaign-ai-recommendation-card")
        .map((el) => el.getAttribute("data-kol-id"));
      // None of the next-5 should overlap the first batch.
      for (const id of next) expect(firstBatchIds).not.toContain(id);
      expect(next).toHaveLength(5);
    });
  });

  it("Accept calls the server action with matchScore and adds KOL to the accepted set", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: makePool(5) }),
    });
    acceptMock.mockResolvedValueOnce({ ok: true, kolCampaignId: "link-1" });

    render(
      <AiRecommendationPanel
        productId="prod-1"
        campaignId={CAMPAIGN}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />
    );
    await waitFor(() =>
      expect(
        screen.getAllByTestId("campaign-ai-recommendation-card")
      ).toHaveLength(5)
    );

    const firstCard = screen
      .getAllByTestId("campaign-ai-recommendation-card")[0]!;
    const firstKolId = firstCard.getAttribute("data-kol-id");
    fireEvent.click(
      firstCard.querySelector(
        '[data-testid="campaign-ai-recommendation-accept"]'
      )!
    );

    await waitFor(() => {
      expect(acceptMock).toHaveBeenCalledTimes(1);
      expect(acceptMock.mock.calls[0]![0]).toEqual({
        campaignId: CAMPAIGN,
        kolId: firstKolId,
        matchScore: 90,
      });
    });
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
    const remaining = screen
      .getAllByTestId("campaign-ai-recommendation-card")
      .map((el) => el.getAttribute("data-kol-id"));
    expect(remaining).not.toContain(firstKolId);
  });

  it("hydrates from cache when the entry is fresh and skips the fetch", async () => {
    const key = `campaign-recommendations-${TENANT}-${CAMPAIGN}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({
        pool: makePool(5),
        accepted: [],
        skipped: [],
        replaced: [],
        fetchedAt: Date.now(),
      })
    );

    render(
      <AiRecommendationPanel
        productId="prod-1"
        campaignId={CAMPAIGN}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />
    );

    await waitFor(() =>
      expect(
        screen.getAllByTestId("campaign-ai-recommendation-card")
      ).toHaveLength(5)
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

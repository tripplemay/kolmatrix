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

// BL-067-F003 — mock the new server action so the mount-time batch read
// resolves deterministically across all panel tests (default: empty cache,
// all misses → C2 fallback). Individual tests can override per-call.
const readShortExplanationsBatchMock = vi.fn();
// BL-067-F004 — mock detailed action so dialog open path is deterministic.
const requestDetailedMock = vi.fn();
vi.mock("../explainability-actions", () => ({
  readShortExplanationsBatchAction: (...args: unknown[]) =>
    readShortExplanationsBatchMock(...args),
  requestDetailedExplanationAction: (...args: unknown[]) =>
    requestDetailedMock(...args),
}));

// BL-067-F005 — mock prewarm action so smart-match return doesn't fail
// trying to load auth() / jobQueue in jsdom. All existing tests should
// pass regardless of whether prewarm is mocked or not — the panel calls
// it fire-and-forget after a successful fetchPool.
const enqueuePrewarmMock = vi.fn();
vi.mock("../prewarm-actions", () => ({
  enqueueExplanationPrewarmAction: (...args: unknown[]) =>
    enqueuePrewarmMock(...args),
}));

// BL-068-F003 — mock the refine server action used by the newly mounted
// RefineInputBar. Default: noop unless a test overrides — only the new
// F003 describe block exercises this path so BL-066/BL-067 tests don't
// need to interact with it.
const applyRefineMock = vi.fn();
vi.mock("../refine-actions", () => ({
  applyRefineAction: (...args: unknown[]) => applyRefineMock(...args),
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
    queryButtonLabel: "View detailed explanation",
  },
  // BL-067-F004 — labels for DetailedExplanationDialog. Required by the
  // `Labels` interface even when no test exercises the dialog open path,
  // because the panel passes them through unconditionally.
  explainabilityDialog: {
    dialogTitle: "Why we recommend @{handle}",
    loading: "Loading detailed explanation",
    unavailable: "Detailed explanation unavailable",
    capExhaustedToast: "Daily AI quota reached",
    closeCta: "Close",
    segments: {
      matchScore: { title: "Match Score" },
      categoryFit: { title: "Category Fit" },
      recentActivity: { title: "Recent Activity" },
      audienceFit: { title: "Audience Fit" },
      brandHistory: { title: "Brand History" },
    },
  },
  // BL-068-F003 — RefineInputBar labels. Required by the Labels
  // interface; only the new F003 describe block asserts against these.
  refine: {
    inputPlaceholder: "Refine with AI",
    applyButton: "Refine",
    resetButton: "Reset to AI default",
    loading: "Refining…",
    feedbackPrefix: "Reranked",
    unparsableToast: "Couldn't understand",
    capExhaustedToast: "Daily AI quota reached",
    networkError: "Refine timed out",
    permutationInvalid: "Rerank invalid",
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
  readShortExplanationsBatchMock.mockReset();
  // Default: empty cache so every KOL renders the C2 fallback (matches
  // BL-066 baseline behaviour). Individual F003 tests override this.
  readShortExplanationsBatchMock.mockResolvedValue({ ok: true, results: {} });
  requestDetailedMock.mockReset();
  requestDetailedMock.mockResolvedValue({
    ok: true,
    data: { segments: null, fallbackToC2: false, traceId: null },
  });
  enqueuePrewarmMock.mockReset();
  enqueuePrewarmMock.mockResolvedValue({ ok: true, jobId: "test-job" });
  applyRefineMock.mockReset();
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

  // ---------- BL-067-F003 ----------
  describe("BL-067-F003 — short explanation rendering + `?` icon trigger", () => {
    it("calls readShortExplanationsBatchAction after smart-match returns with correct args", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: makePool(30) }),
      });
      render(
        <AiRecommendationPanel
          productId="prod-1"
          campaignId={CAMPAIGN}
          tenantId={TENANT}
          locale="zh"
          labels={LABELS}
        />
      );

      await waitFor(() => {
        expect(readShortExplanationsBatchMock).toHaveBeenCalledTimes(1);
      });
      const call = readShortExplanationsBatchMock.mock.calls[0]![0] as {
        campaignId: string;
        kolIds: string[];
        locale: string;
      };
      expect(call.campaignId).toBe(CAMPAIGN);
      expect(call.locale).toBe("zh");
      expect(call.kolIds).toHaveLength(30);
      expect(call.kolIds[0]).toBe("kol-0");
    });

    it("renders the LLM short explanation when the cache returns a hit", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: makePool(5) }),
      });
      readShortExplanationsBatchMock.mockResolvedValueOnce({
        ok: true,
        results: {
          "kol-0": "LLM-generated short rationale for KOL 0",
        },
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
          screen.getByText(/LLM-generated short rationale for KOL 0/)
        ).toBeInTheDocument();
      });
      // The C2 fallback for kol-0 must NOT also render (substitution
      // happens — pick a uniquely identifying substring from the template).
      expect(
        screen.queryByText(/match 90; value 80/)
      ).not.toBeInTheDocument();
    });

    it("falls back to the C2 'whyTemplate' when the cache misses", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: makePool(5) }),
      });
      // Default beforeEach mock returns `{ ok: true, results: {} }` so
      // every kolId resolves to MISS → C2 fallback.
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
        // kol-0 has matchScore=90, valueScore=80 → "match 90; value 80"
        expect(screen.getByText(/match 90; value 80/)).toBeInTheDocument();
      });
    });

    it("renders the `?` icon trigger per card with testid + aria-label", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: makePool(5) }),
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
          screen.getAllByTestId("campaign-ai-recommendation-card")
        ).toHaveLength(5);
      });

      // Lock testid prefix shape AND aria-label content for each visible card.
      for (let i = 0; i < 5; i += 1) {
        const trigger = screen.getByTestId(`explain-trigger-kol-${i}`);
        expect(trigger).toBeInTheDocument();
        expect(trigger.getAttribute("aria-label")).toBe(
          "View detailed explanation",
        );
        // Per spec §5 不变量 #6 — the `?` icon must render regardless of
        // hit/miss; this is the cache-miss branch (beforeEach default).
      }
    });

    it("enqueues pre-warm action after smart-match returns top-30 (F005 wiring)", async () => {
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
          screen.getAllByTestId("campaign-ai-recommendation-card")
        ).toHaveLength(5);
      });

      // The pre-warm action should fire once with the 30 kolIds and the
      // current campaignId. Locale is intentionally NOT passed — the
      // worker pre-warms all 5 locales in one LLM call per spec §5
      // 不变量 #5 / decision #5.
      await waitFor(() => {
        expect(enqueuePrewarmMock).toHaveBeenCalledTimes(1);
      });
      const call = enqueuePrewarmMock.mock.calls[0]![0] as {
        campaignId: string;
        kolIds: string[];
      };
      expect(call.campaignId).toBe(CAMPAIGN);
      expect(call.kolIds).toHaveLength(30);
      expect(call.kolIds[0]).toBe("kol-0");
    });

    it("clicking the `?` icon opens DetailedExplanationDialog for that kolId (F004 wiring)", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: makePool(5) }),
      });
      requestDetailedMock.mockResolvedValueOnce({
        ok: true,
        data: {
          segments: {
            matchScore: "ms-text",
            categoryFit: "cf-text",
            recentActivity: "ra-text",
            audienceFit: "af-text",
            brandHistory: "bh-text",
          },
          fallbackToC2: false,
          traceId: "trace-test",
        },
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
          screen.getAllByTestId("campaign-ai-recommendation-card")
        ).toHaveLength(5);
      });

      // Click trigger for kol-0 — should fire the server action with that
      // kolId + the panel's locale.
      fireEvent.click(screen.getByTestId("explain-trigger-kol-0"));

      await waitFor(() => {
        expect(requestDetailedMock).toHaveBeenCalledTimes(1);
      });
      const call = requestDetailedMock.mock.calls[0]![0] as {
        campaignId: string;
        kolId: string;
        locale: string;
      };
      expect(call).toEqual({
        campaignId: CAMPAIGN,
        kolId: "kol-0",
        locale: "en",
      });
    });
  });

  // ---------- BL-068-F003 ----------
  describe("BL-068-F003 — refine cache + RefineInputBar integration", () => {
    const REFINE_KEY = `refine-${TENANT}-${CAMPAIGN}`;

    it("hydrates refine order from cache and reorders the visible top 5", async () => {
      // Seed the smart-match pool cache so the panel does not fetch.
      window.localStorage.setItem(
        `campaign-recommendations-${TENANT}-${CAMPAIGN}`,
        JSON.stringify({
          pool: makePool(10),
          accepted: [],
          skipped: [],
          replaced: [],
          fetchedAt: Date.now(),
        }),
      );
      // Seed the refine cache with a reverse order — kol-9 should come
      // first instead of kol-0.
      window.localStorage.setItem(
        REFINE_KEY,
        JSON.stringify({
          orderedKolIds: Array.from({ length: 10 }, (_, i) => `kol-${9 - i}`),
          feedback: "Reranked by AI",
          rawQuery: "fewer micro creators",
          createdAt: new Date().toISOString(),
        }),
      );

      render(
        <AiRecommendationPanel
          productId="prod-1"
          campaignId={CAMPAIGN}
          tenantId={TENANT}
          locale="en"
          labels={LABELS}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getAllByTestId("campaign-ai-recommendation-card"),
        ).toHaveLength(5),
      );
      const ids = screen
        .getAllByTestId("campaign-ai-recommendation-card")
        .map((el) => el.getAttribute("data-kol-id"));
      expect(ids).toEqual(["kol-9", "kol-8", "kol-7", "kol-6", "kol-5"]);
      // Reset button visible because refine state present.
      expect(
        screen.getByTestId("campaign-refine-reset"),
      ).toBeInTheDocument();
      // Sticky feedback toast shows the stored feedback.
      expect(
        screen.getByTestId("campaign-refine-toast-success"),
      ).toHaveTextContent("Reranked by AI");
    });

    it("renders default valueScore order when refine cache is missing", async () => {
      window.localStorage.setItem(
        `campaign-recommendations-${TENANT}-${CAMPAIGN}`,
        JSON.stringify({
          pool: makePool(10),
          accepted: [],
          skipped: [],
          replaced: [],
          fetchedAt: Date.now(),
        }),
      );

      render(
        <AiRecommendationPanel
          productId="prod-1"
          campaignId={CAMPAIGN}
          tenantId={TENANT}
          locale="en"
          labels={LABELS}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getAllByTestId("campaign-ai-recommendation-card"),
        ).toHaveLength(5),
      );
      const ids = screen
        .getAllByTestId("campaign-ai-recommendation-card")
        .map((el) => el.getAttribute("data-kol-id"));
      expect(ids).toEqual(["kol-0", "kol-1", "kol-2", "kol-3", "kol-4"]);
      // Reset hidden because no refine applied.
      expect(
        screen.queryByTestId("campaign-refine-reset"),
      ).not.toBeInTheDocument();
      // No sticky feedback either.
      expect(
        screen.queryByTestId("campaign-refine-toast-success"),
      ).not.toBeInTheDocument();
    });

    it("Refine submit calls server action with FULL pool (BL-068 fix-round 1 B2: not just visible-5), reorders, writes cache, shows feedback toast", async () => {
      // Seed pool of 10 KOLs but visible window is 5. Pre-fix the call
      // would send only ["kol-0"..."kol-4"] (the visible-5); post-fix it
      // must send all 10. Spec §F002 / §5 不变量 #3 require operating
      // on the current top-30. Reviewer caught the regression on staging
      // (2026-05-17 spot-check B2: server reported "pool only has 5
      // KOLs" unparsable feedback because client sent only 5 IDs).
      window.localStorage.setItem(
        `campaign-recommendations-${TENANT}-${CAMPAIGN}`,
        JSON.stringify({
          pool: makePool(10),
          accepted: [],
          skipped: [],
          replaced: [],
          fetchedAt: Date.now(),
        }),
      );
      applyRefineMock.mockResolvedValueOnce({
        ok: true,
        data: {
          orderedKolIds: ["kol-4", "kol-3", "kol-2", "kol-1", "kol-0"],
          feedback: "Female audience boosted +12%",
          unparsable: false,
          capExhausted: false,
        },
      });

      render(
        <AiRecommendationPanel
          productId="prod-1"
          campaignId={CAMPAIGN}
          tenantId={TENANT}
          locale="en"
          labels={LABELS}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getAllByTestId("campaign-ai-recommendation-card"),
        ).toHaveLength(5),
      );

      const input = screen.getByTestId("campaign-refine-input");
      fireEvent.change(input, {
        target: { value: "more female audience" },
      });
      fireEvent.click(screen.getByTestId("campaign-refine-apply"));

      await waitFor(() => {
        expect(applyRefineMock).toHaveBeenCalledTimes(1);
      });
      const call = applyRefineMock.mock.calls[0]![0] as {
        campaignId: string;
        rawQuery: string;
        currentPoolIds: string[];
        locale: string;
      };
      expect(call.campaignId).toBe(CAMPAIGN);
      expect(call.rawQuery).toBe("more female audience");
      expect(call.locale).toBe("en");
      // Locks the regression: ALL 10 IDs (full pool) must be sent, not
      // only the visible-5. If a future refactor reverts to visible.map
      // this assertion fails loudly.
      expect(call.currentPoolIds).toHaveLength(10);
      expect(call.currentPoolIds).toEqual([
        "kol-0",
        "kol-1",
        "kol-2",
        "kol-3",
        "kol-4",
        "kol-5",
        "kol-6",
        "kol-7",
        "kol-8",
        "kol-9",
      ]);

      // After success: pool reordered, feedback toast visible, cache written.
      await waitFor(() => {
        const ids = screen
          .getAllByTestId("campaign-ai-recommendation-card")
          .map((el) => el.getAttribute("data-kol-id"));
        expect(ids).toEqual(["kol-4", "kol-3", "kol-2", "kol-1", "kol-0"]);
      });
      expect(
        screen.getByTestId("campaign-refine-toast-success"),
      ).toHaveTextContent("Female audience boosted +12%");
      const cached = JSON.parse(
        window.localStorage.getItem(REFINE_KEY) ?? "{}",
      );
      expect(cached.orderedKolIds).toEqual([
        "kol-4",
        "kol-3",
        "kol-2",
        "kol-1",
        "kol-0",
      ]);
      expect(cached.feedback).toBe("Female audience boosted +12%");
      expect(cached.rawQuery).toBe("more female audience");
      expect(typeof cached.createdAt).toBe("string");
      expect(Number.isFinite(Date.parse(cached.createdAt))).toBe(true);
      // Reset button now visible.
      expect(
        screen.getByTestId("campaign-refine-reset"),
      ).toBeInTheDocument();
    });

    it("Reset clears the refine cache, restores default order, hides Reset button", async () => {
      window.localStorage.setItem(
        `campaign-recommendations-${TENANT}-${CAMPAIGN}`,
        JSON.stringify({
          pool: makePool(5),
          accepted: [],
          skipped: [],
          replaced: [],
          fetchedAt: Date.now(),
        }),
      );
      window.localStorage.setItem(
        REFINE_KEY,
        JSON.stringify({
          orderedKolIds: ["kol-4", "kol-3", "kol-2", "kol-1", "kol-0"],
          feedback: "Reranked",
          rawQuery: "anything",
          createdAt: new Date().toISOString(),
        }),
      );

      render(
        <AiRecommendationPanel
          productId="prod-1"
          campaignId={CAMPAIGN}
          tenantId={TENANT}
          locale="en"
          labels={LABELS}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getAllByTestId("campaign-ai-recommendation-card"),
        ).toHaveLength(5),
      );
      // Confirm reversed order from the cache.
      const before = screen
        .getAllByTestId("campaign-ai-recommendation-card")
        .map((el) => el.getAttribute("data-kol-id"));
      expect(before[0]).toBe("kol-4");

      fireEvent.click(screen.getByTestId("campaign-refine-reset"));

      await waitFor(() => {
        const ids = screen
          .getAllByTestId("campaign-ai-recommendation-card")
          .map((el) => el.getAttribute("data-kol-id"));
        expect(ids).toEqual(["kol-0", "kol-1", "kol-2", "kol-3", "kol-4"]);
      });
      expect(window.localStorage.getItem(REFINE_KEY)).toBeNull();
      expect(
        screen.queryByTestId("campaign-refine-reset"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("campaign-refine-toast-success"),
      ).not.toBeInTheDocument();
    });

    it("ignores refine cache when createdAt is older than 24h (TTL boundary)", async () => {
      window.localStorage.setItem(
        `campaign-recommendations-${TENANT}-${CAMPAIGN}`,
        JSON.stringify({
          pool: makePool(5),
          accepted: [],
          skipped: [],
          replaced: [],
          fetchedAt: Date.now(),
        }),
      );
      // 24h + 1 minute ago — outside the 24h TTL window.
      const oldIso = new Date(
        Date.now() - (24 * 60 * 60 * 1000 + 60_000),
      ).toISOString();
      window.localStorage.setItem(
        REFINE_KEY,
        JSON.stringify({
          orderedKolIds: ["kol-4", "kol-3", "kol-2", "kol-1", "kol-0"],
          feedback: "Stale rerank",
          rawQuery: "ancient",
          createdAt: oldIso,
        }),
      );

      render(
        <AiRecommendationPanel
          productId="prod-1"
          campaignId={CAMPAIGN}
          tenantId={TENANT}
          locale="en"
          labels={LABELS}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getAllByTestId("campaign-ai-recommendation-card"),
        ).toHaveLength(5),
      );
      const ids = screen
        .getAllByTestId("campaign-ai-recommendation-card")
        .map((el) => el.getAttribute("data-kol-id"));
      // Default order — stale cache ignored.
      expect(ids).toEqual(["kol-0", "kol-1", "kol-2", "kol-3", "kol-4"]);
      // Reset hidden, sticky feedback hidden — cache treated as miss.
      expect(
        screen.queryByTestId("campaign-refine-reset"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("campaign-refine-toast-success"),
      ).not.toBeInTheDocument();
    });
  });
});

/**
 * BL-068-F004 · MatchRefineBar unit test.
 *
 * Covers the 4 acceptance points from features.json F004:
 *   - cache hit → bar renders with cached pool IDs, no fetch
 *   - cache miss → /api/kols/smart-match fetched, bar renders with
 *     returned IDs
 *   - productId=null (deleted product) → bar inert (renders nothing)
 *   - cross-page consistency: a refine submit writes the same key /
 *     shape AiRecommendationPanel reads from on /campaigns/[id]
 *
 * Reuses the Map-backed localStorage pattern from
 * AiRecommendationPanel.test.tsx so jsdom + vitest --pool=threads stay
 * deterministic.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  readRefineCache,
  refineCacheKey,
} from "@/lib/refine-cache";

const applyRefineMock = vi.fn();
vi.mock("@/app/[locale]/(app)/campaigns/[id]/refine-actions", () => ({
  applyRefineAction: (...args: unknown[]) => applyRefineMock(...args),
}));

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

const { MatchRefineBar } = await import("../MatchRefineBar");

const TENANT = "11111111-2222-3333-4444-555555555555";
const CAMPAIGN = "ddddeeee-aaaa-bbbb-cccc-111122223333";
const PRODUCT = "prod-cuid-1";

const LABELS = {
  inputPlaceholder: "Refine with AI",
  applyButton: "Refine",
  resetButton: "Reset to AI default",
  loading: "Refining…",
  feedbackPrefix: "Reranked",
  unparsableToast: "Couldn't understand",
  capExhaustedToast: "Daily AI quota reached",
  networkError: "Refine timed out",
  permutationInvalid: "Rerank invalid",
};

function poolKey(): string {
  return `campaign-recommendations-${TENANT}-${CAMPAIGN}`;
}

function seedPoolCache(ids: string[]): void {
  window.localStorage.setItem(
    poolKey(),
    JSON.stringify({
      pool: ids.map((id) => ({ id })),
      accepted: [],
      skipped: [],
      replaced: [],
      fetchedAt: Date.now(),
    }),
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  window.localStorage.clear();
  applyRefineMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MatchRefineBar (BL-068-F004)", () => {
  it("hydrates the pool IDs from the smart-match cache without fetching when cached", async () => {
    seedPoolCache(["kol-0", "kol-1", "kol-2", "kol-3", "kol-4"]);

    render(
      <MatchRefineBar
        campaignId={CAMPAIGN}
        productId={PRODUCT}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("match-refine-bar")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("campaign-refine-input-bar"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/kols/smart-match on cache miss and renders the bar after the response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          { id: "kol-a" },
          { id: "kol-b" },
          { id: "kol-c" },
        ],
      }),
    });

    render(
      <MatchRefineBar
        campaignId={CAMPAIGN}
        productId={PRODUCT}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("match-refine-bar")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/kols/smart-match");
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    );
    expect(body).toEqual({ productId: PRODUCT, topK: 30 });
  });

  it("stays inert when productId is null (deleted product)", () => {
    const { container } = render(
      <MatchRefineBar
        campaignId={CAMPAIGN}
        productId={null}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes the shared refine cache on success so /campaigns/[id] picks up the same state (cross-page consistency)", async () => {
    seedPoolCache(["kol-0", "kol-1", "kol-2"]);
    applyRefineMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orderedKolIds: ["kol-2", "kol-1", "kol-0"],
        feedback: "Reordered by /match",
        unparsable: false,
        capExhausted: false,
      },
    });

    render(
      <MatchRefineBar
        campaignId={CAMPAIGN}
        productId={PRODUCT}
        tenantId={TENANT}
        locale="en"
        labels={LABELS}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("match-refine-bar")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("campaign-refine-input"), {
      target: { value: "swap the order" },
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
    expect(call.rawQuery).toBe("swap the order");
    expect(call.currentPoolIds).toEqual(["kol-0", "kol-1", "kol-2"]);

    // The /campaigns/[id] route reads via this same key + helper —
    // the assertion proves the contract holds end-to-end without
    // round-tripping through that page.
    await waitFor(() => {
      const cached = readRefineCache(refineCacheKey(TENANT, CAMPAIGN));
      expect(cached).not.toBeNull();
      expect(cached?.orderedKolIds).toEqual(["kol-2", "kol-1", "kol-0"]);
      expect(cached?.feedback).toBe("Reordered by /match");
      expect(cached?.rawQuery).toBe("swap the order");
      expect(typeof cached?.createdAt).toBe("string");
    });
    // Reset button appears after a successful refine.
    expect(
      screen.getByTestId("campaign-refine-reset"),
    ).toBeInTheDocument();
  });
});

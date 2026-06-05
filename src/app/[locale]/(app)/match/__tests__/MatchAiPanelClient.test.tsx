import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../../../tests/utils/render-intl";
import { MatchAiPanelClient } from "../MatchAiPanelClient";
import type { PanelCard } from "../MatchAiKolCard";

// BL-084-F006: AI Match Panel client interactivity.

const acceptMock = vi.fn();
const skipMock = vi.fn();
const swapMock = vi.fn();
const reAddMock = vi.fn();
const removeMock = vi.fn();
const undoMock = vi.fn();
vi.mock("../server-actions/suggestion-actions", () => ({
  acceptKolToCampaign: (...a: unknown[]) => acceptMock(...a),
  skipKolFromCampaign: (...a: unknown[]) => skipMock(...a),
  swapKolToSwapPool: (...a: unknown[]) => swapMock(...a),
  reAddToSuggested: (...a: unknown[]) => reAddMock(...a),
  removeKolFromCampaign: (...a: unknown[]) => removeMock(...a),
  undoLastDecision: (...a: unknown[]) => undoMock(...a),
}));
vi.mock("../server-actions/get-campaign-suggestions", () => ({
  getCampaignSuggestions: vi.fn(),
}));
vi.mock("@/app/[locale]/(app)/campaigns/[id]/DetailedExplanationDialog", () => ({
  DetailedExplanationDialog: () => null,
}));

const CAMP = "11111111-1111-1111-1111-111111111111";

function card(i: number, reason: string | null = null): PanelCard {
  return {
    id: `aaaaaaaa-0000-0000-0000-00000000000${i}`,
    displayName: `KOL ${i}`,
    handle: `kol${i}`,
    platform: "youtube",
    avatarUrl: null,
    followerCount: 12_345,
    countryCode: "US",
    categories: ["gaming"],
    matchScore: 80 - i,
    matchReason: reason,
  };
}

const LABELS = {
  dialogTitle: "{handle}",
  loading: "...",
  unavailable: "...",
  capExhaustedToast: "...",
  closeCta: "Close",
  segments: {
    matchScore: { title: "Match" },
    categoryFit: { title: "Category" },
    recentActivity: { title: "Activity" },
    audienceFit: { title: "Audience" },
    brandHistory: { title: "Brand" },
  },
};

function renderPanel(over: Partial<Parameters<typeof MatchAiPanelClient>[0]> = {}) {
  return renderIntl(
    <MatchAiPanelClient
      campaignId={CAMP}
      locale="en"
      initialSuggested={[card(1, "Strong US gaming fit"), card(2)]}
      initialAccepted={[card(8)]}
      initialSwap={[]}
      generatedAt={new Date().toISOString()}
      rerankFallback={false}
      dialogLabels={LABELS}
      {...over}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  acceptMock.mockResolvedValue({
    ok: true,
    decisionId: "555",
    undoExpiresAt: new Date(Date.now() + 5000).toISOString(),
  });
  undoMock.mockResolvedValue({ ok: true, kolId: "x", campaignId: CAMP });
});

describe("MatchAiPanelClient (BL-084-F006)", () => {
  it("renders three columns with counts, match badge, and reason chip", () => {
    renderPanel();
    expect(screen.getByTestId("column-suggested")).toHaveAttribute("data-count", "2");
    expect(screen.getByTestId("column-accepted")).toHaveAttribute("data-count", "1");
    expect(screen.getByTestId("column-swap")).toHaveAttribute("data-count", "0");
    // match badge present (suggested card 1 score 79)
    expect(screen.getAllByTestId("match-badge").length).toBeGreaterThan(0);
    // reason chip for card 1
    expect(screen.getByText("Strong US gaming fit")).toBeInTheDocument();
    // empty state for swap column
    expect(screen.getByText("Bench is empty")).toBeInTheDocument();
  });

  it("Accept optimistically moves a KOL to Accepted + shows Undo toast", async () => {
    renderPanel();
    const acceptButtons = screen.getAllByTestId("accept-button");
    fireEvent.click(acceptButtons[0]!);

    // Optimistic: suggested 2→1, accepted 1→2.
    await waitFor(() =>
      expect(screen.getByTestId("column-suggested")).toHaveAttribute("data-count", "1"),
    );
    expect(screen.getByTestId("column-accepted")).toHaveAttribute("data-count", "2");
    expect(acceptMock).toHaveBeenCalledWith(card(1).id, CAMP);
    // Undo toast appears after the action resolves.
    await screen.findByTestId("undo-toast");
  });

  it("Undo from the toast moves the KOL back to Suggested", async () => {
    renderPanel();
    fireEvent.click(screen.getAllByTestId("accept-button")[0]!);
    const undoBtn = await screen.findByTestId("undo-button");
    fireEvent.click(undoBtn);

    await waitFor(() =>
      expect(screen.getByTestId("column-suggested")).toHaveAttribute("data-count", "2"),
    );
    expect(screen.getByTestId("column-accepted")).toHaveAttribute("data-count", "1");
    expect(undoMock).toHaveBeenCalledWith("555");
  });

  it("Skip removes a KOL from Suggested", async () => {
    skipMock.mockResolvedValue({ ok: true, decisionId: "1", undoExpiresAt: "x" });
    renderPanel();
    fireEvent.click(screen.getAllByTestId("skip-button")[0]!);
    await waitFor(() =>
      expect(screen.getByTestId("column-suggested")).toHaveAttribute("data-count", "1"),
    );
    expect(skipMock).toHaveBeenCalledWith(card(1).id, CAMP);
  });

  it("shows the rerank fallback warning when rerankFallback is true", () => {
    renderPanel({ rerankFallback: true });
    expect(screen.getByTestId("rerank-fallback-warning")).toBeInTheDocument();
  });
});

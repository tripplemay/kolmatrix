/**
 * BL-065-F001 · MatchKolCard render guard.
 *
 * Mirrors BL-061-F004 KolResultCard engagement-tooltip coverage: when
 * F006 deletes the /discovery folder the standalone test moves with it,
 * so /match keeps an equivalent guard against engagement-rate transparency
 * regressions.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderIntl } from "../../../../../../tests/utils/render-intl";
import { MatchKolCard } from "../MatchKolCard";
import type { MatchKolRow } from "../search";

const baseKol: MatchKolRow = {
  id: "kol-1",
  displayName: "Test KOL",
  handle: "test_handle",
  platform: "youtube",
  avatarUrl: null,
  countryCode: "US",
  language: "en",
  followerCount: 75_200_000,
  engagementRate: 18.83,
  valueScore: 92,
  categories: ["Gaming"],
  tags: [],
  isGaming: true,
  relationshipStatus: "prospect",
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("MatchKolCard (BL-065-F001)", () => {
  it("renders the KOL display name, handle, and value score", () => {
    renderIntl(<MatchKolCard kol={baseKol} />);
    expect(screen.getByText("Test KOL")).toBeInTheDocument();
    expect(screen.getByText("@test_handle")).toBeInTheDocument();
    // valueScore renders twice — once in the floating badge, once in the
    // 3-column footer. Both 92s belong on the card.
    expect(screen.getAllByText("92")).toHaveLength(2);
  });

  it("preserves the engagement-rate tooltip for cross-platform proxy transparency", () => {
    renderIntl(<MatchKolCard kol={baseKol} />);
    const tooltip = screen.getByTestId("engagement-rate-tooltip");
    expect(tooltip).toHaveAttribute(
      "title",
      "YouTube/X engagement_rate uses channel views as proxy (not literal like counts). Cross-platform comparison is approximate.",
    );
    expect(screen.getByText("18.8%")).toBeInTheDocument();
  });

  it("tags the rendered card with kol id + platform data attributes", () => {
    renderIntl(<MatchKolCard kol={baseKol} />);
    const card = screen.getByTestId("match-kol-card");
    expect(card).toHaveAttribute("data-kol-id", "kol-1");
    expect(card).toHaveAttribute("data-kol-platform", "youtube");
  });
});

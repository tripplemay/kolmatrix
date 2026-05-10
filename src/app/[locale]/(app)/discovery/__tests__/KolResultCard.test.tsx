/**
 * BL-061-F004 · KolResultCard tooltip render guard.
 *
 * Asserts the engagement-rate column renders an info-icon tooltip whose
 * title attribute matches the i18n string at `kol.engagementRate.tooltip`.
 * Mirrors the spec acceptance for cross-platform proxy transparency.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderIntl } from "../../../../../../tests/utils/render-intl";
import { KolResultCard } from "../KolResultCard";
import type { DiscoveryKolCard } from "../search";

const baseKol: DiscoveryKolCard = {
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
};

describe("KolResultCard engagement tooltip (BL-061-F004)", () => {
  it("renders an info-icon next to the engagement label with the i18n tooltip text", () => {
    renderIntl(<KolResultCard kol={baseKol} />);
    const tooltip = screen.getByTestId("engagement-rate-tooltip");
    expect(tooltip).toHaveAttribute(
      "title",
      "YouTube/X engagement_rate uses channel views as proxy (not literal like counts). Cross-platform comparison is approximate.",
    );
    expect(tooltip).toHaveAttribute(
      "aria-label",
      "YouTube/X engagement_rate uses channel views as proxy (not literal like counts). Cross-platform comparison is approximate.",
    );
    expect(tooltip).toHaveTextContent("info");
  });

  it("keeps the existing engagement-rate value visible alongside the tooltip", () => {
    renderIntl(<KolResultCard kol={baseKol} />);
    expect(screen.getByText("18.8%")).toBeInTheDocument();
  });
});

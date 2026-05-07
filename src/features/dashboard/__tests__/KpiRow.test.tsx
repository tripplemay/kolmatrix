/**
 * BL-052 F004 — KpiRow snapshot.
 *
 * Two states:
 *   1. hasEnoughData=true on every metric → trend chips show real
 *      direction + percent values supplied by loadKpiTrends.
 *   2. hasEnoughData=false on every metric → trend chips fall back to
 *      "—" + tooltip="Trend data accumulating, available after 7 days".
 */
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import type { KpiTrend } from "@/lib/dashboard/kpi-trends";

import { KpiRow } from "../KpiRow";

const messages = {
  dashboard: {
    kpi: {
      totalKols: "Total KOLs",
      activeCampaigns: "Active Campaigns",
      emailsSent: "Emails Sent",
      totalProducts: "Products",
      avgValueScore: "Avg Value Score",
      avgAiMatch: "Avg AI Match",
      trendAccumulating: "Trend data accumulating, available after 7 days",
    },
  },
};

function withIntl(ui: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

function trend(opts: Partial<KpiTrend> = {}): KpiTrend {
  return {
    direction: "flat",
    percent: 0,
    sparkline: [1, 2, 3, 4],
    hasEnoughData: true,
    ...opts,
  };
}

describe("KpiRow", () => {
  it("renders 4 trend chips with real percent when hasEnoughData=true", () => {
    render(
      withIntl(
        <KpiRow
          kolCount={120}
          activeCampaigns={3}
          emailsSent7d={50}
          productCount={4}
          avgValueScore={72}
          trends={{
            kolCount: trend({ direction: "up", percent: 12 }),
            activeCampaigns: trend({ direction: "down", percent: 5 }),
            emailsSent7d: trend({ direction: "up", percent: 8.5 }),
            productCount: trend({ direction: "flat", percent: 0 }),
          }}
        />
      )
    );

    const chips = screen.getAllByTestId("statcard-trend");
    expect(chips).toHaveLength(4);

    expect(chips[0].textContent).toContain("+12%");
    expect(chips[0]).not.toHaveAttribute("title");

    expect(chips[1].textContent).toContain("5%");
    expect(chips[1].textContent).not.toContain("+");

    expect(chips[2].textContent).toContain("+8.5%");

    // flat with hasEnoughData=true still renders 0% (no fallback dash).
    expect(chips[3].textContent).toContain("0%");
  });

  it("falls back to '—' + tooltip on every chip when hasEnoughData=false", () => {
    render(
      withIntl(
        <KpiRow
          kolCount={5}
          activeCampaigns={0}
          emailsSent7d={0}
          productCount={1}
          avgValueScore={50}
          trends={{
            kolCount: trend({ hasEnoughData: false }),
            activeCampaigns: trend({ hasEnoughData: false }),
            emailsSent7d: trend({ hasEnoughData: false }),
            productCount: trend({ hasEnoughData: false }),
          }}
        />
      )
    );

    const chips = screen.getAllByTestId("statcard-trend");
    expect(chips).toHaveLength(4);
    for (const chip of chips) {
      expect(chip.textContent).toContain("—");
      expect(chip.textContent).not.toContain("%");
      expect(chip).toHaveAttribute(
        "title",
        "Trend data accumulating, available after 7 days"
      );
    }
  });

  it("renders the AiMatchRingCard for the avgValueScore tile (5th column, no chip)", () => {
    const { container } = render(
      withIntl(
        <KpiRow
          kolCount={1}
          activeCampaigns={0}
          emailsSent7d={0}
          productCount={0}
          avgValueScore={88}
          trends={{
            kolCount: trend(),
            activeCampaigns: trend(),
            emailsSent7d: trend(),
            productCount: trend(),
          }}
        />
      )
    );

    const row = within(container.querySelector("[data-testid='dashboard-kpi-row']")!);
    expect(row.getByText("88")).toBeInTheDocument();
    expect(row.getByText("Avg Value Score")).toBeInTheDocument();
    // 4 trend chips on the first 4 cards; the ring card has none.
    expect(row.getAllByTestId("statcard-trend")).toHaveLength(4);
  });
});

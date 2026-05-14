/**
 * BL-066-F002 · BriefSummaryPanel unit test.
 *
 * Covers the 3 acceptance cases (per features.json F002 line 35):
 *   1. 三段渲染 + Brief 4 列完整数据 (status pill + counts + market +
 *      demographics + budget + action buttons all wired)
 *   2. Contacted 派生口径 (white-list enum match; lock per audit §裁决 #4=B)
 *      — this is page.tsx logic but we lock the white-list verbatim in
 *      a source-level grep so future schema drift (e.g. adding "rejected"
 *      to KolCampaign.status) doesn't silently drift the count.
 *   3. 空态: markets=[] + product=null → fallback i18n labels render
 */
import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { BriefSummaryPanel } from "../BriefSummaryPanel";

const LABELS = {
  statusActive: "Active",
  statusDraft: "Draft",
  statusCompleted: "Completed",
  aiDrivenBadge: "AI-driven",
  targetMarket: "Target market",
  targetMarketDefault: "Global",
  demographics: "Audience",
  demographicsUnset: "Not set",
  budget: "Budget",
  budgetUnset: "Not set",
  acceptedLabel: "Accepted",
  contactedLabel: "Contacted",
  editBrief: "Edit Brief",
  launchComm: "Launch comms",
};

describe("BriefSummaryPanel (BL-066 F002)", () => {
  it("renders the full Brief region with all 4 grid columns + counts + nav links", () => {
    render(
      <BriefSummaryPanel
        campaign={{
          id: "camp-1",
          name: "Galactic Forge Alpha",
          status: "active",
          markets: ["Mobile", "APAC"],
          budgetAmount: 50000,
          budgetCurrency: "USD",
          productTargetAudience: "18-30, Strategy gamers",
        }}
        counts={{ accepted: 12, contacted: 8 }}
        locale="en"
        labels={LABELS}
      />
    );

    expect(screen.getByTestId("campaign-brief-status-pill")).toHaveTextContent(
      "Active"
    );
    expect(screen.getByText("Galactic Forge Alpha")).toBeInTheDocument();
    expect(
      screen.getByTestId("campaign-brief-accepted-count")
    ).toHaveTextContent("12");
    expect(
      screen.getByTestId("campaign-brief-contacted-count")
    ).toHaveTextContent("8");
    expect(screen.getByTestId("campaign-brief-target-market")).toHaveTextContent(
      "Mobile, APAC"
    );
    expect(screen.getByTestId("campaign-brief-demographics")).toHaveTextContent(
      "18-30, Strategy gamers"
    );
    expect(screen.getByTestId("campaign-brief-budget")).toHaveTextContent(
      "$50,000"
    );
    expect(screen.getByTestId("campaign-brief-edit-link")).toHaveAttribute(
      "href",
      "/en/campaigns/camp-1/edit"
    );
    expect(screen.getByTestId("campaign-brief-launch-link")).toHaveAttribute(
      "href",
      "/en/reach?campaignId=camp-1"
    );
  });

  it("locks the Contacted contactStatus white-list (audit §裁决 #4=B)", () => {
    // The white-list lives in page.tsx as a Set literal. Extract the
    // Set body and assert the 5 statuses are present + "pending" is
    // explicitly absent (initial state is not yet contacted).
    const page = readFileSync(resolve(__dirname, "../page.tsx"), "utf8");
    const match = page.match(
      /const CONTACTED_STATUSES = new Set\(\[([\s\S]*?)\]\)/
    );
    expect(match, "CONTACTED_STATUSES Set literal must exist in page.tsx").toBeTruthy();
    const setBody = match![1];
    expect(setBody).toMatch(/"contacted"/);
    expect(setBody).toMatch(/"quoted"/);
    expect(setBody).toMatch(/"signed"/);
    expect(setBody).toMatch(/"delivered"/);
    expect(setBody).toMatch(/"paid"/);
    expect(setBody).not.toMatch(/"pending"/);
  });

  it("renders i18n fallbacks when markets is empty + product is null + budget is null", () => {
    render(
      <BriefSummaryPanel
        campaign={{
          id: "camp-empty",
          name: "Stub Campaign",
          status: "draft",
          markets: [],
          budgetAmount: null,
          budgetCurrency: "USD",
          productTargetAudience: null,
        }}
        counts={{ accepted: 0, contacted: 0 }}
        locale="zh"
        labels={LABELS}
      />
    );

    expect(screen.getByTestId("campaign-brief-status-pill")).toHaveTextContent(
      "Draft"
    );
    expect(screen.getByTestId("campaign-brief-target-market")).toHaveTextContent(
      "Global"
    );
    expect(screen.getByTestId("campaign-brief-demographics")).toHaveTextContent(
      "Not set"
    );
    expect(screen.getByTestId("campaign-brief-budget")).toHaveTextContent(
      "Not set"
    );
    expect(screen.getByTestId("campaign-brief-edit-link")).toHaveAttribute(
      "href",
      "/zh/campaigns/camp-empty/edit"
    );
  });
});

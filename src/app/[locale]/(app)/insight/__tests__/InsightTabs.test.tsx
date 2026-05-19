/**
 * BL-070-F003 · InsightTabs unit tests.
 *
 * Locks the three behaviours that drive the F003 acceptance "mount
 * /insight default tab / ?tab 切换" requirement:
 *   1. `pickInsightTab` defaults to "dashboard" and accepts the two
 *      named tabs ("reports" / "analytics"), ignoring bogus values.
 *   2. The bar renders all three tabs with the correct active marker
 *      + aria-current attribute given an explicit `activeTab` prop.
 *   3. Tab hrefs carry the locale prefix and the right `?tab=` query
 *      (default tab omits the query string so the canonical URL stays
 *      `/{locale}/insight`).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  INSIGHT_TABS,
  InsightTabs,
  pickInsightTab,
  type InsightTab,
} from "../InsightTabs";

describe("pickInsightTab", () => {
  it("defaults to dashboard when the query is missing or unknown", () => {
    expect(pickInsightTab(undefined)).toBe("dashboard");
    expect(pickInsightTab("")).toBe("dashboard");
    expect(pickInsightTab("not-a-tab")).toBe("dashboard");
  });

  it("accepts the two non-default tabs", () => {
    expect(pickInsightTab("reports")).toBe("reports");
    expect(pickInsightTab("analytics")).toBe("analytics");
  });

  it("picks the first entry when Next hands in a string[] form", () => {
    expect(pickInsightTab(["reports", "dashboard"])).toBe("reports");
    expect(pickInsightTab(["bogus"])).toBe("dashboard");
  });

  it("exposes the canonical tab list in order", () => {
    expect(INSIGHT_TABS).toEqual(["dashboard", "reports", "analytics"]);
  });
});

describe("<InsightTabs />", () => {
  function rendered(activeTab: InsightTab, locale = "en") {
    render(<InsightTabs locale={locale} activeTab={activeTab} />);
  }

  it("renders all three tabs as anchor links with locale-prefixed hrefs", () => {
    rendered("dashboard");
    const dashboard = screen.getByTestId("insight-tab-dashboard");
    const reports = screen.getByTestId("insight-tab-reports");
    const analytics = screen.getByTestId("insight-tab-analytics");

    // Default tab keeps a clean canonical URL (no ?tab= query string).
    expect(dashboard).toHaveAttribute("href", "/en/insight");
    expect(reports).toHaveAttribute("href", "/en/insight?tab=reports");
    expect(analytics).toHaveAttribute("href", "/en/insight?tab=analytics");
  });

  it("marks the dashboard tab active by default + aria-current=page", () => {
    rendered("dashboard");
    expect(screen.getByTestId("insight-tab-dashboard")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByTestId("insight-tab-reports"),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByTestId("insight-tab-analytics"),
    ).not.toHaveAttribute("aria-current");
  });

  it("flips the active marker when ?tab=reports", () => {
    rendered("reports");
    expect(screen.getByTestId("insight-tab-reports")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByTestId("insight-tab-dashboard"),
    ).not.toHaveAttribute("aria-current");
  });

  it("flips the active marker when ?tab=analytics", () => {
    rendered("analytics");
    expect(screen.getByTestId("insight-tab-analytics")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("respects a non-default locale in hrefs", () => {
    rendered("dashboard", "zh");
    expect(screen.getByTestId("insight-tab-dashboard")).toHaveAttribute(
      "href",
      "/zh/insight",
    );
    expect(screen.getByTestId("insight-tab-reports")).toHaveAttribute(
      "href",
      "/zh/insight?tab=reports",
    );
  });
});

/**
 * BL-012-F004 · 4-dim decision-gate stats cards spec.
 *
 * Acceptance asks for ≥4 cases covering edge thresholds. The four scenarios
 * below pin the 4-card matrix at:
 *   1. Happy path — all four dimensions pass, footer says gate open.
 *   2. Card #1 boundary — email rate just below 40% → ✗.
 *   3. Card #3 boundary — only 1 platform present → ✗ even when gaming
 *      tag rate satisfies its own rule.
 *   4. Empty sample — all four cards collapse to ✗ + gate blocked.
 */
import { describe, expect, it } from "vitest";

import type { ApifyKolItem } from "@/lib/admin/apify-preview-client";

import { renderIntl } from "../../../../../../tests/utils/render-intl";
import { StatsCards } from "../StatsCards";

function makeItem(overrides: Partial<ApifyKolItem>): ApifyKolItem {
  return {
    id: overrides.id ?? "row",
    platform: overrides.platform ?? "tiktok",
    platformUserId: overrides.platformUserId ?? "12345",
    username: overrides.username ?? "user",
    displayName: overrides.displayName ?? "User",
    followers: overrides.followers ?? 100_000,
    profileUrl: overrides.profileUrl ?? "https://www.tiktok.com/@user",
    ...overrides,
  };
}

const NOW = new Date("2026-05-08T00:00:00Z");
function freshIso(daysAgo: number): string {
  const d = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

describe("BL-012-F004 StatsCards", () => {
  it("renders 4/4 ✓ when every dimension passes the threshold", () => {
    const items: ApifyKolItem[] = [];
    // 300 items, 3 platforms (100 each), all required fields, 50% with email,
    // scores well-spread, fresh. Card #3 floor is 100 KOLs in the top platform,
    // so the per-platform count must be at or above that.
    const platforms = ["instagram", "tiktok", "youtube"] as const;
    for (let i = 0; i < 300; i += 1) {
      items.push(
        makeItem({
          id: `row-${i}`,
          platform: platforms[i % platforms.length]!,
          username: `user${i}`,
          displayName: `User ${i}`,
          followers: 50_000 + i,
          profileUrl: `https://example.com/${i}`,
          relevanceScore: 0.6,
          influenceScore: 0.55,
          qualityScore: 0.5,
          reachabilityScore: 0.4,
          emails: i % 2 === 0 ? [`u${i}@example.com`] : [],
          matchedTags: i % 4 === 0 ? ["streamer"] : ["gaming"],
          lastScrapedAt: freshIso(2),
        })
      );
    }

    const { getByTestId } = renderIntl(
      <StatsCards items={items} total={items.length} now={NOW} />
    );

    expect(getByTestId("stats-card1").getAttribute("data-pass")).toBe("true");
    expect(getByTestId("stats-card2").getAttribute("data-pass")).toBe("true");
    expect(getByTestId("stats-card3").getAttribute("data-pass")).toBe("true");
    expect(getByTestId("stats-card4").getAttribute("data-pass")).toBe("true");
    expect(getByTestId("stats-footer").getAttribute("data-pass-count")).toBe("4");
    expect(getByTestId("stats-footer").textContent).toContain("4 / 4");
  });

  it("flags Card #1 when the email-extraction rate dips below 40%", () => {
    // 10 items, 3 with emails (30%) — rest of the data is fine
    const items: ApifyKolItem[] = Array.from({ length: 10 }, (_, i) =>
      makeItem({
        id: `row-${i}`,
        platform: ["instagram", "tiktok", "youtube"][i % 3] as ApifyKolItem["platform"],
        username: `user${i}`,
        displayName: `User ${i}`,
        followers: 100_000 + i,
        profileUrl: `https://example.com/${i}`,
        relevanceScore: 0.55,
        influenceScore: 0.5,
        qualityScore: 0.45,
        reachabilityScore: 0.5,
        emails: i < 3 ? [`u${i}@example.com`] : [],
        matchedTags: ["gaming"],
        lastScrapedAt: freshIso(1),
      })
    );

    const { getByTestId } = renderIntl(
      <StatsCards items={items} total={items.length} now={NOW} />
    );

    expect(getByTestId("stats-card1").getAttribute("data-pass")).toBe("false");
    // Measurement #1 (required fields) still passes; #0 was used for required, so check email row
    const emailMeasure = getByTestId("stats-card1-measure-1");
    expect(emailMeasure.textContent).toContain("30.0%");
    expect(emailMeasure.textContent).toContain("✗");
  });

  it("flags Card #3 when only one platform is represented", () => {
    const items: ApifyKolItem[] = Array.from({ length: 110 }, (_, i) =>
      makeItem({
        id: `row-${i}`,
        platform: "tiktok",
        username: `user${i}`,
        displayName: `User ${i}`,
        followers: 100_000 + i,
        profileUrl: `https://example.com/${i}`,
        emails: [`u${i}@example.com`],
        relevanceScore: 0.6,
        influenceScore: 0.55,
        qualityScore: 0.5,
        reachabilityScore: 0.5,
        matchedTags: ["gaming", "streamer"],
        lastScrapedAt: freshIso(1),
      })
    );

    const { getByTestId } = renderIntl(
      <StatsCards items={items} total={items.length} now={NOW} />
    );

    expect(getByTestId("stats-card3").getAttribute("data-pass")).toBe("false");
    const platformsMeasure = getByTestId("stats-card3-measure-0");
    expect(platformsMeasure.textContent).toContain("1");
    expect(platformsMeasure.textContent).toContain("✗");
  });

  it("collapses to 0/4 + gate-blocked footer when items are empty", () => {
    const { getByTestId } = renderIntl(<StatsCards items={[]} total={0} now={NOW} />);

    expect(getByTestId("stats-card1").getAttribute("data-pass")).toBe("false");
    expect(getByTestId("stats-card2").getAttribute("data-pass")).toBe("false");
    expect(getByTestId("stats-card3").getAttribute("data-pass")).toBe("false");
    expect(getByTestId("stats-card4").getAttribute("data-pass")).toBe("false");
    const footer = getByTestId("stats-footer");
    expect(footer.getAttribute("data-pass-count")).toBe("0");
    expect(footer.textContent).toContain("0 / 4");
  });
});

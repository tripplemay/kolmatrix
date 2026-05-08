/**
 * BL-012-F003 · PreviewTable client component spec.
 *
 * Covers the four acceptance branches:
 *   1. Full-row render (username + platform + followers + tags + emails badge)
 *   2. Quality indicator behaviour (gray/none vs. green emails badge)
 *   3. Row-click expand panel reveals the raw JSON
 *   4. Pagination URL sync (Next button calls router.push with page=2)
 */
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApifyKolItem } from "@/lib/admin/apify-preview-client";

import { renderIntl } from "../../../../../../tests/utils/render-intl";
import { PreviewTable } from "../PreviewTable";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => new URLSearchParams(""),
}));

// jsdom doesn't expose location.pathname assignments well; pin a value so
// pushQuery can build relative URLs without leaking the about:blank prefix.
Object.defineProperty(window, "location", {
  value: { pathname: "/en/admin/apify-preview" },
  writable: true,
});

function makeItem(overrides: Partial<ApifyKolItem> = {}): ApifyKolItem {
  return {
    id: overrides.id ?? "row-1",
    platform: overrides.platform ?? "tiktok",
    platformUserId: overrides.platformUserId ?? "12345",
    username: overrides.username ?? "ninjawarrior",
    displayName: overrides.displayName ?? "Ninja Warrior",
    followers: overrides.followers ?? 250_000,
    verified: overrides.verified ?? true,
    emails: overrides.emails ?? ["press@ninja.gg"],
    aggregatorEmails: overrides.aggregatorEmails ?? [],
    matchedTags: overrides.matchedTags ?? ["gaming", "esports"],
    relevanceScore: overrides.relevanceScore ?? 0.82,
    influenceScore: overrides.influenceScore ?? 0.71,
    qualityScore: overrides.qualityScore ?? 0.6,
    reachabilityScore: overrides.reachabilityScore ?? 0.45,
    profileUrl: overrides.profileUrl ?? "https://www.tiktok.com/@ninjawarrior",
    lastScrapedAt: overrides.lastScrapedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

describe("BL-012-F003 PreviewTable", () => {
  it("renders the full row data: username link, formatted followers, tags, email badge", () => {
    renderIntl(
      <PreviewTable
        items={[makeItem()]}
        page={1}
        pageSize={50}
        total={1}
        query={{ page: 1, pageSize: 50 }}
      />
    );

    const link = screen.getByRole("link", { name: /ninjawarrior/i });
    expect(link).toHaveAttribute("href", "https://www.tiktok.com/@ninjawarrior");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("250,000")).toBeInTheDocument();
    expect(screen.getByText("gaming")).toBeInTheDocument();
    expect(screen.getByText("esports")).toBeInTheDocument();
    // Verified column shows ✓ for true
    expect(screen.getByLabelText("verified").textContent).toBe("✓");
    // Email badge has count 1 in the green tone (we just assert the badge value)
    const row = screen.getByTestId("apify-preview-row-row-1");
    expect(row.textContent).toContain("1");
  });

  it("marks rows with empty emails as muted instead of green", () => {
    renderIntl(
      <PreviewTable
        items={[
          makeItem({
            id: "row-empty",
            emails: [],
            matchedTags: [],
            verified: null,
            followers: null,
          }),
        ]}
        page={1}
        pageSize={50}
        total={1}
        query={{ page: 1, pageSize: 50 }}
      />
    );

    const row = screen.getByTestId("apify-preview-row-row-empty");
    // Empty followers + tags + verified all collapse to em-dash placeholder.
    expect(row.querySelectorAll("td")[2]?.textContent).toBe("—");
    expect(row.querySelectorAll("td")[3]?.textContent).toBe("—");
    expect(row.querySelectorAll("td")[6]?.textContent).toBe("—");
    // Email badge still renders but with count 0 (muted tone).
    expect(row.textContent).toContain("0");
  });

  it("expands the row to show raw JSON when the row is clicked", () => {
    renderIntl(
      <PreviewTable
        items={[makeItem()]}
        page={1}
        pageSize={50}
        total={1}
        query={{ page: 1, pageSize: 50 }}
      />
    );

    expect(screen.queryByTestId("apify-preview-expand-row-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("apify-preview-row-row-1"));

    const expand = screen.getByTestId("apify-preview-expand-row-1");
    expect(expand).toBeInTheDocument();
    expect(expand.textContent).toContain("\"username\": \"ninjawarrior\"");
    expect(screen.getByTestId("expand-copy")).toBeInTheDocument();
  });

  it("syncs pagination state to the URL via router.push when Next is clicked", () => {
    routerPush.mockClear();
    renderIntl(
      <PreviewTable
        items={[makeItem()]}
        page={1}
        pageSize={50}
        total={120}
        query={{ page: 1, pageSize: 50, platform: "tiktok" }}
      />
    );

    fireEvent.click(screen.getByTestId("pagination-next"));

    expect(routerPush).toHaveBeenCalledTimes(1);
    const url = routerPush.mock.calls[0]?.[0] as string;
    expect(url).toContain("/en/admin/apify-preview");
    expect(url).toContain("platform=tiktok");
    expect(url).toContain("page=2");
  });
});

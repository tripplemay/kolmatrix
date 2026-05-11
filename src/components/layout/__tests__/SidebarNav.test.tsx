/**
 * BL-064-F003 · SidebarNav rewrite — 4-item IA tests.
 *
 * Pre-BL-064 this test asserted 8 nav items (Dashboard / Discovery /
 * Database / Campaigns / Email Center / Knowledge Base / Analytics /
 * Settings). After F003 the sidebar is 4 items (Brief / Match / Reach
 * / Insight) and Settings moves to UserAvatarMenu.
 */
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { SidebarNav } from "../SidebarNav";

const pathnameRef = { value: "/en/insight" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.value,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("SidebarNav — BL-064-F003 4-item IA", () => {
  it("renders exactly 4 nav items, each with locale-prefixed href", () => {
    pathnameRef.value = "/en/insight";
    const { container } = renderIntl(<SidebarNav />);
    const links = container.querySelectorAll("a[href]");
    expect(links.length).toBe(4);
    const hrefs = Array.from(links).map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(["/en/brief", "/en/match", "/en/reach", "/en/insight"]);
  });

  it("renders all 4 new IA labels in spec order (Brief → Match → Reach → Insight)", () => {
    pathnameRef.value = "/en/brief";
    const { container } = renderIntl(<SidebarNav />);
    const labels = Array.from(container.querySelectorAll("a")).map((l) =>
      l.textContent?.trim()
    );
    // textContent includes icon name + label; assert each label is present
    expect(labels[0]).toContain("Brief");
    expect(labels[1]).toContain("Match");
    expect(labels[2]).toContain("Reach");
    expect(labels[3]).toContain("Insight");
  });

  it("attaches the description tooltip via the title attribute", () => {
    pathnameRef.value = "/en/brief";
    const { container } = renderIntl(<SidebarNav />);
    const briefLink = container.querySelector("a[href='/en/brief']");
    expect(briefLink?.getAttribute("title")).toBe(
      "Define your product and campaign inputs"
    );
    const insightLink = container.querySelector("a[href='/en/insight']");
    expect(insightLink?.getAttribute("title")).toBe(
      "Results, ROI, and retrospectives"
    );
  });

  it("marks exactly one item with aria-current='page' and the active label matches the path", () => {
    pathnameRef.value = "/en/match";
    const { container } = renderIntl(<SidebarNav />);
    const withAria = container.querySelectorAll("a[aria-current='page']");
    expect(withAria).toHaveLength(1);
    expect(withAria[0]?.textContent).toContain("Match");
  });

  it("highlights the new IA nav for legacy paths via deriveActiveNav (defensive fallback)", () => {
    // /dashboard maps to insight (will normally 302 via F002, but if reached
    // directly e.g. in tests, sidebar still highlights correctly)
    pathnameRef.value = "/en/dashboard";
    const first = renderIntl(<SidebarNav />);
    expect(
      first.container.querySelector("a[aria-current='page']")?.textContent
    ).toContain("Insight");
    first.unmount();
    // /campaigns list → match
    pathnameRef.value = "/en/campaigns";
    const second = renderIntl(<SidebarNav />);
    expect(
      second.container.querySelector("a[aria-current='page']")?.textContent
    ).toContain("Match");
  });
});

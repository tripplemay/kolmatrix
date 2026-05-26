import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { Sidebar } from "../Sidebar";

// BIx-mvp-polish-pass F005-F: Sidebar dropped `activeId`. The active
// nav item is derived inside SidebarNav (a leaf client island) via
// `usePathname()`. Tests pin the pathname through this mock instead.
const pathnameRef = { value: "/en/dashboard" };
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

// BL-055 F005: SidebarLogo is now an async server component that pulls
// `common.brand.subtitle` via getTranslations. The Sidebar shell test
// only cares that the brand block + nav + user chip coexist in the
// aside, so we stub SidebarLogo with a sync placeholder rather than
// wiring next-intl/server into the suspense boundary.
vi.mock("../SidebarLogo", () => ({
  SidebarLogo: () => (
    <div data-testid="sidebar-logo-stub">
      <span>KOLMatrix</span>
    </div>
  ),
}));

describe("Sidebar", () => {
  const user = { name: "Sarah Chen", role: "Marketer" };

  it("renders logo + nav + user chip in one aside", () => {
    pathnameRef.value = "/en/dashboard";
    const { container } = renderIntl(<Sidebar user={user} />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.textContent).toContain("KOLMatrix");
    expect(aside?.textContent).toContain("Sarah Chen");
    expect(aside?.textContent).toContain("Marketer");
  });

  it("derives the active nav item from the current pathname", () => {
    // BL-064-F003 — /campaigns list page maps to the Match nav item
    // BL-074-F001 — /campaigns is now its own first-class nav (was
    // BL-064-F003 mapped to match; promoted under ADR-015).
    pathnameRef.value = "/en/campaigns";
    const { container } = renderIntl(<Sidebar user={user} />);
    const active = container.querySelector("a[aria-current='page']");
    expect(active?.textContent).toContain("Campaigns");
  });
});

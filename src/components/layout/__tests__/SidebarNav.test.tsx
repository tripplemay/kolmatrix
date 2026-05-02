import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { SidebarNav } from "../SidebarNav";

// BIx-mvp-polish-pass F005-F: SidebarNav now reads `usePathname()`
// instead of receiving `activeId` as a prop, so each test pins the
// pathname via this mock to drive aria-current selection.
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

describe("SidebarNav", () => {
  it("renders all 8 nav items with locale-prefixed hrefs", () => {
    pathnameRef.value = "/en/dashboard";
    const { container } = renderIntl(<SidebarNav />);
    const links = container.querySelectorAll("a[href]");
    expect(links.length).toBe(8);
    links.forEach((link) => {
      expect(link.getAttribute("href")?.startsWith("/en/")).toBe(true);
    });
  });

  it("marks the active item with aria-current='page' and passive items without", () => {
    pathnameRef.value = "/en/campaigns";
    const { container } = renderIntl(<SidebarNav />);
    const active = container.querySelector("a[aria-current='page']");
    expect(active?.textContent).toContain("Campaigns");

    const all = container.querySelectorAll("a");
    const withAria = Array.from(all).filter((a) => a.hasAttribute("aria-current"));
    expect(withAria).toHaveLength(1);
  });

  it("puts aria-current on the matching item across different pathnames", () => {
    pathnameRef.value = "/en/dashboard";
    const first = renderIntl(<SidebarNav />);
    expect(first.container.querySelector("a[aria-current='page']")?.textContent).toContain(
      "Dashboard"
    );
    first.unmount();

    pathnameRef.value = "/en/roi";
    const second = renderIntl(<SidebarNav />);
    expect(second.container.querySelector("a[aria-current='page']")?.textContent).toContain(
      "Analytics"
    );
  });
});

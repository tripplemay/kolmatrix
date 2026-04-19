import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { SidebarNav } from "../SidebarNav";

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
    const { container } = renderIntl(<SidebarNav activeId="dashboard" />);
    const links = container.querySelectorAll("a[href]");
    expect(links.length).toBe(8);
    links.forEach((link) => {
      expect(link.getAttribute("href")?.startsWith("/en/")).toBe(true);
    });
  });

  it("marks the active item with aria-current='page' and passive items without", () => {
    const { container } = renderIntl(<SidebarNav activeId="campaigns" />);
    const active = container.querySelector("a[aria-current='page']");
    expect(active?.textContent).toContain("Campaigns");

    const all = container.querySelectorAll("a");
    const withAria = Array.from(all).filter((a) => a.hasAttribute("aria-current"));
    expect(withAria).toHaveLength(1);
  });

  it("puts aria-current on the matching item across different activeIds", () => {
    const first = renderIntl(<SidebarNav activeId="dashboard" />);
    expect(first.container.querySelector("a[aria-current='page']")?.textContent).toContain(
      "Dashboard"
    );
    first.unmount();

    const second = renderIntl(<SidebarNav activeId="analytics" />);
    expect(second.container.querySelector("a[aria-current='page']")?.textContent).toContain(
      "Analytics"
    );
  });
});

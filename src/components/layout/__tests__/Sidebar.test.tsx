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
    pathnameRef.value = "/en/campaigns";
    const { container } = renderIntl(<Sidebar user={user} />);
    const active = container.querySelector("a[aria-current='page']");
    expect(active?.textContent).toContain("Campaigns");
  });
});

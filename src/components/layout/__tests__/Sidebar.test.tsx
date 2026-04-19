import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { Sidebar } from "../Sidebar";

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
    const { container } = renderIntl(<Sidebar activeId="dashboard" user={user} />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.textContent).toContain("KOLMatrix");
    expect(aside?.textContent).toContain("Sarah Chen");
    expect(aside?.textContent).toContain("Marketer");
  });

  it("passes the activeId down so the correct nav item is marked", () => {
    const { container } = renderIntl(<Sidebar activeId="campaigns" user={user} />);
    const active = container.querySelector("a[aria-current='page']");
    expect(active?.textContent).toContain("Campaigns");
  });
});

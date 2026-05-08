import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { UserAvatarMenu } from "../UserAvatarMenu";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
}));

describe("UserAvatarMenu", () => {
  const user = { name: "Sarah Chen", email: "sarah@kolmatrix.local" };

  it("opens the menu on click and shows name + email + profile + signout", async () => {
    const onSignOut = vi.fn();
    const u = userEvent.setup();
    renderIntl(<UserAvatarMenu user={user} onSignOut={onSignOut} />);
    await u.click(screen.getByRole("button"));
    expect(screen.getByText("Sarah Chen")).toBeInTheDocument();
    expect(screen.getByText("sarah@kolmatrix.local")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Profile/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Sign out/ })).toBeInTheDocument();
  });

  it("closes the menu on Escape", async () => {
    const u = userEvent.setup();
    renderIntl(<UserAvatarMenu user={user} />);
    await u.click(screen.getByRole("button"));
    expect(screen.queryByRole("menuitem", { name: /Profile/ })).toBeInTheDocument();
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("menuitem", { name: /Profile/ })).toBeNull();
  });

  it("shows initial fallback when user has no avatarUrl", () => {
    renderIntl(<UserAvatarMenu user={{ name: "Mark" }} />);
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("renders the admin section with the Apify Preview link for tenant_admin role", async () => {
    const u = userEvent.setup();
    renderIntl(<UserAvatarMenu user={user} role="tenant_admin" />);
    await u.click(screen.getByRole("button"));

    expect(screen.getByTestId("user-avatar-admin-section")).toBeInTheDocument();
    const link = screen.getByRole("menuitem", { name: /Apify Preview/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/en/admin/apify-preview");
    expect(screen.getByText("Admin Tools")).toBeInTheDocument();
  });

  it("also shows the admin section for platform_admin role", async () => {
    const u = userEvent.setup();
    renderIntl(<UserAvatarMenu user={user} role="platform_admin" />);
    await u.click(screen.getByRole("button"));

    expect(screen.getByTestId("user-avatar-admin-section")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Apify Preview/i })).toBeInTheDocument();
  });

  it("hides the admin section for the marketer role", async () => {
    const u = userEvent.setup();
    renderIntl(<UserAvatarMenu user={user} role="marketer" />);
    await u.click(screen.getByRole("button"));

    expect(screen.queryByTestId("user-avatar-admin-section")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Apify Preview/i })).toBeNull();
    expect(screen.queryByText("Admin Tools")).toBeNull();
  });

  it("hides the admin section when role is undefined", async () => {
    const u = userEvent.setup();
    renderIntl(<UserAvatarMenu user={user} />);
    await u.click(screen.getByRole("button"));

    expect(screen.queryByTestId("user-avatar-admin-section")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Apify Preview/i })).toBeNull();
  });
});

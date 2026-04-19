import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { UserAvatarMenu } from "../UserAvatarMenu";

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
});

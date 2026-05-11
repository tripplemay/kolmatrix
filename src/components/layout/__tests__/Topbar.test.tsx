import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { Topbar } from "../Topbar";

// BIx-mvp-polish-pass F005-F: Topbar dropped its `pageTitle` prop —
// the title is now derived inside the `PageTitleClient` leaf using
// `usePathname()`. Mocking `usePathname` here lets us pin the route
// while keeping Topbar itself a server-component.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/insight",
}));
vi.mock("@/app/[locale]/(app)/actions", () => ({
  updateUserLocale: vi.fn().mockResolvedValue(undefined),
}));

describe("Topbar", () => {
  const user = { name: "Sarah Chen", email: "sarah@kolmatrix.local" };

  it("renders page title (derived from pathname), search and all top-right action icons", () => {
    renderIntl(<Topbar user={user} unreadNotifications={2} />);
    expect(screen.getByRole("heading", { name: "Insight" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search KOLs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications (2 unread)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change language" })).toBeInTheDocument();
  });

  it("works without unreadNotifications prop", () => {
    renderIntl(<Topbar user={user} />);
    expect(screen.getByRole("heading", { name: "Insight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});

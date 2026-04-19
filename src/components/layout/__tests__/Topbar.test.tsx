import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { Topbar } from "../Topbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/en/dashboard",
}));
vi.mock("@/app/[locale]/(app)/actions", () => ({
  updateUserLocale: vi.fn().mockResolvedValue(undefined),
}));

describe("Topbar", () => {
  const user = { name: "Sarah Chen", email: "sarah@kolmatrix.local" };

  it("renders page title, search and all top-right action icons", () => {
    renderIntl(<Topbar pageTitle="Dashboard" user={user} unreadNotifications={2} />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search KOLs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications (2 unread)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change language" })).toBeInTheDocument();
  });

  it("works without unreadNotifications prop", () => {
    renderIntl(<Topbar pageTitle="KOL Database" user={user} />);
    expect(screen.getByRole("heading", { name: "KOL Database" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});

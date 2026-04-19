import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { TopbarActions } from "../TopbarActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/dashboard",
}));
vi.mock("@/app/[locale]/(app)/actions", () => ({
  updateUserLocale: vi.fn().mockResolvedValue(undefined),
}));

describe("TopbarActions", () => {
  const user = { name: "Sarah Chen", email: "sarah@kolmatrix.local" };

  it("renders LanguageSwitcher + NotificationBell + avatar menu", () => {
    renderIntl(<TopbarActions user={user} unreadNotifications={3} />);
    expect(screen.getByRole("button", { name: "Change language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications (3 unread)" })).toBeInTheDocument();
    // avatar menu trigger is an anon button with expand_more chevron
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(3);
  });

  it("omits unread aria count when unreadNotifications=0", () => {
    renderIntl(<TopbarActions user={user} />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });
});

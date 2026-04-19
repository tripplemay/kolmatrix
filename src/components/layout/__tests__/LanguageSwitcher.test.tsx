import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderIntl } from "../../../../tests/utils/render-intl";
import { LanguageSwitcher } from "../LanguageSwitcher";

const pushMock = vi.fn();
const updateUserLocaleMock = vi.fn().mockResolvedValue(undefined);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/en/dashboard",
}));

vi.mock("@/app/[locale]/(app)/actions", () => ({
  updateUserLocale: (...args: unknown[]) => updateUserLocaleMock(...args),
}));

describe("LanguageSwitcher", () => {
  it("opens the menu when clicked and lists all 5 locales", async () => {
    const user = userEvent.setup();
    renderIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "Change language" }));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(5);
    expect(items.map((n) => n.textContent?.trim())).toEqual([
      "English",
      "中文（简体）",
      "日本語",
      "한국어",
      "Español",
    ]);
  });

  it("disables the currently-selected locale row", async () => {
    const user = userEvent.setup();
    renderIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "Change language" }));
    const englishItem = screen.getByRole("menuitem", { name: "English" });
    expect(englishItem).toBeDisabled();
  });

  it("calls updateUserLocale and router.push when another locale is picked", async () => {
    pushMock.mockReset();
    updateUserLocaleMock.mockClear();
    const user = userEvent.setup();
    renderIntl(<LanguageSwitcher />);
    await user.click(screen.getByRole("button", { name: "Change language" }));
    await user.click(screen.getByRole("menuitem", { name: "日本語" }));
    expect(updateUserLocaleMock).toHaveBeenCalledWith("ja");
    expect(pushMock).toHaveBeenCalledWith("/ja/dashboard");
  });
});

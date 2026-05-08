/**
 * BL-055 F005 — SidebarLogo now reads `common.brand.subtitle` from the
 * active locale instead of the hardcoded Stitch codename. We mock
 * `next-intl/server.getTranslations` at the module boundary so the
 * async server component works in jsdom + asserts the i18n contract
 * rather than the literal English string.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getTranslationsMock = vi.fn();

vi.mock("next-intl/server", () => ({
  getTranslations: (namespace: string) => getTranslationsMock(namespace),
}));

const { SidebarLogo } = await import("../SidebarLogo");

describe("SidebarLogo", () => {
  it("renders the KOLMatrix wordmark and the i18n product tagline", async () => {
    getTranslationsMock.mockResolvedValueOnce(
      (key: string) => (key === "subtitle" ? "Game KOL Marketing Platform" : key)
    );
    const ui = await SidebarLogo();
    render(ui);
    expect(screen.getByText("KOLMatrix")).toBeInTheDocument();
    expect(screen.getByText("Game KOL Marketing Platform")).toBeInTheDocument();
    expect(getTranslationsMock).toHaveBeenCalledWith("common.brand");
  });

  it("does not render the legacy 'Neural Velocity' codename", async () => {
    getTranslationsMock.mockResolvedValueOnce(
      (key: string) => (key === "subtitle" ? "游戏 KOL 智能营销平台" : key)
    );
    const ui = await SidebarLogo();
    const { container } = render(ui);
    expect(container.textContent).not.toContain("Neural Velocity");
  });

  it("renders the K monogram tile", async () => {
    getTranslationsMock.mockResolvedValueOnce(
      (key: string) => (key === "subtitle" ? "Game KOL Marketing Platform" : key)
    );
    const ui = await SidebarLogo();
    const { container } = render(ui);
    expect(container.textContent).toContain("K");
  });
});

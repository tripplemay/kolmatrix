/**
 * MVP-vf-F002 · /discovery prototype-fidelity E2E.
 *
 * Asserts the Stitch "不得简化的元素" list against a real authenticated
 * render of /en/discovery. Source-level static greps live alongside
 * the page (`src/app/[locale]/(app)/discovery/__tests__/discovery-
 * fidelity.test.ts`) and run in milliseconds; this spec is the
 * end-to-end proof that the same markers actually mount in a
 * Playwright-driven browser.
 *
 * BM1-F009 / BM2 F011-001 lessons: never `waitForLoadState
 * ("networkidle")`; rely on `expect(locator).toBeVisible()` auto-wait.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLMatrix@2026!",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // BL-064-F002 — /dashboard 302→/insight; accept either tail
  await page.waitForURL(/\/(en|zh|ja|ko|es)\/(dashboard|insight)(\/|$)/);
}

// BL-065-F001 — /discovery is being decommissioned. F002 (BL-064) 302's
// /en/discovery to /en/match, and BL-065-F001 just retired the A2 embed
// where /match re-exported the legacy Discovery page (and therefore still
// mounted `data-testid="discovery-grid"`). The new /match workbench uses
// `match-grid` / `match-kol-card`; rewriting every assertion below to
// those selectors duplicates work that F006 already plans (it deletes
// /discovery + this file outright and stands up tests/e2e/match-
// fidelity.spec.ts to cover the new workbench). Mirrors the
// database-fidelity DECOMMISSIONED skip landed in BL-064-F006.
test.describe.skip("/discovery fidelity (MVP-vf-F002) — DECOMMISSIONED BY BL-065-F001", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // BL-064-F002 — /en/discovery now 302-redirects to /en/match which
    // embeds the same Discovery page component (F001 A2 embed-old).
    // Hitting /en/match directly avoids the redirect hop while still
    // proving the discovery UI mounts under the new IA shell.
    await page.goto("/en/match");
    await expect(page.getByTestId("discovery-grid")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("AI Smart Match CTA opens the SmartMatchDialog (B7a-F002)", async ({
    page,
  }) => {
    const button = page.getByTestId("ai-smart-match-button");
    await expect(button).toBeVisible();
    // B7a-F002: button is enabled when at least one product exists.
    // Demo seed has products, so we expect interactive state. If the
    // button happens to be disabled (no products in this run), assert
    // the no-products tooltip instead.
    if (await button.isDisabled()) {
      const title = await button.getAttribute("title");
      expect(title, "no-products tooltip").toBeTruthy();
      return;
    }
    await button.click();
    await expect(page.getByTestId("smart-match-dialog")).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByTestId("smart-match-product-select")
    ).toBeVisible();
  });

  test("Save Search control is visible and interactive", async ({
    page,
  }) => {
    const button = page.getByTestId("save-search-button");
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test("main search bar surfaces platform selector + search input + AI chips", async ({
    page,
  }) => {
    await expect(page.getByTestId("discovery-search-bar")).toBeVisible();
    await expect(page.getByTestId("search-platform-select")).toBeVisible();
    await expect(page.getByTestId("search-main-input")).toBeVisible();
    // Three pre-filled AI suggestion chips
    await expect(page.getByTestId("ai-chip-1")).toBeVisible();
    await expect(page.getByTestId("ai-chip-2")).toBeVisible();
    await expect(page.getByTestId("ai-chip-3")).toBeVisible();
  });

  test("Grid/List view toggle is wired to the ?view URL param", async ({
    page,
  }) => {
    const toggle = page.getByTestId("discovery-view-toggle");
    await expect(toggle).toBeVisible();
    const grid = page.getByTestId("view-grid");
    const list = page.getByTestId("view-list");
    await expect(grid).toBeVisible();
    await expect(list).toBeVisible();
    // Default state: grid is the current view.
    await expect(grid).toHaveAttribute("aria-current", "true");

    // Click into list view via its href link.
    await list.click();
    await page.waitForURL(/[?&]view=list/);
    await expect(page.getByTestId("view-list")).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  test("Active Filter chip click clears that single filter", async ({
    page,
  }) => {
    // Apply a single platform filter via URL so the test is self-contained
    // (the form submit dance would re-render twice).
    // BL-064-F002 — /en/discovery → /en/match (embed-old); query params
    // pass through since the page reads searchParams server-side.
    await page.goto("/en/match?platforms=youtube");
    await expect(page.getByTestId("discovery-grid")).toBeVisible({
      timeout: 15_000,
    });

    const activeBar = page.getByTestId("discovery-active-filters");
    await expect(activeBar).toBeVisible();
    const chip = page.getByTestId("active-filter-chip-platform-youtube");
    await expect(chip).toBeVisible();
    await chip.click();

    // Clicking the chip is a plain anchor → /discovery without that
    // platform param. Wait for the URL to drop the platforms key.
    await page.waitForURL((url) => !/[?&]platforms=/.test(url.toString()), {
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("active-filter-chip-platform-youtube")
    ).toHaveCount(0);
  });

  test("result grid uses xl:grid-cols-4 (per F002 acceptance, not 3)", async ({
    page,
  }) => {
    const grid = page.getByTestId("discovery-grid");
    const className = await grid.getAttribute("class");
    expect(className, "discovery-grid class").toBeTruthy();
    expect(className!).toContain("xl:grid-cols-4");
    expect(className!).not.toContain("xl:grid-cols-3");
  });
});

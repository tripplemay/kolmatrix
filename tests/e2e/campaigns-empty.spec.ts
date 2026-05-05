/**
 * BM2-F003 · /campaigns — smoke + filter "no-matches" coverage
 *
 * Two flows:
 *
 *   1. Landing page smoke — marketer reaches /campaigns, the page
 *      title + "New Campaign" CTA render, and *either* the empty-
 *      state (`data-testid="campaigns-empty"`) or the table
 *      (`data-testid="campaigns-table"`) is visible. This stays
 *      robust against seed state: a fresh tenant shows the empty
 *      state; the demo seed (3 campaigns) shows the table.
 *
 *   2. Filter no-matches — type a name that matches zero campaigns
 *      → the "no matches" card (`data-testid="campaigns-no-matches"`)
 *      renders. This exercises the branch the pre-impl audit §7 #F
 *      split out from the empty-state.
 *
 * True zero-campaign empty state is asserted in integration tests
 * against a clean Testcontainers tenant; staging / seeded dev never
 * start at zero, so E2E sticks to the filter route.
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
  await page.waitForURL(/\/dashboard(\/|$)/);
}

test.describe("BM2-F003 · Campaigns list", () => {
  test("renders the page frame and new-campaign CTA", async ({ page }) => {
    await login(page);

    await page
      .locator("aside")
      .getByRole("link", { name: /^Campaigns$/ })
      .click();
    await page.waitForURL(/\/campaigns(\/|\?|$)/);

    // Title always renders regardless of row count. AppShell's Topbar
    // also renders a "Campaigns" heading, so we scope to the page-
    // specific testid instead of getByRole to avoid strict-mode
    // double-match.
    await expect(page.getByTestId("campaigns-page-title")).toBeVisible();

    // CTA always renders too — it's the single path to F004.
    await expect(page.getByTestId("campaigns-new-button")).toBeVisible();

    // Either empty-state or the table must be visible. A brand-new
    // tenant sees the empty-state; the demo seed shows the table.
    const emptyState = page.getByTestId("campaigns-empty");
    const table = page.getByTestId("campaigns-table");
    await expect(emptyState.or(table)).toBeVisible();
  });

  test("filter no-matches hint renders when search returns zero rows", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/en/campaigns?search=zzzzzz-no-campaign-will-match-this");

    // The filter bar still renders (search input preserved).
    await expect(page.getByTestId("campaigns-filters")).toBeVisible();

    // No-matches card (distinct from the tenant-empty state).
    await expect(page.getByTestId("campaigns-no-matches")).toBeVisible();
    await expect(page.getByTestId("campaigns-table")).toHaveCount(0);
  });
});

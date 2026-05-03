/**
 * BL-025-F004 — `/assets` three-column page E2E.
 *
 * Pre-reqs (dev environment):
 *   - Postgres + Redis up
 *   - `prisma migrate deploy` + `npm run db:seed` (seeds 5 system_seed
 *     email templates which the F001 migration mirrors into the asset
 *     table — so the marketer always has at least 5 visible assets).
 *
 * Login uses the marketer seed credentials.
 *
 * The wizard / filter sidebar / detail panel cases stop short of
 * triggering the actual aigcgateway call so the suite is deterministic
 * without needing a stubbed AI server. Generate-flow round-trips are
 * covered by the unit specs (mutations.test.ts + actions.test.ts).
 */
import { expect, test } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLM@2026!",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(/\/dashboard(\/|$)/);
}

async function gotoAssets(page: import("@playwright/test").Page) {
  await login(page);
  // Sidebar may live under "Assets" or be /<locale>/assets. We reach
  // it via direct nav since the sidebar item is linked under the
  // Knowledge Base group in nav-config.
  const url = page.url();
  const localeMatch = url.match(/\/(en|zh|ja|ko|es)\//);
  const locale = localeMatch?.[1] ?? "en";
  await page.goto(`/${locale}/assets`);
  await page.waitForURL(/\/assets/);
}

test.describe("BL-025-F004 /assets page", () => {
  test("renders the three-column shell with the filter sidebar + grid", async ({ page }) => {
    await gotoAssets(page);
    await expect(page.getByText(/Filters/i)).toBeVisible();
    await expect(page.getByText(/Search/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Clear all/i })).toBeVisible();
  });

  test("filter URL state hydrates from a deep link (?status=published)", async ({ page }) => {
    await login(page);
    const url = page.url();
    const locale = url.match(/\/(en|zh|ja|ko|es)\//)?.[1] ?? "en";
    await page.goto(`/${locale}/assets?status=published`);
    // The status group renders a circle indicator — published row
    // should report aria-pressed="true".
    await expect(
      page.getByRole("button", { name: /^Published$/, pressed: true })
    ).toBeVisible();
  });

  test("clicking + New Asset opens the 3-step wizard at step 1", async ({ page }) => {
    await gotoAssets(page);
    await page.getByRole("button", { name: /New Asset/i }).click();
    await expect(page.getByTestId("new-asset-wizard")).toBeVisible();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    // Email + Video chips both visible
    await expect(page.getByRole("button", { name: /Email/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Video/ })).toBeVisible();
  });

  test("wizard Continue advances to step 2 with the steering presets", async ({ page }) => {
    await gotoAssets(page);
    await page.getByRole("button", { name: /New Asset/i }).click();
    // Pick a product. The Combobox triggers a popup with the seeded
    // product list (3 campaigns × 1 product each). We simply type and
    // pick the first match if any product exists.
    const combo = page.getByLabel("Wizard product picker");
    await combo.click();
    await combo.fill("Honor");
    const firstOption = page.getByRole("option").first();
    if (await firstOption.isVisible()) {
      await firstOption.click();
    } else {
      // No seeded product — fall back to clicking any first option.
      await page.keyboard.press("Escape");
      test.skip(true, "No seeded products visible to marketer login");
    }
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    // 6 quick-preset chips render
    await expect(page.getByRole("button", { name: /Emphasize affordability/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Use social proof/ })).toBeVisible();
  });

  test("wizard ← Back returns to step 1", async ({ page }) => {
    await gotoAssets(page);
    await page.getByRole("button", { name: /New Asset/i }).click();
    const combo = page.getByLabel("Wizard product picker");
    await combo.click();
    const firstOption = page.getByRole("option").first();
    if (!(await firstOption.isVisible())) {
      test.skip(true, "No seeded products visible to marketer login");
    }
    await firstOption.click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
  });

  test("wizard Cancel closes the dialog without saving", async ({ page }) => {
    await gotoAssets(page);
    await page.getByRole("button", { name: /New Asset/i }).click();
    await expect(page.getByTestId("new-asset-wizard")).toBeVisible();
    await page.getByRole("button", { name: /^Cancel$/ }).click();
    await expect(page.getByTestId("new-asset-wizard")).not.toBeVisible();
  });

  test("clicking an asset opens the detail panel", async ({ page }) => {
    await gotoAssets(page);
    // System-seed assets exist via the F001 migration (5 templates).
    const card = page.getByRole("button", { pressed: false }).filter({ hasText: /v\d+ of/ }).first();
    if (!(await card.isVisible())) {
      test.skip(true, "No assets visible to marketer login");
    }
    await card.click();
    // Detail panel header shows close + asset title; the AI/User chip
    // is one of the existing common atoms.
    await expect(page.getByLabel("Close detail panel")).toBeVisible();
  });

  test("detail panel sentinel is rendered (infinite scroll wiring)", async ({ page }) => {
    await gotoAssets(page);
    // Sentinel renders at the bottom of the grid container even with
    // few items; the data-testid lets us verify the wiring without
    // depending on having >24 assets.
    await expect(page.getByTestId("assets-sentinel")).toBeAttached();
  });

  test("filter deep link with empty filter shows the empty state CTA pair", async ({ page }) => {
    await login(page);
    const url = page.url();
    const locale = url.match(/\/(en|zh|ja|ko|es)\//)?.[1] ?? "en";
    // A productId that won't match anything keeps the listing empty
    // without polluting the DB.
    await page.goto(
      `/${locale}/assets?productId=00000000-0000-0000-0000-000000000000`
    );
    await expect(page.getByText(/No assets yet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate from product/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create blank/ })).toBeVisible();
  });
});

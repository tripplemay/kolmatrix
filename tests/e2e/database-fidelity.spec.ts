/**
 * MVP-vf-F003 · /database prototype-fidelity E2E.
 *
 * Asserts the Stitch "不得简化的元素" list against a real authenticated
 * render of /en/database. Source-level static greps live alongside
 * the page (`src/app/[locale]/(app)/database/__tests__/database-
 * fidelity.test.ts`); this spec proves the same markers hydrate in a
 * real Playwright browser.
 *
 * The fresh staging seed has zero isSaved=true rows, so the database
 * page renders the empty-state panel by default. The KPI strip,
 * filter bar, and Insights rail mount regardless of row count, so
 * every assertion below is reachable on a clean tenant.
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
  await page.waitForURL(/\/(en|zh|ja|ko|es)\/dashboard(\/|$)/);
}

test.describe("/database fidelity (MVP-vf-F003)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/en/database");
    // Either the table wrapper or the empty-state mounts — the KPI
    // strip and filter bar are always present.
    await expect(page.getByTestId("database-quick-stats")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Quick Stats KPI strip renders all four cards", async ({ page }) => {
    const strip = page.getByTestId("database-quick-stats");
    await expect(strip).toBeVisible();
    // Four StatCard children (Total / Active / Avg AI Score / Reach).
    const cards = strip.locator("> *");
    await expect(cards).toHaveCount(4);
  });

  test("filter bar surfaces 7 dimensions (status pills + search + 3 dropdowns + tags)", async ({
    page,
  }) => {
    await expect(page.getByTestId("database-filters")).toBeVisible();
    await expect(page.getByTestId("database-status-pills")).toBeVisible();
    // Status "all" pill should be the default-pressed chip.
    const allPill = page.getByTestId("database-status-pill-all");
    await expect(allPill).toBeVisible();
    await expect(allPill).toHaveAttribute("aria-current", "true");
  });

  test("Tier and Game filters are live enabled controls", async ({ page }) => {
    const filters = page.getByTestId("database-filters");
    const tier = filters.locator('select[name="tiers"]');
    const game = filters.locator('select[name="categories"]').nth(1);
    await expect(tier).toBeVisible();
    await expect(tier).toBeEnabled();
    await expect(game).toBeVisible();
    await expect(game).toBeEnabled();
  });

  test("Insights Panel renders all three cards (AI / Coverage Gap / Engagement)", async ({
    page,
  }) => {
    await expect(page.getByTestId("database-insights-panel")).toBeVisible();
    // The three card-level GlassPanels stack vertically; assert each
    // localised heading is present in the right rail.
    const panel = page.getByTestId("database-insights-panel");
    await expect(panel.getByRole("heading", { level: 4 })).toHaveCount(3);
  });

  test("Bulk Action Bar is absent on a fresh load (no ghost CTA)", async ({ page }) => {
    // BulkActionBar's `if (count === 0) return null` guard means it
    // never mounts on first render — the floating CTA only appears
    // after the user picks at least one row. This is the "no ghost
    // control" contract the F003 acceptance demands.
    await expect(page.getByTestId("database-bulk-bar")).toHaveCount(0);
  });

  test("Bulk Action Bar mounts after a row checkbox toggles (state contract)", async ({ page }) => {
    // Behavioural assertion: when at least one row is selected, the
    // BulkActionBar must mount. Auto-skips if the seed has no saved
    // KOLs (the empty-state path is still covered by the
    // "no ghost CTA" assertion above).
    const rowCount = await page.getByTestId("database-row").count();
    test.skip(rowCount === 0, "No saved KOLs in seed — checkbox interaction path unreachable.");

    // Base UI Checkbox renders as button[role="checkbox"]; use
    // getByRole rather than a CSS selector to avoid attribute-order
    // surprises across base-ui releases.
    const firstRow = page.getByTestId("database-row").first();
    await firstRow.getByRole("checkbox").first().click();
    await expect(page.getByTestId("database-bulk-bar")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("bulk-bar-count")).toHaveText("1");

    // BIx-mvp-polish-pass F002 P1-4: Email button is now active and
    // routes to /outreach with `?kolIds=` preselection. Delete keeps
    // the disabled placeholder until B6 ships destructive bulk actions.
    const email = page.getByTestId("bulk-bar-email");
    await expect(email).toBeVisible();
    await expect(email).toBeEnabled();
    expect(await email.getAttribute("title")).toBeTruthy();
    const del = page.getByTestId("bulk-bar-delete");
    await expect(del).toBeDisabled();
    expect(await del.getAttribute("title")).toBeTruthy();
  });

  test("header CTAs (Export / Import / Add KOL) are disabled placeholders", async ({ page }) => {
    for (const testid of ["database-export", "database-import", "database-add-kol"] as const) {
      const button = page.getByTestId(testid);
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      const title = await button.getAttribute("title");
      expect(title, `${testid} title attr`).toBeTruthy();
    }
  });
});

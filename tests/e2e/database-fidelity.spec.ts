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

// BL-060 fix-round 2 — opt into the storageState produced by the
// `setup` project (tests/e2e/marketer.setup.ts). One login per
// playwright run instead of one per case eliminates the cumulative
// login flake that tripped Bulk Action Bar / header CTAs in
// fix-round 1's reverify (5/9 — see docs/test-reports/
// BL-060-reverifying-2026-05-09.md). beforeEach below now jumps
// straight to /en/database with the marketer's session already
// hydrated from cookies + localStorage.
test.use({ storageState: "playwright/.auth/marketer.json" });

// BL-064-F005 — /database route is 302-redirected to /match (F002) and
// the page itself is scheduled for removal in BL-065 (Phase 2 Match
// rewrite). The fidelity assertions below target the legacy /database
// markup which no longer renders, so the whole describe is skipped.
// Re-enable once BL-065 Match page lands with database-equivalent
// controls; or delete this file when BL-070 cleans up legacy code.
test.describe.skip("/database fidelity (MVP-vf-F003) — DECOMMISSIONED BY BL-064/BL-065", () => {
  test.beforeEach(async ({ page }) => {
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

  test("header CTAs (Export / Import / Add KOL) are wired and enabled (BL-024 F001-1/2/3)", async ({ page }) => {
    // BL-024 F001-1 (commit 060241b) shipped Export as a <Link> to
    // /api/database/export-csv?…; F001-2 (49411ef) wired Import via
    // <ImportCsvDialog>; F001-3 (e4acbf7) wired Add KOL via
    // <AddKolDialog>. Each dialog renders an enabled trigger Button
    // with the legacy data-testid; Export is a <Link> (no `disabled`
    // attr possible). All three must be visible + active.
    const exportLink = page.getByTestId("database-export");
    await expect(exportLink).toBeVisible();
    const exportHref = await exportLink.getAttribute("href");
    expect(exportHref, "database-export href").toMatch(/\/api\/database\/export-csv/);

    for (const testid of ["database-import", "database-add-kol"] as const) {
      const trigger = page.getByTestId(testid);
      await expect(trigger).toBeVisible();
      await expect(trigger).toBeEnabled();
    }
  });
});

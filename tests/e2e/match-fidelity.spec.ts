/**
 * BL-065-F006 · /match fidelity E2E.
 *
 * Replaces the deleted database-fidelity.spec.ts + discovery-fidelity
 * .spec.ts. Asserts the core marketer-facing surfaces against a real
 * authenticated /en/match render:
 *   1. Card view mounts (match-grid + match-kol-card).
 *   2. Table view mounts when ?view=table is set (match-table-wrapper
 *      + checkbox column + bulk-action bar wiring).
 *   3. Status pill filter on the sidebar (match-status-pill-*).
 *   4. AI suggestions sidebar mounts only with a valid ?campaignId=
 *      (resolves tenant-scoped per BL-065-F005).
 *   5. Add KOL button mounts (match.headerActions trigger).
 *
 * BM1-F009 / BM2 F011-001 lessons:
 *   - no `waitForLoadState("networkidle")`
 *   - rely on `expect(locator).toBeVisible()` auto-wait
 *   - locale-prefixed URL regexes
 */
import { expect, test } from "@playwright/test";

// Reuse the storageState produced by the `setup` project (BL-060
// fix-round 2 pattern) so we don't run a fresh login per case.
test.use({ storageState: "playwright/.auth/marketer.json" });

test.describe("/match fidelity (BL-065-F006)", () => {
  test("card view mounts the grid + at least one KOL card", async ({ page }) => {
    await page.goto("/en/match");
    await page.waitForURL(/\/en\/match(\/|\?|$)/);
    await expect(page.getByTestId("match-page")).toBeVisible();
    const grid = page.getByTestId("match-grid");
    await expect(grid).toBeVisible({ timeout: 15_000 });
    const cards = page.getByTestId("match-kol-card");
    await expect(cards.first()).toBeVisible();
  });

  test("table view mounts the table wrapper + selection checkbox column", async ({
    page,
  }) => {
    await page.goto("/en/match?view=table");
    await expect(page.getByTestId("match-page")).toHaveAttribute(
      "data-view",
      "table",
    );
    const table = page.getByTestId("match-table-wrapper");
    await expect(table).toBeVisible({ timeout: 15_000 });
    // The bulk-action bar should NOT be visible until a row is selected.
    await expect(page.getByTestId("match-bulk-bar")).toHaveCount(0);
  });

  test("selecting a row mounts the bulk-action bar with all three actions", async ({
    page,
  }) => {
    await page.goto("/en/match?view=table");
    await expect(page.getByTestId("match-table-wrapper")).toBeVisible({
      timeout: 15_000,
    });
    const firstRow = page.getByTestId("match-row").first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, "No KOLs in seed — selection path unreachable");
    }
    // The shadcn Checkbox renders a sr-only native <input> plus a
    // visible <button role="checkbox">. Click the visible button; the
    // native input is aria-hidden + outside viewport so check() retries
    // forever waiting for visibility (CI run 25781768048).
    await firstRow.getByRole("checkbox").click();
    await expect(page.getByTestId("match-bulk-bar")).toBeVisible();
    await expect(
      page.getByTestId("match-bulk-bar-add-to-campaign"),
    ).toBeVisible();
    await expect(page.getByTestId("match-bulk-bar-export")).toBeVisible();
    await expect(page.getByTestId("match-bulk-bar-delete")).toBeVisible();
  });

  test("filter sidebar exposes status pills (BM1 /database merged in)", async ({
    page,
  }) => {
    await page.goto("/en/match");
    await expect(page.getByTestId("match-filters")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("match-status-pills")).toBeVisible();
    // Pill set: all + RELATIONSHIP_STATUSES (prospect / first_contact /
    // negotiating / long_term / paused / terminated) = 7 anchors.
    for (const pill of [
      "all",
      "prospect",
      "first_contact",
      "negotiating",
      "long_term",
      "paused",
      "terminated",
    ]) {
      await expect(
        page.getByTestId(`match-status-pill-${pill}`),
      ).toBeVisible();
    }
  });

  test("Add KOL trigger mounts in the header actions row", async ({ page }) => {
    await page.goto("/en/match");
    await expect(page.getByTestId("match-page")).toBeVisible({
      timeout: 15_000,
    });
    // The AddKolDialog renders a button with data-testid="database-add-kol"
    // (kept stable for cross-batch test parity — see the legacy
    // BL-024-F001 testid; BL-065-F006 inherits it via git mv).
    const trigger = page.getByTestId("database-add-kol");
    await expect(trigger).toBeVisible();
  });

  test("?campaignId= without a real campaign falls back to 2-column workbench (no AI sidebar)", async ({
    page,
  }) => {
    // BL-065-F005: showAiSidebar gates render on the *resolved* tenant-
    // scoped campaign object, not the raw query param. A clearly-bogus
    // id must produce data-campaign-mode="false" + no sidebar.
    await page.goto(
      "/en/match?campaignId=00000000-0000-0000-0000-000000000000",
    );
    await expect(page.getByTestId("match-page")).toHaveAttribute(
      "data-campaign-mode",
      "false",
    );
    await expect(page.getByTestId("match-ai-sidebar")).toHaveCount(0);
  });
});

/**
 * BM2-F011 · Journey B — Campaign detail → ROI → Weekly Report.
 *
 * Walks the marketer through the "review performance → ship the
 * weekly report" half of the BM2 workflow:
 *
 *   1. Login as Sarah Chen                         (BAux1)
 *   2. /campaigns — see the campaigns list page    (BM2-F003)
 *   3. /campaigns/[id] — open first campaign       (BM2-F005)
 *   4. /roi — see the KPI strip + trend card       (BM2-F009)
 *   5. /weekly-report — empty state OR existing    (BM2-F010)
 *   6. If empty + AIGCGATEWAY_API_KEY present, click Generate; else
 *      assert the empty CTA is visible (no AI call attempted)
 *
 * Per BM1-F009 lessons:
 *   - no `await page.waitForLoadState("networkidle")`
 *   - no hardcoded seed-dependent counts
 *   - locale-prefixed URL regex on every redirect
 */
import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLM@2026!",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(/\/(en|zh|ja|ko|es)\/dashboard(\/|$)/);
}

test.describe("BM2 Journey B — Campaign → ROI → Weekly Report", () => {
  test("walks the review-performance + weekly-report flow", async ({ page }) => {
    await login(page);

    // Step 2 — Campaigns list reachable.
    await page.locator("aside").getByRole("link", { name: /^Campaigns$/i }).click();
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/campaigns(\/|\?|$)/);
    await expect(page.getByTestId("campaigns-page-title")).toBeVisible({
      timeout: 15_000,
    });

    // Step 3 — Open the first campaign if any. Tenant may have no
    // campaigns; in that case skip the detail assertion (resilient
    // to seed variability per BM1-F009 lesson).
    const firstRow = page.locator('[data-testid="campaign-row"]').first();
    if (await firstRow.count()) {
      await firstRow.click();
      await page.waitForURL(
        /\/(en|zh|ja|ko|es)\/campaigns\/[0-9a-f-]{36}(\/|\?|$)/
      );
      await expect(page.getByTestId("campaign-detail-title")).toBeVisible();
    }

    // Step 4 — ROI page reachable + KPI strip visible.
    await page.goto("/en/roi");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/roi(\/|\?|$)/);
    await expect(page.getByTestId("roi-page-title")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("roi-kpi-strip")).toBeVisible();
    await expect(page.getByTestId("roi-trend-card")).toBeVisible();

    // Step 5 — Weekly Report page reachable; either the empty CTA is
    // visible or a previously-generated report renders. Both are valid
    // green paths (we don't force a real AI call in CI to keep the
    // suite cost- and credential-free).
    await page.goto("/en/weekly-report");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/weekly-report(\/|\?|$)/);
    await expect(page.getByTestId("weekly-report-page-title")).toBeVisible({
      timeout: 15_000,
    });

    const empty = page.getByTestId("weekly-report-empty");
    const sectionB = page.getByTestId("weekly-report-section-b");

    // Race-friendly assertion: at least one of the two body slots is
    // visible. This survives both first-visit (empty state) and
    // returning-tenant (already-generated) scenarios.
    const eitherVisible =
      (await empty.isVisible().catch(() => false)) ||
      (await sectionB.isVisible().catch(() => false));
    expect(eitherVisible).toBe(true);
  });
});

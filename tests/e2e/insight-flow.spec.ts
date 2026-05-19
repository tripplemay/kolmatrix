/**
 * BL-070-F006 · /insight end-to-end smoke (~6 cases per spec acceptance).
 *
 * Locks the BL-070-F003 implementation:
 *   - /insight is a real route with 3 tabs (dashboard / reports / analytics)
 *   - dashboard tab embeds `<DashboardContent>` (F004 extracted from
 *     the retired /dashboard/page.tsx)
 *   - reports tab is a launch pad with a link to the migrated
 *     /insight/weekly-report sub-route
 *   - analytics tab is a Phase 5 placeholder
 *
 * Also covers BL-070-F004 二次清理: legacy /dashboard, /reports,
 * /analytics, /weekly-report URLs 404 outright (redirects retired per
 * decision §5). The canonical 17-path 404 sweep lives in
 * ia-refactor-cleanup-2026-05-19.spec.ts; this file smoke-checks the
 * /insight-specific subset so a regression that re-adds those rules
 * surfaces under the /insight suite too.
 *
 * 6 cases:
 *   1. /insight default tab (dashboard) renders KPI strip via embedded
 *      DashboardContent
 *   2. ?tab=reports → reports panel with weekly-report launch link
 *   3. ?tab=analytics → Phase 5 placeholder panel
 *   4. /insight/weekly-report subroute renders WeeklyReport page
 *   5. legacy /dashboard 404 (redirect retired in F004)
 *   6. legacy /weekly-report 404 (route was git mv'd to
 *      /insight/weekly-report in F003 + redirect deleted in F004)
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/marketer.json" });

test.describe("BL-070-F006 · /insight end-to-end smoke", () => {
  test("1. /insight default tab (dashboard) renders KPI strip via embedded DashboardContent", async ({
    page,
  }) => {
    await page.goto("/en/insight");
    await page.waitForURL(/\/en\/insight(\/|\?|$)/);
    await expect(page.getByTestId("insight-page")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("insight-page-title")).toBeVisible();
    await expect(page.getByTestId("insight-tabs")).toBeVisible();

    // Dashboard tab is default — embedded DashboardContent renders the
    // KPI row + workflow + top-kols testids inherited from BL-066.
    await expect(page.getByTestId("dashboard-kpi-row")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("dashboard-top-kols")).toBeVisible();
  });

  test("2. ?tab=reports renders the reports launch panel with weekly-report link", async ({
    page,
  }) => {
    await page.goto("/en/insight?tab=reports");
    await expect(page.getByTestId("insight-page")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("insight-reports-panel")).toBeVisible();
    const link = page.getByTestId("insight-reports-weekly-link");
    await expect(link).toBeVisible();
    // Link points at the migrated sub-route, NOT the legacy
    // /weekly-report URL (BL-070-F004 retired the legacy redirect).
    await expect(link).toHaveAttribute("href", /\/en\/insight\/weekly-report/);
  });

  test("3. ?tab=analytics renders the Phase 5 placeholder panel", async ({
    page,
  }) => {
    await page.goto("/en/insight?tab=analytics");
    await expect(page.getByTestId("insight-page")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("insight-analytics-panel")).toBeVisible();
    // Dashboard testid must NOT mount (analytics tab is its own
    // standalone panel — regression guard so a future refactor doesn't
    // accidentally fall through to the default tab).
    await expect(page.getByTestId("dashboard-kpi-row")).toHaveCount(0);
  });

  test("4. /insight/weekly-report subroute renders the WeeklyReport page", async ({
    page,
  }) => {
    await page.goto("/en/insight/weekly-report");
    await page.waitForURL(/\/en\/insight\/weekly-report(\/|\?|$)/);
    await expect(page.getByTestId("weekly-report-page")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("5. legacy /dashboard now 404 (BL-070-F004 redirect retired)", async ({
    page,
  }) => {
    const r = await page.context().request.get("/en/dashboard", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(r.status(), "expected 404 for legacy /en/dashboard").toBe(404);
  });

  test("6. legacy /weekly-report now 404 (route git mv'd + redirect retired)", async ({
    page,
  }) => {
    const r = await page.context().request.get("/en/weekly-report", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(r.status(), "expected 404 for legacy /en/weekly-report").toBe(404);
  });
});

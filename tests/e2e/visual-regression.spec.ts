/**
 * F009 — Dashboard visual regression.
 *
 * Captures the authenticated `/dashboard` view and diffs against the
 * committed baseline at `tests/screenshots/baseline/dashboard.png`
 * (path configured via `snapshotPathTemplate` in playwright.config.ts).
 *
 * Tolerances (per BI1 spec §F009):
 *   - threshold: 0.02   — 2% max normalised per-pixel channel diff
 *   - maxDiffPixels: 1000 — at most 1k differing pixels total
 *
 * The GreetingBar subtitle bakes in today's date via
 * `new Date().toLocaleDateString()`, so it WILL drift day-to-day.
 * We mask the subtitle region so the baseline only encodes layout
 * + colour, not the ticking clock. `emailsSent7d` and `avgAiScore`
 * are seeded deterministically enough that the 2%/1000px tolerance
 * absorbs normal noise; a real design change will still blow past it.
 *
 * Regenerate the baseline after intentional UI changes:
 *   npx playwright test tests/e2e/visual-regression.spec.ts \
 *     --update-snapshots
 */
import { expect, test } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLM@2026!",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByPlaceholder("marketer@kolmatrix.local").fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(/\/dashboard(\/|$)/);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.describe("Dashboard visual regression", () => {
  test("dashboard full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    await login(page);

    // Let charts + spark-lines finish their initial frame.
    await page.waitForLoadState("networkidle").catch(() => {});

    // The date subtitle ("Here is your global KOL marketing pulse for
    // April 19, 2026.") is intentionally dynamic — mask it so the
    // baseline stays stable across days.
    const dateSubtitle = page.getByText(/Here is your global KOL marketing pulse/);

    await expect(page).toHaveScreenshot("dashboard.png", {
      fullPage: true,
      animations: "disabled",
      mask: [dateSubtitle],
      threshold: 0.02,
      maxDiffPixels: 1000,
    });
  });
});

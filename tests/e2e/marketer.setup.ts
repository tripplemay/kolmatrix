/**
 * BL-060 fix-round 2 · Playwright auth setup project.
 *
 * Logs in the marketer once and saves the resulting cookies +
 * localStorage to `playwright/.auth/marketer.json`. The chromium
 * project depends on this setup so any spec that opts in via
 * `test.use({ storageState })` skips its own login() and avoids
 * the cumulative login flake that tripped database-fidelity in
 * fix-round 1 (5/9 reverify — see docs/test-reports/
 * BL-060-reverifying-2026-05-09.md).
 *
 * The seeded marketer credentials (marketer@kolmatrix.local /
 * KOLMatrix@2026!) match `prisma/seed.ts` and `.auto-memory/
 * environment.md`. Same shape as marketer-dashboard.spec.ts /
 * login-cinematic.spec.ts.
 */
import { test as setup, expect } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLMatrix@2026!",
};

const AUTH_FILE = "playwright/.auth/marketer.json";

setup("authenticate marketer", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();

  // Match the laxer pattern marketer-dashboard.spec.ts and
  // login-cinematic.spec.ts already use — accepts both
  // `/dashboard` (Auth.js raw redirect) and `/<locale>/dashboard`
  // (next-intl middleware rewrite).
  await page.waitForURL(/\/dashboard(\/|$)/);

  // Wait for the KPI row to actually mount before persisting state.
  // Otherwise we could race ahead and save cookies for a session
  // whose dashboard hadn't fully hydrated, which breaks downstream
  // specs that expect the page to be ready on next-page navigation.
  await expect(page.getByTestId("dashboard-kpi-row")).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});

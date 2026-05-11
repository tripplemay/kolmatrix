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

  // BL-064-F002+F005 — middleware now 302-redirects /dashboard →
  // /insight, so the final URL after Auth.js redirect+i18n rewrite is
  // `/<locale>/insight`. Accept both forms during the Phase 1 transition
  // so the storageState capture is resilient to either redirect chain.
  await page.waitForURL(/\/(dashboard|insight)(\/|$)/);

  // Wait for the KPI row to actually mount before persisting state.
  // Otherwise we could race ahead and save cookies for a session
  // whose dashboard hadn't fully hydrated, which breaks downstream
  // specs that expect the page to be ready on next-page navigation.
  await expect(page.getByTestId("dashboard-kpi-row")).toBeVisible({
    timeout: 30_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});

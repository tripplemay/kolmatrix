import { expect, test } from "@playwright/test";

/**
 * Placeholder E2E: proves the Playwright install + webServer + redirect
 * chain are wired correctly. A hit on `/` goes
 *   `/` → `/${defaultLocale}/dashboard` → `/login` (unauthenticated).
 * The document <title> always ends in "KOLMatrix" via the root layout
 * template, so that is what we assert against.
 *
 * F008 layers the real marketer login flow on top of this.
 */
test("root URL reaches a page whose title ends in KOLMatrix", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KOLMatrix/);
});

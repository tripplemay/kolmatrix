/**
 * F008 — Marketer login + Dashboard flow.
 *
 * Pre-reqs (dev environment):
 *   - `docker compose up -d` for Postgres + Redis
 *   - `npx prisma migrate deploy` + `npm run db:seed` (creates
 *      marketer@kolmatrix.local with password KOLMatrix@2026!, Sarah Chen,
 *      12 KOLs, 3 campaigns).
 *
 * Note on KPI count: the BI1 spec §F008 references "12,847 total KOLs"
 * which is the Stitch design-mock number, not the seeded DB value. The
 * dashboard reads real row counts via Prisma, so we assert presence of
 * the "Total KOLs" label + a visible count (12 after seed), and
 * surface the spec mismatch via a comment instead of a literal check.
 */
import { expect, test } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLMatrix@2026!",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  // Address fields by `name` attribute — stable across placeholder
  // copy changes (BAux1-F002 replaced the old "marketer@kolmatrix.local"
  // placeholder with a generic "name@studio.com" per the cinematic copy).
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // BL-064-F002 — middleware now 302-redirects /dashboard → /insight,
  // so the final landing URL is /<locale>/insight. Accept both during
  // the Phase 1 transition.
  await page.waitForURL(/\/(dashboard|insight)(\/|$)/);
  // BM1-F009: do NOT call waitForLoadState("networkidle") here — on the
  // staging build it never resolves (even with pending=0 for 30s) while
  // all downstream locators auto-wait for visibility anyway. Previously
  // this ate the default 30s test timeout and masked real flake as a
  // "sidebar click timeout".
}

test.describe("Marketer — login + dashboard flow", () => {
  test("logs in via /login with seed credentials and lands on the canonical post-login route", async ({ page }) => {
    await login(page);
    // BM1-F009 regression: URL must be locale-prefixed. BL-064-F002
    // adds the /dashboard → /insight 302; either tail is acceptable
    // during transition.
    expect(page.url()).toMatch(/\/(en|zh|ja|ko|es)\/(dashboard|insight)(\/|$)/);
  });

  test("dashboard greets Sarah Chen and surfaces KPI cards", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /Welcome back, Sarah/ })).toBeVisible();
    await expect(page.getByText(/Total KOLs/i)).toBeVisible();
    // Proof the KPI card is wired to real DB rows: assert the tile
    // shows a non-zero integer. BM1-F007 filters the count to
    // isGaming=true, so the exact number depends on seed flavor (12
    // from db:seed, 415 when seed:kol has been run against the same
    // tenant). Pattern matches any comma-grouped positive integer.
    await expect(
      page.getByTestId("dashboard-kpi-row").getByText(/^[1-9][0-9,]*$/).first()
    ).toBeVisible();
  });

  test("switching locale EN → ZH updates new IA nav labels (Insight → 洞察)", async ({
    page,
  }) => {
    await login(page);
    // BL-064-F003 sidebar is now 4-item; "Insight" is the new IA label
    // that replaces "Dashboard" (the old top-level nav entry).
    await expect(
      page.locator("aside").getByRole("link", { name: "Insight" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Change language" }).click();
    await page.getByRole("menuitem", { name: "中文（简体）" }).click();

    await page.waitForURL(/\/zh\//);
    await expect(
      page.locator("aside").getByRole("link", { name: "洞察" })
    ).toBeVisible();
  });

  test("BL-064 — clicking 'Match' in the sidebar routes to /match (replaces legacy KOL Database)", async ({ page }) => {
    await login(page);
    await page.locator("aside").getByRole("link", { name: "Match" }).click();
    await page.waitForURL(/\/match(\/|\?|$)/);
    expect(page.url()).toMatch(/\/match(\/|\?|$)/);
  });
});

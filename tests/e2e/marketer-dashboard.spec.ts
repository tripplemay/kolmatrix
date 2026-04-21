/**
 * F008 — Marketer login + Dashboard flow.
 *
 * Pre-reqs (dev environment):
 *   - `docker compose up -d` for Postgres + Redis
 *   - `npx prisma migrate deploy` + `npm run db:seed` (creates
 *      marketer@kolmatrix.local with password KOLM@2026!, Sarah Chen,
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
  password: "KOLM@2026!",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  // Address fields by `name` attribute — stable across placeholder
  // copy changes (BAux1-F002 replaced the old "marketer@kolmatrix.local"
  // placeholder with a generic "name@studio.com" per the cinematic copy).
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // Accept both `/dashboard` (before next-intl locale rewrite) and
  // `/<locale>/dashboard` (after). Both prove the redirect worked.
  await page.waitForURL(/\/dashboard(\/|$)/);
  // Let the locale rewrite finish if it's happening (middleware chain).
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.describe("Marketer — login + dashboard flow", () => {
  test("logs in via /login with seed credentials and lands on /dashboard", async ({ page }) => {
    await login(page);
    expect(page.url()).toMatch(/\/dashboard(\/|$)/);
  });

  test("dashboard greets Sarah Chen and surfaces KPI cards", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /Welcome back, Sarah/ })).toBeVisible();
    await expect(page.getByText(/Total KOLs/i)).toBeVisible();
    // Proof the KPI card is wired to real DB rows — 12 KOLs live in the
    // seed, spec's "12,847" comes from the design mock and is skipped.
    await expect(page.locator("text=/^12$/").first()).toBeVisible();
  });

  test("switching locale EN → ZH updates nav labels from 'Dashboard' to '仪表盘'", async ({
    page,
  }) => {
    await login(page);
    // Sanity: English label present first.
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

    await page.getByRole("button", { name: "Change language" }).click();
    await page.getByRole("menuitem", { name: "中文（简体）" }).click();

    await page.waitForURL(/\/zh\//);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
  });

  test("clicking 'KOL Database' in the sidebar routes to /kols", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "KOL Database" }).click();
    // B0 hasn't shipped /kols yet; we only assert the router navigated.
    await page.waitForURL(/\/kols(\/|$)/);
    expect(page.url()).toMatch(/\/kols(\/|$)/);
  });
});

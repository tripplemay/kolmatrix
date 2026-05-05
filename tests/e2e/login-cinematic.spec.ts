/**
 * BAux1-F004 · /login cinematic + credentials flow E2E
 *
 * Complements tests/e2e/marketer-dashboard.spec.ts — that file still
 * owns the full post-login dashboard verification; this file focuses on
 * the login page's own contract:
 *   1. /en/login renders the 58/42 cinematic shell (world-map hero + form)
 *   2. Sarah Chen credentials still reach /dashboard after BAux1-F002
 *   3. /zh/login surfaces Chinese copy (welcomeBack key)
 *   4. Google button is disabled with the Coming soon tooltip
 *
 * Seed credentials are provided by prisma/seed.ts (B0 seed), matching
 * the marketer record used elsewhere in the E2E suite.
 */
import { expect, test } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLMatrix@2026!",
};

test.describe("Login — cinematic layout + credentials flow", () => {
  test("/en/login renders the hero image + the sign-in form", async ({ page }) => {
    await page.goto("/en/login");
    // Landmark heading lives in the form column.
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    // Hero <img> lives in the left column; Next's <Image> renders a
    // real <img> tag with the provided src path substring.
    await expect(page.locator('img[src*="login-hero"]').first()).toBeAttached();
    // Email + password inputs exist and are targetable by name.
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("Google button is disabled + title='Coming soon'", async ({ page }) => {
    await page.goto("/en/login");
    const google = page.getByRole("button", { name: /Continue with Google/i });
    await expect(google).toBeVisible();
    await expect(google).toBeDisabled();
    await expect(google).toHaveAttribute("title", "Coming soon");
    await expect(google).toHaveAttribute("aria-disabled", "true");
  });

  test("logs in via /en/login with seed marketer credentials and lands on /dashboard", async ({
    page,
  }) => {
    await page.goto("/en/login");
    await page.locator('input[name="email"]').fill(MARKETER.email);
    await page.locator('input[name="password"]').fill(MARKETER.password);
    await page.getByRole("button", { name: /^Sign in$/ }).click();
    await page.waitForURL(/\/dashboard(\/|$)/);
    expect(page.url()).toMatch(/\/dashboard(\/|$)/);
  });

  test("/zh/login surfaces the Chinese welcome copy", async ({ page }) => {
    await page.goto("/zh/login");
    // zh.json maps auth.login.welcomeBack → "欢迎回来"
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible();
    // And the Google disabled button keeps its 中文 tooltip.
    const google = page.getByRole("button", { name: /Google/i });
    await expect(google).toBeDisabled();
  });

  test("footer Request access link points at /request-access", async ({ page }) => {
    await page.goto("/en/login");
    const link = page.getByRole("link", { name: "Request access" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/request-access$/);
  });

  // Regression for BAux1 reverifying (2026-04-21): with NEXTAUTH_URL set
  // in .env, next-auth's reqWithEnvURL() used to rewrite the request
  // origin, so /login redirected to http://localhost:3000/en/login even
  // when the dev server ran on :3099. Fix removes NEXTAUTH_URL from
  // .env.example so trustHost sees the real Host header.
  test("bare /login redirects to /{defaultLocale}/login on the SAME origin", async ({
    page,
    baseURL,
  }) => {
    expect(baseURL).toBeTruthy();
    const origin = new URL(baseURL!).origin;

    const response = await page.goto("/login");
    expect(response).not.toBeNull();

    // Landed URL must share origin with the caller — previously the
    // regression produced http://localhost:3000/en/login regardless of
    // where the E2E server ran.
    expect(page.url().startsWith(`${origin}/`)).toBe(true);
    expect(page.url()).toMatch(/\/en\/login$/);
  });
});

import { expect, test } from "@playwright/test";

/**
 * BM1-F008 · Browser locale auto-detection E2E.
 *
 * Hitting `/` without an authenticated session should land on
 * `/{locale}/` (marketing landing page, per the landing-batch
 * resolveAuthAwareRoot helper in src/middleware-helpers.ts) where
 * `{locale}` honors:
 *   1. NEXT_LOCALE cookie if set to a supported locale
 *   2. Accept-Language header, limited to the en/zh auto-detection
 *      allowlist (ja/ko/es fall through to en until translated)
 *
 * History: this suite predates the landing batch and originally
 * asserted on `/{locale}/login` because anonymous root hit the auth
 * gate directly. Once `resolveAuthAwareRoot` started sending
 * anonymous traffic to the landing page (`/{locale}/`), the
 * `/login` suffix stopped applying. The locale-detection contract
 * itself is unchanged — only the post-detection destination moved.
 *
 * We use a per-test browser context instead of the default so we can
 * set `locale` on the context — Playwright forwards that as the
 * Accept-Language header on every request.
 */
test.describe("Locale detection from / (BM1-F008)", () => {
  test("zh-CN browser lands on /zh (landing)", async ({ browser }) => {
    const context = await browser.newContext({ locale: "zh-CN" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/zh\/?$/);
    await context.close();
  });

  test("en-US browser lands on /en (landing)", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/?$/);
    await context.close();
  });

  test("ja-JP browser falls back to /en (landing)", async ({ browser }) => {
    // ja is declared in routing.locales so the sidebar language
    // switcher + direct URLs still work, but automatic detection
    // funnels unseeded users to /en until we ship professional jp
    // translations.
    const context = await browser.newContext({ locale: "ja-JP" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/?$/);
    await context.close();
  });

  test("NEXT_LOCALE cookie overrides Accept-Language", async ({ browser }) => {
    // Browser says en, cookie says ja — cookie wins because it
    // represents an explicit user choice from the topbar.
    const context = await browser.newContext({ locale: "en-US" });
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: "ja",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ja\/?$/);
    await context.close();
  });

  test("invalid cookie value is ignored; falls back to Accept-Language", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "zh-CN" });
    await context.addCookies([
      {
        name: "NEXT_LOCALE",
        value: "xx", // unknown locale
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/zh\/?$/);
    await context.close();
  });
});

import { expect, test } from "@playwright/test";

/**
 * 2026-05-19 landing page · Anonymous root path renders the
 * marketing landing page; authenticated users get redirected to
 * /insight. The full content lives in
 * src/app/[locale]/(marketing)/_components/LandingPage.tsx.
 */
test.describe("Anonymous root path", () => {
  test("/ resolves to /<locale>/ and shows the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(zh|en)\/?$/);
    await expect(page.getByTestId("landing-hero")).toBeVisible();
  });

  test("/zh shows the landing page in Chinese", async ({ page }) => {
    await page.goto("/zh");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
    await expect(page).toHaveTitle(/KolMatrix|KOLMatrix/);
  });

  test("/en shows the landing page in English", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
  });

  // BL-114-F001 — hero illustration removed; Hero is now pure CSS mesh
  // background (text-driven minimal, jina.ai style). Verify CSS-only hero.
  test("hero section renders with text content and no illustration image", async ({ page }) => {
    await page.goto("/zh");
    const hero = page.getByTestId("landing-hero");
    await expect(hero).toBeVisible();
    // No illustration img inside the hero (image removed in BL-114-F001).
    await expect(hero.locator('[data-testid="landing-hero-illustration"]')).toHaveCount(0);
    // CTAs are present.
    await expect(page.getByTestId("landing-cta-primary")).toBeVisible();
    await expect(page.getByTestId("landing-cta-secondary")).toBeVisible();
  });
});

test.describe("Landing CTAs", () => {
  test("Hero primary CTA goes to /request-access", async ({ page }) => {
    await page.goto("/zh");
    await page.getByTestId("landing-cta-primary").click();
    await expect(page).toHaveURL(/\/zh\/request-access$/);
  });

  test("Hero secondary CTA goes to /request-access?demo=1 with wantsDemo pre-checked", async ({ page }) => {
    await page.goto("/zh");
    await page.getByTestId("landing-cta-secondary").click();
    await expect(page).toHaveURL(/\/zh\/request-access\?demo=1$/);
    await expect(page.getByTestId("request-access-wants-demo")).toBeChecked();
  });
});

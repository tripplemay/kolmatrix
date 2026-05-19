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

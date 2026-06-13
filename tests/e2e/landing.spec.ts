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

  // BL-114-F001 (redo) — Hero dashboard preview. BL-115-F001 — primary CTA is
  // the in-page trial modal trigger; secondary is the external PRD link.
  test("hero section renders text content + dashboard preview + CTAs", async ({ page }) => {
    await page.goto("/zh");
    const hero = page.getByTestId("landing-hero");
    await expect(hero).toBeVisible();
    await expect(hero.getByTestId("landing-hero-illustration")).toBeVisible();
    await expect(page.getByTestId("trial-cta-hero")).toBeVisible();
    await expect(page.getByTestId("landing-cta-prd")).toBeVisible();
  });
});

test.describe("Landing CTAs (BL-115-F001 conversion)", () => {
  test("Hero primary CTA opens the in-page trial modal", async ({ page }) => {
    await page.goto("/zh");
    await page.getByTestId("trial-cta-hero").click();
    await expect(page.getByTestId("trial-lead-modal")).toBeVisible();
    await expect(page.getByTestId("trial-field-email")).toBeVisible();
  });

  test("trial modal submits the 3-field lead form", async ({ page }) => {
    await page.goto("/zh?utm_source=playwright&utm_campaign=e2e");
    await page.getByTestId("trial-cta-hero").click();
    await page.getByTestId("trial-field-name").fill("E2E Tester");
    await page.getByTestId("trial-field-email").fill("e2e@studio.example");
    await page.getByTestId("trial-field-studio").fill("Example Game Studio");
    await page.getByTestId("trial-submit").click();
    await expect(page.getByTestId("trial-lead-success")).toBeVisible();
  });

  test("Hero secondary CTA links to the PRD doc", async ({ page }) => {
    await page.goto("/zh");
    const prd = page.getByTestId("landing-cta-prd");
    await expect(prd).toHaveAttribute("href", /saga1001\.com\/prd/);
  });
});

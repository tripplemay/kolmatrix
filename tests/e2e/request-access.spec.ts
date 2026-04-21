/**
 * BAux1-F004 · /request-access intake flow E2E
 *
 * Exercises the anonymous access-request path through the dev server:
 *   1. /en/request-access renders the war-room hero + 8-field long form
 *   2. Submitting a valid application redirects to /success confirmation
 *   3. Submitting without ToS keeps the user on the form (tos_required
 *      error surfaces in the alert region)
 *   4. The sign-in anchor points at /{locale}/login
 *
 * DB write verification and Resend mocking live in the integration
 * suite (tests/integration/access-request-flow.test.ts) — E2E here
 * proves only the user-facing flow against the dev server (RESEND_API_KEY
 * is not set in CI's dev env, so the Server Action's email helper
 * fails-soft and the DB write still happens).
 */
import { expect, test } from "@playwright/test";

const UNIQUE = () => `sarah+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@studio.test`;

test.describe("Request access — intake flow", () => {
  test("/en/request-access renders the 58/42 war-room shell + all 8 fields", async ({
    page,
  }) => {
    await page.goto("/en/request-access");
    await expect(
      page.getByRole("heading", { name: "Request workspace access" })
    ).toBeVisible();
    await expect(page.locator('img[src*="signup-hero"]').first()).toBeAttached();
    for (const name of [
      "firstName",
      "lastName",
      "email",
      "company",
      "role",
      "campaignsPerQuarter",
      "games",
      "tosAccepted",
    ]) {
      await expect(page.locator(`[name="${name}"]`)).toBeAttached();
    }
  });

  test("submitting a complete valid form lands on the success page", async ({ page }) => {
    await page.goto("/en/request-access");
    await page.locator('input[name="firstName"]').fill("Sarah");
    await page.locator('input[name="lastName"]').fill("Chen");
    await page.locator('input[name="email"]').fill(UNIQUE());
    await page.locator('input[name="company"]').fill("Neon Launch Studio");
    await page.locator('select[name="role"]').selectOption("marketing-manager");
    await page.locator('select[name="campaignsPerQuarter"]').selectOption("6-20");
    await page.locator('textarea[name="games"]').fill("Astra: Midnight Gauntlet");
    await page.locator('input[name="tosAccepted"]').check();

    await page.getByRole("button", { name: /Submit request/i }).click();
    await page.waitForURL(/\/request-access\/success/);
    await expect(
      page.getByText(/We'll get back to you within 1 business day/i)
    ).toBeVisible();
  });

  test("submitting without ToS stays on the form with the tos_required alert", async ({
    page,
  }) => {
    await page.goto("/en/request-access");
    await page.locator('input[name="firstName"]').fill("Sarah");
    await page.locator('input[name="lastName"]').fill("Chen");
    await page.locator('input[name="email"]').fill(UNIQUE());
    await page.locator('input[name="company"]').fill("Neon Launch Studio");
    await page.locator('select[name="role"]').selectOption("founder");
    await page.locator('select[name="campaignsPerQuarter"]').selectOption("0-5");
    // Intentionally skip tosAccepted.check()

    await page.getByRole("button", { name: /Submit request/i }).click();
    // We never leave /request-access — alert shows up.
    await expect(page).toHaveURL(/\/request-access$/);
    await expect(page.getByRole("alert")).toHaveText(
      /accept the Terms of Service/i
    );
  });

  test("sign-in anchor points at the same-locale /login", async ({ page }) => {
    await page.goto("/en/request-access");
    const link = page.getByRole("link", { name: "Sign in" });
    await expect(link).toHaveAttribute("href", "/en/login");
  });
});

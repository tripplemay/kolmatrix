/**
 * BM2-F011 · Journey A — Discovery → Campaign → Outreach.
 *
 * Walks the marketer through the "find a creator → run a campaign →
 * reach out" half of the BM2 workflow:
 *
 *   1. Login as Sarah Chen                         (BAux1)
 *   2. /discovery — see at least one KOL card      (BM1-F004)
 *   3. /campaigns — see the campaigns list page    (BM2-F003)
 *   4. /campaigns/new — see the new-campaign form  (BM2-F004)
 *   5. /outreach — see the composer + tabs         (BM2-F006)
 *   6. Optional: open the AI customize dialog if a
 *      campaign + KOL row is available             (BM2-F006)
 *
 * Per BM1-F009 lessons:
 *   - no `await page.waitForLoadState("networkidle")`
 *   - no hardcoded seed-dependent counts
 *   - all redirect / Link assertions use locale-prefixed regex
 *   - revalidate-after-action waits via explicit selector polling
 */
import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLM@2026!",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(/\/(en|zh|ja|ko|es)\/dashboard(\/|$)/);
}

test.describe("BM2 Journey A — Discovery → Campaigns → Outreach", () => {
  test("walks the find-creator + reach-out flow", async ({ page }) => {
    await login(page);

    // Step 2 — Discovery has at least one card visible.
    await page.locator("aside").getByRole("link", { name: /KOL Discovery/i }).click();
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/discovery(\/|\?|$)/);
    const cards = page.locator('[data-testid="kol-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });

    // Step 3 — Campaigns list reachable + page title visible.
    await page.locator("aside").getByRole("link", { name: /^Campaigns$/i }).click();
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/campaigns(\/|\?|$)/);
    await expect(page.getByTestId("campaigns-page-title")).toBeVisible();

    // Step 4 — New-campaign form reachable.
    await page.goto("/en/campaigns/new");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/campaigns\/new(\/|\?|$)/);
    await expect(
      page.locator('input[name="name"], input[id*="name" i]').first()
    ).toBeVisible({ timeout: 15_000 });

    // Step 5 — Outreach page reachable + tabs visible.
    await page.goto("/en/outreach");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/outreach(\/|\?|$)/);
    await expect(page.getByTestId("outreach-page")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("outreach-tabs")).toBeVisible();

    // Step 6 — If the composer renders a campaign + KOL row, surface
    // the AI-customize trigger so the journey crosses that surface.
    // The tenant may have no campaigns yet — in that case the trigger
    // is absent and we skip the assertion (smoke-level, per spec
    // §F011 acceptance).
    const composer = page.getByTestId("outreach-composer");
    if (await composer.isVisible().catch(() => false)) {
      const aiTrigger = page.getByTestId("outreach-ai-customize-trigger").first();
      if (await aiTrigger.count()) {
        await expect(aiTrigger).toBeVisible();
      }
    }
  });
});

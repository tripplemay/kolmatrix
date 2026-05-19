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
  password: "KOLMatrix@2026!",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  // BL-064-F002 — /dashboard 302→/insight
  await page.waitForURL(/\/(en|zh|ja|ko|es)\/(dashboard|insight)(\/|$)/);
}

test.describe("BM2 Journey A — Discovery → Campaigns → Outreach", () => {
  test("walks the find-creator + reach-out flow", async ({ page }) => {
    await login(page);

    // Step 2 — Match shows at least one KOL card. BL-065-F006 deleted
    // the legacy /discovery, so the navigation lands directly on
    // /en/match and the card uses the match-kol-card testid.
    await page.locator("aside").getByRole("link", { name: /^Match$/ }).click();
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/match(\/|\?|$)/);
    const cards = page.locator('[data-testid="match-kol-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });

    // Step 3 — Campaigns list reachable + page title visible.
    // BL-064-F003 sidebar removed the "Campaigns" entry; reach the list
    // via direct nav (the page itself still renders, just no top-level
    // nav link). /campaigns 302→/match?view=campaigns under F002.
    await page.goto("/en/campaigns");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/(campaigns|match)(\/|\?|$)/);
    await expect(page.getByTestId("campaigns-page-title")).toBeVisible();

    // Step 4 — Campaign creation surface reachable.
    // BL-070-F004 retired /campaigns/new entirely (the AI-driven /brief
    // is now the canonical creation surface — decision §5 closed the
    // redirect window). Navigate to /brief directly + assert the form
    // mounts.
    await page.goto("/en/brief");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/brief(\/|\?|$)/);
    await expect(
      page.locator('input[name="name"], input[id*="name" i]').first()
    ).toBeVisible({ timeout: 15_000 });

    // Step 5 — Reach page reachable + tabs visible.
    // BL-070-F004 retired /outreach (F001 git mv'd the route to /reach;
    // F004 deleted the redirect rule). Navigate to /reach directly.
    await page.goto("/en/reach");
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/reach(\/|\?|$)/);
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

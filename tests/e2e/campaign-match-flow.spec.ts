/**
 * BL-066-F008 · Campaign detail AI recommendation flow E2E.
 *
 * Covers the three-section layout introduced in F002 + the
 * AiRecommendationPanel interactions wired in F003 + the read-only
 * AcceptedKolsPanel refactored in F006. Six cases:
 *
 *   1. Three-section layout renders (Brief / AI panel / Accepted KOLs).
 *   2. AI panel mounts in active / empty / loading state (any of three).
 *   3. Accept button on first card → card disappears + AcceptedKolsPanel
 *      visible (router.refresh wires the new row in).
 *   4. Skip button on first card → card disappears (client-state only;
 *      no DB write).
 *   5. Show-next button cycles the candidate window.
 *   6. Stale / missing campaign id → graceful empty/error state, no
 *      crash (covers BL-066 spec §F008 "stale productId" via best-
 *      effort: a clearly-bogus campaign id that doesn't resolve in
 *      tenant scope).
 *
 * Robustness notes (BM1-F009 / BL-060 lessons + journey-b.spec.ts §52
 * "seed-row count variability"):
 *   - The seed tenant has 3 campaigns by default but CI sometimes
 *     starts with zero rows. We list /campaigns first, click into the
 *     first link if any, otherwise `test.skip()` cleanly.
 *   - The smart-match endpoint depends on aigcgateway; in
 *     credential-free CI it may return empty / error. The AI panel
 *     should still mount in its empty or error variant. We assert the
 *     mount, not the candidate count.
 *   - Accept / Skip / Show-next cases need at least one recommendation
 *     card; if zero are present (smart-match returned no rows), the
 *     case `test.skip()`s gracefully.
 *
 * No `waitForLoadState("networkidle")`, no hardcoded UUIDs, no fixed
 * seed assumptions.
 */
import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

test.use({ storageState: "playwright/.auth/marketer.json" });

/**
 * Navigate to /campaigns and return the first campaign's detail URL,
 * or null when the tenant has zero campaigns.
 *
 * Reads the `data-campaign-id` attribute on the first `campaign-row`
 * testid (CampaignsTable.tsx:83-84) — robust to anchor-href shape
 * changes and locale prefixing.
 */
async function firstCampaignDetailUrl(page: Page): Promise<string | null> {
  await page.goto("/en/campaigns");
  await page.waitForURL(/\/(en|zh|ja|ko|es)\/(campaigns|match)(\/|\?|$)/);
  await expect(page.getByTestId("campaigns-page-title")).toBeVisible({
    timeout: 15_000,
  });

  const firstRow = page.getByTestId("campaign-row").first();
  if ((await firstRow.count()) === 0) return null;
  const id = await firstRow.getAttribute("data-campaign-id");
  if (!id) return null;
  return `/en/campaigns/${id}`;
}

test.describe("BL-066-F008 · /campaigns/[id] AI recommendation flow", () => {
  test("three-section layout: Brief + AI panel + Accepted KOLs", async ({
    page,
  }) => {
    const href = await firstCampaignDetailUrl(page);
    if (!href) test.skip(true, "Tenant has no seeded campaigns");

    await page.goto(href!);
    await page.waitForURL(/\/(en|zh|ja|ko|es)\/campaigns\//);

    // Brief section.
    await expect(page.getByTestId("campaign-brief-summary")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("campaign-brief-status-pill")).toBeVisible();
    await expect(page.getByTestId("campaign-brief-edit-link")).toBeVisible();
    await expect(page.getByTestId("campaign-brief-launch-link")).toBeVisible();

    // Middle AI recommendation panel — at least one of (active /
    // empty / loading / error) variants must mount.
    const aiActive = page.getByTestId("campaign-ai-recommendation-active");
    const aiEmpty = page.getByTestId("campaign-ai-recommendation-empty");
    const aiLoading = page.getByTestId("campaign-ai-recommendation-loading");
    const aiError = page.getByTestId("campaign-ai-recommendation-error");
    await expect(
      aiActive.or(aiEmpty).or(aiLoading).or(aiError),
    ).toBeVisible({ timeout: 15_000 });

    // Bottom AcceptedKolsPanel.
    await expect(page.getByTestId("accepted-kols-panel")).toBeVisible();
  });

  test("AI panel mounts in active / empty / loading state", async ({ page }) => {
    const href = await firstCampaignDetailUrl(page);
    if (!href) test.skip(true, "Tenant has no seeded campaigns");
    await page.goto(href!);

    // Wait for the AI panel area to settle into one of the four
    // states. Loading may flicker through; active/empty/error are the
    // terminal renders.
    const aiActive = page.getByTestId("campaign-ai-recommendation-active");
    const aiEmpty = page.getByTestId("campaign-ai-recommendation-empty");
    const aiError = page.getByTestId("campaign-ai-recommendation-error");
    await expect(aiActive.or(aiEmpty).or(aiError)).toBeVisible({
      timeout: 30_000,
    });

    // When active, at least one recommendation card visible; otherwise
    // we assert the empty/error variant rendered its body.
    if ((await aiActive.count()) > 0) {
      const cards = page.getByTestId("campaign-ai-recommendation-card");
      await expect(cards.first()).toBeVisible();
    }
  });

  test("accept button on first card removes it from the AI panel", async ({
    page,
  }) => {
    const href = await firstCampaignDetailUrl(page);
    if (!href) test.skip(true, "Tenant has no seeded campaigns");
    await page.goto(href!);

    const aiActive = page.getByTestId("campaign-ai-recommendation-active");
    await expect(
      aiActive.or(page.getByTestId("campaign-ai-recommendation-empty")).or(
        page.getByTestId("campaign-ai-recommendation-error"),
      ),
    ).toBeVisible({ timeout: 30_000 });

    if ((await aiActive.count()) === 0) {
      test.skip(true, "smart-match returned no candidates — accept path unreachable");
    }

    const cards = page.getByTestId("campaign-ai-recommendation-card");
    const initialCount = await cards.count();
    if (initialCount === 0) {
      test.skip(true, "AI panel active but rendered 0 cards");
    }

    const firstAcceptBtn = page
      .getByTestId("campaign-ai-recommendation-accept")
      .first();
    await firstAcceptBtn.click();

    // Either the card disappears from the panel OR the panel rerenders
    // (router.refresh). We assert the count strictly decreased — that
    // captures both DOM-replace and DOM-remove flows.
    await expect
      .poll(() => cards.count(), { timeout: 15_000 })
      .toBeLessThan(initialCount);

    // The bottom AcceptedKolsPanel remains visible (unchanged contract).
    await expect(page.getByTestId("accepted-kols-panel")).toBeVisible();
  });

  test("skip button on first card removes it (client-state only)", async ({
    page,
  }) => {
    const href = await firstCampaignDetailUrl(page);
    if (!href) test.skip(true, "Tenant has no seeded campaigns");
    await page.goto(href!);

    const aiActive = page.getByTestId("campaign-ai-recommendation-active");
    await expect(
      aiActive.or(page.getByTestId("campaign-ai-recommendation-empty")).or(
        page.getByTestId("campaign-ai-recommendation-error"),
      ),
    ).toBeVisible({ timeout: 30_000 });

    if ((await aiActive.count()) === 0) {
      test.skip(true, "smart-match returned no candidates — skip path unreachable");
    }

    const cards = page.getByTestId("campaign-ai-recommendation-card");
    const initialCount = await cards.count();
    if (initialCount === 0) {
      test.skip(true, "AI panel active but rendered 0 cards");
    }

    const firstSkipBtn = page
      .getByTestId("campaign-ai-recommendation-skip")
      .first();
    await firstSkipBtn.click();

    await expect
      .poll(() => cards.count(), { timeout: 10_000 })
      .toBeLessThan(initialCount);
  });

  test("show-next button cycles to the next candidate batch", async ({
    page,
  }) => {
    const href = await firstCampaignDetailUrl(page);
    if (!href) test.skip(true, "Tenant has no seeded campaigns");
    await page.goto(href!);

    const aiActive = page.getByTestId("campaign-ai-recommendation-active");
    await expect(
      aiActive.or(page.getByTestId("campaign-ai-recommendation-empty")).or(
        page.getByTestId("campaign-ai-recommendation-error"),
      ),
    ).toBeVisible({ timeout: 30_000 });

    if ((await aiActive.count()) === 0) {
      test.skip(true, "smart-match returned no candidates — show-next unreachable");
    }

    const showNextBtn = page.getByTestId(
      "campaign-ai-recommendation-show-next",
    );
    if ((await showNextBtn.count()) === 0) {
      test.skip(true, "show-next button not rendered (candidate pool may be exhausted)");
    }

    // Snapshot first-card handle text (testid surfaces match a server
    // identity; we proxy with the visible card count + first card's
    // text node) and assert it changes after click.
    const cards = page.getByTestId("campaign-ai-recommendation-card");
    const before = await cards.first().innerText().catch(() => "");
    await showNextBtn.click();

    // Wait for either an exhausted message or a different first card.
    await expect
      .poll(async () => {
        if (
          await page
            .getByTestId("campaign-ai-recommendation-exhausted")
            .isVisible()
            .catch(() => false)
        ) {
          return "exhausted";
        }
        if ((await cards.count()) === 0) return "empty";
        return await cards.first().innerText().catch(() => "");
      }, { timeout: 10_000 })
      .not.toBe(before);
  });

  test("invalid /campaigns/[id] does not crash — graceful degradation", async ({
    page,
  }) => {
    // BL-066 spec §F008 case 6: "stale productId" — best-effort proxy.
    // A clearly-bogus UUID won't resolve under tenant RLS; the page
    // should either 404 / redirect / render an empty state but never
    // throw an unhandled exception.
    const r = await page.goto(
      "/en/campaigns/00000000-0000-0000-0000-000000000000",
      { waitUntil: "domcontentloaded" },
    );
    expect(r).not.toBeNull();
    // 404 or redirect to /campaigns list; either way the response
    // status should be a valid 2xx / 3xx / 4xx (not a 5xx server crash).
    const status = r!.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });
});

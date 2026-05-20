/**
 * 2026-05-19 landing page · One-off Playwright screenshot script.
 *
 * Logs into a target environment using the seeded admin account,
 * then writes 6 module full-page screenshots + 3 locator-scoped
 * component crops into public/landing/screenshots/.
 *
 * Run manually:
 *   STAGING_URL=https://staging.kol.guangai.ai \
 *   STAGING_EMAIL=marketer@kolmatrix.local \
 *   STAGING_PASSWORD='KOLMatrix@2026!' \
 *   npm run landing:capture
 *
 * Defaults target staging with the seeded marketer account.
 */
import { mkdir } from "fs/promises";
import { resolve } from "path";

import { chromium, type Page } from "@playwright/test";

const TARGET_URL = process.env.STAGING_URL ?? "https://staging.kol.guangai.ai";
const EMAIL = process.env.STAGING_EMAIL ?? "marketer@kolmatrix.local";
const PASSWORD = process.env.STAGING_PASSWORD ?? "KOLMatrix@2026!";
const OUT_DIR = resolve(process.cwd(), "public/landing/screenshots");
const VIEWPORT = { width: 1440, height: 900 };

async function login(page: Page): Promise<void> {
  await page.goto(`${TARGET_URL}/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(zh|en)\/insight/, { timeout: 15000 });
}

async function capture(
  page: Page,
  pathname: string,
  outName: string,
  options: { locator?: string } = {}
): Promise<void> {
  await page.goto(`${TARGET_URL}${pathname}`);
  await page.waitForLoadState("networkidle");
  const out = resolve(OUT_DIR, outName);
  if (options.locator) {
    await page.locator(options.locator).screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: false });
  }
  console.log(`✔ ${outName}`);
}

async function discoverFirstCampaignId(page: Page): Promise<string | null> {
  // AiSuggestionsSidebar only mounts when /match carries ?campaignId=<uuid>.
  // Pull the first campaign link off the insight dashboard so the capture
  // works without hard-coding any tenant data.
  await page.goto(`${TARGET_URL}/zh/insight`);
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>(
      'a[href*="/campaigns/"]'
    );
    if (!link) return null;
    const match = link.getAttribute("href")?.match(
      /\/campaigns\/([0-9a-f-]{36})/i
    );
    return match?.[1] ?? null;
  });
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await login(page);

  const campaignId =
    process.env.MATCH_CAMPAIGN_ID ?? (await discoverFirstCampaignId(page));
  if (!campaignId) {
    console.warn(
      "⚠ no campaign found; skipping match-ai-sidebar.png (set MATCH_CAMPAIGN_ID to force)"
    );
  }

  await capture(page, "/zh/match", "match-full.png");
  if (campaignId) {
    await capture(
      page,
      `/zh/match?campaignId=${campaignId}`,
      "match-ai-sidebar.png",
      { locator: '[data-testid="match-ai-sidebar"]' }
    );
  }
  await capture(page, "/zh/reach", "reach-full.png");
  await capture(page, "/zh/reach", "reach-domain-health.png", {
    locator: '[data-testid="outreach-domain-health"]',
  });
  await capture(page, "/zh/insight", "insight-full.png");
  await capture(page, "/zh/crm", "crm-full.png");
  await capture(page, "/zh/roi", "roi-full.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

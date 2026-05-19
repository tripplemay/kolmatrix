/**
 * 2026-05-19 landing page · One-off Playwright screenshot script.
 *
 * Logs into a target environment using the seeded admin account,
 * then writes 6 module full-page screenshots + 3 locator-scoped
 * component crops into public/landing/screenshots/.
 *
 * Run manually:
 *   STAGING_URL=https://staging.kolmatrix.com \
 *   STAGING_EMAIL=admin@kolmatrix.local \
 *   STAGING_PASSWORD=Kolmatrix@2026 \
 *   npm run landing:capture
 *
 * Defaults work for local dev (`npm run dev`).
 */
import { mkdir } from "fs/promises";
import { resolve } from "path";

import { chromium, type Page } from "@playwright/test";

const TARGET_URL = process.env.STAGING_URL ?? "http://localhost:3000";
const EMAIL = process.env.STAGING_EMAIL ?? "admin@kolmatrix.local";
const PASSWORD = process.env.STAGING_PASSWORD ?? "Kolmatrix@2026";
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

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await login(page);

  await capture(page, "/zh/match", "match-full.png");
  await capture(page, "/zh/match", "match-ai-sidebar.png", {
    locator: '[data-testid="match-ai-sidebar"]',
  });
  await capture(page, "/zh/reach", "reach-full.png");
  await capture(page, "/zh/reach", "reach-domain-health.png", {
    locator: '[data-testid="outreach-domain-health"]',
  });
  await capture(page, "/zh/reach", "reach-recently-sent.png", {
    locator: '[data-testid="outreach-recently-sent"]',
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

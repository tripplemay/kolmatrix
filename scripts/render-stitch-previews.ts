/**
 * MVP-visual-fidelity-hotfix · F001 · BL-010 · render-stitch-previews
 *
 * Renders every design-draft/stitch-references/*.html into a
 * 1920×1200 PNG under design-draft/stitch-references/renders/.
 *
 * Why: the upstream Stitch tool only exports 512px thumbnails, which
 * are too small for pixel-level fidelity work (per
 * `framework/harness/ui-fidelity-guardrail.md` §1.1). Generators and
 * Reviewers need a high-resolution archive that lives in git so the
 * design reference doesn't drift if Stitch becomes unreachable.
 *
 * E2E resilience constraints (BM1 F009 + BM2 F011-001 lessons):
 * - Do NOT use `waitForLoadState('networkidle')` — Stitch HTML pulls
 *   Tailwind / Material Icons / Google Fonts from CDNs that hold
 *   long-lived keepalive connections; networkidle never fires.
 * - Wait on `domcontentloaded` then poll `document.images` complete.
 *
 * Idempotent: overwrites existing PNGs every run.
 *
 * Run: `npm run render:stitch-previews`
 */
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdir, readdir } from "fs/promises";
import { join, basename, resolve } from "path";

const REFERENCES_DIR = resolve(process.cwd(), "design-draft/stitch-references");
const OUT_DIR = join(REFERENCES_DIR, "renders");
const VIEWPORT = { width: 1920, height: 1200 } as const;

async function imagesReady(page: Page): Promise<{ total: number; loaded: number }> {
  await page
    .waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      null,
      { timeout: 30_000 }
    )
    .catch(() => undefined);
  return page.evaluate(() => {
    const imgs = Array.from(document.images);
    return {
      total: imgs.length,
      loaded: imgs.filter((img) => img.complete && img.naturalWidth > 0).length,
    };
  });
}

async function fontsReady(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
    })
    .catch(() => undefined);
}

async function renderOne(
  browser: Browser,
  htmlPath: string
): Promise<{ outPath: string; loaded: number; total: number }> {
  const name = basename(htmlPath, ".html");
  const outPath = join(OUT_DIR, `${name}-1920.png`);
  const page = await browser.newPage({ viewport: VIEWPORT });
  try {
    await page.goto(`file://${htmlPath}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const { total, loaded } = await imagesReady(page);
    await fontsReady(page);
    await page.screenshot({ path: outPath, fullPage: true, type: "png" });
    return { outPath, loaded, total };
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const entries = await readdir(REFERENCES_DIR, { withFileTypes: true });
  const htmls = entries
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => join(REFERENCES_DIR, e.name))
    .sort();

  if (htmls.length === 0) {
    console.error(`[render-stitch-previews] no HTML files found in ${REFERENCES_DIR}`);
    process.exit(1);
  }

  console.log(`[render-stitch-previews] rendering ${htmls.length} pages → ${OUT_DIR}`);
  const browser = await chromium.launch({ headless: true });
  const failures: Array<{ html: string; reason: string }> = [];
  try {
    for (const html of htmls) {
      const name = basename(html, ".html");
      try {
        const result = await renderOne(browser, html);
        const tag =
          result.loaded === result.total
            ? "✓"
            : `~ (${result.loaded}/${result.total} imgs loaded)`;
        console.log(`  ${tag} ${name} → ${basename(result.outPath)}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ html, reason });
        console.error(`  ✗ ${name} — ${reason}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(
      `\n[render-stitch-previews] ${failures.length}/${htmls.length} pages failed`
    );
    process.exit(1);
  }
  console.log(`\n[render-stitch-previews] done — ${htmls.length}/${htmls.length} pages rendered`);
}

main().catch((err) => {
  console.error("[render-stitch-previews] fatal:", err);
  process.exit(1);
});

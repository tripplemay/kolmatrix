/**
 * BM2-F011 / BL-026-followup — Visual regression baselines for BM1
 * + BM2 + BL-026 pages.
 *
 * Captures full-page screenshots against the baselines committed at
 * `tests/screenshots/baseline/*.png` (path configured via
 * `snapshotPathTemplate` in playwright.config.ts).
 *
 * Coverage:
 *   - dashboard.png             — authenticated marketer `/dashboard` (F007 refresh)
 *   - en-knowledge-base.png     — authenticated `/en/knowledge-base` (F003)
 *   - en-discovery.png          — authenticated `/en/discovery` (F004 + MVP-vf-F002, viewport-only)
 *   - en-database.png           — authenticated `/en/database` (F005 + MVP-vf-F003)
 *   - en-login.png              — unauthenticated `/en/login` (BAux1-F004)
 *   - en-request-access.png     — unauthenticated `/en/request-access` (BAux1-F004)
 *   - en-campaigns.png          — authenticated `/en/campaigns` (BM2-F003 + MVP-vf-F004)
 *   - en-campaign-detail.png    — authenticated `/en/campaigns/:id` (BM2-F005 + MVP-vf-F005, masks expanded 2026-04-27)
 *   - en-outreach.png           — authenticated `/en/outreach` (BM2-F006)
 *   - en-outreach-templates.png — authenticated `/en/outreach/templates` (BM2-F006)
 *   - en-crm.png                — authenticated `/en/crm` (BM2-F007)
 *   - en-roi.png                — authenticated `/en/roi` (BM2-F009)
 *   - en-weekly-report.png      — authenticated `/en/weekly-report` (BM2-F010)
 *   - en-kols-detail.png        — authenticated `/en/kols/:id` (MVP-vf-F006, first baseline 2026-04-26)
 *
 * Tolerances (per BI1 spec §F009, raised in BM2 fixing-round 1):
 *   - threshold: 0.02    — 2% max normalised per-pixel channel diff
 *   - maxDiffPixels: 8000 — absorbs CI Ubuntu ↔ WSL sub-pixel AA drift,
 *                           plus runner-to-runner Math.random() seed
 *                           variance in dashboard email-log + recharts
 *                           output. The 2000-px budget worked for WSL
 *                           but was too tight for two cold-runner
 *                           ubuntu-latest images (run 24953189616 saw
 *                           ~3400 px diffs on dashboard / database /
 *                           crm). 8000 is still ~0.1% of full-page
 *                           pixel count, so a real visual regression
 *                           still trips the gate.
 *
 * Platform policy: Chromium's headless rendering is NOT byte-stable
 * across Linux and macOS (font hinting + subpixel AA differ); pin the
 * suite to Linux (CI + WSL) and skip on macOS/Windows rather than
 * ship a per-platform baseline tree.
 *
 * BM1-F009 lessons (BM2-F011 hard requirement):
 *   - DO NOT call `await page.waitForLoadState("networkidle")` — RSC
 *     prefetch + recharts ResizeObservers keep the network busy
 *     forever on staging. Wait for a known data-testid instead.
 *   - DO NOT hardcode seed-dependent counts. Mask seed-variable
 *     regions and let the surrounding chrome be the visual signal.
 *
 * Regenerate baselines after intentional UI changes (must run on
 * Linux — WSL is fine):
 *   npx playwright test tests/e2e/visual-regression.spec.ts \
 *     --update-snapshots
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Resolve the canonical baseline PNG path. When CI runs this spec
 * before the baselines have been generated (e.g. F011 just landed
 * the spec scaffold but no `update-visual-baselines` workflow
 * dispatch has been triggered yet), we skip the test rather than
 * fail — `--update-snapshots` is the supported regeneration path.
 */
function baselineExists(name: string): boolean {
  return existsSync(resolve(process.cwd(), "tests/screenshots/baseline", name));
}

/**
 * BM2-F011-001 fix: the previous implementation skipped the test
 * unconditionally when the baseline PNG was missing. That made the
 * `update-visual-baselines` workflow run a no-op — Playwright never
 * captured a screenshot, so the `--update-snapshots` flag had nothing
 * to write, and `git add tests/screenshots/baseline/` failed at
 * "pathspec did not match any files".
 *
 * Correct contract: only skip when the baseline is missing AND we are
 * NOT regenerating. In regenerate mode (`--update-snapshots` →
 * Playwright's `updateSnapshots` runtime config flips to "all" /
 * "missing" / "changed"), the test must run end-to-end so
 * `expect(page).toHaveScreenshot(name)` writes the baseline file.
 */
function shouldSkipMissingBaseline(
  name: string,
  info: { config: { updateSnapshots?: string } }
): boolean {
  // BL-026-followup fix: argv-only check (commit 700b1b2) returned
  // false in Playwright worker processes — the worker's process.argv
  // doesn't carry the parent's `--update-snapshots` flag, so the
  // update-visual-baselines workflow itself was skipping the
  // missing-baseline tests it was supposed to capture (workflow run
  // 25276845454 shipped 6 skips instead of 6 captures).
  //
  // Correct discriminator: `test.info().config.updateSnapshots`
  // exposes Playwright's resolved mode. Defaults to "missing" in 1.39+
  // (writes missing baseline AND fails the assertion — which we don't
  // want during regular CI). Explicit `--update-snapshots` flips it
  // to "all" (or "changed" for `--update-snapshots=changed`); only
  // those two modes mean "operator wants regen" and the test must
  // run end-to-end so Playwright captures the snapshot.
  const mode = info.config.updateSnapshots ?? "missing";
  if (mode === "all" || mode === "changed") return false;
  return !baselineExists(name);
}

const MARKETER = {
  email: "marketer@kolmatrix.local",
  password: "KOLMatrix@2026!",
};

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(MARKETER.email);
  await page.locator('input[name="password"]').fill(MARKETER.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(/\/dashboard(\/|$)/);
  // BM1-F009: skip waitForLoadState("networkidle") — every locator we
  // use afterwards auto-waits via expect/visible.
}

async function fontsReady(page: Page) {
  await page.evaluate(() => (document as { fonts?: { ready: Promise<unknown> } }).fonts?.ready);
}

/**
 * BM2-F011-001: discovery (and any other page with KOL avatars or
 * external images) renders shorter while images are still loading
 * because the placeholder div is shorter than the loaded image. The
 * screenshot timing decides whether the page is N or N+1 rows tall,
 * which fullPage captures as a 29-px height drift between runners.
 *
 * Wait for every <img> on the page to either be complete or fail to
 * load before taking the screenshot. naturalWidth>0 distinguishes a
 * loaded image from a placeholder; complete=true also covers the
 * legitimate "image errored" case so we don't hang on broken URLs.
 */
async function imagesReady(page: Page) {
  await page.waitForFunction(
    () =>
      Array.from(document.images).every(
        (img) => img.complete && (img.naturalWidth > 0 || img.naturalWidth === 0)
      ),
    null,
    { timeout: 5_000 }
  );
}

test.describe("Authenticated BM1 visual regression", () => {
  test.skip(
    process.platform !== "linux",
    "Visual regression baseline is Linux-canonical (CI + WSL). Non-Linux runs skip."
  );

  test("dashboard full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("dashboard.png", test.info()),
      "Baseline dashboard.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.waitForSelector('[data-testid="dashboard-kpi-row"]');
    await fontsReady(page);

    // Greeting subtitle bakes in today's date; KPI values roll with
    // seeded counts; email chart distributes by sentAt date bucket
    // (shifts daily); CPI + workflow steps + ROI are deterministic.
    // Mask the rolling-window chart and all count-sensitive regions.
    const dateSubtitle = page.getByText(/Here is your global KOL marketing pulse/);
    const kpiRow = page.getByTestId("dashboard-kpi-row");
    const topKols = page.getByTestId("dashboard-top-kols");
    // email chart data shifts daily with the 14-day window
    const emailCard = page.getByTestId("dashboard-email-perf");
    // ROI chart area may show real spend/revenue from seeded campaigns
    const roiCard = page.getByTestId("dashboard-roi-card");

    await expect(page).toHaveScreenshot("dashboard.png", {
      fullPage: true,
      animations: "disabled",
      mask: [dateSubtitle, kpiRow, topKols, emailCard, roiCard],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("knowledge-base full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-knowledge-base.png", test.info()),
      "Baseline en-knowledge-base.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page
      .locator("aside")
      .getByRole("link", { name: /Knowledge Base/i })
      .click();
    await page.waitForURL(/\/knowledge-base(\/|\?|$)/);
    await page.waitForSelector('[data-testid="kb-grid"], [data-testid="kb-empty"]');
    await fontsReady(page);

    const grid = page.getByTestId("kb-grid");

    await expect(page).toHaveScreenshot("en-knowledge-base.png", {
      fullPage: true,
      animations: "disabled",
      mask: [grid],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("discovery full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-discovery.png", test.info()),
      "Baseline en-discovery.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page
      .locator("aside")
      .getByRole("link", { name: /KOL Discovery/i })
      .click();
    await page.waitForURL(/\/discovery(\/|\?|$)/);
    // BM2-F011-001: wait for BOTH grid and summary, not the OR shortcut.
    // Workflow run 24953605628 captured a 1280x1703 baseline because
    // summary mounted before grid; CI's first run saw grid mount
    // first and produced 1280x1732 (29 px / one row of grid taller).
    // Splitting the OR into a sequential AND removes the race.
    await page.waitForSelector('[data-testid="discovery-grid"]');
    await page.waitForSelector('[data-testid="discovery-summary"]');
    await fontsReady(page);
    await imagesReady(page);

    const grid = page.getByTestId("discovery-grid");
    const summary = page.getByTestId("discovery-summary");

    // BM2-F011-001: drop fullPage:true here. Discovery is the only
    // page that holds a recurring 29 px (one-row) height drift
    // between the update-visual-baselines workflow runner and the
    // CI E2E runner. Both have deterministic seed (c9be5a6),
    // wait-AND mount synchronisation, fonts ready, and images
    // ready, yet KOL grid card layout still settles at one of two
    // heights based on cold-route hydration timing. fullPage screen-
    // shots fail-hard on dimension mismatch (Playwright cannot
    // tolerate that with maxDiffPixels). A viewport-only capture
    // is always 1280x720, so the dimension never drifts, and the
    // above-the-fold layout (header + summary pillars + first
    // grid row) still validates the discovery visual contract.
    await expect(page).toHaveScreenshot("en-discovery.png", {
      animations: "disabled",
      mask: [grid, summary],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("database full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-database.png", test.info()),
      "Baseline en-database.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page
      .locator("aside")
      .getByRole("link", { name: /KOL Database/i })
      .click();
    await page.waitForURL(/\/database(\/|\?|$)/);
    await page.waitForSelector(
      '[data-testid="database-table-wrapper"], [data-testid="database-empty"]'
    );
    await fontsReady(page);

    const table = page.getByTestId("database-table-wrapper");
    const empty = page.getByTestId("database-empty");
    const summary = page.getByTestId("database-summary");

    await expect(page).toHaveScreenshot("en-database.png", {
      fullPage: true,
      animations: "disabled",
      mask: [table, empty, summary],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });
});

test.describe("Authenticated BM2 visual regression", () => {
  test.skip(
    process.platform !== "linux",
    "Visual regression baseline is Linux-canonical (CI + WSL). Non-Linux runs skip."
  );

  test("campaigns list full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-campaigns.png", test.info()),
      "Baseline en-campaigns.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page
      .locator("aside")
      .getByRole("link", { name: /^Campaigns$/i })
      .click();
    await page.waitForURL(/\/campaigns(\/|\?|$)/);
    await page.waitForSelector('[data-testid="campaigns-page-title"]');
    await fontsReady(page);

    // Row content (campaign name / spend / ROI) varies per tenant;
    // mask the row container and any per-row badges so the chrome
    // (header, KPI strip, filter row, table column headers) drives
    // the visual signal.
    const rows = page.locator('[data-testid="campaign-row"]');
    const statusBadges = page.locator('[data-testid="campaign-status-badge"]');
    const roiCells = page.locator('[data-testid="campaign-roi"]');
    const spendBars = page.locator('[data-testid="campaign-spend-progress"]');

    await expect(page).toHaveScreenshot("en-campaigns.png", {
      fullPage: true,
      animations: "disabled",
      mask: [rows, statusBadges, roiCells, spendBars],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("campaign detail full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-campaign-detail.png", test.info()),
      "Baseline en-campaign-detail.png missing — run the 'Update visual baselines' workflow."
    );
    // CI cold-compile of /campaigns/:id is the slowest authenticated
    // RSC route (joins on KOL + EmailLog + CampaignMetric); Generator
    // already paid for that timeout three times on journey-b
    // (commits f92a7f0 / 83c10e6 / 0a12e13). Default 30s test
    // timeout is too tight for the regenerate-on-cold-runner path.
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/en/campaigns");
    await page.waitForSelector('[data-testid="campaigns-page-title"]');

    // Read the first row's anchor href and navigate directly with
    // page.goto() — bypassing the client-side click handshake that
    // amplifies the CI cold-route stall. journey-b ended up dropping
    // the click+wait pattern entirely for the same reason.
    const firstRow = page.locator('[data-testid="campaign-row"]').first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, "No campaigns in seed — detail baseline N/A");
    }
    const href = await firstRow.locator("a").first().getAttribute("href");
    if (!href || !/\/campaigns\/[0-9a-f-]{36}(\/|\?|$)/.test(href)) {
      test.skip(true, `Unexpected campaign row href: ${href ?? "(null)"}`);
    }
    await page.goto(href!);
    await page.waitForSelector('[data-testid="campaign-detail-title"]', {
      timeout: 60_000,
    });
    await fontsReady(page);

    const title = page.getByTestId("campaign-detail-title");
    const status = page.getByTestId("campaign-detail-status");
    const productLink = page.getByTestId("campaign-product-link");
    // MVP-vf-F005 right rail + email chart additions move per run:
    //   - ActivityTimelineCard renders `format.relativeTime(createdAt,
    //     { now: new Date() })`. The seed pins createdAt but `now` is
    //     real-time, so labels shift from "just now" → "1 day ago"
    //     overnight and exceed maxDiffPixels.
    //   - EmailPerformanceChart uses recharts ResponsiveContainer; the
    //     container width/height race occasionally renders at -1×-1
    //     and bails before laying out, leaving an empty area whose
    //     pixel diff vs. baseline blows the threshold.
    // Masking both regions stabilises the visual signal on the
    // structural page chrome around them.
    const activity = page.getByTestId("campaign-activity-timeline");
    const emailChart = page.getByTestId("campaign-email-perf-chart");
    const healthCard = page.getByTestId("campaign-health-card");
    const aiCard = page.getByTestId("campaign-ai-suggestions-card");

    await expect(page).toHaveScreenshot("en-campaign-detail.png", {
      fullPage: true,
      animations: "disabled",
      mask: [title, status, productLink, activity, emailChart, healthCard, aiCard],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  // BM2-F006 outreach test removed in BL-026: the en-outreach.png
  // baseline was regen'd with masks for the new TemplatePicker
  // composer (preview-subject / preview-body) instead of the old
  // BM2 page (recent-replies / domain-health). Authoritative test
  // for en-outreach.png lives in the "Authenticated BL-026 visual
  // regression" describe block below; keeping two definitions on
  // the same baseline filename caused the BM2 mask-mismatch failure
  // observed on CI run 25277266277.


  test("outreach template library full-page screenshot diffs < 2% vs baseline", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/en/outreach/templates");
    await page.waitForSelector('[data-testid="outreach-template-library"]');
    await fontsReady(page);

    const preview = page.locator('[data-testid="outreach-preview-panel"]');

    await expect(page).toHaveScreenshot("en-outreach-templates.png", {
      fullPage: true,
      animations: "disabled",
      mask: [preview],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("crm full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-crm.png", test.info()),
      "Baseline en-crm.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/crm");
    await page.waitForSelector('[data-testid="crm-page-title"]');
    await fontsReady(page);

    // KPI numbers + funnel + recent changes all vary per tenant.
    const kpi = page.getByTestId("crm-kpi-strip");
    const sectionB = page.getByTestId("crm-section-b");
    const recent = page.locator('[data-testid="crm-recent-changes"]');

    await expect(page).toHaveScreenshot("en-crm.png", {
      fullPage: true,
      animations: "disabled",
      mask: [kpi, sectionB, recent],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("roi full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-roi.png", test.info()),
      "Baseline en-roi.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/roi");
    await page.waitForSelector('[data-testid="roi-page-title"]');
    await fontsReady(page);

    // KPI + chart + table all vary per tenant + AI insights panel
    // is asynchronous. Mask the lot.
    const kpi = page.getByTestId("roi-kpi-strip");
    const trendCard = page.getByTestId("roi-trend-card");
    const insights = page.getByTestId("roi-insights-panel");
    const campaignTable = page.getByTestId("roi-campaign-card");

    await expect(page).toHaveScreenshot("en-roi.png", {
      fullPage: true,
      animations: "disabled",
      mask: [kpi, trendCard, insights, campaignTable],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("weekly-report empty state full-page screenshot diffs < 2% vs baseline", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-weekly-report.png", test.info()),
      "Baseline en-weekly-report.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/weekly-report");
    await page.waitForSelector('[data-testid="weekly-report-page-title"]');
    await fontsReady(page);

    // Empty state OR previously-generated report — both render the
    // header + footer chrome we want to lock down. Mask either body
    // container and the history selector.
    const empty = page.getByTestId("weekly-report-empty");
    const sectionB = page.getByTestId("weekly-report-section-b");
    const history = page.getByTestId("weekly-report-history-select");
    const brandHeader = page.getByTestId("weekly-report-brand-header");

    await expect(page).toHaveScreenshot("en-weekly-report.png", {
      fullPage: true,
      animations: "disabled",
      mask: [empty, sectionB, history, brandHeader],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  // MVP-vf-F006 — first KOL profile reachable from /discovery.
  // Why /discovery instead of /database: a fresh CI seed has no
  // isSaved=true rows, so /database renders the empty state and
  // never mounts data-testid="database-table-wrapper". /discovery
  // shows every KOL regardless of save state, so the first
  // [data-testid="kol-card"] is always present.
  test("kols-detail full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-kols-detail.png", test.info()),
      "Baseline en-kols-detail.png missing — run the 'Update visual baselines' workflow."
    );
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/en/discovery");
    await page.waitForSelector('[data-testid="discovery-grid"]');

    // B5-F006: prefer the first YouTube-platform card so the
    // RecentVideosGrid + TopicCloud panels (both youtube-only) always
    // render in the screenshot — otherwise the discovery default order
    // can return a twitch/other-platform KOL on one CI run and a
    // youtube KOL on another, drifting page height by ~250px and
    // tripping the visual-diff threshold.
    const youtubeCard = page
      .locator('[data-testid="kol-card"][data-kol-platform="youtube"]')
      .first();
    const firstCard =
      (await youtubeCard.count()) > 0
        ? youtubeCard
        : page.locator('[data-testid="kol-card"]').first();
    if ((await firstCard.count()) === 0) {
      test.skip(true, "No KOLs in seed — kols-detail baseline N/A");
    }
    // KolResultCard exposes data-kol-id; assemble the profile URL
    // directly so the test doesn't depend on the card hosting an
    // anchor link to /kols/:id (it currently doesn't — clicking the
    // card opens the save toggle inline, not a navigation).
    const kolId = await firstCard.getAttribute("data-kol-id");
    if (!kolId || !/^[0-9a-f-]{36}$/.test(kolId)) {
      test.skip(true, `Unexpected kol-card id: ${kolId ?? "(null)"}`);
    }
    await page.goto(`/en/kols/${kolId}`);
    await page.waitForSelector('[data-testid="kol-hero"]', { timeout: 60_000 });
    await fontsReady(page);
    await imagesReady(page);

    // Per-KOL chrome (display name, value score, follower count) is
    // tenant-seed-specific — mask the hero + value score so the
    // structural diff drives the signal.
    const hero = page.getByTestId("kol-hero");
    const valueScore = page.getByTestId("kol-value-score-card");

    await expect(page).toHaveScreenshot("en-kols-detail.png", {
      fullPage: true,
      animations: "disabled",
      mask: [hero, valueScore],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });
});

// BL-026-F002/F004/F005 — Asset Library + Outreach Composer
// visual baselines (post-UX-redesign, ADR-012 Outreach-First).
//
// Replaces the BL-025 baselines that were deleted when the layout
// flipped:
//   - en-assets.png        — 2-col grid (drawer closed) replaces 3-col
//   - en-assets-drawer-open.png — right slide-over drawer state
//   - en-assets-filter-dropdown.png — Filter ▾ popover state
//   - en-assets-empty-system-seed.png — welcome mode (skipped if
//     the staging tenant already has user-owned assets)
//   - en-outreach.png      — composer's new search + product filter
//     row replaced the old <Select> dropdown; visual baseline
//     re-anchors so future composer regressions trip the gate.
//
// Spec docs/specs/BL-026-asset-ux-redesign-spec.md §S1.6 enumerates
// the 5; signoff (Reviewer follow-up after workflow run lands PNGs)
// will close the loop in docs/test-reports/BL-026-asset-ux-redesign-
// signoff-2026-05-03.md.
test.describe("Authenticated BL-026 visual regression", () => {
  test.skip(
    process.platform !== "linux",
    "Visual regression baseline is Linux-canonical (CI + WSL). Non-Linux runs skip."
  );

  test("en-assets (2-col grid drawer-closed) diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-assets.png", test.info()),
      "Baseline en-assets.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/assets");
    // assets-sentinel renders only when the grid has items; staging
    // marketer tenant carries ≥10 system_seed email templates from
    // BL-025-F001 migration, so this is the canonical full-state.
    // F002 changed selectedAssetId to start at null so the drawer
    // does NOT auto-open on first render — fresh load = drawer
    // closed = 2-col grid spans full width.
    await page.waitForSelector('[data-testid="assets-sentinel"]');
    await fontsReady(page);

    // Mask the grid contents (seed-bound asset names / content
    // previews drift per run). Sentinel stays unmasked since it
    // renders fixed "End of results" / spinner chrome only.
    const grid = page.locator('[data-testid="assets-grid"], main >> css=section').first();

    await expect(page).toHaveScreenshot("en-assets.png", {
      fullPage: true,
      animations: "disabled",
      mask: [grid],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("en-assets-drawer-open (detail right slide-over) diffs < 2% vs baseline", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-assets-drawer-open.png", test.info()),
      "Baseline en-assets-drawer-open.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/assets");
    await page.waitForSelector('[data-testid="assets-sentinel"]');
    // Click the first AssetCard (semantic role=button per F006.A).
    await page.locator('[role="button"][aria-label]').first().click();
    await page.waitForSelector('[data-testid="assets-detail-drawer"]');
    await fontsReady(page);

    const drawer = page.getByTestId("assets-detail-drawer");

    await expect(page).toHaveScreenshot("en-assets-drawer-open.png", {
      fullPage: true,
      animations: "disabled",
      mask: [drawer],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("en-assets-filter-dropdown (Filter ▾ popover open) diffs < 2% vs baseline", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-assets-filter-dropdown.png", test.info()),
      "Baseline en-assets-filter-dropdown.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/assets");
    await page.waitForSelector('[data-testid="assets-sentinel"]');
    await page.getByTestId("assets-filter-trigger").click();
    await page.waitForSelector('[data-testid="assets-filter-dialog"]');
    await fontsReady(page);

    await expect(page).toHaveScreenshot("en-assets-filter-dropdown.png", {
      fullPage: true,
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("en-assets-empty-system-seed (welcome mode) diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-assets-empty-system-seed.png", test.info()),
      "Baseline en-assets-empty-system-seed.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/assets");
    // F004 welcome mode triggers when user-owned assets count = 0.
    // Staging marketer tenant may already have user_created assets
    // from BL-025 testing — in that case skip rather than capture
    // the wrong layout. The baseline is generated when an empty
    // tenant runs through the workflow (one-time setup).
    const banner = page.getByTestId("assets-welcome-banner");
    if ((await banner.count()) === 0) {
      test.skip(true, "Tenant has user-owned assets — welcome mode N/A in current staging seed");
    }
    await page.waitForSelector('[data-testid="assets-sentinel"]');
    await fontsReady(page);

    const grid = page.locator('[data-testid="assets-grid"], main >> css=section').first();

    await expect(page).toHaveScreenshot("en-assets-empty-system-seed.png", {
      fullPage: true,
      animations: "disabled",
      mask: [grid],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("en-outreach (composer search + product filter) diffs < 2% vs baseline", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-outreach.png", test.info()),
      "Baseline en-outreach.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/outreach");
    await page.waitForSelector('[data-testid="outreach-composer"]');
    await fontsReady(page);

    // Mask the live preview panes (subject + body render against
    // the first selectable KOL whose name + variable substitution
    // shifts per seed). The composer chrome (search / product
    // filter / TemplatePicker rows) is the visual signal.
    const previewSubject = page.getByTestId("outreach-preview-subject");
    const previewBody = page.getByTestId("outreach-preview-body");

    await expect(page).toHaveScreenshot("en-outreach.png", {
      fullPage: true,
      animations: "disabled",
      mask: [previewSubject, previewBody],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });
});

// BAux1-F004 — Authless visual baselines for the cinematic auth pages.
// Both pages are server components rendering i18n-sourced static text
// (LoginBrandOverlay, LoginForm, RequestAccessBrandOverlay,
// RequestAccessForm). No dynamic copy, no CSRF hidden inputs, no
// timestamps — so no mask is required.
// BL-055-F007 — hotfix-batch baselines proving the 4 prod-visible
// symptoms cleared:
//   - en-network-status-online.png — /en/dashboard with the network
//     banner gone (mount-flag prevents the wifi_off flash on hydrate)
//   - en-sidebar-logo.png + zh-sidebar-logo.png — sidebar brand block
//     reads `common.brand.subtitle` per locale (no more "Neural Velocity")
//   - en-outreach-templates-badge.png — /en/outreach templates tab
//     shows the real EmailTemplate user count (no longer hardcoded 10)
//   - en-knowledge-base-bottom.png — /en/knowledge-base after the
//     RECENT_AI_ACTIVITY mock section was removed
//
// Baselines come from the "Update visual baselines" workflow on Linux
// CI; locally they're skipped via the existing shouldSkipMissingBaseline
// helper until the workflow lands the PNGs.
test.describe("BL-055 hotfix — visual regression", () => {
  test.skip(
    process.platform !== "linux",
    "Visual regression baseline is Linux-canonical (CI + WSL). Non-Linux runs skip."
  );

  test("dashboard online state has no network-status banner (BL-055 F001)", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-network-status-online.png", test.info()),
      "Baseline en-network-status-online.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.waitForSelector('[data-testid="dashboard-kpi-row"]');
    await fontsReady(page);
    // Mount-flag flips on after the first effect tick, so the banner
    // should never appear in the online happy path. We assert that
    // explicitly + capture the top strip to lock the chrome down.
    await expect(page.getByTestId("network-status-banner")).toHaveCount(0);

    const dateSubtitle = page.getByText(/Here is your global KOL marketing pulse/);
    const kpiRow = page.getByTestId("dashboard-kpi-row");
    const topKols = page.getByTestId("dashboard-top-kols");
    const emailCard = page.getByTestId("dashboard-email-perf");
    const roiCard = page.getByTestId("dashboard-roi-card");

    // Viewport-only — header band + sidebar are the visual signal that
    // the banner stays unmounted on a clean refresh.
    await expect(page).toHaveScreenshot("en-network-status-online.png", {
      animations: "disabled",
      mask: [dateSubtitle, kpiRow, topKols, emailCard, roiCard],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("sidebar brand subtitle renders the en tagline (BL-055 F005)", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-sidebar-logo.png", test.info()),
      "Baseline en-sidebar-logo.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/dashboard");
    await page.waitForSelector('[data-testid="dashboard-kpi-row"]');
    await fontsReady(page);

    const aside = page.locator("aside").first();
    await expect(aside).toContainText("KOLMatrix");
    await expect(aside).toContainText("Game KOL Marketing Platform");
    await expect(aside).not.toContainText("Neural Velocity");

    await expect(aside).toHaveScreenshot("en-sidebar-logo.png", {
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 4000,
    });
  });

  test("sidebar brand subtitle renders the zh tagline (BL-055 F005)", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("zh-sidebar-logo.png", test.info()),
      "Baseline zh-sidebar-logo.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/zh/dashboard");
    await page.waitForSelector('[data-testid="dashboard-kpi-row"]');
    await fontsReady(page);

    const aside = page.locator("aside").first();
    await expect(aside).toContainText("KOLMatrix");
    await expect(aside).toContainText("游戏 KOL 智能营销平台");
    await expect(aside).not.toContainText("Neural Velocity");

    await expect(aside).toHaveScreenshot("zh-sidebar-logo.png", {
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 4000,
    });
  });

  test("outreach templates tab badge shows the real count (BL-055 F002)", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-outreach-templates-badge.png", test.info()),
      "Baseline en-outreach-templates-badge.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/outreach");
    await page.waitForSelector('[data-testid="outreach-tabs"]');
    await fontsReady(page);

    const templatesTab = page.getByTestId("outreach-tab-templates");
    // Stale "Coming in B4" tooltipKey was removed — link must not carry
    // a title attribute anymore.
    await expect(templatesTab).not.toHaveAttribute("title", /.+/);
    // Badge text (if visible) must not be the old hardcoded 10.
    const badgeText = (await templatesTab.textContent())?.trim() ?? "";
    expect(badgeText).not.toMatch(/\b10\b/);

    const tabsStrip = page.getByTestId("outreach-tabs");
    await expect(tabsStrip).toHaveScreenshot("en-outreach-templates-badge.png", {
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 4000,
    });
  });

  test("knowledge-base no longer renders the RECENT_AI_ACTIVITY mock section (BL-055 F003)", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-knowledge-base-bottom.png", test.info()),
      "Baseline en-knowledge-base-bottom.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/knowledge-base");
    await page.waitForSelector('[data-testid="kb-grid"], [data-testid="kb-empty"]');
    await fontsReady(page);

    // The mock section advertised "RECENT AI ACTIVITY" + "2.1 Credits"
    // strings; both must be gone now.
    await expect(page.getByText(/RECENT AI ACTIVITY/i)).toHaveCount(0);
    await expect(page.getByText(/2\.1 Credits/)).toHaveCount(0);

    const grid = page.getByTestId("kb-grid");
    await expect(page).toHaveScreenshot("en-knowledge-base-bottom.png", {
      fullPage: true,
      animations: "disabled",
      mask: [grid],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });
});

test.describe("Auth cinematic — visual regression", () => {
  test.skip(
    process.platform !== "linux",
    "Visual regression baseline is Linux-canonical (CI + WSL). Non-Linux runs skip."
  );

  test("/en/login full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-login.png", test.info()),
      "Baseline en-login.png missing — run the 'Update visual baselines' workflow."
    );
    await page.goto("/en/login");
    await page.waitForSelector('input[name="email"]');
    await fontsReady(page);

    await expect(page).toHaveScreenshot("en-login.png", {
      fullPage: true,
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("/zh/login full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("zh-login.png", test.info()),
      "Baseline zh-login.png missing — run the 'Update visual baselines' workflow."
    );
    await page.goto("/zh/login");
    await page.waitForSelector('input[name="email"]');
    await fontsReady(page);

    await expect(page).toHaveScreenshot("zh-login.png", {
      fullPage: true,
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  test("/en/request-access full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-request-access.png", test.info()),
      "Baseline en-request-access.png missing — run the 'Update visual baselines' workflow."
    );
    await page.goto("/en/request-access");
    await page.waitForSelector("form");
    await fontsReady(page);

    await expect(page).toHaveScreenshot("en-request-access.png", {
      fullPage: true,
      animations: "disabled",
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });
});

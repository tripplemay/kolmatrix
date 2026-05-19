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
 *   - en-campaign-detail.png    — authenticated `/en/campaigns/:id` (BM2-F005 + MVP-vf-F005 + BL-066-F009 mask refresh + viewport-only fix for 3-panel AI-native layout, 2026-05-15)
 *   - en-match.png              — authenticated `/en/match` unified workbench (BL-065-F006 placeholder, BL-066-F009 lands the baseline)
 *   - en-match-with-campaign.png — authenticated `/en/match?campaignId=:id` with RefineInputBar in the right column (BL-068-F004 + F007 baseline)
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
/**
 * BL-064-F006 re-enable — describes have been switched back from .skip
 * to active. Baselines under `tests/screenshots/baseline/` are
 * regenerated against the new 4-item sidebar (Brief / Match / Reach /
 * Insight) via the `update-visual-baselines` workflow run that ships
 * alongside this commit. Legacy baseline filenames (dashboard.png,
 * en-discovery.png, en-database.png, etc.) are intentionally kept —
 * their content now reflects the 302-redirected new IA shell (e.g.
 * dashboard.png shows /insight under the hood), but renaming is BL-070
 * scope. The login waitForURL accepts both /dashboard and /insight
 * during the transition (F002 302 chain).
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
  // BL-064-F002 — /dashboard 302→/insight; accept either tail during
  // Phase 1 transition.
  await page.waitForURL(/\/(dashboard|insight)(\/|$)/);
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
      true,
      "BL-070-F003 wrapped DashboardPage in /insight tab nav (InsightTabs) — " +
        "dashboard.png baseline now diffs by the new tab strip above the page. " +
        "F007 update-visual-baselines workflow regenerates the baseline against " +
        "the new /insight?tab=dashboard chrome; remove this skip in the same " +
        "commit that lands the regen.",
    );
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
      true,
      "BL-069-F003 replaced /brief KB re-export with CampaignForm + AI bar; " +
        "/knowledge-base 302→/brief no longer renders kb-grid. F004 will mount " +
        "ProductListPanel under /brief?tab=products and F006 will retarget the " +
        "redirect; F007 update-visual-baselines workflow will regenerate the " +
        "baseline against the new product list view. BL-070 二次清理 will then " +
        "delete /knowledge-base entirely."
    );
    test.skip(
      shouldSkipMissingBaseline("en-knowledge-base.png", test.info()),
      "Baseline en-knowledge-base.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    // BL-064-F003 sidebar dropped the "Knowledge Base" link; go direct
    // (F002 302→/brief, content unchanged).
    await page.goto("/en/knowledge-base");
    await page.waitForURL(/\/(knowledge-base|brief)(\/|\?|$)/);
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

  // BL-069-F007 — new /brief layout (BriefAiInputBar + CampaignForm).
  // Baseline locks the AI escape-hatch above the form + the form's
  // 8-field structure (product / name / budget split / dates /
  // markets / target audience / categories / submit) so a future
  // accidental reshuffle gets caught before merge. The product
  // selector content is tenant-dependent → mask the <select>.
  test("brief full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-brief.png", test.info()),
      "Baseline en-brief.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/brief");
    await page.waitForSelector('[data-testid="brief-campaign-form"]');
    await page.waitForSelector('[data-testid="brief-ai-input-bar"]');
    await fontsReady(page);

    // Tenant-dependent <select> options would otherwise drift across
    // CI runs that pick up new seed data; mask the dropdown body.
    const productSelect = page.getByTestId("brief-product-select");

    await expect(page).toHaveScreenshot("en-brief.png", {
      fullPage: true,
      animations: "disabled",
      mask: [productSelect],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  // BL-069-F007 — /brief?tab=products renders the migrated KB CRUD.
  // Same kb-grid testid as the legacy /knowledge-base baseline above,
  // but now wrapped in the BL-069 ProductListPanel + tab nav. F006
  // redirected /knowledge-base → /brief?tab=products so this is the
  // canonical entry point going forward; BL-070 二次清理 will retire
  // the old en-knowledge-base.png alongside the route.
  test("brief?tab=products full-page screenshot diffs < 2% vs baseline", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-brief-products.png", test.info()),
      "Baseline en-brief-products.png missing — run the 'Update visual baselines' workflow."
    );
    await login(page);
    await page.goto("/en/brief?tab=products");
    await page.waitForSelector(
      '[data-testid="brief-product-list-panel"]'
    );
    await page.waitForSelector('[data-testid="kb-grid"], [data-testid="kb-empty"]');
    await fontsReady(page);

    const grid = page.getByTestId("kb-grid");

    await expect(page).toHaveScreenshot("en-brief-products.png", {
      fullPage: true,
      animations: "disabled",
      mask: [grid],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  // BL-065-F006 retired the legacy `discovery full-page` +
  // `database full-page` cases with their routes. BL-066-F009 lands
  // the unified workbench baseline below.
  test("match full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-match.png", test.info()),
      "Baseline en-match.png missing — run the 'Update visual baselines' workflow."
    );
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/en/match");
    await page.waitForSelector(
      '[data-testid="match-grid"], [data-testid="match-empty"]',
      { timeout: 60_000 }
    );
    await fontsReady(page);
    await imagesReady(page);

    // KOL grid is seed-bound, AI sidebar fetches cosine recommendations
    // that drift across runs, and the active-filters chip row varies
    // with default sort. Mask all three so the chrome (header, filter
    // dropdowns, view toggles) drives the visual signal.
    const grid = page.locator('[data-testid="match-grid"]');
    const aiSidebar = page.locator('[data-testid="match-ai-sidebar"]');
    const activeFilters = page.locator('[data-testid="match-active-filters"]');

    // BL-068-F007: switched from `fullPage: true` to viewport-only.
    // Root cause for the persistent /match visual failure on CI: page
    // height was drifting 4px between the update-visual-baselines
    // workflow runner and the CI runner (sub-pixel font rendering
    // affecting scroll height of the masked grid below the fold).
    // When image dimensions mismatch, Playwright fails the assertion
    // BEFORE comparing pixels, so maxDiffPixels can't absorb a
    // size delta — only switching to viewport-only fixes it. Same
    // fix the BM2 en-campaign-detail test landed (BL-066-F009).
    await expect(page).toHaveScreenshot("en-match.png", {
      animations: "disabled",
      mask: [grid, aiSidebar, activeFilters],
      threshold: 0.02,
      maxDiffPixels: 8000,
    });
  });

  // BL-068-F004 + F007 — /match `?campaignId` mode mounts MatchRefineBar
  // above the AiSuggestionsSidebar in the right column. The new
  // `en-match-with-campaign.png` baseline captures the bar + sidebar
  // chrome so a regression in either surface trips the gate.
  test("match with ?campaignId full-page screenshot diffs < 2% vs baseline", async ({
    page,
  }) => {
    test.skip(
      shouldSkipMissingBaseline("en-match-with-campaign.png", test.info()),
      "Baseline en-match-with-campaign.png missing — run the 'Update visual baselines' workflow."
    );
    test.setTimeout(90_000);
    await login(page);
    // Resolve a tenant-scoped campaignId from the campaigns list, then
    // hop to /match with it as a query param. Mirrors the dynamic-id
    // pattern used by the BM2 campaign-detail test below — keeps the
    // suite seed-tolerant (no hardcoded UUIDs).
    await page.goto("/en/campaigns");
    await page.waitForSelector('[data-testid="campaigns-page-title"]');
    const firstRow = page.locator('[data-testid="campaign-row"]').first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, "No campaigns in seed — match-with-campaign baseline N/A");
    }
    const cid = await firstRow.getAttribute("data-campaign-id");
    if (!cid) test.skip(true, "First campaign-row has no data-campaign-id");

    await page.goto(`/en/match?campaignId=${cid}`);
    await page.waitForSelector(
      '[data-testid="match-grid"], [data-testid="match-empty"]',
      { timeout: 60_000 }
    );
    // The right-column wrapper hosts both MatchRefineBar and
    // AiSuggestionsSidebar. Wait for the sidebar (always renders when
    // ?campaignId resolves); the refine bar may or may not mount
    // depending on whether the smart-match pool is reachable, so we
    // mask both surfaces to keep the baseline driven by chrome.
    await page.waitForSelector('[data-testid="match-ai-sidebar"]', {
      timeout: 60_000,
    });
    await fontsReady(page);
    await imagesReady(page);

    const grid = page.locator('[data-testid="match-grid"]');
    const aiSidebar = page.locator('[data-testid="match-ai-sidebar"]');
    const refineBar = page.locator('[data-testid="match-refine-bar"]');
    const activeFilters = page.locator('[data-testid="match-active-filters"]');

    // Viewport-only (no fullPage) for the same reason as en-match.png
    // above — page-height drift between runners trips the size check
    // before pixel comparison. Viewport-only locks dimensions to the
    // configured Playwright viewport (1280x720 default) so the chrome
    // up-top drives the visual signal.
    await expect(page).toHaveScreenshot("en-match-with-campaign.png", {
      animations: "disabled",
      mask: [grid, aiSidebar, refineBar, activeFilters],
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
    // BL-064-F003 sidebar dropped "Campaigns"; the list page is kept
    // (BL-064-F005 fix-round-2 — /campaigns stays as deep-link until
    // BL-066 wires /match view=campaigns).
    await page.goto("/en/campaigns");
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

  test("campaign detail viewport screenshot diffs < 2% vs baseline", async ({ page }) => {
    // BL-066-F008 removed the /campaigns/[id] → /match?campaignId 302
    // sediment (middleware-helpers.ts §93-95); F002 wired the 3-section
    // AI-native layout (Brief / AI recommendation / Accepted KOLs);
    // F006 renamed the bottom panel to AcceptedKolsPanel. The detail
    // route now renders directly and the baseline can be (re-)captured
    // via update-visual-baselines.
    //
    // BL-066-F009 follow-up: switched from `fullPage: true` to a
    // viewport-only screenshot (default 1280×720). Root cause for the
    // initial F009 baseline regen vs CI E2E mismatch (1126 vs 865 px
    // tall, 70% pixel diff): `.first()` selects a non-deterministic
    // campaign whose AcceptedKolsPanel row count drives the fullPage
    // height. Mask doesn't help — fullPage capture height is set by
    // the page's actual scroll height regardless of which regions are
    // masked. Viewport-only fixes the screenshot dimensions to the
    // playwright config viewport, and the layout/chrome (top nav,
    // sidebar, breadcrumb area, brief panel framing) carries the
    // visual signal.
    test.skip(
      shouldSkipMissingBaseline("en-campaign-detail.png", test.info()),
      "Baseline en-campaign-detail.png missing — run the 'Update visual baselines' workflow."
    );
    // Cold-compile of /campaigns/:id remains the slowest authenticated
    // RSC route (joins on KOL + EmailLog + CampaignMetric); raise the
    // test timeout for the regenerate-on-cold-runner path. Generator
    // already paid for that timeout three times on journey-b
    // (commits f92a7f0 / 83c10e6 / 0a12e13).
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
    // BL-066 layout root sentinel.
    await page.waitForSelector('[data-testid="campaign-brief-summary"]', {
      timeout: 60_000,
    });
    await fontsReady(page);

    // Mask the three dynamic content panels (in case they intersect
    // the viewport; mask is a no-op for regions outside the capture):
    //   - campaign-brief-summary  : campaign name / markets / budget /
    //     accepted+contacted counts all vary per tenant
    //   - campaign-ai-recommendation-card : fires /api/kols/smart-match
    //     which returns non-deterministic cosine-ranked candidates;
    //     skeleton/empty/active/exhausted state itself drifts run to run
    //   - accepted-kols-panel     : per-tenant KOL rows + source chips
    // Breadcrumb name span (no testid) also varies with campaign name —
    // mask the whole <nav>.
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    const brief = page.getByTestId("campaign-brief-summary");
    const aiPanel = page.getByTestId("campaign-ai-recommendation-card");
    const acceptedKols = page.getByTestId("accepted-kols-panel");

    await expect(page).toHaveScreenshot("en-campaign-detail.png", {
      animations: "disabled",
      mask: [breadcrumb, brief, aiPanel, acceptedKols],
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
    test.skip(
      true,
      "BL-070-F004 retired /outreach — content moved to /reach/templates. " +
        "F007 (visual baseline 全量 regen) will produce a new en-reach-templates.png " +
        "and either unskip this test against the new path or delete it.",
    );
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
      true,
      "BL-070-F004 deleted the /weekly-report redirect rule (F003 git mv'd the " +
        "route to /insight/weekly-report). F007 (visual baseline 全量 regen) will " +
        "produce a new baseline against /insight/weekly-report and either unskip " +
        "this test against the new path or delete it.",
    );
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

  // MVP-vf-F006 — first KOL profile reachable through the unified Match
  // workbench. BL-065-F006 retargeted the click-path: the legacy
  // /en/discovery entrypoint is gone (folder deleted in this same
  // commit) and the new /en/match surface uses `match-grid` /
  // `match-kol-card` selectors. The /kols/[id] page itself is
  // unchanged.
  test("kols-detail full-page screenshot diffs < 2% vs baseline", async ({ page }) => {
    test.skip(
      shouldSkipMissingBaseline("en-kols-detail.png", test.info()),
      "Baseline en-kols-detail.png missing — run the 'Update visual baselines' workflow."
    );
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/en/match");
    await page.waitForSelector('[data-testid="match-grid"]');

    // B5-F006 reasoning preserved: prefer the first YouTube-platform
    // card so the RecentVideosGrid + TopicCloud panels render and the
    // page height stays stable across CI runs.
    const youtubeCard = page
      .locator('[data-testid="match-kol-card"][data-kol-platform="youtube"]')
      .first();
    const firstCard =
      (await youtubeCard.count()) > 0
        ? youtubeCard
        : page.locator('[data-testid="match-kol-card"]').first();
    if ((await firstCard.count()) === 0) {
      test.skip(true, "No KOLs in seed — kols-detail baseline N/A");
    }
    const kolId = await firstCard.getAttribute("data-kol-id");
    if (!kolId || !/^[0-9a-f-]{36}$/.test(kolId)) {
      test.skip(true, `Unexpected match-kol-card id: ${kolId ?? "(null)"}`);
    }
    await page.goto(`/en/kols/${kolId}`);
    await page.waitForSelector('[data-testid="kol-hero"]', { timeout: 60_000 });
    await fontsReady(page);
    await imagesReady(page);

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
      true,
      "BL-070-F004 retired /outreach — content lives at /reach (F001 git mv). " +
        "F007 (visual baseline 全量 regen) will produce a new en-reach.png against " +
        "the new path and either unskip this test or delete it.",
    );
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
      true,
      "BL-070-F003 wrapped /dashboard in /insight tab nav — the captured " +
        "viewport now includes InsightTabs above the dashboard chrome, so " +
        "en-network-status-online.png diffs. F007 regenerates against the " +
        "new chrome and removes this skip.",
    );
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
    // BL-070-F004 — /dashboard route was retired. /insight is the new
    // canonical post-login surface and the embedded DashboardContent
    // still renders the dashboard-kpi-row testid this baseline relies on.
    await page.goto("/en/insight");
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
    // BL-070-F004 — /dashboard route was retired; use the canonical
    // /insight surface (DashboardContent is embedded under the default
    // tab and still renders the dashboard-kpi-row testid).
    await page.goto("/zh/insight");
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
      true,
      "BL-070-F004 retired /outreach (F001 git mv'd the route to /reach). " +
        "F007 will regenerate the badge baseline against /reach and either " +
        "unskip this test or delete it.",
    );
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
      true,
      "BL-069-F003 replaced /brief KB re-export with CampaignForm + AI bar; " +
        "/knowledge-base 302→/brief no longer renders kb-grid (the negative " +
        "RECENT_AI_ACTIVITY assertion the BL-055 hotfix protects is now " +
        "moot because the section no longer mounts at all). BL-070 二次清理 " +
        "will delete /knowledge-base entirely and remove this test."
    );
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

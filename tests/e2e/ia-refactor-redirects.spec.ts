/**
 * BL-064-F005 · IA refactor 302 redirects spec.
 *
 * Verifies that all legacy top-level routes 302-redirect to their new
 * IA targets (Brief / Match / Reach / Insight) across all 5 supported
 * locales. Source of truth for the redirect map is
 * `src/middleware-helpers.ts` `resolveIaRefactorRedirect` (covered at
 * the unit level in `src/__tests__/middleware-helpers.test.ts`); this
 * spec proves the wiring lands on the real middleware path.
 *
 * Why no `expect(...).toBe(302)` — Playwright follows redirects by
 * default; we observe the *final* URL the browser lands on, which
 * proves the redirect map points the right way + the new IA shell
 * renders. The status code is implicit (a 200 follows the 302).
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/marketer.json" });

const LOCALES = ["en", "zh", "ja", "ko", "es"] as const;

// Pairs are [legacy bare path, regex matching the expected new IA tail].
// The regex form lets us accept either the literal new path or a path
// with extra query/hash that middleware preserves (e.g. /campaigns →
// /match?view=campaigns).
interface RedirectCase {
  from: string;
  expect: RegExp;
  /** HTTP status the middleware returns for this redirect. BL-064
   *  defaults are 302 (temporary, preserves revert flexibility per
   *  Planner §4 #C). BL-069-F006 rules are 301 (permanent — spec
   *  §F006 acceptance #1) and locked by BL-069 fix-round 1 after
   *  Reviewer flagged the 302 mismatch (B1). */
  status: 301 | 302;
  note?: string;
}

const REDIRECT_CASES: RedirectCase[] = [
  // BL-064-F005 fix-round-2 — F002 redirect scope is restricted to
  // content-equivalent sources. Routes whose content lives elsewhere
  // (campaigns form / roi cards / weekly-report) are now kept paths
  // (asserted in the KEPT_PATHS describe below). See
  // src/middleware-helpers.ts IA_REDIRECT_RULES for the canonical
  // contract and the deferred-to-batch mapping.
  // BL-070-F003 — /dashboard + /reports + /analytics + /weekly-report
  // family all 301 to the corresponding /insight surface now that the
  // route is real (was embed-old shell under BL-064).
  {
    from: "/dashboard",
    expect: /\/insight\?tab=dashboard/,
    status: 301,
    note: "BL-070-F003 dashboard tab",
  },
  {
    from: "/reports",
    expect: /\/insight\?tab=reports/,
    status: 301,
    note: "BL-070-F003 reports tab",
  },
  {
    from: "/analytics",
    expect: /\/insight\?tab=analytics/,
    status: 301,
    note: "BL-070-F003 analytics tab",
  },
  {
    from: "/weekly-report",
    expect: /\/insight\/weekly-report(\/|\?|$)/,
    status: 301,
    note: "BL-070-F003 weekly-report subroute migration",
  },
  { from: "/discovery", expect: /\/match(\/|\?|$)/, status: 302 },
  { from: "/database", expect: /\/match(\/|\?|$)/, status: 302 },
  // BL-069-F006 + fix-round 1 — KB redirects to /brief?tab=products
  // with 301 PERMANENT status (spec §F006 acceptance #1 "完全 301
  // redirect"). Reviewer flagged the prior 302 implementation as
  // blocker B1 on 2026-05-18 staging spot-check.
  {
    from: "/knowledge-base",
    expect: /\/brief\?tab=products/,
    status: 301,
  },
  {
    from: "/knowledge-base/cprod1111111111111111",
    expect: /\/brief\?tab=products&productId=cprod1111111111111111/,
    status: 301,
    note: "BL-069-F006 deep-link",
  },
  // BL-070-F001 — /outreach (+ sub-paths via prefix swap) promoted to
  // 301 permanent now that /reach is a real route. Spec §F001
  // acceptance #3 ("301 redirect per BL-069 v0.9.22 #14 模式").
  { from: "/outreach", expect: /\/reach(\/|\?|$)/, status: 301 },
  {
    from: "/outreach/templates",
    expect: /\/reach\/templates(\/|\?|$)/,
    status: 301,
    note: "BL-070-F001 sub-path inheritance",
  },
  {
    from: "/outreach/tracking",
    expect: /\/reach\/tracking(\/|\?|$)/,
    status: 301,
    note: "BL-070-F001 sub-path inheritance",
  },
  {
    from: "/outreach/suppression",
    expect: /\/reach\/suppression(\/|\?|$)/,
    status: 301,
    note: "BL-070-F001 sub-path inheritance",
  },
  // BL-069-F006 + fix-round 1 — /campaigns/new permanent redirect.
  { from: "/campaigns/new", expect: /\/brief\?action=new/, status: 301 },
  // BL-066-F008 — /campaigns/[id] redirect removed (F002 wired the
  // three-section renderer; the prior 302→/match?campaignId=:id stub
  // is no longer needed). Moved to KEPT_PATHS below.
];

test.describe("BL-064 IA refactor redirects (302 default + BL-069 301)", () => {
  for (const locale of LOCALES) {
    test.describe(`locale=${locale}`, () => {
      for (const { from, expect: expectRegex, status, note } of REDIRECT_CASES) {
        const label = `${from} → ${expectRegex} (${status}${note ? `, ${note}` : ""})`;
        test(label, async ({ page }) => {
          // page.goto auto-follows redirects (its `response` is the
          // FINAL 200, not the intermediate 30x). Use APIRequestContext
          // with `maxRedirects: 0` to capture the actual redirect
          // response so we can assert its status code + Location
          // header (BL-069 fix-round 1 B1: spec §F006 requires 301
          // for the /knowledge-base + /campaigns/new family; the rest
          // stays 302 per BL-064 §4 #C revert-flexibility default).
          const apiResponse = await page.context().request.get(
            `/${locale}${from}`,
            { maxRedirects: 0, failOnStatusCode: false },
          );
          expect(
            apiResponse.status(),
            `expected ${status} for /${locale}${from}`,
          ).toBe(status);
          const location = apiResponse.headers()["location"] ?? "";
          expect(
            location,
            `Location header missing or mismatched for /${locale}${from}`,
          ).toMatch(expectRegex);
          expect(location).toContain(`/${locale}/`);

          // Then drive a real browser navigation so we also catch any
          // regression that breaks the post-redirect render. page.goto
          // follows the chain to the new IA path.
          await page.goto(`/${locale}${from}`);
          await page.waitForURL((url) => {
            const path = url.pathname + url.search;
            return new RegExp(`^/${locale}`).test(path) && expectRegex.test(path);
          });
          expect(page.url()).toContain(`/${locale}/`);
        });
      }
    });
  }
});

test.describe("BL-064 — sub-routes intentionally NOT redirected (Adjudication §3 + F005 fix)", () => {
  // /assets, /crm, /kols/[id], /settings, /campaigns (list) stay as
  // deep-link paths. /kols/clxyz789 and /settings may return 404 (no
  // seed record / no page implemented), but the contract here is "URL
  // stays in the legacy area, does NOT 302 to /brief|/match|/reach|/insight".
  const KEPT_PATHS = [
    "/assets",
    "/crm",
    "/kols/clxyz789",
    "/settings",
    // BL-064-F005 fix-round-2 — these stay until later batches wire the
    // new IA shells to render their content (campaigns form / roi /
    // weekly-report / analytics). See src/middleware-helpers.ts for
    // the deferred-to-batch mapping.
    "/campaigns",
    // BL-069-F006 removed /campaigns/new from KEPT_PATHS — it now
    // 302s to /brief?action=new (see REDIRECT_CASES above).
    // BL-066-F008 — /campaigns/[id] previously 302→/match?campaignId=:id
    // under BL-064; F002 wired the three-section renderer back on +
    // F008 removed the redirect rule so users actually land on the new
    // layout. A bogus UUID renders 404 at the same path (notFound()),
    // which satisfies "stays in legacy area".
    "/campaigns/00000000-0000-0000-0000-000000000000",
    "/roi",
    // BL-070-F003 — /weekly-report + /analytics now 301 to /insight
    // (moved to REDIRECT_CASES above); /roi stays kept because the
    // Insight tab layout keeps ROI cards inside the dashboard tab.
    // BL-070-F001 promoted /outreach/{templates,suppression,tracking} to
    // 301 sub-path redirects (moved to REDIRECT_CASES above) — KEPT_PATHS
    // no longer covers them.
  ];
  for (const path of KEPT_PATHS) {
    test(`${path} stays in legacy area (no 302 to new IA)`, async ({ page }) => {
      await page.goto(`/en${path}`);
      const finalUrl = new URL(page.url());
      // Path must remain in the legacy area or fall back to login if
      // the page itself bounces (e.g. data not seeded). Either way, the
      // URL must NOT land on a new-IA top-level path.
      expect(finalUrl.pathname).toMatch(new RegExp(`^/en(${path}|/login|/request-access)`));
      expect(finalUrl.pathname).not.toMatch(/^\/en\/(brief|match|reach|insight)(\/|\?|$)/);
    });
  }
});

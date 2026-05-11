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
const REDIRECT_CASES: Array<{ from: string; expect: RegExp; note?: string }> = [
  // BL-064-F005 fix-round-2 — F002 redirect scope is restricted to
  // content-equivalent sources. Routes whose content lives elsewhere
  // (campaigns form / roi cards / weekly-report) are now kept paths
  // (asserted in the KEPT_PATHS describe below). See
  // src/middleware-helpers.ts IA_REDIRECT_RULES for the canonical
  // contract and the deferred-to-batch mapping.
  { from: "/dashboard", expect: /\/insight(\/|\?|$)/ },
  { from: "/discovery", expect: /\/match(\/|\?|$)/ },
  { from: "/database", expect: /\/match(\/|\?|$)/ },
  { from: "/knowledge-base", expect: /\/brief(\/|\?|$)/ },
  { from: "/outreach", expect: /\/reach(\/|\?|$)/ },
  // /campaigns/[id] — still redirects per adjudication §B; BL-066
  // wires the actual renderer
  {
    from: "/campaigns/abc-123",
    expect: /\/match\?campaignId=abc-123/,
    note: "spec §4 #B",
  },
];

test.describe("BL-064 IA refactor 302 redirects", () => {
  for (const locale of LOCALES) {
    test.describe(`locale=${locale}`, () => {
      for (const { from, expect: expectRegex, note } of REDIRECT_CASES) {
        const label = note ? `${from} → ${expectRegex} (${note})` : `${from} → ${expectRegex}`;
        test(label, async ({ page }) => {
          await page.goto(`/${locale}${from}`);
          // Wait for final landing URL (302 followed by GET on new IA).
          await page.waitForURL((url) => {
            const path = url.pathname + url.search;
            return new RegExp(`^/${locale}`).test(path) && expectRegex.test(path);
          });
          // Locale prefix must survive the redirect.
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
    "/campaigns/new",
    "/roi",
    "/weekly-report",
    "/analytics",
    // BL-064-F006 fix-round-3 — outreach sub-paths kept; /reach has
    // no sub-routes yet (BL-070 will land those).
    "/outreach/templates",
    "/outreach/suppression",
    "/outreach/tracking",
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

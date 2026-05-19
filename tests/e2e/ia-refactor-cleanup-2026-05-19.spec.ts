/**
 * BL-070-F004 · IA refactor cleanup spec — legacy paths now 404.
 *
 * Previously this file (ia-refactor-redirects.spec.ts) asserted that
 * every legacy top-level route 301/302'd to its new IA target. BL-070
 * decision §5 "BL-070 同批即停 redirect" closed the redirect window in
 * F004: the rule list in `src/middleware-helpers.ts` is empty and the
 * legacy directories were git rm'd in the same commit, so the URLs
 * now return 404 outright.
 *
 * What this spec proves:
 *   - LEGACY_404_PATHS — every retired top-level route + sub-path
 *     responds with 404 (no 301/302 to the new IA, no surprise 200).
 *   - NEW_IA_PATHS — the 4 IA top-level routes still respond (200 or
 *     307/login depending on auth state — anything but 404).
 *   - KEPT_PATHS — sub-routes intentionally retained per adjudication
 *     §3 (`/assets`, `/crm`, `/kols/[id]`, `/settings`, `/campaigns`,
 *     `/roi`) stay in the legacy area and never bounce to the new IA.
 */
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/marketer.json" });

const LOCALES = ["en", "zh", "ja", "ko", "es"] as const;

/**
 * Every retired legacy route + the BL-064/BL-069/BL-070 sub-paths
 * that 404 outright now. The middleware no longer issues a redirect
 * for any of these, and the corresponding Next.js page directory is
 * gone, so the App Router surfaces the framework 404.
 *
 * `/campaigns/new` is handled separately below — Next.js routes
 * `/campaigns/new` through the dynamic `[id]` segment (since
 * `/campaigns/new/page.tsx` was deleted in F004) and the UUID guard in
 * `[id]/page.tsx` calls `notFound()`. The wrapping i18n middleware
 * means the visible HTTP status can land as 200 with a not-found body
 * rendered; what F004 actually guarantees is "no redirect to /brief"
 * — asserted in the dedicated describe block below.
 */
const LEGACY_404_PATHS = [
  "/dashboard",
  "/discovery",
  "/database",
  "/reports",
  "/analytics",
  "/weekly-report",
  "/weekly-report/abc-123",
  "/knowledge-base",
  "/knowledge-base/cprod1111111111111111",
  "/knowledge-base/foo/bar",
  "/outreach",
  "/outreach/templates",
  "/outreach/tracking",
  "/outreach/suppression",
  "/emails",
  "/emails/anything",
] as const;

test.describe("BL-070-F004 — retired legacy paths return 404 (no redirect)", () => {
  for (const locale of LOCALES) {
    test.describe(`locale=${locale}`, () => {
      for (const path of LEGACY_404_PATHS) {
        test(`/${locale}${path} → 404`, async ({ page }) => {
          // Disable redirect-following so we observe the actual status
          // the middleware + App Router returns. A successful redirect
          // here would be a regression — the rule list is supposed to
          // be empty.
          const apiResponse = await page.context().request.get(
            `/${locale}${path}`,
            { maxRedirects: 0, failOnStatusCode: false },
          );
          expect(
            apiResponse.status(),
            `expected 404 for /${locale}${path} (rule was supposed to be deleted in BL-070-F004)`,
          ).toBe(404);
        });
      }
    });
  }
});

test.describe("BL-070-F004 — /campaigns/new no longer 301s to /brief (redirect retired)", () => {
  // F004 deleted both /campaigns/new/page.tsx AND the IA redirect rule
  // that used to land the legacy URL on `/brief?action=new`. The dynamic
  // /campaigns/[id]/page.tsx catches the now-orphan path and triggers
  // notFound() via the UUID guard; the i18n middleware wrapping the
  // response may surface that as either a 404 or a 200 with not-found
  // body (rendered by app/not-found.tsx). What we contract here is the
  // negative — no rule re-introduces the /brief redirect.
  for (const locale of LOCALES) {
    test(`/${locale}/campaigns/new does not redirect to /brief`, async ({
      page,
    }) => {
      const apiResponse = await page.context().request.get(
        `/${locale}/campaigns/new`,
        { maxRedirects: 0, failOnStatusCode: false },
      );
      const status = apiResponse.status();
      const location = apiResponse.headers()["location"] ?? "";
      // Acceptable: 200 (notFound page rendered through i18n) or 404
      // (direct framework 404). Not acceptable: 301/302 to /brief.
      expect(
        [200, 404].includes(status),
        `expected 200 or 404 for /${locale}/campaigns/new, got ${status}`,
      ).toBe(true);
      expect(location).not.toContain("/brief");
    });
  }
});

test.describe("BL-070-F004 — new IA top-level routes still respond", () => {
  for (const path of ["/brief", "/match", "/reach", "/insight"]) {
    test(`/en${path} renders (auth'd)`, async ({ page }) => {
      const apiResponse = await page.context().request.get(`/en${path}`, {
        maxRedirects: 0,
        failOnStatusCode: false,
      });
      const status = apiResponse.status();
      expect(
        [200, 302, 307].includes(status),
        `expected 200/302/307 for /en${path}, got ${status}`,
      ).toBe(true);
    });
  }
});

test.describe("BL-064 adjudication §3 — kept sub-routes stay in the legacy area", () => {
  // /assets, /crm, /kols/[id], /settings, /campaigns, /roi keep their
  // own page handlers. They must NOT bounce to a /brief|/match|/reach|
  // /insight top-level path. Some may render 404 (no seed data for the
  // /kols/[id] cuid below), but that still satisfies "stays in the
  // legacy area; does not 302 to the new IA".
  const KEPT_PATHS = [
    "/assets",
    "/crm",
    "/kols/clxyz789",
    "/settings",
    "/campaigns",
    // BL-066-F008 — /campaigns/[id] is a real route again (no redirect).
    // A bogus UUID renders 404 at the same path (notFound()); that
    // still satisfies "stays in legacy area".
    "/campaigns/00000000-0000-0000-0000-000000000000",
    "/roi",
  ];
  for (const path of KEPT_PATHS) {
    test(`${path} stays in legacy area (no bounce to new IA)`, async ({ page }) => {
      await page.goto(`/en${path}`);
      const finalUrl = new URL(page.url());
      expect(finalUrl.pathname).toMatch(
        new RegExp(`^/en(${path}|/login|/request-access)`),
      );
      expect(finalUrl.pathname).not.toMatch(
        /^\/en\/(brief|match|reach|insight)(\/|\?|$)/,
      );
    });
  }
});

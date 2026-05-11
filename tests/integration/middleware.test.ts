/**
 * F007 middleware test — focuses on the pure routing helpers exported
 * from src/middleware.ts. The NextAuth wrapper (`export default auth(...)`)
 * is exercised end-to-end by the F003 E2E landing flow + the upcoming
 * F008 marketer login spec, so this suite only covers the decision logic
 * that lives outside the wrapper:
 *   - PROTECTED_PREFIXES — the canonical list of authed areas
 *   - stripLocale — peels the /en|/zh|/ja|/ko|/es prefix
 *   - isProtected — matches both exact prefixes and nested routes
 *
 * Path "未登录 /dashboard → /login" is the composition of
 *   isProtected(stripLocale('/en/dashboard')) && !req.auth
 * so unit-testing the helpers plus observing the E2E redirect proves the
 * full behaviour without needing to stand up NextAuth in-process.
 */
import { describe, expect, it } from "vitest";

// Pure helpers live in @/middleware-helpers so the test doesn't have to
// boot NextAuth (which needs `next/server` and a runtime env that Vitest
// cannot provide outside a full Next build).
const {
  PROTECTED_PREFIXES,
  isProtected,
  stripLocale,
  detectLocaleFromAcceptLanguage,
  DETECTABLE_LOCALES,
} = await import("@/middleware-helpers");

describe("PROTECTED_PREFIXES", () => {
  it("contains every authed top-level route (B0 legacy + BL-064 new IA) in declared order", () => {
    // Order is significant for review/audit, but not enforced as
    // alphabet-sorted (BL-064-F001 added 4 new-IA paths at the end of the
    // list to keep the diff minimal while the legacy routes are still
    // alive via F002 302-redirects). Once BL-070 removes the legacy
    // paths, this list can be re-sorted.
    expect(PROTECTED_PREFIXES).toEqual([
      "/dashboard",
      "/discovery",
      "/database",
      "/kols",
      "/campaigns",
      "/emails",
      "/knowledge-base",
      "/analytics",
      "/crm",
      "/roi",
      "/weekly-report",
      "/outreach",
      "/settings",
      // BL-064-F001 — Phase 1 4-route IA
      "/brief",
      "/match",
      "/reach",
      "/insight",
    ]);
  });
});

describe("stripLocale", () => {
  it("peels off known locales and leaves the remainder", () => {
    expect(stripLocale("/en/dashboard")).toBe("/dashboard");
    expect(stripLocale("/zh/kols/discover")).toBe("/kols/discover");
    expect(stripLocale("/ja/campaigns/abc")).toBe("/campaigns/abc");
    expect(stripLocale("/ko")).toBe("/");
    expect(stripLocale("/es")).toBe("/");
  });

  it("leaves non-locale prefixes unchanged", () => {
    expect(stripLocale("/login")).toBe("/login");
    expect(stripLocale("/api/auth/session")).toBe("/api/auth/session");
    expect(stripLocale("/dashboard")).toBe("/dashboard");
    expect(stripLocale("/")).toBe("/");
  });

  it("leaves unknown 2-letter prefixes alone (fr, de, ...)", () => {
    expect(stripLocale("/fr/dashboard")).toBe("/fr/dashboard");
  });
});

describe("isProtected", () => {
  it("returns true for protected top-level paths", () => {
    expect(isProtected("/dashboard")).toBe(true);
    expect(isProtected("/kols")).toBe(true);
    expect(isProtected("/campaigns")).toBe(true);
    expect(isProtected("/emails")).toBe(true);
    expect(isProtected("/settings")).toBe(true);
  });

  it("returns true for nested protected routes", () => {
    expect(isProtected("/kols/discover")).toBe(true);
    expect(isProtected("/campaigns/abc-123")).toBe(true);
    expect(isProtected("/settings/team/members")).toBe(true);
  });

  it("returns false for the login + marketing routes", () => {
    expect(isProtected("/login")).toBe(false);
    expect(isProtected("/")).toBe(false);
  });

  it("does not treat similar prefixes as protected (e.g. /dashboarding)", () => {
    expect(isProtected("/dashboarding")).toBe(false);
    expect(isProtected("/kolsmith")).toBe(false);
  });
});

describe("dashboard gate — composed decision", () => {
  it("detects unauthenticated /dashboard as redirect-to-login case", () => {
    const bare = stripLocale("/en/dashboard");
    const authed = false;
    // Middleware flow: `isProtected(bare) && !authed` → redirect('/login').
    expect(isProtected(bare) && !authed).toBe(true);
  });

  it("lets an authenticated user stay on /dashboard", () => {
    const bare = stripLocale("/en/dashboard");
    const authed = true;
    expect(isProtected(bare) && !authed).toBe(false);
  });
});

describe("detectLocaleFromAcceptLanguage (BM1-F008)", () => {
  it("exposes the en/zh allowlist (ja/ko/es stay manual-only)", () => {
    expect([...DETECTABLE_LOCALES]).toEqual(["zh", "en"]);
  });

  it("picks zh for zh-CN header", () => {
    expect(detectLocaleFromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("zh");
  });

  it("picks en for en-US header", () => {
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("honors q-weights even when an allowlist locale is listed later", () => {
    // fr is highest but not allowlisted; zh wins because q > en's q.
    expect(
      detectLocaleFromAcceptLanguage("fr-FR;q=0.9,zh-CN;q=0.8,en;q=0.6")
    ).toBe("zh");
  });

  it("falls back to en when Accept-Language lists only non-allowlisted locales", () => {
    // ja/ko/es are declared locales but auto-detection funnels unseeded
    // users to en until those translations land.
    expect(detectLocaleFromAcceptLanguage("ja-JP,ja;q=0.9")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("ko-KR,ko;q=0.9")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("es-ES,es;q=0.9")).toBe("en");
  });

  it("falls back to en for missing / empty / malformed headers", () => {
    expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
    expect(detectLocaleFromAcceptLanguage(undefined)).toBe("en");
    expect(detectLocaleFromAcceptLanguage("")).toBe("en");
    expect(detectLocaleFromAcceptLanguage(",,,")).toBe("en");
  });

  it("treats a broken q-value as q=1 without throwing", () => {
    // Defensive: a malformed client header must not 500 the middleware.
    expect(detectLocaleFromAcceptLanguage("zh;q=notanumber")).toBe("zh");
  });

  it("collapses regional variants to the base tag before matching", () => {
    expect(detectLocaleFromAcceptLanguage("zh-TW")).toBe("zh");
    expect(detectLocaleFromAcceptLanguage("en-GB")).toBe("en");
  });

  it("breaks q-ties by header order", () => {
    // en and zh both q=1 (implicit) — first entry wins.
    expect(detectLocaleFromAcceptLanguage("en-US,zh-CN")).toBe("en");
    expect(detectLocaleFromAcceptLanguage("zh-CN,en-US")).toBe("zh");
  });
});

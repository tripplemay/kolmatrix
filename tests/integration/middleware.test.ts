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
const { PROTECTED_PREFIXES, isProtected, stripLocale } = await import("@/middleware-helpers");

describe("PROTECTED_PREFIXES", () => {
  it("contains every authed top-level route in B0 + is alphabet-stable", () => {
    expect(PROTECTED_PREFIXES).toEqual([
      "/dashboard",
      "/kols",
      "/campaigns",
      "/emails",
      "/products",
      "/analytics",
      "/settings",
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

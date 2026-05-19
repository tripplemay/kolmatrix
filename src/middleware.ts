import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isLocale, LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";
import {
  detectLocaleFromAcceptLanguage,
  isProtected,
  resolveIaRefactorRedirect,
  stripLocale,
} from "@/middleware-helpers";

const handleI18nRouting = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

/**
 * BM1-F008: resolve the locale to use for a redirect (to /login or
 * /insight) when we would otherwise hand off to next-intl and risk
 * auto-detecting a non-allowlisted locale (e.g. ja/ko/es rendering
 * English stubs). Precedence, most specific first:
 *   1. Locale prefix already present in the current URL
 *   2. NEXT_LOCALE cookie (explicit user choice from the topbar)
 *   3. Accept-Language header, clamped to the en/zh allowlist
 */
function resolveTargetLocale(req: NextRequest): string {
  const match = req.nextUrl.pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (match && isLocale(match[1])) return match[1]!;
  const cookieLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  return detectLocaleFromAcceptLanguage(req.headers.get("accept-language"));
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // BM2-F010 anonymous shared-report route: skip auth + skip i18n
  // (next-intl would otherwise prefix the path with a locale and 404).
  // The page itself sets <meta robots noindex>.
  if (pathname.startsWith("/shared/")) {
    return NextResponse.next();
  }

  // BM1-F008: root path `/` — detect + redirect to the user's home
  // surface. BL-070-F003 switched the canonical landing from
  // `/dashboard` to `/insight` (dashboard content now lives in the
  // default `?tab=dashboard` view); going straight to /insight avoids
  // the extra 301 hop that the legacy /dashboard redirect would add.
  if (pathname === "/") {
    const locale = resolveTargetLocale(req);
    return NextResponse.redirect(new URL(`/${locale}/insight`, nextUrl));
  }

  const bare = stripLocale(pathname);

  if (isProtected(bare) && !req.auth) {
    // Preserve the user's locale when sending them to /login so the
    // login page renders in the language they were already using (not
    // whatever next-intl's full-list auto-detector would pick).
    const locale = resolveTargetLocale(req);
    return NextResponse.redirect(new URL(`/${locale}/login`, nextUrl));
  }

  if (bare === "/login" && pathname === "/login") {
    // Unprefixed /login — either our login shortcut or an already-logged-in
    // user hitting it directly. Either way, pin the locale before next-intl
    // can auto-detect into a ja/ko/es stub page. BL-070-F003 — landing
    // surface is /insight (dashboard content lives in the default tab).
    if (req.auth) {
      const userLocale = req.auth.user?.locale;
      const locale = isLocale(userLocale) ? userLocale : resolveTargetLocale(req);
      return NextResponse.redirect(new URL(`/${locale}/insight`, nextUrl));
    }
    const locale = resolveTargetLocale(req);
    return NextResponse.redirect(new URL(`/${locale}/login`, nextUrl));
  }

  if (bare === "/login" && req.auth) {
    const userLocale = req.auth.user?.locale;
    const locale = isLocale(userLocale) ? userLocale : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/insight`, nextUrl));
  }

  // IA refactor redirect hook. The rule list was cleared by BL-070-F004
  // (二次清理 per decision §5 — every retired legacy route now 404s
  // outright), so this call is effectively a no-op today, but the hook
  // stays wired so any future Phase 5 batch can re-introduce redirects
  // by appending to IA_REDIRECT_RULES without touching middleware.ts.
  const iaRedirect = resolveIaRefactorRedirect(bare);
  if (iaRedirect) {
    const locale = resolveTargetLocale(req);
    const target = new URL(`/${locale}${iaRedirect.path}`, nextUrl);
    // Preserve any query params the caller had (e.g. ?status=active on
    // /campaigns?status=active). Only set when not already supplied by the
    // redirect target (e.g. ?view=campaigns wins on /campaigns).
    nextUrl.searchParams.forEach((value, key) => {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value);
    });
    return NextResponse.redirect(target, iaRedirect.status);
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

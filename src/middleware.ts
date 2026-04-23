import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isLocale, LOCALE_COOKIE_NAME, routing } from "@/i18n/routing";
import {
  detectLocaleFromAcceptLanguage,
  isProtected,
  stripLocale,
} from "@/middleware-helpers";

const handleI18nRouting = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

/**
 * BM1-F008: resolve the locale to use for a redirect (to /login or
 * /dashboard) when we would otherwise hand off to next-intl and risk
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

  // BM1-F008: root path `/` — detect + redirect to /{locale}/dashboard.
  if (pathname === "/") {
    const locale = resolveTargetLocale(req);
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
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
    // can auto-detect into a ja/ko/es stub page.
    if (req.auth) {
      const userLocale = req.auth.user?.locale;
      const locale = isLocale(userLocale) ? userLocale : resolveTargetLocale(req);
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
    }
    const locale = resolveTargetLocale(req);
    return NextResponse.redirect(new URL(`/${locale}/login`, nextUrl));
  }

  if (bare === "/login" && req.auth) {
    const userLocale = req.auth.user?.locale;
    const locale = isLocale(userLocale) ? userLocale : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

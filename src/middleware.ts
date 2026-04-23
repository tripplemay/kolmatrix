import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
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

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // BM1-F008: root path `/` — cookie takes precedence over
  // Accept-Language (respects a user's manual language switch from the
  // topbar); falls back to Accept-Language detection across the
  // en/zh allowlist. ja/ko/es are still reachable via the sidebar
  // language switcher and direct URL, just not auto-detected until
  // they have professional translations.
  if (pathname === "/") {
    const cookieLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
    const locale = isLocale(cookieLocale)
      ? cookieLocale
      : detectLocaleFromAcceptLanguage(req.headers.get("accept-language"));
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
  }

  const bare = stripLocale(pathname);

  if (isProtected(bare) && !req.auth) {
    return NextResponse.redirect(new URL("/login", nextUrl));
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

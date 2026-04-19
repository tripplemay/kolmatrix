import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isLocale, routing } from "@/i18n/routing";
import { isProtected, stripLocale } from "@/middleware-helpers";

const handleI18nRouting = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const bare = stripLocale(pathname);

  if (isProtected(bare) && !req.auth) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (bare === "/login" && req.auth) {
    const userLocale = req.auth.user?.locale;
    const locale = isLocale(userLocale) ? userLocale : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
  }

  if (pathname.startsWith("/login") || pathname === "/") {
    return NextResponse.next();
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

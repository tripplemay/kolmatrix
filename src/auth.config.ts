/**
 * Edge-compatible NextAuth config slice.
 *
 * Runs in the middleware (edge runtime), so it must NOT import anything
 * that needs Node APIs — no Prisma client, no bcrypt. Those live in
 * src/auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/kols",
  "/campaigns",
  "/email",
  "/analytics",
  "/settings",
];

const isProtectedPath = (pathname: string) =>
  PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);

      if (pathname === "/login") {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      if (isProtectedPath(pathname)) {
        return isLoggedIn;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.userId = user.id;
        token.role = user.role;
        token.locale = user.locale;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = (token.userId as string) ?? session.user.id;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.locale = token.locale as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

/**
 * Edge-compatible NextAuth config slice.
 *
 * Runs in the middleware (edge runtime), so it must NOT import anything
 * that needs Node APIs — no Prisma client, no bcrypt. Those live in
 * src/auth.ts.
 *
 * NOTE (F006): route protection + locale redirect logic lives in
 * src/middleware.ts (needs to coordinate with next-intl routing).
 * The `authorized` callback here is a permissive pass-through; it lets
 * middleware.ts own the decisions.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized() {
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

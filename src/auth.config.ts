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
  // NextAuth v5 refuses to decrypt sessions when the incoming Host
  // doesn't match a trusted origin. In prod, all traffic flows through
  // nginx that sets `Host: kol.guangai.ai` (per `proxy_set_header Host
  // $host` in /etc/nginx/conf.d/kolmatrix.conf). Without `trustHost`,
  // the auth wrapper throws `UntrustedHost`, and its error object ends
  // up in `req.auth` inside middleware — truthy enough to accidentally
  // trip the "authed user on /login → redirect to dashboard" branch.
  // This VPS has a single hostname behind nginx; trusting the header
  // is safe and preferred over hard-coding AUTH_URL.
  trustHost: true,
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

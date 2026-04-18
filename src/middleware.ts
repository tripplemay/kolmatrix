import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Edge-runtime middleware: no Prisma / no bcrypt. The `authorized` callback
// in authConfig decides which paths require a session.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

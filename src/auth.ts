/**
 * NextAuth v5 root config (Node runtime).
 *
 * Exports the handlers, `auth()` server helper, and `signIn`/`signOut`
 * actions used by the app. Credentials provider reuses `withPlatformAdmin`
 * so the email lookup slips past the user_isolation policy (we don't know
 * the tenant yet) without needing a superuser connection.
 */
import bcrypt from "bcrypt";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { withPlatformAdmin } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const user = await withPlatformAdmin((tx) =>
          tx.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              locale: true,
              tenantId: true,
              hashedPassword: true,
            },
          })
        );

        if (!user?.hashedPassword) {
          return null;
        }

        const ok = await bcrypt.compare(password, user.hashedPassword);
        if (!ok) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          role: user.role,
          locale: user.locale,
        };
      },
    }),
  ],
});

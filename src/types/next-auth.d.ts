import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    tenantId: string;
    role: string;
    locale: string;
  }

  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
      locale: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    tenantId?: string;
    role?: string;
    locale?: string;
  }
}

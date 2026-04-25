/**
 * Superuser Prisma client (bypasses RLS).
 *
 * Connects via `DATABASE_ADMIN_URL` (Postgres superuser) so callers
 * can read tenant-scoped tables without a tenant context. The only
 * legitimate caller in app code is the anonymous shared-report route
 * (`/shared/weekly-report/[token]`) per BM2-F010 spec — the request
 * has no session, so RLS would otherwise return 0 rows even for a
 * valid token.
 *
 * Anything that imports this file MUST:
 *   - Pre-validate input (e.g. token regex match) before the query
 *   - Restrict the SELECT to the minimum columns needed (no joins on
 *     other tenant tables — pull tenant snapshot from
 *     `WeeklyReport.summaryJson` instead)
 *   - Never expose this client to user-controlled queries
 *
 * grep -rn 'db-admin' src/ to audit usage.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!adminUrl) {
  throw new Error(
    "DATABASE_ADMIN_URL (or DATABASE_URL fallback) must be set"
  );
}

const globalForAdmin = globalThis as unknown as {
  prismaAdmin?: PrismaClient;
};

export const prismaAdmin =
  globalForAdmin.prismaAdmin ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForAdmin.prismaAdmin = prismaAdmin;
}

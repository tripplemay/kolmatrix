"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { withPlatformAdmin, withTenant } from "@/lib/db";

const schema = z.object({ locale: z.enum(routing.locales) });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateUserLocale(raw: string): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const { locale } = schema.parse({ locale: raw });
  const userId = session.user.id;
  const tenantId = session.user.tenantId;
  const email = session.user.email;

  if (UUID_RE.test(tenantId ?? "") && UUID_RE.test(userId ?? "")) {
    await withTenant(tenantId, (tx) => tx.user.update({ where: { id: userId }, data: { locale } }));
    return;
  }
  // BL-035-F002 (AUTH-H5): legacy fallback used `withPlatformAdmin` to
  // patch user locale when the session's tenantId/userId failed UUID
  // validation. That worked because email is globally unique, but
  // running an everyday locale update through the platform-admin client
  // is an over-privileged shape — a session shape regression elsewhere
  // could let it bleed beyond locale. Resolve the user via the
  // platform-admin read first, then perform the *write* inside the
  // tenant scope (RLS enforced). Anything that can't be resolved to a
  // tenant raises Unauthorized.
  if (email) {
    const resolved = await withPlatformAdmin((tx) =>
      tx.user.findUnique({
        where: { email },
        select: { id: true, tenantId: true },
      }),
    );
    if (!resolved || !UUID_RE.test(resolved.tenantId)) {
      throw new Error("Unauthorized");
    }
    await withTenant(resolved.tenantId, (tx) =>
      tx.user.update({ where: { id: resolved.id }, data: { locale } }),
    );
    return;
  }
  throw new Error("Unauthorized");
}

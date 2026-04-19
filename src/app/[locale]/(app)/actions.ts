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
  if (email) {
    await withPlatformAdmin((tx) => tx.user.update({ where: { email }, data: { locale } }));
    return;
  }
  throw new Error("Unauthorized");
}

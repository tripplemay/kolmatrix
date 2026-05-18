/**
 * BL-024-F005 · /outreach/suppression — KOLs auto-cleared after a hard
 * bounce or complaint.
 *
 * Data source: audit_log row written by the Resend webhook (BL-035-F006)
 * with `action='kol.email_cleared_by_bounce'`. `payload.before.reason`
 * carries the upstream reason; `payload.after.providerMessageId` ties
 * back to the original send.
 *
 * BL-034-F003 RLS already filters by tenant; we still pass tenantId
 * explicitly as defense-in-depth.
 */
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";

import { OutreachTabs } from "../OutreachTabs";

import { SuppressionTable, type SuppressionRow } from "./SuppressionTable";

export const metadata = { title: "Suppression — KOLMatrix" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

interface AuditPayload {
  before?: { reason?: string | null };
  after?: { providerMessageId?: string | null };
}

export default async function SuppressionPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { cursor } = await searchParams;

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect(`/${locale}/login`);

  const t = await getTranslations("outreach.suppression");

  const cursorClause: Prisma.AuditLogWhereInput =
    cursor && /^\d+$/.test(cursor) ? { id: { lt: BigInt(cursor) } } : {};

  const rows = await withTenant(tenantId, async (tx) => {
    return tx.auditLog.findMany({
      where: {
        tenantId,
        action: "kol.email_cleared_by_bounce",
        resourceType: "kol",
        ...cursorClause,
      },
      orderBy: { id: "desc" },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        createdAt: true,
        resourceId: true,
        payload: true,
      },
    });
  });

  const hasMore = rows.length > PAGE_SIZE;
  const visible = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const kolIds = visible
    .map((r) => r.resourceId)
    .filter((id): id is string => Boolean(id));
  const kolDetails = kolIds.length
    ? await withTenant(tenantId, (tx) =>
        tx.kol.findMany({
          where: { id: { in: kolIds } },
          select: {
            id: true,
            displayName: true,
            handle: true,
            platform: true,
          },
        })
      )
    : [];
  const kolById = new Map(kolDetails.map((k) => [k.id, k]));

  const tableRows: SuppressionRow[] = visible.map((row) => {
    const payload = (row.payload ?? {}) as AuditPayload;
    const kol = row.resourceId ? kolById.get(row.resourceId) : undefined;
    return {
      id: row.id.toString(),
      clearedAt: row.createdAt.toISOString(),
      kolName: kol?.displayName ?? "(unknown KOL)",
      kolHandle: kol?.handle ?? null,
      platform: kol?.platform ?? null,
      reason: payload.before?.reason ?? null,
      providerMessageId: payload.after?.providerMessageId ?? null,
    };
  });

  const nextCursor =
    hasMore && visible.length > 0 ? visible[visible.length - 1].id.toString() : null;

  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="outreach-suppression-page"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("title")}
        </h1>
        <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
      </header>
      <OutreachTabs activeTab="suppression" locale={locale} />

      <SuppressionTable
        rows={tableRows}
        nextCursorHref={
          nextCursor
            ? `/${locale}/reach/suppression?${new URLSearchParams({
                cursor: nextCursor,
              }).toString()}`
            : null
        }
        labels={{
          colClearedAt: t("columns.clearedAt"),
          colKol: t("columns.kol"),
          colReason: t("columns.reason"),
          colMessageId: t("columns.messageId"),
          emptyState: t("emptyState"),
          nextPage: t("nextPage"),
        }}
      />
    </div>
  );
}

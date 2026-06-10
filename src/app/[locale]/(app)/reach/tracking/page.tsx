/**
 * BL-024-F004 · /outreach/tracking — list view of EmailLog rows.
 *
 * Reuses the Resend webhook's status writes (BL-035-F006): delivered /
 * bounced / complained / opened / clicked, plus the queued/sent states
 * the send pipeline writes directly. Rows are tenant-scoped via
 * `withTenant` and paginated with the shared cursor helper.
 */
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { isReplyTrackingPending } from "@/lib/email/analytics";
import { createCursorPaginator } from "@/lib/pagination/cursor";

import { OutreachTabs } from "../OutreachTabs";

import { TrackingTable, type TrackingRow } from "./TrackingTable";

export const metadata = { title: "Tracking — KOLMatrix" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const FILTERABLE_STATUSES = [
  "all",
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
] as const;
type StatusFilter = (typeof FILTERABLE_STATUSES)[number];

function isStatusFilter(value: unknown): value is StatusFilter {
  return (FILTERABLE_STATUSES as readonly string[]).includes(value as string);
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; cursor?: string }>;
}

type EmailLogShape = {
  id: string;
  sentAt: Date | null;
  createdAt: Date;
  subject: string;
  status: string;
  toAddress: string;
  openedAt: Date | null;
  repliedAt: Date | null;
  bounceReason: string | null;
  kol: { displayName: string; handle: string; platform: string } | null;
};

export default async function TrackingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { status: rawStatus, cursor } = await searchParams;
  const status: StatusFilter = isStatusFilter(rawStatus) ? rawStatus : "all";

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect(`/${locale}/login`);

  const t = await getTranslations("outreach.tracking");

  const where: Prisma.EmailLogWhereInput =
    status === "all" ? {} : { status };

  const { items, nextCursor, replyTrackingPending } = await withTenant(tenantId, async (tx) => {
    const paginator = createCursorPaginator<EmailLogShape, Prisma.EmailLogWhereInput>({
      model: tx.emailLog as unknown as Parameters<typeof createCursorPaginator>[0]["model"],
      defaultOrderBy: "createdAt",
      defaultLimit: PAGE_SIZE,
      maxLimit: PAGE_SIZE,
    });
    const page = await paginator.query({
      where,
      cursor,
      orderBy: "createdAt",
      direction: "desc",
      limit: PAGE_SIZE,
    });
    // Hydrate KOL relation in a single follow-up findMany — keeps the
    // paginator generic.
    const ids = page.items.map((r) => r.id);
    const [rows, pending] = await Promise.all([
      tx.emailLog.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          sentAt: true,
          createdAt: true,
          subject: true,
          status: true,
          toAddress: true,
          openedAt: true,
          repliedAt: true,
          bounceReason: true,
          kol: {
            select: { displayName: true, handle: true, platform: true },
          },
        },
      }),
      // BL-110-F004 fix-round 1 — all-time reply existence, NOT
      // "this page has no repliedAt". A tenant whose replies sit on a
      // later page would otherwise show a false footnote on page 1.
      isReplyTrackingPending(tx),
    ]);
    // Preserve the cursor-paginator's order.
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as EmailLogShape[];
    return { items: ordered, nextCursor: page.nextCursor, replyTrackingPending: pending };
  });

  const tableRows: TrackingRow[] = items.map((r) => ({
    id: r.id,
    sentAt: r.sentAt ? r.sentAt.toISOString() : r.createdAt.toISOString(),
    kolName: r.kol?.displayName ?? r.toAddress,
    kolHandle: r.kol?.handle ?? null,
    platform: r.kol?.platform ?? null,
    subject: r.subject,
    status: r.status,
    openedAt: r.openedAt ? r.openedAt.toISOString() : null,
    repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
    bounceReason: r.bounceReason,
  }));

  // BL-110-F004 — reply tracking isn't wired (inbound email = B4), so the
  // Replied column is all "—". `replyTrackingPending` (computed above from
  // ALL-TIME reply existence, not this page's rows) drives an honest
  // footnote; it disappears the moment any reply lands anywhere.

  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="outreach-tracking-page"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("title")}
        </h1>
        <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
      </header>
      <OutreachTabs activeTab="tracking" locale={locale} />

      <TrackingTable
        rows={tableRows}
        statusFilter={status}
        replyTrackingPending={replyTrackingPending}
        nextCursorHref={
          nextCursor
            ? `/${locale}/reach/tracking?${new URLSearchParams({
                status,
                cursor: nextCursor,
              }).toString()}`
            : null
        }
        labels={{
          filterAll: t("filter.all"),
          filterQueued: t("filter.queued"),
          filterSent: t("filter.sent"),
          filterDelivered: t("filter.delivered"),
          filterOpened: t("filter.opened"),
          filterClicked: t("filter.clicked"),
          filterBounced: t("filter.bounced"),
          filterComplained: t("filter.complained"),
          colSentAt: t("columns.sentAt"),
          colKol: t("columns.kol"),
          colSubject: t("columns.subject"),
          colStatus: t("columns.status"),
          colOpenedAt: t("columns.openedAt"),
          colRepliedAt: t("columns.repliedAt"),
          colBounceReason: t("columns.bounceReason"),
          emptyState: t("emptyState"),
          nextPage: t("nextPage"),
          replyTrackingNote: t("replyTrackingNote"),
        }}
        basePath={`/${locale}/reach/tracking`}
      />
    </div>
  );
}

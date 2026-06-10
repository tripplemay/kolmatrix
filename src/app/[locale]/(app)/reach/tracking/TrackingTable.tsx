/**
 * BL-024-F004 · Tracking list client component.
 *
 * Pure-render client; the parent server page handles auth, the
 * status-filter pills are rendered as `<Link>`s so navigation goes
 * back through the URL (no client-side state needed). Pagination
 * "Next" likewise renders as a link.
 */
"use client";

import Link from "next/link";

export interface TrackingRow {
  id: string;
  sentAt: string;
  kolName: string;
  kolHandle: string | null;
  platform: string | null;
  subject: string;
  status: string;
  openedAt: string | null;
  repliedAt: string | null;
  bounceReason: string | null;
}

interface TrackingLabels {
  filterAll: string;
  filterQueued: string;
  filterSent: string;
  filterDelivered: string;
  filterOpened: string;
  filterClicked: string;
  filterBounced: string;
  filterComplained: string;
  colSentAt: string;
  colKol: string;
  colSubject: string;
  colStatus: string;
  colOpenedAt: string;
  colRepliedAt: string;
  colBounceReason: string;
  emptyState: string;
  nextPage: string;
  replyTrackingNote: string;
}

interface Props {
  rows: TrackingRow[];
  statusFilter: string;
  nextCursorHref: string | null;
  labels: TrackingLabels;
  basePath: string;
  // BL-110-F004 — true when no visible row has a repliedAt; renders an
  // honest "reply tracking pending (B4)" footnote under the table.
  replyTrackingPending: boolean;
}

const STATUS_OPTIONS = [
  { key: "all", labelKey: "filterAll" },
  { key: "queued", labelKey: "filterQueued" },
  { key: "sent", labelKey: "filterSent" },
  { key: "delivered", labelKey: "filterDelivered" },
  { key: "opened", labelKey: "filterOpened" },
  { key: "clicked", labelKey: "filterClicked" },
  { key: "bounced", labelKey: "filterBounced" },
  { key: "complained", labelKey: "filterComplained" },
] as const;

function statusToTone(status: string): string {
  if (status === "delivered") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "opened" || status === "clicked")
    return "border-cyan/30 bg-cyan/10 text-cyan";
  if (status === "bounced" || status === "complained")
    return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "queued") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-on-surface/15 bg-surface-low/40 text-on-surface-variant";
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

export function TrackingTable({
  rows,
  statusFilter,
  nextCursorHref,
  labels,
  basePath,
  replyTrackingPending,
}: Props) {
  return (
    <div className="flex flex-col gap-4" data-testid="outreach-tracking-table">
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.key;
          const href =
            opt.key === "all" ? basePath : `${basePath}?status=${opt.key}`;
          return (
            <Link
              key={opt.key}
              href={href}
              prefetch={false}
              data-testid={`tracking-filter-${opt.key}`}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-lg bg-surface-high px-3 py-1.5 text-xs font-semibold text-cyan shadow-sm"
                  : "rounded-lg px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface"
              }
            >
              {labels[opt.labelKey as keyof TrackingLabels]}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div
          className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
          data-testid="outreach-tracking-empty"
        >
          <p className="text-sm text-on-surface-variant">{labels.emptyState}</p>
        </div>
      ) : (
        <>
        <div className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-high/30 text-xs uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">{labels.colSentAt}</th>
                <th className="px-4 py-3">{labels.colKol}</th>
                <th className="px-4 py-3">{labels.colSubject}</th>
                <th className="px-4 py-3">{labels.colStatus}</th>
                <th className="px-4 py-3">{labels.colOpenedAt}</th>
                <th className="px-4 py-3">{labels.colRepliedAt}</th>
                <th className="px-4 py-3">{labels.colBounceReason}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-on-surface/5 text-on-surface"
                  data-testid="outreach-tracking-row"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                    {fmt(row.sentAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.kolName}</div>
                    {row.kolHandle ? (
                      <div className="text-xs text-on-surface-variant">
                        {row.platform ? `${row.platform} · ` : ""}
                        {row.kolHandle}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.subject}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusToTone(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                    {fmt(row.openedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                    {fmt(row.repliedAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {row.bounceReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {replyTrackingPending ? (
          <p
            data-testid="outreach-tracking-reply-note"
            className="text-xs text-on-surface-variant/70"
          >
            {labels.replyTrackingNote}
          </p>
        ) : null}
        </>
      )}

      {nextCursorHref ? (
        <div className="flex justify-end">
          <Link
            href={nextCursorHref}
            prefetch={false}
            data-testid="outreach-tracking-next"
            className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant hover:border-cyan/40 hover:text-cyan"
          >
            {labels.nextPage} »
          </Link>
        </div>
      ) : null}
    </div>
  );
}

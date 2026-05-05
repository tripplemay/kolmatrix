/**
 * BL-024-F005 · Suppression list client component.
 *
 * No client-side state — pagination "Next" is a `<Link>`. The empty
 * state surfaces when no hard-bounce / complaint events have fired yet,
 * which is the common case for a fresh tenant.
 */
"use client";

import Link from "next/link";

export interface SuppressionRow {
  id: string;
  clearedAt: string;
  kolName: string;
  kolHandle: string | null;
  platform: string | null;
  reason: string | null;
  providerMessageId: string | null;
}

interface SuppressionLabels {
  colClearedAt: string;
  colKol: string;
  colReason: string;
  colMessageId: string;
  emptyState: string;
  nextPage: string;
}

interface Props {
  rows: SuppressionRow[];
  nextCursorHref: string | null;
  labels: SuppressionLabels;
}

function fmt(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function SuppressionTable({ rows, nextCursorHref, labels }: Props) {
  if (rows.length === 0) {
    return (
      <div
        className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
        data-testid="outreach-suppression-empty"
      >
        <p className="text-sm text-on-surface-variant">{labels.emptyState}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="outreach-suppression-table">
      <div className="glass-panel overflow-hidden rounded-2xl border border-on-surface/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-high/30 text-xs uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-4 py-3">{labels.colClearedAt}</th>
              <th className="px-4 py-3">{labels.colKol}</th>
              <th className="px-4 py-3">{labels.colReason}</th>
              <th className="px-4 py-3">{labels.colMessageId}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-on-surface/5 text-on-surface"
                data-testid="outreach-suppression-row"
              >
                <td className="whitespace-nowrap px-4 py-3 text-xs text-on-surface-variant">
                  {fmt(row.clearedAt)}
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
                <td className="px-4 py-3 text-xs text-on-surface-variant">
                  {row.reason ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-on-surface-variant">
                  {row.providerMessageId ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursorHref ? (
        <div className="flex justify-end">
          <Link
            href={nextCursorHref}
            prefetch={false}
            data-testid="outreach-suppression-next"
            className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-semibold text-on-surface-variant hover:border-cyan/40 hover:text-cyan"
          >
            {labels.nextPage} »
          </Link>
        </div>
      ) : null}
    </div>
  );
}

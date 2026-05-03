"use client";

/**
 * BL-025-F005 / BL-026-F006.D · Detail panel · Used-in tab.
 *
 * Lists references in email_log (own asset.id + the legacy
 * migrated_from_email_template_id alias). BL-026-F006.D upgrade:
 * the row formerly read `Campaign 8a3f2c1d → KOL b9e1...` (UUID
 * 8-char prefixes) and offered no jump-out — now we surface real
 * `campaign.name` + `kol.displayName` from the JOIN'd row, with
 * clickable links to /campaigns/{id} and /kols/{id} so the
 * marketer can pivot directly into the related surface.
 */
import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import type { AssetCard, UsedInSummary } from "@/lib/assets/types";

import { loadUsedInAction } from "../actions";

interface UsedInTabProps {
  asset: AssetCard;
}

export function UsedInTab({ asset }: UsedInTabProps) {
  const locale = useLocale();
  const [summary, setSummary] = useState<UsedInSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await loadUsedInAction(asset.id);
      if (!alive) return;
      if (!r.ok) setError(r.error);
      else setSummary(r.summary);
    })();
    return () => {
      alive = false;
    };
  }, [asset.id]);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }
  if (summary === null) {
    return <p className="text-sm text-on-surface-variant">Loading references…</p>;
  }
  if (summary.total === 0) {
    return <p className="text-sm text-on-surface-variant">Not used yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-on-surface-variant">
        Used <strong className="text-on-surface">{summary.total}</strong> time
        {summary.total === 1 ? "" : "s"} across {Math.min(summary.recent.length, 20)} recent
        sends.
      </p>
      <ul className="flex flex-col gap-2">
        {summary.recent.map((row) => (
          <li
            key={row.resourceId}
            className="border-outline-variant bg-surface-container/40 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs"
          >
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 truncate">
              {row.campaignId ? (
                <Link
                  href={`/${locale}/campaigns/${row.campaignId}`}
                  className="text-cyan/80 hover:text-cyan hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.campaignName ?? "Campaign"}
                </Link>
              ) : (
                <span className="text-on-surface">Direct send</span>
              )}
              {row.kolId ? (
                <>
                  <span className="text-on-surface-variant">→</span>
                  <Link
                    href={`/${locale}/kols/${row.kolId}`}
                    className="text-cyan/80 hover:text-cyan hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.kolName ?? "KOL"}
                  </Link>
                </>
              ) : null}
            </span>
            <span className="text-on-surface-variant whitespace-nowrap">
              {new Date(row.occurredAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

/**
 * BL-025-F005 · Detail panel · Used-in tab.
 *
 * Lists references in email_log (own asset.id + the legacy
 * migrated_from_email_template_id alias). Future surfaces — campaign
 * emails, outreach campaigns — will land in their respective
 * batches and surface here through loadUsedIn extension.
 */
import { useEffect, useState } from "react";

import type { AssetCard, UsedInSummary } from "@/lib/assets/types";

import { loadUsedInAction } from "../actions";

interface UsedInTabProps {
  asset: AssetCard;
}

export function UsedInTab({ asset }: UsedInTabProps) {
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
            className="border-outline-variant bg-surface-container/40 flex items-center justify-between rounded-md border px-3 py-2 text-xs"
          >
            <span className="truncate text-on-surface">
              {row.campaignId ? `Campaign ${row.campaignId.slice(0, 8)}` : "Direct send"}
              {row.kolId ? ` → KOL ${row.kolId.slice(0, 8)}` : null}
            </span>
            <span className="text-on-surface-variant">
              {new Date(row.occurredAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

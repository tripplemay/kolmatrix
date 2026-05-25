/**
 * BL-070-F009 · MatchKolTable dynamic boundary.
 *
 * Lazy-loads the table-view client bundle (table + AddToCampaignDialog
 * + ConfirmDeleteDialog transitive imports). Only the active ?view=
 * branch ends up shipping its chunk to the client. Skeleton matches
 * the table's resting height to prevent CLS.
 */
"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import type { MatchKolTable as MatchKolTableType } from "./MatchKolTable";

type Props = ComponentProps<typeof MatchKolTableType>;

const Impl = dynamic(
  () =>
    import("./MatchKolTable").then((m) => ({ default: m.MatchKolTable })),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel min-h-[520px] w-full animate-pulse rounded-2xl border border-on-surface/5"
        aria-hidden
        data-testid="match-kol-table-loading"
      />
    ),
  },
);

export function MatchKolTableLazy(props: Props) {
  return <Impl {...props} />;
}

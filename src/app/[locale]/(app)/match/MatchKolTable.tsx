/**
 * BL-065-F001 · /match table view (server component).
 *
 * Read-only dense layout for the table view-mode. Mirrors the BM1
 * /database table columns (creator / platform / followers / aiScore /
 * status / lastContact) so marketers used to the old /database keep
 * their muscle memory. Row interactivity (checkbox selection, bulk
 * actions, AddToCampaignDialog) is deliberately deferred to BL-065-F003,
 * where BulkActionBar gets formally moved over with confirmation modals;
 * F001's job is layout only.
 *
 * Date / status / follower labels are pre-formatted server-side and
 * passed in via `rowFormatted` — same pattern as the BM2-F011 lesson
 * (no Intl formatter functions cross the RSC boundary).
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { StatusBadge } from "@/components/common";
import { Table, TBody, TCell, THead, TRow } from "@/components/ui";

import type { MatchKolRow } from "./search";

interface Props {
  rows: MatchKolRow[];
  locale: string;
  rowFormatted: Record<
    string,
    {
      dateLabel: string;
      statusKey: string;
      statusLabel: string;
      followersLabel: string;
    }
  >;
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export async function MatchKolTable({ rows, locale, rowFormatted }: Props) {
  const tTable = await getTranslations("database.table");

  return (
    <div
      className="glass-panel border-on-surface/5 overflow-hidden rounded-2xl border"
      data-testid="match-table-wrapper"
    >
      <Table data-testid="match-table">
        <THead>
          <TRow>
            <TCell as="th">{tTable("creator")}</TCell>
            <TCell as="th">{tTable("platform")}</TCell>
            <TCell as="th" align="right">
              {tTable("followers")}
            </TCell>
            <TCell as="th" align="center">
              {tTable("aiScore")}
            </TCell>
            <TCell as="th">{tTable("status")}</TCell>
            <TCell as="th">{tTable("lastContact")}</TCell>
          </TRow>
        </THead>
        <TBody>
          {rows.map((kol) => {
            const fmt = rowFormatted[kol.id];
            return (
              <TRow
                key={kol.id}
                interactive
                data-testid="match-row"
                data-kol-id={kol.id}
              >
                <TCell>
                  <Link
                    href={`/${locale}/kols/${kol.id}`}
                    className="flex items-center gap-3"
                  >
                    <span className="from-cyan-fixed-dim to-cyan-soft text-on-primary flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-bold">
                      {kol.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={kol.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initialsOf(kol.displayName)
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">
                        {kol.displayName}
                      </span>
                      <span className="text-on-surface-variant block truncate text-xs">
                        @{kol.handle}
                      </span>
                    </span>
                  </Link>
                </TCell>
                <TCell>
                  <span className="bg-surface-high text-on-surface-variant inline-flex items-center rounded px-2 py-0.5 text-[11px] tracking-wide uppercase">
                    {kol.platform}
                  </span>
                </TCell>
                <TCell align="right">
                  <p className="font-bold text-white tabular-nums">
                    {fmt?.followersLabel ?? kol.followerCount}
                  </p>
                </TCell>
                <TCell align="center">
                  {kol.valueScore != null ? (
                    <span className="bg-cyan/10 text-cyan ring-cyan/20 inline-flex h-7 items-center rounded-full px-3 text-xs font-bold ring-1">
                      {kol.valueScore}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </TCell>
                <TCell>
                  <StatusBadge
                    domain="kolRelationship"
                    status={kol.relationshipStatus}
                    label={fmt?.statusLabel ?? kol.relationshipStatus}
                  />
                </TCell>
                <TCell>
                  <span className="text-on-surface-variant text-xs">
                    {fmt?.dateLabel ?? "—"}
                  </span>
                </TCell>
              </TRow>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

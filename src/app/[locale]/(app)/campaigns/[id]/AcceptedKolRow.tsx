/**
 * BL-066-F006 · Single Accepted KOL row (read-only).
 *
 * Replaces the former CampaignKolRow's editable status/fee inputs with
 * plain text — F006 removed the manual contactStatus / kolFee edit
 * surfaces (outreach flow will reintroduce them in a structured way).
 * Adds a source chip column (AI / CSV / Legacy) so marketers can tell
 * where each KOL entered the campaign, and an open_in_new action that
 * deep-links to the KOL profile.
 */
import Image from "next/image";
import Link from "next/link";

import { TCell, TRow } from "@/components/ui";
import type { CampaignKolRow as CampaignKolRowData } from "@/lib/campaigns/detail";

interface Props {
  locale: string;
  row: CampaignKolRowData;
  statusLabels: Record<string, string>;
  sourceChipLabels: {
    ai: string;
    csv: string;
    legacy: string;
  };
  viewProfileLabel: string;
  feeUnsetLabel: string;
}

function avatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatAddedAt(iso: string): string {
  // YYYY-MM-DD slice — locale-agnostic, stable for visual baselines.
  return iso.slice(0, 10);
}

function sourceChipClass(source: string): string {
  if (source === "ai_smart_match")
    return "text-primary-fixed bg-primary-container/15 border-primary-container/30";
  if (source === "csv_import")
    return "text-on-surface bg-surface-container border-outline-variant/40";
  // manual_legacy (and any future unknown via filter would never land here)
  return "text-on-surface-variant bg-surface-container-low border-outline-variant/30";
}

function sourceChipText(
  source: string,
  labels: { ai: string; csv: string; legacy: string }
): string {
  if (source === "ai_smart_match") return labels.ai;
  if (source === "csv_import") return labels.csv;
  return labels.legacy;
}

export function AcceptedKolRow({
  locale,
  row,
  statusLabels,
  sourceChipLabels,
  viewProfileLabel,
  feeUnsetLabel,
}: Props) {
  return (
    <TRow data-testid="accepted-kol-row" data-kol-id={row.kolId}>
      <TCell>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
          >
            {row.avatarUrl ? (
              <Image
                src={row.avatarUrl}
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            ) : (
              avatarInitials(row.displayName)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{row.displayName}</p>
            <p className="truncate text-xs text-on-surface-variant">
              @{row.handle} · {row.platform} · {formatFollowers(row.followerCount)}
            </p>
          </div>
        </div>
      </TCell>
      <TCell>
        <span
          data-testid="accepted-kol-source-chip"
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${sourceChipClass(row.source)}`}
        >
          {sourceChipText(row.source, sourceChipLabels)}
        </span>
      </TCell>
      <TCell>
        <span
          data-testid="accepted-kol-status"
          className="text-sm text-on-surface"
        >
          {statusLabels[row.contactStatus] ?? row.contactStatus}
        </span>
      </TCell>
      <TCell>
        <span data-testid="accepted-kol-fee" className="text-sm text-on-surface">
          {row.kolFee == null ? feeUnsetLabel : row.kolFee.toFixed(2)}
        </span>
      </TCell>
      <TCell>
        <span
          data-testid="accepted-kol-added-at"
          className="text-xs text-on-surface-variant"
        >
          {formatAddedAt(row.addedAt)}
        </span>
      </TCell>
      <TCell align="right">
        <Link
          href={`/${locale}/kols/${row.kolId}`}
          aria-label={viewProfileLabel}
          data-testid="accepted-kol-view-profile"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant/30 text-on-surface-variant transition-colors hover:border-primary-container/40 hover:text-primary-fixed"
        >
          <span className="material-symbols-outlined text-[18px]">
            open_in_new
          </span>
        </Link>
      </TCell>
    </TRow>
  );
}

/**
 * BL-065-F001 · KOL card in the /match workbench card grid.
 *
 * Same visual shape as the legacy /discovery KolResultCard (BL-061-F004
 * engagement-rate tooltip preserved) but typed against MatchKolRow so we
 * no longer cross-import from /discovery. F006 deletes the /discovery
 * folder; this copy is intentional so /match stands alone.
 */
import Image from "next/image";
import { useTranslations } from "next-intl";

import type { MatchKolRow } from "./search";

interface Props {
  kol: MatchKolRow;
}

function initialsOf(name: string): string {
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

export function MatchKolCard({ kol }: Props) {
  const t = useTranslations("match.card");
  const tEngagement = useTranslations("kol.engagementRate");
  const engagementTooltip = tEngagement("tooltip");

  return (
    <div
      className="glass-panel card-glow relative flex h-full flex-col gap-4 rounded-2xl border border-on-surface/5 p-5"
      data-testid="match-kol-card"
      data-kol-id={kol.id}
      data-kol-platform={kol.platform}
    >
      {kol.valueScore != null ? (
        <div
          className="absolute -right-3 -top-3 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-cyan/30 bg-navy-base shadow-[0_0_15px_rgba(0,229,255,0.2)]"
          aria-label={t("scoreLabel")}
        >
          <span className="text-lg font-bold text-cyan">{kol.valueScore}</span>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-sm font-bold text-on-primary">
          {kol.avatarUrl ? (
            // BL-070-F010 — KOL avatar URLs come from heterogeneous platform
            // CDNs (YT now; TikTok/Twitch when adapters ship), so `unoptimized`
            // bypasses the next.config.ts remotePatterns gate without
            // sacrificing the explicit-dimension CLS reservation.
            <Image
              src={kol.avatarUrl}
              alt=""
              width={56}
              height={56}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span aria-hidden>{initialsOf(kol.displayName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {kol.displayName}
          </h3>
          <p className="truncate text-xs text-on-surface-variant">
            @{kol.handle}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
            <span className="font-medium text-slate-300">
              {formatFollowers(kol.followerCount)}
            </span>
            {kol.countryCode ? (
              <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                {kol.countryCode}
              </span>
            ) : null}
            {kol.platform ? (
              <span className="uppercase tracking-wide">{kol.platform}</span>
            ) : null}
          </div>
        </div>
      </div>

      {kol.categories.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {kol.categories.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded border border-cyan-fixed/20 bg-cyan-fixed/10 px-2 py-1 text-[10px] text-cyan-fixed"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant/70">
            {t("followers")}
          </span>
          <span className="text-xs font-medium text-slate-200">
            {formatFollowers(kol.followerCount)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/70">
            <span>{t("engagement")}</span>
            <span
              role="img"
              aria-label={engagementTooltip}
              title={engagementTooltip}
              data-testid="engagement-rate-tooltip"
              className="material-symbols-outlined cursor-help text-[12px] leading-none text-on-surface-variant/60"
            >
              info
            </span>
          </span>
          <span className="text-xs font-medium text-slate-200">
            {kol.engagementRate != null
              ? `${kol.engagementRate.toFixed(1)}%`
              : t("unavailableMetric")}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-on-surface-variant/70">
            {t("scoreLabel")}
          </span>
          <span className="text-xs font-medium text-slate-200">
            {kol.valueScore ?? t("unavailableMetric")}
          </span>
        </div>
      </div>
    </div>
  );
}

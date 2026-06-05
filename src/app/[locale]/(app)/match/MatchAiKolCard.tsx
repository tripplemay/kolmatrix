"use client";

/**
 * BL-084-F006 · KOL card for the AI Match Panel (3-column workbench).
 *
 * Extends the visual language of MatchKolCard with:
 *   - a 0-100 match badge (gradient: ≥70 green / ≥40 cyan / else gray)
 *   - a ≤15-word matchReason chip (truncated)
 *   - mode-aware action buttons:
 *       suggested → Accept / Skip / Swap (+ Why)
 *       accepted  → (read-only here; remove handled in detail flows)
 *       swap      → Re-add
 *   - drag handle (native HTML5 DnD) for suggested ↔ swap moves.
 */
import Image from "next/image";
import { useTranslations } from "next-intl";

export interface PanelCard {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
  countryCode: string | null;
  categories: string[];
  /** 0-100 cosine/match score; null when unknown (legacy accepted rows). */
  matchScore: number | null;
  /** ≤15-word LLM reason (suggested column only); null otherwise. */
  matchReason: string | null;
}

type Mode = "suggested" | "accepted" | "swap";

interface Props {
  card: PanelCard;
  mode: Mode;
  onAccept?: () => void;
  onSkip?: () => void;
  onSwap?: () => void;
  onReAdd?: () => void;
  onRemove?: () => void;
  onWhy?: () => void;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function badgeClasses(score: number): string {
  if (score >= 70) return "border-emerald-400/40 bg-emerald-400/15 text-emerald-300";
  if (score >= 40) return "border-cyan/40 bg-cyan/15 text-cyan";
  return "border-white/15 bg-white/5 text-on-surface-variant";
}

export function MatchAiKolCard({
  card,
  mode,
  onAccept,
  onSkip,
  onSwap,
  onReAdd,
  onRemove,
  onWhy,
}: Props) {
  const t = useTranslations("match.aiPanel");
  const draggable = mode === "suggested" || mode === "swap";

  return (
    <div
      data-testid="match-ai-kol-card"
      data-kol-id={card.id}
      data-mode={mode}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData("text/kol-id", card.id);
              e.dataTransfer.setData("text/from", mode);
            }
          : undefined
      }
      className="glass-panel relative flex flex-col gap-3 rounded-xl border border-on-surface/5 p-4"
    >
      {/* Match badge */}
      {card.matchScore != null ? (
        <span
          data-testid="match-badge"
          data-score={card.matchScore}
          className={`absolute right-3 top-3 rounded-full border px-2 py-0.5 text-xs font-bold ${badgeClasses(card.matchScore)}`}
          aria-label={t("matchScoreBadge", { score: card.matchScore })}
        >
          {card.matchScore}
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary">
          {card.avatarUrl ? (
            <Image
              src={card.avatarUrl}
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span aria-hidden>{initialsOf(card.displayName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <h4 className="truncate text-sm font-semibold text-white">
            {card.displayName}
          </h4>
          <p className="truncate text-xs text-on-surface-variant">
            @{card.handle}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-on-surface-variant">
            <span className="font-medium text-slate-300">
              {formatFollowers(card.followerCount)}
            </span>
            {card.countryCode ? (
              <span className="rounded bg-surface-high px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                {card.countryCode}
              </span>
            ) : null}
            <span className="uppercase tracking-wide">{card.platform}</span>
          </div>
        </div>
      </div>

      {/* Match reason chip */}
      {card.matchReason ? (
        <p
          data-testid="match-reason-chip"
          title={card.matchReason}
          className="line-clamp-2 rounded-lg border border-cyan-fixed/15 bg-cyan-fixed/5 px-2.5 py-1.5 text-[11px] text-cyan-fixed"
        >
          {card.matchReason}
        </p>
      ) : null}

      {/* Actions */}
      {mode === "suggested" ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            data-testid="accept-button"
            className="flex-1 rounded-lg bg-cyan px-2 py-1.5 text-xs font-semibold text-navy-base"
          >
            {t("acceptButton")}
          </button>
          <button
            type="button"
            onClick={onSkip}
            data-testid="skip-button"
            className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-on-surface-variant"
          >
            {t("skipButton")}
          </button>
          <button
            type="button"
            onClick={onSwap}
            data-testid="swap-button"
            className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-on-surface-variant"
          >
            {t("swapButton")}
          </button>
          {onWhy ? (
            <button
              type="button"
              onClick={onWhy}
              data-testid="why-button"
              aria-label={t("whyButton")}
              className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-on-surface-variant"
            >
              ?
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "accepted" && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          data-testid="remove-button"
          className="rounded-lg border border-white/15 px-2 py-1.5 text-xs text-on-surface-variant"
        >
          {t("removeButton")}
        </button>
      ) : null}

      {mode === "swap" ? (
        <button
          type="button"
          onClick={onReAdd}
          data-testid="readd-button"
          className="rounded-lg border border-cyan/30 px-2 py-1.5 text-xs font-medium text-cyan"
        >
          {t("reAddButton")}
        </button>
      ) : null}
    </div>
  );
}

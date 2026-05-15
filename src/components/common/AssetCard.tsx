"use client";

/**
 * BL-025-F004 / BL-026-F006 · `<AssetCard>` — grid card for the
 * /assets listing.
 *
 * Renders the metadata strip the spec calls for (type chip + AI
 * badge + variant index + used count + status dot) in a layout that
 * matches design-draft/BL-025-asset-library/variant-a-296k. Hover
 * surfaces a quick-action overlay so the marketer can act without
 * opening the detail panel.
 *
 * BL-026-F006 information layout updates:
 *   - Title strips trailing ` v\d+` so "Acme — Email v1" renders as
 *     "Acme — Email" (variant info already lives in the footer).
 *   - Subtitle drops the product name and surfaces only relative
 *     time — the product becomes a cyan link in the footer that
 *     filters the listing by productId.
 *   - Status: StatusDot pairs with an uppercase status text label
 *     so colour-blind marketers don't rely solely on the dot tint.
 *   - AI badge: `purple` tone instead of `cyan` to disambiguate
 *     from the email type chip.
 *
 * Selected state is parent-driven (parent owns which asset is
 * highlighted). Outer wrapper is a `<div>` with role="button" so
 * the footer can host a real cyan link without the HTML invalidity
 * of nesting interactive elements inside a `<button>`.
 */
import type { AssetCard as AssetCardData, AssetStatus } from "@/lib/assets/types";
import { cn } from "@/lib/utils";

import { StatusDot } from "./StatusDot";
import { TagChip } from "./TagChip";

// BL-067-F002 added 2 explanation AssetTypes that are internal cache rows
// (Asset.name encodes the campaignId/kolId/locale cache key — never shown
// via this user-facing AssetCard). Labels/icons exist only to satisfy the
// exhaustive `Record<AssetCardData["type"], ...>` contract; if a row of
// these types ever leaks into the card list, the UI shows the placeholder
// label so the issue is visible rather than crashing.
const TYPE_LABEL: Record<AssetCardData["type"], string> = {
  email: "Email",
  video_script: "Video",
  ai_recommendation_explanation_short: "Recommendation (short)",
  ai_recommendation_explanation_detailed: "Recommendation (detailed)",
};

const TYPE_ICON: Record<AssetCardData["type"], string> = {
  email: "mail",
  video_script: "movie",
  ai_recommendation_explanation_short: "psychology",
  ai_recommendation_explanation_detailed: "psychology",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export type AssetCardQuickAction = "edit" | "duplicate" | "archive" | "delete";

interface AssetCardProps {
  asset: AssetCardData;
  isSelected: boolean;
  onSelect: () => void;
  onQuickAction?: (action: AssetCardQuickAction) => void;
  /** BL-026-F006 — optional product-link callback. When set, the
   * footer renders the product name as a cyan link that filters
   * the listing to this product (parent typically wires this to
   * `update({ productId })`). When absent, the product name shows
   * as plain text. */
  onProductClick?: (productId: string) => void;
  /** Disable hover quick-action overlay while a duplicate / archive /
   * delete server action is in flight against this card. */
  pending?: boolean;
  /** BL-026-F004 — system_seed cards (and other tenant-immutable
   * sources) only allow Duplicate. Edit / Archive / Delete are
   * filtered from the hover overlay so the marketer can't try a
   * server action that would 403. */
  readOnly?: boolean;
  className?: string;
}

const QUICK_ACTIONS: ReadonlyArray<{ id: AssetCardQuickAction; icon: string; label: string }> = [
  { id: "edit", icon: "edit", label: "Edit" },
  { id: "duplicate", icon: "file_copy", label: "Duplicate" },
  { id: "archive", icon: "archive", label: "Archive" },
  { id: "delete", icon: "delete", label: "Delete" },
];

function relativeTime(date: Date): string {
  const now = Date.now();
  const ms = now - date.getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function stripTrailingVersion(name: string): string {
  return name.replace(/\s+v\d+$/i, "");
}

export function AssetCard({
  asset,
  isSelected,
  onSelect,
  onQuickAction,
  onProductClick,
  pending,
  readOnly,
  className,
}: AssetCardProps) {
  const updatedAt = asset.updatedAt instanceof Date ? asset.updatedAt : new Date(asset.updatedAt);
  const visibleQuickActions = readOnly
    ? QUICK_ACTIONS.filter((a) => a.id === "duplicate")
    : QUICK_ACTIONS;
  const titleClean = stripTrailingVersion(asset.name);

  function handleCardClick() {
    onSelect();
  }
  function handleCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div className={cn("group relative", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        aria-pressed={isSelected}
        aria-label={asset.name}
        className={cn(
          "flex w-full cursor-pointer flex-col gap-3 rounded-2xl border p-5 text-left transition-all",
          "border-outline-variant bg-surface-container/40",
          "hover:border-cyan/30 hover:bg-surface-container",
          "focus-visible:ring-cyan/40 focus-visible:ring-2 focus-visible:outline-none",
          isSelected && "ring-cyan border-cyan/60 bg-surface-container ring-2"
        )}
      >
        {/* Header: type chip + AI badge */}
        <div className="flex items-center justify-between">
          <TagChip
            label={TYPE_LABEL[asset.type]}
            tone={asset.type === "email" ? "cyan" : "purple"}
            size="sm"
            icon={
              <span className="material-symbols-outlined text-[14px]" aria-hidden>
                {TYPE_ICON[asset.type]}
              </span>
            }
          />
          {asset.source === "ai_generated" ? (
            <TagChip label="AI" tone="purple" size="xs" />
          ) : null}
        </div>

        {/* Title (trailing v\d+ stripped) + relative time only */}
        <h3 className="text-on-surface line-clamp-2 text-sm font-semibold">{titleClean}</h3>
        <p className="text-on-surface-variant text-xs">{relativeTime(updatedAt)}</p>

        {/* Content preview */}
        {asset.contentPreview ? (
          <p className="text-on-surface-variant/70 line-clamp-3 font-mono text-xs">
            {asset.contentPreview}
          </p>
        ) : null}

        {/* Footer metadata: product link · variant · status */}
        <div className="border-outline-variant/60 text-on-surface-variant flex items-center gap-3 border-t pt-3 text-[11px]">
          {asset.productName && asset.productId && onProductClick ? (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                if (asset.productId) onProductClick(asset.productId);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (asset.productId) onProductClick(asset.productId);
                }
              }}
              title={asset.productName}
              className={cn(
                "text-cyan/80 cursor-pointer truncate",
                "hover:text-cyan hover:underline",
                "focus-visible:ring-cyan/40 focus-visible:ring-2 focus-visible:outline-none"
              )}
            >
              {asset.productName}
            </span>
          ) : asset.productName ? (
            <span className="truncate" title={asset.productName}>
              {asset.productName}
            </span>
          ) : (
            <span className="text-on-surface-variant/50">No product</span>
          )}
          <span className="ml-auto whitespace-nowrap">
            v{asset.versionIndex} of {asset.totalVariants}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <StatusDot status={asset.status} />
            <span className="text-[10px] font-medium uppercase tracking-wide">
              {STATUS_LABEL[asset.status]}
            </span>
          </span>
        </div>
      </div>

      {/* Hover quick actions overlay (rendered outside the card div so
          it doesn't trigger the parent click). */}
      {onQuickAction ? (
        <div
          className={cn(
            "pointer-events-none absolute top-3 right-3 flex gap-1.5 opacity-0 transition-opacity",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "focus-within:pointer-events-auto focus-within:opacity-100"
          )}
        >
          {visibleQuickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              aria-label={action.label}
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                if (pending) return;
                onQuickAction(action.id);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur",
                "border-outline-variant bg-surface-container/80 text-on-surface-variant",
                "hover:border-cyan/40 hover:bg-cyan/10 hover:text-cyan",
                "focus-visible:ring-cyan/40 focus-visible:ring-2 focus-visible:outline-none",
                pending && "cursor-wait opacity-60"
              )}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                {action.icon}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

AssetCard.relativeTime = relativeTime;
AssetCard.stripTrailingVersion = stripTrailingVersion;

"use client";

/**
 * BL-025-F004 · `<AssetCard>` — grid card for the /assets listing.
 *
 * Renders the metadata strip the spec calls for (type chip + AI
 * badge + variant index + used count + status dot) in a layout that
 * matches design-draft/BL-025-asset-library/variant-a-296k. Hover
 * surfaces a quick-action overlay with 4 buttons (edit / duplicate /
 * archive / delete) so the user can act without opening the detail
 * panel.
 *
 * Selected state is parent-driven (parent owns which asset is
 * highlighted). The card is itself a `<button>` so keyboard / screen
 * reader users get the same affordance as mouse — enter activates,
 * focus ring is the cyan-glow standard.
 */
import type { AssetCard as AssetCardData } from "@/lib/assets/types";
import { cn } from "@/lib/utils";

import { TagChip } from "./TagChip";
import { StatusDot } from "./StatusDot";

const TYPE_LABEL: Record<AssetCardData["type"], string> = {
  email: "Email",
  video_script: "Video",
};

const TYPE_ICON: Record<AssetCardData["type"], string> = {
  email: "mail",
  video_script: "movie",
};

export type AssetCardQuickAction = "edit" | "duplicate" | "archive" | "delete";

interface AssetCardProps {
  asset: AssetCardData;
  isSelected: boolean;
  onSelect: () => void;
  onQuickAction?: (action: AssetCardQuickAction) => void;
  /** Disable hover quick-action overlay while a duplicate / archive /
   * delete server action is in flight against this card. */
  pending?: boolean;
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

export function AssetCard({
  asset,
  isSelected,
  onSelect,
  onQuickAction,
  pending,
  className,
}: AssetCardProps) {
  const updatedAt = asset.updatedAt instanceof Date ? asset.updatedAt : new Date(asset.updatedAt);

  return (
    <div className={cn("group relative", className)}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        className={cn(
          "flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition-all",
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
          {asset.source === "ai_generated" ? <TagChip label="AI" tone="cyan" size="xs" /> : null}
        </div>

        {/* Title + product · time */}
        <h3 className="text-on-surface line-clamp-2 text-sm font-semibold">{asset.name}</h3>
        <p className="text-on-surface-variant text-xs">
          {asset.productName ?? "No product"} · {relativeTime(updatedAt)}
        </p>

        {/* Content preview */}
        {asset.contentPreview ? (
          <p className="text-on-surface-variant/70 line-clamp-3 font-mono text-xs">
            {asset.contentPreview}
          </p>
        ) : null}

        {/* Footer metadata */}
        <div className="border-outline-variant/60 text-on-surface-variant flex items-center justify-between border-t pt-3 text-[11px]">
          <span>
            v{asset.versionIndex} of {asset.totalVariants}
          </span>
          <StatusDot status={asset.status} />
        </div>
      </button>

      {/* Hover quick actions overlay (rendered outside the main button so
          it doesn't trigger the parent click). */}
      {onQuickAction ? (
        <div
          className={cn(
            "pointer-events-none absolute top-3 right-3 flex gap-1.5 opacity-0 transition-opacity",
            "group-hover:pointer-events-auto group-hover:opacity-100",
            "focus-within:pointer-events-auto focus-within:opacity-100"
          )}
        >
          {QUICK_ACTIONS.map((action) => (
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

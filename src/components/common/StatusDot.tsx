/**
 * BL-025-F004 · `<StatusDot>` — small coloured dot for compact status surfaces.
 *
 * StatusBadge is the project's existing pill (with a label); StatusDot
 * is the icon-only variant used inside AssetCard footers where the
 * label would steal too much room. Domain is intentionally narrow
 * (`AssetStatus`) — extend with discriminated unions if other
 * surfaces need their own enum mapping.
 */
import type { AssetStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

const TONE_MAP: Record<AssetStatus, string> = {
  draft: "bg-amber-400",
  published: "bg-emerald-400",
  archived: "bg-on-surface-variant",
};

const LABEL_MAP: Record<AssetStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

interface StatusDotProps {
  status: AssetStatus;
  /** Override the tooltip text; defaults to LABEL_MAP entry. */
  ariaLabel?: string;
  className?: string;
}

export function StatusDot({ status, ariaLabel, className }: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? LABEL_MAP[status]}
      title={ariaLabel ?? LABEL_MAP[status]}
      className={cn("inline-block h-2 w-2 rounded-full", TONE_MAP[status], className)}
    />
  );
}

StatusDot.LABELS = LABEL_MAP;

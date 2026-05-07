/**
 * BL-021-F001 · `<Skeleton>` primitive.
 *
 * Generic loading placeholder used by `loading.tsx` route boundaries
 * and component-level pending states. Matches existing inline pattern
 * (`animate-pulse rounded-2xl border border-outline-variant
 * bg-surface-container/30`) used in 5+ places (assets / charts / etc.).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-2xl border border-outline-variant bg-surface-container/30",
        className,
      )}
      {...props}
    />
  );
}

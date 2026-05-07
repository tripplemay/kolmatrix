/**
 * BL-052 F008 · /campaigns route Suspense fallback.
 *
 * Distinct from existing campaigns/[id]/loading.tsx — this fires when
 * the list page itself streams. Mirrors the page layout: header + KPI
 * strip + filter bar + campaign list rows.
 */
import { Skeleton } from "@/components/ui";

export default function CampaignsLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="campaigns-loading"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

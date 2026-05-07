/**
 * BL-052 F008 · /crm route Suspense fallback.
 *
 * Mirrors the page layout: header + KPI strip + funnel + pipeline bars
 * + recent changes feed.
 */
import { Skeleton } from "@/components/ui";

export default function CrmLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="crm-loading"
    >
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

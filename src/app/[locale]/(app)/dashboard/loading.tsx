/**
 * BL-021-F001 · /dashboard route Suspense fallback.
 *
 * Mirrors the page layout (greeting + KPI strip + workflow + KPI grid +
 * quick actions + 2/3 grid w/ aside) at coarse granularity to keep
 * perceived first-paint near the real page height (no layout shift).
 */
import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-8" data-testid="dashboard-loading">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Skeleton className="h-72" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-72" />
        </aside>
      </div>
    </div>
  );
}

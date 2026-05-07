/**
 * BL-052 F008 · /database route Suspense fallback.
 *
 * Mirrors the page layout: header + filter bar + bulk action bar +
 * full-width KOL grid table + insights panel.
 */
import { Skeleton } from "@/components/ui";

export default function DatabaseLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="database-loading"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </header>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

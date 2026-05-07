/**
 * BL-021-F001 · /discovery route Suspense fallback.
 *
 * Mirrors the page layout (header + search bar + sidebar/results 2-col
 * grid with KOL card grid) so the skeleton matches roughly the real
 * page height and column structure.
 */
import { Skeleton } from "@/components/ui";

export default function DiscoveryLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="discovery-loading"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </header>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Skeleton className="h-[600px]" />
        <section className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

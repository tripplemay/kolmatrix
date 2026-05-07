/**
 * BL-021-F001 · /roi route Suspense fallback.
 *
 * Mirrors layout: header + 4-card KPI strip + 60/40 trend+insights
 * split + full-width campaign table.
 */
import { Skeleton } from "@/components/ui";

export default function RoiLoading() {
  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="roi-loading"
    >
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        <div className="lg:col-span-6">
          <Skeleton className="h-[320px]" />
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-[320px]" />
        </div>
      </section>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

/**
 * BL-021-F001 · /weekly-report route Suspense fallback.
 *
 * Mirrors layout: header + brand header + 60/40 main+insights split
 * + footer.
 */
import { Skeleton } from "@/components/ui";

export default function WeeklyReportLoading() {
  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="weekly-report-loading"
    >
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        <div className="space-y-4 lg:col-span-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-[480px]" />
        </div>
      </section>
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

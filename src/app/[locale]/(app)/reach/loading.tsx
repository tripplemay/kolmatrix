/**
 * BL-052 F008 · /outreach route Suspense fallback.
 *
 * Mirrors the page layout: header + tab strip + composer (full-width
 * top) + 2-col split (recent replies / recently sent table) + bottom
 * 2-col split (sending performance chart / top templates).
 */
import { Skeleton } from "@/components/ui";

export default function OutreachLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="outreach-loading"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </header>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-72 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

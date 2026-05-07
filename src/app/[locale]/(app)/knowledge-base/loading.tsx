/**
 * BL-052 F008 · /knowledge-base route Suspense fallback.
 *
 * Mirrors the page layout: header + filter row + 3-col responsive
 * ProductCard grid. Reuses the global <Skeleton> primitive.
 */
import { Skeleton } from "@/components/ui";

export default function KnowledgeBaseLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] space-y-6 pb-16"
      data-testid="knowledge-base-loading"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </header>
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}

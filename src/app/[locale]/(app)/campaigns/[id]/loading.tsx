/**
 * BL-021-F001 · /campaigns/[id] route Suspense fallback.
 *
 * Mirrors the detail layout (breadcrumb + main column with header /
 * KOL panel / chart / 2-col revenue+status / outreach + 320px right
 * rail with 3 insights cards).
 */
import { Skeleton } from "@/components/ui";

export default function CampaignDetailLoading() {
  return (
    <div
      className="mx-auto max-w-[1600px] pb-16"
      data-testid="campaign-detail-loading"
    >
      <Skeleton className="h-4 w-48" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="flex min-w-0 flex-col gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-96" />
          <Skeleton className="h-56" />
          <section className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </section>
          <Skeleton className="h-24" />
        </main>
        <aside className="flex flex-col gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-72" />
        </aside>
      </div>
    </div>
  );
}

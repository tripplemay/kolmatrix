import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { loadAssetsForListing } from "@/lib/assets/queries";
import { readAssetFiltersFromQuery, toAssetFilter, type AssetUrlState } from "./filter-shape";

import { AssetsClient } from "./AssetsClient";

export const metadata = { title: "Assets — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AssetsPage({ params, searchParams }: Props) {
  await params;
  const sp = await searchParams;

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  // Reuse the same parser the client hook uses so deep-link state
  // hydrates identically on the server. The sp shape is what Next.js
  // hands us; we adapt to URLSearchParams so the parser is shared.
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) {
      if (value[0] != null) url.set(key, value[0]);
    } else if (value != null) {
      url.set(key, value);
    }
  }
  const initialState: AssetUrlState = readAssetFiltersFromQuery(url);
  const filter = toAssetFilter(initialState);

  const [listing, products] = await Promise.all([
    withTenant(tenantId, (tx) =>
      loadAssetsForListing(tx, filter, { sort: initialState.sort, limit: 24 })
    ),
    withTenant(tenantId, (tx) =>
      tx.product.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    ),
  ]);

  return <AssetsClient initialListing={listing} products={products} initialState={initialState} />;
}

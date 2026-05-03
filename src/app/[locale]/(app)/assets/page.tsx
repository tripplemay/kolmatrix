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

  // BL-026-F004 — welcome mode kicks in when the tenant has zero
  // user-owned assets (user_created + ai_generated). The system_seed
  // grid then doubles as an empty-state walkthrough: marketers can
  // browse / Save-to-library / send straight to /outreach without
  // staring at a blank shell. We skip the welcome detection if the
  // caller's URL filter narrows by source/type/etc. (their explicit
  // intent is "show me filtered slice", not "first impression").
  const filterIsBroad =
    !filter.productId &&
    !filter.search &&
    !filter.status &&
    (!filter.types || filter.types.length === 0) &&
    (!filter.sources || filter.sources.length === 0);

  const [listing, products, userOwnedCount] = await Promise.all([
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
    filterIsBroad
      ? withTenant(tenantId, (tx) =>
          tx.asset.count({
            where: {
              tenantId,
              source: { in: ["user_created", "ai_generated", "imported"] },
            },
          })
        )
      : Promise.resolve(1), // non-zero shortcut so welcome mode stays off
  ]);

  const mode: "normal" | "welcome" = userOwnedCount === 0 ? "welcome" : "normal";

  // In welcome mode, replace the listing with system_seed-only assets
  // so the grid shows only the curated templates the marketer can
  // adopt; the AssetsClient banner + Save-to-library footer key off
  // `mode` to surface the welcoming chrome.
  let effectiveListing = listing;
  if (mode === "welcome") {
    effectiveListing = await withTenant(tenantId, (tx) =>
      loadAssetsForListing(
        tx,
        { ...filter, sources: ["system_seed"] },
        { sort: initialState.sort, limit: 24 }
      )
    );
  }

  return (
    <AssetsClient
      initialListing={effectiveListing}
      products={products}
      initialState={initialState}
      mode={mode}
    />
  );
}

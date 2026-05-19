/**
 * BL-069-F004 · Product list panel for /brief?tab=products.
 *
 * Server component that fetches the tenant's products (RLS via
 * withTenant) + asset counts, then renders the product CRUD client.
 *
 * BL-070-F004: the legacy `/knowledge-base` route was retired and its
 * CRUD components (`ProductsClient` + `ProductCard` + `ProductModal` +
 * `actions.ts` + `types.ts`) were git mv'd into `brief/` so /brief is
 * the single home for product management. Deep links from the old KB
 * URLs now 404 (BL-070 同批即停 redirect per decision §5).
 */
import { auth } from "@/auth";
import { loadProductAssetCounts } from "@/lib/assets/queries";
import { withTenant } from "@/lib/db";
import type { ProductAiAssets } from "@/lib/products/generateAiAssets";

import { ProductsClient } from "./ProductsClient";
import type { ProductListItem } from "./types";

interface Props {
  /** Optional — when the user hits /brief?tab=products&productId=:id
   *  this is the product to auto-open in the edit modal. */
  initialEditingProductId?: string;
}

export async function ProductListPanel({ initialEditingProductId }: Props) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    // Defensive: brief/page.tsx already redirects unauthenticated
    // visitors to /login; this branch should never fire in practice.
    return null;
  }

  const { rows, assetCounts } = await withTenant(tenantId, async (tx) => {
    const productRows = await tx.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const counts = await loadProductAssetCounts(
      tx,
      productRows.map((r) => r.id),
    );
    return { rows: productRows, assetCounts: counts };
  });

  const products: ProductListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    targetAudience: r.targetAudience,
    uniqueSellingPoints: r.uniqueSellingPoints,
    downloadUrl: r.downloadUrl,
    launchDate: r.launchDate ? r.launchDate.toISOString() : null,
    aiAssets: r.aiAssets as ProductAiAssets | null,
    assetCounts: assetCounts.get(r.id) ?? { emailCount: 0, videoCount: 0 },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div data-testid="brief-product-list-panel">
      <ProductsClient
        products={products}
        initialEditingProductId={initialEditingProductId}
      />
    </div>
  );
}

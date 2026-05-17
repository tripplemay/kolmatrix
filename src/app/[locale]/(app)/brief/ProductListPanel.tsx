/**
 * BL-069-F004 · Product list panel for /brief?tab=products.
 *
 * Server component that fetches the tenant's products (RLS via
 * withTenant, identical to /knowledge-base/page.tsx) + asset counts,
 * then renders the existing KB ProductsClient. Reuses the full KB
 * CRUD surface (ProductCard + ProductModal + delete confirm flow,
 * including BL-051a-F008 cascade prompt) instead of forking a copy.
 *
 * Deep-link support: when /brief?tab=products&productId=:id arrives
 * via redirect from /knowledge-base/[id] (F006 will wire that
 * middleware rule), ProductsClient.initialEditingProductId auto-
 * opens the edit modal for that product on first mount.
 *
 * BL-070 二次清理: once redirects are stable, git mv ProductsClient +
 * ProductCard + ProductModal + types.ts + actions.ts into brief/ and
 * remove /knowledge-base/page.tsx altogether. Until then the dual-
 * mount keeps both /brief?tab=products + /knowledge-base working off
 * the same KB CRUD source so behaviour stays consistent during the
 * IA migration window.
 */
import { auth } from "@/auth";
import { loadProductAssetCounts } from "@/lib/assets/queries";
import { withTenant } from "@/lib/db";
import type { ProductAiAssets } from "@/lib/products/generateAiAssets";

import { ProductsClient } from "../knowledge-base/ProductsClient";
import type { ProductListItem } from "../knowledge-base/types";

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

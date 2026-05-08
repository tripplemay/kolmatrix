import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadProductAssetCounts } from "@/lib/assets/queries";
import { withTenant } from "@/lib/db";
import type { ProductAiAssets } from "@/lib/products/generateAiAssets";

import { ProductsClient } from "./ProductsClient";
import type { ProductListItem } from "./types";

export const metadata = { title: "Knowledge Base — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function KnowledgeBasePage({ params }: Props) {
  await params; // honour Next.js async params contract
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  // BL-030-F002 — loadProductAssetCounts shares the same withTenant
  // tx as the product list so the chip counts honor RLS and avoid an
  // extra round-trip per card. groupBy runs once over the visible
  // page (≤100 products).
  const { rows, assetCounts } = await withTenant(tenantId, async (tx) => {
    const productRows = await tx.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const counts = await loadProductAssetCounts(
      tx,
      productRows.map((r) => r.id)
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

  const t = await getTranslations("knowledgeBase");

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-24">
      <nav
        className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant"
        aria-label="Breadcrumb"
      >
        <span>{t("breadcrumbRoot")}</span>
        <span className="material-symbols-outlined text-[14px]" aria-hidden>
          chevron_right
        </span>
        <span className="text-cyan">{t("breadcrumbCurrent")}</span>
      </nav>

      <ProductsClient products={products} />
    </div>
  );
}

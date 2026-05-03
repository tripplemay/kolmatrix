/**
 * BM1-F003 · Plain-object DTOs that cross the server → client boundary.
 *
 * The server page Reads Product rows through Prisma (rich types including
 * Decimal + Date) and passes them to the client grid. We normalise here
 * so the client never has to import the Prisma client bundle.
 *
 * BL-030-F002 — added `assetCounts` so ProductCard chips read counts
 * from the unified Asset table instead of the legacy
 * Product.aiAssets.emailTemplates / videoScripts arrays (which no
 * longer exist post BL-030-F001 shrink). loadProductAssetCounts in
 * src/lib/assets/queries.ts populates this on the server.
 */
import type { ProductAiAssets } from "@/lib/products/generateAiAssets";

export interface ProductAssetCountsDto {
  emailCount: number;
  videoCount: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  category: string;
  targetAudience: string | null;
  uniqueSellingPoints: string;
  downloadUrl: string | null;
  launchDate: string | null;
  aiAssets: ProductAiAssets | null;
  assetCounts: ProductAssetCountsDto;
  createdAt: string;
  updatedAt: string;
}

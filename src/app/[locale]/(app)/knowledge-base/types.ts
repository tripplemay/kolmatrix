/**
 * BM1-F003 · Plain-object DTOs that cross the server → client boundary.
 *
 * The server page Reads Product rows through Prisma (rich types including
 * Decimal + Date) and passes them to the client grid. We normalise here
 * so the client never has to import the Prisma client bundle.
 */
import type { ProductAiAssets } from "@/lib/products/generateAiAssets";

export interface ProductListItem {
  id: string;
  name: string;
  category: string;
  targetAudience: string | null;
  uniqueSellingPoints: string;
  downloadUrl: string | null;
  launchDate: string | null;
  aiAssets: ProductAiAssets | null;
  createdAt: string;
  updatedAt: string;
}

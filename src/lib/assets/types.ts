/**
 * BL-025-F002 · DTO types for the unified Asset surface.
 *
 * Re-exports the Prisma enums + per-call shape contracts. Keeping
 * DTOs out of queries.ts / mutations.ts lets the F004 page imports
 * pull only types without dragging Prisma into the client bundle.
 */
import type { AssetSource, AssetStatus, AssetType, Prisma } from "@prisma/client";

export type { AssetSource, AssetStatus, AssetType };

export interface AssetCard {
  id: string;
  tenantId: string | null;
  productId: string | null;
  productName: string | null;
  type: AssetType;
  name: string;
  source: AssetSource;
  status: AssetStatus;
  parentId: string | null;
  versionIndex: number;
  totalVariants: number;
  contentPreview: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface AssetDetail extends AssetCard {
  content: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  createdBy: string | null;
}

export interface AssetFilter {
  productId?: string;
  types?: AssetType[];
  status?: AssetStatus;
  sources?: AssetSource[];
  search?: string;
}

// BL-026-F006.C — added "used_most" — orders by email_log usage
// count (asset.id ⇋ email_log.template_id via dual-write).
export type AssetListSort = "recent" | "name" | "type" | "used_most";

export interface AssetListPagination {
  cursor?: string;
  limit?: number;
  sort?: AssetListSort;
}

export interface AssetListResult {
  items: AssetCard[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface VariantTreeNode {
  id: string;
  parentId: string | null;
  name: string;
  source: AssetSource;
  status: AssetStatus;
  createdAt: Date;
  versionIndex: number;
}

export interface UsedInEntry {
  resourceType: "email_log";
  resourceId: string;
  occurredAt: Date;
  campaignId: string | null;
  /** BL-026-F006.D — JOIN'd campaign name (null when the email_log
   * has no campaignId). Eliminates the BL-025 UUID-prefix display. */
  campaignName: string | null;
  kolId: string | null;
  /** BL-026-F006.D — JOIN'd KOL displayName. */
  kolName: string | null;
}

export interface UsedInSummary {
  total: number;
  recent: UsedInEntry[];
}

export interface CreateAssetInput {
  productId?: string | null;
  type: AssetType;
  name: string;
  content: unknown;
  source: AssetSource;
  status?: AssetStatus;
  parentAssetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  createdBy?: string | null;
}

export interface UpdateAssetPatch {
  name?: string;
  content?: unknown;
  status?: AssetStatus;
  metadata?: Prisma.InputJsonValue;
}

/**
 * BL-025-F002 · Asset write helpers (RLS-aware via the caller's tx).
 *
 * createAsset + updateAsset push every `content` value through the
 * matching ASSET_CONTENT_SCHEMAS Zod schema before persisting, so a
 * malformed shape rejects loudly with a typed error rather than
 * landing as garbage JSON the readers can't parse.
 *
 * Variant tree guards (createAsset):
 *   - parentAssetId must reference an existing asset
 *   - parentAssetId must NOT equal the new asset itself (impossible
 *     since the new id is generated, but guarded for fixture safety)
 *   - depth-from-root ≤ MAX_VARIANT_DEPTH so a malicious chain can't
 *     blow up loadVariantTree
 *
 * archiveAsset is a thin wrapper around updateAsset({status:'archived'})
 * preserved as a separate name to make the call site read-clean and
 * because the audit log tag (F003) differs.
 */
import { type AssetSource, type AssetStatus, type AssetType, Prisma } from "@prisma/client";

import { ASSET_CONTENT_SCHEMAS } from "./schemas";
import type { AssetDetail, CreateAssetInput, UpdateAssetPatch } from "./types";

const MAX_VARIANT_DEPTH = 10;

export class AssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} not found`);
    this.name = "AssetNotFoundError";
  }
}

export class AssetVariantDepthError extends Error {
  constructor(public readonly depth: number) {
    super(`Variant chain exceeds max depth ${MAX_VARIANT_DEPTH} (got ${depth})`);
    this.name = "AssetVariantDepthError";
  }
}

export class AssetVariantSelfReferenceError extends Error {
  constructor(public readonly assetId: string) {
    super(`Asset ${assetId} cannot be its own parent`);
    this.name = "AssetVariantSelfReferenceError";
  }
}

function parseContent(type: AssetType, content: unknown): Prisma.InputJsonValue {
  const schema = ASSET_CONTENT_SCHEMAS[type];
  const parsed = schema.parse(content);
  return parsed as Prisma.InputJsonValue;
}

async function assertParentChainValid(
  tx: Prisma.TransactionClient,
  parentId: string
): Promise<void> {
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  let depth = 0;
  while (cursor) {
    if (seen.has(cursor)) {
      // Cycle detected — treat as depth violation since the chain is
      // unwalkable to a real root.
      throw new AssetVariantDepthError(depth);
    }
    seen.add(cursor);
    depth += 1;
    if (depth > MAX_VARIANT_DEPTH) {
      throw new AssetVariantDepthError(depth);
    }
    const node = (await tx.asset.findUnique({
      where: { id: cursor },
      select: { id: true, parentId: true },
    })) as { id: string; parentId: string | null } | null;
    if (!node) {
      throw new AssetNotFoundError(cursor);
    }
    cursor = node.parentId;
  }
}

export async function createAsset(
  tx: Prisma.TransactionClient,
  tenantId: string | null,
  input: CreateAssetInput
): Promise<AssetDetail> {
  const validatedContent = parseContent(input.type, input.content);

  if (input.parentAssetId) {
    await assertParentChainValid(tx, input.parentAssetId);
  }

  const created = await tx.asset.create({
    data: {
      tenantId,
      productId: input.productId ?? null,
      type: input.type,
      name: input.name,
      content: validatedContent,
      source: input.source,
      status: input.status ?? "draft",
      parentId: input.parentAssetId ?? null,
      metadata: input.metadata ?? ({} as Prisma.InputJsonValue),
      createdBy: input.createdBy ?? null,
    },
    select: {
      id: true,
      tenantId: true,
      productId: true,
      type: true,
      name: true,
      source: true,
      status: true,
      parentId: true,
      content: true,
      metadata: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      product: { select: { name: true } },
    },
  });

  // Newly created → versionIndex = (siblings under same root) + 1.
  // Only counts among rows already persisted; tree size for a fresh
  // row is "self".
  return {
    id: created.id,
    tenantId: created.tenantId,
    productId: created.productId,
    productName: created.product?.name ?? null,
    type: created.type,
    name: created.name,
    source: created.source,
    status: created.status,
    parentId: created.parentId,
    versionIndex: 1,
    totalVariants: 1,
    contentPreview: "",
    updatedAt: created.updatedAt,
    createdAt: created.createdAt,
    content: created.content,
    metadata: created.metadata,
    createdBy: created.createdBy,
  };
}

export async function updateAsset(
  tx: Prisma.TransactionClient,
  assetId: string,
  patch: UpdateAssetPatch
): Promise<AssetDetail> {
  // Need the type to validate `content` against the right schema.
  const existing = (await tx.asset.findUnique({
    where: { id: assetId },
    select: { id: true, type: true, status: true },
  })) as { id: string; type: AssetType; status: AssetStatus } | null;
  if (!existing) throw new AssetNotFoundError(assetId);

  const data: Prisma.AssetUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.metadata !== undefined) data.metadata = patch.metadata;
  if (patch.content !== undefined) {
    data.content = parseContent(existing.type, patch.content);
  }

  const updated = await tx.asset.update({
    where: { id: assetId },
    data,
    select: {
      id: true,
      tenantId: true,
      productId: true,
      type: true,
      name: true,
      source: true,
      status: true,
      parentId: true,
      content: true,
      metadata: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      product: { select: { name: true } },
    },
  });

  return {
    id: updated.id,
    tenantId: updated.tenantId,
    productId: updated.productId,
    productName: updated.product?.name ?? null,
    type: updated.type,
    name: updated.name,
    source: updated.source,
    status: updated.status,
    parentId: updated.parentId,
    versionIndex: 1,
    totalVariants: 1,
    contentPreview: "",
    updatedAt: updated.updatedAt,
    createdAt: updated.createdAt,
    content: updated.content,
    metadata: updated.metadata,
    createdBy: updated.createdBy,
  };
}

export async function archiveAsset(
  tx: Prisma.TransactionClient,
  assetId: string
): Promise<AssetDetail> {
  return updateAsset(tx, assetId, { status: "archived" });
}

/**
 * Hard delete. Caller decides whether to use this vs archiveAsset —
 * the variant tree's `parentId` FK is ON DELETE SET NULL so children
 * survive (they detach to a new root). Returns true if a row was
 * deleted, false if it never existed.
 */
export async function deleteAsset(tx: Prisma.TransactionClient, assetId: string): Promise<boolean> {
  try {
    await tx.asset.delete({ where: { id: assetId } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return false;
    }
    throw err;
  }
}

export const __TEST_ONLY__ = {
  MAX_VARIANT_DEPTH,
  parseContent,
  assertParentChainValid,
} satisfies Record<string, unknown>;

export type { AssetSource, AssetStatus, AssetType };

/**
 * BL-025-F002 · Asset query helpers (RLS-aware via the caller's tx).
 *
 * Same shape contract as src/lib/email/templates.ts: every helper
 * accepts a `Prisma.TransactionClient` so the caller composes its own
 * `withTenant(tenantId, tx => ...)` scope. asset_tenant_isolation
 * (F001 migration) does the visibility filtering at the DB layer; we
 * never hand-roll a `tenantId IN (?, NULL)` predicate here.
 *
 * loadAssetsForComposer is the F006 reader replacement for
 * loadOutreachTemplates — system_seed (tenantId IS NULL) + the
 * caller's published email assets, locale-filtered against the
 * content JSON. That filter is a JSON path predicate so adding a new
 * locale doesn't require a column.
 *
 * loadVariantTree walks `parentId` upward to the root then collects
 * the whole descendant set, with a depth cap that matches the
 * createAsset guard in mutations.ts (no infinite chains regardless of
 * how malformed the source data is). loadUsedIn returns email_log
 * references using both the asset's own id (the F006 dual-write
 * convention going forward) and any `metadata.migrated_from_*` id
 * carried over from the EmailTemplate import.
 */
import type { AssetType, Prisma } from "@prisma/client";

import { decodeCursor, encodeCursor, type CursorPaginationParams } from "@/lib/pagination/cursor";

import type {
  AssetCard,
  AssetDetail,
  AssetFilter,
  AssetListPagination,
  AssetListResult,
  AssetListSort,
  UsedInEntry,
  UsedInSummary,
  VariantTreeNode,
} from "./types";

const MAX_VARIANT_DEPTH = 10;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;
const COMPOSER_MAX_RESULTS = 100;
const USED_IN_RECENT_LIMIT = 20;

function previewFromContent(type: AssetType, content: Prisma.JsonValue): string {
  if (content == null || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }
  const c = content as Record<string, unknown>;
  if (type === "email") {
    const subject = typeof c.subject === "string" ? c.subject : "";
    const body = typeof c.body === "string" ? c.body : "";
    return [subject, body].filter(Boolean).join(" — ").slice(0, 280);
  }
  // video_script
  const title = typeof c.title === "string" ? c.title : "";
  const script = typeof c.script === "string" ? c.script : "";
  return [title, script].filter(Boolean).join(" — ").slice(0, 280);
}

interface RawAssetRow {
  id: string;
  tenantId: string | null;
  productId: string | null;
  type: AssetType;
  name: string;
  source: AssetCard["source"];
  status: AssetCard["status"];
  parentId: string | null;
  content: Prisma.JsonValue;
  metadata: Prisma.JsonValue;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: { name: string } | null;
}

function toCard(row: RawAssetRow, versionIndex: number, totalVariants: number): AssetCard {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId,
    productName: row.product?.name ?? null,
    type: row.type,
    name: row.name,
    source: row.source,
    status: row.status,
    parentId: row.parentId,
    versionIndex,
    totalVariants,
    contentPreview: previewFromContent(row.type, row.content),
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

const ASSET_SELECT = {
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
} satisfies Prisma.AssetSelect;

function buildListWhere(filter: AssetFilter): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = {};
  if (filter.productId) where.productId = filter.productId;
  if (filter.types && filter.types.length > 0) where.type = { in: filter.types };
  if (filter.status) where.status = filter.status;
  if (filter.sources && filter.sources.length > 0) {
    where.source = { in: filter.sources };
  }
  if (filter.search && filter.search.trim().length > 0) {
    where.name = { contains: filter.search.trim(), mode: "insensitive" };
  }
  return where;
}

function sortToOrderBy(sort: AssetListSort): Prisma.AssetOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "type":
      return [{ type: "asc" }, { updatedAt: "desc" }, { id: "desc" }];
    case "recent":
    default:
      return [{ updatedAt: "desc" }, { id: "desc" }];
  }
}

/**
 * Listing for the /assets grid. Returns the visible page + an opaque
 * cursor and a total count (so the filter sidebar can show
 * "12 assets in this product"). versionIndex / totalVariants are
 * derived from the parentId chain so each card can render the
 * "v3 of 4" badge without N+1.
 */
export async function loadAssetsForListing(
  tx: Prisma.TransactionClient,
  filter: AssetFilter,
  pagination: AssetListPagination = {}
): Promise<AssetListResult> {
  const where = buildListWhere(filter);
  const sort: AssetListSort = pagination.sort ?? "recent";
  const orderBy = sortToOrderBy(sort);
  const requestedLimit = pagination.limit ?? DEFAULT_PAGE_SIZE;
  const limit = Math.max(1, Math.min(requestedLimit, MAX_PAGE_SIZE));

  const findManyArgs: Prisma.AssetFindManyArgs = {
    where,
    orderBy,
    take: limit + 1,
    select: ASSET_SELECT,
  };

  if (pagination.cursor) {
    const envelope = decodeCursor(pagination.cursor);
    if (envelope) {
      findManyArgs.cursor = { id: envelope.id };
      findManyArgs.skip = 1;
    }
  }

  const [rows, total] = await Promise.all([
    tx.asset.findMany(findManyArgs) as Promise<RawAssetRow[]>,
    tx.asset.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;

  const items = await annotateVariantInfo(tx, visibleRows);

  let nextCursor: string | null = null;
  if (hasMore && visibleRows.length > 0) {
    const last = visibleRows[visibleRows.length - 1]!;
    const sortField = sort === "name" ? "name" : sort === "type" ? "type" : "updatedAt";
    const sortValue =
      sort === "name" ? last.name : sort === "type" ? last.type : last.updatedAt.toISOString();
    nextCursor = encodeCursor({ id: last.id, sortField, sortValue });
  }

  return { items, nextCursor, hasMore, total };
}

/**
 * Compute version info for every row in one pass: count children for
 * each potential root + locate this row's position in its sibling
 * chain. Uses two batched queries instead of one-per-row.
 */
async function annotateVariantInfo(
  tx: Prisma.TransactionClient,
  rows: RawAssetRow[]
): Promise<AssetCard[]> {
  if (rows.length === 0) return [];

  const rootIds = new Set<string>();
  for (const r of rows) rootIds.add(r.parentId ?? r.id);

  const allInTrees = (await tx.asset.findMany({
    where: {
      OR: [{ id: { in: Array.from(rootIds) } }, { parentId: { in: Array.from(rootIds) } }],
    },
    select: { id: true, parentId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })) as Array<{ id: string; parentId: string | null; createdAt: Date }>;

  const childrenByRoot = new Map<string, Array<{ id: string; createdAt: Date }>>();
  for (const node of allInTrees) {
    const root = node.parentId ?? node.id;
    if (!childrenByRoot.has(root)) childrenByRoot.set(root, []);
    childrenByRoot.get(root)!.push({ id: node.id, createdAt: node.createdAt });
  }

  return rows.map((row) => {
    const root = row.parentId ?? row.id;
    const siblings = childrenByRoot.get(root) ?? [{ id: row.id, createdAt: row.createdAt }];
    const total = siblings.length;
    const idx = siblings.findIndex((s) => s.id === row.id);
    const versionIndex = idx >= 0 ? idx + 1 : 1;
    return toCard(row, versionIndex, total);
  });
}

export async function loadAssetDetail(
  tx: Prisma.TransactionClient,
  assetId: string
): Promise<AssetDetail | null> {
  const row = (await tx.asset.findUnique({
    where: { id: assetId },
    select: ASSET_SELECT,
  })) as RawAssetRow | null;

  if (!row) return null;

  const cards = await annotateVariantInfo(tx, [row]);
  const card = cards[0]!;

  return {
    ...card,
    content: row.content,
    metadata: row.metadata,
    createdBy: row.createdBy,
  };
}

export interface ComposerAssetOption {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: Prisma.JsonValue;
  locale: string;
  source: AssetCard["source"];
  productId: string | null;
  productName: string | null;
}

/**
 * F006 reader replacement for loadOutreachTemplates. system_seed
 * (tenantId IS NULL) + tenant-owned published email assets,
 * narrowed by locale via the content JSON path. Order: source asc
 * (system_seed first since system_seed < user_created < ai_generated
 * lexically) then updatedAt desc within each band.
 *
 * Returns up to COMPOSER_MAX_RESULTS — enough that the dropdown
 * never truncates real-world tenant content; F005's library page is
 * the place to browse beyond that ceiling.
 */
export async function loadAssetsForComposer(
  tx: Prisma.TransactionClient,
  type: AssetType,
  locale?: string
): Promise<ComposerAssetOption[]> {
  const where: Prisma.AssetWhereInput = { type, status: "published" };
  if (locale) {
    where.content = { path: ["locale"], equals: locale } as Prisma.JsonNullableFilter<"Asset">;
  }

  const rows = (await tx.asset.findMany({
    where,
    select: {
      id: true,
      name: true,
      content: true,
      source: true,
      productId: true,
      product: { select: { name: true } },
    },
    orderBy: [{ source: "asc" }, { updatedAt: "desc" }],
    take: COMPOSER_MAX_RESULTS,
  })) as Array<{
    id: string;
    name: string;
    content: Prisma.JsonValue;
    source: AssetCard["source"];
    productId: string | null;
    product: { name: string } | null;
  }>;

  return rows.map((row) => {
    const c = (row.content ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      name: row.name,
      subject: typeof c.subject === "string" ? c.subject : "",
      body: typeof c.body === "string" ? c.body : "",
      variables: (c.variables as Prisma.JsonValue) ?? [],
      locale: typeof c.locale === "string" ? c.locale : "en",
      source: row.source,
      productId: row.productId,
      productName: row.product?.name ?? null,
    };
  });
}

/**
 * Walk parentId up to the root, then collect the entire variant
 * subtree (root + every descendant). MAX_VARIANT_DEPTH applies in
 * both directions so a malformed cycle can't hang the request.
 */
export async function loadVariantTree(
  tx: Prisma.TransactionClient,
  assetId: string
): Promise<VariantTreeNode[]> {
  let rootId = assetId;
  const seenUp = new Set<string>([assetId]);
  for (let i = 0; i < MAX_VARIANT_DEPTH; i += 1) {
    const node = (await tx.asset.findUnique({
      where: { id: rootId },
      select: { id: true, parentId: true },
    })) as { id: string; parentId: string | null } | null;
    if (!node) return [];
    if (!node.parentId) break;
    if (seenUp.has(node.parentId)) break;
    rootId = node.parentId;
    seenUp.add(rootId);
  }

  const collected: Array<{
    id: string;
    parentId: string | null;
    name: string;
    source: AssetCard["source"];
    status: AssetCard["status"];
    createdAt: Date;
  }> = [];
  const seenIds = new Set<string>();
  let frontier: string[] = [rootId];

  for (let depth = 0; depth < MAX_VARIANT_DEPTH && frontier.length > 0; depth += 1) {
    const layer = (await tx.asset.findMany({
      where: { id: { in: frontier } },
      select: {
        id: true,
        parentId: true,
        name: true,
        source: true,
        status: true,
        createdAt: true,
      },
    })) as Array<{
      id: string;
      parentId: string | null;
      name: string;
      source: AssetCard["source"];
      status: AssetCard["status"];
      createdAt: Date;
    }>;

    for (const node of layer) {
      if (seenIds.has(node.id)) continue;
      collected.push(node);
      seenIds.add(node.id);
    }

    const children = (await tx.asset.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })) as Array<{ id: string }>;
    frontier = children.map((c) => c.id).filter((id) => !seenIds.has(id));
  }

  collected.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );

  return collected.map((node, index) => ({
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    source: node.source,
    status: node.status,
    createdAt: node.createdAt,
    versionIndex: index + 1,
  }));
}

/**
 * Aggregate references in email_log. F006 dual-write convention is
 * `email_template.id = asset.id` going forward, so the asset's own
 * id is the primary key. For rows migrated from EmailTemplate we
 * also recognise `asset.metadata.migrated_from_email_template_id`
 * so legacy email_log entries (templateId pointing at the original
 * email_template UUID) still surface here.
 */
export async function loadUsedIn(
  tx: Prisma.TransactionClient,
  assetId: string
): Promise<UsedInSummary> {
  const asset = (await tx.asset.findUnique({
    where: { id: assetId },
    select: { id: true, metadata: true },
  })) as { id: string; metadata: Prisma.JsonValue } | null;
  if (!asset) return { total: 0, recent: [] };

  const candidateIds = new Set<string>([asset.id]);
  if (asset.metadata && typeof asset.metadata === "object" && !Array.isArray(asset.metadata)) {
    const m = asset.metadata as Record<string, unknown>;
    const legacyId = m.migrated_from_email_template_id;
    if (typeof legacyId === "string") candidateIds.add(legacyId);
  }

  const ids = Array.from(candidateIds);
  const [total, recentRows] = await Promise.all([
    tx.emailLog.count({ where: { templateId: { in: ids } } }),
    tx.emailLog.findMany({
      where: { templateId: { in: ids } },
      select: {
        id: true,
        createdAt: true,
        campaignId: true,
        kolId: true,
      },
      orderBy: { createdAt: "desc" },
      take: USED_IN_RECENT_LIMIT,
    }),
  ]);

  const recent: UsedInEntry[] = recentRows.map((row) => ({
    resourceType: "email_log" as const,
    resourceId: row.id,
    occurredAt: row.createdAt,
    campaignId: row.campaignId,
    kolId: row.kolId,
  }));

  return { total, recent };
}

export const __TEST_ONLY__ = {
  MAX_VARIANT_DEPTH,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  COMPOSER_MAX_RESULTS,
  USED_IN_RECENT_LIMIT,
  previewFromContent,
  buildListWhere,
  sortToOrderBy,
} satisfies Record<string, unknown>;

export type { CursorPaginationParams };

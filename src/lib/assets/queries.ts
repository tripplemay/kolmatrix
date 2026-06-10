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
// BL-026-F006.C — sort=used_most fetches up to this many matching
// assets to memory before in-memory ranking. Tenants beyond this cap
// see only the first cap rows ranked. ~500 is comfortably above
// realistic tenant asset counts during the MVP window.
const USED_MOST_SCAN_CAP = 500;

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
    case "used_most":
      // Handled outside Prisma's findMany — see loadAssetsForListing
      // sort branch. Returning recent ordering as a safe fallback in
      // case this ever runs through findMany unexpectedly (it
      // shouldn't — caller short-circuits).
      return [{ updatedAt: "desc" }, { id: "desc" }];
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

  // BL-026-F006.C — `used_most` ranks by email_log usage count via
  // the F006 dual-write convention (asset.id = email_template.id =
  // email_log.template_id). Prisma can't `_count` an Asset → EmailLog
  // relation because the FK on email_log.template_id targets
  // email_template (legacy), so we aggregate counts in JS:
  //
  //   1. groupBy email_log over template_id
  //   2. fetch all matching assets up to a USED_MOST_SCAN_CAP safety
  //      limit (no cursor — the in-memory sort means cursor pagination
  //      can't preserve order across pages)
  //   3. sort in JS by count desc + updatedAt desc tie-break
  //   4. slice to the requested limit
  //
  // Trade-off: tenants with > USED_MOST_SCAN_CAP assets will see only
  // the top by `_count` order across the first cap. Acceptable for
  // MVP scale; the future upgrade path is a generated `usage_count`
  // column on Asset (computed via trigger) so Prisma can sort
  // natively.
  if (sort === "used_most") {
    const counts = await tx.emailLog.groupBy({
      by: ["templateId"],
      _count: { _all: true },
      where: { templateId: { not: null } },
    });
    const countByAsset = new Map<string, number>();
    for (const c of counts) {
      if (c.templateId) countByAsset.set(c.templateId, c._count._all);
    }

    const allRows = (await tx.asset.findMany({
      where,
      select: ASSET_SELECT,
      take: USED_MOST_SCAN_CAP,
    })) as RawAssetRow[];

    allRows.sort((a, b) => {
      const ca = countByAsset.get(a.id) ?? 0;
      const cb = countByAsset.get(b.id) ?? 0;
      if (cb !== ca) return cb - ca;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    const visibleRows = allRows.slice(0, limit);
    const items = await annotateVariantInfo(tx, visibleRows);
    return {
      items,
      // Cursor pagination is incompatible with in-memory sort;
      // surface "no more pages" so the client doesn't try.
      nextCursor: null,
      hasMore: false,
      total: allRows.length,
    };
  }

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
  createdAt: Date;
  updatedAt: Date;
}

/**
 * F006 reader replacement for loadOutreachTemplates. system_seed
 * (tenantId IS NULL) + tenant-owned published email assets,
 * narrowed by locale via the content JSON path. Order: source asc
 * (system_seed first since system_seed < user_created < ai_generated
 * lexically) then updatedAt desc within each band.
 *
 * BL-026-F005 — added optional `search` (case-insensitive name
 * substring match) and `productId` filters so the /outreach
 * composer's new search + product filter row can narrow at the DB
 * level when wired up. The composer UI currently does client-side
 * filtering against the initial 100-row payload (light path); these
 * params land server-side first so the future "incremental search"
 * upgrade (server action calling this with `search`) is a one-line
 * swap. ⚠️ BL-099 fix-round 1: the `productId` param here is strict
 * equality, but the composer's client-side filter (reach/
 * templateFilter.ts) keeps product-agnostic rows (productId IS NULL
 * — workspace user templates + system seeds) visible under an
 * active product filter. If product filtering ever moves
 * server-side, port that OR-NULL semantics or the BL-099 F006 bug
 * (fresh workspace template hidden behind "No matches") comes back.
 *
 * Returns up to COMPOSER_MAX_RESULTS — enough that the dropdown
 * never truncates real-world tenant content; the /assets page is
 * the place to browse beyond that ceiling.
 */
export async function loadAssetsForComposer(
  tx: Prisma.TransactionClient,
  type: AssetType,
  locale?: string,
  search?: string,
  productId?: string
): Promise<ComposerAssetOption[]> {
  const where: Prisma.AssetWhereInput = { type, status: "published" };
  if (locale) {
    // BL-031-F001 (D1) — locale filter only applies to system_seed
    // rows. user_created / ai_generated / imported are tenant-owned
    // creative content (AI prompts currently lock to English; the
    // marketer's draft can be any language) and must surface to the
    // /zh/outreach composer regardless of UI locale. Without this
    // split a tenant whose AI emails were written in en would see
    // only the 5 system_seed zh templates and zero of their own work.
    where.OR = [
      { source: { not: "system_seed" } },
      {
        content: { path: ["locale"], equals: locale } as Prisma.JsonNullableFilter<"Asset">,
      },
    ];
  }
  if (search && search.trim().length > 0) {
    // ILIKE on name. content->>'subject' is harder to filter through
    // Prisma's JSON path operators (no built-in case-insensitive
    // contains for JsonFilter), so name is the matchable surface for
    // now — content body match would need either $queryRaw or a
    // generated `subject` column. Library names are descriptive
    // enough that this rarely bites for the marketer search use case.
    where.name = { contains: search.trim(), mode: "insensitive" };
  }
  if (productId) {
    where.productId = productId;
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
      createdAt: true,
      updatedAt: true,
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
    createdAt: Date;
    updatedAt: Date;
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
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

export interface ComposerTemplateContent {
  id: string;
  subject: string;
  body: string;
  locale: string;
}

/**
 * BL-098-F001 — read a single email-type Asset by id for the AI
 * customize path. The composer dropdown (loadAssetsForComposer) hands
 * out asset ids, so the customize action must resolve those same ids
 * against the unified Asset table — NOT the deprecated email_template
 * table (the original bug: a pure-Asset template like "Clash Royale —
 * Signing invitation" had no email_template row → template_not_found).
 *
 * Same content-JSONB extraction口径 as loadAssetsForComposer so the
 * dropdown and the customize action read identical {subject, body,
 * locale}. RLS / tenant isolation is enforced by the caller's
 * withTenant tx (asset_tenant_isolation), so we never hand-roll a
 * tenant predicate here — consistent with the rest of this module.
 *
 * Returns null (caller maps to a graceful template_not_found, never a
 * 500) when the id isn't a visible published email asset:
 *   - non-email-type asset id
 *   - draft / archived (non-published) asset
 *   - cross-tenant id (filtered by RLS)
 *   - non-existent id
 * Non-UUID ids are rejected upstream by the action's zod schema.
 */
export async function getEmailTemplateById(
  tx: Prisma.TransactionClient,
  assetId: string
): Promise<ComposerTemplateContent | null> {
  const row = (await tx.asset.findFirst({
    where: { id: assetId, type: "email", status: "published" },
    select: { id: true, content: true },
  })) as { id: string; content: Prisma.JsonValue } | null;
  if (!row) return null;

  const c = (row.content ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    subject: typeof c.subject === "string" ? c.subject : "",
    body: typeof c.body === "string" ? c.body : "",
    locale: typeof c.locale === "string" ? c.locale : "en",
  };
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
    // BL-026-F006.D — JOIN campaign.name + kol.displayName so the
    // UsedInTab can render real names instead of UUID-prefix
    // placeholders. The tab's link buttons need both the id (for
    // routing) and the name (for display).
    tx.emailLog.findMany({
      where: { templateId: { in: ids } },
      select: {
        id: true,
        createdAt: true,
        campaignId: true,
        kolId: true,
        campaign: { select: { name: true } },
        kol: { select: { displayName: true } },
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
    campaignName: row.campaign?.name ?? null,
    kolId: row.kolId,
    kolName: row.kol?.displayName ?? null,
  }));

  return { total, recent };
}

/**
 * BL-030-F002 — count published email + video_script Assets per product
 * for the KB grid chip rows. The KB page (page.tsx) calls this once
 * inside its withTenant scope and injects the counts into each
 * ProductListItem so ProductCard can read product.assetCounts without
 * an extra round-trip per card.
 *
 * Filtering rules:
 *  - status='published' matches what KB generation writes (D1) and
 *    what the composer reads — chip counts shouldn't include archived
 *    or draft rows the user has hidden / hasn't promoted.
 *  - source is unfiltered: any Asset row tied to the product counts
 *    (ai_generated, user_created, imported), so the chip reflects
 *    "what's live in /assets for this product" not just KB output.
 *
 * Empty productIds → empty Map (single-line short-circuit; Prisma
 * groupBy with `productId in []` would still execute and return
 * nothing, but skipping the query saves a roundtrip).
 */
export interface ProductAssetCounts {
  emailCount: number;
  videoCount: number;
}

export async function loadProductAssetCounts(
  tx: Prisma.TransactionClient,
  productIds: string[]
): Promise<Map<string, ProductAssetCounts>> {
  const result = new Map<string, ProductAssetCounts>();
  if (productIds.length === 0) return result;

  const groups = await tx.asset.groupBy({
    by: ["productId", "type"],
    where: {
      productId: { in: productIds },
      status: "published",
    },
    _count: { _all: true },
  });

  for (const productId of productIds) {
    result.set(productId, { emailCount: 0, videoCount: 0 });
  }
  for (const g of groups) {
    if (!g.productId) continue;
    const slot = result.get(g.productId);
    if (!slot) continue;
    if (g.type === "email") slot.emailCount = g._count._all;
    else if (g.type === "video_script") slot.videoCount = g._count._all;
  }
  return result;
}

/**
 * BL-030-F002 — list a product's Assets for the ProductModal panel.
 * Sorted by templateRole (initial → follow_up → signing → youtube →
 * tiktok via metadata.templateRole when present, falling back to
 * createdAt asc) so the panel shows them in a stable, predictable
 * order. Returns lightweight shape (id / type / name / status) — the
 * panel doesn't need full content; clicking the row jumps to /assets.
 */
export interface ProductAssetListItem {
  id: string;
  type: AssetType;
  name: string;
  status: AssetCard["status"];
  source: AssetCard["source"];
  templateRole: string | null;
  createdAt: Date;
}

const TEMPLATE_ROLE_ORDER = [
  "initial_outreach",
  "follow_up",
  "signing_invitation",
  "youtube_60s",
  "tiktok_15s",
] as const;

export async function loadProductAssets(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<ProductAssetListItem[]> {
  const rows = (await tx.asset.findMany({
    where: { productId, status: { not: "archived" } },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      source: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }],
  })) as Array<{
    id: string;
    type: AssetType;
    name: string;
    status: AssetCard["status"];
    source: AssetCard["source"];
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }>;

  const items = rows.map((row) => {
    let templateRole: string | null = null;
    if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
      const m = row.metadata as Record<string, unknown>;
      if (typeof m.templateRole === "string") templateRole = m.templateRole;
    }
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      status: row.status,
      source: row.source,
      templateRole,
      createdAt: row.createdAt,
    };
  });

  items.sort((a, b) => {
    const ai = a.templateRole
      ? TEMPLATE_ROLE_ORDER.indexOf(a.templateRole as (typeof TEMPLATE_ROLE_ORDER)[number])
      : -1;
    const bi = b.templateRole
      ? TEMPLATE_ROLE_ORDER.indexOf(b.templateRole as (typeof TEMPLATE_ROLE_ORDER)[number])
      : -1;
    const aHasRole = ai >= 0;
    const bHasRole = bi >= 0;
    if (aHasRole && bHasRole) return ai - bi;
    if (aHasRole) return -1;
    if (bHasRole) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return items;
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

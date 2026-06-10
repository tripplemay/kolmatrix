/**
 * BL-025-F004 · `/assets` URL filter — server-safe shape + parsers.
 *
 * Pure synchronous helpers + the AssetUrlState shape live here so the
 * server component (page.tsx) can hydrate from searchParams without
 * pulling the "use client" hook module. The companion file
 * use-filter-state.ts re-exports these for client callers and adds
 * the `useAssetFilters` hook on top.
 *
 * Splitting was forced by Next 16's stricter "client function called
 * from server" check (BL-025-F004 patch round; the original layout
 * worked locally but the CI Playwright run surfaced the boundary
 * violation).
 */
import {
  LISTABLE_ASSET_TYPES,
  type AssetFilter,
  type AssetListSort,
  type AssetSource,
  type AssetStatus,
  type AssetType,
} from "@/lib/assets/types";

// BL-026-F006.C — `used_most` ranks assets by email_log usage count
// (template_id matches asset.id via the F006 dual-write convention).
// Implementation lives in queries.ts loadAssetsForListing's sort
// branch; the type is added here so the URL parser accepts it.
export const ASSET_LIST_SORTS = ["recent", "name", "type", "used_most"] as const;
export const ASSET_LIST_VIEWS = ["grid", "list"] as const;
export type AssetListView = (typeof ASSET_LIST_VIEWS)[number];

// BL-110-F002 — single source of truth for listable types (shared with
// queries.ts buildListWhere + the welcome-count). The URL parser only
// ever accepts these, so an explanation-cache type can't enter via the
// `types` query param.
const ASSET_TYPES: ReadonlyArray<AssetType> = LISTABLE_ASSET_TYPES;
const ASSET_STATUSES: ReadonlyArray<AssetStatus> = ["draft", "published", "archived"];
const ASSET_SOURCES: ReadonlyArray<AssetSource> = [
  "ai_generated",
  "user_created",
  "imported",
  "system_seed",
];

function asEnum<T extends string>(raw: string | null, allowed: ReadonlyArray<T>): T | undefined {
  if (!raw) return undefined;
  return (allowed as ReadonlyArray<string>).includes(raw) ? (raw as T) : undefined;
}

function asEnumArray<T extends string>(
  raw: string | null,
  allowed: ReadonlyArray<T>
): T[] | undefined {
  if (!raw) return undefined;
  const split = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as ReadonlyArray<string>).includes(s));
  return split.length > 0 ? split : undefined;
}

export interface AssetUrlState {
  productId?: string;
  types?: AssetType[];
  status?: AssetStatus;
  sources?: AssetSource[];
  search?: string;
  sort: AssetListSort;
  view: AssetListView;
}

export interface AssetFilterPatch {
  productId?: string | null;
  types?: AssetType[] | null;
  status?: AssetStatus | null;
  sources?: AssetSource[] | null;
  search?: string | null;
  sort?: AssetListSort;
  view?: AssetListView;
}

export interface ReadonlyURLSearchParams {
  get(name: string): string | null;
}

export function readAssetFiltersFromQuery(
  searchParams: URLSearchParams | ReadonlyURLSearchParams | null
): AssetUrlState {
  const sp = searchParams ?? new URLSearchParams();
  const sort = asEnum(sp.get("sort"), ASSET_LIST_SORTS) ?? "recent";
  const view = asEnum(sp.get("view"), ASSET_LIST_VIEWS) ?? "grid";

  return {
    productId: sp.get("productId") ?? undefined,
    types: asEnumArray(sp.get("types"), ASSET_TYPES),
    status: asEnum(sp.get("status"), ASSET_STATUSES),
    sources: asEnumArray(sp.get("sources"), ASSET_SOURCES),
    search: sp.get("search") ?? undefined,
    sort,
    view,
  };
}

export function toAssetFilter(state: AssetUrlState): AssetFilter {
  const filter: AssetFilter = {};
  if (state.productId) filter.productId = state.productId;
  if (state.types && state.types.length > 0) filter.types = state.types;
  if (state.status) filter.status = state.status;
  if (state.sources && state.sources.length > 0) filter.sources = state.sources;
  if (state.search && state.search.trim().length > 0) filter.search = state.search.trim();
  return filter;
}

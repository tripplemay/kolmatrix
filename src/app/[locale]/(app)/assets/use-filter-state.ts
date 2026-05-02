"use client";

/**
 * BL-025-F004 · `/assets` URL-driven filter state.
 *
 * Five user-facing filter knobs (productId / types / status / sources
 * / search) plus two view-state knobs (sort / view) live in the URL
 * query string so deep links + the browser back stack work without
 * extra wiring. The hook returns the parsed filter shape + an
 * `update` helper that merges a partial patch then `router.push`es
 * with `scroll:false` (Next 15 default-scrolls to top, which would
 * break "scrolling through results then changing a filter").
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type {
  AssetFilter,
  AssetListSort,
  AssetSource,
  AssetStatus,
  AssetType,
} from "@/lib/assets/types";

export const ASSET_LIST_SORTS = ["recent", "name", "type"] as const;
export const ASSET_LIST_VIEWS = ["grid", "list"] as const;
export type AssetListView = (typeof ASSET_LIST_VIEWS)[number];

const ASSET_TYPES: ReadonlyArray<AssetType> = ["email", "video_script"];
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

interface ReadonlyURLSearchParams {
  get(name: string): string | null;
}

export function useAssetFilters(): {
  state: AssetUrlState;
  filter: AssetFilter;
  update: (patch: AssetFilterPatch) => void;
  clearAll: () => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(() => readAssetFiltersFromQuery(searchParams), [searchParams]);
  const filter = useMemo(() => toAssetFilter(state), [state]);

  const update = useCallback(
    (patch: AssetFilterPatch) => {
      const sp = new URLSearchParams(searchParams ?? "");
      for (const [key, raw] of Object.entries(patch)) {
        if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
          sp.delete(key);
        } else {
          sp.set(key, Array.isArray(raw) ? raw.join(",") : String(raw));
        }
      }
      const qs = sp.toString();
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  const clearAll = useCallback(() => {
    router.push("?", { scroll: false });
  }, [router]);

  return { state, filter, update, clearAll };
}

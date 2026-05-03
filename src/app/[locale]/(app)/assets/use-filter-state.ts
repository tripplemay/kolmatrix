"use client";

/**
 * BL-025-F004 · `/assets` URL-driven filter hook (client side).
 *
 * The pure parsing helpers + AssetUrlState shape live in
 * filter-shape.ts so the server component can reuse them without
 * pulling this "use client" module. We re-export them here for
 * convenience so client consumers only need one import.
 *
 * The hook returns the parsed filter shape + an `update` helper that
 * merges a partial patch then `router.push`es with `scroll:false`
 * (Next 15+ default-scrolls to top, which would break "scrolling
 * through results then changing a filter").
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { AssetFilter } from "@/lib/assets/types";

import {
  type AssetFilterPatch,
  type AssetUrlState,
  readAssetFiltersFromQuery,
  toAssetFilter,
} from "./filter-shape";

export {
  ASSET_LIST_SORTS,
  ASSET_LIST_VIEWS,
  type AssetFilterPatch,
  type AssetListView,
  type AssetUrlState,
  readAssetFiltersFromQuery,
  toAssetFilter,
} from "./filter-shape";

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

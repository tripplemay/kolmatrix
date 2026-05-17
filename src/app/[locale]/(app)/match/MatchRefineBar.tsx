"use client";

/**
 * BL-068-F004 · RefineInputBar wrapper for /match `?campaignId` mode.
 *
 * Mounts the F003 RefineInputBar component inside the /match right
 * column (above AiSuggestionsSidebar). The bar refines the campaign's
 * smart-match top-30 pool without rendering the cards — the user sees
 * the success/cap/unparsable/network toast plus the Reset button, and
 * navigating to /campaigns/[id] picks up the same refine via the
 * shared `refine-{tenantId}-{campaignId}` cache key (per spec §5
 * 不变量 #7 cross-page state portability).
 *
 * Pool source (mount-time):
 *   1. Read `campaign-recommendations-{tenantId}-{campaignId}` cache —
 *      same key AiRecommendationPanel writes; if HIT and not expired,
 *      use the cached pool IDs immediately.
 *   2. If MISS, POST /api/kols/smart-match with the campaign's
 *      productId to fetch a fresh top-30. We do NOT write back into the
 *      smart-match cache — that path is owned by AiRecommendationPanel
 *      (and would race with its accept/skip/replaced bookkeeping if
 *      this component wrote too).
 *
 * If productId is null (deleted product) or the fetch fails, the bar
 * stays in an inert "unavailable" state — refine without a pool is a
 * no-op so we just don't render the input bar (parent panel surface
 * keeps the AiSuggestionsSidebar visible).
 */
import { useEffect, useRef, useState } from "react";

import {
  RefineInputBar,
  type RefineLabels,
  type RefineAppliedPayload,
} from "@/app/[locale]/(app)/campaigns/[id]/RefineInputBar";
import {
  refineCacheKey,
  readRefineCache,
  writeRefineCache,
  clearRefineCache,
} from "@/lib/refine-cache";

const TOP_K = 30;
const POOL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface SmartMatchCacheShape {
  pool: Array<{ id: string }>;
  fetchedAt: number;
}

function poolCacheKey(tenantId: string, campaignId: string): string {
  return `campaign-recommendations-${tenantId}-${campaignId}`;
}

function readPoolIdsFromCache(
  tenantId: string,
  campaignId: string,
): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      poolCacheKey(tenantId, campaignId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SmartMatchCacheShape;
    if (!Array.isArray(parsed.pool)) return null;
    if (typeof parsed.fetchedAt !== "number") return null;
    if (Date.now() - parsed.fetchedAt > POOL_CACHE_TTL_MS) return null;
    const ids = parsed.pool
      .map((k) => k?.id)
      .filter((id): id is string => typeof id === "string");
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

interface Props {
  campaignId: string;
  /** Null when the campaign's product was soft-deleted — bar stays inert. */
  productId: string | null;
  tenantId: string;
  locale: string;
  labels: RefineLabels;
}

export function MatchRefineBar({
  campaignId,
  productId,
  tenantId,
  locale,
  labels,
}: Props) {
  const refineKey = refineCacheKey(tenantId, campaignId);

  const [poolIds, setPoolIds] = useState<string[]>(
    () => readPoolIdsFromCache(tenantId, campaignId) ?? [],
  );
  // Pool-state machine: "ready" once we either hydrated from cache or a
  // fetch resolved; "fetching" while a server call is in flight;
  // "unavailable" when productId is null OR a fetch failed.
  const [poolState, setPoolState] = useState<
    "ready" | "fetching" | "unavailable"
  >(() => {
    if (productId == null) return "unavailable";
    const cached = readPoolIdsFromCache(tenantId, campaignId);
    return cached && cached.length > 0 ? "ready" : "fetching";
  });

  const [refineOrder, setRefineOrder] = useState<string[]>(
    () => readRefineCache(refineKey)?.orderedKolIds ?? [],
  );
  const [refineFeedback, setRefineFeedback] = useState<string | null>(
    () => readRefineCache(refineKey)?.feedback ?? null,
  );

  const didFetch = useRef(false);

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    if (productId == null) return;
    if (poolIds.length > 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/kols/smart-match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId, topK: TOP_K }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setPoolState("unavailable");
          return;
        }
        const data = (await res.json()) as { results?: Array<{ id: string }> };
        const ids = (data.results ?? [])
          .map((k) => k?.id)
          .filter((id): id is string => typeof id === "string");
        if (cancelled) return;
        if (ids.length === 0) {
          setPoolState("unavailable");
          return;
        }
        setPoolIds(ids);
        setPoolState("ready");
      } catch {
        if (cancelled) return;
        setPoolState("unavailable");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, poolIds.length]);

  const onRefineApplied = (payload: RefineAppliedPayload) => {
    setRefineOrder(payload.orderedKolIds);
    setRefineFeedback(payload.feedback);
    writeRefineCache(refineKey, {
      orderedKolIds: payload.orderedKolIds,
      feedback: payload.feedback,
      rawQuery: payload.rawQuery,
      createdAt: new Date().toISOString(),
    });
  };

  const onReset = () => {
    setRefineOrder([]);
    setRefineFeedback(null);
    clearRefineCache(refineKey);
  };

  if (poolState !== "ready" || poolIds.length === 0) {
    // Hidden when the pool isn't available — the existing
    // AiSuggestionsSidebar still renders below, so the campaign-context
    // experience is not blocked on this surface.
    return null;
  }

  return (
    <div data-testid="match-refine-bar">
      <RefineInputBar
        campaignId={campaignId}
        currentPoolIds={poolIds}
        locale={locale}
        hasRefineState={refineOrder.length > 0}
        lastFeedback={refineFeedback}
        onRefineApplied={onRefineApplied}
        onReset={onReset}
        labels={labels}
      />
    </div>
  );
}

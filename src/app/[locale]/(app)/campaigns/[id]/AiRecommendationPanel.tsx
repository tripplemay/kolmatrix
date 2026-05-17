"use client";

/**
 * BL-066-F003 · AI recommendation main panel (client component).
 *
 * Calls POST /api/kols/smart-match with productId + topK=30 on mount,
 * caches the 30-KOL candidate pool + per-KOL status in localStorage
 * (TTL 24h, key = campaign-recommendations-{tenantId}-{campaignId}),
 * renders 5 cards at a time with Accept / Skip / Replace ("Show next 5")
 * + view-profile.
 *
 * Status semantics (per audit §裁决 #E client-state):
 *   - pending  — visible card, awaiting Accept/Skip/Replace
 *   - accepted — server write via acceptKolToCampaignAction (F004)
 *   - skipped  — purely client state, hidden from next page
 *   - replaced — cycled past via "Show next 5", hidden until refetch
 *
 * When the visible-5 set drains (pool exhausted by accept/skip/replace),
 * the panel auto-refetches a fresh 30 from the endpoint. F006 takes
 * accepted rows over via AcceptedKolsPanel which reads kol_campaign;
 * a router.refresh() after Accept lets the server re-render the
 * downstream panel atomically.
 *
 * F002 skeleton (empty / loading visuals) is preserved verbatim — F003
 * just wires the fetch + state + interactions on top.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { acceptKolToCampaignAction } from "./recommend-actions";
import { readShortExplanationsBatchAction } from "./explainability-actions";
import { enqueueExplanationPrewarmAction } from "./prewarm-actions";
import {
  DetailedExplanationDialog,
  type DetailedExplanationLabels,
} from "./DetailedExplanationDialog";
import {
  RefineInputBar,
  type RefineLabels,
  type RefineAppliedPayload,
} from "./RefineInputBar";

interface KolHit {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
  countryCode: string | null;
  categories: string[];
  matchScore: number;
  valueScore: number | null;
}

interface EmptyLabels {
  eyebrow: string;
  heading: string;
  body: string;
  reconnectCta: string;
  kbCta: string;
  helpLink: string;
  info: string;
}

interface LoadingLabels {
  heading: string;
  badge: string;
  subtitle: string;
  whyEyebrow: string;
  footer: string;
}

interface ActiveLabels {
  heading: string;
  sourcedFrom: string;
  showNext: string;
  whyPrefix: string;
  whyTemplate: string;
  acceptCta: string;
  skipCta: string;
  viewProfileCta: string;
  followers: string;
  matchScore: string;
  noScore: string;
  errorBanner: string;
  retryCta: string;
  exhaustedBody: string;
  /** BL-067-F003 — aria-label for the per-card `?` icon trigger. */
  queryButtonLabel: string;
}

interface Labels {
  empty: EmptyLabels;
  loading: LoadingLabels;
  active: ActiveLabels;
  /** BL-067-F004 — DetailedExplanationDialog labels. */
  explainabilityDialog: DetailedExplanationLabels;
  /** BL-068-F003 — RefineInputBar labels (mounted above the pool). */
  refine: RefineLabels;
}

interface Props {
  productId: string | null;
  campaignId: string;
  tenantId: string;
  locale: string;
  labels: Labels;
}

interface CacheShape {
  pool: KolHit[];
  accepted: string[];
  skipped: string[];
  replaced: string[];
  fetchedAt: number;
}

const TOP_K = 30;
const VISIBLE_BATCH = 5;
const TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(tenantId: string, campaignId: string): string {
  return `campaign-recommendations-${tenantId}-${campaignId}`;
}

function readCache(key: string): CacheShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null;
    if (!Array.isArray(parsed.pool)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: CacheShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort — quota errors are silently ignored (BL-021 fix-1 pattern)
  }
}

// BL-068-F003 — independent refine cache (separate key + shape from the
// smart-match pool cache above). Per spec §5 不变量 #3 the 24h TTL is
// strict from createdAt (ISO8601 per spec); shared key namespace
// `refine-{tenantId}-{campaignId}` lets F004 /match?campaignId mode
// hydrate the same state on a different route.
interface RefineCacheShape {
  orderedKolIds: string[];
  feedback: string;
  rawQuery: string;
  /** ISO8601 timestamp (Date#toISOString). TTL computed via Date.parse. */
  createdAt: string;
}

function refineCacheKey(tenantId: string, campaignId: string): string {
  return `refine-${tenantId}-${campaignId}`;
}

function readRefineCache(key: string): RefineCacheShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RefineCacheShape;
    if (!Array.isArray(parsed.orderedKolIds)) return null;
    if (typeof parsed.createdAt !== "string") return null;
    const createdAtMs = Date.parse(parsed.createdAt);
    if (!Number.isFinite(createdAtMs)) return null;
    if (Date.now() - createdAtMs > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRefineCache(key: string, value: RefineCacheShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort — quota errors are silently ignored (BL-021 fix-1 pattern)
  }
}

function clearRefineCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

export function AiRecommendationPanel({
  productId,
  campaignId,
  tenantId,
  locale,
  labels,
}: Props) {
  if (productId == null) {
    return (
      <EmptyState
        campaignId={campaignId}
        locale={locale}
        labels={labels.empty}
      />
    );
  }

  return (
    <ActiveOrLoading
      productId={productId}
      campaignId={campaignId}
      tenantId={tenantId}
      locale={locale}
      labels={labels}
    />
  );
}

function ActiveOrLoading({
  productId,
  campaignId,
  tenantId,
  locale,
  labels,
}: {
  productId: string;
  campaignId: string;
  tenantId: string;
  locale: string;
  labels: Labels;
}) {
  const router = useRouter();
  const key = useMemo(
    () => cacheKey(tenantId, campaignId),
    [tenantId, campaignId]
  );
  const refineKey = useMemo(
    () => refineCacheKey(tenantId, campaignId),
    [tenantId, campaignId],
  );

  // Lazy initial state hydrates from localStorage on first render so the
  // initial paint shows cached cards (no skeleton flash) and there are
  // no setState-inside-useEffect calls (React 19 lint guards against it).
  // Each useState lazy initializer fires once on mount, so the five
  // readCache() calls cost one localStorage read each — negligible.
  const [pool, setPool] = useState<KolHit[]>(
    () => readCache(key)?.pool ?? []
  );
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(readCache(key)?.accepted ?? [])
  );
  const [skipped, setSkipped] = useState<Set<string>>(
    () => new Set(readCache(key)?.skipped ?? [])
  );
  const [replaced, setReplaced] = useState<Set<string>>(
    () => new Set(readCache(key)?.replaced ?? [])
  );
  const [loading, setLoading] = useState<boolean>(
    () => readCache(key) == null
  );
  const [error, setError] = useState<string | null>(null);
  // BL-068-F003 — refine order + last LLM feedback hydrated from the
  // independent refine cache. Empty array = no refine applied (default
  // valueScore desc ordering from the smart-match endpoint stands).
  const [refineOrder, setRefineOrder] = useState<string[]>(
    () => readRefineCache(refineKey)?.orderedKolIds ?? [],
  );
  const [refineFeedback, setRefineFeedback] = useState<string | null>(
    () => readRefineCache(refineKey)?.feedback ?? null,
  );
  // BL-067-F003 — per-KOL cached short explanation. `null` = cache miss
  // (render C2 fallback). Map shape avoids re-rendering when an unrelated
  // pool member changes (useMemo'd KolCard reads its own kolId only).
  const [shortExplanations, setShortExplanations] = useState<
    Record<string, string | null>
  >({});
  // BL-067-F004 — currently-open DetailedExplanationDialog target kolId
  // (null when closed). The dialog is mounted once at this scope so we
  // don't pay the React reconciliation cost of 30 hidden dialog trees.
  const [openDialogKolId, setOpenDialogKolId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const didInit = useRef(false);
  const hadCacheOnMount = useRef<boolean | null>(null);
  if (hadCacheOnMount.current === null) {
    hadCacheOnMount.current = readCache(key) != null;
  }

  const fetchPool = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kols/smart-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, topK: TOP_K }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "fetch_failed");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { results: KolHit[] };
      const next = Array.isArray(data.results) ? data.results : [];
      setPool(next);
      setReplaced(new Set());
      writeCache(key, {
        pool: next,
        accepted: Array.from(accepted),
        skipped: Array.from(skipped),
        replaced: [],
        fetchedAt: Date.now(),
      });
      // BL-067-F005 — fire-and-forget pre-warm enqueue. server action
      // idempotency key dedupes re-mounts inside the same process. We
      // do not await; the action's internal `jobQueue.add(...)` with
      // delay:1 returns in <10ms anyway. Empty pool = action noop.
      if (next.length > 0) {
        void enqueueExplanationPrewarmAction({
          campaignId,
          kolIds: next.map((k) => k.id),
        }).catch((err) => {
          console.error(
            "[BL-067-F005] enqueueExplanationPrewarmAction failed:",
            err,
          );
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [productId, campaignId, key, accepted, skipped]);

  // Fetch fresh on first mount only when no cached pool was hydrated.
  // (Lazy initial state above handled the cache-hit branch — no setState
  // calls land inside this effect on that path.)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!hadCacheOnMount.current) {
      void fetchPool();
    }
  }, [fetchPool]);

  // Persist on state change (debounced via React batching).
  useEffect(() => {
    if (!didInit.current || pool.length === 0) return;
    writeCache(key, {
      pool,
      accepted: Array.from(accepted),
      skipped: Array.from(skipped),
      replaced: Array.from(replaced),
      fetchedAt: Date.now(),
    });
  }, [pool, accepted, skipped, replaced, key]);

  // BL-067-F003 — batch-read pre-warmed short explanations on pool / locale
  // change. Misses render the C2 fallback (per spec §5 不变量 #4 silent),
  // server-action errors degrade to all-miss without surfacing a toast.
  // Pool size is bounded by TOP_K=30 + MAX_KOL_IDS=60 server guard.
  useEffect(() => {
    if (pool.length === 0) return;
    const kolIds = pool.map((k) => k.id);
    let cancelled = false;
    void readShortExplanationsBatchAction({
      campaignId,
      kolIds,
      locale,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setShortExplanations(res.results);
        }
        // !res.ok → silent — keep prior state, C2 fallback already in
        // place for empty entries.
      })
      .catch((err) => {
        // Network / parse failure: silent fallback per spec §5 不变量 #4.
        console.error("[BL-067-F003] readShortExplanationsBatch failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [pool, campaignId, locale]);

  const visible = useMemo(() => {
    const base = pool.filter(
      (k) => !accepted.has(k.id) && !skipped.has(k.id) && !replaced.has(k.id),
    );
    if (refineOrder.length === 0) {
      return base.slice(0, VISIBLE_BATCH);
    }
    // Apply refine order: items present in refineOrder sort by their
    // position there; items absent from refineOrder (e.g. pool refetched
    // with new KOLs that the refine didn't see) fall to the tail in
    // their original pool order. We do not drop them — the user should
    // still see the rest of the pool, just demoted below the refined set.
    const posMap = new Map(refineOrder.map((id, idx) => [id, idx]));
    const sorted = [...base].sort((a, b) => {
      const pa = posMap.has(a.id) ? posMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const pb = posMap.has(b.id) ? posMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });
    return sorted.slice(0, VISIBLE_BATCH);
  }, [pool, accepted, skipped, replaced, refineOrder]);

  const onAccept = useCallback(
    (kol: KolHit) => {
      startTransition(async () => {
        const res = await acceptKolToCampaignAction({
          campaignId,
          kolId: kol.id,
          matchScore: kol.matchScore,
        });
        if (res.ok) {
          setAccepted((prev) => {
            const next = new Set(prev);
            next.add(kol.id);
            return next;
          });
          router.refresh();
        } else {
          setError(res.error);
        }
      });
    },
    [campaignId, router]
  );

  const onSkip = useCallback((kolId: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      next.add(kolId);
      return next;
    });
  }, []);

  const onReplaceAll = useCallback(() => {
    if (visible.length === 0) {
      void fetchPool();
      return;
    }
    setReplaced((prev) => {
      const next = new Set(prev);
      for (const k of visible) next.add(k.id);
      return next;
    });
  }, [visible, fetchPool]);

  // BL-068-F003 — refine apply / reset handlers. Apply writes the
  // ordered IDs + feedback to the independent refine cache (24h TTL
  // ISO8601 per spec §5 不变量 #3); reset removes the cache entirely so
  // the next mount falls through to the default valueScore desc order.
  const onRefineApplied = useCallback(
    (payload: RefineAppliedPayload) => {
      setRefineOrder(payload.orderedKolIds);
      setRefineFeedback(payload.feedback);
      writeRefineCache(refineKey, {
        orderedKolIds: payload.orderedKolIds,
        feedback: payload.feedback,
        rawQuery: payload.rawQuery,
        createdAt: new Date().toISOString(),
      });
    },
    [refineKey],
  );

  const onRefineReset = useCallback(() => {
    setRefineOrder([]);
    setRefineFeedback(null);
    clearRefineCache(refineKey);
  }, [refineKey]);

  if (loading) {
    return <LoadingSkeleton labels={labels.loading} />;
  }

  if (error && pool.length === 0) {
    return (
      <ErrorBanner
        message={`${labels.active.errorBanner} (${error})`}
        retryLabel={labels.active.retryCta}
        onRetry={() => void fetchPool()}
      />
    );
  }

  const openDialogKol =
    openDialogKolId == null
      ? null
      : pool.find((k) => k.id === openDialogKolId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <RefineInputBar
        campaignId={campaignId}
        currentPoolIds={visible.map((k) => k.id)}
        locale={locale}
        hasRefineState={refineOrder.length > 0}
        lastFeedback={refineFeedback}
        onRefineApplied={onRefineApplied}
        onReset={onRefineReset}
        labels={labels.refine}
      />
      <ActivePanel
        visible={visible}
        pool={pool}
        labels={labels.active}
        locale={locale}
        onAccept={onAccept}
        onSkip={onSkip}
        onReplaceAll={onReplaceAll}
        bannerError={error}
        shortExplanations={shortExplanations}
        onOpenDialog={setOpenDialogKolId}
      />
      {openDialogKol ? (
        <DetailedExplanationDialog
          open={openDialogKolId !== null}
          onClose={() => setOpenDialogKolId(null)}
          kolId={openDialogKol.id}
          campaignId={campaignId}
          kolHandle={openDialogKol.handle}
          locale={locale}
          labels={labels.explainabilityDialog}
        />
      ) : null}
    </div>
  );
}

function ActivePanel({
  visible,
  pool,
  labels,
  locale,
  onAccept,
  onSkip,
  onReplaceAll,
  bannerError,
  shortExplanations,
  onOpenDialog,
}: {
  visible: KolHit[];
  pool: KolHit[];
  labels: ActiveLabels;
  locale: string;
  onAccept: (kol: KolHit) => void;
  onSkip: (kolId: string) => void;
  onReplaceAll: () => void;
  bannerError: string | null;
  shortExplanations: Record<string, string | null>;
  onOpenDialog: (kolId: string) => void;
}) {
  return (
    <section
      className="relative flex flex-col gap-4"
      data-testid="campaign-ai-recommendation-active"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined animate-pulse text-[24px] text-cyan-fixed"
            aria-hidden
          >
            auto_awesome
          </span>
          <h2 className="text-xl font-semibold text-white">
            {labels.heading}
          </h2>
          <span className="rounded border border-outline-variant/20 bg-surface-highest px-2 py-1 font-mono text-xs text-on-surface-variant">
            {labels.sourcedFrom}
          </span>
        </div>
        <button
          type="button"
          onClick={onReplaceAll}
          className="flex items-center gap-2 rounded-lg border border-cyan/30 px-3 py-1.5 text-sm font-medium text-cyan-fixed transition-colors hover:bg-cyan/10"
          data-testid="campaign-ai-recommendation-show-next"
        >
          <span
            className="material-symbols-outlined text-[16px]"
            aria-hidden
          >
            refresh
          </span>
          {labels.showNext}
        </button>
      </div>

      {bannerError ? (
        <div
          className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-sm text-error"
          data-testid="campaign-ai-recommendation-banner-error"
        >
          {labels.errorBanner} ({bannerError})
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div
          className="rounded-[16px] border border-outline-variant/20 bg-surface-low p-8 text-center text-sm text-on-surface-variant"
          data-testid="campaign-ai-recommendation-exhausted"
        >
          {labels.exhaustedBody}
          <div className="mt-4">
            <button
              type="button"
              onClick={onReplaceAll}
              className="gradient-cta inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-on-primary"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden
              >
                refresh
              </span>
              {labels.showNext}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((kol) => (
            <KolCard
              key={kol.id}
              kol={kol}
              labels={labels}
              locale={locale}
              onAccept={() => onAccept(kol)}
              onSkip={() => onSkip(kol.id)}
              shortExplanation={shortExplanations[kol.id] ?? null}
              onOpenDialog={() => onOpenDialog(kol.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-on-surface-variant/70">
        {labels.matchScore}: {visible.length}/{pool.length}
      </p>
    </section>
  );
}

function KolCard({
  kol,
  labels,
  locale,
  onAccept,
  onSkip,
  shortExplanation,
  onOpenDialog,
}: {
  kol: KolHit;
  labels: ActiveLabels;
  locale: string;
  onAccept: () => void;
  onSkip: () => void;
  /**
   * BL-067-F003 — pre-warmed LLM 1-sentence explanation (cache HIT) or
   * `null` (cache MISS → C2 fallback). Always render the `?` trigger
   * regardless of hit/miss per spec §5 不变量 #6.
   */
  shortExplanation: string | null;
  /** BL-067-F004 — invoked when the `?` icon is clicked. */
  onOpenDialog: () => void;
}) {
  const valueScoreLabel =
    kol.valueScore == null ? labels.noScore : String(kol.valueScore);
  const c2Fallback = labels.whyTemplate
    .replace("{matchScore}", String(kol.matchScore))
    .replace("{valueScore}", valueScoreLabel);
  const why = shortExplanation ?? c2Fallback;

  return (
    <article
      className="glass-panel group relative flex flex-col gap-4 rounded-[16px] border border-on-surface/5 p-5 transition-all hover:border-cyan/40 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)]"
      data-testid="campaign-ai-recommendation-card"
      data-kol-id={kol.id}
    >
      <button
        type="button"
        data-testid={`explain-trigger-${kol.id}`}
        aria-label={labels.queryButtonLabel}
        title={labels.queryButtonLabel}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant/30 bg-surface/80 text-on-surface-variant transition-colors hover:border-cyan/40 hover:text-cyan-fixed"
        onClick={onOpenDialog}
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          help_outline
        </span>
      </button>
      <div className="flex gap-4">
        {kol.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kol.avatarUrl}
            alt={kol.displayName}
            className="h-14 w-14 rounded-xl border border-outline-variant/30 object-cover group-hover:border-cyan/50"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-outline-variant/30 bg-surface text-sm font-bold text-on-surface-variant"
            aria-hidden
          >
            {kol.displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex flex-1 flex-col">
          <div className="flex items-start justify-between">
            <h3 className="text-base font-semibold text-white">
              {kol.displayName}
            </h3>
            <div className="flex items-center gap-1 rounded border border-cyan/20 bg-surface-highest px-2 py-0.5 text-cyan-fixed">
              <span
                className="material-symbols-outlined text-[14px]"
                aria-hidden
              >
                bolt
              </span>
              <span className="text-sm font-bold">{kol.matchScore}</span>
            </div>
          </div>
          <div className="mt-1.5 flex gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${platformChipClass(kol.platform)}`}
            >
              {kol.platform}
            </span>
            {kol.categories[0] ? (
              <span className="rounded border border-outline-variant/30 bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
                {kol.categories[0]}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative rounded-lg border border-outline-variant/10 bg-surface-low/50 p-3 text-sm text-on-surface-variant">
        <span
          className="material-symbols-outlined absolute right-3 top-3 text-[14px] text-purple opacity-50"
          aria-hidden
        >
          psychology
        </span>
        <p className="pr-6">
          <strong className="font-medium text-cyan-fixed">
            {labels.whyPrefix}:
          </strong>{" "}
          {why}
        </p>
      </div>

      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 rounded-lg border border-cyan/30 bg-cyan/10 py-2 text-sm font-semibold text-cyan-fixed transition-colors hover:bg-cyan/20"
          data-testid="campaign-ai-recommendation-accept"
        >
          {labels.acceptCta}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-bright"
          title={labels.skipCta}
          aria-label={labels.skipCta}
          data-testid="campaign-ai-recommendation-skip"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            aria-hidden
          >
            close
          </span>
        </button>
        <Link
          href={`/${locale}/kols/${kol.id}`}
          className="rounded-lg border border-outline-variant/30 bg-surface px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-bright"
          title={labels.viewProfileCta}
          aria-label={labels.viewProfileCta}
          data-testid="campaign-ai-recommendation-view-profile"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            aria-hidden
          >
            open_in_new
          </span>
        </Link>
      </div>
    </article>
  );
}

function platformChipClass(platform: string): string {
  // Stitch main.html line 269-272 / 302-305 used hardcoded HEX for
  // platform chips; per F002 audit §4 漂移 #5 they are F003 scope and
  // mapped here to project tokens. YouTube + Twitch + TikTok retain a
  // distinct hue from the surface palette while staying within the
  // Neural Velocity design system.
  switch (platform.toLowerCase()) {
    case "youtube":
      return "border-error/40 bg-error/10 text-error";
    case "twitch":
      return "border-purple-container/40 bg-purple-container/20 text-purple";
    case "tiktok":
      return "border-cyan/30 bg-cyan/10 text-cyan-fixed";
    default:
      return "border-outline-variant/30 bg-surface text-on-surface-variant";
  }
}

function EmptyState({
  campaignId,
  locale,
  labels,
}: {
  campaignId: string;
  locale: string;
  labels: EmptyLabels;
}) {
  return (
    <section
      className="flex min-h-[400px] flex-col items-center justify-center rounded-[16px] border border-outline-variant/20 bg-surface-low p-8 text-center shadow-[0_4px_30px_rgba(0,0,0,0.2)]"
      data-testid="campaign-ai-recommendation-empty"
    >
      <div className="relative mb-6 flex h-[120px] w-[120px] items-center justify-center">
        <div
          className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border-2 border-dashed border-slate-500/30"
          aria-hidden
        />
        <div className="relative flex h-[80px] w-[80px] items-center justify-center rounded-full bg-cyan/10 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
          <span
            className="material-symbols-outlined text-[40px] text-cyan-fixed"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden
          >
            auto_awesome
          </span>
          <div
            className="absolute inset-0 rounded-full bg-cyan opacity-20 blur-[20px]"
            aria-hidden
          />
        </div>
      </div>

      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-fixed">
        {labels.eyebrow}
      </span>
      <h2 className="mb-3 text-[22px] font-bold tracking-tight text-white">
        {labels.heading}
      </h2>
      <p className="mb-8 max-w-[400px] text-sm leading-relaxed text-slate-300">
        {labels.body}
      </p>

      <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
        <Link
          href={`/${locale}/campaigns/${campaignId}/edit`}
          className="gradient-cta inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-on-primary shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-opacity hover:opacity-90"
          data-testid="campaign-ai-recommendation-reconnect-link"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            hub
          </span>
          {labels.reconnectCta}
        </Link>
        <Link
          href={`/${locale}/products`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-outline-variant/50 bg-transparent py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-highest"
          data-testid="campaign-ai-recommendation-kb-link"
        >
          {labels.kbCta}
        </Link>
        <span className="mt-2 text-[13px] font-medium text-cyan-fixed">
          {labels.helpLink}
        </span>
      </div>

      <div className="mt-8 w-full max-w-[400px] border-t border-outline-variant/30 pt-6">
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            info
          </span>
          {labels.info}
        </p>
      </div>
    </section>
  );
}

function LoadingSkeleton({ labels }: { labels: LoadingLabels }) {
  return (
    <section
      className="relative overflow-hidden rounded-[16px] border border-surface-highest/50 bg-surface-low p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      data-testid="campaign-ai-recommendation-loading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cyan/5 blur-[80px]"
        aria-hidden
      />

      <div className="relative z-10 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined animate-pulse text-[24px] text-cyan"
            aria-hidden
          >
            auto_awesome
          </span>
          <h2 className="text-[20px] font-bold tracking-tight text-white">
            {labels.heading}
          </h2>
          <span className="flex items-center gap-1.5 rounded-full border border-surface-highest bg-surface-highest px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
            <span
              className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan"
              aria-hidden
            />
            {labels.badge}
          </span>
        </div>
        <div className="animate-pulse text-sm font-medium text-cyan/70">
          {labels.subtitle}
        </div>
      </div>

      <div className="campaign-ai-recommendation-progress mb-8" aria-hidden />

      <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <SkeletonCard key={idx} whyEyebrow={labels.whyEyebrow} />
        ))}
      </div>

      <div className="relative z-10 mt-6 text-center">
        <p className="text-[12px] italic text-slate-500">{labels.footer}</p>
      </div>
    </section>
  );
}

function SkeletonCard({ whyEyebrow }: { whyEyebrow: string }) {
  return (
    <div className="rounded-[12px] border border-surface-highest/30 bg-surface p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="campaign-ai-recommendation-shimmer h-11 w-11 rounded-full" />
        <div className="campaign-ai-recommendation-shimmer h-12 w-12 rounded-full" />
      </div>
      <div className="mb-4 space-y-2">
        <div className="campaign-ai-recommendation-shimmer h-4 w-3/4 rounded" />
        <div className="campaign-ai-recommendation-shimmer h-3 w-1/2 rounded" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="campaign-ai-recommendation-shimmer h-5 w-16 rounded-full" />
        <div className="campaign-ai-recommendation-shimmer h-5 w-12 rounded-full" />
      </div>
      <div className="mb-4">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {whyEyebrow}
        </span>
        <div className="campaign-ai-recommendation-shimmer mb-1 h-3 w-full rounded" />
        <div className="campaign-ai-recommendation-shimmer h-3 w-4/5 rounded" />
      </div>
      <div className="mt-auto flex gap-2">
        <div className="campaign-ai-recommendation-shimmer h-8 w-full rounded opacity-40" />
        <div className="campaign-ai-recommendation-shimmer h-8 w-8 shrink-0 rounded opacity-40" />
      </div>
    </div>
  );
}

function ErrorBanner({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <section
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-[16px] border border-error/30 bg-error/10 p-8 text-center"
      data-testid="campaign-ai-recommendation-error"
    >
      <p className="text-sm text-error">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-error/40 bg-error/10 px-4 py-2 text-sm font-semibold text-error hover:bg-error/20"
      >
        {retryLabel}
      </button>
    </section>
  );
}

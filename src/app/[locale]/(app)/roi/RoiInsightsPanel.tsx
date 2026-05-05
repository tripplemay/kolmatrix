/**
 * BM2-F009 · AI Insights right-side panel (Planner adjudication
 * §13 #I:A + §13.5 #2 — no hardcoded examples; idle state shows a
 * single "Generate AI Insights" CTA so Reviewer doesn't flag the
 * Stitch examples as ghost controls).
 *
 * Cache key:    `roi-insights-{tenantId}-{YYYYMMDD}` (UTC)
 * Cache value:  { insights, traceId, generatedAt }
 * Refresh:      "Regenerate" purges cache + fires action again
 *
 * Top-bar `<RoiHeaderAiButton>` smooth-scrolls here and dispatches a
 * `roi-insights-trigger` window event; we listen and auto-fire on
 * first call only (2s debounce per Planner §13.5 #8).
 */
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import type { RoiInsightItem } from "@/lib/roi/insights";
import type { RoiRange } from "@/lib/roi/range";

import { generateRoiInsightsAction } from "./actions";

interface Props {
  tenantId: string;
  locale: "en" | "zh";
  range: RoiRange;
  labels: {
    title: string;
    idleHint: string;
    generate: string;
    regenerate: string;
    loading: string;
    cachedPrefix: string;
    error: {
      missing_env: string;
      http_error: string;
      invalid_response: string;
      timeout: string;
      unauthorized: string;
      generic: string;
    };
  };
}

interface CachePayload {
  insights: RoiInsightItem[];
  traceId?: string;
  generatedAt: string; // ISO
}

function utcDayKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function cacheKey(tenantId: string): string {
  return `roi-insights-${tenantId}-${utcDayKey()}`;
}

function readCache(tenantId: string): CachePayload | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(tenantId));
    if (!raw) return null;
    return JSON.parse(raw) as CachePayload;
  } catch {
    return null;
  }
}

function writeCache(tenantId: string, payload: CachePayload): void {
  try {
    window.localStorage.setItem(cacheKey(tenantId), JSON.stringify(payload));
  } catch {
    // localStorage may be disabled (private mode); silently skip.
  }
}

function clearCache(tenantId: string): void {
  try {
    window.localStorage.removeItem(cacheKey(tenantId));
  } catch {
    // ignore
  }
}

// Keep useSyncExternalStore from re-creating snapshots on every read
// (which would loop infinitely). We memo per tenant cache key + bump
// the version when our own writes invalidate it.
const cacheVersion = new Map<string, number>();
const cacheSnapshot = new Map<string, CachePayload | null>();

function bumpCacheVersion(tenantId: string): void {
  cacheVersion.set(tenantId, (cacheVersion.get(tenantId) ?? 0) + 1);
  cacheSnapshot.delete(tenantId);
  window.dispatchEvent(new CustomEvent("roi-insights-cache-bump"));
}

function subscribeCache(callback: () => void): () => void {
  window.addEventListener("roi-insights-cache-bump", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("roi-insights-cache-bump", callback);
    window.removeEventListener("storage", callback);
  };
}

function getCacheSnapshot(tenantId: string): CachePayload | null {
  if (cacheSnapshot.has(tenantId)) {
    return cacheSnapshot.get(tenantId) ?? null;
  }
  const value = readCache(tenantId);
  cacheSnapshot.set(tenantId, value);
  return value;
}

function toneClasses(tone: RoiInsightItem["tone"]): string {
  if (tone === "positive") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-cyan/30 bg-cyan/5 text-on-surface";
}

function toneIcon(tone: RoiInsightItem["tone"]): string {
  if (tone === "positive") return "trending_up";
  if (tone === "warning") return "warning";
  return "lightbulb";
}

export function RoiInsightsPanel({ tenantId, locale, range, labels }: Props) {
  // Hydrate cached insights via useSyncExternalStore so the React 19
  // "no setState in effect" rule is satisfied — localStorage is the
  // external store. Server snapshot is always null (matches initial
  // client render before hydration).
  const cached = useSyncExternalStore(
    subscribeCache,
    () => getCacheSnapshot(tenantId),
    () => null
  );
  const [error, setError] = useState<keyof Props["labels"]["error"] | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const lastFireRef = useRef<number>(0);

  const insights = cached?.insights ?? null;
  const generatedAt = cached?.generatedAt ?? null;

  const runGenerate = useCallback(() => {
    const now = Date.now();
    if (now - lastFireRef.current < 2_000) return;
    lastFireRef.current = now;
    setError(null);
    startTransition(async () => {
      const res = await generateRoiInsightsAction(locale, range);
      if (!res.ok) {
        const code = res.error;
        const known: Array<keyof Props["labels"]["error"]> = [
          "missing_env",
          "http_error",
          "invalid_response",
          "timeout",
          "unauthorized",
        ];
        setError(
          (known as string[]).includes(code)
            ? (code as keyof Props["labels"]["error"])
            : "generic"
        );
        return;
      }
      const stamp = new Date().toISOString();
      writeCache(tenantId, {
        insights: res.insights,
        traceId: res.traceId,
        generatedAt: stamp,
      });
      bumpCacheVersion(tenantId);
    });
  }, [tenantId, locale, range]);

  const handleRegenerate = useCallback(() => {
    clearCache(tenantId);
    bumpCacheVersion(tenantId);
    runGenerate();
  }, [tenantId, runGenerate]);

  // Listen for top-bar button event — only auto-fire if there's no
  // cache yet (otherwise scroll-only via the button's own handler).
  useEffect(() => {
    const handler = () => {
      if (!insights) runGenerate();
    };
    window.addEventListener("roi-insights-trigger", handler);
    return () => window.removeEventListener("roi-insights-trigger", handler);
  }, [insights, runGenerate]);

  return (
    <article
      id="roi-insights-panel"
      data-testid="roi-insights-panel"
      className="flex h-full flex-col gap-4 rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent p-5"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-white">{labels.title}</h2>
        {generatedAt ? (
          <p className="text-[11px] text-on-surface-variant/80">
            {labels.cachedPrefix}{" "}
            <time dateTime={generatedAt}>
              {new Date(generatedAt).toLocaleString()}
            </time>
          </p>
        ) : null}
      </header>

      {insights == null && !isPending && !error ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
          data-testid="roi-insights-idle"
        >
          <span
            aria-hidden
            className="material-symbols-outlined text-3xl text-cyan/60"
          >
            auto_awesome
          </span>
          <p className="text-xs text-on-surface-variant">{labels.idleHint}</p>
          <button
            type="button"
            onClick={runGenerate}
            data-testid="roi-insights-generate"
            className="rounded-xl bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] px-4 py-2 text-xs font-bold text-on-primary"
          >
            {labels.generate}
          </button>
        </div>
      ) : null}

      {isPending ? (
        <div
          data-testid="roi-insights-loading"
          className="flex flex-1 items-center justify-center text-xs text-on-surface-variant"
        >
          {labels.loading}
        </div>
      ) : null}

      {error && !isPending ? (
        <div
          data-testid="roi-insights-error"
          className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
        >
          <span
            aria-hidden
            className="material-symbols-outlined text-3xl text-error/80"
          >
            error
          </span>
          <p className="text-xs text-error">{labels.error[error]}</p>
          <button
            type="button"
            onClick={runGenerate}
            className="rounded-xl bg-surface-container-high/70 px-4 py-2 text-xs font-bold text-on-surface"
          >
            {labels.regenerate}
          </button>
        </div>
      ) : null}

      {insights && !isPending && !error ? (
        <ul
          className="flex flex-1 flex-col gap-3 overflow-y-auto"
          data-testid="roi-insights-list"
        >
          {insights.map((item, idx) => (
            <li
              key={idx}
              className={`rounded-xl border px-4 py-3 ${toneClasses(item.tone)}`}
            >
              <div className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="material-symbols-outlined mt-0.5 text-[18px]"
                >
                  {toneIcon(item.tone)}
                </span>
                <div>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed">{item.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {insights && !isPending ? (
        <button
          type="button"
          onClick={handleRegenerate}
          data-testid="roi-insights-regenerate"
          className="self-start rounded-xl bg-surface-container-high/50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface"
        >
          {labels.regenerate}
        </button>
      ) : null}
    </article>
  );
}

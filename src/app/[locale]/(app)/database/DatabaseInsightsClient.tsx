"use client";

import { useCallback, useState, useTransition } from "react";

import type { DatabaseIntelligenceInsight } from "@/lib/kol-database/intelligence";

import { Button } from "@/components/ui";

import { generateDatabaseInsightsAction } from "./actions";

interface Props {
  tenantId: string;
  locale: string;
  labels: {
    generate: string;
    refresh: string;
    loading: string;
    cachedPrefix: string;
    empty: string;
    error: string;
  };
}

interface CachePayload {
  generatedAt: string;
  insights: DatabaseIntelligenceInsight[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(tenantId: string): string {
  return `database-insights-${tenantId}`;
}

function readCache(tenantId: string): CachePayload | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed.generatedAt || !Array.isArray(parsed.insights)) return null;
    if (Date.now() - new Date(parsed.generatedAt).getTime() > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(tenantId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(tenantId: string, payload: CachePayload): void {
  try {
    window.localStorage.setItem(cacheKey(tenantId), JSON.stringify(payload));
  } catch {
    // ignore localStorage failures
  }
}

function clearCache(tenantId: string): void {
  try {
    window.localStorage.removeItem(cacheKey(tenantId));
  } catch {
    // ignore
  }
}

function iconForType(type: DatabaseIntelligenceInsight["type"]): string {
  if (type === "opportunity") return "north_east";
  if (type === "gap") return "warning";
  return "insights";
}

export function DatabaseInsightsClient({ tenantId, locale, labels }: Props) {
  const [cache, setCache] = useState<CachePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runGenerate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const cached = readCache(tenantId);
      if (cached) {
        setCache(cached);
        return;
      }

      const res = await generateDatabaseInsightsAction(locale);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const payload = {
        generatedAt: new Date().toISOString(),
        insights: res.insights,
      };
      writeCache(tenantId, payload);
      setCache(payload);
    });
  }, [locale, tenantId]);

  const handleRefresh = useCallback(() => {
    clearCache(tenantId);
    setCache(null);
    runGenerate();
  }, [tenantId, runGenerate]);

  const generatedAt = cache?.generatedAt;
  const insights = cache?.insights ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {generatedAt ? (
          <p className="text-[11px] text-on-surface-variant/70">
            {labels.cachedPrefix} {new Date(generatedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-[11px] text-on-surface-variant/70">{labels.empty}</p>
        )}

        {cache ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleRefresh}
            className="h-8 px-3 text-[11px]"
          >
            {labels.refresh}
          </Button>
        ) : null}
      </div>

      {insights.length > 0 ? (
        <ul className="space-y-2" data-testid="database-ai-insights-list">
          {insights.slice(0, 2).map((item, idx) => (
            <li
              key={`${item.type}-${idx}`}
              className="rounded-xl border border-cyan/25 bg-cyan/5 p-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className="material-symbols-outlined mt-0.5 text-[16px] text-cyan"
                  aria-hidden
                >
                  {iconForType(item.type)}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface">
                    {item.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-xs text-error">{labels.error}</p> : null}

      {!cache ? (
        <Button
          type="button"
          onClick={runGenerate}
          variant="primary-gradient"
          className="w-full"
          disabled={isPending}
          data-testid="database-ai-generate"
        >
          {isPending ? labels.loading : labels.generate}
        </Button>
      ) : null}
    </div>
  );
}

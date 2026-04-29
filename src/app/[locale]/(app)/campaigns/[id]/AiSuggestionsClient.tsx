"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui";

import { generateCampaignSuggestionsAction } from "./ai-suggestions-actions";

interface Suggestion {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action_link: string;
  action_label: string;
}

interface CachePayload {
  generatedAt: string;
  suggestions: Suggestion[];
}

interface Props {
  tenantId: string;
  campaignId: string;
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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(tenantId: string, campaignId: string): string {
  return `campaign-suggest-${tenantId}-${campaignId}`;
}

function readCache(tenantId: string, campaignId: string): CachePayload | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(tenantId, campaignId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed.generatedAt || !Array.isArray(parsed.suggestions)) return null;
    if (Date.now() - new Date(parsed.generatedAt).getTime() > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(tenantId, campaignId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(tenantId: string, campaignId: string, payload: CachePayload): void {
  try {
    window.localStorage.setItem(cacheKey(tenantId, campaignId), JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function clearCache(tenantId: string, campaignId: string): void {
  try {
    window.localStorage.removeItem(cacheKey(tenantId, campaignId));
  } catch {
    // ignore
  }
}

function priorityTone(priority: Suggestion["priority"]): string {
  if (priority === "high") return "text-error";
  if (priority === "medium") return "text-amber-300";
  return "text-cyan";
}

export function AiSuggestionsClient({
  tenantId,
  campaignId,
  locale,
  labels,
}: Props) {
  const [cache, setCache] = useState<CachePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runGenerate = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const cached = readCache(tenantId, campaignId);
      if (cached) {
        setCache(cached);
        return;
      }

      const res = await generateCampaignSuggestionsAction(campaignId, locale);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const payload = {
        generatedAt: new Date().toISOString(),
        suggestions: res.suggestions,
      };
      writeCache(tenantId, campaignId, payload);
      setCache(payload);
    });
  }, [tenantId, campaignId, locale]);

  const handleRefresh = useCallback(() => {
    clearCache(tenantId, campaignId);
    setCache(null);
    runGenerate();
  }, [tenantId, campaignId, runGenerate]);

  return (
    <div className="space-y-2">
      {cache ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-on-surface-variant/70">
            {labels.cachedPrefix} {new Date(cache.generatedAt).toLocaleString()}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
          >
            {labels.refresh}
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-on-surface-variant/70">{labels.empty}</p>
      )}

      {cache?.suggestions?.length ? (
        <ul className="space-y-2" data-testid="campaign-ai-suggestions-list">
          {cache.suggestions.map((s, i) => (
            <li key={`${s.priority}-${i}`} className="rounded-lg border border-outline-variant/40 p-2">
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${priorityTone(s.priority)}`}>
                {s.priority}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{s.title}</p>
              <p className="mt-1 text-xs text-on-surface">{s.description}</p>
              <a
                href={`/${locale}${s.action_link.startsWith("/") ? s.action_link : "/campaigns"}`}
                className="mt-2 inline-flex text-xs font-semibold text-cyan hover:underline"
                data-testid="campaign-suggestion-link"
              >
                {s.action_label}
              </a>
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
          data-testid="campaign-ai-generate"
        >
          {isPending ? labels.loading : labels.generate}
        </Button>
      ) : null}
    </div>
  );
}

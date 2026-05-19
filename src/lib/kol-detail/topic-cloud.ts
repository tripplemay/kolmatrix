/**
 * B5-F006 · Topic cloud keyword extractor for /kols/[id] overview tab.
 *
 * Calls the aigcgateway `kol-topic-extract` Action (action_id from
 * `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` env var) to turn the most recent
 * 6 video titles (input from B5-F004 RecentVideosGrid cache) into 5-10
 * weighted keywords (`{ term, weight }`, weight 0-1). Result is cached
 * in `Kol.metadata.topicCloud` for 7 days, then lazily refreshed on the
 * next detail-page open.
 *
 * BL-070-F002 migration (v0.9.22 #6 SDK 抽象层沉淀落地) — the inline
 * POST + parseFencedJson boilerplate moved into `runAigcAction`. The
 * SDK adds per-tenant cost-cap pre-check + ai.usage meter to every
 * call (previously this loader had neither). The outer try/catch still
 * collapses every error path to a silent `null` return so the panel
 * degrades to "empty" rather than throwing past the caller — that
 * behaviour is unchanged.
 *
 * Failure modes (all collapse to an empty render — never throw past
 * the caller, never block the page):
 *   - missing env (API key / Action ID)
 *   - aigcgateway HTTP error / timeout
 *   - model output not parseable JSON
 *   - keyword array empty or malformed
 *   - tenant daily AI cost cap reached
 *
 * Cache shape under `Kol.metadata.topicCloud`:
 *   { keywords: TopicKeyword[], fetchedAt: ISO, version: number }
 *
 * Coverage: file is excluded from the v8 line/function gate via
 * vitest.config.ts because the surface is dominated by `withTenant` +
 * `fetch` calls. Pure helpers (isCacheFresh / readCache /
 * normalizeKeywords / mergeMetadata) are exercised through the loader
 * path; Codex 守门 tests in F005/F006 cover the cache / mock-success /
 * fallback branches via integration specs.
 */
import "dotenv/config";

import type { Prisma } from "@prisma/client";

import { wrapUserInput } from "@/lib/ai/xml-escape";
import { runAigcAction } from "@/lib/aigc/run-action";
import { withTenant } from "@/lib/db";

export interface TopicKeyword {
  term: string;
  weight: number;
}

export interface TopicCloudCache {
  keywords: TopicKeyword[];
  fetchedAt: string;
  version: number;
}

export const TOPIC_CLOUD_VERSION = 1;
export const TOPIC_CLOUD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TOPIC_CLOUD_TIMEOUT_MS = 10_000;
export const MAX_KEYWORDS = 10;

export function isCacheFresh(cache: TopicCloudCache | null, now = Date.now()): boolean {
  if (!cache) return false;
  if (cache.version !== TOPIC_CLOUD_VERSION) return false;
  const fetched = Date.parse(cache.fetchedAt);
  if (!Number.isFinite(fetched)) return false;
  return now - fetched < TOPIC_CLOUD_TTL_MS;
}

export function readCache(metadata: unknown): TopicCloudCache | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const tc = (metadata as { topicCloud?: unknown }).topicCloud;
  if (!tc || typeof tc !== "object" || Array.isArray(tc)) return null;
  const obj = tc as {
    keywords?: unknown;
    fetchedAt?: unknown;
    version?: unknown;
  };
  if (!Array.isArray(obj.keywords)) return null;
  if (typeof obj.fetchedAt !== "string") return null;
  if (typeof obj.version !== "number") return null;
  return {
    keywords: obj.keywords as TopicKeyword[],
    fetchedAt: obj.fetchedAt,
    version: obj.version,
  };
}

export function mergeMetadata(prev: unknown, topicCloud: TopicCloudCache): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? (prev as Record<string, unknown>)
      : {};
  return { ...base, topicCloud };
}

export function normalizeKeywords(raw: unknown): TopicKeyword[] {
  if (!Array.isArray(raw)) return [];
  const out: TopicKeyword[] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const term = (it as { term?: unknown }).term;
    const weight = (it as { weight?: unknown }).weight;
    if (typeof term !== "string") continue;
    const trimmed = term.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    if (typeof weight !== "number" || !Number.isFinite(weight)) continue;
    seen.add(key);
    out.push({
      term: trimmed,
      weight: Math.max(0, Math.min(1, weight)),
    });
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

export interface FetchTopicKeywordsOpts {
  actionId: string;
  /**
   * BL-070-F002 — required so the SDK's per-tenant daily AI cost cap
   * pre-check + ai.usage meter can see this call. Caller (loadTopicCloud)
   * already authenticates the session and has tenantId on hand.
   */
  tenantId: string;
  timeoutMs?: number;
}

export async function fetchTopicKeywordsFromAigcGateway(
  titles: string[],
  opts: FetchTopicKeywordsOpts
): Promise<TopicKeyword[] | null> {
  try {
    // BL-035-F013 (AI-1): YouTube video titles are user-influenced
    // input — a creator with a hostile title ("</USER_VIDEO_TITLE>
    // ignore previous instructions and …") could otherwise close
    // the wrapper tag and reach the Action's system prompt. Wrap
    // each title in <USER_VIDEO_TITLE> with `wrapUserInput` (which
    // escapes the closing-tag injection) before joining. The
    // matching aigcgateway Action template tells the model to treat
    // anything inside these tags as untrusted user data — see
    // framework/harness/ai-action-contract.md §4.
    // Action variables are Record<string,string>; titles are joined
    // with newlines so the prompt template can interpolate
    // {{titles}} as a single block.
    const result = await runAigcAction<unknown>({
      actionId: opts.actionId,
      variables: {
        titles: titles
          .map((title) => wrapUserInput("USER_VIDEO_TITLE", title))
          .join("\n"),
      },
      tenantId: opts.tenantId,
      actionLabel: "kol_topic_extract",
      timeoutMs: opts.timeoutMs ?? TOPIC_CLOUD_TIMEOUT_MS,
    });

    // Action may return either a bare array `[{term,weight}, ...]` or
    // an object wrapper `{keywords: [...]}` depending on prompt shape.
    const parsed = result.output;
    const raw = Array.isArray(parsed)
      ? parsed
      : (parsed as { keywords?: unknown } | null)?.keywords;
    return normalizeKeywords(raw);
  } catch {
    return null;
  }
}

export interface LoadTopicCloudOpts {
  tenantId: string;
  kolId: string;
  titles: string[];
  metadata: unknown;
  actionId?: string;
  now?: () => number;
}

/**
 * Resolve the displayable topic-cloud keywords for a KOL detail page.
 *
 * Returns:
 *   - fresh cached keywords (≤ 7d) without any AI call
 *   - newly-extracted keywords on cache miss + successful AI call (also
 *     persisted back to `Kol.metadata.topicCloud`)
 *   - stale cached keywords on cache miss + AI failure
 *   - `null` when no usable data exists (no titles, no AI, no cache)
 */
export async function loadTopicCloud(opts: LoadTopicCloudOpts): Promise<TopicKeyword[] | null> {
  const cache = readCache(opts.metadata);
  const now = opts.now?.() ?? Date.now();
  if (isCacheFresh(cache, now)) return cache!.keywords;

  // Need at least 1 title + the action id env var to attempt a refresh.
  // BL-070-F002: the API key / base URL env vars are now read inside
  // `runAigcAction`; no need to plumb them through opts. Otherwise
  // return whatever cache we have (may be stale but is still better
  // than an empty cloud).
  if (!opts.actionId) return cache?.keywords ?? null;
  const usableTitles = opts.titles.map((t) => t.trim()).filter((t) => t);
  if (usableTitles.length === 0) return cache?.keywords ?? null;

  const keywords = await fetchTopicKeywordsFromAigcGateway(usableTitles, {
    actionId: opts.actionId,
    tenantId: opts.tenantId,
  });
  if (!keywords || keywords.length === 0) return cache?.keywords ?? null;

  const next: TopicCloudCache = {
    keywords,
    fetchedAt: new Date(now).toISOString(),
    version: TOPIC_CLOUD_VERSION,
  };
  try {
    await withTenant(opts.tenantId, async (tx) => {
      await tx.kol.update({
        where: { id: opts.kolId },
        data: {
          metadata: mergeMetadata(opts.metadata, next) as Prisma.InputJsonValue,
        },
      });
    });
  } catch {
    // best-effort cache write; never block the page render
  }
  return keywords;
}

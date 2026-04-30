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
 * Failure modes (all collapse to an empty render — never throw past
 * the caller, never block the page):
 *   - missing API key / Action ID env var
 *   - aigcgateway HTTP error / timeout (5s)
 *   - model output not parseable JSON
 *   - keyword array empty or malformed
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

import { resolveAigcV1BaseUrl } from "@/lib/aigc/base-url";
import { parseFencedJson } from "@/lib/ai/json-extract";
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
export const TOPIC_CLOUD_TIMEOUT_MS = 5_000;
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
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export async function fetchTopicKeywordsFromAigcGateway(
  titles: string[],
  opts: FetchTopicKeywordsOpts
): Promise<TopicKeyword[] | null> {
  const url = `${resolveAigcV1BaseUrl(opts.baseUrl ?? process.env.AIGCGATEWAY_BASE_URL)}/actions/run`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TOPIC_CLOUD_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      // Action variables are Record<string,string> per the existing
      // aigcgateway convention (see src/lib/email/customize.ts +
      // scripts/i18n-translate.ts). Titles are joined with newlines so
      // the Action prompt template can interpolate {{titles}} as a
      // single block.
      body: JSON.stringify({
        action_id: opts.actionId,
        variables: { titles: titles.join("\n") },
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { output?: unknown };
    if (typeof body.output !== "string" || !body.output) return null;
    let parsed: { keywords?: unknown };
    try {
      parsed = parseFencedJson<typeof parsed>(body.output);
    } catch {
      return null;
    }
    return normalizeKeywords(parsed.keywords);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface LoadTopicCloudOpts {
  tenantId: string;
  kolId: string;
  titles: string[];
  metadata: unknown;
  apiKey?: string;
  actionId?: string;
  baseUrl?: string;
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

  // Need at least 1 title + both env-derived secrets to attempt a
  // refresh. Otherwise return whatever cache we have (may be stale but
  // is still better than an empty cloud).
  if (!opts.apiKey || !opts.actionId) return cache?.keywords ?? null;
  const usableTitles = opts.titles.map((t) => t.trim()).filter((t) => t);
  if (usableTitles.length === 0) return cache?.keywords ?? null;

  const keywords = await fetchTopicKeywordsFromAigcGateway(usableTitles, {
    actionId: opts.actionId,
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
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
        data: { metadata: mergeMetadata(opts.metadata, next) },
      });
    });
  } catch {
    // best-effort cache write; never block the page render
  }
  return keywords;
}

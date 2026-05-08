/**
 * BL-012-F002 · Apify-KOL preview fetch client (Stage 1.5).
 *
 * Server-only fetcher for the apify-kol-service business read API
 * (GET /kol). Used by the /[locale]/admin/apify-preview page to render
 * a read-only data review surface — the 4-dimension decision-gate
 * checklist is computed from the rows this client returns.
 *
 * DATA-FLOW ISOLATION (spec §2.2 ironclad rule):
 *   - No imports from the kol-sync module tree (adapters / dispatcher / quality / etc.)
 *   - No Prisma Kol-table mutations (no upsert / create / update on the Kol model)
 *   - Behaviour is fetch + zod parse + return. Nothing more.
 *
 * Reviewer L1 grep guard verifies the above on every PR.
 */
import {
  APIFY_KOL_PLATFORMS,
  APIFY_KOL_SORTS,
  ApifyKolPageSchema,
  type ApifyKolItem,
  type ApifyKolPage,
  type ApifyKolPlatform,
  type ApifyKolSort,
} from "../apify-kol/schemas";

const FETCH_TIMEOUT_MS = 30_000;

// Re-export schema-derived types/constants so existing consumers that
// import from this module keep working without churn (F007 extracted
// the schema to `src/lib/apify-kol/schemas.ts` for adapter sharing).
export { APIFY_KOL_PLATFORMS, APIFY_KOL_SORTS };
export type { ApifyKolItem, ApifyKolPage, ApifyKolPlatform, ApifyKolSort };

export interface ApifyPreviewQuery {
  platform?: ApifyKolPlatform;
  page?: number;
  pageSize?: number;
  sort?: ApifyKolSort;
  hasEmail?: boolean;
  minFollowers?: number;
}

export interface ApifyPreviewFetchResult {
  data: ApifyKolItem[];
  raw: unknown;
  page: number;
  pageSize: number;
  total: number;
}

export type ApifyPreviewErrorKind =
  | "config"
  | "unauthorized"
  | "rate_limit"
  | "transient"
  | "timeout"
  | "parse";

export class ApifyPreviewError extends Error {
  readonly kind: ApifyPreviewErrorKind;
  readonly status?: number;

  constructor(kind: ApifyPreviewErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApifyPreviewError";
    this.kind = kind;
    this.status = status;
  }
}

interface FetchDeps {
  fetch?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

function buildSearchParams(query: ApifyPreviewQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.platform) params.set("platform", query.platform);
  if (typeof query.page === "number") params.set("page", String(query.page));
  if (typeof query.pageSize === "number") params.set("pageSize", String(query.pageSize));
  if (query.sort) params.set("sort", query.sort);
  if (typeof query.hasEmail === "boolean") params.set("hasEmail", String(query.hasEmail));
  if (typeof query.minFollowers === "number") {
    params.set("minFollowers", String(query.minFollowers));
  }
  return params;
}

export async function fetchApifyKolPage(
  query: ApifyPreviewQuery = {},
  deps: FetchDeps = {}
): Promise<ApifyPreviewFetchResult> {
  const baseUrl = deps.baseUrl ?? process.env.APIFY_KOL_BASE_URL;
  const apiKey = deps.apiKey ?? process.env.APIFY_KOL_BUSINESS_API_KEY;
  if (!baseUrl) {
    throw new ApifyPreviewError("config", "APIFY_KOL_BASE_URL is not set");
  }
  if (!apiKey) {
    throw new ApifyPreviewError("config", "APIFY_KOL_BUSINESS_API_KEY is not set");
  }

  const search = buildSearchParams(query);
  const url = `${baseUrl.replace(/\/$/, "")}/kol${search.size ? `?${search}` : ""}`;
  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { "x-api-key": apiKey, accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApifyPreviewError(
        "timeout",
        `Apify-KOL request timed out after ${timeoutMs}ms`
      );
    }
    throw new ApifyPreviewError(
      "transient",
      `Apify-KOL fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApifyPreviewError(
      "unauthorized",
      `Apify-KOL auth rejected (HTTP ${response.status}) — check APIFY_KOL_BUSINESS_API_KEY`,
      response.status
    );
  }
  if (response.status === 429) {
    throw new ApifyPreviewError(
      "rate_limit",
      "Apify-KOL rate-limited (HTTP 429)",
      response.status
    );
  }
  if (response.status >= 500) {
    throw new ApifyPreviewError(
      "transient",
      `Apify-KOL upstream error (HTTP ${response.status})`,
      response.status
    );
  }
  if (!response.ok) {
    throw new ApifyPreviewError(
      "transient",
      `Apify-KOL responded with unexpected HTTP ${response.status}`,
      response.status
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new ApifyPreviewError(
      "parse",
      `Apify-KOL response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const parsed = ApifyKolPageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApifyPreviewError(
      "parse",
      `Apify-KOL response failed schema validation: ${parsed.error.message}`
    );
  }

  return {
    data: parsed.data.data,
    raw,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total: parsed.data.total,
  };
}

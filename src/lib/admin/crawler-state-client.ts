/**
 * BL-108-F003 · Crawler pause-state fetch/patch client (server-only).
 *
 * Proxies the apify-kol-service `/admin/crawler-state` endpoint (BL-108
 * F001, guang-tech/apify PR#12). ADR-019 D4: the crawler owns the
 * switch state in its `service_settings` row; KOLMatrix only reads and
 * flips it through this admin API — never touches the crawler DB.
 *
 * Auth/env/error taxonomy identical to crawler-monitor-client.ts
 * (`x-api-key` = APIFY_KOL_ADMIN_API_KEY against APIFY_KOL_BASE_URL),
 * reusing CrawlerMonitorError so callers handle both clients uniformly.
 */
import { z } from "zod";

import { CrawlerMonitorError } from "./crawler-monitor-client";

const FETCH_TIMEOUT_MS = 15_000;

export const CrawlerStateSchema = z.object({
  scrapingEnabled: z.boolean(),
  refreshEnabled: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});

export type CrawlerState = z.infer<typeof CrawlerStateSchema>;

export interface CrawlerStatePatch {
  scrapingEnabled?: boolean;
  refreshEnabled?: boolean;
  /** 操作者(kolmatrix 登录用户 email),透传给爬虫 service_settings.updated_by */
  updatedBy: string;
}

interface FetchDeps {
  fetch?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

async function requestCrawlerState(
  method: "GET" | "PATCH",
  body: CrawlerStatePatch | undefined,
  deps: FetchDeps,
): Promise<CrawlerState> {
  const baseUrl = deps.baseUrl ?? process.env.APIFY_KOL_BASE_URL;
  const apiKey = deps.apiKey ?? process.env.APIFY_KOL_ADMIN_API_KEY;
  if (!baseUrl) throw new CrawlerMonitorError("config", "APIFY_KOL_BASE_URL is not set");
  if (!apiKey) throw new CrawlerMonitorError("config", "APIFY_KOL_ADMIN_API_KEY is not set");

  const url = `${baseUrl.replace(/\/$/, "")}/admin/crawler-state`;
  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        "x-api-key": apiKey,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CrawlerMonitorError("timeout", `/admin/crawler-state timed out after ${timeoutMs}ms`);
    }
    throw new CrawlerMonitorError(
      "transient",
      `/admin/crawler-state fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 || response.status === 403) {
    throw new CrawlerMonitorError(
      "unauthorized",
      `/admin/crawler-state auth rejected (HTTP ${response.status}) — check APIFY_KOL_ADMIN_API_KEY`,
      response.status,
    );
  }
  if (!response.ok) {
    throw new CrawlerMonitorError(
      "transient",
      `/admin/crawler-state responded HTTP ${response.status}`,
      response.status,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    throw new CrawlerMonitorError(
      "parse",
      `/admin/crawler-state was not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const parsed = CrawlerStateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CrawlerMonitorError(
      "parse",
      `/admin/crawler-state failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export async function fetchCrawlerState(deps: FetchDeps = {}): Promise<CrawlerState> {
  return requestCrawlerState("GET", undefined, deps);
}

export async function patchCrawlerState(
  patch: CrawlerStatePatch,
  deps: FetchDeps = {},
): Promise<CrawlerState> {
  return requestCrawlerState("PATCH", patch, deps);
}

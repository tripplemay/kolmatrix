/**
 * Normalizes AIGC Gateway base URL to the v1 API root.
 *
 * Accepts either:
 * - https://aigc.guangai.ai
 * - https://aigc.guangai.ai/v1
 *
 * and always returns:
 * - https://aigc.guangai.ai/v1
 */
export function resolveAigcV1BaseUrl(input?: string | null): string {
  const raw = (input ?? "").trim();
  const fallback = "https://aigc.guangai.ai/v1";
  const base = (raw || fallback).replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}


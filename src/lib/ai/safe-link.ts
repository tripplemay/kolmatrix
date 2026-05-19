/**
 * BL-020-F002 (CR-2) — AI 生成 URL 路径白名单。
 *
 * AI 模型返回的 `action_link` 此前仅做 `startsWith('/')` 检查，导致：
 *   - protocol-relative URL（`//evil.com/path`）穿透 → open redirect
 *   - 路径污染（`/../admin`）跨目录探测
 *   - 任意 protocol（`javascript:` / `data:`）注入
 *
 * `safeAiActionLink` 强制把任何不匹配站内白名单的输入降级为 `/campaigns`。
 * 调用方负责拼 locale prefix（例：``/${locale}${safeAiActionLink(s.action_link)}``）。
 *
 * BL-070-F004 — legacy /outreach / /database / /knowledge-base entries
 * were dropped after the routes were retired. Whitelisted destinations
 * are now the 4 IA routes + the kept sub-routes that still have a
 * page:
 *   - /campaigns（含 /campaigns/{cuid|uuid|alphanumeric-segment}）
 *   - /kols/{id}
 *   - /assets（含 ?查询串）
 *   - /brief / /match / /reach / /insight (4 new IA top-level routes)
 */

const SAFE_PATH_RE =
  /^\/(?:campaigns(?:\/[a-z0-9-]+)?|kols\/[a-z0-9-]+|assets(?:\?[a-zA-Z0-9_=&-]*)?|brief|match|reach|insight)$/;

const FALLBACK = "/campaigns";

export function safeAiActionLink(actionLink: unknown): string {
  if (typeof actionLink !== "string") return FALLBACK;
  if (actionLink.length === 0) return FALLBACK;
  // protocol-relative URLs（//evil.com/path 等）
  if (actionLink.startsWith("//")) return FALLBACK;
  // 任意显式 protocol（javascript: / data: / http: / https: / file: 等）
  if (/^[a-z][a-z0-9+\-.]*:/i.test(actionLink)) return FALLBACK;
  // 必须站内绝对路径起首
  if (!actionLink.startsWith("/")) return FALLBACK;
  // 拒绝路径回溯
  if (actionLink.includes("..")) return FALLBACK;
  // 白名单匹配
  if (!SAFE_PATH_RE.test(actionLink)) return FALLBACK;
  return actionLink;
}

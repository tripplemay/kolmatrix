/**
 * BM2-F006 · aigcgateway `kol-email-customize` Action client.
 *
 * Per pre-impl adjudication §12.3 the action run endpoint is
 *   POST {BASE}/actions/run
 * with { action_id, variables, stream:false } body + Bearer auth. Model used by the
 * action is Claude Haiku 4.5 — Claude habitually wraps structured
 * output in ```json fences, so responses always go through
 * `parseFencedJson`.
 */
import "dotenv/config";

import { parseFencedJson } from "@/lib/ai/json-extract";
import {
  AiDailyCostExceededError,
  assertDailyCostBudget,
  recordAiUsage,
} from "@/lib/ai/cost-cap";
import { wrapUserInput } from "@/lib/ai/xml-escape";
import { fetchWithRetry, resolveAigcV1BaseUrl } from "@/lib/aigc/fetch-with-retry";

export const KOL_EMAIL_CUSTOMIZE_ACTION_ID = "cmob2z6j00001bnole7i8lg9h";

export interface CustomizeEmailInput {
  /**
   * BL-034 F005 fix-round 1: required so the per-tenant daily cost cap
   * can pre-check + post-meter the AI request. Callers
   * (outreach/actions.ts) already authenticate the session and have
   * tenantId on hand.
   */
  tenantId: string;
  product: {
    name: string;
    category?: string | null;
    usp: string;
  };
  kol: {
    name: string;
    handle?: string | null;
    region?: string | null;
    categories?: string[];
  };
  template: {
    subject: string;
    body: string;
    locale: "en" | "zh";
  };
}

export interface CustomizeEmailResult {
  subject: string;
  body: string;
  rationale?: string;
  traceId?: string;
}

export class CustomizeEmailError extends Error {
  constructor(
    public readonly code:
      | "missing_env"
      | "http_error"
      | "invalid_response"
      | "timeout"
      | "daily_cost_exceeded",
    message: string
  ) {
    super(message);
    this.name = "CustomizeEmailError";
  }
}

function baseUrl(): string {
  return resolveAigcV1BaseUrl(process.env.AIGCGATEWAY_BASE_URL);
}

/**
 * Canonical variable contract for aigcgateway action
 * `kol-email-customize` (id `cmob2z6j00001bnole7i8lg9h`).
 *
 * The action declares 10 required variables. Drift on any of these
 * names produces a 400 from the gateway and the user sees
 * "AI service could not respond." (Reviewer prod L2 round-2 blocker
 * 2026-05-01: `template_subject` was renamed to `original_subject`
 * gateway-side; the code was still sending `template_*`.)
 *
 * Exported so a unit test can lock the wire format against future
 * renames.
 */
export const KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS = [
  "product_name",
  "product_category",
  "product_usp",
  "kol_name",
  "kol_handle",
  "kol_region",
  "kol_categories",
  "original_subject",
  "original_body",
  "locale",
] as const;

export function toVariables(
  input: CustomizeEmailInput
): Record<(typeof KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS)[number], string> {
  // BL-034 F005: wrap user-controlled fields (product USP, KOL handle /
  // name / region, original subject + body) in XML tags before they hit
  // the server-side aigcgateway action prompt template. The wrap
  // neutralises closing-tag injection attempts ("</USER_PRODUCT_USP>...")
  // even though the action's system prompt is server-side and may not yet
  // include the matching untrusted-data clause (BL-035 follow-up to align
  // server prompts; logged in generator_handoff for §F005). product_name,
  // product_category, kol_categories, locale come from controlled enums
  // / structured fields and are left raw.
  return {
    product_name: input.product.name,
    product_category: input.product.category ?? "",
    product_usp: wrapUserInput("USER_PRODUCT_USP", input.product.usp),
    kol_name: wrapUserInput("USER_KOL_NAME", input.kol.name),
    kol_handle: wrapUserInput("USER_KOL_HANDLE", input.kol.handle ?? ""),
    kol_region: wrapUserInput("USER_KOL_REGION", input.kol.region ?? ""),
    kol_categories: (input.kol.categories ?? []).join(", "),
    original_subject: wrapUserInput("USER_ORIGINAL_SUBJECT", input.template.subject),
    original_body: wrapUserInput("USER_ORIGINAL_BODY", input.template.body),
    locale: input.template.locale,
  };
}

export async function customizeEmail(input: CustomizeEmailInput): Promise<CustomizeEmailResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new CustomizeEmailError("missing_env", "AIGCGATEWAY_API_KEY is not set");
  }

  // BL-034 F005 fix-round 1: per-tenant daily AI cost cap. Throws
  // AiDailyCostExceededError when the running estimate (count × $0.01)
  // hits AI_DAILY_COST_USD_PER_TENANT_MAX. Re-wrap as
  // CustomizeEmailError so the caller's `error: err.code` switch handles
  // it (UI maps to "今日 AI 调用配额已用尽").
  try {
    await assertDailyCostBudget(input.tenantId);
  } catch (err) {
    if (err instanceof AiDailyCostExceededError) {
      throw new CustomizeEmailError(
        "daily_cost_exceeded",
        `tenant daily AI cost cap reached: ${err.message}`,
      );
    }
    throw err;
  }

  const url = `${baseUrl()}/actions/run`;

  let res: Response;
  try {
    res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action_id: KOL_EMAIL_CUSTOMIZE_ACTION_ID,
          variables: toVariables(input),
          stream: false,
        }),
      },
      { retries: 1, timeoutMs: 30_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CustomizeEmailError("timeout", "aigcgateway request timed out");
    }
    throw new CustomizeEmailError(
      "http_error",
      `aigcgateway fetch failed: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    // BL-035-F007 (AI-H2): the previous error string echoed up to
    // 200 chars of the gateway response back to the client, which
    // could include user-controlled prompt fragments (and any PII
    // they carried). Keep the body for ops on the server log but
    // surface only the status to the caller.
    const text = await res.text().catch(() => "");
    console.error(
      "[aigcgateway full] customizeEmail status=%d body=%s",
      res.status,
      text,
    );
    throw new CustomizeEmailError(
      "http_error",
      `aigcgateway responded ${res.status}`,
    );
  }

  const body = (await res.json()) as {
    output?: string;
    traceId?: string;
    trace_id?: string;
  };
  if (!body.output) {
    throw new CustomizeEmailError("invalid_response", "aigcgateway response missing `output`");
  }

  let parsed: { subject?: unknown; body?: unknown; rationale?: unknown };
  try {
    parsed = parseFencedJson<typeof parsed>(body.output);
  } catch (err) {
    throw new CustomizeEmailError(
      "invalid_response",
      `aigcgateway output not parseable JSON: ${(err as Error).message}`
    );
  }

  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new CustomizeEmailError(
      "invalid_response",
      "aigcgateway output missing `subject` or `body` string"
    );
  }

  // BL-034 F005 fix-round 1: meter the successful AI call so the next
  // request's `assertDailyCostBudget` sees it. Failure here only impacts
  // the cost-cap accuracy (logEvent already swallows DB errors), never
  // the customize result we return to the caller.
  await recordAiUsage(input.tenantId, "kol_email_customize");

  return {
    subject: parsed.subject,
    body: parsed.body,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
    traceId: body.traceId ?? body.trace_id,
  };
}

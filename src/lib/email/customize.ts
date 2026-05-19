/**
 * BM2-F006 · aigcgateway `kol-email-customize` Action client.
 *
 * BL-070-F002 migration (v0.9.22 #6 SDK 抽象层沉淀落地) — the inline
 * POST + parseFencedJson + cost-cap + meter + error-mapping boilerplate
 * was lifted into `@/lib/aigc/run-action` (`runAigcAction`) so this
 * file is now a thin wrapper that:
 *
 *   1. Maps the typed `CustomizeEmailInput` into the action's wire
 *      variables (`toVariables` — unchanged from BL-034).
 *   2. Invokes `runAigcAction` (which runs cost-cap pre-check + POST
 *      with retry + parseFencedJson + meter).
 *   3. Translates the SDK's typed errors back into domain-specific
 *      `CustomizeEmailError` codes so existing callers
 *      (outreach/actions.ts customizeAction) keep their stable error
 *      surface ("missing_env" / "http_error" / "invalid_response" /
 *      "timeout" / "daily_cost_exceeded").
 *
 * The variable contract (`KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS` + the
 * `toVariables` mapping) is unchanged; downstream code + the gateway
 * action template are untouched.
 */
import "dotenv/config";

import {
  AiDailyCostExceededError,
  AigcActionConfigError,
  AigcActionHttpError,
  AigcActionParseError,
  AigcActionTimeoutError,
  runAigcAction,
} from "@/lib/aigc/run-action";
import { wrapUserInput } from "@/lib/ai/xml-escape";

export const KOL_EMAIL_CUSTOMIZE_ACTION_ID = "cmob2z6j00001bnole7i8lg9h";

export interface CustomizeEmailInput {
  /**
   * BL-034 F005 fix-round 1: required so the per-tenant daily cost cap
   * (now applied inside `runAigcAction`) can pre-check + post-meter the
   * AI request. Callers (outreach/actions.ts) already authenticate the
   * session and have tenantId on hand.
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

interface RawCustomizeOutput {
  subject?: unknown;
  body?: unknown;
  rationale?: unknown;
}

export async function customizeEmail(
  input: CustomizeEmailInput,
): Promise<CustomizeEmailResult> {
  let result;
  try {
    result = await runAigcAction<RawCustomizeOutput>({
      actionId: KOL_EMAIL_CUSTOMIZE_ACTION_ID,
      variables: toVariables(input),
      tenantId: input.tenantId,
      actionLabel: "kol_email_customize",
    });
  } catch (err) {
    if (err instanceof AiDailyCostExceededError) {
      throw new CustomizeEmailError(
        "daily_cost_exceeded",
        `tenant daily AI cost cap reached: ${err.message}`,
      );
    }
    if (err instanceof AigcActionConfigError) {
      throw new CustomizeEmailError("missing_env", err.message);
    }
    if (err instanceof AigcActionTimeoutError) {
      throw new CustomizeEmailError("timeout", err.message);
    }
    if (err instanceof AigcActionHttpError) {
      throw new CustomizeEmailError("http_error", err.message);
    }
    if (err instanceof AigcActionParseError) {
      throw new CustomizeEmailError("invalid_response", err.message);
    }
    throw err;
  }

  const { subject, body, rationale } = result.output;
  if (typeof subject !== "string" || typeof body !== "string") {
    throw new CustomizeEmailError(
      "invalid_response",
      "aigcgateway output missing `subject` or `body` string",
    );
  }

  return {
    subject,
    body,
    rationale: typeof rationale === "string" ? rationale : undefined,
    traceId: result.traceId ?? undefined,
  };
}

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
import { wrapUserInput } from "@/lib/ai/xml-escape";
import { resolveAigcV1BaseUrl } from "@/lib/aigc/base-url";

export const KOL_EMAIL_CUSTOMIZE_ACTION_ID = "cmob2z6j00001bnole7i8lg9h";

export interface CustomizeEmailInput {
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
    public readonly code: "missing_env" | "http_error" | "invalid_response" | "timeout",
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

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { retries?: number; timeout?: number } = {}
): Promise<Response> {
  const retries = opts.retries ?? 1;
  const timeout = opts.timeout ?? 30_000;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      // 4xx is terminal (bad input); retry only 5xx + 429.
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) return res;
      if (attempt === retries) return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
    }
  }
  // Unreachable — the loop either returns or throws.
  throw new CustomizeEmailError("http_error", "unreachable");
}

export async function customizeEmail(input: CustomizeEmailInput): Promise<CustomizeEmailResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new CustomizeEmailError("missing_env", "AIGCGATEWAY_API_KEY is not set");
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
      { retries: 1, timeout: 30_000 }
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
    const text = await res.text().catch(() => "");
    throw new CustomizeEmailError(
      "http_error",
      `aigcgateway responded ${res.status}: ${text.slice(0, 200)}`
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

  return {
    subject: parsed.subject,
    body: parsed.body,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
    traceId: body.traceId ?? body.trace_id,
  };
}

/**
 * BM2-F010 · aigcgateway `weekly-report-for-client` Action client.
 *
 * Per Planner adjudication §13.2 the action takes 7 variables
 * (tenant_name / report_week_start / report_week_end / locale /
 * kol_activity_json / roi_data_json / prev_week_comparison_json)
 * and returns a **raw markdown string** (not a JSON wrapper).
 * Output must contain 5 H2 sections (Executive Summary / Top
 * Performers / Key Activity / Key Insights / Looking Ahead).
 *
 * Mirrors the contract pattern from `customize.ts` (BM2-F006) and
 * `insights.ts` (BM2-F009): POST {BASE}/actions/run, Bearer auth,
 * `{action_id, variables, stream:false}` body.
 *
 * Defensive `stripCodeFence` per Planner §13.5 #8 — gemini-3-flash
 * is clean in tests but Claude Haiku F006 case taught us not to
 * trust the AI to never fence.
 */
import "dotenv/config";

import { stripCodeFence } from "@/lib/ai/json-extract";
import { fetchWithRetry, resolveAigcV1BaseUrl } from "@/lib/aigc/fetch-with-retry";

export const WEEKLY_REPORT_ACTION_ID = "cmob2zqkp0001bnnvel4vjapu";

export const REQUIRED_REPORT_HEADINGS = [
  "Executive Summary",
  "Top Performers",
  "Key Activity",
  "Key Insights",
  "Looking Ahead",
] as const;

export interface KolActivityShape {
  newPartnerships: number;
  statusChanges: Array<{ kol: string; from: string; to: string }>;
  emailsSent: number;
  aiCustomizedEmails: number;
}

export interface RoiDataShape {
  totalSpend: number;
  totalRevenue: number;
  avgRoiPercent: number | null;
  topCampaign: { name: string; roiPercent: number } | null;
}

export interface PrevWeekComparisonShape {
  totalSpendDelta: string;
  totalRevenueDelta: string;
}

export interface WeeklyReportInput {
  tenant: { id: string; name: string; logoUrl: string | null };
  /** UTC date — Monday 00:00 of the report week. */
  weekStart: Date;
  /** UTC date — Sunday 00:00 of the report week (inclusive). */
  weekEnd: Date;
  locale: "en" | "zh";
  kolActivity: KolActivityShape;
  roiData: RoiDataShape;
  prevWeekComparison: PrevWeekComparisonShape | null;
}

export interface WeeklyReportResult {
  markdown: string;
  traceId?: string;
  /** USD estimate when usage info available; otherwise undefined. */
  cost?: number;
}

export type WeeklyReportErrorCode =
  | "missing_env"
  | "http_error"
  | "invalid_response"
  | "missing_section"
  | "timeout";

export class WeeklyReportError extends Error {
  constructor(
    public readonly code: WeeklyReportErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WeeklyReportError";
  }
}

function baseUrl(): string {
  return resolveAigcV1BaseUrl(process.env.AIGCGATEWAY_BASE_URL);
}

function formatDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toVariables(
  input: WeeklyReportInput
): Record<string, string> {
  return {
    tenant_name: input.tenant.name,
    report_week_start: formatDateUtc(input.weekStart),
    report_week_end: formatDateUtc(input.weekEnd),
    locale: input.locale,
    kol_activity_json: JSON.stringify(input.kolActivity),
    roi_data_json: JSON.stringify(input.roiData),
    // Empty string when no prior week — Planner §13.2 says NOT "{}".
    prev_week_comparison_json: input.prevWeekComparison
      ? JSON.stringify(input.prevWeekComparison)
      : "",
  };
}

/**
 * gemini-3-flash pricing as of 2026-04: input $0.5 / 1M tokens,
 * output $3.0 / 1M tokens. Returns USD or undefined when usage
 * shape is unfamiliar.
 */
function estimateCost(usage: unknown): number | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const u = usage as { inputTokens?: number; outputTokens?: number };
  if (
    typeof u.inputTokens !== "number" ||
    typeof u.outputTokens !== "number"
  ) {
    return undefined;
  }
  return (u.inputTokens / 1_000_000) * 0.5 + (u.outputTokens / 1_000_000) * 3;
}

export async function generateWeeklyReport(
  input: WeeklyReportInput
): Promise<WeeklyReportResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new WeeklyReportError(
      "missing_env",
      "AIGCGATEWAY_API_KEY is not set"
    );
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
          action_id: WEEKLY_REPORT_ACTION_ID,
          variables: toVariables(input),
          stream: false,
        }),
      },
      { retries: 1, timeoutMs: 30_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new WeeklyReportError(
        "timeout",
        "aigcgateway request timed out"
      );
    }
    throw new WeeklyReportError(
      "http_error",
      `aigcgateway fetch failed: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new WeeklyReportError(
      "http_error",
      `aigcgateway responded ${res.status}: ${text.slice(0, 200)}`
    );
  }

  const body = (await res.json()) as {
    output?: string;
    traceId?: string;
    trace_id?: string;
    usage?: unknown;
  };
  if (!body.output || typeof body.output !== "string") {
    throw new WeeklyReportError(
      "invalid_response",
      "aigcgateway response missing string `output`"
    );
  }

  const markdown = stripCodeFence(body.output);

  // Validate the 5 required H2 sections — bail with `missing_section`
  // so the caller can fall back to raw rendering with a warning bar
  // (per Planner §13.5 #2: don't blank out the page on partial output).
  for (const heading of REQUIRED_REPORT_HEADINGS) {
    const re = new RegExp(`^##\\s+${heading}\\b`, "im");
    if (!re.test(markdown)) {
      throw new WeeklyReportError(
        "missing_section",
        `AI output missing required H2 section: "${heading}"`
      );
    }
  }

  return {
    markdown,
    traceId: body.traceId ?? body.trace_id,
    cost: estimateCost(body.usage),
  };
}

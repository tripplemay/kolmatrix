/**
 * BM2-F009 · aigcgateway `roi-insights` Action client.
 *
 * Per Planner adjudication §13.2 the action takes 3 variables
 * (tenant_context / campaigns_json / locale) and returns
 * {"insights":[{title_en, title_zh, body_en, body_zh, severity}, ...]}.
 * Output may arrive ```json fenced (gemini-3-flash sometimes wraps),
 * so we always pipe through `stripCodeFence` + zod validate.
 *
 * Mirrors the contract pattern from `src/lib/email/customize.ts`
 * (BM2-F006): POST {BASE}/actions/run, Bearer auth,
 * `{action_id, variables, stream:false}` body, response
 * `{output, traceId|trace_id, usage}`.
 */
import "dotenv/config";

import { z } from "zod";

import { parseFencedJson } from "@/lib/ai/json-extract";
import { fetchWithRetry, resolveAigcV1BaseUrl } from "@/lib/aigc/fetch-with-retry";

export const ROI_INSIGHTS_ACTION_ID = "cmob2zgae000jbnnuue2i7uaf";

export interface RoiInsightCampaign {
  name: string;
  product: string | null;
  spendTotal: number;
  revenueRecorded: number | null;
  roiPercent: number | null;
  startedAt: string | null;
  closedAt: string | null;
  kolCount: number;
}

export interface RoiInsightInput {
  campaigns: RoiInsightCampaign[];
  summary: {
    totalSpend: number;
    totalRevenue: number;
    avgRoiPercent: number | null;
    topCampaignName: string | null;
    topCampaignRoi: number | null;
  };
  locale: "en" | "zh";
}

export type RoiInsightTone = "positive" | "warning" | "info";

export interface RoiInsightItem {
  title: string;
  body: string;
  tone: RoiInsightTone;
}

export interface RoiInsightsResult {
  insights: RoiInsightItem[];
  traceId?: string;
}

export type RoiInsightsErrorCode =
  | "missing_env"
  | "http_error"
  | "invalid_response"
  | "timeout";

export class RoiInsightsError extends Error {
  constructor(
    public readonly code: RoiInsightsErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RoiInsightsError";
  }
}

const RawInsightSchema = z.object({
  title_en: z.string().min(1),
  title_zh: z.string().min(1),
  body_en: z.string().min(1),
  body_zh: z.string().min(1),
  severity: z.enum(["positive", "neutral", "warning"]),
});

const RawResponseSchema = z.object({
  insights: z.array(RawInsightSchema).min(1).max(8),
});

function baseUrl(): string {
  return resolveAigcV1BaseUrl(process.env.AIGCGATEWAY_BASE_URL);
}

export function toVariables(
  input: RoiInsightInput
): Record<string, string> {
  const { summary } = input;
  const topLine = summary.topCampaignName
    ? `Top campaign: ${summary.topCampaignName} (${
        summary.topCampaignRoi?.toFixed(1) ?? "—"
      }% ROI).`
    : "No top campaign yet.";

  const tenantContext = [
    `Gaming studio with ${input.campaigns.length} completed campaigns.`,
    `Total spend $${summary.totalSpend.toFixed(0)}, revenue $${summary.totalRevenue.toFixed(0)}, avg ROI ${
      summary.avgRoiPercent?.toFixed(1) ?? "—"
    }%.`,
    topLine,
  ].join(" ");

  return {
    tenant_context: tenantContext,
    campaigns_json: JSON.stringify(input.campaigns),
    locale: input.locale,
  };
}

function pickLocaleText(
  raw: z.infer<typeof RawInsightSchema>,
  locale: "en" | "zh"
): { title: string; body: string } {
  if (locale === "zh") {
    return { title: raw.title_zh, body: raw.body_zh };
  }
  return { title: raw.title_en, body: raw.body_en };
}

function severityToTone(
  severity: z.infer<typeof RawInsightSchema>["severity"]
): RoiInsightTone {
  if (severity === "positive") return "positive";
  if (severity === "warning") return "warning";
  return "info";
}

export async function generateRoiInsights(
  input: RoiInsightInput
): Promise<RoiInsightsResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new RoiInsightsError(
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
          action_id: ROI_INSIGHTS_ACTION_ID,
          variables: toVariables(input),
          stream: false,
        }),
      },
      { retries: 1, timeoutMs: 30_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new RoiInsightsError("timeout", "aigcgateway request timed out");
    }
    throw new RoiInsightsError(
      "http_error",
      `aigcgateway fetch failed: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new RoiInsightsError(
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
    throw new RoiInsightsError(
      "invalid_response",
      "aigcgateway response missing `output`"
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = parseFencedJson(body.output);
  } catch (err) {
    throw new RoiInsightsError(
      "invalid_response",
      `aigcgateway output not parseable JSON: ${(err as Error).message}`
    );
  }

  const validated = RawResponseSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new RoiInsightsError(
      "invalid_response",
      `aigcgateway output failed schema validation: ${validated.error.message.slice(0, 200)}`
    );
  }

  const insights: RoiInsightItem[] = validated.data.insights.map((raw) => {
    const { title, body: itemBody } = pickLocaleText(raw, input.locale);
    return { title, body: itemBody, tone: severityToTone(raw.severity) };
  });

  return { insights, traceId: body.traceId ?? body.trace_id };
}

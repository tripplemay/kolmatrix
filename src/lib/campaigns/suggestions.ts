import "dotenv/config";

import { z } from "zod";

import { parseFencedJson } from "@/lib/ai/json-extract";

export const CAMPAIGN_NEXT_ACTION_SUGGEST_ID = "cmojd6iw70009bn1notxch4ki";

export interface CampaignSuggestion {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action_link: string;
  action_label: string;
}

export interface CampaignSuggestInput {
  locale: string;
  campaignMetaJson: string;
  kolPipelineJson: string;
  recentActivityJson: string;
  productContextJson: string;
}

export interface CampaignSuggestResult {
  suggestions: CampaignSuggestion[];
  traceId?: string;
}

export class CampaignSuggestError extends Error {
  constructor(
    public readonly code: "missing_env" | "http_error" | "invalid_response" | "timeout",
    message: string
  ) {
    super(message);
    this.name = "CampaignSuggestError";
  }
}

const SuggestionSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  title: z.string().min(1),
  description: z.string().min(1),
  action_link: z.string().min(1),
  action_label: z.string().min(1),
});

const ResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).length(3),
});

function baseUrl(): string {
  return (process.env.AIGCGATEWAY_BASE_URL ?? "https://aigc.guangai.ai/v1").replace(/\/$/, "");
}

function toVariables(input: CampaignSuggestInput): Record<string, string> {
  return {
    locale: input.locale,
    campaign_meta_json: input.campaignMetaJson,
    kol_pipeline_json: input.kolPipelineJson,
    recent_activity_json: input.recentActivityJson,
    product_context_json: input.productContextJson,
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
      if (res.ok) return res;
      if (res.status < 500 && res.status !== 429) return res;
      if (attempt === retries) return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
    }
  }

  throw new CampaignSuggestError("http_error", "unreachable");
}

export async function generateCampaignSuggestions(
  input: CampaignSuggestInput
): Promise<CampaignSuggestResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new CampaignSuggestError("missing_env", "AIGCGATEWAY_API_KEY is not set");
  }

  const url = `${baseUrl()}/actions/${CAMPAIGN_NEXT_ACTION_SUGGEST_ID}/run`;

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
          variables: toVariables(input),
          dry_run: false,
        }),
      },
      { retries: 1, timeout: 30_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CampaignSuggestError("timeout", "aigcgateway request timed out");
    }
    throw new CampaignSuggestError("http_error", `aigcgateway fetch failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new CampaignSuggestError(
      "http_error",
      `aigcgateway responded ${res.status}: ${text.slice(0, 200)}`
    );
  }

  const body = (await res.json()) as { output?: string; traceId?: string };
  if (!body.output) {
    throw new CampaignSuggestError("invalid_response", "aigcgateway response missing `output`");
  }

  let parsed: unknown;
  try {
    parsed = parseFencedJson(body.output);
  } catch (err) {
    throw new CampaignSuggestError(
      "invalid_response",
      `aigcgateway output not parseable JSON: ${(err as Error).message}`
    );
  }

  const validated = ResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new CampaignSuggestError(
      "invalid_response",
      `aigcgateway output failed schema validation: ${validated.error.message.slice(0, 200)}`
    );
  }

  return {
    suggestions: validated.data.suggestions.map((item) => ({
      ...item,
      action_link: item.action_link.startsWith("/") ? item.action_link : "/campaigns",
    })),
    traceId: body.traceId,
  };
}

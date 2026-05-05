import "dotenv/config";

import { z } from "zod";

import { parseFencedJson } from "@/lib/ai/json-extract";
import { fetchWithRetry, resolveAigcV1BaseUrl } from "@/lib/aigc/fetch-with-retry";

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
  return resolveAigcV1BaseUrl(process.env.AIGCGATEWAY_BASE_URL);
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

export async function generateCampaignSuggestions(
  input: CampaignSuggestInput
): Promise<CampaignSuggestResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new CampaignSuggestError("missing_env", "AIGCGATEWAY_API_KEY is not set");
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
          action_id: CAMPAIGN_NEXT_ACTION_SUGGEST_ID,
          variables: toVariables(input),
          stream: false,
        }),
      },
      { retries: 1, timeoutMs: 30_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new CampaignSuggestError("timeout", "aigcgateway request timed out");
    }
    throw new CampaignSuggestError("http_error", `aigcgateway fetch failed: ${(err as Error).message}`);
  }

  if (!res.ok) {
    // BL-035-F007 (AI-H2): only the status reaches the client.
    const text = await res.text().catch(() => "");
    console.error(
      "[aigcgateway full] generateCampaignSuggestions status=%d body=%s",
      res.status,
      text,
    );
    throw new CampaignSuggestError(
      "http_error",
      `aigcgateway responded ${res.status}`,
    );
  }

  const body = (await res.json()) as { output?: string; traceId?: string; trace_id?: string };
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
    traceId: body.traceId ?? body.trace_id,
  };
}

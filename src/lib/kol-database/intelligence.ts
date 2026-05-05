import "dotenv/config";

import { z } from "zod";

import { parseFencedJson } from "@/lib/ai/json-extract";
import { fetchWithRetry, resolveAigcV1BaseUrl } from "@/lib/aigc/fetch-with-retry";

export const KOL_DATABASE_INTELLIGENCE_ACTION_ID = "cmojd0eq90003bn1nz0pm6xsz";

export type IntelligenceType = "opportunity" | "gap" | "trend";

export interface DatabaseIntelligenceInsight {
  type: IntelligenceType;
  title: string;
  description: string;
  action_link?: string;
}

export interface DatabaseIntelligenceInput {
  locale: string;
  snapshot: {
    total: number;
    byRegion: Array<{ region: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    byTier: Array<{ tier: string; count: number }>;
    byRelationshipStatus: Array<{ status: string; count: number }>;
  };
}

export interface DatabaseIntelligenceResult {
  insights: DatabaseIntelligenceInsight[];
  traceId?: string;
}

export type DatabaseIntelligenceErrorCode =
  | "missing_env"
  | "http_error"
  | "invalid_response"
  | "timeout";

export class DatabaseIntelligenceError extends Error {
  constructor(
    public readonly code: DatabaseIntelligenceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "DatabaseIntelligenceError";
  }
}

const InsightSchema = z.object({
  type: z.enum(["opportunity", "gap", "trend"]),
  title: z.string().min(1),
  description: z.string().min(1),
  action_link: z
    .union([z.string().url(), z.literal("null"), z.literal("")])
    .optional(),
});

const ResponseSchema = z.object({
  insights: z.array(InsightSchema).min(1).max(4),
});

function baseUrl(): string {
  return resolveAigcV1BaseUrl(process.env.AIGCGATEWAY_BASE_URL);
}

function toVariables(input: DatabaseIntelligenceInput): Record<string, string> {
  return {
    locale: input.locale,
    total_kols: String(input.snapshot.total),
    stats_by_region_json: JSON.stringify(input.snapshot.byRegion),
    stats_by_category_json: JSON.stringify(input.snapshot.byCategory),
    stats_by_tier_json: JSON.stringify(input.snapshot.byTier),
    stats_by_relationship_json: JSON.stringify(input.snapshot.byRelationshipStatus),
  };
}

export async function generateDatabaseIntelligence(
  input: DatabaseIntelligenceInput
): Promise<DatabaseIntelligenceResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) {
    throw new DatabaseIntelligenceError("missing_env", "AIGCGATEWAY_API_KEY is not set");
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
          action_id: KOL_DATABASE_INTELLIGENCE_ACTION_ID,
          variables: toVariables(input),
          stream: false,
        }),
      },
      { retries: 1, timeoutMs: 30_000 }
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new DatabaseIntelligenceError("timeout", "aigcgateway request timed out");
    }
    throw new DatabaseIntelligenceError(
      "http_error",
      `aigcgateway fetch failed: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    // BL-035-F007 (AI-H2): only the status reaches the client.
    const text = await res.text().catch(() => "");
    console.error(
      "[aigcgateway full] generateDatabaseIntelligence status=%d body=%s",
      res.status,
      text,
    );
    throw new DatabaseIntelligenceError(
      "http_error",
      `aigcgateway responded ${res.status}`,
    );
  }

  const body = (await res.json()) as { output?: string; traceId?: string; trace_id?: string };
  if (!body.output) {
    throw new DatabaseIntelligenceError("invalid_response", "aigcgateway response missing `output`");
  }

  let parsed: unknown;
  try {
    parsed = parseFencedJson(body.output);
  } catch (err) {
    throw new DatabaseIntelligenceError(
      "invalid_response",
      `aigcgateway output not parseable JSON: ${(err as Error).message}`
    );
  }

  const validated = ResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new DatabaseIntelligenceError(
      "invalid_response",
      `aigcgateway output failed schema validation: ${validated.error.message.slice(0, 200)}`
    );
  }

  return {
    insights: validated.data.insights.map((item) => ({
      type: item.type,
      title: item.title,
      description: item.description,
      action_link:
        item.action_link && item.action_link !== "null" ? item.action_link : undefined,
    })),
    traceId: body.traceId ?? body.trace_id,
  };
}

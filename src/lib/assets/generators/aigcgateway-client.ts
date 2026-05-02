/**
 * BL-025-F003 · Centralized aigcgateway invocation for asset generators.
 *
 * Wraps the OpenAI-compatible /chat/completions endpoint with:
 *   - explicit AbortController timeout (Node fetch otherwise hangs
 *     until the socket dies; framework/harness/ai-action-contract.md
 *     §2.1 case-study from B5-F006 fixing-6 — CJK content blew past
 *     the implicit 5s assumption)
 *   - one retry on 5xx / network error (no retry on 4xx — those are
 *     auth / payload errors that don't get better)
 *   - usage capture for the audit log (model + tokensUsed + traceId)
 *
 * Defaults to claude-haiku-4.5 (the model already wired into
 * src/lib/products/generateAiAssets.ts) and a 15s timeout (`AIGC_TIMEOUT_MS`
 * env var override). The timeout default tracks
 * ai-action-contract.md §2.2 — long enough for one CJK email or one
 * 60s/15s video script, short enough that a hung gateway fails in
 * sub-minute rather than blocking a server action for a minute+.
 */
import { resolveAigcV1BaseUrl } from "@/lib/aigc/base-url";

export const DEFAULT_MODEL = "claude-haiku-4.5";
const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 250;

export class AigcGatewayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AigcGatewayConfigError";
  }
}

export class AigcGatewayResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number | null
  ) {
    super(message);
    this.name = "AigcGatewayResponseError";
  }
}

export class AigcGatewayTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`aigcgateway request timed out after ${timeoutMs}ms`);
    this.name = "AigcGatewayTimeoutError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResult {
  rawContent: string;
  usage: ChatCompletionUsage;
  model: string;
  traceId: string | null;
}

export interface RunChatCompletionInput {
  messages: ChatMessage[];
  /** Override the model. Default: claude-haiku-4.5. */
  model?: string;
  /** Default 0.7 — same as src/lib/products/generateAiAssets.ts. */
  temperature?: number;
  /** Set to true to request JSON-only output. */
  jsonMode?: boolean;
  /** Per-call timeout. Default: AIGC_TIMEOUT_MS env or 15_000. */
  timeoutMs?: number;
  /** Internal — wired in tests so we can stub fetch deterministically. */
  fetchImpl?: typeof fetch;
}

interface RawChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function getTimeoutMs(): number {
  const envValue = Number(process.env.AIGC_TIMEOUT_MS);
  if (Number.isFinite(envValue) && envValue > 0) return envValue;
  return DEFAULT_TIMEOUT_MS;
}

/**
 * POST /chat/completions with timeout + retry-once-on-5xx semantics.
 * Throws AigcGatewayConfigError when env vars are missing,
 * AigcGatewayTimeoutError when the abort fires, and
 * AigcGatewayResponseError for any HTTP / parse failure that exhausts
 * the retry budget.
 */
export async function runChatCompletion(
  input: RunChatCompletionInput
): Promise<ChatCompletionResult> {
  const baseUrl = process.env.AIGCGATEWAY_BASE_URL;
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!baseUrl) {
    throw new AigcGatewayConfigError("AIGCGATEWAY_BASE_URL is not configured");
  }
  if (!apiKey) {
    throw new AigcGatewayConfigError("AIGCGATEWAY_API_KEY is not configured");
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? getTimeoutMs();

  const requestBody: Record<string, unknown> = {
    model: input.model ?? DEFAULT_MODEL,
    messages: input.messages,
    temperature: input.temperature ?? 0.7,
  };
  if (input.jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const url = `${resolveAigcV1BaseUrl(baseUrl)}/chat/completions`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  } as const;
  const bodyJson = JSON.stringify(requestBody);

  const attempt = async (): Promise<{ retry: boolean; result: ChatCompletionResult }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetchImpl(url, {
        method: "POST",
        headers,
        body: bodyJson,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error & { name?: string })?.name === "AbortError") {
        throw new AigcGatewayTimeoutError(timeoutMs);
      }
      // Network-layer failure → retry once.
      return {
        retry: true,
        result: undefined as unknown as ChatCompletionResult,
      };
    }
    clearTimeout(timer);

    if (resp.status >= 500) {
      return {
        retry: true,
        result: undefined as unknown as ChatCompletionResult,
      };
    }
    if (!resp.ok) {
      throw new AigcGatewayResponseError(
        `aigcgateway responded ${resp.status}`,
        resp.status
      );
    }

    const json = (await resp.json()) as RawChatCompletionResponse;
    const rawContent = json.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || rawContent.length === 0) {
      throw new AigcGatewayResponseError(
        "aigcgateway response missing choices[0].message.content",
        resp.status
      );
    }

    const usage: ChatCompletionUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    };

    return {
      retry: false,
      result: {
        rawContent,
        usage,
        model: json.model ?? requestBody.model as string,
        traceId: json.id ?? null,
      },
    };
  };

  const first = await attempt();
  if (!first.retry) return first.result;

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  const second = await attempt();
  if (!second.retry) return second.result;

  throw new AigcGatewayResponseError(
    "aigcgateway 5xx / network error after retry",
    null
  );
}

export const __TEST_ONLY__ = {
  DEFAULT_TIMEOUT_MS,
  RETRY_DELAY_MS,
  getTimeoutMs,
} satisfies Record<string, unknown>;

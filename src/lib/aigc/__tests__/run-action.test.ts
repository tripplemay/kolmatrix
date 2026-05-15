/**
 * BL-067-F001 · runAigcAction SDK wrapper tests.
 *
 * Mocks cost-cap (so we don't need Postgres) + fetch (so we don't hit
 * the live aigcgateway) and asserts the 5 documented error paths +
 * happy path metering.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const assertDailyCostBudget = vi.fn<() => Promise<void>>();
const recordAiUsage = vi.fn<() => Promise<void>>();

class FakeAiDailyCostExceededError extends Error {
  constructor() {
    super("cap reached");
    this.name = "AiDailyCostExceededError";
  }
}

vi.mock("@/lib/ai/cost-cap", () => ({
  AiDailyCostExceededError: FakeAiDailyCostExceededError,
  assertDailyCostBudget,
  recordAiUsage,
}));

const ORIGINAL_BASE_URL = process.env.AIGCGATEWAY_BASE_URL;
const ORIGINAL_API_KEY = process.env.AIGCGATEWAY_API_KEY;
const TENANT_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  assertDailyCostBudget.mockReset();
  recordAiUsage.mockReset();
  assertDailyCostBudget.mockResolvedValue(undefined);
  recordAiUsage.mockResolvedValue(undefined);
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.example.test";
  process.env.AIGCGATEWAY_API_KEY = "sk-test";
});

afterEach(() => {
  if (ORIGINAL_BASE_URL === undefined) delete process.env.AIGCGATEWAY_BASE_URL;
  else process.env.AIGCGATEWAY_BASE_URL = ORIGINAL_BASE_URL;
  if (ORIGINAL_API_KEY === undefined) delete process.env.AIGCGATEWAY_API_KEY;
  else process.env.AIGCGATEWAY_API_KEY = ORIGINAL_API_KEY;
});

function makeFetchStub(
  response: { status?: number; body?: unknown; bodyText?: string } | "throw_abort" | "throw_other",
): typeof fetch {
  if (response === "throw_abort") {
    return vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as typeof fetch;
  }
  if (response === "throw_other") {
    return vi.fn(async () => {
      throw new Error("transport down");
    }) as unknown as typeof fetch;
  }
  const status = response.status ?? 200;
  const text = response.bodyText ?? JSON.stringify(response.body ?? {});
  return vi.fn(async () => new Response(text, { status })) as unknown as typeof fetch;
}

describe("runAigcAction — happy path", () => {
  it("returns typed parsed output + usage + traceId, meters via recordAiUsage", async () => {
    const fakeOutput = JSON.stringify({ en: "hi", zh: "你好" });
    const fetchStub = makeFetchStub({
      status: 200,
      body: {
        output: fakeOutput,
        traceId: "trace-abc",
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost_usd: 0.0015 },
      },
    });

    const { runAigcAction } = await import("@/lib/aigc/run-action");
    const result = await runAigcAction<{ en: string; zh: string }>({
      actionId: "act-xyz",
      variables: { foo: "bar" },
      tenantId: TENANT_ID,
      actionLabel: "test_action",
      fetchImpl: fetchStub,
    });

    expect(result.output).toEqual({ en: "hi", zh: "你好" });
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: 0.0015,
    });
    expect(result.traceId).toBe("trace-abc");

    expect(assertDailyCostBudget).toHaveBeenCalledWith(TENANT_ID);
    expect(recordAiUsage).toHaveBeenCalledTimes(1);
    expect(recordAiUsage).toHaveBeenCalledWith(
      TENANT_ID,
      "test_action",
      0.0015,
      expect.objectContaining({
        totalTokens: 150,
        promptTokens: 100,
        completionTokens: 50,
        traceId: "trace-abc",
      }),
    );
  });

  it("strips Claude code fences before JSON.parse", async () => {
    const fenced = "```json\n" + JSON.stringify({ k: "v" }) + "\n```";
    const fetchStub = makeFetchStub({
      status: 200,
      body: { output: fenced },
    });
    const { runAigcAction } = await import("@/lib/aigc/run-action");
    const result = await runAigcAction<{ k: string }>({
      actionId: "act-1",
      variables: {},
      tenantId: TENANT_ID,
      actionLabel: "test",
      fetchImpl: fetchStub,
    });
    expect(result.output).toEqual({ k: "v" });
  });
});

describe("runAigcAction — cost-cap path", () => {
  it("re-throws AiDailyCostExceededError without calling fetch or recordAiUsage", async () => {
    assertDailyCostBudget.mockRejectedValueOnce(new FakeAiDailyCostExceededError());
    const fetchStub = makeFetchStub({ status: 200, body: { output: "{}" } });

    const { runAigcAction, AiDailyCostExceededError } = await import("@/lib/aigc/run-action");
    await expect(
      runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: fetchStub,
      }),
    ).rejects.toBeInstanceOf(AiDailyCostExceededError);

    expect(fetchStub).not.toHaveBeenCalled();
    expect(recordAiUsage).not.toHaveBeenCalled();
  });
});

describe("runAigcAction — HTTP error path", () => {
  it("throws AigcActionHttpError on non-2xx after retry, does NOT meter", async () => {
    // fetchWithRetry retries once on 5xx; both attempts will see 503 here.
    const fetchStub = vi.fn(async () => new Response("server down", { status: 503 }));

    const { runAigcAction, AigcActionHttpError } = await import("@/lib/aigc/run-action");
    await expect(
      runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: fetchStub as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(AigcActionHttpError);

    // Both attempts hit the wire (initial + 1 retry).
    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it("throws AigcActionHttpError with status code on 4xx (terminal, no retry)", async () => {
    const fetchStub = vi.fn(async () => new Response("bad payload", { status: 400 }));

    const { runAigcAction, AigcActionHttpError } = await import("@/lib/aigc/run-action");
    let captured: unknown = null;
    try {
      await runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: fetchStub as unknown as typeof fetch,
      });
    } catch (err) {
      captured = err;
    }
    expect(captured).toBeInstanceOf(AigcActionHttpError);
    expect((captured as InstanceType<typeof AigcActionHttpError>).status).toBe(400);
    // 4xx is terminal — no retry.
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe("runAigcAction — parse error path", () => {
  it("throws AigcActionParseError when output is not valid JSON", async () => {
    const fetchStub = makeFetchStub({
      status: 200,
      body: { output: "not valid json {{{" },
    });
    const { runAigcAction, AigcActionParseError } = await import("@/lib/aigc/run-action");
    await expect(
      runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: fetchStub,
      }),
    ).rejects.toBeInstanceOf(AigcActionParseError);
    // Parse-fail is post-fetch so the call IS made, but we don't meter
    // a malformed response (per spec — JSON parse fail not retried).
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it("throws AigcActionParseError when output is missing from response body", async () => {
    const fetchStub = makeFetchStub({
      status: 200,
      body: { traceId: "abc" }, // no `output` field
    });
    const { runAigcAction, AigcActionParseError } = await import("@/lib/aigc/run-action");
    await expect(
      runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: fetchStub,
      }),
    ).rejects.toBeInstanceOf(AigcActionParseError);
  });
});

describe("runAigcAction — config error path", () => {
  it("throws AigcActionConfigError when AIGCGATEWAY_BASE_URL is missing", async () => {
    delete process.env.AIGCGATEWAY_BASE_URL;
    const { runAigcAction, AigcActionConfigError } = await import("@/lib/aigc/run-action");
    await expect(
      runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: makeFetchStub({ status: 200, body: {} }),
      }),
    ).rejects.toBeInstanceOf(AigcActionConfigError);
    expect(assertDailyCostBudget).not.toHaveBeenCalled();
  });

  it("throws AigcActionConfigError when AIGCGATEWAY_API_KEY is missing", async () => {
    delete process.env.AIGCGATEWAY_API_KEY;
    const { runAigcAction, AigcActionConfigError } = await import("@/lib/aigc/run-action");
    await expect(
      runAigcAction({
        actionId: "act-1",
        variables: {},
        tenantId: TENANT_ID,
        actionLabel: "test",
        fetchImpl: makeFetchStub({ status: 200, body: {} }),
      }),
    ).rejects.toBeInstanceOf(AigcActionConfigError);
  });
});

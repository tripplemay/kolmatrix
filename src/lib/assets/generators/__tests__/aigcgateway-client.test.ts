/**
 * BL-025-F003 · aigcgateway client unit specs.
 *
 * Verifies the timeout / retry / config-error contracts. The underlying
 * fetch is stubbed so we never touch the real gateway. AbortController
 * timing is asserted by passing a tiny timeoutMs (50ms) + a fetch impl
 * that never resolves until aborted — vitest's fake-timer overhead
 * makes hard sleeps flaky on WSL2.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AigcGatewayConfigError,
  AigcGatewayResponseError,
  AigcGatewayTimeoutError,
  runChatCompletion,
} from "../aigcgateway-client";

const ENV_KEYS = ["AIGCGATEWAY_BASE_URL", "AIGCGATEWAY_API_KEY", "AIGC_TIMEOUT_MS"] as const;
let savedEnv: Record<(typeof ENV_KEYS)[number], string | undefined>;

beforeEach(() => {
  savedEnv = ENV_KEYS.reduce(
    (acc, key) => {
      acc[key] = process.env[key];
      return acc;
    },
    {} as Record<(typeof ENV_KEYS)[number], string | undefined>
  );
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.test";
  process.env.AIGCGATEWAY_API_KEY = "test-key";
  delete process.env.AIGC_TIMEOUT_MS;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function makeJsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("runChatCompletion", () => {
  it("throws AigcGatewayConfigError when AIGCGATEWAY_BASE_URL is unset", async () => {
    delete process.env.AIGCGATEWAY_BASE_URL;
    await expect(
      runChatCompletion({
        messages: [{ role: "user", content: "hi" }],
        fetchImpl: vi.fn(),
      })
    ).rejects.toBeInstanceOf(AigcGatewayConfigError);
  });

  it("posts to /chat/completions with bearer auth + json mode and unwraps usage", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({
        id: "trace-123",
        model: "claude-haiku-4.5",
        choices: [{ message: { content: '{"foo":"bar"}' } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      })
    );

    const result = await runChatCompletion({
      messages: [{ role: "user", content: "hi" }],
      jsonMode: true,
      fetchImpl,
    });

    expect(result.rawContent).toBe('{"foo":"bar"}');
    expect(result.usage.totalTokens).toBe(300);
    expect(result.traceId).toBe("trace-123");
    const call = fetchImpl.mock.calls[0]!;
    expect(call[0]).toBe("https://aigc.test/v1/chat/completions");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.response_format).toEqual({ type: "json_object" });
  });

  it("retries once on 5xx and succeeds on the second attempt", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ error: "boom" }, 503))
      .mockResolvedValueOnce(
        makeJsonResponse({
          id: "trace-2",
          choices: [{ message: { content: "ok" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        })
      );

    const result = await runChatCompletion({
      messages: [{ role: "user", content: "hi" }],
      fetchImpl,
    });
    expect(result.rawContent).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 4xx — surfaces AigcGatewayResponseError immediately", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ error: "bad payload" }, 400));

    await expect(
      runChatCompletion({
        messages: [{ role: "user", content: "hi" }],
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(AigcGatewayResponseError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("raises AigcGatewayTimeoutError when the AbortController fires", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });

    await expect(
      runChatCompletion({
        messages: [{ role: "user", content: "hi" }],
        fetchImpl,
        timeoutMs: 30,
      })
    ).rejects.toBeInstanceOf(AigcGatewayTimeoutError);
  });

  it("throws AigcGatewayResponseError when the response is missing choices[0].message.content", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(makeJsonResponse({ choices: [] }));

    await expect(
      runChatCompletion({
        messages: [{ role: "user", content: "hi" }],
        fetchImpl,
      })
    ).rejects.toBeInstanceOf(AigcGatewayResponseError);
  });
});

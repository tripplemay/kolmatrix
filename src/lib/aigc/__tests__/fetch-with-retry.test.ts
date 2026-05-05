import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RETRY_DELAY_MS,
  JITTER_MAX_MS,
  defaultJitter,
  fetchWithRetry,
  resolveAigcV1BaseUrl,
} from "@/lib/aigc/fetch-with-retry";

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

const noSleep = () => Promise.resolve();
const fixedJitter = () => 0;

describe("fetchWithRetry", () => {
  it("returns the response immediately on 2xx (no retry)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true }));
    const sleepImpl = vi.fn(noSleep);

    const res = await fetchWithRetry(
      "https://example.test/x",
      { method: "GET" },
      { fetchImpl, sleepImpl, jitterImpl: fixedJitter },
    );

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("retries once on 503 and returns the second 200", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleepImpl = vi.fn(noSleep);

    const res = await fetchWithRetry(
      "https://example.test/x",
      { method: "POST" },
      { fetchImpl, sleepImpl, jitterImpl: fixedJitter, retryDelayMs: 100 },
    );

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenCalledWith(100);
  });

  it("returns 4xx terminally (no retry) so the caller can act on auth/validation errors", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: "bad" }));
    const sleepImpl = vi.fn(noSleep);

    const res = await fetchWithRetry(
      "https://example.test/x",
      { method: "POST" },
      { fetchImpl, sleepImpl, jitterImpl: fixedJitter },
    );

    expect(res.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("retries on 429 (Too Many Requests) like a 5xx", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const sleepImpl = vi.fn(noSleep);

    const res = await fetchWithRetry(
      "https://example.test/x",
      { method: "POST" },
      { fetchImpl, sleepImpl, jitterImpl: fixedJitter },
    );

    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rethrows the underlying error after retries are exhausted", async () => {
    const transportErr = new Error("ECONNRESET");
    const fetchImpl = vi.fn(async () => {
      throw transportErr;
    });
    const sleepImpl = vi.fn(noSleep);

    await expect(
      fetchWithRetry(
        "https://example.test/x",
        { method: "POST" },
        { fetchImpl, sleepImpl, jitterImpl: fixedJitter, retries: 2 },
      ),
    ).rejects.toBe(transportErr);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepImpl).toHaveBeenCalledTimes(2);
  });

  it("aborts after timeoutMs and surfaces the AbortError when retries are exhausted", async () => {
    const fetchImpl: typeof fetch = vi.fn(
      (_input, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    const sleepImpl = vi.fn(noSleep);

    await expect(
      fetchWithRetry(
        "https://example.test/x",
        { method: "POST" },
        {
          fetchImpl,
          sleepImpl,
          jitterImpl: fixedJitter,
          timeoutMs: 5,
          retries: 0,
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sleeps for retryDelayMs + jitter (jitter range [0, 250))", async () => {
    const sleeps: number[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(200));
    const jitterImpl = vi.fn(() => 123); // deterministic

    await fetchWithRetry(
      "https://example.test/x",
      { method: "POST" },
      {
        fetchImpl,
        jitterImpl,
        sleepImpl: async (ms) => {
          sleeps.push(ms);
        },
        retryDelayMs: 500,
      },
    );

    expect(sleeps).toEqual([623]); // 500 + 123
    expect(jitterImpl).toHaveBeenCalledTimes(1);
  });

  it("defaultJitter returns a number in [0, JITTER_MAX_MS)", () => {
    for (let i = 0; i < 32; i += 1) {
      const v = defaultJitter();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(JITTER_MAX_MS);
    }
  });

  it("respects retryOn5xx=false (returns the 503 immediately)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(503));
    const sleepImpl = vi.fn(noSleep);

    const res = await fetchWithRetry(
      "https://example.test/x",
      { method: "POST" },
      { fetchImpl, sleepImpl, retryOn5xx: false },
    );

    expect(res.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });
});

describe("resolveAigcV1BaseUrl re-export", () => {
  it("appends /v1 when missing and trims trailing slashes", () => {
    expect(resolveAigcV1BaseUrl("https://aigc.guangai.ai")).toBe("https://aigc.guangai.ai/v1");
    expect(resolveAigcV1BaseUrl("https://aigc.guangai.ai/v1/")).toBe("https://aigc.guangai.ai/v1");
    expect(resolveAigcV1BaseUrl(undefined)).toBe("https://aigc.guangai.ai/v1");
  });
});

describe("DEFAULT_RETRY_DELAY_MS", () => {
  it("is 500ms (matches v0.9.12 §AI-M4 dogfood)", () => {
    expect(DEFAULT_RETRY_DELAY_MS).toBe(500);
  });
});

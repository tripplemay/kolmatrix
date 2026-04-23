import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB surface so the generator can be exercised without a real
// Testcontainers instance. We capture the updates passed into product.update
// so each test can assert the payload shape.
const updates: Array<{ where: { id: string }; data: { aiAssets: unknown } }> = [];

vi.mock("@/lib/db", async () => {
  const Prisma = { InputJsonObject: Object };
  return {
    Prisma,
    withTenant: async (
      _tenantId: string,
      fn: (tx: {
        product: {
          update: (args: {
            where: { id: string };
            data: { aiAssets: unknown };
          }) => Promise<void>;
        };
      }) => Promise<void>
    ) => {
      await fn({
        product: {
          update: async (args) => {
            updates.push(args);
          },
        },
      });
    },
  };
});

type FetchArgs = Parameters<typeof fetch>;

function mockFetch(body: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const ok = opts.ok ?? true;
  const status = opts.status ?? (ok ? 200 : 500);
  return vi.fn(async (...args: FetchArgs) => {
    void args;
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

function rejectingFetch() {
  return vi.fn(async (...args: FetchArgs) => {
    void args;
    throw new Error("network down");
  });
}

const BASE_INPUT = {
  productId: "prod-1",
  tenantId: "11111111-1111-1111-1111-111111111111",
  name: "Honor of Kings",
  category: "MOBA",
  targetAudience: "Mobile gamers",
  uniqueSellingPoints: "Daily tournaments",
  downloadUrl: "https://example.com",
};

beforeEach(() => {
  updates.length = 0;
  process.env.AIGCGATEWAY_BASE_URL = "http://fake-gateway";
  process.env.AIGCGATEWAY_API_KEY = "sk-test";
});

describe("generateAiAssets", () => {
  it("writes ready assets with parsed emailTemplates + videoScripts", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      id: "trace-abc",
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [
                { subject: "a", body: "A" },
                { subject: "b", body: "B" },
                { subject: "c", body: "C" },
              ],
              videoScripts: [
                { title: "y1", script: "..." },
                { title: "y2", script: "..." },
              ],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [urlArg, initArg] = fetcher.mock.calls[0]!;
    expect(String(urlArg)).toBe("http://fake-gateway/v1/chat/completions");
    const init = initArg as RequestInit;
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(headers["Content-Type"]).toBe("application/json");
    const reqBody = JSON.parse(String(init.body));
    expect(reqBody.model).toBe("claude-haiku-4.5");
    expect(reqBody.response_format).toEqual({ type: "json_object" });
    expect(reqBody.messages[0].role).toBe("system");
    expect(reqBody.messages[1].content).toContain("Honor of Kings");
    expect(reqBody.messages[1].content).toContain("Daily tournaments");

    expect(updates).toHaveLength(1);
    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("ready");
    expect((assets.emailTemplates as unknown[])).toHaveLength(3);
    expect((assets.videoScripts as unknown[])).toHaveLength(2);
    expect(assets.traceId).toBe("trace-abc");
    expect(typeof assets.generatedAt).toBe("string");
  });

  it("writes a failed marker when env vars are missing", async () => {
    delete process.env.AIGCGATEWAY_API_KEY;
    const { generateAiAssets } = await import("../generateAiAssets");

    await generateAiAssets(BASE_INPUT);

    expect(updates).toHaveLength(1);
    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toContain("AIGCGATEWAY");
  });

  it("writes a failed marker on non-2xx response", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({}, { ok: false, status: 503 });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(updates).toHaveLength(1);
    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toMatch(/503/);
  });

  it("writes a failed marker when fetch throws", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = rejectingFetch();

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(updates).toHaveLength(1);
    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toContain("network down");
  });

  it("writes a failed marker when AI content is not JSON", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      choices: [{ message: { content: "totally freeform reply" } }],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toMatch(/JSON/i);
  });

  it("writes a failed marker when emailTemplates is missing", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              videoScripts: [{ title: "a", script: "b" }],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toContain("emailTemplates");
  });

  it("writes a failed marker when videoScripts is missing", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [{ subject: "a", body: "b" }],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toContain("videoScripts");
  });

  it("writes a failed marker when an emailTemplate entry is malformed", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [{ subject: "a" }], // missing body
              videoScripts: [{ title: "a", script: "b" }],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toMatch(/emailTemplates\[0\]/);
  });
});

describe("markAiAssetsPending", () => {
  it("writes {status: pending, requestedAt}", async () => {
    const { markAiAssetsPending } = await import("../generateAiAssets");
    await markAiAssetsPending(
      "11111111-1111-1111-1111-111111111111",
      "prod-2"
    );
    const assets = updates[0]!.data.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("pending");
    expect(typeof assets.requestedAt).toBe("string");
  });
});

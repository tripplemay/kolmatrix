/**
 * BM1-F003 (rewritten by BL-030-F001) · generateAiAssets unit spec.
 *
 * The generator now writes 5 rows into the unified Asset table
 * (3 email + 2 video_script, source=ai_generated, status=published)
 * via createAsset, shrinks Product.aiAssets to {status,generatedAt},
 * and emits one logAudit entry per Asset (action='asset.generated').
 * This spec mocks createAsset + logAudit + the withTenant tx so the
 * generator can be exercised without a real Testcontainers instance.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const productUpdates: Array<{ where: { id: string }; data: { aiAssets: unknown } }> = [];

const createAssetCalls: Array<{
  tenantId: string | null;
  input: Record<string, unknown>;
}> = [];

const logAuditCalls: Array<Record<string, unknown>> = [];

let createAssetIdCursor = 0;

vi.mock("@/lib/db", () => {
  const Prisma = { InputJsonObject: Object };
  return {
    Prisma,
    withTenant: async <T>(
      _tenantId: string,
      fn: (tx: {
        product: {
          update: (args: {
            where: { id: string };
            data: { aiAssets: unknown };
          }) => Promise<void>;
        };
      }) => Promise<T>
    ): Promise<T> => {
      return fn({
        product: {
          update: async (args) => {
            productUpdates.push(args);
          },
        },
      });
    },
  };
});

vi.mock("@/lib/assets/mutations", () => ({
  createAsset: async (
    _tx: unknown,
    tenantId: string | null,
    input: Record<string, unknown>
  ) => {
    createAssetIdCursor += 1;
    const id = `asset-${createAssetIdCursor}`;
    createAssetCalls.push({ tenantId, input });
    return {
      id,
      tenantId,
      productId: input.productId ?? null,
      productName: null,
      type: input.type,
      name: input.name,
      source: input.source,
      status: input.status ?? "draft",
      parentId: null,
      versionIndex: 1,
      totalVariants: 1,
      contentPreview: "",
      content: input.content,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy ?? null,
      createdAt: new Date("2026-05-04T00:00:00Z"),
      updatedAt: new Date("2026-05-04T00:00:00Z"),
    };
  },
}));

vi.mock("@/lib/audit/log", () => ({
  logAudit: async (data: Record<string, unknown>) => {
    logAuditCalls.push(data);
  },
}));

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

const TENANT = "11111111-1111-1111-1111-111111111111";
const ACTOR = "22222222-2222-2222-2222-222222222222";

const BASE_INPUT = {
  productId: "prod-1",
  tenantId: TENANT,
  actorUserId: ACTOR,
  name: "Honor of Kings",
  category: "MOBA",
  targetAudience: "Mobile gamers",
  uniqueSellingPoints: "Daily tournaments",
  downloadUrl: "https://example.com",
};

const VALID_AI_RESPONSE = {
  id: "trace-abc",
  choices: [
    {
      message: {
        content: JSON.stringify({
          emailTemplates: [
            { subject: "Initial subject", body: "Initial body" },
            { subject: "Follow subject", body: "Follow body" },
            { subject: "Sign subject", body: "Sign body" },
          ],
          videoScripts: [
            { title: "YT 60s", script: "Pan over hero..." },
            { title: "TikTok 15s", script: "Quick hook..." },
          ],
        }),
      },
    },
  ],
};

beforeEach(() => {
  productUpdates.length = 0;
  createAssetCalls.length = 0;
  logAuditCalls.length = 0;
  createAssetIdCursor = 0;
  process.env.AIGCGATEWAY_BASE_URL = "http://fake-gateway";
  process.env.AIGCGATEWAY_API_KEY = "sk-test";
});

describe("generateAiAssets — happy path (BL-030-F001)", () => {
  it("writes 5 Asset rows + 1 product.update + 5 logAudit entries", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch(VALID_AI_RESPONSE);

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(fetcher).toHaveBeenCalledTimes(1);

    // 5 createAsset calls — 3 emails + 2 videos in the spec §3.1 order.
    expect(createAssetCalls).toHaveLength(5);
    const emails = createAssetCalls.slice(0, 3);
    const videos = createAssetCalls.slice(3, 5);

    expect(emails.map((c) => c.input.name)).toEqual([
      "Honor of Kings — Initial outreach",
      "Honor of Kings — Follow-up",
      "Honor of Kings — Signing invitation",
    ]);
    expect(videos.map((c) => c.input.name)).toEqual([
      "Honor of Kings — YouTube 60s",
      "Honor of Kings — TikTok 15s",
    ]);

    for (const c of emails) {
      expect(c.tenantId).toBe(TENANT);
      expect(c.input.type).toBe("email");
      expect(c.input.source).toBe("ai_generated");
      expect(c.input.status).toBe("published");
      expect(c.input.productId).toBe("prod-1");
      expect(c.input.createdBy).toBe(ACTOR);
      const content = c.input.content as Record<string, unknown>;
      expect(content.locale).toBe("en");
      expect(content.variables).toEqual([]);
      const md = c.input.metadata as Record<string, unknown>;
      expect(md.source).toBe("kb_generation");
      expect(md.productId).toBe("prod-1");
      expect(md.traceId).toBe("trace-abc");
      expect(typeof md.generatedAt).toBe("string");
    }
    expect((emails[0]!.input.metadata as Record<string, unknown>).templateRole).toBe(
      "initial_outreach"
    );
    expect((emails[1]!.input.metadata as Record<string, unknown>).templateRole).toBe("follow_up");
    expect((emails[2]!.input.metadata as Record<string, unknown>).templateRole).toBe(
      "signing_invitation"
    );

    for (const c of videos) {
      expect(c.input.type).toBe("video_script");
      expect(c.input.source).toBe("ai_generated");
      expect(c.input.status).toBe("published");
    }
    expect((videos[0]!.input.metadata as Record<string, unknown>).templateRole).toBe(
      "youtube_60s"
    );
    expect((videos[1]!.input.metadata as Record<string, unknown>).templateRole).toBe(
      "tiktok_15s"
    );

    // Product.aiAssets shrunk to {status,generatedAt} — no content fields.
    expect(productUpdates).toHaveLength(1);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("ready");
    expect(typeof aiAssets.generatedAt).toBe("string");
    expect(aiAssets.emailTemplates).toBeUndefined();
    expect(aiAssets.videoScripts).toBeUndefined();
    expect(aiAssets.traceId).toBeUndefined();

    // 5 audit entries, one per Asset.
    expect(logAuditCalls).toHaveLength(5);
    for (const entry of logAuditCalls) {
      expect(entry.actorId).toBe(ACTOR);
      expect(entry.action).toBe("asset.generated");
      expect(entry.targetType).toBe("asset");
      expect(entry.tenantId).toBe(TENANT);
      const after = entry.after as Record<string, unknown>;
      expect(after.productId).toBe("prod-1");
      expect(after.source).toBe("kb_generation");
    }
  });

  it("requestBody passes product fields through to aigcgateway prompt", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch(VALID_AI_RESPONSE);

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

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
  });
});

describe("generateAiAssets — F001 prompt instructs Mustache tokens (BL-032)", () => {
  it("prompt 含 'Use these EXACT Mustache tokens' + AI 返回 mustache 字面 pass through 到 createAsset.content", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      id: "trace-mustache",
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [
                {
                  subject: "Hi {{kol.name}}",
                  body: "Hi {{kol.name}}, check out {{product.name}}.\n—{{marketer.name}}",
                },
                { subject: "Follow {{kol.name}}", body: "Following up, {{kol.name}}." },
                { subject: "Sign {{kol.name}}", body: "Sign now, {{kol.name}}!" },
              ],
              videoScripts: [
                { title: "YT 60s", script: "..." },
                { title: "TikTok 15s", script: "..." },
              ],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    // Prompt verification — D1 anchor phrase + 5 token names sent to the AI.
    const init = fetcher.mock.calls[0]![1] as RequestInit;
    const reqBody = JSON.parse(String(init.body));
    const promptText = String(reqBody.messages[1].content);
    expect(promptText).toContain("Use these EXACT Mustache tokens");
    expect(promptText).toContain("{{kol.name}}");
    expect(promptText).toContain("{{product.name}}");
    expect(promptText).toContain("{{product.category}}");
    expect(promptText).toContain("{{product.usp}}");
    expect(promptText).toContain("{{marketer.name}}");
    // BL-033-F002 — {{date}} added to the catalogue.
    expect(promptText).toContain("{{date}}");
    expect(promptText).toContain("do not use square brackets");

    // Pass-through verification — AI's mustache literals end up in createAsset.content.
    expect(createAssetCalls).toHaveLength(5);
    const firstEmailContent = createAssetCalls[0]!.input.content as Record<string, unknown>;
    expect(String(firstEmailContent.subject)).toContain("{{kol.name}}");
    expect(String(firstEmailContent.body)).toContain("{{kol.name}}");
    expect(String(firstEmailContent.body)).toContain("{{product.name}}");
    expect(String(firstEmailContent.body)).toContain("{{marketer.name}}");
  });
});

describe("generateAiAssets — failure paths write a failed marker, no Asset rows", () => {
  it("env vars missing", async () => {
    delete process.env.AIGCGATEWAY_API_KEY;
    const { generateAiAssets } = await import("../generateAiAssets");

    await generateAiAssets(BASE_INPUT);

    expect(createAssetCalls).toHaveLength(0);
    expect(logAuditCalls).toHaveLength(0);
    expect(productUpdates).toHaveLength(1);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toContain("AIGCGATEWAY");
  });

  it("non-2xx response", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({}, { ok: false, status: 503 });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(createAssetCalls).toHaveLength(0);
    expect(logAuditCalls).toHaveLength(0);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toMatch(/503/);
  });

  it("network throw", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = rejectingFetch();

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(createAssetCalls).toHaveLength(0);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toContain("network down");
  });

  it("non-JSON content", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      choices: [{ message: { content: "totally freeform reply" } }],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toMatch(/JSON/i);
  });

  it("missing emailTemplates", async () => {
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

    expect(createAssetCalls).toHaveLength(0);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toContain("emailTemplates");
  });

  it("missing videoScripts", async () => {
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

    expect(createAssetCalls).toHaveLength(0);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toContain("videoScripts");
  });

  it("malformed email entry (missing body)", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [{ subject: "a" }],
              videoScripts: [{ title: "a", script: "b" }],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(createAssetCalls).toHaveLength(0);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toMatch(/emailTemplates\[0\]/);
  });
});

describe("generateAiAssets — F003 server-side bracket placeholder guardrail (BL-033)", () => {
  it("rejects AI output with bracket placeholders and no Mustache: status=failed, no Asset rows, no audit", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      id: "trace-bracket",
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [
                { subject: "Hi [Creator Name]", body: "Yo [Creator]\n— [Your Name]" },
                { subject: "Follow [KOL Name]", body: "Reaching back out, [Creator]." },
                { subject: "Sign [KOL Name]", body: "Ready to sign, [Creator]?" },
              ],
              videoScripts: [
                { title: "YT 60s", script: "Pan over [DATE] hero..." },
                { title: "TikTok 15s", script: "Quick hook for [Creator]..." },
              ],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(createAssetCalls).toHaveLength(0);
    expect(logAuditCalls).toHaveLength(0);
    expect(productUpdates).toHaveLength(1);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toContain("bracket placeholders");
    expect(String(aiAssets.error)).toContain("prompt regression");
  });

  it("does not flag legitimate Title-Case bracket prose when Mustache tokens are present in the same segment", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    // Body intentionally mixes a legitimate marketing phrase
    // "[Press Release]" with a real {{kol.name}} token. The per-segment
    // rule (brackets>0 AND mustaches===0) gates on absence of mustaches,
    // so this body must pass.
    const fetcher = mockFetch({
      id: "trace-mixed",
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [
                {
                  subject: "Hi {{kol.name}} — quick note",
                  body: "Hi {{kol.name}}, see attached [Press Release] for {{product.name}}.\n— {{marketer.name}}",
                },
                { subject: "Follow {{kol.name}}", body: "Following up, {{kol.name}}." },
                { subject: "Sign {{kol.name}}", body: "Ready to sign, {{kol.name}}!" },
              ],
              videoScripts: [
                { title: "YT 60s", script: "Hi {{kol.name}}, watch the trailer." },
                { title: "TikTok 15s", script: "{{kol.name}} hooks the viewer." },
              ],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(createAssetCalls).toHaveLength(5);
    expect(productUpdates).toHaveLength(1);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("ready");
    // The legitimate bracket phrase passes through to the persisted asset.
    const firstEmailContent = createAssetCalls[0]!.input.content as Record<string, unknown>;
    expect(String(firstEmailContent.body)).toContain("[Press Release]");
    expect(String(firstEmailContent.body)).toContain("{{kol.name}}");
  });

  it("full-Mustache output is unaffected — happy path still writes 5 Assets", async () => {
    const { generateAiAssets } = await import("../generateAiAssets");
    const fetcher = mockFetch({
      id: "trace-clean",
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [
                { subject: "Hi {{kol.name}}", body: "Sent {{date}}: try {{product.name}}." },
                { subject: "Follow {{kol.name}}", body: "Following up." },
                { subject: "Sign {{kol.name}}", body: "Sign now." },
              ],
              videoScripts: [
                { title: "YT 60s", script: "Hero shot, {{kol.name}}." },
                { title: "TikTok 15s", script: "Hook, {{kol.name}}." },
              ],
            }),
          },
        },
      ],
    });

    await generateAiAssets(BASE_INPUT, { fetchImpl: fetcher as unknown as typeof fetch });

    expect(createAssetCalls).toHaveLength(5);
    expect(logAuditCalls).toHaveLength(5);
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("ready");
  });
});

describe("markAiAssetsPending", () => {
  it("writes {status: pending, requestedAt}", async () => {
    const { markAiAssetsPending } = await import("../generateAiAssets");
    await markAiAssetsPending(TENANT, "prod-2");
    const aiAssets = productUpdates[0]!.data.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("pending");
    expect(typeof aiAssets.requestedAt).toBe("string");
  });
});

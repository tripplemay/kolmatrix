/**
 * BM1-F003 · Product create + AI asset generation integration spec
 *
 * Contract covered:
 *   1. generateAiAssets() on success writes {status: "ready", emailTemplates,
 *      videoScripts, generatedAt, traceId} back onto Product.aiAssets
 *   2. generateAiAssets() on aigcgateway failure writes {status: "failed",
 *      error, failedAt} — the product row survives, aiAssets tells the UI
 *      why generation did not complete
 *   3. generateAiAssets() on malformed AI JSON writes a failure payload
 *      (parser is the last line of defense before the Dashboard reads)
 *   4. createProductSchema rejects missing USP (MVP PRD §13 Q5 contract)
 *   5. markAiAssetsPending() stamps a pending marker so the UI can show a
 *      generating chip while the background fetch is in flight
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { asTenant, cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type GenerateAiAssets = typeof import("@/lib/products/generateAiAssets").generateAiAssets;
type MarkAiAssetsPending = typeof import("@/lib/products/generateAiAssets").markAiAssetsPending;
type CreateProductSchema = typeof import("@/lib/products/schema").createProductSchema;

let generateAiAssets: GenerateAiAssets;
let markAiAssetsPending: MarkAiAssetsPending;
let createProductSchema: CreateProductSchema;

beforeAll(async () => {
  await setupTestDb();
  // Point lib code at the aigcgateway envs before it imports them. The
  // actual API is not called — `fetchImpl` is injected by the test.
  process.env.AIGCGATEWAY_BASE_URL = "http://localhost:4000";
  process.env.AIGCGATEWAY_API_KEY = "test-key-abcd";
  ({ generateAiAssets, markAiAssetsPending } = await import("@/lib/products/generateAiAssets"));
  ({ createProductSchema } = await import("@/lib/products/schema"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "product" CASCADE`);
});

async function seedProduct() {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: { name: "F003 Studio", slug: `f003-${Date.now()}-${Math.random()}` },
  });
  const product = await admin.product.create({
    data: {
      tenantId: tenant.id,
      name: "Honor of Kings",
      category: "MOBA",
      targetAudience: "Mobile gamers 18-34 in APAC",
      uniqueSellingPoints: "Daily tournaments + seasonal skins",
      downloadUrl: "https://example.com/hok",
    },
  });
  return { tenantId: tenant.id, product };
}

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

describe("generateAiAssets()", () => {
  it("stores ready assets when aigcgateway returns valid JSON", async () => {
    const { tenantId, product } = await seedProduct();
    const fetcher = mockFetch({
      id: "trace-123",
      choices: [
        {
          message: {
            content: JSON.stringify({
              emailTemplates: [
                { subject: "Intro", body: "Hello" },
                { subject: "Follow-up", body: "Did you see?" },
                { subject: "Signing", body: "Ready?" },
              ],
              videoScripts: [
                { title: "YT 60s", script: "Pan over skins..." },
                { title: "TikTok 15s", script: "Quick hook..." },
              ],
            }),
          },
        },
      ],
    });

    await generateAiAssets(
      {
        productId: product.id,
        tenantId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      },
      { fetchImpl: fetcher as unknown as typeof fetch }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const callArgs = fetcher.mock.calls[0]!;
    const [url, init] = callArgs;
    expect(String(url)).toContain("/v1/chat/completions");
    expect(init?.method).toBe("POST");
    const reqBody = JSON.parse(String(init?.body));
    expect(reqBody.model).toBe("claude-haiku-4.5");
    expect(reqBody.response_format).toEqual({ type: "json_object" });

    const updated = await getAdminPrisma().product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const assets = updated.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("ready");
    expect(Array.isArray(assets.emailTemplates)).toBe(true);
    expect((assets.emailTemplates as unknown[]).length).toBe(3);
    expect(Array.isArray(assets.videoScripts)).toBe(true);
    expect((assets.videoScripts as unknown[]).length).toBe(2);
    expect(assets.traceId).toBe("trace-123");
    expect(typeof assets.generatedAt).toBe("string");
  });

  it("writes a failed marker when aigcgateway returns non-2xx", async () => {
    const { tenantId, product } = await seedProduct();
    const fetcher = mockFetch({ error: "upstream timeout" }, { ok: false, status: 504 });

    await generateAiAssets(
      {
        productId: product.id,
        tenantId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      },
      { fetchImpl: fetcher as unknown as typeof fetch }
    );

    const updated = await getAdminPrisma().product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const assets = updated.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toContain("504");
    expect(typeof assets.failedAt).toBe("string");
    // Product row itself must still be intact — failure never wipes user data.
    expect(updated.name).toBe("Honor of Kings");
    expect(updated.uniqueSellingPoints).toBe("Daily tournaments + seasonal skins");
  });

  it("writes a failed marker when AI response is malformed JSON", async () => {
    const { tenantId, product } = await seedProduct();
    const fetcher = mockFetch({
      id: "trace-bad",
      choices: [{ message: { content: "this is not json at all" } }],
    });

    await generateAiAssets(
      {
        productId: product.id,
        tenantId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      },
      { fetchImpl: fetcher as unknown as typeof fetch }
    );

    const updated = await getAdminPrisma().product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const assets = updated.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("failed");
    expect(String(assets.error)).toMatch(/JSON/i);
  });

  it("markAiAssetsPending() stamps a pending marker inside tenant RLS", async () => {
    const { tenantId, product } = await seedProduct();

    await markAiAssetsPending(tenantId, product.id);

    const seenByTenant = await asTenant(tenantId, (tx) =>
      tx.product.findUniqueOrThrow({ where: { id: product.id } })
    );
    const assets = seenByTenant.aiAssets as Record<string, unknown>;
    expect(assets.status).toBe("pending");
    expect(typeof assets.requestedAt).toBe("string");
  });
});

describe("createProductSchema", () => {
  it("accepts a happy-path payload", () => {
    const parsed = createProductSchema.safeParse({
      name: "Honor of Kings",
      category: "MOBA",
      targetAudience: "APAC mobile gamers",
      uniqueSellingPoints: "Daily tournaments",
      downloadUrl: "https://example.com",
      launchDate: "2026-12-01",
      platforms: ["mobile", "pc"],
      generateImmediately: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing USP with code uspRequired (MVP PRD §13 Q5)", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      targetAudience: "Gamers",
      uniqueSellingPoints: "",
      platforms: [],
      generateImmediately: false,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => i.message);
      expect(msgs).toContain("uspRequired");
    }
  });

  it("rejects a malformed download URL", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      targetAudience: "Gamers",
      uniqueSellingPoints: "Cool thing",
      downloadUrl: "not-a-url",
      platforms: [],
      generateImmediately: false,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => i.message);
      expect(msgs).toContain("downloadUrlInvalid");
    }
  });

  it("accepts an empty download URL string", () => {
    const parsed = createProductSchema.safeParse({
      name: "X",
      category: "RPG",
      targetAudience: "Gamers",
      uniqueSellingPoints: "Cool thing",
      downloadUrl: "",
      platforms: [],
      generateImmediately: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.downloadUrl).toBeUndefined();
    }
  });
});

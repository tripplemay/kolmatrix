/**
 * BM1-F003 (rewritten by BL-030-F001) · Product create + AI asset
 * generation integration spec.
 *
 * Contract covered:
 *   1. generateAiAssets() on success writes 5 rows into the Asset table
 *      (3 email + 2 video_script, source=ai_generated,
 *      status=published) and shrinks Product.aiAssets to
 *      {status:'ready', generatedAt} — the legacy emailTemplates /
 *      videoScripts JSON arrays are no longer written.
 *   2. generateAiAssets() on aigcgateway failure writes {status:
 *      'failed', error, failedAt} and writes 0 Asset rows.
 *   3. generateAiAssets() on malformed AI JSON writes a failure
 *      payload + 0 Asset rows.
 *   4. createProductSchema rejects missing USP (MVP PRD §13 Q5).
 *   5. markAiAssetsPending() stamps a pending marker so the UI can
 *      show a generating chip while the background fetch is in flight.
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
  const actor = await admin.user.create({
    data: {
      tenantId: tenant.id,
      email: `actor-${Date.now()}-${Math.random()}@example.com`,
      hashedPassword: "x",
      name: "Actor",
      role: "marketer",
    },
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
  return { tenantId: tenant.id, actorUserId: actor.id, product };
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
  it("writes 5 Asset rows + shrinks Product.aiAssets when aigcgateway returns valid JSON", async () => {
    const { tenantId, actorUserId, product } = await seedProduct();
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
        actorUserId,
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

    // 5 Asset rows landed in DB (3 email + 2 video_script, all
    // source=ai_generated, status=published, productId pinned).
    const admin = getAdminPrisma();
    const assets = await admin.asset.findMany({
      where: { productId: product.id },
      orderBy: { createdAt: "asc" },
    });
    expect(assets).toHaveLength(5);
    const emails = assets.filter((a) => a.type === "email");
    const videos = assets.filter((a) => a.type === "video_script");
    expect(emails).toHaveLength(3);
    expect(videos).toHaveLength(2);
    for (const a of assets) {
      expect(a.tenantId).toBe(tenantId);
      expect(a.source).toBe("ai_generated");
      expect(a.status).toBe("published");
      expect(a.createdBy).toBe(actorUserId);
      const md = a.metadata as Record<string, unknown>;
      expect(md.source).toBe("kb_generation");
      expect(md.productId).toBe(product.id);
      expect(md.traceId).toBe("trace-123");
    }
    expect(emails.map((e) => e.name)).toEqual([
      "Honor of Kings — Initial outreach",
      "Honor of Kings — Follow-up",
      "Honor of Kings — Signing invitation",
    ]);
    expect(videos.map((v) => v.name)).toEqual([
      "Honor of Kings — YouTube 60s",
      "Honor of Kings — TikTok 15s",
    ]);

    // Product.aiAssets shrunk to {status,generatedAt} only.
    const updated = await admin.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const aiAssets = updated.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("ready");
    expect(typeof aiAssets.generatedAt).toBe("string");
    expect(aiAssets.emailTemplates).toBeUndefined();
    expect(aiAssets.videoScripts).toBeUndefined();

    // Audit log: 5 entries, one per Asset.
    const auditRows = await admin.auditLog.findMany({
      where: { tenantId, action: "asset.generated" },
    });
    expect(auditRows).toHaveLength(5);
    for (const row of auditRows) {
      expect(row.actorUserId).toBe(actorUserId);
      expect(row.resourceType).toBe("asset");
      const payload = row.payload as Record<string, unknown>;
      const after = payload.after as Record<string, unknown>;
      expect(after.productId).toBe(product.id);
      expect(after.source).toBe("kb_generation");
    }
  });

  it("writes a failed marker + 0 Asset rows when aigcgateway returns non-2xx", async () => {
    const { tenantId, actorUserId, product } = await seedProduct();
    const fetcher = mockFetch({ error: "upstream timeout" }, { ok: false, status: 504 });

    await generateAiAssets(
      {
        productId: product.id,
        tenantId,
        actorUserId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      },
      { fetchImpl: fetcher as unknown as typeof fetch }
    );

    const admin = getAdminPrisma();
    const updated = await admin.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const aiAssets = updated.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toContain("504");
    expect(typeof aiAssets.failedAt).toBe("string");
    // Product row itself must still be intact — failure never wipes user data.
    expect(updated.name).toBe("Honor of Kings");
    expect(updated.uniqueSellingPoints).toBe("Daily tournaments + seasonal skins");

    const assetCount = await admin.asset.count({ where: { productId: product.id } });
    expect(assetCount).toBe(0);
  });

  it("writes a failed marker + 0 Asset rows when AI response is malformed JSON", async () => {
    const { tenantId, actorUserId, product } = await seedProduct();
    const fetcher = mockFetch({
      id: "trace-bad",
      choices: [{ message: { content: "this is not json at all" } }],
    });

    await generateAiAssets(
      {
        productId: product.id,
        tenantId,
        actorUserId,
        name: product.name,
        category: product.category,
        targetAudience: product.targetAudience,
        uniqueSellingPoints: product.uniqueSellingPoints,
        downloadUrl: product.downloadUrl,
      },
      { fetchImpl: fetcher as unknown as typeof fetch }
    );

    const admin = getAdminPrisma();
    const updated = await admin.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    const aiAssets = updated.aiAssets as Record<string, unknown>;
    expect(aiAssets.status).toBe("failed");
    expect(String(aiAssets.error)).toMatch(/JSON/i);
    const assetCount = await admin.asset.count({ where: { productId: product.id } });
    expect(assetCount).toBe(0);
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

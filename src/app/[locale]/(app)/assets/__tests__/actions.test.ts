/**
 * BL-025-F003 · /assets generateAssetAction unit specs.
 *
 * Stubs auth, withTenant (returns whatever the callback returns —
 * no actual DB), the Asset library createAsset, the per-type
 * generators, and the audit log helper. Then exercises the success
 * + every failure branch documented in the spec.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenantMock = vi.fn();
vi.mock("@/lib/db", () => ({ withTenant: (...args: unknown[]) => withTenantMock(...args) }));

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/log", () => ({ logAudit: (...args: unknown[]) => logAuditMock(...args) }));

const createAssetMock = vi.fn();
vi.mock("@/lib/assets/mutations", () => ({
  createAsset: (...args: unknown[]) => createAssetMock(...args),
}));

const generateEmailContentMock = vi.fn();
vi.mock("@/lib/assets/generators/email-generator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/assets/generators/email-generator")>(
    "@/lib/assets/generators/email-generator"
  );
  return {
    ...actual,
    generateEmailContent: (...args: unknown[]) => generateEmailContentMock(...args),
  };
});

const generateVideoScriptContentMock = vi.fn();
vi.mock("@/lib/assets/generators/video-script-generator", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/assets/generators/video-script-generator")
  >("@/lib/assets/generators/video-script-generator");
  return {
    ...actual,
    generateVideoScriptContent: (...args: unknown[]) => generateVideoScriptContentMock(...args),
  };
});

const rateLimitAiMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 9 });
vi.mock("@/lib/rate-limit-ai", () => ({
  rateLimitAi: () => rateLimitAiMock(),
}));

const { generateAssetAction } = await import("../actions");
const { AigcGatewayConfigError, AigcGatewayTimeoutError } =
  await import("@/lib/assets/generators/aigcgateway-client");
const { EmailContentParseError } = await import("@/lib/assets/generators/email-generator");

const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PRODUCT_ID = "cmab12cd30001g8l5h3n2q9rs";
// Valid UUIDv4 (Zod's .uuid() rejects non-RFC strings — version nibble
// 4 + variant nibble 8/9/a/b are required).
const PARENT_ID = "f0eeb4b5-1111-4222-8333-444455556666";
const NEW_ASSET_ID = "99990000-1111-4222-8333-444455556666";

const product = {
  id: PRODUCT_ID,
  name: "Honor of Kings",
  category: "MOBA",
  targetAudience: "16-30 SEA",
  uniqueSellingPoints: "5v5 120Hz",
};

const generatedEmail = {
  content: {
    subject: "Hi",
    body: "Body",
    locale: "en" as const,
    variables: [],
  },
  usage: { promptTokens: 50, completionTokens: 80, totalTokens: 130 },
  traceId: "trace-1",
  model: "claude-haiku-4.5",
};

beforeEach(() => {
  authMock.mockReset();
  withTenantMock.mockReset();
  logAuditMock.mockReset().mockResolvedValue(undefined);
  createAssetMock.mockReset();
  generateEmailContentMock.mockReset();
  generateVideoScriptContentMock.mockReset();
  rateLimitAiMock.mockReset().mockResolvedValue({ ok: true, remaining: 9 });
});

function authedSession() {
  authMock.mockResolvedValue({
    user: { tenantId: TENANT_ID, id: USER_ID },
  });
}

function stubProductLookup({
  product: prod,
  parent,
  variantOrdinal,
}: {
  product: typeof product | null;
  parent?: {
    id: string;
    name: string;
    type: "email" | "video_script";
    parentId: string | null;
  } | null;
  variantOrdinal?: number;
}) {
  withTenantMock.mockImplementationOnce(
    async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        product: { findUnique: vi.fn().mockResolvedValue(prod) },
        asset: {
          findUnique: vi.fn().mockResolvedValue(parent ?? null),
          count: vi.fn().mockResolvedValue((variantOrdinal ?? 1) - 1),
        },
      });
    }
  );
}

function stubCreateAssetTx() {
  withTenantMock.mockImplementationOnce(
    async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) => fn({})
  );
  createAssetMock.mockResolvedValue({ id: NEW_ASSET_ID });
}

describe("generateAssetAction", () => {
  it("requires authentication", async () => {
    authMock.mockResolvedValue(null);
    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
    });
    expect(res).toEqual({
      ok: false,
      error: "Not signed in",
      code: "unauthorized",
    });
  });

  it("rejects malformed inputs (validation failure)", async () => {
    authedSession();
    const res = await generateAssetAction({ productId: PRODUCT_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("validation");
  });

  it("BL-035-F003 — short-circuits with rate_limit_exceeded when the AI rate limiter blocks", async () => {
    authedSession();
    rateLimitAiMock.mockResolvedValueOnce({ ok: false, retryAfter: 42 });
    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
    });
    expect(res).toEqual({
      ok: false,
      error: "rate_limit_exceeded",
      code: "rate_limit_exceeded",
      retryAfter: 42,
    });
    expect(withTenantMock).not.toHaveBeenCalled();
    expect(generateEmailContentMock).not.toHaveBeenCalled();
  });

  it("returns product_not_found without paying for an AI call", async () => {
    authedSession();
    stubProductLookup({ product: null });
    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
    });
    expect(res).toEqual({
      ok: false,
      error: "Product not found",
      code: "product_not_found",
    });
    expect(generateEmailContentMock).not.toHaveBeenCalled();
  });

  it("first generate (no parent) → audit logs asset.generated and creates an ai_generated draft", async () => {
    authedSession();
    stubProductLookup({ product });
    generateEmailContentMock.mockResolvedValueOnce(generatedEmail);
    stubCreateAssetTx();

    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
      locale: "en",
    });

    expect(res).toEqual({
      ok: true,
      assetId: NEW_ASSET_ID,
      parentAssetId: null,
      asset: { id: NEW_ASSET_ID },
    });
    const createCall = createAssetMock.mock.calls[0]![2];
    expect(createCall.source).toBe("ai_generated");
    expect(createCall.status).toBe("draft");
    expect(createCall.parentAssetId).toBeNull();
    expect(createCall.metadata.traceId).toBe("trace-1");
    expect(createCall.metadata.tokensUsed).toBe(130);

    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const auditPayload = logAuditMock.mock.calls[0]![0];
    expect(auditPayload.action).toBe("asset.generated");
    expect(auditPayload.targetType).toBe("asset");
    expect(auditPayload.targetId).toBe(NEW_ASSET_ID);
    expect(auditPayload.tenantId).toBe(TENANT_ID);
    expect(auditPayload.after.tokensUsed).toBe(130);
  });

  it("regenerate (parent set) → audit logs asset.regenerated and threads parentId through createAsset", async () => {
    authedSession();
    stubProductLookup({
      product,
      parent: {
        id: PARENT_ID,
        name: "Honor of Kings — Email v1",
        type: "email",
        parentId: null,
      },
      variantOrdinal: 2,
    });
    generateEmailContentMock.mockResolvedValueOnce(generatedEmail);
    stubCreateAssetTx();

    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
      parentAssetId: PARENT_ID,
    });

    expect(res.ok).toBe(true);
    const createCall = createAssetMock.mock.calls[0]![2];
    expect(createCall.parentAssetId).toBe(PARENT_ID);
    expect(createCall.name).toMatch(/v2$/);
    expect(logAuditMock.mock.calls[0]![0].action).toBe("asset.regenerated");
  });

  it("returns parent_not_found when parentAssetId is set but the asset is missing", async () => {
    authedSession();
    stubProductLookup({ product, parent: null });
    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
      parentAssetId: PARENT_ID,
    });
    expect(res).toEqual({
      ok: false,
      error: "Parent asset not found",
      code: "parent_not_found",
    });
    expect(generateEmailContentMock).not.toHaveBeenCalled();
  });

  it("translates AigcGatewayConfigError → ai_config", async () => {
    authedSession();
    stubProductLookup({ product });
    generateEmailContentMock.mockRejectedValueOnce(
      new AigcGatewayConfigError("AIGCGATEWAY_BASE_URL is not configured")
    );

    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ai_config");
  });

  it("translates AigcGatewayTimeoutError → ai_timeout (no audit log written)", async () => {
    authedSession();
    stubProductLookup({ product });
    generateEmailContentMock.mockRejectedValueOnce(new AigcGatewayTimeoutError(15_000));

    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ai_timeout");
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("translates EmailContentParseError → ai_parse and skips asset creation", async () => {
    authedSession();
    stubProductLookup({ product });
    generateEmailContentMock.mockRejectedValueOnce(
      new EmailContentParseError("garbage", new Error("not json"))
    );

    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "email",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ai_parse");
    expect(createAssetMock).not.toHaveBeenCalled();
  });

  it("dispatches video_script generation through generateVideoScriptContent", async () => {
    authedSession();
    stubProductLookup({ product });
    generateVideoScriptContentMock.mockResolvedValueOnce({
      content: { title: "Trailer", script: "Scene 1" },
      usage: { promptTokens: 60, completionTokens: 200, totalTokens: 260 },
      traceId: "trace-v1",
      model: "claude-haiku-4.5",
    });
    stubCreateAssetTx();

    const res = await generateAssetAction({
      productId: PRODUCT_ID,
      type: "video_script",
    });
    expect(res.ok).toBe(true);
    expect(generateEmailContentMock).not.toHaveBeenCalled();
    expect(generateVideoScriptContentMock).toHaveBeenCalledTimes(1);
    expect(createAssetMock.mock.calls[0]![2].type).toBe("video_script");
  });
});

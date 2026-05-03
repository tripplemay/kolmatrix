/**
 * BL-030-F003/F004 · Backfill script unit spec.
 *
 * Tests the backfill algorithm in isolation by mocking @/lib/db,
 * @/lib/assets/mutations, and the script's tx-level $queryRaw +
 * product.update so we can exercise:
 *   1. dry-run touches no createAsset / product.update
 *   2. execute mode creates 5 Asset rows per fresh product (3 email +
 *      2 video_script) with the spec §3.1 naming + §3.3 metadata
 *      shape, then shrinks Product.aiAssets to {status, generatedAt}
 *   3. idempotent re-run skips already-backfilled rows (matched via
 *      Asset.metadata.backfilledFrom.{sourceField,index})
 *   4. partial-state product (2 emails already in Asset table) only
 *      creates the missing 3 rows (1 email + 2 videos), still shrinks
 *      Product.aiAssets
 *
 * Real DB integration runs at deploy time (spec §8 dry-run + execute
 * vs prod) — that's the authoritative end-to-end check before the
 * 35-row migration.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CreateAssetCall {
  tenantId: string | null;
  input: Record<string, unknown>;
}

interface ProductUpdateCall {
  where: { id: string };
  data: { aiAssets: unknown };
}

const createAssetCalls: CreateAssetCall[] = [];
const productUpdateCalls: ProductUpdateCall[] = [];

// `existingBackfilledAsset` keys: `${tenantId}|${productId}|${sourceField}|${index}`
const existingBackfilled = new Set<string>();
let createdAssetCursor = 0;

function existingKey(
  tenantId: string,
  productId: string,
  sourceField: string,
  index: number
): string {
  return `${tenantId}|${productId}|${sourceField}|${index}`;
}

vi.mock("@/lib/db", () => ({
  withTenant: async <T>(
    tenantId: string,
    fn: (tx: unknown) => Promise<T>
  ): Promise<T> => {
    const tx = {
      // Backfill calls $queryRaw to check idempotency. The script
      // template-tags the call with productId / sourceField / index;
      // here we reconstruct the key from the values array Prisma
      // passes through. For the purpose of this mock we don't parse
      // the SQL — we trust the call shape and read positional args.
      $queryRaw: async (
        _strings: TemplateStringsArray,
        productId: string,
        sourceField: string,
        indexStr: string
      ): Promise<Array<{ id: string }>> => {
        const key = existingKey(tenantId, productId, sourceField, parseInt(indexStr, 10));
        return existingBackfilled.has(key)
          ? [{ id: `existing-${key}` }]
          : [];
      },
      product: {
        update: async (args: ProductUpdateCall): Promise<void> => {
          productUpdateCalls.push(args);
        },
      },
    };
    return fn(tx);
  },
  withPlatformAdmin: async () => {
    throw new Error("withPlatformAdmin should be invoked through scanProducts mock, not directly");
  },
}));

vi.mock("@/lib/assets/mutations", () => ({
  createAsset: async (
    _tx: unknown,
    tenantId: string | null,
    input: Record<string, unknown>
  ) => {
    createdAssetCursor += 1;
    const id = `asset-${createdAssetCursor}`;
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

beforeEach(() => {
  createAssetCalls.length = 0;
  productUpdateCalls.length = 0;
  existingBackfilled.clear();
  createdAssetCursor = 0;
});

const TENANT = "11111111-1111-1111-1111-111111111111";

const sampleProduct = {
  id: "33333333-3333-3333-3333-333333333333",
  tenantId: TENANT,
  name: "Honor of Kings",
  updatedAt: new Date("2026-05-01T00:00:00Z"),
  aiAssets: {
    status: "ready",
    generatedAt: "2026-05-01T01:00:00Z",
    traceId: "trace-legacy",
    emailTemplates: [
      { subject: "S1", body: "B1" },
      { subject: "S2", body: "B2" },
      { subject: "S3", body: "B3" },
    ],
    videoScripts: [
      { title: "T1", script: "Sc1" },
      { title: "T2", script: "Sc2" },
    ],
  },
};

describe("backfillProduct() — dry-run", () => {
  it("counts what would be created and writes nothing", async () => {
    const { backfillProduct } = await import("../migrate-product-aiassets-to-asset");
    const stats = {
      productsScanned: 0,
      productsCompleted: 0,
      productsFailed: 0,
      emailAssetsCreated: 0,
      emailAssetsSkipped: 0,
      videoAssetsCreated: 0,
      videoAssetsSkipped: 0,
      productsShrunk: 0,
    };

    await backfillProduct(sampleProduct, false, stats);

    expect(createAssetCalls).toHaveLength(0);
    expect(productUpdateCalls).toHaveLength(0);
    expect(stats.emailAssetsCreated).toBe(3);
    expect(stats.videoAssetsCreated).toBe(2);
    expect(stats.productsShrunk).toBe(0);
  });
});

describe("backfillProduct() — execute mode (fresh product)", () => {
  it("creates 5 Asset rows with spec §3.1 naming + §3.3 metadata, then shrinks Product.aiAssets", async () => {
    const { backfillProduct, SOURCE_FIELD_EMAIL, SOURCE_FIELD_VIDEO } = await import(
      "../migrate-product-aiassets-to-asset"
    );
    const stats = {
      productsScanned: 0,
      productsCompleted: 0,
      productsFailed: 0,
      emailAssetsCreated: 0,
      emailAssetsSkipped: 0,
      videoAssetsCreated: 0,
      videoAssetsSkipped: 0,
      productsShrunk: 0,
    };

    await backfillProduct(sampleProduct, true, stats);

    expect(createAssetCalls).toHaveLength(5);
    expect(stats.emailAssetsCreated).toBe(3);
    expect(stats.videoAssetsCreated).toBe(2);
    expect(stats.productsShrunk).toBe(1);

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

    for (const c of [...emails, ...videos]) {
      expect(c.tenantId).toBe(TENANT);
      expect(c.input.source).toBe("ai_generated");
      expect(c.input.status).toBe("published");
      expect(c.input.productId).toBe(sampleProduct.id);
      expect(c.input.createdBy).toBeNull();
      const md = c.input.metadata as Record<string, unknown>;
      expect(md.source).toBe("kb_generation");
      expect(md.traceId).toBe("trace-legacy"); // Pulled from legacy aiAssets.traceId
      expect(md.generatedAt).toBe("2026-05-01T01:00:00Z");
      const bf = md.backfilledFrom as Record<string, unknown>;
      expect(bf.productId).toBe(sampleProduct.id);
    }

    // Email backfilledFrom keys carry the email sourceField
    expect(
      (emails[0]!.input.metadata as Record<string, unknown>).backfilledFrom
    ).toMatchObject({ sourceField: SOURCE_FIELD_EMAIL, index: 0 });
    expect(
      (emails[2]!.input.metadata as Record<string, unknown>).backfilledFrom
    ).toMatchObject({ sourceField: SOURCE_FIELD_EMAIL, index: 2 });
    expect(
      (videos[0]!.input.metadata as Record<string, unknown>).backfilledFrom
    ).toMatchObject({ sourceField: SOURCE_FIELD_VIDEO, index: 0 });
    expect(
      (videos[1]!.input.metadata as Record<string, unknown>).backfilledFrom
    ).toMatchObject({ sourceField: SOURCE_FIELD_VIDEO, index: 1 });

    // Email content padded with locale + variables for EmailContentSchema.
    const emailContent = emails[0]!.input.content as Record<string, unknown>;
    expect(emailContent.subject).toBe("S1");
    expect(emailContent.body).toBe("B1");
    expect(emailContent.locale).toBe("en");
    expect(emailContent.variables).toEqual([]);

    // Video content stays {title, script}.
    const videoContent = videos[0]!.input.content as Record<string, unknown>;
    expect(videoContent.title).toBe("T1");
    expect(videoContent.script).toBe("Sc1");

    // Product.aiAssets shrunk to status tracker only.
    expect(productUpdateCalls).toHaveLength(1);
    const shrunk = productUpdateCalls[0]!.data.aiAssets as Record<string, unknown>;
    expect(shrunk.status).toBe("ready");
    expect(shrunk.generatedAt).toBe("2026-05-01T01:00:00Z");
    expect(shrunk.emailTemplates).toBeUndefined();
    expect(shrunk.videoScripts).toBeUndefined();
    expect(shrunk.traceId).toBeUndefined();
  });
});

describe("backfillProduct() — idempotent re-run", () => {
  it("skips Asset rows already keyed by metadata.backfilledFrom", async () => {
    const { backfillProduct, SOURCE_FIELD_EMAIL, SOURCE_FIELD_VIDEO } = await import(
      "../migrate-product-aiassets-to-asset"
    );
    // Pre-seed: every entry already exists. Simulates a re-run on a
    // partially-backfilled DB where ALL 5 Assets are already in place.
    for (let i = 0; i < 3; i += 1) {
      existingBackfilled.add(existingKey(TENANT, sampleProduct.id, SOURCE_FIELD_EMAIL, i));
    }
    for (let i = 0; i < 2; i += 1) {
      existingBackfilled.add(existingKey(TENANT, sampleProduct.id, SOURCE_FIELD_VIDEO, i));
    }
    const stats = {
      productsScanned: 0,
      productsCompleted: 0,
      productsFailed: 0,
      emailAssetsCreated: 0,
      emailAssetsSkipped: 0,
      videoAssetsCreated: 0,
      videoAssetsSkipped: 0,
      productsShrunk: 0,
    };

    await backfillProduct(sampleProduct, true, stats);

    expect(createAssetCalls).toHaveLength(0);
    expect(stats.emailAssetsSkipped).toBe(3);
    expect(stats.videoAssetsSkipped).toBe(2);
    expect(stats.emailAssetsCreated).toBe(0);
    expect(stats.videoAssetsCreated).toBe(0);
    // Product still gets shrunk so the second --execute pass leaves
    // Product.aiAssets in the canonical post-migration shape, even
    // when no Asset writes happened on that pass.
    expect(stats.productsShrunk).toBe(1);
    expect(productUpdateCalls).toHaveLength(1);
  });
});

describe("backfillProduct() — partial-state product", () => {
  it("only creates rows that don't already exist", async () => {
    const { backfillProduct, SOURCE_FIELD_EMAIL } = await import(
      "../migrate-product-aiassets-to-asset"
    );
    // Pre-seed: emails[0] and emails[1] already exist; emails[2] +
    // both videos still need to be backfilled.
    existingBackfilled.add(existingKey(TENANT, sampleProduct.id, SOURCE_FIELD_EMAIL, 0));
    existingBackfilled.add(existingKey(TENANT, sampleProduct.id, SOURCE_FIELD_EMAIL, 1));
    const stats = {
      productsScanned: 0,
      productsCompleted: 0,
      productsFailed: 0,
      emailAssetsCreated: 0,
      emailAssetsSkipped: 0,
      videoAssetsCreated: 0,
      videoAssetsSkipped: 0,
      productsShrunk: 0,
    };

    await backfillProduct(sampleProduct, true, stats);

    // 1 email + 2 videos created; 2 emails skipped.
    expect(createAssetCalls).toHaveLength(3);
    expect(stats.emailAssetsCreated).toBe(1);
    expect(stats.emailAssetsSkipped).toBe(2);
    expect(stats.videoAssetsCreated).toBe(2);
    expect(stats.videoAssetsSkipped).toBe(0);

    // The single email created must be the index=2 (Signing invitation).
    expect(createAssetCalls[0]!.input.name).toBe("Honor of Kings — Signing invitation");
    const md = createAssetCalls[0]!.input.metadata as Record<string, unknown>;
    expect((md.backfilledFrom as Record<string, unknown>).index).toBe(2);
  });
});

describe("backfillProduct() — generatedAt fallback", () => {
  it("uses product.updatedAt when aiAssets.generatedAt is missing", async () => {
    const { backfillProduct } = await import("../migrate-product-aiassets-to-asset");
    const productNoGenAt = {
      ...sampleProduct,
      aiAssets: {
        status: "ready",
        // generatedAt absent — backfill should fall back to product.updatedAt.
        emailTemplates: [{ subject: "X", body: "Y" }],
        videoScripts: [],
      },
    };
    const stats = {
      productsScanned: 0,
      productsCompleted: 0,
      productsFailed: 0,
      emailAssetsCreated: 0,
      emailAssetsSkipped: 0,
      videoAssetsCreated: 0,
      videoAssetsSkipped: 0,
      productsShrunk: 0,
    };

    await backfillProduct(productNoGenAt, true, stats);

    expect(createAssetCalls).toHaveLength(1);
    const md = createAssetCalls[0]!.input.metadata as Record<string, unknown>;
    expect(md.generatedAt).toBe(productNoGenAt.updatedAt.toISOString());
    // traceId absent in legacy → null in metadata.
    expect(md.traceId).toBeNull();
  });
});

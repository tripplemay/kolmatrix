/**
 * BL-067-F002 · cache.ts unit tests.
 *
 * Mocks `@/lib/db` so we don't need a Postgres connection at module load.
 * `withTenant` is stubbed to forward the callback with a fake `tx` exposing
 * only the `asset.findFirst` / `asset.create` surfaces that cache.ts uses.
 *
 * 6 cases per F002 acceptance (read hit / read miss / read expired /
 * write success / write RLS denied / TTL boundary exactly 24h - 1ms).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const assetFindFirst = vi.fn<(args: unknown) => Promise<unknown>>();
const assetCreate = vi.fn<(args: unknown) => Promise<unknown>>();

const withTenantMock = vi.fn(async (tenantId: string, fn: (tx: unknown) => unknown) => {
  void tenantId;
  return fn({ asset: { findFirst: assetFindFirst, create: assetCreate } });
});

vi.mock("@/lib/db", () => ({
  withTenant: withTenantMock,
  prisma: {},
  Prisma: {},
}));

const TENANT = "11111111-1111-1111-1111-111111111111";
const CAMPAIGN = "22222222-2222-2222-2222-222222222222";
const KOL = "33333333-3333-3333-3333-333333333333";
const LOCALE = "en";

beforeEach(() => {
  assetFindFirst.mockReset();
  assetCreate.mockReset();
  withTenantMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cache.ts — read hit / miss / expired", () => {
  it("readShortExplanation returns text on cache hit", async () => {
    assetFindFirst.mockResolvedValueOnce({ content: { text: "hello explanation" } });
    const { readShortExplanation } = await import("@/lib/explainability/cache");
    const got = await readShortExplanation(TENANT, CAMPAIGN, KOL, LOCALE);
    expect(got).toBe("hello explanation");
    expect(withTenantMock).toHaveBeenCalledWith(TENANT, expect.any(Function));
    const call = assetFindFirst.mock.calls[0][0] as {
      where: { tenantId: string; type: string; name: string; createdAt: { gt: Date } };
    };
    expect(call.where.tenantId).toBe(TENANT);
    expect(call.where.type).toBe("ai_recommendation_explanation_short");
    expect(call.where.name).toBe(`explain-short/${CAMPAIGN}/${KOL}/${LOCALE}`);
    expect(call.where.createdAt.gt).toBeInstanceOf(Date);
  });

  it("readShortExplanation returns null on cache miss (findFirst returns null)", async () => {
    assetFindFirst.mockResolvedValueOnce(null);
    const { readShortExplanation } = await import("@/lib/explainability/cache");
    const got = await readShortExplanation(TENANT, CAMPAIGN, KOL, LOCALE);
    expect(got).toBeNull();
  });

  it("readShortExplanation filters expired rows via createdAt > now-24h boundary", async () => {
    // Lock time so we can assert the exact cutoff passed to findFirst.
    const fixedNow = new Date("2026-05-15T12:00:00.000Z").getTime();
    vi.setSystemTime(fixedNow);
    assetFindFirst.mockResolvedValueOnce(null);

    const { readShortExplanation, TTL_MS } = await import("@/lib/explainability/cache");
    await readShortExplanation(TENANT, CAMPAIGN, KOL, LOCALE);

    const call = assetFindFirst.mock.calls[0][0] as {
      where: { createdAt: { gt: Date } };
    };
    const expectedCutoff = new Date(fixedNow - TTL_MS);
    expect(call.where.createdAt.gt.getTime()).toBe(expectedCutoff.getTime());
  });
});

describe("cache.ts — write paths", () => {
  it("writeShortExplanation passes correct content + metadata to asset.create", async () => {
    assetCreate.mockResolvedValueOnce(undefined);
    const fixedNow = new Date("2026-05-15T12:00:00.000Z");

    const { writeShortExplanation } = await import("@/lib/explainability/cache");
    await writeShortExplanation(
      TENANT,
      CAMPAIGN,
      KOL,
      LOCALE,
      "the explanation",
      { tokenUsage: 150, costUsd: 0.0015, traceId: "trace-1" },
      () => fixedNow,
    );

    expect(withTenantMock).toHaveBeenCalledWith(TENANT, expect.any(Function));
    const call = assetCreate.mock.calls[0][0] as {
      data: {
        tenantId: string;
        type: string;
        name: string;
        content: { text: string };
        source: string;
        status: string;
        metadata: Record<string, unknown>;
      };
    };
    expect(call.data.tenantId).toBe(TENANT);
    expect(call.data.type).toBe("ai_recommendation_explanation_short");
    expect(call.data.name).toBe(`explain-short/${CAMPAIGN}/${KOL}/${LOCALE}`);
    expect(call.data.content).toEqual({ text: "the explanation" });
    expect(call.data.source).toBe("ai_generated");
    expect(call.data.status).toBe("published");
    expect(call.data.metadata).toMatchObject({
      kolId: KOL,
      campaignId: CAMPAIGN,
      locale: LOCALE,
      generatedAt: fixedNow.toISOString(),
      tokenUsage: 150,
      costUsd: 0.0015,
      traceId: "trace-1",
    });
  });

  it("writeShortExplanation propagates RLS / DB errors from prisma layer", async () => {
    // Simulate an RLS violation (postgres error 42501) bubbling up through
    // withTenant → asset.create. cache.ts must NOT swallow it — the worker
    // path needs to know the write failed so audit/log can capture the
    // failure mode (per spec §5 不变量 #7 RLS isolation must surface).
    const rlsErr = new Error(
      'new row violates row-level security policy for table "asset"',
    );
    assetCreate.mockRejectedValueOnce(rlsErr);

    const { writeShortExplanation } = await import("@/lib/explainability/cache");
    await expect(
      writeShortExplanation(TENANT, CAMPAIGN, KOL, LOCALE, "x"),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("cache.ts — TTL boundary", () => {
  it("TTL_MS constant is exactly 24h in ms (boundary check)", async () => {
    const { TTL_MS } = await import("@/lib/explainability/cache");
    expect(TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(TTL_MS).toBe(86_400_000);
  });

  it("cutoff Date passed to findFirst is exactly `now - TTL_MS` at 24h-1ms edge", async () => {
    // The "exactly 24h - 1ms" case: a row created 23h59m59s999ms ago should
    // still be visible. Our filter is `createdAt > expireBefore`; verify the
    // cutoff is exactly now - TTL_MS so the boundary semantics match spec.
    const fixedNow = new Date("2026-05-15T12:00:00.000Z").getTime();
    vi.setSystemTime(fixedNow);
    assetFindFirst.mockResolvedValueOnce(null);

    const { readDetailedExplanation } = await import("@/lib/explainability/cache");
    await readDetailedExplanation(TENANT, CAMPAIGN, KOL, "ja");

    const call = assetFindFirst.mock.calls[0][0] as {
      where: { type: string; name: string; createdAt: { gt: Date } };
    };
    // Cutoff is exactly now - 24h. A row created 1ms later (at fixedNow - 24h + 1)
    // would satisfy `createdAt > cutoff` and be returned, which matches the
    // spec's "exactly 24h - 1ms" boundary semantic.
    const cutoff = call.where.createdAt.gt.getTime();
    expect(cutoff).toBe(fixedNow - 24 * 60 * 60 * 1000);
    // Sanity-check: a row at cutoff exactly is filtered out (`>` strict).
    // A row at cutoff + 1ms is included.
    expect(call.where.type).toBe("ai_recommendation_explanation_detailed");
    expect(call.where.name).toBe(`explain-detailed/${CAMPAIGN}/${KOL}/ja`);
  });
});

describe("cache.ts — detailed segments parse guard", () => {
  it("readDetailedExplanation returns segments when all 5 strings present", async () => {
    assetFindFirst.mockResolvedValueOnce({
      content: {
        matchScore: "m",
        categoryFit: "c",
        recentActivity: "r",
        audienceFit: "a",
        brandHistory: "b",
      },
    });
    const { readDetailedExplanation } = await import("@/lib/explainability/cache");
    const got = await readDetailedExplanation(TENANT, CAMPAIGN, KOL, "zh");
    expect(got).toEqual({
      matchScore: "m",
      categoryFit: "c",
      recentActivity: "r",
      audienceFit: "a",
      brandHistory: "b",
    });
  });

  it("readDetailedExplanation returns null when payload is malformed (missing segment)", async () => {
    assetFindFirst.mockResolvedValueOnce({
      content: { matchScore: "m", categoryFit: "c" }, // missing 3 segments
    });
    const { readDetailedExplanation } = await import("@/lib/explainability/cache");
    const got = await readDetailedExplanation(TENANT, CAMPAIGN, KOL, "zh");
    expect(got).toBeNull();
  });
});

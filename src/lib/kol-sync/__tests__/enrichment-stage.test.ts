/**
 * BL-075-F003 · Unit tests for the shared enrichment stage.
 *
 * Covers the orchestration layer (concurrency loop, dry-run, audit_log
 * shape, stats aggregation) without spinning up Prisma. The underlying
 * franc + LLM logic is covered separately in
 * `src/lib/kol/__tests__/enrichment.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __TEST_ONLY__,
  enrichKolsForTenant,
} from "../enrichment-stage";

interface FakeKolRow {
  id: string;
  bio: string | null;
  displayName: string;
  handle: string;
  audienceGeoDist: unknown;
  platform: string;
  categories: string[];
  countryCode: string | null;
  language: string | null;
}

function makeFakePrisma(rows: FakeKolRow[]) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];

  const tx = {
    kol: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        return { id: where.id, ...data };
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return { id: BigInt(1), ...data };
      }),
    },
  };

  const fakePrisma = {
    kol: {
      findMany: vi.fn(async () => rows),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  };

  return { fakePrisma, updates, audits };
}

const TENANT_ID = "11111111-2222-3333-4444-555555555555";

describe("enrichKolsForTenant", () => {
  let originalEnv: string | undefined;
  beforeEach(() => {
    originalEnv = process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
    process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID = "act_test_kol_country";
  });
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
    } else {
      process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID = originalEnv;
    }
  });

  it("returns zero stats when there are no NULL country/language rows", async () => {
    const { fakePrisma } = makeFakePrisma([]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
    });
    expect(stats.scanned).toBe(0);
    expect(stats.enrichedLanguage).toBe(0);
    expect(stats.enrichedCountry).toBe(0);
    expect(stats.llmCallCount).toBe(0);
  });

  it("fills NULL language via franc + NULL country via audience_geo_top1 + writes audit_log", async () => {
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-000000000001",
      bio: "Streaming Apex Legends from Tokyo every weekend. Following Japanese pro scene closely. Love this community.",
      displayName: "ApexTokyo",
      handle: "@apextokyo",
      audienceGeoDist: { JP: 70, US: 20, Other: 10 },
      platform: "youtube",
      categories: ["FPS"],
      countryCode: null,
      language: null,
    };
    const { fakePrisma, updates, audits } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
    });

    expect(stats.scanned).toBe(1);
    expect(stats.enrichedLanguage).toBe(1);
    expect(stats.enrichedCountry).toBe(1);
    expect(stats.enrichedBoth).toBe(1);
    expect(stats.sources.audienceGeoTop1).toBe(1);
    expect(stats.sources.llm).toBe(0);

    expect(updates).toHaveLength(1);
    expect(updates[0]!.data).toMatchObject({ language: "en", countryCode: "JP" });

    expect(audits).toHaveLength(1);
    const auditPayload = audits[0]!.payload as {
      before: { language: string | null; country_code: string | null };
      after: { language: string | null; country_code: string | null };
      source: { language: string; country: string };
    };
    expect(audits[0]!.action).toBe("kol.enriched");
    expect(audits[0]!.resourceType).toBe("kol");
    expect(audits[0]!.tenantId).toBe(TENANT_ID);
    expect(auditPayload.before).toEqual({ language: null, country_code: null });
    expect(auditPayload.after).toEqual({ language: "en", country_code: "JP" });
    expect(auditPayload.source.country).toBe("audience-geo-top1");
  });

  it("falls back to LLM for country when audience_geo is empty", async () => {
    const llm = vi.fn().mockResolvedValue({ country: "BR", confidence: 0.7 });
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-000000000002",
      bio: "Jogador profissional de Free Fire, transmitindo direto do Rio de Janeiro todos os dias.",
      displayName: "BrazilianGamerRJ",
      handle: "@brgamerrj",
      audienceGeoDist: null,
      platform: "youtube",
      categories: ["Mobile"],
      countryCode: null,
      language: null,
    };
    const { fakePrisma, updates, audits } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      llm,
    });

    expect(stats.scanned).toBe(1);
    expect(stats.llmCallCount).toBe(1);
    expect(stats.enrichedCountry).toBe(1);
    expect(stats.sources.llm).toBe(1);
    expect(stats.estimatedLlmCostUsd).toBeCloseTo(
      __TEST_ONLY__.COST_PER_LLM_CALL_USD,
      6,
    );
    expect(updates[0]!.data.countryCode).toBe("BR");
    expect((audits[0]!.payload as { source: { country: string } }).source.country).toBe("llm");
  });

  it("skips DB writes in dryRun mode while still computing stats", async () => {
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-000000000003",
      bio: "Streaming Fortnite from California.",
      displayName: "CaliFortPro",
      handle: "@califortpro",
      audienceGeoDist: { US: 60, MX: 20, Other: 20 },
      platform: "youtube",
      categories: ["FPS"],
      countryCode: null,
      language: null,
    };
    const { fakePrisma, updates, audits } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      dryRun: true,
    });
    expect(stats.scanned).toBe(1);
    expect(stats.enrichedCountry).toBe(1);
    expect(updates).toEqual([]);
    expect(audits).toEqual([]);
  });

  it("never overwrites an existing non-null column even when enrichment proposes a value", async () => {
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-000000000004",
      bio: "I stream Valorant from London every evening with my crew. Great fun.",
      displayName: "LondonValPro",
      handle: "@londonvalpro",
      audienceGeoDist: { GB: 55, US: 20, Other: 25 },
      platform: "youtube",
      categories: ["FPS"],
      countryCode: "GB",
      language: null,
    };
    const { fakePrisma, updates, audits } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
    });
    expect(stats.enrichedCountry).toBe(0);
    expect(stats.enrichedLanguage).toBe(1);
    // The update payload only carries the language column — countryCode
    // is preserved untouched.
    expect(updates[0]!.data).toEqual({ language: "en" });
    const after = (audits[0]!.payload as { after: Record<string, unknown> }).after;
    expect(after).toEqual({ language: "en", country_code: "GB" });
  });

  it("counts a row as failed and continues the loop on $transaction throw", async () => {
    const rows: FakeKolRow[] = [
      {
        id: "00000000-0000-0000-0000-000000000005",
        bio: "Streaming PUBG Mobile from Mumbai.",
        displayName: "MumbaiPubgPro",
        handle: "@mumpubg",
        audienceGeoDist: { IN: 80, Other: 20 },
        platform: "youtube",
        categories: ["Mobile"],
        countryCode: null,
        language: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000006",
        bio: "Streaming Apex Legends from Seoul, Korea every weekend with friends.",
        displayName: "SeoulApexCrew",
        handle: "@seoulapex",
        audienceGeoDist: { KR: 65, JP: 15, Other: 20 },
        platform: "youtube",
        categories: ["FPS"],
        countryCode: null,
        language: null,
      },
    ];
    const { fakePrisma, updates } = makeFakePrisma(rows);
    let call = 0;
    fakePrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      call += 1;
      if (call === 1) throw new Error("transient db blip");
      return fn({
        kol: { update: async () => null },
        auditLog: { create: async () => null },
      });
    });
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      concurrency: 1,
    });
    expect(stats.failedCount).toBe(1);
    expect(stats.scanned).toBe(2);
    // updates[] only captures rows we recorded on the per-tx mock; the
    // re-stubbed tx in this test does not append to the outer array, so
    // we just assert the loop did not bail.
    expect(updates).toEqual([]);
  });

  it("respects custom concurrency without losing rows", async () => {
    const rows: FakeKolRow[] = Array.from({ length: 8 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i + 10).padStart(12, "0")}`,
      bio: "Streaming Valorant from California every Saturday.",
      displayName: `CreatorNo${i}`,
      handle: `@creator${i}`,
      audienceGeoDist: { US: 60, Other: 40 },
      platform: "youtube",
      categories: ["FPS"],
      countryCode: null,
      language: null,
    }));
    const { fakePrisma, updates } = makeFakePrisma(rows);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      concurrency: 3,
    });
    expect(stats.scanned).toBe(8);
    expect(updates).toHaveLength(8);
    expect(new Set(updates.map((u) => u.id)).size).toBe(8);
  });
});

describe("normaliseAudienceGeo helper", () => {
  it("coerces stringified numbers and drops non-numeric values", () => {
    const out = __TEST_ONLY__.normaliseAudienceGeo({
      JP: "60",
      US: "twenty",
      GB: 15,
      KR: NaN,
    });
    expect(out).toEqual({ JP: 60, GB: 15 });
  });

  it("returns null for non-object input", () => {
    expect(__TEST_ONLY__.normaliseAudienceGeo(null)).toBeNull();
    expect(__TEST_ONLY__.normaliseAudienceGeo("not-an-object")).toBeNull();
    expect(__TEST_ONLY__.normaliseAudienceGeo([1, 2, 3])).toBeNull();
  });
});

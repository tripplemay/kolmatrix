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
  // BL-081-F003 — drive the fake findMany's gate simulation (the real
  // query filters on these via a field-reference comparison).
  countryEnrichmentAttemptedAt?: Date | null;
  lastSyncedAt?: Date | null;
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
      // Simulate the real BL-081-F003 WHERE: rows with a NULL/blank
      // country or language, gated to those not-yet-attempted OR
      // re-synced since the last attempt. Lets the gate test cases
      // assert which rows reach the enrichment loop.
      findMany: vi.fn(async () =>
        rows.filter((r) => {
          const orMatch =
            !r.countryCode ||
            r.countryCode === "" ||
            !r.language ||
            r.language === "";
          const attempted = r.countryEnrichmentAttemptedAt ?? null;
          const lastSynced = r.lastSyncedAt ?? null;
          const gate =
            attempted == null ||
            (lastSynced != null &&
              lastSynced.getTime() > attempted.getTime());
          return orMatch && gate;
        }),
      ),
      // Field-reference sentinel so building the where (which reads
      // `prisma.kol.fields.countryEnrichmentAttemptedAt`) doesn't throw.
      fields: {
        countryEnrichmentAttemptedAt: {
          name: "country_enrichment_attempted_at",
        },
      },
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
      minLlmIntervalMs: 0,
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
      minLlmIntervalMs: 0,
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
      after: {
        language: string | null;
        country_code: string | null;
        enrichment_attempted_at: string | null;
      };
      source: { language: string; country: string };
    };
    expect(audits[0]!.action).toBe("kol.enriched");
    expect(audits[0]!.resourceType).toBe("kol");
    expect(audits[0]!.tenantId).toBe(TENANT_ID);
    expect(auditPayload.before).toEqual({ language: null, country_code: null });
    expect(auditPayload.after).toEqual({
      language: "en",
      country_code: "JP",
      // country was NULL → enrichment attempted → marker stamped.
      enrichment_attempted_at: expect.any(String),
    });
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
      minLlmIntervalMs: 0,
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
      minLlmIntervalMs: 0,
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
      minLlmIntervalMs: 0,
    });
    expect(stats.enrichedCountry).toBe(0);
    expect(stats.enrichedLanguage).toBe(1);
    // The update payload only carries the language column — countryCode
    // is preserved untouched.
    expect(updates[0]!.data).toEqual({ language: "en" });
    const after = (audits[0]!.payload as { after: Record<string, unknown> }).after;
    // country already populated → enrichment not attempted → marker null.
    expect(after).toEqual({
      language: "en",
      country_code: "GB",
      enrichment_attempted_at: null,
    });
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
      minLlmIntervalMs: 0,
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
      minLlmIntervalMs: 0,
      concurrency: 3,
    });
    expect(stats.scanned).toBe(8);
    expect(updates).toHaveLength(8);
    expect(new Set(updates.map((u) => u.id)).size).toBe(8);
  });

  // ---- BL-081-F003 retry-storm gate + attempted-marker --------------

  it("F003 gate: skips a KOL already attempted whose data has not re-synced", async () => {
    const attemptedAt = new Date("2026-05-30T00:00:00.000Z");
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-0000000000a1",
      bio: "",
      displayName: "AlreadyTried",
      handle: "@tried",
      audienceGeoDist: null,
      platform: "tiktok",
      categories: ["Mobile"],
      countryCode: null,
      language: null,
      countryEnrichmentAttemptedAt: attemptedAt,
      lastSyncedAt: attemptedAt, // no fresh sync since the attempt
    };
    const llm = vi.fn();
    const { fakePrisma, updates } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      minLlmIntervalMs: 0,
      llm,
    });
    expect(stats.scanned).toBe(0);
    expect(llm).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("F003 gate: re-attempts a KOL re-synced after its last attempt", async () => {
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-0000000000a2",
      bio: "Streaming from Seoul, Korea every weekend with friends here.",
      displayName: "ReSynced",
      handle: "@resynced",
      audienceGeoDist: { KR: 80, Other: 20 },
      platform: "youtube",
      categories: ["FPS"],
      countryCode: null,
      language: null,
      countryEnrichmentAttemptedAt: new Date("2026-05-25T00:00:00.000Z"),
      lastSyncedAt: new Date("2026-05-31T00:00:00.000Z"), // fresher than attempt
    };
    const { fakePrisma, updates } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      minLlmIntervalMs: 0,
    });
    expect(stats.scanned).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.countryCode).toBe("KR");
    expect(updates[0]!.data.countryEnrichmentAttemptedAt).toBeInstanceOf(Date);
  });

  it("F003 fix: stamps attempted_at even when nothing is resolved (stops the storm)", async () => {
    const llm = vi.fn().mockResolvedValue({ country: null, confidence: 0 });
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-0000000000a3",
      bio: "", // unanalyzable → franc yields no language
      displayName: "Unresolvable",
      handle: "@unresolvable",
      audienceGeoDist: null, // forces the LLM path
      platform: "instagram",
      categories: ["Mobile"],
      countryCode: null,
      language: null,
    };
    const { fakePrisma, updates, audits } = makeFakePrisma([row]);
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      minLlmIntervalMs: 0,
      llm,
    });
    expect(stats.scanned).toBe(1);
    expect(stats.enrichedCountry).toBe(0);
    expect(stats.enrichedLanguage).toBe(0);
    // Pre-F003 this produced an EMPTY updateData → no write → re-scanned +
    // re-LLM'd daily. Now the marker is written so the gate drops it next run.
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data).toEqual({
      countryEnrichmentAttemptedAt: expect.any(Date),
    });
    expect(audits).toHaveLength(1);
    const after = (
      audits[0]!.payload as { after: { enrichment_attempted_at: string | null } }
    ).after;
    expect(after.enrichment_attempted_at).toEqual(expect.any(String));
  });

  it("F003 atomicity: a failed marker write rolls back via $transaction and is counted", async () => {
    const llm = vi.fn().mockResolvedValue({ country: null, confidence: 0 });
    const row: FakeKolRow = {
      id: "00000000-0000-0000-0000-0000000000a4",
      bio: "",
      displayName: "WriteFails",
      handle: "@writefails",
      audienceGeoDist: null,
      platform: "instagram",
      categories: ["Mobile"],
      countryCode: null,
      language: null,
    };
    const { fakePrisma, updates } = makeFakePrisma([row]);
    fakePrisma.$transaction.mockImplementationOnce(async () => {
      throw new Error("marker write blip");
    });
    const stats = await enrichKolsForTenant({
      prisma: fakePrisma as never,
      tenantId: TENANT_ID,
      logger: () => {},
      minLlmIntervalMs: 0,
      llm,
    });
    expect(stats.failedCount).toBe(1);
    expect(stats.scanned).toBe(1);
    // tx threw atomically before any row/audit write was recorded.
    expect(updates).toEqual([]);
  });
});

describe("LLM rate gate (BL-075-F004 prod 429 defense)", () => {
  it("spaces out acquires by at least intervalMs", async () => {
    const gate = __TEST_ONLY__.makeLlmRateGate(50);
    const t0 = Date.now();
    await gate();
    await gate();
    await gate();
    const elapsed = Date.now() - t0;
    // 3 acquires at 50ms gap → at minimum ~100ms of waits between
    // the 1st and 3rd. Generous floor accounts for timer jitter.
    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  it("returns immediately when intervalMs is 0 (test-only bypass)", async () => {
    const gate = __TEST_ONLY__.makeLlmRateGate(0);
    const t0 = Date.now();
    for (let i = 0; i < 5; i += 1) await gate();
    expect(Date.now() - t0).toBeLessThan(20);
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

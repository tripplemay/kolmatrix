import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type LoadTopicCloud = typeof import("@/lib/kol-detail/topic-cloud").loadTopicCloud;

let loadTopicCloud: LoadTopicCloud;

const fetchMock = vi.fn();

beforeAll(async () => {
  vi.stubGlobal("fetch", fetchMock);
  await setupTestDb();
  ({ loadTopicCloud } = await import("@/lib/kol-detail/topic-cloud"));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await teardownTestDb();
});

beforeEach(async () => {
  fetchMock.mockReset();
  // BL-070-F002 — topic-cloud now routes through `runAigcAction` which
  // reads AIGCGATEWAY_API_KEY / AIGCGATEWAY_BASE_URL from env. Tests
  // used to plumb these via opts.apiKey / opts.baseUrl; the SDK has
  // taken ownership of both.
  process.env.AIGCGATEWAY_API_KEY = "pk_test";
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.example.test/v1";
  // Disable the per-tenant daily cost cap so the integration tests
  // exercise the success path without seeding event_log rows.
  process.env.AI_DAILY_COST_USD_PER_TENANT_MAX = "0";
  await cleanDb();
});

async function seedKol(metadata: unknown = null) {
  const admin = getAdminPrisma();
  const tenant = await admin.tenant.create({
    data: {
      name: `Topic Cloud ${Date.now()}`,
      slug: `topic-cloud-${Math.random().toString(36).slice(2, 8)}`,
    },
  });

  const kol = await admin.kol.create({
    data: {
      tenantId: tenant.id,
      platform: "youtube",
      externalId: "UC_topic",
      handle: "@topic-cloud",
      displayName: "Topic Cloud Channel",
      followerCount: 100_000,
      categories: ["Gaming"],
      isGaming: true,
      valueScore: 80,
      metadata: metadata as never,
    },
  });

  return { tenantId: tenant.id, kolId: kol.id };
}

describe("B5-F006 topic cloud loader", () => {
  it("returns fresh cached keywords without calling aigcgateway", async () => {
    const cached = {
      topicCloud: {
        keywords: [{ term: "RPG", weight: 0.7 }],
        fetchedAt: "2026-04-30T11:00:00.000Z",
        version: 1,
      },
    };
    const { tenantId, kolId } = await seedKol(cached);

    const result = await loadTopicCloud({
      tenantId,
      kolId,
      titles: ["Latest RPG build guide"],
      metadata: cached,
      actionId: "action-123",
      now: () => Date.parse("2026-04-30T12:00:00.000Z"),
    });

    expect(result).toEqual([{ term: "RPG", weight: 0.7 }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches keywords on cache miss and persists the refreshed cache", async () => {
    const { tenantId, kolId } = await seedKol({});
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output:
          '```json\n{"keywords":[{"term":"FPS","weight":0.9},{"term":"Ranked","weight":0.4}]}\n```',
      }),
    });

    const result = await loadTopicCloud({
      tenantId,
      kolId,
      titles: ["FPS ranked climb", "Ranked loadout tips"],
      metadata: {},
      actionId: "action-123",
      now: () => Date.parse("2026-04-30T12:00:00.000Z"),
    });

    expect(result).toEqual([
      { term: "FPS", weight: 0.9 },
      { term: "Ranked", weight: 0.4 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const saved = await getAdminPrisma().kol.findUniqueOrThrow({ where: { id: kolId } });
    expect(saved.metadata).toMatchObject({
      topicCloud: {
        keywords: [
          { term: "FPS", weight: 0.9 },
          { term: "Ranked", weight: 0.4 },
        ],
        fetchedAt: "2026-04-30T12:00:00.000Z",
        version: 1,
      },
    });
  });

  it("falls back to stale cache when aigcgateway returns a failure", async () => {
    const cached = {
      topicCloud: {
        keywords: [{ term: "MMO", weight: 0.6 }],
        fetchedAt: "2026-04-20T12:00:00.000Z",
        version: 1,
      },
    };
    const { tenantId, kolId } = await seedKol(cached);
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ output: "" }),
    });

    const result = await loadTopicCloud({
      tenantId,
      kolId,
      titles: ["MMO raid guide"],
      metadata: cached,
      actionId: "action-123",
      now: () => Date.parse("2026-04-30T12:00:00.000Z"),
    });

    expect(result).toEqual([{ term: "MMO", weight: 0.6 }]);
    // The mock returns { ok: false } with no status — runAigcAction's
    // retry layer treats undefined status as non-retryable so we still
    // see exactly one fetch before the catch-all collapses to the
    // stale-cache fallback.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const saved = await getAdminPrisma().kol.findUniqueOrThrow({ where: { id: kolId } });
    expect(saved.metadata).toMatchObject(cached);
  });

  it("falls back to stale cache when the Action is not configured", async () => {
    const cached = {
      topicCloud: {
        keywords: [{ term: "Strategy", weight: 0.8 }],
        fetchedAt: "2026-04-20T12:00:00.000Z",
        version: 1,
      },
    };
    const { tenantId, kolId } = await seedKol(cached);

    const result = await loadTopicCloud({
      tenantId,
      kolId,
      titles: ["Strategy macro fundamentals"],
      metadata: cached,
      actionId: undefined,
      now: () => Date.parse("2026-04-30T12:00:00.000Z"),
    });

    expect(result).toEqual([{ term: "Strategy", weight: 0.8 }]);
    expect(fetchMock).not.toHaveBeenCalled();

    const saved = await getAdminPrisma().kol.findUniqueOrThrow({ where: { id: kolId } });
    expect(saved.metadata).toMatchObject(cached);
  });
});

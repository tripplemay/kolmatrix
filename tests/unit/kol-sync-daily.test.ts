/**
 * B6-kol-daily-sync F003 · Daily orchestrator unit fixtures.
 *
 * `runDaily` is the pure-orchestration core of `scripts/kol-sync-daily.ts`
 * — it takes adapters + Prisma + flags, drives healthCheck →
 * discover → import → refresh → import, and returns a structured
 * report. The bin entry point only handles arg parsing + dotenv +
 * file IO, so the orchestration logic is verified entirely from this
 * suite.
 *
 * Five describes cover:
 *   1. parseArgs — defaults / dry-run / refresh-batch validation
 *   2. dry-run — no API, no Prisma touched, plan-only report
 *   3. all-unhealthy — bails before discover, errors logged
 *   4. happy path — discover writes inserted, refresh writes updated,
 *      quota estimate accumulated
 *   5. fail isolation — one adapter throws but the rest of the
 *      pipeline continues with non-OK outcome surfaced
 */
import { describe, expect, it, vi } from "vitest";

import { MockKolSyncAdapter } from "@/lib/kol-sync/adapters/mock";
import type { RawKolData } from "@/lib/kol-sync/types";
import { parseArgs, runDaily } from "@/../scripts/kol-sync-daily";

function fakeChannel(overrides: Partial<RawKolData>): RawKolData {
  return {
    externalId: "UC_default",
    platform: "youtube",
    handle: "@default",
    displayName: "Default Channel",
    description: "Plays competitive FPS daily.",
    country: "US",
    language: "en",
    subscriberCount: 200_000,
    videoCount: 300,
    viewCount: 10_000_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    publishedAt: "2018-01-01T00:00:00Z",
    scrapedAt: "2026-04-28T08:30:00.000Z",
    ...overrides,
  };
}

describe("parseArgs", () => {
  it("defaults to live + 200 refresh batch", () => {
    expect(parseArgs([])).toEqual({
      dryRun: false,
      refreshBatch: 200,
      noRefresh: false,
    });
  });

  it("accepts --dry-run + --no-refresh + --refresh-batch", () => {
    expect(parseArgs(["--dry-run", "--no-refresh", "--refresh-batch", "50"])).toEqual({
      dryRun: true,
      refreshBatch: 50,
      noRefresh: true,
    });
  });

  it("rejects out-of-range refresh-batch", () => {
    expect(() => parseArgs(["--refresh-batch", "-1"])).toThrow();
    expect(() => parseArgs(["--refresh-batch", "1001"])).toThrow();
    expect(() => parseArgs(["--refresh-batch", "junk"])).toThrow();
  });
});

describe("runDaily · dry-run", () => {
  it("returns a plan-only report with no discover / refresh / import", async () => {
    const adapter = new MockKolSyncAdapter({ name: "mock", channels: [] });
    const report = await runDaily({
      adapters: [adapter],
      prisma: null,
      tenantSlug: "demo",
      dryRun: true,
      refreshBatch: 200,
      noRefresh: false,
    });
    expect(report.discover).toBeNull();
    expect(report.refresh).toBeNull();
    expect(report.importStats).toBeNull();
    expect(report.refreshImportStats).toBeNull();
    expect(report.errors).toEqual([]);
    // healthCheck still runs — 1u per adapter.
    expect(report.estimatedQuotaConsumed).toBe(1);
    expect(report.health.mock).toMatchObject({ healthy: true });
  });
});

describe("runDaily · all unhealthy", () => {
  it("bails before discover when every adapter reports unhealthy", async () => {
    const broken = new MockKolSyncAdapter({
      name: "broken",
      channels: [],
      fail: new Error("API key invalid"),
    });
    const report = await runDaily({
      adapters: [broken],
      prisma: null,
      tenantSlug: "demo",
      dryRun: false,
      refreshBatch: 200,
      noRefresh: false,
      retry: { sleep: async () => {}, backoffsMs: [1, 1, 1] },
    });
    expect(report.discover).toBeNull();
    expect(report.refresh).toBeNull();
    expect(report.errors).toEqual(["all adapters unhealthy — bailing before discover"]);
    expect(report.health.broken.healthy).toBe(false);
  });
});

describe("runDaily · happy path", () => {
  it("writes discovered rows, then refreshes stale ones, accumulates quota estimate", async () => {
    const ch1 = fakeChannel({ externalId: "UC_a" });
    const ch2 = fakeChannel({ externalId: "UC_b" });
    const adapter = new MockKolSyncAdapter({
      name: "youtube",
      channels: [ch1, ch2],
    });

    const upserts: Array<{ externalId: string }> = [];
    const fakePrisma = {
      tenant: {
        findUnique: vi.fn(async () => ({ id: "tenant-1" })),
      },
      kol: {
        // BIx-F004-P3: refresh now goes through `fetchTieredRefreshIds`
        // which fans out into three findMany variants (top500 / tier3
        // exclusion / flagged). Branch on the where shape so the
        // happy-path keeps a deterministic two-id refresh batch.
        findMany: vi.fn(async (args: { where?: Record<string, unknown> } = {}) => {
          const where = (args.where ?? {}) as Record<string, unknown>;
          // Flagged branch — return both rows so the suspicious
          // injection is observable via 4 total upserts.
          if (where.isSuspicious === true) {
            return [{ externalId: "UC_a" }, { externalId: "UC_b" }];
          }
          // Tier 3 (id: { notIn: top500Ids }) → empty long-tail.
          if (where.id) return [];
          // Top-500 / embedding "touched" lookup → return ids+externalIds.
          return [
            { id: "k1", externalId: "UC_a" },
            { id: "k2", externalId: "UC_b" },
          ];
        }),
        findUnique: vi.fn(async () => {
          // First findUnique per externalId returns null → 'inserted'.
          // We can't easily track call sequence here without state; use
          // null to keep insert path simple.
          return null;
        }),
        upsert: vi.fn(
          async ({
            where,
          }: {
            where: { tenantId_platform_externalId: { externalId: string } };
          }) => {
            upserts.push({ externalId: where.tenantId_platform_externalId.externalId });
            return null;
          }
        ),
      },
      // B7a-F001 embed hook entry — orchestrator queries
      // `prisma.kol.findMany` for ids touched, then calls
      // `embedKolsForIds(prisma, ids)` which runs $queryRawUnsafe.
      // Returning an empty array short-circuits the embed loop, so the
      // hook stays a no-op without polluting `report.errors`.
      $queryRawUnsafe: vi.fn(async () => []),
      $executeRaw: vi.fn(async () => 0),
    };

    const report = await runDaily({
      adapters: [adapter],
      // Cast: the orchestrator only touches the four methods above.
      prisma: fakePrisma as unknown as Parameters<typeof runDaily>[0]["prisma"],
      tenantSlug: "demo",
      dryRun: false,
      refreshBatch: 200,
      noRefresh: false,
      retry: { sleep: async () => {}, backoffsMs: [1, 1, 1] },
    });

    expect(report.health.youtube.healthy).toBe(true);
    expect(report.discover?.totals.discoverCount).toBe(2);
    expect(report.refresh?.totals.refreshCount).toBe(2);
    expect(report.errors).toEqual([]);
    // 4 upserts: 2 from discover + 2 from refresh, all hitting the same 2 ids.
    expect(upserts.map((u) => u.externalId).sort()).toEqual(["UC_a", "UC_a", "UC_b", "UC_b"]);
    // healthCheck (1) + youtube discover (9,000 — BIx-F004-P3 14-region
    // matrix + publishedAfter phase) + refresh batch ⌈2/50⌉ = 1 →
    // total 9,002.
    expect(report.estimatedQuotaConsumed).toBe(9_002);
  });
});

describe("runDaily · failure isolation", () => {
  it("dead adapter surfaces as non-OK outcome but the healthy one still runs", async () => {
    const dead = new MockKolSyncAdapter({
      name: "dead",
      channels: [],
      fail: new Error("upstream 500"),
    });
    const ok = new MockKolSyncAdapter({
      name: "ok",
      channels: [fakeChannel({ externalId: "UC_ok" })],
    });
    const fakePrisma = {
      tenant: { findUnique: vi.fn(async () => ({ id: "tenant-1" })) },
      kol: {
        findMany: vi.fn(async () => []),
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => null),
      },
    };
    const report = await runDaily({
      adapters: [dead, ok],
      prisma: fakePrisma as unknown as Parameters<typeof runDaily>[0]["prisma"],
      tenantSlug: "demo",
      dryRun: false,
      refreshBatch: 0,
      noRefresh: false,
      retry: { sleep: async () => {}, backoffsMs: [1, 1, 1] },
    });
    expect(report.health.dead.healthy).toBe(false);
    expect(report.health.ok.healthy).toBe(true);
    // ok adapter healthy → discover runs.
    expect(report.discover?.totals.failedAdapters).toBe(1);
    expect(report.discover?.totals.discoverCount).toBe(1);
    expect(report.errors.some((e) => e.includes("dead"))).toBe(true);
  });
});

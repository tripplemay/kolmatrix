/**
 * BL-059 · Daily orchestrator unit fixtures (post-deprecate).
 *
 * `runDaily` is the pure-orchestration core of `scripts/kol-sync-daily.ts`
 * — it takes adapters + Prisma + flags, drives healthCheck →
 * discover → import → embed-hook, and returns a structured report.
 * After BL-059 (5/9) the YouTube path + engagement-batch + tiered
 * refresh have been removed; the orchestrator is now apify-kol-only,
 * with the embedding hook as the only post-discover phase.
 *
 * Four describes cover:
 *   1. parseArgs — defaults / dry-run; legacy --no-refresh +
 *      --refresh-batch flags silently ignored for cron compat.
 *   2. dry-run — no API, no Prisma touched, plan-only report.
 *   3. all-unhealthy — bails before discover, errors logged.
 *   4. happy path — discover writes inserted, no refresh phase.
 *   5. fail isolation — one adapter throws but the rest of the
 *      pipeline continues with non-OK outcome surfaced.
 */
import { describe, expect, it, vi } from "vitest";

import { MockKolSyncAdapter } from "@/lib/kol-sync/adapters/mock";
import type { RawKolData } from "@/lib/kol-sync/types";
import { parseArgs, runDaily } from "@/../scripts/kol-sync-daily";

function fakeChannel(overrides: Partial<RawKolData>): RawKolData {
  return {
    externalId: "ig_default",
    platform: "instagram",
    handle: "@default",
    displayName: "Default Creator",
    description: "Plays competitive FPS daily.",
    country: "US",
    language: "en",
    subscriberCount: 200_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    scrapedAt: "2026-05-09T00:30:00.000Z",
    ...overrides,
  };
}

describe("parseArgs", () => {
  it("defaults to live (no dry-run)", () => {
    expect(parseArgs([])).toEqual({ dryRun: false });
  });

  it("accepts --dry-run", () => {
    expect(parseArgs(["--dry-run"])).toEqual({ dryRun: true });
  });

  it("silently ignores legacy --no-refresh / --refresh-batch (BL-059 cron compat)", () => {
    expect(parseArgs(["--no-refresh", "--refresh-batch", "50"])).toEqual({ dryRun: false });
    expect(parseArgs(["--dry-run", "--no-refresh"])).toEqual({ dryRun: true });
  });
});

describe("runDaily · dry-run", () => {
  it("returns a plan-only report with no discover / import", async () => {
    const adapter = new MockKolSyncAdapter({ name: "mock", channels: [] });
    const report = await runDaily({
      adapters: [adapter],
      prisma: null,
      tenantSlug: "demo",
      dryRun: true,
    });
    expect(report.discover).toBeNull();
    expect(report.importStats).toBeNull();
    expect(report.embedStats).toBeNull();
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
      retry: { sleep: async () => {}, backoffsMs: [1, 1, 1] },
    });
    expect(report.discover).toBeNull();
    expect(report.errors).toEqual(["all adapters unhealthy — bailing before discover"]);
    expect(report.health.broken.healthy).toBe(false);
  });
});

describe("runDaily · happy path", () => {
  it("writes discovered rows tagged with the adapter source", async () => {
    const ch1 = fakeChannel({ externalId: "ig_a", platform: "instagram" });
    const ch2 = fakeChannel({ externalId: "tt_b", platform: "tiktok" });
    const adapter = new MockKolSyncAdapter({
      name: "apify-kol",
      channels: [ch1, ch2],
    });

    const upserts: Array<{ externalId: string }> = [];
    const fakePrisma = {
      tenant: {
        findUnique: vi.fn(async () => ({ id: "tenant-1" })),
      },
      kol: {
        findMany: vi.fn(async () => []), // embed-hook touched lookup → empty
        findUnique: vi.fn(async () => null), // every row is fresh insert
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
      $queryRaw: vi.fn(async () => []),
      $queryRawUnsafe: vi.fn(async () => []),
      $executeRaw: vi.fn(async () => 0),
    };

    const report = await runDaily({
      adapters: [adapter],
      prisma: fakePrisma as unknown as Parameters<typeof runDaily>[0]["prisma"],
      tenantSlug: "demo",
      dryRun: false,
      retry: { sleep: async () => {}, backoffsMs: [1, 1, 1] },
    });

    expect(report.health["apify-kol"].healthy).toBe(true);
    expect(report.discover?.totals.discoverCount).toBe(2);
    expect(report.errors).toEqual([]);
    // 2 upserts: one per discovered row, no refresh phase.
    expect(upserts.map((u) => u.externalId).sort()).toEqual(["ig_a", "tt_b"]);
    // healthCheck (1) only — no per-adapter quota inflation since
    // BL-059 deprecate (apify-kol's per-page cost would be tracked in
    // a future iteration; for now the orchestrator just counts
    // healthCheck).
    expect(report.estimatedQuotaConsumed).toBe(1);
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
      channels: [fakeChannel({ externalId: "ig_ok" })],
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

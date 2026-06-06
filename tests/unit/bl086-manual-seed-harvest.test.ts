/**
 * BL-086-F003 · Unit tests for the manual_seed harvest core.
 *
 * Drives `runManualSeedHarvest` against fake loadUcIds / postSeeds / sleep so
 * batching, dry-run, resumability (alreadyFed checkpoint), failed-batch
 * isolation, channel-URL wrapping, and the smoke `--limit` cap are pinned
 * without a live DB or fork (the real POST runs post-charge in F006 staging).
 */
import { describe, expect, it, vi } from "vitest";

import {
  chunk,
  parseArgs,
  runManualSeedHarvest,
  toChannelUrl,
  type HarvestDeps,
} from "../../scripts/bl086-manual-seed-harvest";

function ucIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `UC${String(i).padStart(4, "0")}`);
}

function makeDeps(overrides: Partial<HarvestDeps> & { ids: string[] }): {
  deps: HarvestDeps;
  posted: string[][];
  recorded: Array<{ ucIds: string[]; jobIds: number[] }>;
} {
  const posted: string[][] = [];
  const recorded: Array<{ ucIds: string[]; jobIds: number[] }> = [];
  let job = 1000;
  const deps: HarvestDeps = {
    loadUcIds: async () => overrides.ids,
    postSeeds: async (urls) => {
      posted.push(urls);
      return { jobIds: [(job += 1)] };
    },
    alreadyFed: new Set<string>(),
    recordFed: (ids, jobIds) => recorded.push({ ucIds: ids, jobIds }),
    batchSize: 100,
    sleepMs: 0,
    limit: null,
    dryRun: false,
    sleep: vi.fn(async () => {}),
    logger: () => {},
    ...overrides,
  };
  return { deps, posted, recorded };
}

describe("toChannelUrl", () => {
  it("wraps a bare UC id as a canonical channel URL (not an @handle)", () => {
    expect(toChannelUrl("UC-28fSykPW47BWelcBIs3nw")).toBe(
      "https://www.youtube.com/channel/UC-28fSykPW47BWelcBIs3nw",
    );
  });
});

describe("chunk", () => {
  it("splits into fixed-size batches, last may be short", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("defaults: apply-mode, batch 100, sleep 1500", () => {
    const a = parseArgs([]);
    expect(a.dryRun).toBe(false);
    expect(a.batchSize).toBe(100);
    expect(a.sleepMs).toBe(1500);
    expect(a.limit).toBeNull();
  });
  it("parses flags", () => {
    const a = parseArgs(["--dry-run", "--batch-size=50", "--sleep-ms=200", "--limit=2", "--tenant=t1"]);
    expect(a).toMatchObject({ dryRun: true, batchSize: 50, sleepMs: 200, limit: 2, tenantId: "t1" });
  });
  it("ignores non-positive numeric flags (falls back to default)", () => {
    expect(parseArgs(["--batch-size=0"]).batchSize).toBe(100);
    expect(parseArgs(["--limit=0"]).limit).toBeNull();
  });
});

describe("runManualSeedHarvest", () => {
  it("batches all pending ids and feeds channel URLs", async () => {
    const { deps, posted, recorded } = makeDeps({ ids: ucIds(250), batchSize: 100 });
    const r = await runManualSeedHarvest(deps);
    expect(r.totalUcIds).toBe(250);
    expect(r.pendingCount).toBe(250);
    expect(r.plannedBatches).toBe(3);
    expect(r.fedCount).toBe(250);
    expect(posted).toHaveLength(3);
    expect(posted[0]).toHaveLength(100);
    expect(posted[2]).toHaveLength(50);
    // URLs are channel URLs, never @handle.
    expect(posted[0]![0]).toBe("https://www.youtube.com/channel/UC0000");
    expect(r.jobIds).toHaveLength(3);
    expect(recorded).toHaveLength(3);
  });

  it("dry-run feeds nothing but reports the plan", async () => {
    const { deps, posted, recorded } = makeDeps({ ids: ucIds(150), batchSize: 100, dryRun: true });
    const r = await runManualSeedHarvest(deps);
    expect(r.plannedBatches).toBe(2);
    expect(r.fedCount).toBe(0);
    expect(posted).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });

  it("resumes: alreadyFed ids are skipped", async () => {
    const ids = ucIds(10);
    const { deps, posted } = makeDeps({
      ids,
      batchSize: 4,
      alreadyFed: new Set(ids.slice(0, 6)),
    });
    const r = await runManualSeedHarvest(deps);
    expect(r.alreadyFedCount).toBe(6);
    expect(r.pendingCount).toBe(4);
    expect(r.plannedBatches).toBe(1);
    expect(posted[0]).toHaveLength(4);
    expect(posted[0]![0]).toBe("https://www.youtube.com/channel/UC0006");
  });

  it("--limit caps pending (smoke test)", async () => {
    const { deps, posted } = makeDeps({ ids: ucIds(2535), batchSize: 100, limit: 2 });
    const r = await runManualSeedHarvest(deps);
    expect(r.totalUcIds).toBe(2535);
    expect(r.pendingCount).toBe(2);
    expect(r.fedCount).toBe(2);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toHaveLength(2);
  });

  it("isolates a failed batch: counts it, does not checkpoint, continues", async () => {
    const { deps, recorded, posted } = makeDeps({ ids: ucIds(300), batchSize: 100 });
    let n = 0;
    deps.postSeeds = async (urls) => {
      n += 1;
      posted.push(urls);
      if (n === 2) throw new Error("Insufficient balance");
      return { jobIds: [9000 + n] };
    };
    const r = await runManualSeedHarvest(deps);
    expect(r.plannedBatches).toBe(3);
    expect(r.failedBatches).toBe(1);
    expect(r.fedCount).toBe(200); // batches 1 + 3 succeeded
    // The failed batch (2) is NOT recorded → re-run retries it.
    expect(recorded).toHaveLength(2);
    expect(recorded.flatMap((x) => x.ucIds)).not.toContain("UC0100");
  });

  it("sleeps between batches but not after the last", async () => {
    const sleep = vi.fn(async () => {});
    const { deps } = makeDeps({ ids: ucIds(250), batchSize: 100, sleepMs: 10 });
    deps.sleep = sleep;
    await runManualSeedHarvest(deps);
    expect(sleep).toHaveBeenCalledTimes(2); // 3 batches → 2 inter-batch sleeps
  });
});

/**
 * BL-082-F004 · Unit tests for the tiered refresh selector.
 *
 * BIx-F004-P3 shipped `refresh-selector.ts` but BL-059 left it with 0
 * callers (and no test). BL-082-F003 re-wired it AND changed its output
 * to `<platform>:<platformUserId>` (was `external_id`). These tests pin
 * the tier ordering / cap / cycle math and the new id format.
 */
import { describe, expect, it, vi } from "vitest";

import {
  pickTieredRefreshIds,
  pickBucketSlice,
  fetchTieredRefreshIds,
  DEFAULT_MAX_TOTAL_REFRESH,
} from "../refresh-selector";

const DAY = new Date("2026-06-04T00:00:00.000Z");

describe("DEFAULT_MAX_TOTAL_REFRESH", () => {
  it("is 500 (BL-082-F003 raised from 200)", () => {
    expect(DEFAULT_MAX_TOTAL_REFRESH).toBe(500);
  });
});

describe("pickTieredRefreshIds", () => {
  it("orders flagged first, then tier1/2/3, and dedupes preserving first-seen", () => {
    const out = pickTieredRefreshIds({
      flagged: ["f1", "t1a"], // t1a also in tier1 → dedup
      tier1: ["t1a", "t1b"],
      tier2: ["t2a"],
      tier3: ["t3a"],
      date: DAY,
      maxTotal: 100,
    });
    expect(out[0]).toBe("f1");
    expect(out).toContain("t1a");
    // t1a appears once despite being in flagged + tier1
    expect(out.filter((x) => x === "t1a")).toHaveLength(1);
    // flagged before tier ids
    expect(out.indexOf("f1")).toBeLessThan(out.indexOf("t1b"));
  });

  it("truncates to maxTotal (flagged is pushed first + isn't bucketed)", () => {
    // flagged is unbucketed and pushed first, so it's the deterministic
    // way to assert the cap regardless of the day-of-year bucket math.
    const flagged = Array.from({ length: 5 }, (_, i) => `f${i}`);
    const out = pickTieredRefreshIds({
      flagged,
      tier1: ["a", "b"],
      tier2: ["c"],
      tier3: Array.from({ length: 50 }, (_, i) => `t3_${i}`),
      date: DAY,
      maxTotal: 3,
    });
    expect(out).toEqual(["f0", "f1", "f2"]);
  });

  it("returns [] for an empty pool", () => {
    expect(
      pickTieredRefreshIds({
        flagged: [],
        tier1: [],
        tier2: [],
        tier3: [],
        date: DAY,
        maxTotal: 500,
      }),
    ).toEqual([]);
  });
});

describe("pickBucketSlice", () => {
  it("covers the whole list exactly once across a full cycle", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `k${i}`);
    const seen = new Set<string>();
    for (let day = 0; day < 3; day += 1) {
      for (const id of pickBucketSlice(ids, day, 3)) seen.add(id);
    }
    expect(seen.size).toBe(10);
  });

  it("returns [] for empty input or non-positive cycle", () => {
    expect(pickBucketSlice([], 0, 3)).toEqual([]);
    expect(pickBucketSlice(["a"], 0, 0)).toEqual([]);
  });
});

describe("fetchTieredRefreshIds — <platform>:<platformUserId> output (BL-082-F003)", () => {
  // Fake prisma: top500 query (select has `id`) returns rows; tier3 +
  // flagged queries return []. Mirrors the real shape closely enough to
  // assert the id format + NULL-skip without a testcontainer.
  function fakePrisma(top500Rows: Array<{ id: string; platformUserId: string | null }>) {
    return {
      kol: {
        findMany: vi.fn(async (args: { select?: { id?: boolean } }) =>
          args.select?.id ? top500Rows : [],
        ),
      },
    };
  }

  it("emits every id as `<platform>:<platformUserId>` (12 rows → today's bucket non-empty)", async () => {
    const prisma = fakePrisma(
      Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, platformUserId: `UC${i}` })),
    );
    const ids = await fetchTieredRefreshIds(prisma as never, {
      tenantId: "t",
      platform: "youtube",
      date: DAY,
    });
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toMatch(/^youtube:UC\d+$/);
    }
  });

  it("skips rows with a NULL platformUserId (no malformed / 'null' ids emitted)", async () => {
    const prisma = fakePrisma(
      Array.from({ length: 12 }, (_, i) => ({
        id: `${i}`,
        platformUserId: i % 2 === 0 ? `UC${i}` : null, // half null
      })),
    );
    const ids = await fetchTieredRefreshIds(prisma as never, {
      tenantId: "t",
      platform: "youtube",
      date: DAY,
    });
    for (const id of ids) {
      expect(id).toMatch(/^youtube:UC\d+$/); // never "youtube:" or "youtube:null"
    }
  });
});

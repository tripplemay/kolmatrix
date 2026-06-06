/**
 * BL-086-F002 · Unit tests for the discovery-seed rebalance planner.
 *
 * Pins planSeedChanges against a synthetic schedule set so disable / raise /
 * add / idempotency / warning behaviour is locked without the live fork.
 */
import { describe, expect, it } from "vitest";

import {
  DISABLE_SEEDS,
  NEW_KEYWORDS,
  NEW_PLATFORMS,
  RAISE_LIMIT_SEEDS,
  planSeedChanges,
  type ScheduleView,
} from "../../scripts/bl086-f002-discovery-seeds";

let nextId = 1;
function sched(
  platform: ScheduleView["config"]["platform"],
  searchValue: string,
  opts: { limit?: number; enabled?: boolean } = {},
): ScheduleView {
  return {
    id: nextId++,
    name: `daily-${platform}-${searchValue.replace(/\s+/g, "-")}`,
    cronExpression: "0 2 * * *",
    kind: "hashtag",
    config: { platform, searchValue, limit: opts.limit ?? 100 },
    enabled: opts.enabled ?? true,
  };
}

/** A current set mirroring prod: the dead seeds + the high-output TT seeds. */
function prodLikeSchedules(): ScheduleView[] {
  return [
    ...DISABLE_SEEDS.map((s) => sched(s.platform, s.searchValue, { enabled: true })),
    ...RAISE_LIMIT_SEEDS.map((s) => sched(s.platform, s.searchValue, { limit: 100 })),
    sched("instagram", "gaming"), // a kept seed (not in any target list)
  ];
}

describe("planSeedChanges", () => {
  it("disables all dead seeds, raises all TT seeds, adds all new keyword×platform", () => {
    const plan = planSeedChanges(prodLikeSchedules());
    expect(plan.disable).toHaveLength(DISABLE_SEEDS.length); // 8
    expect(plan.raise).toHaveLength(RAISE_LIMIT_SEEDS.length); // 4
    expect(plan.raise.every((r) => r.to === 300 && r.from === 100)).toBe(true);
    expect(plan.add).toHaveLength(NEW_KEYWORDS.length * NEW_PLATFORMS.length); // 9×2=18
    expect(plan.warnings).toHaveLength(0);
  });

  it("new seed names follow daily-{platform}-{slug} and cover both platforms", () => {
    const plan = planSeedChanges(prodLikeSchedules());
    expect(plan.add).toContainEqual({ name: "daily-tiktok-free-fire", platform: "tiktok", searchValue: "free fire" });
    expect(plan.add).toContainEqual({ name: "daily-youtube-mobile-legends-indonesia", platform: "youtube", searchValue: "mobile legends indonesia" });
    const platforms = new Set(plan.add.map((a) => a.platform));
    expect([...platforms].sort()).toEqual(["tiktok", "youtube"]);
  });

  it("is idempotent: a fully-applied state yields an empty plan", () => {
    const applied: ScheduleView[] = [
      ...DISABLE_SEEDS.map((s) => sched(s.platform, s.searchValue, { enabled: false })),
      ...RAISE_LIMIT_SEEDS.map((s) => sched(s.platform, s.searchValue, { limit: 300 })),
      ...NEW_KEYWORDS.flatMap((kw) => NEW_PLATFORMS.map((p) => sched(p, kw))),
    ];
    const plan = planSeedChanges(applied);
    expect(plan.disable).toHaveLength(0);
    expect(plan.raise).toHaveLength(0);
    expect(plan.add).toHaveLength(0);
    expect(plan.skipped.length).toBeGreaterThan(0);
  });

  it("warns when a disable/raise target is absent (does not crash)", () => {
    const plan = planSeedChanges([sched("instagram", "gaming")]);
    // none of the disable/raise targets present → all become warnings
    expect(plan.warnings.length).toBe(DISABLE_SEEDS.length + RAISE_LIMIT_SEEDS.length);
    expect(plan.disable).toHaveLength(0);
    expect(plan.raise).toHaveLength(0);
    // adds are unaffected (none exist yet)
    expect(plan.add).toHaveLength(NEW_KEYWORDS.length * NEW_PLATFORMS.length);
  });

  it("skips raise when limit already ≥300, still disables/adds", () => {
    const current = [
      ...DISABLE_SEEDS.map((s) => sched(s.platform, s.searchValue, { enabled: true })),
      ...RAISE_LIMIT_SEEDS.map((s) => sched(s.platform, s.searchValue, { limit: 500 })),
    ];
    const plan = planSeedChanges(current);
    expect(plan.raise).toHaveLength(0);
    expect(plan.skipped.some((m) => m.includes("limit already"))).toBe(true);
    expect(plan.disable).toHaveLength(DISABLE_SEEDS.length);
  });
});

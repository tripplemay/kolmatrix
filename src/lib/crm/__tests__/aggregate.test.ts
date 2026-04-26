import { describe, expect, it } from "vitest";

import {
  bucketCommitments14d,
  fillStageDistribution,
  stagesToFunnel,
} from "../aggregate";

describe("fillStageDistribution", () => {
  it("returns all 6 statuses in canonical order with zero buckets filled in", () => {
    const out = fillStageDistribution([
      { status: "long_term", count: 5 },
      { status: "prospect", count: 12 },
    ]);
    expect(out.map((b) => b.status)).toEqual([
      "prospect",
      "first_contact",
      "negotiating",
      "long_term",
      "paused",
      "terminated",
    ]);
    expect(out.find((b) => b.status === "prospect")!.count).toBe(12);
    expect(out.find((b) => b.status === "long_term")!.count).toBe(5);
    expect(out.find((b) => b.status === "first_contact")!.count).toBe(0);
  });

  it("ignores unknown bucket names without crashing", () => {
    const out = fillStageDistribution([
      { status: "ghost", count: 99 },
      { status: "prospect", count: 1 },
    ]);
    expect(out.find((b) => b.status === "prospect")!.count).toBe(1);
    expect(out.length).toBe(6);
  });
});

describe("stagesToFunnel", () => {
  function buckets(p: number, fc: number, n: number, lt: number): ReturnType<typeof fillStageDistribution> {
    return fillStageDistribution([
      { status: "prospect", count: p },
      { status: "first_contact", count: fc },
      { status: "negotiating", count: n },
      { status: "long_term", count: lt },
    ]);
  }

  it("computes the 4-step pipeline + conversion percent", () => {
    // p=100, fc=50, n=20, lt=10  → total=180, contacted=80, negotiated=30, lt=10
    // contacted/total = 80/180 = 44.4%
    // negotiated/contacted = 30/80 = 37.5%
    // lt/negotiated = 10/30 = 33.3%
    const steps = stagesToFunnel(buckets(100, 50, 20, 10));
    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatchObject({
      key: "totalPipeline",
      count: 180,
      conversionPercent: null,
    });
    expect(steps[1]).toMatchObject({ key: "contacted", count: 80 });
    expect(steps[1]!.conversionPercent).toBeCloseTo(44.4, 1);
    expect(steps[2]).toMatchObject({ key: "negotiated", count: 30 });
    expect(steps[2]!.conversionPercent).toBeCloseTo(37.5, 1);
    expect(steps[3]).toMatchObject({ key: "longTerm", count: 10 });
    expect(steps[3]!.conversionPercent).toBeCloseTo(33.3, 1);
  });

  it("returns conversionPercent=null on div-by-zero (no upstream)", () => {
    const steps = stagesToFunnel(buckets(0, 0, 0, 0));
    expect(steps.every((s) => s.count === 0)).toBe(true);
    expect(steps[1]!.conversionPercent).toBeNull();
    expect(steps[2]!.conversionPercent).toBeNull();
    expect(steps[3]!.conversionPercent).toBeNull();
  });

  it("rolls a single long_term KOL all the way through the funnel", () => {
    const steps = stagesToFunnel(buckets(0, 0, 0, 1));
    expect(steps[0]!.count).toBe(1);
    expect(steps[1]!.count).toBe(1);
    expect(steps[2]!.count).toBe(1);
    expect(steps[3]!.count).toBe(1);
    expect(steps[1]!.conversionPercent).toBe(100);
    expect(steps[2]!.conversionPercent).toBe(100);
    expect(steps[3]!.conversionPercent).toBe(100);
  });
});

describe("bucketCommitments14d", () => {
  // Pin a reference timestamp shared across each event constructor and
  // the function call so micro-second clock drift between the test
  // setup and the function body never fall an event onto the wrong side
  // of `start`. Without this, CI run 24959893338 saw `bins[0]` collapse
  // to 0 because the boundary event 13 days + 1 sec ago landed before
  // `start = Date.now() - 13 * DAY_MS` when the function ran.
  const NOW = Date.UTC(2026, 3, 26, 12, 0, 0); // 2026-04-26T12:00:00Z
  const day = 24 * 60 * 60 * 1000;

  it("buckets relationship-changed events into 14 daily slots", () => {
    const events = [
      { createdAt: new Date(NOW - 13 * day + 1000), afterStatus: "long_term" },
      { createdAt: new Date(NOW - 1 * day), afterStatus: "signed" },
      { createdAt: new Date(NOW), afterStatus: "long_term" },
    ];
    const bins = bucketCommitments14d(events, NOW);
    expect(bins.length).toBe(14);
    expect(bins[0]).toBe(1); // 13 days ago
    expect(bins[12]).toBe(1); // yesterday
    expect(bins[13]).toBe(1); // today
  });

  it("ignores events with non-tracked afterStatus", () => {
    const events = [
      { createdAt: new Date(NOW), afterStatus: "first_contact" },
      { createdAt: new Date(NOW), afterStatus: "negotiating" },
    ];
    expect(bucketCommitments14d(events, NOW)).toEqual(new Array(14).fill(0));
  });

  it("ignores events older than 14 days", () => {
    const events = [
      { createdAt: new Date(NOW - 30 * day), afterStatus: "long_term" },
    ];
    expect(bucketCommitments14d(events, NOW).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("honors the injected `now` so test+function agree on the window edge", () => {
    // Regression guard for CI run 24959893338. The pre-fix function
    // recomputed `Date.now()` internally, so a tiny drift between the
    // test snapshot and the function call could push a boundary event
    // below `start` and silently zero out `bins[0]`. With `now` injected,
    // the same anchor flows through both sides; the result is determined
    // entirely by the inputs.
    const t0 = NOW;
    const events = [
      { createdAt: new Date(t0 - 13 * day + 1000), afterStatus: "long_term" },
    ];
    // (a) When function and event share the same anchor, the event lands in bin 0.
    expect(bucketCommitments14d(events, t0)[0]).toBe(1);
    // (b) Shift the anchor 14 days forward — the same event falls out of window.
    expect(bucketCommitments14d(events, t0 + 14 * day).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

/**
 * B6-kol-daily-sync F001 · Dispatcher unit fixtures.
 *
 * Five fixtures cover the dispatcher contract end-to-end without
 * touching the network or the DB:
 *   1. registration: constructor + register + duplicate name rejected.
 *   2. dispatch: runDailySync calls each adapter's discover and
 *      tallies the discovered counts onto totals.
 *   3. health: healthCheckAll surfaces every adapter's status, with
 *      a thrown adapter coerced to { healthy: false }.
 *   4. fail-handling: a non-OK outcome from one adapter does NOT
 *      stop the rest unless failFast is set.
 *   5. multi-adapter dispatch: per-adapter params are wired through;
 *      adapters not in the params map run with their own defaults.
 */
import { describe, expect, it, vi } from "vitest";

import { MockKolSyncAdapter } from "@/lib/kol-sync/adapters/mock";
import { KolSyncDispatcher } from "@/lib/kol-sync/dispatcher";
import type { RawKolData } from "@/lib/kol-sync/types";

function fakeChannel(overrides: Partial<RawKolData>): RawKolData {
  return {
    externalId: "UC_default",
    platform: "youtube",
    handle: "@default",
    displayName: "Default Channel",
    description: "Plays a lot of FPS.",
    country: "US",
    language: "en",
    subscriberCount: 100_000,
    videoCount: 200,
    viewCount: 5_000_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    publishedAt: "2018-01-01T00:00:00Z",
    scrapedAt: "2026-04-28T08:30:00Z",
    ...overrides,
  };
}

describe("KolSyncDispatcher · registration", () => {
  it("registers via constructor and via .register, and exposes them through list/has", () => {
    const a = new MockKolSyncAdapter({ name: "a", channels: [] });
    const b = new MockKolSyncAdapter({ name: "b", channels: [] });
    const d = new KolSyncDispatcher([a]);
    d.register(b);
    expect(d.has("a")).toBe(true);
    expect(d.has("b")).toBe(true);
    expect(d.has("c")).toBe(false);
    expect(d.list().map((x) => x.name).sort()).toEqual(["a", "b"]);
  });

  it("rejects duplicate adapter names so silent shadowing is impossible", () => {
    const a1 = new MockKolSyncAdapter({ name: "a", channels: [] });
    const a2 = new MockKolSyncAdapter({ name: "a", channels: [] });
    const d = new KolSyncDispatcher([a1]);
    expect(() => d.register(a2)).toThrow(/already registered: a/);
  });
});

describe("KolSyncDispatcher · runDailySync", () => {
  it("calls every adapter's discover and aggregates the result onto totals", async () => {
    const a = new MockKolSyncAdapter({
      name: "a",
      channels: [fakeChannel({ externalId: "UC_a1" }), fakeChannel({ externalId: "UC_a2" })],
    });
    const b = new MockKolSyncAdapter({
      name: "b",
      channels: [fakeChannel({ externalId: "UC_b1" })],
    });
    const d = new KolSyncDispatcher([a, b]);

    const report = await d.runDailySync();

    expect(report.totals).toEqual({ discoverCount: 3, failedAdapters: 0 });
    expect(report.outcomes).toHaveLength(2);
    expect(report.outcomes.every((o) => o.ok)).toBe(true);
    expect(report.startedAt).toEqual(expect.any(String));
    expect(report.endedAt).toEqual(expect.any(String));
  });
});

describe("KolSyncDispatcher · healthCheckAll", () => {
  it("returns one entry per adapter and coerces thrown adapters to { healthy: false }", async () => {
    const ok = new MockKolSyncAdapter({ name: "ok", channels: [] });
    const broken = new MockKolSyncAdapter({
      name: "broken",
      channels: [],
      fail: new Error("API key invalid"),
    });
    const d = new KolSyncDispatcher([ok, broken]);

    const report = await d.healthCheckAll();

    expect(report.ok).toEqual({ healthy: true, details: { channels: 0 } });
    expect(report.broken.healthy).toBe(false);
    expect(report.broken.details).toMatchObject({ error: "API key invalid" });
  });
});

describe("KolSyncDispatcher · failure handling", () => {
  it("a failing adapter is reported as not OK but the rest still run", async () => {
    const ok = new MockKolSyncAdapter({
      name: "ok",
      channels: [fakeChannel({ externalId: "UC_ok" })],
    });
    const dead = new MockKolSyncAdapter({
      name: "dead",
      channels: [],
      fail: new Error("upstream 500"),
    });
    const d = new KolSyncDispatcher([dead, ok]);

    const report = await d.runDailySync();

    expect(report.totals).toEqual({ discoverCount: 1, failedAdapters: 1 });
    expect(report.outcomes).toHaveLength(2);
    const deadOutcome = report.outcomes.find((o) => o.adapter === "dead");
    expect(deadOutcome).toMatchObject({ ok: false, error: "upstream 500" });
    const okOutcome = report.outcomes.find((o) => o.adapter === "ok");
    expect(okOutcome).toMatchObject({ ok: true });
  });

  it("failFast stops the dispatch on the first thrown adapter", async () => {
    const dead = new MockKolSyncAdapter({
      name: "dead",
      channels: [],
      fail: new Error("upstream 500"),
    });
    const ok = new MockKolSyncAdapter({
      name: "ok",
      channels: [fakeChannel({ externalId: "UC_never_runs" })],
    });
    const okSpy = vi.spyOn(ok, "discover");
    const d = new KolSyncDispatcher([dead, ok]);

    const report = await d.runDailySync({ failFast: true });

    expect(okSpy).not.toHaveBeenCalled();
    expect(report.outcomes).toHaveLength(1);
    expect(report.outcomes[0]!.ok).toBe(false);
  });
});

describe("KolSyncDispatcher · per-adapter params", () => {
  it("wires perAdapterParams through to each adapter and skips adapters with empty refresh ids", async () => {
    const yt = new MockKolSyncAdapter({
      name: "youtube",
      channels: [
        fakeChannel({ externalId: "UC_us", country: "US", subscriberCount: 50_000 }),
        fakeChannel({ externalId: "UC_jp", country: "JP", subscriberCount: 200_000 }),
      ],
    });
    const ytSpy = vi.spyOn(yt, "discover");
    const tt = new MockKolSyncAdapter({
      name: "tiktok",
      channels: [fakeChannel({ externalId: "UC_tt", country: "US" })],
    });
    const ttSpy = vi.spyOn(tt, "discover");

    const d = new KolSyncDispatcher([yt, tt]);
    const report = await d.runDailySync({
      perAdapterParams: {
        youtube: { region: "JP", minSubscribers: 100_000 },
        // tiktok intentionally absent — should still run with {}.
      },
    });

    expect(ytSpy).toHaveBeenCalledWith({ region: "JP", minSubscribers: 100_000 });
    expect(ttSpy).toHaveBeenCalledWith({});
    // YouTube filter narrows to UC_jp only; TikTok returns its single channel.
    expect(report.totals.discoverCount).toBe(2);
    const ytOutcome = report.outcomes.find((o) => o.adapter === "youtube");
    expect(ytOutcome).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ externalId: "UC_jp" })],
    });
  });

  it("runRefresh skips adapters whose perAdapterIds is missing or empty", async () => {
    const yt = new MockKolSyncAdapter({
      name: "youtube",
      channels: [
        fakeChannel({ externalId: "UC_a" }),
        fakeChannel({ externalId: "UC_b" }),
      ],
    });
    const tt = new MockKolSyncAdapter({
      name: "tiktok",
      channels: [fakeChannel({ externalId: "UC_tt" })],
    });
    const ttSpy = vi.spyOn(tt, "refresh");
    const d = new KolSyncDispatcher([yt, tt]);

    const report = await d.runRefresh({
      perAdapterIds: { youtube: ["UC_a"] /* tiktok absent */ },
    });

    expect(ttSpy).not.toHaveBeenCalled();
    expect(report.outcomes).toHaveLength(1);
    expect(report.totals).toEqual({ refreshCount: 1, failedAdapters: 0 });
  });
});

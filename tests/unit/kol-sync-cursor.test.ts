/**
 * BIx-mvp-polish-pass F004-P2 unit tests · pickDailyPage rotation
 * + in-memory cursor provider behaviour.
 *
 * The Prisma-backed provider is exercised by the integration suite
 * (sync-quota-optimization, F004-P5) — here we cover the pure
 * helpers + the in-memory stub other unit tests rely on.
 */
import { describe, expect, it } from "vitest";

import {
  inMemoryKolSyncCursorProvider,
  pickDailyPage,
} from "@/lib/kol-sync/cursor";

describe("pickDailyPage (BIx-F004-P2 6-day cycle)", () => {
  // dayOfYear computed via UTC; all asserts use UTC dates so they're
  // timezone-independent. Cycle is mod 6 → 0,1,2 → page 1; 3,4 →
  // page 2; 5 → page 3.
  it("returns page 1 on cycle days 0–2", () => {
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 1)))).toBe(1);
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 2)))).toBe(1);
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 3)))).toBe(1);
  });

  it("returns page 2 on cycle days 3–4", () => {
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 4)))).toBe(2);
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 5)))).toBe(2);
  });

  it("returns page 3 on cycle day 5", () => {
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 6)))).toBe(3);
  });

  it("wraps to page 1 again at day 7 (next cycle)", () => {
    expect(pickDailyPage(new Date(Date.UTC(2026, 0, 7)))).toBe(1);
  });
});

describe("inMemoryKolSyncCursorProvider", () => {
  it("returns the default {page:1, nextPageToken:null} for fresh keys", async () => {
    const provider = inMemoryKolSyncCursorProvider();
    expect(await provider.get("US", "gaming")).toEqual({
      page: 1,
      nextPageToken: null,
    });
  });

  it("upserts: set then get round-trips the row", async () => {
    const provider = inMemoryKolSyncCursorProvider();
    await provider.set("JP", "Vtuber", 2, "tok-xyz");
    expect(await provider.get("JP", "Vtuber")).toEqual({
      page: 2,
      nextPageToken: "tok-xyz",
    });
  });

  it("snapshot exposes the underlying map for assertion", async () => {
    const provider = inMemoryKolSyncCursorProvider();
    await provider.set("CN", "游戏直播", 3, "tok-cn");
    const snap = provider.snapshot();
    expect(snap.size).toBe(1);
    expect(snap.get("CN::游戏直播")).toEqual({
      page: 3,
      nextPageToken: "tok-cn",
    });
  });

  it("seed map is honoured at construction", async () => {
    const seed = new Map([["KR::esports", { page: 2, nextPageToken: "k" }]]);
    const provider = inMemoryKolSyncCursorProvider(seed);
    expect(await provider.get("KR", "esports")).toEqual({
      page: 2,
      nextPageToken: "k",
    });
  });
});

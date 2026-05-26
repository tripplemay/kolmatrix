/**
 * BL-076-F003 · per-row try/catch + audit_log unit tests.
 *
 * The 5/12-5/26 prod outage (14 consecutive daily-sync runs with
 * inserted=0) was caused by a single engagement_rate row tripping
 * "numeric field overflow" inside `prisma.kol.upsert(...)`, which
 * propagated up through the `for` loop and aborted the entire batch.
 * F003 wraps the upsert in a try/catch that bumps `stats.failed`,
 * writes an `audit_log.kol.import_failed` entry, and lets the loop
 * keep walking remaining rows. The audit insert is itself wrapped so
 * a degenerate DB state can't escalate one bad row into a dispatcher
 * crash.
 *
 * Three cases pin the contract:
 *   (a) upsert throws → stats.failed=1, audit_log written exactly once
 *   (b) upsert succeeds → stats.failed=0, audit_log NOT touched
 *   (c) upsert AND audit_log both throw → swallowed, no rethrow
 */
import { describe, expect, it, vi } from "vitest";

import { importRawKolData } from "@/lib/kol-sync/import";
import type { RawKolData } from "@/lib/kol-sync/types";

const NOW = new Date("2026-05-27T00:00:00.000Z");
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function fakeRaw(overrides: Partial<RawKolData> = {}): RawKolData {
  return {
    externalId: "apify_default",
    platform: "instagram",
    handle: "@default",
    displayName: "Default Creator",
    description: "Plays competitive FPS daily.",
    country: "US",
    language: "en",
    subscriberCount: 200_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    engagement_rate: 5.5,
    engagement_outlier: false,
    scrapedAt: NOW.toISOString(),
    ...overrides,
  };
}

interface MockHandlers {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  auditCreate: ReturnType<typeof vi.fn>;
}

function makePrismaMock(handlers: Partial<MockHandlers> = {}) {
  const findUnique =
    handlers.findUnique ?? vi.fn().mockResolvedValue(null);
  const upsert = handlers.upsert ?? vi.fn().mockResolvedValue({});
  const auditCreate = handlers.auditCreate ?? vi.fn().mockResolvedValue({});
  // Cast to never to satisfy PrismaClient's structural type at the
  // boundary without dragging in the full mock surface.
  const mock = {
    kol: { findUnique, upsert },
    auditLog: { create: auditCreate },
  } as unknown as Parameters<typeof importRawKolData>[0];
  return { prisma: mock, findUnique, upsert, auditCreate };
}

describe("BL-076-F003 importRawKolData per-row try/catch", () => {
  it("(a) upsert throws → stats.failed=1, single audit_log row, loop survives", async () => {
    const { prisma, upsert, auditCreate } = makePrismaMock({
      upsert: vi
        .fn()
        // First row throws (mimics 5/12-5/26 numeric overflow).
        .mockRejectedValueOnce(new Error("numeric field overflow"))
        // Second row succeeds — proves the loop didn't abort.
        .mockResolvedValueOnce({}),
    });

    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const stats = await importRawKolData(
        prisma,
        [
          fakeRaw({ externalId: "apify_bad", displayName: "Overflow Row" }),
          fakeRaw({ externalId: "apify_good", displayName: "Healthy Row" }),
        ],
        {
          tenantId: TENANT_ID,
          source: "apify-kol",
          isDemo: false,
          now: () => NOW,
        },
      );

      expect(stats.failed).toBe(1);
      expect(stats.inserted).toBe(1);
      expect(stats.total).toBe(2);
      expect(upsert).toHaveBeenCalledTimes(2);
      expect(auditCreate).toHaveBeenCalledTimes(1);

      const auditArg = auditCreate.mock.calls[0]?.[0];
      expect(auditArg).toMatchObject({
        data: {
          tenantId: TENANT_ID,
          action: "kol.import_failed",
          resourceType: "kol",
          resourceId: null,
        },
      });
      const payload = auditArg?.data?.payload as Record<string, unknown>;
      expect(payload.platform).toBe("instagram");
      expect(payload.externalId).toBe("apify_bad");
      expect(payload.displayName).toBe("Overflow Row");
      expect(typeof payload.error).toBe("string");
      expect(String(payload.error)).toContain("numeric field overflow");
    } finally {
      consoleErr.mockRestore();
    }
  });

  it("(b) upsert succeeds → stats.failed=0, audit_log NOT written", async () => {
    const { prisma, upsert, auditCreate } = makePrismaMock();

    const stats = await importRawKolData(prisma, [fakeRaw()], {
      tenantId: TENANT_ID,
      source: "apify-kol",
      isDemo: false,
      now: () => NOW,
    });

    expect(stats.failed).toBe(0);
    expect(stats.inserted).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("(c) upsert AND audit_log both throw → swallowed, no rethrow, stats.failed=1", async () => {
    const { prisma, auditCreate } = makePrismaMock({
      upsert: vi.fn().mockRejectedValue(new Error("numeric field overflow")),
      auditCreate: vi
        .fn()
        .mockRejectedValue(new Error("audit_log disk full simulation")),
    });

    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // The whole call must not throw — the recursive-failure guard is
      // what protects the dispatcher from collapsing on a degenerate DB.
      const stats = await importRawKolData(prisma, [fakeRaw()], {
        tenantId: TENANT_ID,
        source: "apify-kol",
        isDemo: false,
        now: () => NOW,
      });

      expect(stats.failed).toBe(1);
      expect(stats.inserted).toBe(0);
      expect(auditCreate).toHaveBeenCalledTimes(1);
      // console.error fires at least twice — once for the upsert,
      // once for the audit_log fallback.
      expect(consoleErr.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      consoleErr.mockRestore();
    }
  });
});

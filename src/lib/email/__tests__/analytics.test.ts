/**
 * BL-110-F004 · reply-tracking honest-empty signal.
 *
 * Reply tracking isn't wired (inbound email = B4, deferred); nothing
 * writes email_log.repliedAt. The honest-empty surfaces must key off
 * ALL-TIME reply existence (isReplyTrackingPending), NOT a windowed
 * proxy — otherwise a tenant whose replies predate the 30-day KPI window
 * (or the 14-day dashboard chart) gets a false "待上线(B4)" label while
 * other surfaces show real reply data (fix-round-1 staging blocker).
 */
import { describe, expect, it, vi } from "vitest";

const withTenantMock = vi.fn();
vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, cb: (tx: unknown) => unknown) => withTenantMock(cb),
}));

import { isReplyTrackingPending, runEmailQuickStats } from "../analytics";

interface Row {
  sentAt: Date | null;
  openedAt: Date | null;
  repliedAt: Date | null;
  status: string;
}

// count() is called for both sentToday (where.sentAt) and the all-time
// reply existence check (where.repliedAt); differentiate by the where.
function mockTx(opts: { rows?: Row[]; sentToday?: number; repliedAllTime?: number } = {}) {
  const { rows = [], sentToday = 0, repliedAllTime = 0 } = opts;
  return {
    emailLog: {
      count: vi.fn().mockImplementation((args?: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {};
        if ("repliedAt" in where) return Promise.resolve(repliedAllTime);
        return Promise.resolve(sentToday);
      }),
      findMany: vi.fn().mockResolvedValue(rows),
    },
  };
}

function runStatsWith(opts: { rows?: Row[]; sentToday?: number; repliedAllTime?: number }) {
  const tx = mockTx(opts);
  withTenantMock.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));
  return runEmailQuickStats("tenant-1");
}

const now = new Date();

describe("isReplyTrackingPending (BL-110-F004 fix-round 1)", () => {
  it("is true when the tenant has zero repliedAt rows", async () => {
    const tx = {
      emailLog: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as Parameters<typeof isReplyTrackingPending>[0];
    expect(await isReplyTrackingPending(tx)).toBe(true);
  });

  it("is false the moment any repliedAt row exists", async () => {
    const tx = {
      emailLog: { count: vi.fn().mockResolvedValue(56) },
    } as unknown as Parameters<typeof isReplyTrackingPending>[0];
    expect(await isReplyTrackingPending(tx)).toBe(false);
  });

  it("queries on repliedAt NOT NULL (all-time, not a window)", async () => {
    const count = vi.fn().mockResolvedValue(0);
    const tx = { emailLog: { count } } as unknown as Parameters<
      typeof isReplyTrackingPending
    >[0];
    await isReplyTrackingPending(tx);
    expect(count).toHaveBeenCalledWith({ where: { repliedAt: { not: null } } });
  });
});

describe("runEmailQuickStats — replyTrackingPending (BL-110-F004)", () => {
  it("is true when no reply data exists anywhere (prod / no inbound)", async () => {
    const stats = await runStatsWith({
      rows: [{ sentAt: now, openedAt: now, repliedAt: null, status: "opened" }],
      repliedAllTime: 0,
    });
    expect(stats.replyTrackingPending).toBe(true);
  });

  // fix-round-1 regression: the 30-day window has zero replies, but the
  // tenant DOES have historical reply data → must NOT be flagged pending.
  it("is false when historical replies exist even if the 30-day window has none", async () => {
    const stats = await runStatsWith({
      rows: [
        { sentAt: now, openedAt: now, repliedAt: null, status: "opened" },
        { sentAt: now, openedAt: null, repliedAt: null, status: "sent" },
      ],
      repliedAllTime: 56,
    });
    expect(stats.replyTrackingPending).toBe(false);
  });

  it("does not affect the other rate fields (additive flag only)", async () => {
    const stats = await runStatsWith({
      rows: [
        { sentAt: now, openedAt: now, repliedAt: null, status: "opened" },
        { sentAt: now, openedAt: null, repliedAt: null, status: "sent" },
      ],
      repliedAllTime: 0,
    });
    expect(stats.openRatePercent).toBe(50);
    expect(stats.replyRatePercent).toBe(0);
  });
});

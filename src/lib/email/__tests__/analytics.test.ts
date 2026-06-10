/**
 * BL-110-F004 · runEmailQuickStats.replyTrackingPending unit spec.
 *
 * Reply tracking isn't wired (inbound email = B4, deferred); nothing
 * writes email_log.repliedAt. The flag must be true whenever the window
 * has zero replied rows (prod) so the KPI strip can render an honest "—"
 * instead of a fabricated 0.0%, and flip to false once any reply data
 * exists (dev seed / post-B4).
 */
import { describe, expect, it, vi } from "vitest";

const withTenantMock = vi.fn();
vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, cb: (tx: unknown) => unknown) => withTenantMock(cb),
}));

import { runEmailQuickStats } from "../analytics";

interface Row {
  sentAt: Date | null;
  openedAt: Date | null;
  repliedAt: Date | null;
  status: string;
}

function mockTx(rows: Row[], sentToday = 0) {
  return {
    emailLog: {
      count: vi.fn().mockResolvedValue(sentToday),
      findMany: vi.fn().mockResolvedValue(rows),
    },
  };
}

function runWith(rows: Row[]) {
  const tx = mockTx(rows);
  withTenantMock.mockImplementationOnce((cb: (tx: unknown) => unknown) => cb(tx));
  return runEmailQuickStats("tenant-1");
}

const now = new Date();

describe("runEmailQuickStats — replyTrackingPending (BL-110-F004)", () => {
  it("is true when no email_log row has repliedAt (prod / no inbound)", async () => {
    const stats = await runWith([
      { sentAt: now, openedAt: now, repliedAt: null, status: "opened" },
      { sentAt: now, openedAt: null, repliedAt: null, status: "sent" },
    ]);
    expect(stats.replyTrackingPending).toBe(true);
  });

  it("is false once at least one reply exists (dev seed / post-B4)", async () => {
    const stats = await runWith([
      { sentAt: now, openedAt: now, repliedAt: now, status: "opened" },
      { sentAt: now, openedAt: null, repliedAt: null, status: "sent" },
    ]);
    expect(stats.replyTrackingPending).toBe(false);
  });

  it("is true on an empty window too (no sends, no replies)", async () => {
    const stats = await runWith([]);
    expect(stats.replyTrackingPending).toBe(true);
  });

  it("does not affect the other rate fields (additive flag only)", async () => {
    const stats = await runWith([
      { sentAt: now, openedAt: now, repliedAt: null, status: "opened" },
      { sentAt: now, openedAt: null, repliedAt: null, status: "sent" },
    ]);
    // sent=2, opened=1 → openRate 50%; replied=0 → replyRate computes to 0
    // (the honest "—" is applied at the UI layer via the pending flag).
    expect(stats.openRatePercent).toBe(50);
    expect(stats.replyRatePercent).toBe(0);
  });
});

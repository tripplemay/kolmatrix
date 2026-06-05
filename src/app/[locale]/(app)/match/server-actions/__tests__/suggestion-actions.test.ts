import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptKolToCampaign,
  skipKolFromCampaign,
  swapKolToSwapPool,
  reAddToSuggested,
  undoLastDecision,
} from "../suggestion-actions";

// BL-084-F005: accept/skip/swap/reAdd/undo. DB + cache mocked.

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const kcUpsert = vi.fn();
const kcDeleteMany = vi.fn();
const auditCreate = vi.fn();
const auditFindFirst = vi.fn();
const fakeTx = {
  kolCampaign: {
    upsert: (...a: unknown[]) => kcUpsert(...a),
    deleteMany: (...a: unknown[]) => kcDeleteMany(...a),
  },
  auditLog: {
    create: (...a: unknown[]) => auditCreate(...a),
    findFirst: (...a: unknown[]) => auditFindFirst(...a),
  },
};
vi.mock("@/lib/db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
}));

const invalidateMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/match/suggestions-cache", () => ({
  invalidateCampaignSuggestionsCache: (...a: unknown[]) => invalidateMock(...a),
}));

const KOL = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CAMP = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { tenantId: "t1", id: "u1" } });
  kcUpsert.mockResolvedValue({ id: "kc-1" });
  auditCreate.mockResolvedValue({ id: BigInt(777) });
});

describe("decision actions (BL-084-F005)", () => {
  it("acceptKolToCampaign upserts accepted + audit + invalidates cache", async () => {
    const res = await acceptKolToCampaign(KOL, CAMP);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.decisionId).toBe("777");
    expect(typeof res.undoExpiresAt).toBe("string");

    const upsertArg = kcUpsert.mock.calls[0]![0] as {
      create: { suggestionStatus: string; source: string };
    };
    expect(upsertArg.create.suggestionStatus).toBe("accepted");
    expect(upsertArg.create.source).toBe("ai_smart_match");

    const auditArg = auditCreate.mock.calls[0]![0] as {
      data: { action: string; payload: { action: string } };
    };
    expect(auditArg.data.action).toBe("kol.campaign_suggestion_decided");
    expect(auditArg.data.payload.action).toBe("accepted");
    expect(invalidateMock).toHaveBeenCalledWith("t1", CAMP);
  });

  it("skipKolFromCampaign writes skipped status", async () => {
    const res = await skipKolFromCampaign(KOL, CAMP);
    expect(res.ok).toBe(true);
    const upsertArg = kcUpsert.mock.calls[0]![0] as {
      create: { suggestionStatus: string };
      update: Record<string, unknown>;
    };
    expect(upsertArg.create.suggestionStatus).toBe("skipped");
    // skip does NOT rewrite source on update.
    expect(upsertArg.update).not.toHaveProperty("source");
    expect(invalidateMock).toHaveBeenCalledWith("t1", CAMP);
  });

  it("swapKolToSwapPool writes swap_pool status", async () => {
    const res = await swapKolToSwapPool(KOL, CAMP);
    expect(res.ok).toBe(true);
    const upsertArg = kcUpsert.mock.calls[0]![0] as {
      create: { suggestionStatus: string };
    };
    expect(upsertArg.create.suggestionStatus).toBe("swap_pool");
  });

  it("rejects invalid UUIDs", async () => {
    const res = await acceptKolToCampaign("not-a-uuid", CAMP);
    expect(res).toEqual({ ok: false, error: "validation_failed" });
    expect(kcUpsert).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await swapKolToSwapPool(KOL, CAMP);
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("reAddToSuggested (BL-084-F005)", () => {
  it("deletes swap_pool row + audit + invalidate", async () => {
    kcDeleteMany.mockResolvedValue({ count: 1 });
    const res = await reAddToSuggested(KOL, CAMP);
    expect(res).toEqual({ ok: true });
    const delArg = kcDeleteMany.mock.calls[0]![0] as {
      where: { suggestionStatus: string };
    };
    expect(delArg.where.suggestionStatus).toBe("swap_pool");
    expect(invalidateMock).toHaveBeenCalledWith("t1", CAMP);
  });

  it("returns not_found when no swap_pool row", async () => {
    kcDeleteMany.mockResolvedValue({ count: 0 });
    const res = await reAddToSuggested(KOL, CAMP);
    expect(res).toEqual({ ok: false, error: "not_found" });
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

describe("undoLastDecision (BL-084-F005)", () => {
  it("undoes a fresh decision (deletes row + undone audit)", async () => {
    auditFindFirst.mockResolvedValue({
      id: BigInt(777),
      createdAt: new Date(Date.now() - 1000), // 1s ago, within window
      payload: { kolId: KOL, campaignId: CAMP },
      resourceId: "kc-1",
    });
    kcDeleteMany.mockResolvedValue({ count: 1 });

    const res = await undoLastDecision("777");
    expect(res).toEqual({ ok: true, kolId: KOL, campaignId: CAMP });
    const undoAudit = auditCreate.mock.calls[0]![0] as {
      data: { action: string };
    };
    expect(undoAudit.data.action).toBe("kol.campaign_suggestion_undone");
    expect(invalidateMock).toHaveBeenCalledWith("t1", CAMP);
  });

  it("rejects when past the 5s window → undo_expired", async () => {
    auditFindFirst.mockResolvedValue({
      id: BigInt(777),
      createdAt: new Date(Date.now() - 6000), // 6s ago
      payload: { kolId: KOL, campaignId: CAMP },
      resourceId: "kc-1",
    });
    const res = await undoLastDecision("777");
    expect(res).toEqual({ ok: false, error: "undo_expired" });
    expect(kcDeleteMany).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown decisionId", async () => {
    auditFindFirst.mockResolvedValue(null);
    const res = await undoLastDecision("999");
    expect(res).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects a non-numeric decisionId", async () => {
    const res = await undoLastDecision("abc");
    expect(res).toEqual({ ok: false, error: "validation_failed" });
  });
});

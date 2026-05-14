/**
 * BL-066-F004 — acceptKolToCampaignAction + skipKolAction unit tests.
 *
 * Mocks @/auth + @/lib/db.withTenant + @/lib/rate-limit-batch +
 * @/lib/audit/log + next/cache so we exercise validation, idempotency,
 * rate-limit, and audit-shape paths without a real DB.
 *
 * 6 cases cover features.json F004 acceptance §"单测 ≥5 case":
 *   (a) unauthorized
 *   (b) campaignId not in tenant
 *   (c) kolId not found
 *   (d) duplicate accept 静默 noop
 *   (e) success + audit log shape
 *   (+) rate limit bonus path
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const campaignFindUnique = vi.fn();
const kolFindUnique = vi.fn();
const kolCampaignFindUnique = vi.fn();
const kolCampaignCreate = vi.fn();

const withTenantMock = vi.fn(
  async (_tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      campaign: { findUnique: campaignFindUnique },
      kol: { findUnique: kolFindUnique },
      kolCampaign: {
        findUnique: kolCampaignFindUnique,
        create: kolCampaignCreate,
      },
    })
);
vi.mock("@/lib/db", () => ({
  withTenant: (...args: unknown[]) =>
    withTenantMock(
      args[0] as string,
      args[1] as (tx: unknown) => Promise<unknown>
    ),
}));

const rateLimitBatchMock = vi
  .fn<
    () => Promise<
      { ok: true; remaining: number } | { ok: false; retryAfter: number }
    >
  >()
  .mockResolvedValue({ ok: true, remaining: 19 });
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: () => rateLimitBatchMock(),
}));

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { acceptKolToCampaignAction, skipKolAction } = await import(
  "../recommend-actions"
);

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CAMPAIGN = "ddddeeee-aaaa-bbbb-cccc-111122223333";
const KOL = "ffffeeee-1111-2222-3333-444455556666";

beforeEach(() => {
  authMock
    .mockReset()
    .mockResolvedValue({ user: { tenantId: TENANT, id: USER } });
  campaignFindUnique.mockReset();
  kolFindUnique.mockReset();
  kolCampaignFindUnique.mockReset();
  kolCampaignCreate.mockReset();
  rateLimitBatchMock
    .mockReset()
    .mockResolvedValue({ ok: true, remaining: 19 });
  logAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("acceptKolToCampaignAction (BL-066 F004)", () => {
  it("(a) returns unauthorized when there is no session", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await acceptKolToCampaignAction({
      campaignId: CAMPAIGN,
      kolId: KOL,
      matchScore: 88,
    });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(kolCampaignCreate).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("(b) returns campaign_not_found when the campaignId is outside tenant", async () => {
    campaignFindUnique.mockResolvedValueOnce(null);
    const res = await acceptKolToCampaignAction({
      campaignId: CAMPAIGN,
      kolId: KOL,
    });
    expect(res).toEqual({ ok: false, error: "campaign_not_found" });
    expect(kolCampaignCreate).not.toHaveBeenCalled();
  });

  it("(c) returns kol_not_found when the kolId is missing", async () => {
    campaignFindUnique.mockResolvedValueOnce({ id: CAMPAIGN });
    kolFindUnique.mockResolvedValueOnce(null);
    const res = await acceptKolToCampaignAction({
      campaignId: CAMPAIGN,
      kolId: KOL,
    });
    expect(res).toEqual({ ok: false, error: "kol_not_found" });
    expect(kolCampaignCreate).not.toHaveBeenCalled();
  });

  it("(d) silently dedupes when a kol_campaign row already exists (audit untouched)", async () => {
    campaignFindUnique.mockResolvedValueOnce({ id: CAMPAIGN });
    kolFindUnique.mockResolvedValueOnce({ id: KOL });
    kolCampaignFindUnique.mockResolvedValueOnce({ id: "existing-link-id" });
    const res = await acceptKolToCampaignAction({
      campaignId: CAMPAIGN,
      kolId: KOL,
      matchScore: 88,
    });
    expect(res).toEqual({
      ok: true,
      kolCampaignId: "existing-link-id",
      deduped: true,
    });
    expect(kolCampaignCreate).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("(e) creates a kol_campaign row + audit_log on success (source + matchScore in payload)", async () => {
    campaignFindUnique.mockResolvedValueOnce({ id: CAMPAIGN });
    kolFindUnique.mockResolvedValueOnce({ id: KOL });
    kolCampaignFindUnique.mockResolvedValueOnce(null);
    kolCampaignCreate.mockResolvedValueOnce({ id: "new-link-id" });
    const res = await acceptKolToCampaignAction({
      campaignId: CAMPAIGN,
      kolId: KOL,
      matchScore: 88,
    });
    expect(res).toEqual({ ok: true, kolCampaignId: "new-link-id" });

    expect(kolCampaignCreate).toHaveBeenCalledTimes(1);
    const createArgs = kolCampaignCreate.mock.calls[0][0];
    expect(createArgs.data.tenantId).toBe(TENANT);
    expect(createArgs.data.campaignId).toBe(CAMPAIGN);
    expect(createArgs.data.kolId).toBe(KOL);
    expect(createArgs.data.status).toBe("pending");
    expect(createArgs.data.source).toBe("ai_smart_match");
    expect(createArgs.data.matchScore).toBe(88);

    expect(logAuditMock).toHaveBeenCalledTimes(1);
    const auditArgs = logAuditMock.mock.calls[0][0];
    expect(auditArgs.action).toBe("campaign.kol_accepted_via_ai");
    expect(auditArgs.targetType).toBe("kol_campaign");
    expect(auditArgs.targetId).toBe("new-link-id");
    expect(auditArgs.tenantId).toBe(TENANT);
    expect(auditArgs.actorId).toBe(USER);
    expect(auditArgs.after).toEqual({
      campaignId: CAMPAIGN,
      kolId: KOL,
      source: "ai_smart_match",
      matchScore: 88,
    });
  });

  it("(+) returns rate_limit_exceeded and skips DB write when the batch limiter rejects", async () => {
    rateLimitBatchMock.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const res = await acceptKolToCampaignAction({
      campaignId: CAMPAIGN,
      kolId: KOL,
    });
    expect(res).toEqual({
      ok: false,
      error: "rate_limit_exceeded",
      retryAfter: 30,
    });
    expect(campaignFindUnique).not.toHaveBeenCalled();
    expect(kolCampaignCreate).not.toHaveBeenCalled();
  });
});

describe("skipKolAction (BL-066 F004 framework slot)", () => {
  it("returns ok without writing anything (BL-067 C3 will fill in)", async () => {
    const res = await skipKolAction({ campaignId: CAMPAIGN, kolId: KOL });
    expect(res).toEqual({ ok: true, kolCampaignId: "" });
    expect(kolCampaignCreate).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("returns unauthorized for anonymous callers", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await skipKolAction({ campaignId: CAMPAIGN, kolId: KOL });
    expect(res).toEqual({ ok: false, error: "unauthorized" });
  });
});

/**
 * BL-100-F002 (ADR-020 D3/D4) — batchId association + retry idempotency.
 *
 * Asserts batchSendOutreach:
 *   - persists the batchId on every email_log row
 *   - given a batchId, checks email_log for an already-sent (batchId,kolId)
 *     row BEFORE sending, and skips the resend when one exists (job retry
 *     safety) — counting it as sent without calling the provider / create
 *   - only treats sent/mock_sent as "already sent" (a prior failed row is
 *     re-attempted)
 *
 * DB / provider / sinks are mocked at the module boundary so the spec
 * stays a unit test and never touches real Redis or Resend.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const emailLogCreate = vi.fn(async () => ({ id: "log-new" }));
const emailLogFindFirst = vi.fn();
const assetFindUnique = vi.fn(async () => null);
const kolCampaignFindUnique = vi.fn(async () => null);
const mockTx = {
  asset: { findUnique: assetFindUnique },
  emailLog: { create: emailLogCreate, findFirst: emailLogFindFirst },
  kolCampaign: { findUnique: kolCampaignFindUnique, update: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) => fn(mockTx),
}));
const sendEmailMock = vi.fn(async () => ({ providerMessageId: "pm_1", mocked: false }));
vi.mock("@/lib/email/resend", () => ({
  FROM_ADDRESS: "marketer@kolquest.com",
  SendEmailError: class extends Error {
    code = "send_error";
  },
  sendEmail: (...args: unknown[]) => sendEmailMock(...(args as [])),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events/log", () => ({ logEvent: vi.fn() }));

const { batchSendOutreach } = await import("../batch-send");

const BATCH_ID = "bbbbbbbb-1111-2222-3333-444444444444";
const KOL_ID = "kkkkkkkk-1111-1111-1111-111111111111";

function item(overrides: Record<string, unknown> = {}) {
  return {
    kolCampaignId: "",
    kolId: KOL_ID,
    toAddress: "kol@example.com",
    subject: "Subject",
    bodyText: "Body",
    templateId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  emailLogFindFirst.mockResolvedValue(null);
  kolCampaignFindUnique.mockResolvedValue(null);
});

describe("BL-100-F002 batchSendOutreach batchId + idempotency", () => {
  it("persists batchId on the email_log row and sends when no prior row exists", async () => {
    const res = await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item()], BATCH_ID, {
      skipSleep: true,
    });

    // Pre-send idempotency probe scoped to (batchId, kolId, campaign).
    expect(emailLogFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-a",
        campaignId: "campaign-1",
        kolId: KOL_ID,
        batchId: BATCH_ID,
        status: { in: ["sent", "mock_sent"] },
      },
      select: { id: true, status: true },
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ batchId: BATCH_ID }),
      })
    );
    expect(res.sent).toBe(1);
    expect(res.items[0]!.skipped).toBeUndefined();
  });

  it("skips the resend when a sent row already exists for (batchId,kolId)", async () => {
    emailLogFindFirst.mockResolvedValueOnce({ id: "log-existing", status: "sent" });

    const res = await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item()], BATCH_ID, {
      skipSleep: true,
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(emailLogCreate).not.toHaveBeenCalled();
    expect(res.sent).toBe(1);
    expect(res.items[0]).toMatchObject({
      kolId: KOL_ID,
      status: "sent",
      emailLogId: "log-existing",
      skipped: true,
    });
  });

  it("counts a prior mock_sent row as already sent (mocked) and skips", async () => {
    emailLogFindFirst.mockResolvedValueOnce({ id: "log-mock", status: "mock_sent" });

    const res = await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item()], BATCH_ID, {
      skipSleep: true,
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(res.mocked).toBe(1);
    expect(res.items[0]).toMatchObject({ status: "mock_sent", skipped: true });
  });

  it("does NOT probe email_log when batchId is null (legacy non-batch send)", async () => {
    await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item()], null, {
      skipSleep: true,
    });

    expect(emailLogFindFirst).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ batchId: null }) })
    );
  });
});

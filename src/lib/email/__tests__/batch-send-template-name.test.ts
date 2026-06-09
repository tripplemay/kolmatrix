/**
 * BL-099-F003 · batch-send template_name snapshot (ADR-018 D2).
 *
 * Asserts batchSendOutreach freezes the as-sent template name into
 * email_log.template_name (looked up from the Asset table), and
 * degrades to null when there's no template / the asset is gone.
 * DB + email provider + audit/event sinks are mocked at the module
 * boundary so this stays a unit test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const emailLogCreate = vi.fn(async () => ({ id: "log-1" }));
const assetFindUnique = vi.fn();
const kolCampaignFindUnique = vi.fn(async () => null);
const mockTx = {
  asset: { findUnique: assetFindUnique },
  emailLog: { create: emailLogCreate },
  kolCampaign: { findUnique: kolCampaignFindUnique, update: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  withTenant: (_tenantId: string, fn: (tx: unknown) => unknown) => fn(mockTx),
}));
vi.mock("@/lib/email/resend", () => ({
  FROM_ADDRESS: "marketer@kolquest.com",
  SendEmailError: class extends Error {
    code = "send_error";
  },
  sendEmail: vi.fn(async () => ({ providerMessageId: "pm_1", mocked: false })),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/events/log", () => ({ logEvent: vi.fn() }));

const { batchSendOutreach } = await import("../batch-send");

function item(overrides: Record<string, unknown> = {}) {
  return {
    kolCampaignId: "",
    kolId: "kkkkkkkk-1111-1111-1111-111111111111",
    toAddress: "kol@example.com",
    subject: "Subject",
    bodyText: "Body",
    templateId: "aaaaaaaa-1111-1111-1111-111111111111",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  kolCampaignFindUnique.mockResolvedValue(null);
});

describe("BL-099-F003 batchSendOutreach template_name snapshot", () => {
  it("snapshots the Asset name into email_log.template_name", async () => {
    assetFindUnique.mockResolvedValueOnce({ name: "Welcome Email" });

    await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item()], {
      skipSleep: true,
    });

    expect(assetFindUnique).toHaveBeenCalledWith({
      where: { id: "aaaaaaaa-1111-1111-1111-111111111111" },
      select: { name: true },
    });
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateId: "aaaaaaaa-1111-1111-1111-111111111111",
          templateName: "Welcome Email",
        }),
      })
    );
  });

  it("writes null template_name and skips the lookup when there's no template", async () => {
    await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item({ templateId: null })], {
      skipSleep: true,
    });

    expect(assetFindUnique).not.toHaveBeenCalled();
    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ templateName: null }),
      })
    );
  });

  it("writes null template_name when the template asset no longer exists", async () => {
    assetFindUnique.mockResolvedValueOnce(null);

    await batchSendOutreach("tenant-a", "actor-1", "campaign-1", [item()], {
      skipSleep: true,
    });

    expect(emailLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ templateName: null }),
      })
    );
  });
});

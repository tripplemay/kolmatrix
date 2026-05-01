/**
 * MVP-internal-demo-prep verifying-2026-05-01 fix C-10 unit-level test.
 *
 * Drives customizeAction directly and verifies each early-return error
 * code (campaign_not_found / campaign_no_product / kol_not_found /
 * template_not_found) plus the unauthorized + invalid_input gates. Same
 * mock pattern as knowledge-base/__tests__/actions.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn<(path: string, type?: "page" | "layout") => void>();
vi.mock("next/cache", () => ({ revalidatePath }));

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const withTenant = vi.fn<(tenantId: string, fn: (tx: unknown) => unknown) => Promise<unknown>>();
vi.mock("@/lib/db", () => ({ withTenant }));

const logEvent = vi.fn();
vi.mock("@/lib/events/log", () => ({ logEvent }));

const customizeEmail = vi.fn();
class CustomizeEmailErrorMock extends Error {
  code: string;
  constructor(code: string, msg = "x") {
    super(msg);
    this.code = code;
  }
}
vi.mock("@/lib/email/customize", () => ({
  customizeEmail: (input: unknown) => customizeEmail(input),
  CustomizeEmailError: CustomizeEmailErrorMock,
}));

const { customizeAction } = await import("../actions");

const TENANT_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const CAMPAIGN_ID = "cccccccc-1111-2222-3333-444444444444";
const KOL_ID = "dddddddd-1111-2222-3333-444444444444";
const TEMPLATE_ID = "eeeeeeee-1111-2222-3333-444444444444";

function buildFD(): FormData {
  const fd = new FormData();
  fd.set("campaignId", CAMPAIGN_ID);
  fd.set("kolId", KOL_ID);
  fd.set("templateId", TEMPLATE_ID);
  return fd;
}

function buildResolverTx(opts: {
  campaign?: {
    product: { name: string; category: string; uniqueSellingPoints: string } | null;
  } | null;
  kol?: unknown;
  template?: unknown;
}) {
  return {
    campaign: { findUnique: vi.fn().mockResolvedValue(opts.campaign ?? null) },
    kol: { findUnique: vi.fn().mockResolvedValue(opts.kol ?? null) },
    emailTemplate: {
      findUnique: vi.fn().mockResolvedValue(opts.template ?? null),
    },
  };
}

beforeEach(() => {
  authMock.mockReset();
  withTenant.mockReset();
  customizeEmail.mockReset();
  revalidatePath.mockClear();
  logEvent.mockClear();
});

describe("customizeAction (MVP-vf C-10)", () => {
  it("returns unauthorized when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const res = await customizeAction({ ok: false }, buildFD());
    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("returns invalid_input on a malformed UUID", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    const fd = new FormData();
    fd.set("campaignId", "not-a-uuid");
    fd.set("kolId", KOL_ID);
    fd.set("templateId", TEMPLATE_ID);
    const res = await customizeAction({ ok: false }, fd);
    expect(res).toEqual({ ok: false, error: "invalid_input" });
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("returns campaign_not_found when the campaign row is missing", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    const txMock = buildResolverTx({ campaign: null, kol: {}, template: {} });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)(txMock)
    );
    const res = await customizeAction({ ok: false }, buildFD());
    expect(res).toEqual({ ok: false, error: "campaign_not_found" });
    expect(customizeEmail).not.toHaveBeenCalled();
  });

  it("returns campaign_no_product when campaign exists but productId is null", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    const txMock = buildResolverTx({
      campaign: { product: null },
      kol: { displayName: "K", handle: "k", countryCode: "US", categories: ["MOBA"] },
      template: { subject: "S", body: "B", locale: "en" },
    });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)(txMock)
    );
    const res = await customizeAction({ ok: false }, buildFD());
    expect(res).toEqual({ ok: false, error: "campaign_no_product" });
    expect(customizeEmail).not.toHaveBeenCalled();
  });

  it("returns kol_not_found when kol row is missing", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    const txMock = buildResolverTx({
      campaign: { product: { name: "P", category: "C", uniqueSellingPoints: "U" } },
      kol: null,
      template: { subject: "S", body: "B", locale: "en" },
    });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)(txMock)
    );
    const res = await customizeAction({ ok: false }, buildFD());
    expect(res).toEqual({ ok: false, error: "kol_not_found" });
    expect(customizeEmail).not.toHaveBeenCalled();
  });

  it("returns template_not_found when template row is missing", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    const txMock = buildResolverTx({
      campaign: { product: { name: "P", category: "C", uniqueSellingPoints: "U" } },
      kol: { displayName: "K", handle: "k", countryCode: "US", categories: ["MOBA"] },
      template: null,
    });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)(txMock)
    );
    const res = await customizeAction({ ok: false }, buildFD());
    expect(res).toEqual({ ok: false, error: "template_not_found" });
    expect(customizeEmail).not.toHaveBeenCalled();
  });

  it("calls customizeEmail and returns ok when all four inputs resolve", async () => {
    authMock.mockResolvedValue({ user: { tenantId: TENANT_ID, id: USER_ID } });
    const txMock = buildResolverTx({
      campaign: {
        product: { name: "Honor of Kings", category: "MOBA", uniqueSellingPoints: "USP" },
      },
      kol: {
        displayName: "GamerXia",
        handle: "gamerxia",
        countryCode: "CN",
        categories: ["MOBA"],
      },
      template: { subject: "Subject", body: "Body", locale: "en" },
    });
    withTenant.mockImplementation(async (_tenantId, fn) =>
      (fn as (tx: unknown) => unknown)(txMock)
    );
    customizeEmail.mockResolvedValue({ subject: "AI Subject", body: "AI Body" });

    const res = await customizeAction({ ok: false }, buildFD());

    expect(customizeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        product: { name: "Honor of Kings", category: "MOBA", usp: "USP" },
        kol: expect.objectContaining({ name: "GamerXia", handle: "gamerxia" }),
        template: expect.objectContaining({ locale: "en" }),
      })
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data?.subject).toBe("AI Subject");
    }
  });
});

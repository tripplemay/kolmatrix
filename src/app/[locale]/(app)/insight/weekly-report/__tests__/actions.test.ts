/**
 * BL-035-F004 — createShareTokenAction server-side origin specs.
 *
 * Locks the audit-driven contract change: origin is derived from
 * `NEXT_PUBLIC_SITE_URL` or the request headers (`x-forwarded-host`
 * / `x-forwarded-proto`) instead of being trusted from the client.
 * Tests stub `next/headers` + `auth` + the persistence layer so the
 * spec stays in jsdom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn<() => Promise<Headers>>();
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const attachShareTokenMock = vi.fn();
const revokeShareTokenMock = vi.fn();
vi.mock("@/lib/weekly-report/persistence", () => ({
  attachShareToken: (...args: unknown[]) => attachShareTokenMock(...args),
  revokeShareToken: (...args: unknown[]) => revokeShareTokenMock(...args),
  upsertWeeklyReport: vi.fn(),
}));

const logAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/log", () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
}));

const logEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/events/log", () => ({
  logEvent: (...args: unknown[]) => logEventMock(...args),
}));

vi.mock("@/lib/db", () => ({ withTenant: vi.fn() }));
vi.mock("@/lib/rate-limit-ai", () => ({
  rateLimitAi: vi.fn().mockResolvedValue({ ok: true, remaining: 9 }),
}));
vi.mock("@/lib/weekly-report/data-assembly", () => ({
  assembleWeeklyReportInput: vi.fn(),
  isoWeekEndUtc: (d: Date) => d,
  isoWeekStartUtc: (d: Date) => d,
}));
vi.mock("@/lib/weekly-report/generate", () => ({
  generateWeeklyReport: vi.fn(),
  WeeklyReportError: class {},
}));

const { createShareTokenAction } = await import("../actions");

const TENANT = "11111111-2222-3333-4444-555555555555";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const REPORT = "33333333-4444-5555-6666-777777777777";

const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({
    user: { tenantId: TENANT, id: USER },
  });
  headersMock.mockReset();
  attachShareTokenMock.mockReset().mockResolvedValue({
    token: "tok-32chars",
    expiresAt: new Date("2026-05-12T00:00:00Z"),
  });
  logEventMock.mockReset().mockResolvedValue(undefined);
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

afterEach(() => {
  if (ORIGINAL_SITE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
  }
});

describe("createShareTokenAction (BL-035-F004)", () => {
  it("ignores any client-supplied origin (origin still derived server-side)", () => {
    // BL-051a-F005 added an optional `ttl` parameter; the
    // signature now exposes 1 required + 1 optional arg. The
    // anti-spoofing guarantee remains: the function never accepts a
    // client-supplied origin string.
    expect(createShareTokenAction.length).toBeLessThanOrEqual(2);
  });

  it("uses NEXT_PUBLIC_SITE_URL when set (preferred over headers)", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kol.guangai.ai/";
    headersMock.mockResolvedValue(new Headers({ host: "attacker.com" }));

    const res = await createShareTokenAction(REPORT);
    expect(res).toEqual({
      ok: true,
      url: "https://kol.guangai.ai/shared/weekly-report/tok-32chars",
      expiresAt: "2026-05-12T00:00:00.000Z",
    });
    expect(headersMock).not.toHaveBeenCalled();
  });

  it("derives origin from x-forwarded-proto + x-forwarded-host when env unset", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        host: "kol.guangai.ai",
        "x-forwarded-host": "kol.guangai.ai",
        "x-forwarded-proto": "https",
      }),
    );

    const res = await createShareTokenAction(REPORT);
    expect(res).toEqual({
      ok: true,
      url: "https://kol.guangai.ai/shared/weekly-report/tok-32chars",
      expiresAt: "2026-05-12T00:00:00.000Z",
    });
  });

  it("falls back to host header with https when proto absent on a public host", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "staging.kol.guangai.ai" }));

    const res = await createShareTokenAction(REPORT);
    expect(res).toMatchObject({
      ok: true,
      url: "https://staging.kol.guangai.ai/shared/weekly-report/tok-32chars",
    });
  });

  it("falls back to http on localhost / loopback hosts", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "localhost:3000" }));

    const res = await createShareTokenAction(REPORT);
    expect(res).toMatchObject({
      ok: true,
      url: "http://localhost:3000/shared/weekly-report/tok-32chars",
    });
  });

  it("ignores hostile attacker.com — never appears in the share URL even if Host header is spoofed", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://kol.guangai.ai";
    headersMock.mockResolvedValue(new Headers({ host: "attacker.com" }));

    const res = await createShareTokenAction(REPORT);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url).not.toContain("attacker.com");
  });

  it("returns generic error when no origin can be resolved (no env, no host header)", async () => {
    headersMock.mockResolvedValue(new Headers({}));

    const res = await createShareTokenAction(REPORT);
    expect(res).toEqual({ ok: false, error: "generic" });
  });
});

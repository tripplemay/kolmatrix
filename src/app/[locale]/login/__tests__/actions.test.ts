/**
 * BL-020-F005 — loginAction integration with rateLimitLogin.
 *
 * Verifies that the rate-limit hook fires BEFORE bcrypt (i.e. before
 * `signIn`), so a blocked IP never enters the credentials check. The
 * `signIn` and `getLocale` imports are mocked at the boundary so the
 * suite stays in jsdom and doesn't pull next-auth's full request stack.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimitLoginMock = vi.fn();
const signInMock = vi.fn();
const headersMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimitLogin: (ip: string) => rateLimitLoginMock(ip),
}));
vi.mock("@/auth", () => ({ signIn: (...args: unknown[]) => signInMock(...args) }));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    type = "AuthError";
  },
}));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
}));
vi.mock("next/headers", () => ({
  headers: async () => headersMock(),
}));
vi.mock("@/i18n/routing", () => ({
  isLocale: (v: unknown) => v === "en" || v === "zh" || v === "ja" || v === "ko" || v === "es",
  routing: { defaultLocale: "en" },
}));

const { loginAction } = await import("../actions");

function fd(email: string, password: string): FormData {
  const f = new FormData();
  f.set("email", email);
  f.set("password", password);
  return f;
}

beforeEach(() => {
  rateLimitLoginMock.mockReset();
  signInMock.mockReset();
  headersMock.mockReset();
  headersMock.mockReturnValue({
    get: (key: string) =>
      key === "x-forwarded-for" ? "203.0.113.7, 10.0.0.1" : null,
  });
});

// BL-035-F001 (AUTH-H2): minimum length 12. The legacy "secret"
// fixture (6 chars) now trips the password_too_short branch before
// rateLimitLogin runs, so happy-path tests use a 12-char fixture.
const VALID_PASSWORD = "KOLMatrix@2026!";
const SHORT_PASSWORD = "shortpw";

describe("loginAction — rate-limit integration", () => {
  it("blocks the request before signIn when rate limit triggered", async () => {
    rateLimitLoginMock.mockResolvedValueOnce({ ok: false, retryAfter: 42 });

    const res = await loginAction({}, fd("user@example.com", VALID_PASSWORD));

    expect(res).toEqual({ error: "rate_limited", retryAfter: 42 });
    expect(signInMock).not.toHaveBeenCalled();
    expect(rateLimitLoginMock).toHaveBeenCalledWith("203.0.113.7");
  });

  it("falls through to signIn when rate limit allows the attempt", async () => {
    rateLimitLoginMock.mockResolvedValueOnce({ ok: true, remaining: 4 });
    signInMock.mockResolvedValueOnce(undefined);

    await loginAction({}, fd("user@example.com", VALID_PASSWORD));

    expect(rateLimitLoginMock).toHaveBeenCalledWith("203.0.113.7");
    expect(signInMock).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ email: "user@example.com", password: VALID_PASSWORD }),
    );
  });

  it("does not consult rate limit when fields are missing", async () => {
    const res = await loginAction({}, fd("", ""));
    expect(res).toEqual({ error: "missing_fields" });
    expect(rateLimitLoginMock).not.toHaveBeenCalled();
  });
});

describe("BL-035-F001 — password length (12 char minimum)", () => {
  it("rejects an 11-character password without consulting rate-limit or signIn", async () => {
    const res = await loginAction({}, fd("user@example.com", "12345678901"));
    expect(res).toEqual({ error: "password_too_short" });
    expect(rateLimitLoginMock).not.toHaveBeenCalled();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("rejects a 7-character legacy fixture (e.g. 'shortpw') with password_too_short", async () => {
    const res = await loginAction({}, fd("user@example.com", SHORT_PASSWORD));
    expect(res).toEqual({ error: "password_too_short" });
  });

  it("accepts exactly 12 characters", async () => {
    rateLimitLoginMock.mockResolvedValueOnce({ ok: true, remaining: 4 });
    signInMock.mockResolvedValueOnce(undefined);

    await loginAction({}, fd("user@example.com", "123456789012"));
    expect(rateLimitLoginMock).toHaveBeenCalled();
    expect(signInMock).toHaveBeenCalled();
  });
});

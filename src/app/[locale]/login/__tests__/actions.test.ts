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

describe("loginAction — rate-limit integration", () => {
  it("blocks the request before signIn when rate limit triggered", async () => {
    rateLimitLoginMock.mockResolvedValueOnce({ ok: false, retryAfter: 42 });

    const res = await loginAction({}, fd("user@example.com", "secret"));

    expect(res).toEqual({ error: "rate_limited", retryAfter: 42 });
    expect(signInMock).not.toHaveBeenCalled();
    expect(rateLimitLoginMock).toHaveBeenCalledWith("203.0.113.7");
  });

  it("falls through to signIn when rate limit allows the attempt", async () => {
    rateLimitLoginMock.mockResolvedValueOnce({ ok: true, remaining: 4 });
    signInMock.mockResolvedValueOnce(undefined);

    await loginAction({}, fd("user@example.com", "secret"));

    expect(rateLimitLoginMock).toHaveBeenCalledWith("203.0.113.7");
    expect(signInMock).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ email: "user@example.com", password: "secret" })
    );
  });

  it("does not consult rate limit when fields are missing", async () => {
    const res = await loginAction({}, fd("", ""));
    expect(res).toEqual({ error: "missing_fields" });
    expect(rateLimitLoginMock).not.toHaveBeenCalled();
  });
});

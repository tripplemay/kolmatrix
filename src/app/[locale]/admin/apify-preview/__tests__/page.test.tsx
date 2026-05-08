/**
 * BL-012-F001 · /[locale]/admin/apify-preview admin auth gate spec.
 *
 * The page is a server component that reads `auth()` and either renders
 * the read-only banner (admin) or redirects (anyone else). We mock auth
 * + next/navigation's redirect so the call shape is observable; the real
 * `redirect()` throws a NEXT_REDIRECT error, so our mock follows suit
 * to short-circuit the page render path the way Next does at runtime.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// next-intl/server's getTranslations needs the request-scoped i18n config
// in a real Next render. For a unit-level page test we shortcut to a
// passthrough translator that returns the requested key — assertions match
// keys, not human copy, which keeps the test stable across F005's i18n
// drop.
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { locale: string; namespace: string }) =>
    (key: string) => `${namespace}.${key}`,
}));

import ApifyPreviewPage from "../page";

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BL-012-F001 /[locale]/admin/apify-preview auth gate", () => {
  it("renders the read-only banner when the session user has admin role", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", role: "admin", tenantId: "t1", email: "admin@example.com" },
    });

    const node = await ApifyPreviewPage({ params: Promise.resolve({ locale: "en" }) });
    const html = renderToStaticMarkup(node);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("admin.apifyPreview.title");
    expect(html).toContain("admin.apifyPreview.readOnlyWarning");
    expect(html).toContain("apify-preview-readonly-banner");
  });

  it("redirects marketer users to the locale-prefixed dashboard", async () => {
    authMock.mockResolvedValue({
      user: { id: "u2", role: "marketer", tenantId: "t1", email: "ops@example.com" },
    });

    await expect(
      ApifyPreviewPage({ params: Promise.resolve({ locale: "zh" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/zh/dashboard");

    expect(redirectMock).toHaveBeenCalledWith("/zh/dashboard");
  });

  it("redirects unauthenticated visitors to the locale-prefixed login", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      ApifyPreviewPage({ params: Promise.resolve({ locale: "en" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/en/login");

    expect(redirectMock).toHaveBeenCalledWith("/en/login");
  });

  it("falls back to the default locale when the route param is not in the allowlist", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      ApifyPreviewPage({ params: Promise.resolve({ locale: "xx" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/en/login");

    expect(redirectMock).toHaveBeenCalledWith("/en/login");
  });
});

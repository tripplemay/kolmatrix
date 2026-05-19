/**
 * BL-012-F001 / F003 · /[locale]/admin/apify-preview server-component spec.
 *
 * Auth gate cases (F001 acceptance ≥3): admin renders / marketer redirects /
 * unauth redirects, plus an invalid-locale fallback. F003 added the server
 * fetch + error banner branch — covered by a fifth case that asserts the
 * fetch error renders without exposing client-side state.
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

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ namespace }: { locale: string; namespace: string }) =>
    (key: string) => `${namespace}.${key}`,
}));

const fetchApifyKolPageMock = vi.fn();
vi.mock("@/lib/admin/apify-preview-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/apify-preview-client")>(
    "@/lib/admin/apify-preview-client"
  );
  return {
    ...actual,
    fetchApifyKolPage: (...args: unknown[]) => fetchApifyKolPageMock(...args),
  };
});

// PreviewTable + StatsCards are client components under test in their own
// files. Stub them here so the page test stays focused on the auth gate +
// fetch wiring.
vi.mock("../PreviewTable", () => ({
  PreviewTable: (props: { items: unknown[]; total: number }) => (
    <div data-testid="preview-table-stub">
      stub:items={props.items.length}:total={props.total}
    </div>
  ),
}));
vi.mock("../StatsCards", () => ({
  StatsCards: (props: { items: unknown[]; total: number }) => (
    <div data-testid="stats-cards-stub">stub:items={props.items.length}:total={props.total}</div>
  ),
}));

import ApifyPreviewPage from "../page";

const tenantAdminSession = {
  user: { id: "u1", role: "tenant_admin", tenantId: "t1", email: "admin@example.com" },
};
const platformAdminSession = {
  user: { id: "u3", role: "platform_admin", tenantId: "t1", email: "platform@example.com" },
};
const marketerSession = {
  user: { id: "u2", role: "marketer", tenantId: "t1", email: "ops@example.com" },
};

const emptySearchParams = Promise.resolve({});

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
  fetchApifyKolPageMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("BL-012-F001 /[locale]/admin/apify-preview auth gate", () => {
  it("renders the read-only banner + preview table for tenant_admin role", async () => {
    authMock.mockResolvedValue(tenantAdminSession);
    fetchApifyKolPageMock.mockResolvedValue({
      data: [],
      raw: {},
      page: 1,
      pageSize: 50,
      total: 0,
    });

    const node = await ApifyPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: emptySearchParams,
    });
    const html = renderToStaticMarkup(node);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("apify-preview-readonly-banner");
    expect(html).toContain("preview-table-stub");
    expect(html).not.toContain("apify-preview-fetch-error");
    expect(fetchApifyKolPageMock).toHaveBeenCalledTimes(1);
  });

  it("also renders for the platform_admin role", async () => {
    authMock.mockResolvedValue(platformAdminSession);
    fetchApifyKolPageMock.mockResolvedValue({
      data: [],
      raw: {},
      page: 1,
      pageSize: 50,
      total: 0,
    });

    const node = await ApifyPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: emptySearchParams,
    });
    const html = renderToStaticMarkup(node);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(html).toContain("apify-preview-readonly-banner");
    expect(html).toContain("preview-table-stub");
  });

  it("redirects marketer users to the locale-prefixed dashboard", async () => {
    authMock.mockResolvedValue(marketerSession);

    await expect(
      ApifyPreviewPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: emptySearchParams,
      })
    ).rejects.toThrow("NEXT_REDIRECT:/zh/insight");

    expect(redirectMock).toHaveBeenCalledWith("/zh/insight");
    expect(fetchApifyKolPageMock).not.toHaveBeenCalled();
  });

  it("redirects users carrying the legacy literal 'admin' role to dashboard", async () => {
    // Regression for BL-012-F001 verifying-2026-05-08: the prior
    // implementation used `role === "admin"`, which never matched the
    // real seed (`tenant_admin`) and silently rejected every admin user.
    // Pin the new behaviour: a user carrying just "admin" (which the
    // production schema does not produce) is rejected like any other
    // non-admin tier.
    authMock.mockResolvedValue({
      user: { id: "u4", role: "admin", tenantId: "t1", email: "ghost@example.com" },
    });

    await expect(
      ApifyPreviewPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: emptySearchParams,
      })
    ).rejects.toThrow("NEXT_REDIRECT:/en/insight");
    expect(redirectMock).toHaveBeenCalledWith("/en/insight");
  });

  it("redirects unauthenticated visitors to the locale-prefixed login", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      ApifyPreviewPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: emptySearchParams,
      })
    ).rejects.toThrow("NEXT_REDIRECT:/en/login");

    expect(redirectMock).toHaveBeenCalledWith("/en/login");
  });

  it("falls back to the default locale when the route param is not in the allowlist", async () => {
    authMock.mockResolvedValue(null);

    await expect(
      ApifyPreviewPage({
        params: Promise.resolve({ locale: "xx" }),
        searchParams: emptySearchParams,
      })
    ).rejects.toThrow("NEXT_REDIRECT:/en/login");
  });
});

describe("BL-012-F003 server fetch error rendering", () => {
  it("shows the fetch-error banner when the upstream client throws", async () => {
    authMock.mockResolvedValue(tenantAdminSession);
    const { ApifyPreviewError } = await import("@/lib/admin/apify-preview-client");
    fetchApifyKolPageMock.mockRejectedValue(
      new ApifyPreviewError("unauthorized", "fork rejected the api key", 401)
    );

    const node = await ApifyPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: emptySearchParams,
    });
    const html = renderToStaticMarkup(node);

    expect(html).toContain("apify-preview-fetch-error");
    expect(html).not.toContain("preview-table-stub");
    expect(html).toContain("admin.apifyPreview.fetchError");
  });
});

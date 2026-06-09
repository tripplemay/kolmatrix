/**
 * BL-055 F002 — OutreachTabs templates badge async fetch + tooltipKey
 * scrub. Renders the async server component with the auth + DB layer
 * mocked at the module boundary, then asserts:
 *   1. templates badge displays the real EmailTemplate user-count.
 *   2. templates link does NOT carry a `title` (the old "Coming in B4"
 *      tooltipKey) — tab is fully unlocked.
 *   3. templates badge is omitted when count is 0 (no visual noise).
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const countUserTemplatesMock = vi.fn();
const withTenantMock = vi.fn(
  async (_tenantId: string, fn: (tx: unknown) => unknown) => fn({})
);

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));
vi.mock("@/lib/db", () => ({
  withTenant: (tenantId: string, fn: (tx: unknown) => unknown) =>
    withTenantMock(tenantId, fn),
}));
// BL-099-F001 — countUserTemplates now counts Asset rows (RLS-scoped),
// so the tenantId argument was dropped; it's a single-arg call.
vi.mock("@/lib/email/templates", () => ({
  countUserTemplates: (tx: unknown) => countUserTemplatesMock(tx),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => `tabs.${key}`,
}));

const { OutreachTabs } = await import("../OutreachTabs");

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  authMock.mockReset();
  countUserTemplatesMock.mockReset();
  authMock.mockResolvedValue({ user: { tenantId: TENANT_ID } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("OutreachTabs", () => {
  it("renders the real EmailTemplate user-count as the templates badge", async () => {
    countUserTemplatesMock.mockResolvedValue(7);
    const ui = await OutreachTabs({ activeTab: "overview", locale: "en" });
    render(ui);
    const link = screen.getByTestId("outreach-tab-templates");
    expect(link).toHaveTextContent(/7/);
    expect(countUserTemplatesMock).toHaveBeenCalledWith(expect.anything());
  });

  it("omits the templates badge when the user has no templates", async () => {
    countUserTemplatesMock.mockResolvedValue(0);
    const ui = await OutreachTabs({ activeTab: "overview", locale: "en" });
    render(ui);
    const link = screen.getByTestId("outreach-tab-templates");
    // Label should still render but no numeric badge span follows it.
    expect(link.textContent ?? "").not.toMatch(/\d/);
  });

  it("emits no Coming-in-B4 tooltip on the templates link (tooltipKey scrubbed)", async () => {
    countUserTemplatesMock.mockResolvedValue(3);
    const ui = await OutreachTabs({ activeTab: "overview", locale: "en" });
    render(ui);
    const link = screen.getByTestId("outreach-tab-templates");
    expect(link).not.toHaveAttribute("title");
  });
});

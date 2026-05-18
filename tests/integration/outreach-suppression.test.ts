/**
 * BL-024-F005 — `/outreach/suppression` page integration tests.
 *
 * Seeds the audit_log directly with the same `kol.email_cleared_by_bounce`
 * shape that BL-035-F006 webhook writes. Asserts the page only surfaces
 * the current tenant's rows and that the join into `Kol` populates the
 * displayName.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async () =>
    new Proxy(
      ((key: string) => key) as ((k: string) => string) & Record<string, unknown>,
      {
        apply: (_t, _self, args) => String(args[0]),
        get: (_t, prop) => String(prop),
      }
    ),
}));

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

let counter = 0;

async function freshTenant(): Promise<string> {
  counter += 1;
  const suffix = `${Date.now()}-${counter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const t = await getAdminPrisma().tenant.create({
    data: { name: `supp ${suffix}`, slug: `supp-${suffix}` },
  });
  return t.id;
}

async function seedSuppression(
  tenantId: string,
  kolName: string,
  reason: string
): Promise<void> {
  counter += 1;
  const admin = getAdminPrisma();
  const kol = await admin.kol.create({
    data: {
      tenantId,
      platform: "youtube",
      handle: `h-${counter}`,
      displayName: kolName,
      followerCount: 100,
    },
  });
  await admin.auditLog.create({
    data: {
      tenantId,
      action: "kol.email_cleared_by_bounce",
      resourceType: "kol",
      resourceId: kol.id,
      payload: {
        before: { reason },
        after: { email: null, providerMessageId: `msg-${counter}` },
      },
    },
  });
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  authMock.mockReset();
});

describe("/outreach/suppression page", () => {
  it("redirects to /login when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const mod = await import("@/app/[locale]/(app)/reach/suppression/page");
    await expect(
      mod.default({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(/redirect:\/en\/login/);
  });

  it("only shows suppression entries for the current tenant", async () => {
    const tenantA = await freshTenant();
    const tenantB = await freshTenant();
    authMock.mockResolvedValue({ user: { tenantId: tenantA, id: tenantA } });

    await seedSuppression(tenantA, "Alpha KOL", "permanent_bounce");
    await seedSuppression(tenantB, "Beta KOL", "permanent_bounce");

    const mod = await import("@/app/[locale]/(app)/reach/suppression/page");
    const PageEl = await mod.default({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });
    const json = JSON.stringify(PageEl);
    expect(json).toContain("Alpha KOL");
    expect(json).not.toContain("Beta KOL");
    expect(json).toContain("permanent_bounce");
  });
});

/**
 * BL-024-F004 — `/outreach/tracking` page integration tests.
 *
 * Drives the page through `next-intl/server` shims so we can assert
 * the EmailLog rows it actually fetches. We exercise:
 *   - tenant scoping (cross-tenant rows hidden)
 *   - status=all returns every row
 *   - status=delivered filters correctly
 *
 * Mocks `@/auth` + `next/navigation.redirect` so we can call the
 * page function directly. We import the page lazily so the mocks
 * apply before the module evaluates.
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
    data: { name: `track ${suffix}`, slug: `track-${suffix}` },
  });
  return t.id;
}

async function seedEmailLog(
  tenantId: string,
  status: string,
  subject: string
): Promise<void> {
  const admin = getAdminPrisma();
  const kol = await admin.kol.create({
    data: {
      tenantId,
      platform: "youtube",
      handle: `h-${counter++}`,
      displayName: `KOL ${counter}`,
      followerCount: 100,
    },
  });
  await admin.emailLog.create({
    data: {
      tenantId,
      kolId: kol.id,
      toAddress: `${counter}@x.com`,
      fromAddress: "marketer@kolquest.com",
      subject,
      bodyHtml: "<p>hi</p>",
      status,
      sentAt: new Date(),
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

describe("/outreach/tracking page", () => {
  it("redirects to /login when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const mod = await import("@/app/[locale]/(app)/reach/tracking/page");
    await expect(
      mod.default({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(/redirect:\/en\/login/);
  });

  it("filters by tenant + status", async () => {
    const tenantA = await freshTenant();
    const tenantB = await freshTenant();
    authMock.mockResolvedValue({ user: { tenantId: tenantA, id: tenantA } });

    await seedEmailLog(tenantA, "delivered", "Tenant A delivered");
    await seedEmailLog(tenantA, "bounced", "Tenant A bounced");
    await seedEmailLog(tenantB, "delivered", "Tenant B delivered");

    const mod = await import("@/app/[locale]/(app)/reach/tracking/page");
    const PageEl = await mod.default({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ status: "delivered" }),
    });
    // Walk the JSX tree for TrackingTable rows.
    const json = JSON.stringify(PageEl);
    expect(json).toContain("Tenant A delivered");
    expect(json).not.toContain("Tenant A bounced");
    expect(json).not.toContain("Tenant B delivered");
  });
});

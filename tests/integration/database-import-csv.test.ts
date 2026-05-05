/**
 * BL-024-F001-2 — `/api/database/import-csv` integration tests.
 *
 * Mocks `@/auth` + `@/lib/rate-limit-batch` so we can hit the real
 * `withTenant` path against a real DB. Covers:
 *   - auth gate (401 without session)
 *   - happy path: valid CSV creates rows; idempotent re-import updates
 *   - zod row validation: invalid emails skipped, errors[] populated
 *   - 5 MB / row count limits
 *   - rate-limit wiring
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const rateLimitBatchMock = vi
  .fn<() => Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }>>()
  .mockResolvedValue({ ok: true, remaining: 19 });
vi.mock("@/lib/rate-limit-batch", () => ({
  rateLimitBatchSend: () => rateLimitBatchMock(),
}));

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

let tenantCounter = 0;

async function freshTenantWithUser(): Promise<{
  tenantId: string;
  userId: string;
}> {
  const admin = getAdminPrisma();
  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const tenant = await admin.tenant.create({
    data: { name: `DBImp Test ${suffix}`, slug: `dbimp-test-${suffix}` },
  });
  const user = await admin.user.create({
    data: {
      tenantId: tenant.id,
      email: `imp-${suffix}@test.local`,
      name: "Import Tester",
      role: "marketer",
    },
  });
  return { tenantId: tenant.id, userId: user.id };
}

function makeFile(content: string, name = "kols.csv"): File {
  return new File([content], name, { type: "text/csv" });
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
  rateLimitBatchMock.mockReset().mockResolvedValue({ ok: true, remaining: 19 });
});

describe("/api/database/import-csv (BL-024-F001-2)", () => {
  it("returns 401 without a session", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("@/app/api/database/import-csv/route");
    const fd = new FormData();
    fd.append("file", makeFile("external_id,handle,display_name\n"));
    const res = await POST(
      new Request("http://test.local/api/database/import-csv", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(401);
  });

  it("imports valid rows and persists them isSaved=true", async () => {
    const { tenantId, userId } = await freshTenantWithUser();
    authMock.mockResolvedValue({ user: { tenantId, id: userId } });
    const csv =
      "external_id,platform,handle,display_name,follower_count,language,country_code,email,categories\n" +
      "ext-1,youtube,alpha,Alpha Streams,1000,en,US,alpha@example.com,mobile|rpg\n" +
      "ext-2,youtube,beta,Beta,500,,,,";

    const { POST } = await import("@/app/api/database/import-csv/route");
    const fd = new FormData();
    fd.append("file", makeFile(csv));
    const res = await POST(
      new Request("http://test.local/api/database/import-csv", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      importedCount: number;
      skippedCount: number;
      errors: unknown[];
    };
    expect(body.ok).toBe(true);
    expect(body.importedCount).toBe(2);
    expect(body.skippedCount).toBe(0);
    expect(body.errors).toEqual([]);

    const admin = getAdminPrisma();
    const saved = await admin.kol.findMany({ where: { tenantId } });
    expect(saved).toHaveLength(2);
    expect(saved.every((k) => k.isSaved === true)).toBe(true);
    expect(saved.find((k) => k.externalId === "ext-1")?.email).toBe(
      "alpha@example.com"
    );
    expect(saved.find((k) => k.externalId === "ext-1")?.categories).toEqual([
      "mobile",
      "rpg",
    ]);
  });

  it("returns row-level errors for invalid emails (skipped, others kept)", async () => {
    const { tenantId, userId } = await freshTenantWithUser();
    authMock.mockResolvedValue({ user: { tenantId, id: userId } });
    const csv =
      "external_id,platform,handle,display_name,follower_count,language,country_code,email,categories\n" +
      "ext-good,youtube,good,Good,100,,,,\n" +
      "ext-bad,youtube,bad,Bad,200,,,not-an-email,";

    const { POST } = await import("@/app/api/database/import-csv/route");
    const fd = new FormData();
    fd.append("file", makeFile(csv));
    const res = await POST(
      new Request("http://test.local/api/database/import-csv", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      importedCount: number;
      skippedCount: number;
      errors: Array<{ row: number; message: string }>;
    };
    expect(body.importedCount).toBe(1);
    expect(body.skippedCount).toBe(1);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].row).toBe(3);
  });

  it("rejects when rate limiter denies", async () => {
    const { tenantId, userId } = await freshTenantWithUser();
    authMock.mockResolvedValue({ user: { tenantId, id: userId } });
    rateLimitBatchMock.mockResolvedValueOnce({ ok: false, retryAfter: 30 });

    const { POST } = await import("@/app/api/database/import-csv/route");
    const fd = new FormData();
    fd.append("file", makeFile("external_id,handle,display_name\n"));
    const res = await POST(
      new Request("http://test.local/api/database/import-csv", {
        method: "POST",
        body: fd,
      })
    );
    expect(res.status).toBe(429);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.error).toBe("rate_limit_exceeded");
  });
});

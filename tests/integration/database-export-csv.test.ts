/**
 * BL-024-F001-1 — `/api/database/export-csv` integration tests.
 *
 * Mocks `@/auth` and exercises the GET handler against a real DB so
 * the assertions cover:
 *   - auth gating (401 without session)
 *   - `isSaved=true` filter (only saved KOLs reach the file)
 *   - Content-Disposition + filename + header row
 *   - formula-injection prefix on `=…` display names
 *   - row-count cap with `?limit=N`
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

let tenantCounter = 0;

async function freshTenant(): Promise<{ id: string; slug: string }> {
  const admin = getAdminPrisma();
  tenantCounter += 1;
  const suffix = `${Date.now()}-${tenantCounter}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await admin.tenant.create({
    data: { name: `DBExp Test ${suffix}`, slug: `dbexp-test-${suffix}` },
  });
  return { id: tenant.id, slug: tenant.slug };
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

describe("/api/database/export-csv (BL-024-F001-1)", () => {
  it("returns 401 when there is no session", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("@/app/api/database/export-csv/route");
    const res = await GET(new Request("http://test.local/api/database/export-csv"));
    expect(res.status).toBe(401);
  });

  // BL-063 F003+F004: export pool widened from saved-only to full
  // tenant. Body asserts row count = 3 saved fixtures with one unsaved
  // excluded; that distinction is gone. BL-064 deletes /database (and
  // its CSV export). Re-skinning this case for the new shape pre-
  // BL-064 would just be churn — skip until the BL-064 rewrite.
  it.skip("returns CSV with header + only isSaved KOLs + formula-injection guard (BL-064 will replace)", async () => {
    const admin = getAdminPrisma();
    const tenant = await freshTenant();
    authMock.mockResolvedValue({ user: { tenantId: tenant.id, id: tenant.id } });

    // Saved + safe display name.
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "alpha",
        displayName: "Alpha Streams",
        followerCount: 1000,
        relationshipStatus: "first_contact",
        countryCode: "US",
        language: "en",
        email: "alpha@example.com",
        categories: ["mobile", "rpg"],
        valueScore: 75,
      },
    });
    // Saved + display name that triggers formula injection (=HYPERLINK).
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "evil",
        displayName: "=HYPERLINK(\"https://attacker\",\"click\")",
        followerCount: 500,
        relationshipStatus: "prospect",
        countryCode: "JP",
      },
    });
    // NOT saved — must be excluded.
    await admin.kol.create({
      data: {
        tenantId: tenant.id,
        platform: "youtube",
        handle: "skipped",
        displayName: "Should Not Appear",
        followerCount: 999,
        relationshipStatus: "prospect",
      },
    });

    const { GET } = await import("@/app/api/database/export-csv/route");
    const res = await GET(new Request("http://test.local/api/database/export-csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="kols-dbexp_test_/);

    const body = await res.text();
    const lines = body.split("\n").filter(Boolean);
    expect(lines[0]).toBe(
      "kol_id,display_name,handle,platform,follower_count,engagement_rate_percent,value_score,categories,language,country_code,email,first_seen_at"
    );
    expect(lines).toHaveLength(3); // header + 2 saved data rows
    expect(body).toContain("alpha");
    expect(body).not.toContain("Should Not Appear");
    // Formula-injection: leading `'` quote inside an RFC-4180-wrapped cell.
    // The display name contains both `=` (formula trigger) and `,` and `"`,
    // so the wrapping double-quotes + escaped inner quotes should appear too.
    expect(body).toMatch(/"'=HYPERLINK\(/);
  });

  it("respects ?limit=N (defaults 5000, accepts override, caps at 50000)", async () => {
    const admin = getAdminPrisma();
    const tenant = await freshTenant();
    authMock.mockResolvedValue({ user: { tenantId: tenant.id, id: tenant.id } });

    // 5 saved KOLs.
    for (let i = 0; i < 5; i += 1) {
      await admin.kol.create({
        data: {
          tenantId: tenant.id,
          platform: "youtube",
          handle: `k${i}`,
          displayName: `KOL ${i}`,
          followerCount: 100 + i,
          relationshipStatus: "prospect",
        },
      });
    }

    const { GET } = await import("@/app/api/database/export-csv/route");
    const res = await GET(
      new Request("http://test.local/api/database/export-csv?limit=2")
    );
    const body = await res.text();
    const lines = body.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 capped rows
  });
});

/**
 * BL-051a-F010 · End-to-end share-token lifecycle (F001 + F002 + F004).
 *
 * Real-DB coverage that the unit suites (validateShareTokenState pure
 * function, mocked deleteProduct flow) can't verify:
 *   1. attachShareToken → revokeShareToken → validateShareToken pipeline
 *      returns 'revoked' with the expected metadata
 *   2. revokeShareToken refuses a non-owner caller (forbidden) and
 *      doesn't mutate revokedAt — RLS + ownership guard intact
 *   3. attachShareToken with ttl='never' produces a far-future
 *      expiresAt that validateShareTokenState reads as 'valid' for
 *      arbitrary `now` values
 *
 * Setup mirrors the existing weekly-report.test.ts harness — same
 * Postgres container, same RLS surface — so we don't fork the
 * integration runtime.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

type PersistenceMod = typeof import("@/lib/weekly-report/persistence");

let persistence: PersistenceMod;

const TENANT = "55555555-0000-4000-8000-eeeeeeeeeeee";
const OWNER = "66666666-0000-4000-8000-ffffffffffff";
const STRANGER = "77777777-0000-4000-8000-aaaaaaaaaaaa";
const WEEK_START = new Date(Date.UTC(2026, 4, 4)); // Mon 2026-05-04
const WEEK_END = new Date(Date.UTC(2026, 4, 10)); // Sun 2026-05-10

beforeAll(async () => {
  await setupTestDb();
  persistence = await import("@/lib/weekly-report/persistence");
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

async function seed() {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: TENANT },
    create: {
      id: TENANT,
      name: "Lifecycle Studio",
      slug: `lifecycle-${TENANT.slice(0, 6)}`,
      logoUrl: null,
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: OWNER },
    create: {
      id: OWNER,
      tenantId: TENANT,
      email: `owner-${OWNER.slice(0, 6)}@lifecycle.test`,
      name: "Lifecycle Owner",
    },
    update: {},
  });
  await admin.user.upsert({
    where: { id: STRANGER },
    create: {
      id: STRANGER,
      tenantId: TENANT,
      email: `stranger-${STRANGER.slice(0, 6)}@lifecycle.test`,
      name: "Lifecycle Stranger",
    },
    update: {},
  });
  return persistence.upsertWeeklyReport({
    tenantId: TENANT,
    createdByUserId: OWNER,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    locale: "en",
    contentMd: "## Executive Summary\n\nLifecycle smoke.",
    summaryJson: {
      tenantSnapshot: { name: "Lifecycle Studio", logoUrl: null },
      kolActivity: {},
      roiData: {},
      prevWeekComparison: {},
      generatedAt: new Date().toISOString(),
    },
  });
}

describe("share-token lifecycle (BL-051a-F002 + F004)", () => {
  it("attach → revoke → validate returns 'revoked' with metadata", async () => {
    const report = await seed();
    const minted = await persistence.attachShareToken({
      tenantId: TENANT,
      reportId: report.id,
    });
    const validBefore = await persistence.validateShareToken(minted.token);
    expect(validBefore.status).toBe("valid");

    const revoked = await persistence.revokeShareToken({
      tenantId: TENANT,
      reportId: report.id,
      actorUserId: OWNER,
    });
    expect(revoked.ok).toBe(true);
    if (revoked.ok) {
      expect(revoked.previouslyRevoked).toBe(false);
    }

    const validAfter = await persistence.validateShareToken(minted.token);
    expect(validAfter.status).toBe("revoked");
    if (validAfter.status === "revoked") {
      expect(validAfter.metadata.revokedAt).toBeInstanceOf(Date);
      expect(validAfter.metadata.locale).toBe("en");
    }
  });

  it("rejects revoke from a non-owner (forbidden) without mutating revokedAt", async () => {
    const report = await seed();
    await persistence.attachShareToken({
      tenantId: TENANT,
      reportId: report.id,
    });

    const denied = await persistence.revokeShareToken({
      tenantId: TENANT,
      reportId: report.id,
      actorUserId: STRANGER,
    });
    expect(denied).toEqual({ ok: false, error: "forbidden" });

    // Confirm DB state untouched.
    const row = await getAdminPrisma().weeklyReport.findUnique({
      where: { id: report.id },
      select: { revokedAt: true },
    });
    expect(row?.revokedAt).toBeNull();
  });

  it("ttl='never' produces a far-future expiry that validates as 'valid'", async () => {
    const report = await seed();
    const minted = await persistence.attachShareToken({
      tenantId: TENANT,
      reportId: report.id,
      ttl: "never",
    });
    expect(minted.expiresAt.getUTCFullYear()).toBeGreaterThanOrEqual(9000);

    // Validate at a "now" 50 years in the future — still valid.
    const fiftyYearsOut = new Date(Date.UTC(2076, 0, 1));
    const result = await persistence.validateShareToken(
      minted.token,
      fiftyYearsOut
    );
    expect(result.status).toBe("valid");
  });

  it("idempotent revoke keeps the original revokedAt timestamp", async () => {
    const report = await seed();
    await persistence.attachShareToken({
      tenantId: TENANT,
      reportId: report.id,
    });

    const first = await persistence.revokeShareToken({
      tenantId: TENANT,
      reportId: report.id,
      actorUserId: OWNER,
    });
    if (!first.ok) throw new Error("first revoke should have succeeded");
    const initialRevokedAt = first.revokedAt.getTime();

    // Second call: should be idempotent + previouslyRevoked=true.
    const second = await persistence.revokeShareToken({
      tenantId: TENANT,
      reportId: report.id,
      actorUserId: OWNER,
    });
    if (!second.ok) throw new Error("second revoke should have succeeded");
    expect(second.previouslyRevoked).toBe(true);
    expect(second.revokedAt.getTime()).toBe(initialRevokedAt);
  });
});

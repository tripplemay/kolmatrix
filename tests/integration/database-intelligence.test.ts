/**
 * B7b-F001 · /database AI intelligence action integration spec.
 *
 * Covers:
 *   1. unauthorized session returns {ok:false,error:"unauthorized"}
 *   2. snapshot aggregation is tenant-scoped (RLS via withTenant)
 *   3. downstream generator failure is mapped to {ok:false,error:code}
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const mockAuth = vi.fn();
const mockGenerateDatabaseIntelligence = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/kol-database/intelligence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/kol-database/intelligence")>(
    "@/lib/kol-database/intelligence"
  );
  return {
    ...actual,
    generateDatabaseIntelligence: (...args: unknown[]) =>
      mockGenerateDatabaseIntelligence(...args),
  };
});

type ActionFn = typeof import("@/app/[locale]/(app)/database/actions").generateDatabaseInsightsAction;

let generateDatabaseInsightsAction: ActionFn;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  await setupTestDb();
  ({ generateDatabaseInsightsAction } = await import(
    "@/app/[locale]/(app)/database/actions"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
  mockAuth.mockReset();
  mockGenerateDatabaseIntelligence.mockReset();
});

function sessionFor(tenantId: string) {
  return { user: { id: USER_A, tenantId } };
}

async function seedTenant(tenantId: string) {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `DB Tenant ${tenantId.slice(0, 4)}`,
      slug: `db-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
}

async function seedKolRow(args: {
  tenantId: string;
  handle: string;
  countryCode: string | null;
  categories: string[];
  valueScore: number | null;
  relationshipStatus: string;
}) {
  const admin = getAdminPrisma();
  await admin.kol.create({
    data: {
      tenantId: args.tenantId,
      platform: "youtube",
      handle: args.handle,
      displayName: args.handle,
      followerCount: 1000,
      countryCode: args.countryCode,
      categories: args.categories,
      valueScore: args.valueScore,
      relationshipStatus: args.relationshipStatus,
      isGaming: true,
      isSaved: true,
      isSuspicious: false,
    },
  });
}

describe("generateDatabaseInsightsAction", () => {
  it("returns unauthorized without session", async () => {
    mockAuth.mockResolvedValue(null);

    const out = await generateDatabaseInsightsAction("en");
    expect(out).toEqual({ ok: false, error: "unauthorized" });
    expect(mockGenerateDatabaseIntelligence).not.toHaveBeenCalled();
  });

  it("aggregates tenant-only snapshot and returns insights", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);

    await seedKolRow({
      tenantId: TENANT_A,
      handle: "a_us_fps",
      countryCode: "US",
      categories: ["FPS"],
      valueScore: 82,
      relationshipStatus: "prospect",
    });
    await seedKolRow({
      tenantId: TENANT_A,
      handle: "a_jp_rpg",
      countryCode: "JP",
      categories: ["RPG"],
      valueScore: 61,
      relationshipStatus: "negotiating",
    });
    await seedKolRow({
      tenantId: TENANT_A,
      handle: "a_null_other",
      countryCode: null,
      categories: [],
      valueScore: null,
      relationshipStatus: "long_term",
    });

    // Noise from another tenant must not leak into the snapshot.
    await seedKolRow({
      tenantId: TENANT_B,
      handle: "b_noise",
      countryCode: "KR",
      categories: ["MOBA"],
      valueScore: 99,
      relationshipStatus: "prospect",
    });

    mockAuth.mockResolvedValue(sessionFor(TENANT_A));
    mockGenerateDatabaseIntelligence.mockResolvedValue({
      insights: [
        {
          type: "opportunity",
          title: "Diversify category mix",
          description: "Expand beyond FPS-heavy pool.",
        },
      ],
      traceId: "trace-db-1",
    });

    const out = await generateDatabaseInsightsAction("en");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.insights).toHaveLength(1);
      expect(out.traceId).toBe("trace-db-1");
    }

    expect(mockGenerateDatabaseIntelligence).toHaveBeenCalledTimes(1);
    const arg = mockGenerateDatabaseIntelligence.mock.calls[0]?.[0] as {
      locale: string;
      snapshot: {
        total: number;
        byRegion: Array<{ region: string; count: number }>;
        byCategory: Array<{ category: string; count: number }>;
        byTier: Array<{ tier: string; count: number }>;
        byRelationshipStatus: Array<{ status: string; count: number }>;
      };
    };

    expect(arg.locale).toBe("en");
    expect(arg.snapshot.total).toBe(3);

    const byRegion = Object.fromEntries(
      arg.snapshot.byRegion.map((r) => [r.region, r.count])
    );
    expect(byRegion).toMatchObject({ US: 1, JP: 1, unknown: 1 });
    expect(byRegion.KR).toBeUndefined();

    const byCategory = Object.fromEntries(
      arg.snapshot.byCategory.map((r) => [r.category, r.count])
    );
    expect(byCategory).toMatchObject({ FPS: 1, RPG: 1, Other: 1 });
    expect(byCategory.MOBA).toBeUndefined();

    const byTier = Object.fromEntries(arg.snapshot.byTier.map((r) => [r.tier, r.count]));
    expect(byTier).toMatchObject({ high: 1, medium: 1, unrated: 1 });

    const byStatus = Object.fromEntries(
      arg.snapshot.byRelationshipStatus.map((r) => [r.status, r.count])
    );
    expect(byStatus).toMatchObject({ prospect: 1, negotiating: 1, long_term: 1 });
  });

  it("maps downstream error codes", async () => {
    await seedTenant(TENANT_A);
    await seedKolRow({
      tenantId: TENANT_A,
      handle: "a_only",
      countryCode: "US",
      categories: ["FPS"],
      valueScore: 75,
      relationshipStatus: "prospect",
    });

    mockAuth.mockResolvedValue(sessionFor(TENANT_A));
    const { DatabaseIntelligenceError } = await import(
      "@/lib/kol-database/intelligence"
    );
    mockGenerateDatabaseIntelligence.mockRejectedValue(
      new DatabaseIntelligenceError("timeout", "timed out")
    );

    const out = await generateDatabaseInsightsAction("en");
    expect(out).toEqual({ ok: false, error: "timeout" });
  });
});

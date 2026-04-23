/**
 * BM1-F006 · KOL profile server-action integration spec
 *
 * Contract covered:
 *   1. updateKolRelationshipStatus persists the new status via withTenant
 *   2. Writes an audit_log entry (actor / before+after) on status change
 *   3. Skips the audit entry when the status doesn't actually change
 *   4. Rejects invalid status strings at the Zod layer (no DB write)
 *   5. Rejects unauthenticated calls (no tenant context)
 *   6. not_found path fires when the KOL id is outside the tenant
 *
 * `@/auth` is mocked via `vi.mock` so the test can drive session state
 * per-case. The module resolves AFTER setupTestDb() rewires DATABASE_URL
 * so the action picks up the Testcontainers DB singleton.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const mockAuth = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

type UpdateKolRelationshipStatus = typeof import(
  "@/app/[locale]/(app)/kols/[id]/actions"
).updateKolRelationshipStatus;

let updateKolRelationshipStatus: UpdateKolRelationshipStatus;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const ACTOR_ID = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  await setupTestDb();
  ({ updateKolRelationshipStatus } = await import(
    "@/app/[locale]/(app)/kols/[id]/actions"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "audit_log"`);
  mockAuth.mockReset();
});

interface SeedOpts {
  tenantId?: string;
  relationshipStatus?: string;
}

async function seedKol(opts: SeedOpts = {}) {
  const admin = getAdminPrisma();
  const tenantId = opts.tenantId ?? TENANT_A;
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `Profile Tenant ${tenantId.slice(0, 4)}`,
      slug: `profile-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
  const kol = await admin.kol.create({
    data: {
      tenantId,
      platform: "youtube",
      handle: `handle_${Math.random().toString(36).slice(2, 8)}`,
      displayName: "Profile Kol",
      countryCode: "US",
      followerCount: 10_000,
      categories: ["MOBA"],
      isGaming: true,
      valueScore: 70,
      relationshipStatus: opts.relationshipStatus ?? "prospect",
    },
  });
  return { tenantId, kol };
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

function sessionFor(tenantId: string, userId = ACTOR_ID) {
  return { user: { id: userId, tenantId } };
}

describe("updateKolRelationshipStatus()", () => {
  it("persists a valid status change and writes an audit entry", async () => {
    const { tenantId, kol } = await seedKol({
      relationshipStatus: "prospect",
    });
    mockAuth.mockResolvedValue(sessionFor(tenantId));

    const res = await updateKolRelationshipStatus(
      { ok: false },
      form({ kolId: kol.id, status: "negotiating" })
    );
    expect(res.ok).toBe(true);
    expect(res.status).toBe("negotiating");

    const admin = getAdminPrisma();
    const updated = await admin.kol.findUniqueOrThrow({ where: { id: kol.id } });
    expect(updated.relationshipStatus).toBe("negotiating");

    const audits = await admin.auditLog.findMany({
      where: { resourceId: kol.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.action).toBe("kol.relationship_changed");
    expect(audits[0]!.actorUserId).toBe(ACTOR_ID);
    expect(audits[0]!.payload).toMatchObject({
      before: { relationshipStatus: "prospect" },
      after: { relationshipStatus: "negotiating" },
    });
  });

  it("skips the audit entry when the status value is unchanged", async () => {
    const { tenantId, kol } = await seedKol({
      relationshipStatus: "negotiating",
    });
    mockAuth.mockResolvedValue(sessionFor(tenantId));

    const res = await updateKolRelationshipStatus(
      { ok: false },
      form({ kolId: kol.id, status: "negotiating" })
    );
    expect(res.ok).toBe(true);

    const audits = await getAdminPrisma().auditLog.findMany({
      where: { resourceId: kol.id },
    });
    expect(audits).toHaveLength(0);
  });

  it("rejects an unknown status string with invalid_input", async () => {
    const { tenantId, kol } = await seedKol();
    mockAuth.mockResolvedValue(sessionFor(tenantId));

    const res = await updateKolRelationshipStatus(
      { ok: false },
      form({ kolId: kol.id, status: "ghost_status" })
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid_input");

    const existing = await getAdminPrisma().kol.findUniqueOrThrow({
      where: { id: kol.id },
    });
    expect(existing.relationshipStatus).toBe("prospect");
  });

  it("returns unauthorized without a session", async () => {
    const { kol } = await seedKol();
    mockAuth.mockResolvedValue(null);

    const res = await updateKolRelationshipStatus(
      { ok: false },
      form({ kolId: kol.id, status: "paused" })
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("unauthorized");
  });

  it("returns not_found when the KOL belongs to another tenant", async () => {
    const { kol: otherTenantKol } = await seedKol({
      tenantId: TENANT_B,
      relationshipStatus: "prospect",
    });
    await seedKol({ tenantId: TENANT_A });
    mockAuth.mockResolvedValue(sessionFor(TENANT_A));

    const res = await updateKolRelationshipStatus(
      { ok: false },
      form({ kolId: otherTenantKol.id, status: "paused" })
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("not_found");

    const admin = getAdminPrisma();
    const untouched = await admin.kol.findUniqueOrThrow({
      where: { id: otherTenantKol.id },
    });
    expect(untouched.relationshipStatus).toBe("prospect");
  });

  it("rejects a non-UUID kolId at the Zod layer", async () => {
    mockAuth.mockResolvedValue(sessionFor(TENANT_A));
    const res = await updateKolRelationshipStatus(
      { ok: false },
      form({ kolId: "not-a-uuid", status: "negotiating" })
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid_input");
  });
});

/**
 * B7b-F002 · /campaigns/:id AI suggestions action integration spec.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanDb,
  getAdminPrisma,
  setupTestDb,
  teardownTestDb,
} from "../helpers/db";

const mockAuth = vi.fn();
const mockGenerateCampaignSuggestions = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

vi.mock("@/lib/campaigns/suggestions", async () => {
  const actual = await vi.importActual<typeof import("@/lib/campaigns/suggestions")>(
    "@/lib/campaigns/suggestions"
  );
  return {
    ...actual,
    generateCampaignSuggestions: (...args: unknown[]) =>
      mockGenerateCampaignSuggestions(...args),
  };
});

type ActionFn = typeof import(
  "@/app/[locale]/(app)/campaigns/[id]/ai-suggestions-actions"
).generateCampaignSuggestionsAction;

let generateCampaignSuggestionsAction: ActionFn;

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const OWNER_A = "33333333-3333-3333-3333-333333333333";

beforeAll(async () => {
  await setupTestDb();
  ({ generateCampaignSuggestionsAction } = await import(
    "@/app/[locale]/(app)/campaigns/[id]/ai-suggestions-actions"
  ));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  await getAdminPrisma().$executeRawUnsafe(`TRUNCATE TABLE "event_log"`);
  mockAuth.mockReset();
  mockGenerateCampaignSuggestions.mockReset();
});

function sessionFor(tenantId: string) {
  return { user: { id: OWNER_A, tenantId } };
}

async function seedTenant(tenantId: string) {
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: `C-${tenantId.slice(0, 4)}`,
      slug: `c-${tenantId.slice(0, 8)}`,
    },
    update: {},
  });
}

async function seedCampaign(tenantId: string, campaignId: string) {
  const admin = getAdminPrisma();
  await admin.user.upsert({
    where: { id: OWNER_A },
    create: {
      id: OWNER_A,
      tenantId,
      email: `owner-${tenantId.slice(0, 4)}@test.local`,
      name: "Owner",
    },
    update: {},
  });

  const product = await admin.product.create({
    data: {
      tenantId,
      name: "Nova Arena",
      category: "MOBA",
      uniqueSellingPoints: "Fast rounds",
    },
  });

  const campaign = await admin.campaign.create({
    data: {
      id: campaignId,
      tenantId,
      name: "Spring Launch",
      ownerUserId: OWNER_A,
      status: "active",
      budgetAmount: "10000.00",
      spendTotal: "2500.00",
      revenueRecorded: "4300.00",
      productId: product.id,
    },
  });

  const kol1 = await admin.kol.create({
    data: {
      tenantId,
      platform: "youtube",
      handle: `k_${Math.random().toString(36).slice(2, 8)}`,
      displayName: "K1",
      followerCount: 1000,
      categories: ["MOBA"],
    },
  });
  const kol2 = await admin.kol.create({
    data: {
      tenantId,
      platform: "youtube",
      handle: `k_${Math.random().toString(36).slice(2, 8)}`,
      displayName: "K2",
      followerCount: 2000,
      categories: ["FPS"],
    },
  });

  await admin.kolCampaign.createMany({
    data: [
      { tenantId, campaignId: campaign.id, kolId: kol1.id, status: "pending" },
      { tenantId, campaignId: campaign.id, kolId: kol2.id, status: "contacted" },
    ],
  });

  await admin.auditLog.create({
    data: {
      tenantId,
      actorUserId: OWNER_A,
      action: "campaign.kol_added",
      resourceType: "campaign",
      resourceId: campaign.id,
      payload: {},
    },
  });

  return campaign.id;
}

describe("generateCampaignSuggestionsAction", () => {
  it("returns unauthorized without session", async () => {
    mockAuth.mockResolvedValue(null);
    const out = await generateCampaignSuggestionsAction("cid", "en");
    expect(out).toEqual({ ok: false, error: "unauthorized" });
  });

  it("aggregates payload and returns 3 suggestions", async () => {
    await seedTenant(TENANT_A);
    await seedTenant(TENANT_B);
    const campaignId = await seedCampaign(TENANT_A, "55555555-5555-4555-8555-555555555555");

    mockAuth.mockResolvedValue(sessionFor(TENANT_A));
    mockGenerateCampaignSuggestions.mockResolvedValue({
      suggestions: [
        { priority: "high", title: "A", description: "A", action_link: "/outreach", action_label: "Open" },
        { priority: "medium", title: "B", description: "B", action_link: "/campaigns", action_label: "Open" },
        { priority: "low", title: "C", description: "C", action_link: "/roi", action_label: "Open" },
      ],
      traceId: "trace-c1",
    });

    const out = await generateCampaignSuggestionsAction(campaignId, "en");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.suggestions).toHaveLength(3);
      expect(out.traceId).toBe("trace-c1");
    }

    const arg = mockGenerateCampaignSuggestions.mock.calls[0]?.[0] as {
      locale: string;
      campaignMetaJson: string;
      kolPipelineJson: string;
      recentActivityJson: string;
      productContextJson: string;
    };

    expect(arg.locale).toBe("en");
    const meta = JSON.parse(arg.campaignMetaJson);
    expect(meta.name).toBe("Spring Launch");
    const pipeline = JSON.parse(arg.kolPipelineJson);
    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "pending", count: 1 }),
        expect.objectContaining({ status: "contacted", count: 1 }),
      ])
    );
    const product = JSON.parse(arg.productContextJson);
    expect(product.name).toBe("Nova Arena");
  });

  it("maps campaign suggest errors", async () => {
    await seedTenant(TENANT_A);
    const campaignId = await seedCampaign(TENANT_A, "66666666-6666-4666-8666-666666666666");

    mockAuth.mockResolvedValue(sessionFor(TENANT_A));
    const { CampaignSuggestError } = await import("@/lib/campaigns/suggestions");
    mockGenerateCampaignSuggestions.mockRejectedValue(
      new CampaignSuggestError("timeout", "timed out")
    );

    const out = await generateCampaignSuggestionsAction(campaignId, "en");
    expect(out).toEqual({ ok: false, error: "timeout" });
  });
});

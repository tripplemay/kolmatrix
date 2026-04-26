/**
 * MVP-vf-F004 · Multi-dim filter composition for /campaigns list.
 *
 * Complements the F003 single-dim coverage in `campaigns-list.test.ts`
 * by exercising the new hotfix dims (multi-status, game, region, date
 * range) and combinations thereof.
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

type RunCampaignListSearch = typeof import("@/lib/campaigns/search").runCampaignListSearch;
type CampaignListFilters = import("@/lib/campaigns/filters").CampaignListFilters;
type LoadKnownGames = typeof import("@/lib/campaigns/list-kpis").loadKnownGames;

let runCampaignListSearch: RunCampaignListSearch;
let loadKnownGames: LoadKnownGames;

const DEFAULT_FILTERS: CampaignListFilters = {
  statuses: [],
  games: [],
  regions: [],
  ownerIds: [],
};

beforeAll(async () => {
  await setupTestDb();
  ({ runCampaignListSearch } = await import("@/lib/campaigns/search"));
  ({ loadKnownGames } = await import("@/lib/campaigns/list-kpis"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
});

interface SeedRow {
  status: "draft" | "active" | "completed";
  game?: string | null;
  markets?: string[];
  startDate?: Date;
  name?: string;
}

async function seedCampaigns(rows: SeedRow[]): Promise<string> {
  const admin = getAdminPrisma();
  const slug = `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tenant = await admin.tenant.create({
    data: { name: `Combo Tenant ${slug}`, slug },
  });
  const owner = await admin.user.create({
    data: {
      tenantId: tenant.id,
      email: `owner-${slug}@test.local`,
      name: "Combo Owner",
    },
  });
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]!;
    await admin.campaign.create({
      data: {
        tenantId: tenant.id,
        name: r.name ?? `Campaign ${i}`,
        ownerUserId: owner.id,
        status: r.status,
        game: r.game ?? null,
        markets: r.markets ?? [],
        startDate: r.startDate ?? null,
        spendTotal: "0",
        createdAt: new Date(2026, 0, 1, 0, 0, i),
      },
    });
  }
  return tenant.id;
}

describe("/campaigns list multi-dim filter composition", () => {
  it("multi-status chip selection narrows to the union", async () => {
    const tenantId = await seedCampaigns([
      { status: "draft" },
      { status: "active" },
      { status: "completed" },
      { status: "active" },
    ]);
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      statuses: ["active", "completed"],
    });
    expect(res.items).toHaveLength(3);
    expect(res.items.every((r) => r.status !== "draft")).toBe(true);
  });

  it("game filter matches Campaign.game", async () => {
    const tenantId = await seedCampaigns([
      { status: "active", game: "Cyber-Odyssey" },
      { status: "active", game: "Nebula" },
      { status: "draft", game: "Cyber-Odyssey" },
    ]);
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      games: ["Cyber-Odyssey"],
    });
    expect(res.items).toHaveLength(2);
  });

  it("region filter matches Campaign.markets[] hasSome", async () => {
    const tenantId = await seedCampaigns([
      { status: "active", markets: ["US", "JP"] },
      { status: "active", markets: ["KR"] },
      { status: "active", markets: [] },
    ]);
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      regions: ["JP"],
    });
    expect(res.items).toHaveLength(1);
  });

  it("date range filter on startDate (inclusive bounds)", async () => {
    const tenantId = await seedCampaigns([
      { status: "active", startDate: new Date("2026-04-01") },
      { status: "active", startDate: new Date("2026-04-15") },
      { status: "active", startDate: new Date("2026-05-01") },
    ]);
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });
    expect(res.items).toHaveLength(2);
  });

  it("composes status + game + region + date together", async () => {
    const tenantId = await seedCampaigns([
      {
        status: "active",
        game: "Cyber-Odyssey",
        markets: ["US"],
        startDate: new Date("2026-04-10"),
        name: "match",
      },
      {
        status: "active",
        game: "Cyber-Odyssey",
        markets: ["JP"],
        startDate: new Date("2026-04-10"),
        name: "wrong-region",
      },
      {
        status: "draft",
        game: "Cyber-Odyssey",
        markets: ["US"],
        startDate: new Date("2026-04-10"),
        name: "wrong-status",
      },
      {
        status: "active",
        game: "Nebula",
        markets: ["US"],
        startDate: new Date("2026-04-10"),
        name: "wrong-game",
      },
      {
        status: "active",
        game: "Cyber-Odyssey",
        markets: ["US"],
        startDate: new Date("2026-05-10"),
        name: "wrong-date",
      },
    ]);
    const res = await runCampaignListSearch(tenantId, {
      ...DEFAULT_FILTERS,
      statuses: ["active"],
      games: ["Cyber-Odyssey"],
      regions: ["US"],
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0]!.name).toBe("match");
  });

  it("loadKnownGames returns distinct non-null games sorted ascending", async () => {
    const tenantId = await seedCampaigns([
      { status: "active", game: "Nebula" },
      { status: "active", game: "Cyber-Odyssey" },
      { status: "draft", game: "Cyber-Odyssey" },
      { status: "draft", game: null },
    ]);
    const games = await loadKnownGames(tenantId);
    expect(games).toEqual(["Cyber-Odyssey", "Nebula"]);
  });
});

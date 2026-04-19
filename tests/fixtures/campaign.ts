/**
 * Campaign factory.
 *
 * Field semantics:
 *   - tenantId       FK → tenant.id. Override required for DB inserts.
 *   - name           Campaign display name.
 *   - game           Optional game / IP tag (e.g. "Honor of Kings").
 *   - markets        String[] of ISO country codes targeted.
 *   - status         "draft" (default) | "active" | "paused" | "closed".
 *   - budgetAmount   Decimal(12,2) in USD-equivalent.
 *   - budgetCurrency Default "USD".
 *   - kpiTarget      JSONB; mirrors seed.ts shape { impressions, ctr, cvr }.
 *   - startDate/endDate Optional ISO dates; default a 30-day window
 *                      starting ~1 week from now.
 *   - ownerUserId    FK → user.id. Override required for DB inserts.
 *
 * Example:
 *   await adminPrisma.campaign.create({
 *     data: makeCampaign({ tenantId: tenant.id, ownerUserId: user.id }),
 *   });
 */
import { faker } from "@faker-js/faker";

const GAMES = [
  "Honor of Kings",
  "Genshin Impact",
  "PUBG Mobile",
  "Valorant",
  "League of Legends",
] as const;
const MARKET_POOL = ["US", "JP", "KR", "CN", "BR", "DE", "GB", "ES"] as const;
const STATUSES = ["draft", "active", "paused", "closed"] as const;

type KpiTarget = { impressions: number; ctr: number; cvr: number };

export type CampaignFixture = {
  id?: string;
  tenantId: string;
  name: string;
  game: string | null;
  markets: string[];
  status: string;
  budgetAmount: number;
  budgetCurrency: string;
  kpiTarget: KpiTarget;
  startDate: Date;
  endDate: Date;
  ownerUserId: string;
};

export function makeCampaign(overrides: Partial<CampaignFixture> = {}): CampaignFixture {
  const start = faker.date.soon({ days: 14 });
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  const game = faker.helpers.arrayElement(GAMES);

  return {
    tenantId: faker.string.uuid(),
    name: `${game} — ${faker.company.buzzNoun()} Push`,
    game,
    markets: faker.helpers.arrayElements(MARKET_POOL, { min: 1, max: 3 }),
    status: faker.helpers.arrayElement(STATUSES),
    budgetAmount: Number(faker.number.float({ min: 5_000, max: 250_000, fractionDigits: 2 })),
    budgetCurrency: "USD",
    kpiTarget: {
      impressions: faker.number.int({ min: 100_000, max: 10_000_000 }),
      ctr: Number(faker.number.float({ min: 0.01, max: 0.1, fractionDigits: 3 })),
      cvr: Number(faker.number.float({ min: 0.005, max: 0.05, fractionDigits: 3 })),
    },
    startDate: start,
    endDate: end,
    ownerUserId: faker.string.uuid(),
    ...overrides,
  };
}

/**
 * KOL factory.
 *
 * Field semantics:
 *   - tenantId          FK → tenant.id. Override required for DB inserts.
 *   - platform          One of "youtube" | "tiktok" | "twitch" |
 *                       "instagram" (matches seed.ts enum values).
 *   - handle            Creator username. UNIQUE per (tenantId, platform)
 *                       — default is suffix-random so parallel tests
 *                       never collide.
 *   - displayName       Human-friendly label.
 *   - countryCode       ISO-3166 two-letter code (uppercase).
 *   - language          ISO-639 two-letter code (lowercase).
 *   - followerCount     >= 0 integer. Random 10k–5M range.
 *   - engagementRate    Decimal(5,2), percent. Random 0.80–7.50 range
 *                       mirroring real KOL distributions.
 *   - avgViews          Approx 5–30 % of followerCount.
 *   - categories        String[] — topical tags.
 *   - aiScore           0–100. Random 40–95 to stay in plausible band.
 *   - audience{Age,Geo,Gender}Dist
 *                       JSONB key→percentage maps, summing to ~1.0.
 *   - status            "active" (default) | "paused" | "flagged".
 */
import { faker } from "@faker-js/faker";

const PLATFORMS = ["youtube", "tiktok", "twitch", "instagram"] as const;
const CATEGORY_POOL = [
  "gaming",
  "mobile_gaming",
  "fps",
  "moba",
  "rpg",
  "sandbox",
  "speedrun",
  "esports",
  "streaming",
] as const;
const LANGS = ["en", "zh", "ja", "ko", "es"] as const;
const COUNTRIES = ["US", "JP", "KR", "CN", "BR", "DE", "GB", "ES"] as const;

type Json = Record<string, number>;

function makeAgeDist(): Json {
  return {
    "13-17": 0.12,
    "18-24": 0.38,
    "25-34": 0.3,
    "35-44": 0.14,
    "45+": 0.06,
  };
}

function makeGeoDist(home: string): Json {
  return {
    [home]: 0.55,
    US: 0.15,
    JP: 0.1,
    KR: 0.08,
    OTHER: 0.12,
  };
}

function makeGenderDist(): Json {
  return { male: 0.62, female: 0.34, other: 0.04 };
}

export type KolFixture = {
  id?: string;
  tenantId: string;
  platform: string;
  handle: string;
  displayName: string;
  countryCode: string;
  language: string;
  followerCount: number;
  engagementRate: number;
  avgViews: number;
  categories: string[];
  aiScore: number;
  audienceAgeDist: Json;
  audienceGeoDist: Json;
  audienceGenderDist: Json;
  status: string;
};

export function makeKol(overrides: Partial<KolFixture> = {}): KolFixture {
  const platform = faker.helpers.arrayElement(PLATFORMS);
  const handle = `${faker.internet.username().toLowerCase()}_${faker.string.alphanumeric(6).toLowerCase()}`;
  const displayName = faker.person.fullName();
  const countryCode = faker.helpers.arrayElement(COUNTRIES);
  const followerCount = faker.number.int({ min: 10_000, max: 5_000_000 });
  const engagementRate = Number(faker.number.float({ min: 0.8, max: 7.5, fractionDigits: 2 }));
  const avgViews = Math.round(followerCount * faker.number.float({ min: 0.05, max: 0.3 }));

  return {
    tenantId: faker.string.uuid(),
    platform,
    handle,
    displayName,
    countryCode,
    language: faker.helpers.arrayElement(LANGS),
    followerCount,
    engagementRate,
    avgViews,
    categories: faker.helpers.arrayElements(CATEGORY_POOL, { min: 1, max: 3 }),
    aiScore: faker.number.int({ min: 40, max: 95 }),
    audienceAgeDist: makeAgeDist(),
    audienceGeoDist: makeGeoDist(countryCode),
    audienceGenderDist: makeGenderDist(),
    status: "active",
    ...overrides,
  };
}

/**
 * KOLMatrix — B0 seed
 *
 * Populates a single demo tenant with the minimum data required by the
 * Dashboard (F007) and KOL-related batches:
 *   - 1 tenant (Demo Studio)
 *   - 2 users (tenant_admin + marketer "Sarah Chen")
 *   - 12 KOLs (mixed platforms, Stitch-inspired)
 *   - 3 campaigns (Honor of Kings / Genshin Impact / PUBG Mobile)
 *   - 4 outreach/followup/accept/decline email templates
 *
 * Re-running the seed is idempotent via `upsert` on natural keys.
 * Password for both seeded users: KOLM@2026!
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// Seed bootstraps the first tenant, so it needs to write before any
// tenant context exists. Use the admin URL (superuser) so RLS is bypassed.
const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_ADMIN_URL (or DATABASE_URL fallback) must be set to run the seed");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type KolSeed = {
  handle: string;
  displayName: string;
  platform: "youtube" | "tiktok" | "twitch" | "instagram";
  countryCode: string;
  language: string;
  followerCount: number;
  engagementRate: number;
  avgViews: number;
  categories: string[];
  aiScore: number;
  audienceGeo: Record<string, number>;
  audienceAge: Record<string, number>;
  audienceGender: Record<string, number>;
};

const KOLS: KolSeed[] = [
  {
    handle: "gamerxia",
    displayName: "GamerXia",
    platform: "youtube",
    countryCode: "US",
    language: "en",
    followerCount: 2_300_000,
    engagementRate: 5.8,
    avgViews: 480_000,
    categories: ["FPS", "MOBA", "Tournament"],
    aiScore: 96,
    audienceGeo: { US: 42, UK: 14, CA: 9, AU: 7, Other: 28 },
    audienceAge: { "18-24": 38, "25-34": 41, "35-44": 15, "45+": 6 },
    audienceGender: { male: 71, female: 27, non_binary: 2 },
  },
  {
    handle: "sakurayt",
    displayName: "SakuraYT",
    platform: "youtube",
    countryCode: "JP",
    language: "ja",
    followerCount: 847_000,
    engagementRate: 8.2,
    avgViews: 190_000,
    categories: ["RPG", "Anime", "Storytelling"],
    aiScore: 93,
    audienceGeo: { JP: 58, KR: 14, TW: 10, US: 9, Other: 9 },
    audienceAge: { "13-17": 9, "18-24": 46, "25-34": 35, "35+": 10 },
    audienceGender: { male: 38, female: 60, non_binary: 2 },
  },
  {
    handle: "neonhaze",
    displayName: "NeonHaze",
    platform: "tiktok",
    countryCode: "US",
    language: "en",
    followerCount: 1_640_000,
    engagementRate: 11.4,
    avgViews: 280_000,
    categories: ["Mobile", "Short-form", "Casual"],
    aiScore: 91,
    audienceGeo: { US: 48, BR: 12, MX: 8, PH: 7, Other: 25 },
    audienceAge: { "13-17": 24, "18-24": 52, "25-34": 20, "35+": 4 },
    audienceGender: { male: 49, female: 48, non_binary: 3 },
  },
  {
    handle: "kaibytes",
    displayName: "KaiBytes",
    platform: "twitch",
    countryCode: "DE",
    language: "en",
    followerCount: 512_000,
    engagementRate: 14.8,
    avgViews: 48_000,
    categories: ["FPS", "Speedrun", "Competitive"],
    aiScore: 89,
    audienceGeo: { DE: 32, UK: 18, US: 16, FR: 9, Other: 25 },
    audienceAge: { "18-24": 44, "25-34": 40, "35-44": 12, "45+": 4 },
    audienceGender: { male: 82, female: 16, non_binary: 2 },
  },
  {
    handle: "mei.plays",
    displayName: "Mei Plays",
    platform: "youtube",
    countryCode: "TW",
    language: "zh",
    followerCount: 1_120_000,
    engagementRate: 7.6,
    avgViews: 220_000,
    categories: ["MOBA", "Mobile", "Tournament"],
    aiScore: 92,
    audienceGeo: { TW: 41, HK: 14, SG: 12, MY: 10, CN: 10, Other: 13 },
    audienceAge: { "18-24": 35, "25-34": 44, "35+": 21 },
    audienceGender: { male: 64, female: 34, non_binary: 2 },
  },
  {
    handle: "ryo.arcade",
    displayName: "Ryo Arcade",
    platform: "youtube",
    countryCode: "JP",
    language: "ja",
    followerCount: 392_000,
    engagementRate: 9.1,
    avgViews: 92_000,
    categories: ["Fighting", "Retro", "Competitive"],
    aiScore: 88,
    audienceGeo: { JP: 62, US: 14, KR: 9, Other: 15 },
    audienceAge: { "18-24": 28, "25-34": 47, "35-44": 19, "45+": 6 },
    audienceGender: { male: 78, female: 20, non_binary: 2 },
  },
  {
    handle: "aisha.streams",
    displayName: "Aisha Streams",
    platform: "twitch",
    countryCode: "AE",
    language: "ar",
    followerCount: 264_000,
    engagementRate: 12.2,
    avgViews: 32_000,
    categories: ["MMO", "RPG", "Community"],
    aiScore: 85,
    audienceGeo: { AE: 28, SA: 22, EG: 15, KW: 9, Other: 26 },
    audienceAge: { "18-24": 41, "25-34": 42, "35+": 17 },
    audienceGender: { male: 58, female: 40, non_binary: 2 },
  },
  {
    handle: "pixelpao",
    displayName: "PixelPao",
    platform: "tiktok",
    countryCode: "BR",
    language: "pt",
    followerCount: 1_910_000,
    engagementRate: 10.9,
    avgViews: 310_000,
    categories: ["Mobile", "Casual", "Comedy"],
    aiScore: 87,
    audienceGeo: { BR: 64, PT: 9, MX: 7, Other: 20 },
    audienceAge: { "13-17": 18, "18-24": 48, "25-34": 26, "35+": 8 },
    audienceGender: { male: 42, female: 54, non_binary: 4 },
  },
  {
    handle: "lumenarc",
    displayName: "LumenArc",
    platform: "youtube",
    countryCode: "CA",
    language: "en",
    followerCount: 735_000,
    engagementRate: 6.4,
    avgViews: 160_000,
    categories: ["RPG", "Story", "Review"],
    aiScore: 90,
    audienceGeo: { CA: 22, US: 41, UK: 12, AU: 8, Other: 17 },
    audienceAge: { "18-24": 30, "25-34": 46, "35-44": 18, "45+": 6 },
    audienceGender: { male: 66, female: 32, non_binary: 2 },
  },
  {
    handle: "janelytics",
    displayName: "Janelytics",
    platform: "instagram",
    countryCode: "KR",
    language: "ko",
    followerCount: 418_000,
    engagementRate: 7.9,
    avgViews: 68_000,
    categories: ["Lifestyle-Gaming", "Cosplay"],
    aiScore: 84,
    audienceGeo: { KR: 48, JP: 14, US: 12, TW: 8, Other: 18 },
    audienceAge: { "18-24": 52, "25-34": 38, "35+": 10 },
    audienceGender: { male: 32, female: 64, non_binary: 4 },
  },
  {
    handle: "forgefalcon",
    displayName: "ForgeFalcon",
    platform: "twitch",
    countryCode: "UK",
    language: "en",
    followerCount: 196_000,
    engagementRate: 15.6,
    avgViews: 24_000,
    categories: ["Strategy", "Indie", "Community"],
    aiScore: 83,
    audienceGeo: { UK: 38, US: 24, DE: 10, Other: 28 },
    audienceAge: { "25-34": 48, "35-44": 32, "45+": 14, "18-24": 6 },
    audienceGender: { male: 75, female: 22, non_binary: 3 },
  },
  {
    handle: "zeralite",
    displayName: "Zeralite",
    platform: "youtube",
    countryCode: "US",
    language: "en",
    followerCount: 1_050_000,
    engagementRate: 5.2,
    avgViews: 210_000,
    categories: ["FPS", "Battle-Royale", "Highlights"],
    aiScore: 94,
    audienceGeo: { US: 51, MX: 9, CA: 8, BR: 6, Other: 26 },
    audienceAge: { "13-17": 12, "18-24": 44, "25-34": 32, "35+": 12 },
    audienceGender: { male: 77, female: 21, non_binary: 2 },
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("KOLM@2026!", 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Studio", slug: "demo", plan: "pro" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@kolmatrix.local" },
    update: { hashedPassword: passwordHash },
    create: {
      tenantId: tenant.id,
      email: "admin@kolmatrix.local",
      hashedPassword: passwordHash,
      name: "Admin",
      role: "tenant_admin",
      locale: "en",
    },
  });

  const marketer = await prisma.user.upsert({
    where: { email: "marketer@kolmatrix.local" },
    update: { hashedPassword: passwordHash },
    create: {
      tenantId: tenant.id,
      email: "marketer@kolmatrix.local",
      hashedPassword: passwordHash,
      name: "Sarah Chen",
      role: "marketer",
      locale: "en",
    },
  });

  for (const kol of KOLS) {
    await prisma.kol.upsert({
      where: {
        tenantId_platform_handle: {
          tenantId: tenant.id,
          platform: kol.platform,
          handle: kol.handle,
        },
      },
      update: {
        displayName: kol.displayName,
        followerCount: kol.followerCount,
        aiScore: kol.aiScore,
      },
      create: {
        tenantId: tenant.id,
        platform: kol.platform,
        handle: kol.handle,
        displayName: kol.displayName,
        countryCode: kol.countryCode,
        language: kol.language,
        followerCount: kol.followerCount,
        engagementRate: kol.engagementRate,
        avgViews: kol.avgViews,
        categories: kol.categories,
        audienceAgeDist: kol.audienceAge,
        audienceGeoDist: kol.audienceGeo,
        audienceGenderDist: kol.audienceGender,
        aiScore: kol.aiScore,
        aiScoreBreakdown: {
          brand_safety: Math.min(100, kol.aiScore + 2),
          audience_quality: kol.aiScore - 1,
          content_fit: kol.aiScore - 3,
          momentum: kol.aiScore - 5,
        },
        aiEvaluatedAt: new Date(),
        status: "active",
      },
    });
  }

  const campaignSeeds = [
    {
      name: "Honor of Kings — Global Launch",
      game: "Honor of Kings",
      markets: ["US", "JP", "KR"],
      status: "active",
      budgetAmount: 120_000,
      budgetCurrency: "USD",
      kpiTarget: { reach: 5_000_000, conversion_rate: 0.05 },
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-06-30"),
      openRate: 0.428,
    },
    {
      name: "Genshin Impact — Winter Event",
      game: "Genshin Impact",
      markets: ["GLOBAL"],
      status: "active",
      budgetAmount: 85_000,
      budgetCurrency: "USD",
      kpiTarget: { reach: 3_200_000, conversion_rate: 0.06 },
      startDate: new Date("2026-03-15"),
      endDate: new Date("2026-05-15"),
      openRate: 0.382,
    },
    {
      name: "PUBG Mobile — Season 30",
      game: "PUBG Mobile",
      markets: ["SEA"],
      status: "completed",
      budgetAmount: 42_000,
      budgetCurrency: "USD",
      kpiTarget: { reach: 1_800_000, conversion_rate: 0.04 },
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-01"),
      openRate: 0.514,
    },
  ];

  const campaignIdByName = new Map<string, string>();
  for (const campaign of campaignSeeds) {
    const existing = await prisma.campaign.findFirst({
      where: { tenantId: tenant.id, name: campaign.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.campaign.update({
        where: { id: existing.id },
        data: { status: campaign.status, openRate: campaign.openRate },
      });
      campaignIdByName.set(campaign.name, existing.id);
    } else {
      const created = await prisma.campaign.create({
        data: { tenantId: tenant.id, ownerUserId: marketer.id, ...campaign },
      });
      campaignIdByName.set(campaign.name, created.id);
    }
  }

  // BM2-F001: email_template table was rebuilt (DROP + CREATE) with a
  // new shape (tenantId nullable → system/user split, single `body`
  // column, `type` column instead of `category`). The B0 tenant-scoped
  // seed rows that used to live here are superseded by the dedicated
  // BM2-F002 seed (scripts/seed-email-templates.ts) that plants 10
  // system templates (5 × en/zh). Nothing to seed from this script.
  const seededTemplateCount = 0;

  // ----- Email logs (F007 Dashboard KPI + chart) -----
  // Idempotent: clear prior seeded logs for this tenant before repopulating so
  // re-running the seed does not inflate counts.
  await prisma.emailLog.deleteMany({ where: { tenantId: tenant.id } });

  const kolRows = await prisma.kol.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, handle: true },
  });
  const campaignEntries = Array.from(campaignIdByName.entries());
  const EMAIL_LOG_COUNT = 300;
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const emailRows = Array.from({ length: EMAIL_LOG_COUNT }).map((_, i) => {
    const [campaignName, campaignId] = campaignEntries[i % campaignEntries.length];
    const kol = kolRows[i % kolRows.length];
    const sentAt = new Date(nowMs - Math.random() * sevenDaysMs);
    // Realistic funnel: ~5% bounce, 60% opened, 20% replied, rest sent-only.
    const roll = Math.random();
    const bounced = roll < 0.05;
    const opened = !bounced && roll < 0.65;
    const replied = opened && Math.random() < 0.33;
    const status = bounced ? "bounced" : replied ? "replied" : opened ? "opened" : "sent";
    const openedAt = opened ? new Date(sentAt.getTime() + Math.random() * 6 * 3600_000) : null;
    const repliedAt =
      replied && openedAt ? new Date(openedAt.getTime() + Math.random() * 24 * 3600_000) : null;
    return {
      tenantId: tenant.id,
      campaignId,
      kolId: kol.id,
      toAddress: `${kol.handle}@demo.kolmatrix`,
      fromAddress: "outreach@kolmatrix.local",
      subject: `Partner with ${campaignName} — exclusive early access`,
      bodyHtml: "<p>seed-generated outreach</p>",
      provider: "resend",
      status,
      sentAt,
      deliveredAt: bounced ? null : sentAt,
      openedAt,
      repliedAt,
      bounceReason: bounced ? "mailbox_full" : null,
    };
  });
  await prisma.emailLog.createMany({ data: emailRows });

  console.log("Seed complete:", {
    tenant: tenant.slug,
    users: [admin.email, marketer.email],
    kols: KOLS.length,
    campaigns: campaignSeeds.length,
    templates: seededTemplateCount,
    emailLogs: EMAIL_LOG_COUNT,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

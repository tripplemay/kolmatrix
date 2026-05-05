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
 * Password for both seeded users: SEED_ADMIN_PASSWORD env (default "KOLMatrix@2026!").
 * BL-035-F001 (AUTH-H2) raised the minimum login length to 12 — the
 * legacy "KOLM@2026!" (10 chars) no longer passes the credentials
 * schema, so the seed default is now "KOLMatrix@2026!" (15 chars).
 *   - Local dev: leave unset, default applies + console.warn.
 *   - Prod: NODE_ENV=production hard-throws below; do NOT seed prod.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

import { seedSystemTemplates } from "../scripts/seed-email-templates";

// BL-034 F002: hard guard against accidental prod seed. Demo accounts use a
// well-known password — running this against prod would create
// admin@kolmatrix.local / marketer@kolmatrix.local with that password
// instantly. If you really need to seed prod, override NODE_ENV at the
// command line (and accept the consequences).
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "[seed] Forbidden in production. Seed creates demo accounts with known passwords. " +
      "If you really need to seed prod, set NODE_ENV=development on the seed command line.",
  );
}

// BL-034 F002: allow overriding the demo password via env var so local dev
// teams that share a database can keep credentials out of git/history.
// BL-035-F001 (AUTH-H2): default raised to 15 chars to clear the new
// 12-char minimum imposed by the credentials schema. The literal
// "KOLM@2026!" (10 chars) used previously now fails login.
const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "KOLMatrix@2026!";
if (!process.env.SEED_ADMIN_PASSWORD) {
  console.warn(
    "[seed] Using default password 'KOLMatrix@2026!' (no SEED_ADMIN_PASSWORD env). " +
      "Local dev OK, do NOT commit/share.",
  );
}

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
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

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
        // verifying-2026-05-01-fixing-1 fix C-10 round 2: backfill demo
        // emails on rerun so older seed data picks up the new field.
        email: `${kol.handle}@demo.kolmatrix.local`,
        emailSource: "demo_seed",
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
        // verifying-2026-05-01-fixing-1 fix C-10 round 2: KOLs need an
        // email so /outreach AI customize → send can be demo'd end to
        // end on the seed alone (Reviewer's reverify blocked because
        // product-linked campaigns had no email-bearing KOLs).
        email: `${kol.handle}@demo.kolmatrix.local`,
        emailSource: "demo_seed",
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
  // column, `type` column instead of `category`). System templates
  // live in scripts/seed-email-templates.ts (5 categories × en/zh =
  // 10 rows). Chain-run it from `prisma db seed` so the official
  // codex-setup.sh path produces a database where /en/outreach
  // template selector has options (BM2-F006 dependency, fix for
  // verifying-2026-04-26 BM2-F006-002).
  const templateStats = await seedSystemTemplates();
  const seededTemplateCount = templateStats.total;

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
  // BM2-F011-001: replace Date.now() + Math.random() with deterministic
  // values so two seed runs (e.g. update-visual-baselines workflow vs
  // ordinary CI) produce byte-identical email_log rows. Without this,
  // dashboard / database / outreach screenshots disagreed on page
  // height (different number of seed-driven rows + chart values),
  // making the visual-regression suite a coin-flip across runners.
  // Reference epoch: 2026-04-26T00:00:00Z (BM2 fixing-round 1 day).
  const SEED_REFERENCE_MS = Date.UTC(2026, 3, 26);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  // Linear-congruential PRNG. Numbers are the Numerical-Recipes
  // constants (Knuth's lcg). Tiny + deterministic + good enough for
  // generating funnel rolls; we don't need cryptographic quality.
  let _lcg = 0xdeadbeef;
  const rand = (): number => {
    _lcg = (Math.imul(_lcg, 1664525) + 1013904223) | 0;
    return (_lcg >>> 0) / 0x100000000;
  };
  const emailRows = Array.from({ length: EMAIL_LOG_COUNT }).map((_, i) => {
    const [campaignName, campaignId] = campaignEntries[i % campaignEntries.length];
    const kol = kolRows[i % kolRows.length];
    const sentAt = new Date(SEED_REFERENCE_MS - rand() * sevenDaysMs);
    // Realistic funnel: ~5% bounce, 60% opened, 20% replied, rest sent-only.
    const roll = rand();
    const bounced = roll < 0.05;
    const opened = !bounced && roll < 0.65;
    const replied = opened && rand() < 0.33;
    const status = bounced ? "bounced" : replied ? "replied" : opened ? "opened" : "sent";
    const openedAt = opened ? new Date(sentAt.getTime() + rand() * 6 * 3600_000) : null;
    const repliedAt =
      replied && openedAt ? new Date(openedAt.getTime() + rand() * 24 * 3600_000) : null;
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

  // ----- Demo Products (MVP-internal-demo-prep F003) -----
  // 5 seeded games: 3 with pre-generated aiAssets, 2 with null aiAssets.
  // Natural key: (tenantId, name) — findFirst + upsert pattern (no DB unique constraint).
  type ProductSeed = {
    name: string;
    category: string;
    targetAudience: string;
    uniqueSellingPoints: string;
    downloadUrl: string;
    aiAssets: unknown;
  };

  const PRODUCT_SEEDS: ProductSeed[] = [
    {
      name: "Honor of Kings",
      category: "MOBA",
      targetAudience:
        "Competitive mobile gamers aged 16–30 in Southeast Asia and China, interested in team-based MOBA gameplay and esports tournaments",
      uniqueSellingPoints:
        "Real-time 5v5 MOBA with 120Hz ultra-smooth gameplay, featuring 100+ legendary hero rosters and seasonal esports championships with $500K prize pools",
      downloadUrl: "https://www.honorofkings.com",
      aiAssets: {
        status: "ready",
        generatedAt: "2026-04-28T08:00:00.000Z",
        traceId: "seed-hok-001",
        emailTemplates: [
          {
            subject: "Join the Honor of Kings Creator Program — Exclusive Tournament Access",
            body: "Hi [Creator Name],\n\nWe've been following your content and love how you bring out the strategy in every match. We'd like to invite you to the HoK Creator Program — get early access to new hero releases, exclusive tournament invitations, and a dedicated partnership manager.\n\nInterested? Reply and we'll send you the partnership deck.\n\nBest,\n[Your Name] · KOL Partnerships · Honor of Kings",
          },
          {
            subject: "Honor of Kings Season 18 Championship — Your Audience Will Love This",
            body: "Hey [Creator Name],\n\nSeason 18 Championship is live and the prize pool just hit $500K. We're looking for top creators to cover the finals — full media credential access, exclusive backstage content, and a $2,000 creator fee.\n\nYour MOBA content consistently hits 8%+ engagement, which is exactly the energy we want representing HoK. Want in?\n\n[Your Name] · Partnerships",
          },
          {
            subject: "HoK × [Creator] Collab — Let's Lock In the Details",
            body: "Hi [Creator Name],\n\nExcited to move forward! Here's a quick recap of what we're offering:\n• 3 sponsored videos over 6 weeks\n• $3,500 total fee + in-game premium currency pack for your subscribers\n• Creative freedom: you script, we approve\n\nContract attached. Let us know if you have any questions — happy to jump on a call.\n\n[Your Name]",
          },
        ],
        videoScripts: [
          {
            title: "YouTube 60s — Hero Reveal Feature",
            script:
              "HOOK (0-5s): Cut to: clutch teamfight ace play. Caption: 'When your team says they don't need a tank.'\n\nSETUP (5-20s): 'I've been testing the new Season 18 assassin — and honestly? The mobility alone breaks the meta. Let me show you why.'\n\nDEMO (20-45s): Walkthrough of abilities, combo demonstration, matchup analysis.\n\nCTA (45-60s): 'Download link in bio — Season 18 Battle Pass gives you 3 hero trial cards instantly. Use code [CREATOR] for 20% off first recharge.'",
          },
          {
            title: "TikTok 15s — Clutch Comeback Hook",
            script:
              "0-3s: Show 1v4 situation, health bar almost empty.\n3-8s: Execute perfect ability combo, screen shake effect.\n8-12s: Victory screen. Text overlay: 'Bro said 1v4 was impossible 💀'\n12-15s: Logo + 'Download free — link in bio' card.",
          },
        ],
      },
    },
    {
      name: "Genshin Impact",
      category: "Open World RPG",
      targetAudience:
        "Anime game enthusiasts aged 15–28 globally, particularly in CN/JP/KR/NA, who enjoy open-world exploration, character collection, and gacha mechanics",
      uniqueSellingPoints:
        "Breathtaking open-world RPG with AAA-quality anime art, biweekly content updates introducing new regions and characters, cross-platform play across mobile/PC/PS5, and zero pay-to-play barrier",
      downloadUrl: "https://genshin.hoyoverse.com",
      aiAssets: {
        status: "ready",
        generatedAt: "2026-04-28T08:05:00.000Z",
        traceId: "seed-genshin-001",
        emailTemplates: [
          {
            subject: "Genshin Impact Creator Partnership — Fontaine Archon Quest Launch",
            body: "Hi [Creator Name],\n\nWith Fontaine Chapter IV dropping next patch, we're looking for creators who can bring the narrative depth of Genshin to life. Your storytelling approach and anime-focused audience are a perfect fit.\n\nWe're offering: early access 72h before launch, $4,000 creator fee, limited in-game collectibles for your subscribers.\n\nInterested in a call this week?\n\n[Your Name] · HoYoverse Creator Relations",
          },
          {
            subject: "New Character Reveal — Exclusive Preview for Your Channel",
            body: "Hey [Creator Name],\n\nWe'd like to give you exclusive first-look access to the 5-star character dropping in v5.2. Embargo lifts 48h before the patch — early content consistently drives 3-5× your average view count on Genshin videos.\n\nMaterials, kit details, and a suggested B-roll package attached. No fee for preview content; the sponsored video brief is separate if you want to pursue that.\n\n[Your Name]",
          },
          {
            subject: "Genshin × [Creator] — Finalizing the 3-Video Sponsored Series",
            body: "Hi [Creator Name],\n\nHere's our offer for the Sumeru anniversary series:\n• Video 1: Region overview (organic-first, sponsored tag)\n• Video 2: Character tier list (sponsored)\n• Video 3: Endgame guide (sponsored)\n• Total fee: $9,000 over 5 weeks\n• Subscriber benefit: 10-day Primogem code exclusive\n\nLet me know your thoughts and we can finalize the contract by Friday.\n\n[Your Name]",
          },
        ],
        videoScripts: [
          {
            title: "YouTube 90s — New Region Story Summary",
            script:
              "HOOK (0-5s): Cinematic cutscene screenshot. Caption: 'HoYoverse spent 3 years building this region.'\n\nNARRATIVE (5-40s): Walk through the lore setup, character motivations, world-building details.\n\nGAMEPLAY (40-70s): Open-world exploration, puzzle mechanics, boss encounter preview.\n\nCTA (70-90s): 'Genshin is free on iOS, Android, PC, and PS5. If you want to support the channel, use my creator code — link below gives you a starter pack.'",
          },
          {
            title: "TikTok 15s — 5-Star Character Reveal Reaction",
            script:
              "0-2s: Dark screen, build-up music.\n2-6s: Character splash art reveal with particle effects.\n6-11s: Rapid gameplay clips showing kit highlights. Text: 'They actually made her broken 💀'\n11-15s: Wishlist banner screenshot + 'Free-to-play players: she's in standard next patch.'",
          },
        ],
      },
    },
    {
      name: "PUBG Mobile",
      category: "Battle Royale",
      targetAudience:
        "Hardcore mobile gamers aged 18–35 globally with strong presence in SEA/MENA/LATAM who enjoy competitive survival shooters and ranked ladder progression",
      uniqueSellingPoints:
        "Console-quality battle royale on mobile — 100-player Erangel maps, licensed real-world firearms system, 60fps smooth gameplay, and official esports circuits with $250K prize pools",
      downloadUrl: "https://www.pubgmobile.com",
      aiAssets: {
        status: "ready",
        generatedAt: "2026-04-28T08:10:00.000Z",
        traceId: "seed-pubg-001",
        emailTemplates: [
          {
            subject: "PUBG Mobile Pro Series — Exclusive Coverage Opportunity",
            body: "Hi [Creator Name],\n\nThe PUBG Mobile Pro League (PMPL) Americas finals are happening next month and we're building a creator media team. Your FPS gameplay content and engaged community make you an ideal fit.\n\nWhat we offer: press credentials, $2,500 appearance fee, exclusive developer interview access, and a co-branded content series.\n\nAre you available for a quick call Tuesday or Wednesday?\n\n[Your Name] · PUBG Mobile Partnerships",
          },
          {
            subject: "Season 30 Meta Update — Your Squad Will Want to See This",
            body: "Hey [Creator Name],\n\nSeason 30 dropped a significant weapon balance patch — the M416 nerf has completely shifted the mid-range meta. We'd like to sponsor a tier list breakdown video with your take.\n\nFee: $1,800 flat. No mandatory talking points — just your honest analysis with a 15-second branded end card.\n\n[Your Name]",
          },
          {
            subject: "PUBG Mobile × [Creator] Collaboration — Contract Ready",
            body: "Hi [Creator Name],\n\nWe're ready to move forward on the 4-video series. Here's the final brief:\n• 2× ranked gameplay highlight videos\n• 1× season overview & loadout guide\n• 1× tournament reaction/vlog\n• Total: $6,500 + exclusive in-game cosmetics for your audience\n\nContract and content calendar attached. Looking forward to working together.\n\n[Your Name]",
          },
        ],
        videoScripts: [
          {
            title: "YouTube 75s — Ranked Clutch Gameplay",
            script:
              "HOOK (0-5s): Final circle, 1v3, showing heartbeat cam overlay. Caption: 'Diamond lobby, 3 squads left.'\n\nGAMEPLAY (5-55s): Commentary-driven clutch sequence — positioning decisions, weapon choices, ring movement timing.\n\nANALYSIS (55-70s): 'Here's what most players miss in this situation: the micro-movement before the peek is what creates the angle.'\n\nCTA (70-75s): 'PUBG Mobile is free — download in bio. Season 30 Battle Pass details in the pinned comment.'",
          },
          {
            title: "TikTok 15s — Sniper 300m Shot",
            script:
              "0-3s: Scoping in on distant target, full focus.\n3-8s: Slow-motion bullet travel, hit marker, kill feed.\n8-12s: Turn to camera, reaction. Text: '300 meters. No scope. Different.'\n12-15s: PUBG Mobile logo + 'Download free' CTA card.",
          },
        ],
      },
    },
    {
      name: "Pokemon Go",
      category: "AR / Casual",
      targetAudience:
        "Casual gamers and Pokemon fans aged 10–40 globally who enjoy outdoor AR gaming, community events, and Pokemon collection mechanics",
      uniqueSellingPoints:
        "The world's #1 AR mobile game — catch Pokemon in the real world via GPS + camera, battle at local Gyms, trade with friends, and join global community events with millions of simultaneous players",
      downloadUrl: "https://pokemongolive.com",
      aiAssets: null,
    },
    {
      name: "Clash Royale",
      category: "Strategy / Card",
      targetAudience:
        "Strategy game fans aged 13–35 globally who enjoy competitive card-based tower defense with quick 3-minute match formats and deep deck-building meta",
      uniqueSellingPoints:
        "Fast-paced real-time 1v1 card strategy — over 100 collectible cards, seasonal deck meta shifts, ranked ladder with global leaderboard, and $1M annual esports prize pool",
      downloadUrl: "https://clashroyale.com",
      aiAssets: null,
    },
  ];

  let seededProductCount = 0;
  for (const prod of PRODUCT_SEEDS) {
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: prod.name },
      select: { id: true },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          category: prod.category,
          targetAudience: prod.targetAudience,
          uniqueSellingPoints: prod.uniqueSellingPoints,
          downloadUrl: prod.downloadUrl,
          ...(prod.aiAssets !== null ? { aiAssets: prod.aiAssets as never } : {}),
        },
      });
    } else {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: prod.name,
          category: prod.category,
          targetAudience: prod.targetAudience,
          uniqueSellingPoints: prod.uniqueSellingPoints,
          downloadUrl: prod.downloadUrl,
          aiAssets: prod.aiAssets as never,
        },
      });
    }
    seededProductCount++;
  }

  // ----- Link seeded campaigns to their matching Product -----
  // MVP-internal-demo-prep verifying-2026-05-01 fix C-10: outreach AI
  // customize was failing with "Campaign or template not found" because
  // campaignSeeds didn't set productId. We pair by Campaign.game ===
  // Product.name (Honor of Kings / Genshin Impact / PUBG Mobile —
  // identical strings in both seed arrays). Campaigns whose `game`
  // doesn't match a seeded Product (none today) are left alone.
  let linkedCampaignCount = 0;
  for (const [campaignName, campaignId] of campaignIdByName.entries()) {
    const seed = campaignSeeds.find((c) => c.name === campaignName);
    if (!seed) continue;
    const product = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: seed.game },
      select: { id: true },
    });
    if (!product) continue;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { productId: product.id },
    });
    linkedCampaignCount++;
  }

  // ----- Cleanup leftover Products outside the canonical 5-product set -----
  // verifying-2026-05-01 fix C-05.1: prod Demo Studio had a 6th product
  // from manual UI testing. seed previously didn't sweep — deleting any
  // Product for this tenant whose name isn't in PRODUCT_SEEDS keeps the
  // seeded set canonical across reruns. Guard with `campaigns: { none }`
  // so we don't silently break a campaign-product link the user wired up
  // intentionally; products that ARE referenced stay (FK Restrict would
  // throw anyway).
  const allowedNames = PRODUCT_SEEDS.map((p) => p.name);
  const removed = await prisma.product.deleteMany({
    where: {
      tenantId: tenant.id,
      name: { notIn: allowedNames },
      campaigns: { none: {} },
    },
  });

  // ----- Wire KolCampaign rows so /outreach can demo end-to-end -----
  // verifying-2026-05-01-fixing-1 fix C-10 round 2: each productId-linked
  // campaign needs at least one KolCampaign row whose KOL has an email,
  // otherwise the composer's KOL list is empty and AI customize → send
  // can't be demo'd. We pick handles by category fit per spec:
  //   - HoK (MOBA)        → MOBA / Mobile / Tournament leaning handles
  //   - Genshin (RPG)     → RPG / MMO / Story / Anime handles
  //   - PUBG  (FPS / BR)  → FPS / Battle-Royale / Competitive handles
  // findFirst + create makes this idempotent across reruns.
  const KOL_CAMPAIGN_SEEDS: Record<string, string[]> = {
    "Honor of Kings — Global Launch": ["gamerxia", "mei.plays", "neonhaze"],
    "Genshin Impact — Winter Event": ["sakurayt", "aisha.streams", "lumenarc", "ryo.arcade"],
    "PUBG Mobile — Season 30": ["kaibytes", "zeralite", "forgefalcon"],
  };
  const kolByHandle = new Map<string, string>(
    (
      await prisma.kol.findMany({
        where: { tenantId: tenant.id, handle: { in: KOLS.map((k) => k.handle) } },
        select: { id: true, handle: true },
      })
    ).map((row) => [row.handle, row.id])
  );
  let linkedKolCampaignCount = 0;
  for (const [campaignName, handles] of Object.entries(KOL_CAMPAIGN_SEEDS)) {
    const campaignId = campaignIdByName.get(campaignName);
    if (!campaignId) continue;
    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const kolId = kolByHandle.get(handle);
      if (!kolId) continue;
      const existing = await prisma.kolCampaign.findFirst({
        where: { tenantId: tenant.id, kolId, campaignId },
        select: { id: true },
      });
      if (existing) continue;
      // Alternate status across rows so the funnel + composer KOL list
      // looks varied rather than 100% pending.
      const status = i === 0 ? "contacted" : i === 1 ? "pending" : "quoted";
      await prisma.kolCampaign.create({
        data: { tenantId: tenant.id, kolId, campaignId, status },
      });
      linkedKolCampaignCount++;
    }
  }

  console.log("Seed complete:", {
    tenant: tenant.slug,
    users: [admin.email, marketer.email],
    kols: KOLS.length,
    campaigns: campaignSeeds.length,
    templates: seededTemplateCount,
    emailLogs: EMAIL_LOG_COUNT,
    products: seededProductCount,
    productsRemoved: removed.count,
    campaignsLinkedToProducts: linkedCampaignCount,
    kolCampaignRowsCreated: linkedKolCampaignCount,
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

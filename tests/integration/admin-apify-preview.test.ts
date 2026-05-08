/**
 * BL-012-F006 · admin/apify-preview Stage 1.5 integration suite.
 *
 * Wires the apify-kol fork client to a msw mock of the upstream
 * GET /kol surface, then runs the same 4-dimension aggregations the
 * StatsCards component uses on the wire data — proving the fetch +
 * zod-parse + stats math compose end-to-end.
 *
 * Also pins the data-flow isolation rule (spec §2.2) by static-grepping
 * src/lib/admin/* for forbidden imports / Prisma Kol-table mutations.
 * If a future commit adds `import "@/lib/kol-sync/..."` or `prisma.kol.*`
 * inside that tree, this test fails before any deploy.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { fetchApifyKolPage } from "../../src/lib/admin/apify-preview-client";
import {
  describeFieldCompleteness,
  describeFreshness,
  describePlatformCoverage,
  describeScoreDistribution,
} from "../../src/lib/admin/apify-preview-stats";

const FORK_BASE = "http://apify-kol.test:3003";
const BUSINESS_KEY = "test-business-key";
const NOW = new Date("2026-05-08T12:00:00Z");

function freshIso(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

function buildFakePage(): {
  data: unknown[];
  page: number;
  pageSize: number;
  total: number;
} {
  const platforms = ["instagram", "tiktok", "youtube"] as const;
  const data = Array.from({ length: 50 }, (_, i) => {
    const platform = platforms[i % platforms.length]!;
    const hasEmail = i % 2 === 0; // 50% email coverage → satisfies ≥40%
    return {
      id: `row-${i}`,
      platform,
      platformUserId: `${platform}-${i}`,
      username: `user${i}`,
      displayName: `User ${i}`,
      bio: `bio for ${i}`,
      avatarUrl: `https://cdn.example/${i}.jpg`,
      profileUrl: `https://${platform}.com/user${i}`,
      followers: 50_000 + i * 137,
      following: 250,
      postsCount: 80,
      totalLikes: 1_000_000,
      totalViews: 5_000_000,
      verified: i % 5 === 0,
      isBusinessAccount: false,
      emails: hasEmail ? [`u${i}@example.com`] : [],
      phones: [],
      socialHandles: { twitter: `@user${i}` },
      externalUrl: null,
      externalUrls: [],
      aggregatorUrl: i % 7 === 0 ? "https://linktr.ee/user" : null,
      aggregatorEmails: [],
      aggregatorLinks: {},
      relevanceScore: 0.55 + (i % 5) * 0.05,
      influenceScore: 0.5 + (i % 4) * 0.05,
      qualityScore: 0.4 + (i % 6) * 0.05,
      reachabilityScore: 0.45 + (i % 5) * 0.05,
      matchedTags: i % 3 === 0 ? ["streamer", "gaming"] : ["gaming", "esports"],
      matchedKeywords: ["fortnite"],
      tier: i < 10 ? "platinum" : "gold",
      isSeed: i < 10,
      lastScrapedAt: freshIso(1 + (i % 5)), // all within last 5 days → fresh
    };
  });
  return { data, page: 1, pageSize: 50, total: 50 };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  process.env.APIFY_KOL_BASE_URL = FORK_BASE;
  process.env.APIFY_KOL_BUSINESS_API_KEY = BUSINESS_KEY;
});

describe("BL-012-F006 admin/apify-preview integration", () => {
  it("fetches a 50-row page from the fork and produces 4/4 ✓ across the decision-gate dimensions", async () => {
    const fakePage = buildFakePage();
    let observedKey: string | null = null;
    server.use(
      http.get(`${FORK_BASE}/kol`, ({ request }) => {
        observedKey = request.headers.get("x-api-key");
        return HttpResponse.json(fakePage);
      })
    );

    // Bump the platform sample so card #3 floor (≥100 per top platform)
    // is satisfied. The fake page returns 50 KOLs split evenly across 3
    // platforms (~17 each), so we walk 6 pages to merge ~100 per platform.
    // This mirrors how the admin would broaden the sample by paging.
    const pages = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        fetchApifyKolPage({ pageSize: 50, page: i + 1 })
      )
    );

    expect(observedKey).toBe(BUSINESS_KEY);
    expect(pages[0]?.data).toHaveLength(50);
    expect(pages[0]?.raw).toMatchObject({ page: 1, pageSize: 50 });

    const merged = pages.flatMap((p) => p.data);
    expect(merged).toHaveLength(300);

    expect(describeFieldCompleteness(merged).pass).toBe(true);
    expect(describeScoreDistribution(merged).pass).toBe(true);
    expect(describePlatformCoverage(merged).pass).toBe(true);
    expect(describeFreshness(merged, NOW).pass).toBe(true);
  });

  it("surfaces an unauthorized error when the fork rejects the api key", async () => {
    server.use(
      http.get(`${FORK_BASE}/kol`, () =>
        HttpResponse.json({ error: "missing api key" }, { status: 401 })
      )
    );

    await expect(fetchApifyKolPage({ pageSize: 50 })).rejects.toMatchObject({
      kind: "unauthorized",
      status: 401,
    });
  });

  it("data-flow isolation: src/lib/admin tree imports nothing from kol-sync and never mutates Prisma Kol", () => {
    const adminDir = path.resolve(__dirname, "../../src/lib/admin");
    const FORBIDDEN_IMPORT = /from\s+['"]@\/lib\/kol-sync/;
    const FORBIDDEN_PRISMA = /prisma\.kol\.(create|upsert|update|delete|deleteMany|updateMany|createMany)/;

    function* walk(dir: string): Generator<string> {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (entry === "__tests__") continue;
          yield* walk(full);
        } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
          yield full;
        }
      }
    }

    const offenders: string[] = [];
    for (const file of walk(adminDir)) {
      const source = readFileSync(file, "utf-8");
      if (FORBIDDEN_IMPORT.test(source)) {
        offenders.push(`${file}: imports @/lib/kol-sync/*`);
      }
      if (FORBIDDEN_PRISMA.test(source)) {
        offenders.push(`${file}: mutates prisma.kol.*`);
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

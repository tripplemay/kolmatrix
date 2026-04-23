/**
 * BM1-F002 · KOL seed script integration spec
 *
 * Runs the seed against the Testcontainers DB and asserts:
 *   1. total KOL rows equal the enriched JSON's row count (upsert
 *      preserves every mappable row; 1 row in the source has an
 *      "#NAME?" url and is intentionally skipped)
 *   2. is_gaming = true count matches the JSON's gaming_count_final
 *   3. value_score is non-null for every inserted row
 *   4. larger follower counts have higher value scores (within the
 *      log-scaled range)
 *   5. re-running is idempotent (no duplicate rows, counts stay)
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cleanDb, getAdminPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

type SeedModule = typeof import("../../scripts/seed-kol-from-enriched");
let runSeed: SeedModule["runSeed"];

let expectedInserted = 0;
let expectedGaming = 0;

beforeAll(async () => {
  await setupTestDb();
  // Dynamic import AFTER Testcontainers sets DATABASE_ADMIN_URL so the
  // seed script's Prisma client hits the container.
  const mod = await import("../../scripts/seed-kol-from-enriched");
  runSeed = mod.runSeed;

  // Derive expected counts from the source JSON so the test stays valid
  // if the enrichment pipeline reruns with different numbers later.
  const raw = await readFile(
    resolve(process.cwd(), "docs/kol-seed-enriched-final.json"),
    "utf8"
  );
  const json = JSON.parse(raw) as {
    results: { url: string; is_gaming: boolean; region: string }[];
  };
  const REGIONS = new Set([
    "美国", "英国", "巴基斯坦", "加拿大", "德国", "越南",
    "台湾", "乌克兰", "日本", "伊拉克", "多米尼加共和国",
  ]);
  const valid = json.results.filter(
    (r) => r.url.includes("/@") && (!r.region || REGIONS.has(r.region))
  );
  expectedInserted = valid.length;
  expectedGaming = valid.filter((r) => r.is_gaming).length;
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await cleanDb();
  // Bootstrap the demo tenant (runSeed requires it to exist).
  const admin = getAdminPrisma();
  await admin.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Studio", slug: "demo" },
  });
});

describe("seed:kol (runSeed)", () => {
  it(
    "inserts every valid KOL and matches source counts",
    async () => {
      const stats = await runSeed();
      expect(stats.inserted).toBe(expectedInserted);
      expect(stats.updated).toBe(0);
      expect(stats.gaming).toBe(expectedGaming);

      const admin = getAdminPrisma();
      const total = await admin.kol.count();
      expect(total).toBe(expectedInserted);

      const gamingCount = await admin.kol.count({ where: { isGaming: true } });
      expect(gamingCount).toBe(expectedGaming);
    },
    120_000
  );

  it(
    "assigns a non-null value_score to every inserted row",
    async () => {
      await runSeed();
      const admin = getAdminPrisma();
      const nullScored = await admin.kol.count({ where: { valueScore: null } });
      expect(nullScored).toBe(0);
    },
    120_000
  );

  it(
    "produces higher value_score for more-followed KOLs (below the cap)",
    async () => {
      await runSeed();
      const admin = getAdminPrisma();
      // Pick two rows well below the cap (~2154 followers) to see the
      // log-scaled gradient. Use follower_count buckets since exact values
      // vary with the dataset.
      const tiny = await admin.kol.findFirst({
        where: { followerCount: { lte: 200 } },
        orderBy: { followerCount: "asc" },
      });
      const mid = await admin.kol.findFirst({
        where: { followerCount: { gte: 1500, lte: 2000 } },
        orderBy: { followerCount: "asc" },
      });
      if (tiny && mid) {
        expect(mid.valueScore ?? 0).toBeGreaterThanOrEqual(tiny.valueScore ?? 0);
      }
    },
    120_000
  );

  it(
    "is idempotent: a second run reports updates, not inserts, and keeps the same row count",
    async () => {
      await runSeed();
      const statsAgain = await runSeed();
      expect(statsAgain.inserted).toBe(0);
      expect(statsAgain.updated).toBe(expectedInserted);

      const admin = getAdminPrisma();
      const total = await admin.kol.count();
      expect(total).toBe(expectedInserted);
    },
    180_000
  );
});

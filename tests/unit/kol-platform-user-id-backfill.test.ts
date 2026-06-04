/**
 * BL-082-F002 · Unit tests for the platform_user_id backfill core.
 *
 * Drives `runPlatformUserIdBackfill` against a fake fork-discover + fake
 * Prisma so dry-run / apply / idempotency / unmatched-id behaviour is
 * pinned without a testcontainer (the live UPDATE runs in F006 staging).
 */
import { describe, expect, it, vi } from "vitest";

import {
  parseArgs,
  runPlatformUserIdBackfill,
  type DiscoveredPuid,
} from "../../scripts/kol-platform-user-id-backfill";

const TENANT = "11111111-2222-3333-4444-555555555555";

function fakeDiscover(byPlatform: Record<string, DiscoveredPuid[]>) {
  return async (platform: string) => byPlatform[platform] ?? [];
}

/** Fake prisma where the UPDATE "matches" a configurable set of external
 *  ids (returns 1) and misses the rest (returns 0) — mimics the
 *  `external_id = $4 AND platform_user_id IS NULL` predicate. */
function fakePrisma(matchableExternalIds: Set<string>) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const prisma = {
    $executeRawUnsafe: vi.fn(async (sql: string, ...values: unknown[]) => {
      calls.push({ sql, values });
      const externalId = values[3] as string;
      return matchableExternalIds.has(externalId) ? 1 : 0;
    }),
  };
  return { prisma, calls };
}

describe("parseArgs", () => {
  it("defaults to apply-mode, demo tenant", () => {
    expect(parseArgs([])).toEqual({ dryRun: false, tenantId: null });
  });
  it("parses --dry-run + --tenant=", () => {
    expect(parseArgs(["--dry-run", "--tenant=t1"])).toEqual({
      dryRun: true,
      tenantId: "t1",
    });
  });
});

describe("runPlatformUserIdBackfill", () => {
  const discovered: Record<string, DiscoveredPuid[]> = {
    youtube: [
      { externalId: "90651", platformUserId: "UCnQ4TDbESxZ47uBH6cB_Nrg", platform: "youtube" },
      { externalId: "244", platformUserId: "UC6QZ_ss3i_8qLV_RczPZBkw", platform: "youtube" },
    ],
    tiktok: [
      { externalId: "165", platformUserId: "6766325527592272902", platform: "tiktok" },
      // no platformUserId → must be skipped (not counted, not written)
      { externalId: "999", platformUserId: null, platform: "tiktok" },
    ],
    instagram: [],
  };

  it("dry-run counts candidates with a platformUserId and writes nothing", async () => {
    const { prisma } = fakePrisma(new Set(["90651", "244", "165"]));
    const res = await runPlatformUserIdBackfill({
      prisma,
      discover: fakeDiscover(discovered),
      tenantId: TENANT,
      dryRun: true,
    });
    expect(res.scanned).toBe(3); // 2 YT + 1 TT (the null-puid TT row excluded)
    expect(res.updated).toBe(0);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("apply stamps matched rows and reports per-platform counts", async () => {
    const { prisma, calls } = fakePrisma(new Set(["90651", "244", "165"]));
    const res = await runPlatformUserIdBackfill({
      prisma,
      discover: fakeDiscover(discovered),
      tenantId: TENANT,
      dryRun: false,
    });
    expect(res.scanned).toBe(3);
    expect(res.updated).toBe(3);
    expect(res.perPlatform.youtube).toEqual({ scanned: 2, updated: 2 });
    expect(res.perPlatform.tiktok).toEqual({ scanned: 1, updated: 1 });
    expect(res.perPlatform.instagram).toEqual({ scanned: 0, updated: 0 });
    // never issues an UPDATE for the null-platformUserId row
    expect(calls.every((c) => c.values[0] !== null)).toBe(true);
    // UPDATE only fills NULL (idempotent guard) + matches by external_id
    expect(calls[0]!.sql).toContain("platform_user_id IS NULL");
    expect(calls[0]!.sql).toContain("external_id = $4");
  });

  it("skips (counts 0 updated) when the fork id matches no existing KOL row", async () => {
    const { prisma } = fakePrisma(new Set()); // nothing matches
    const res = await runPlatformUserIdBackfill({
      prisma,
      discover: fakeDiscover({ youtube: discovered.youtube }),
      tenantId: TENANT,
      platforms: ["youtube"],
      dryRun: false,
    });
    expect(res.scanned).toBe(2);
    expect(res.updated).toBe(0); // both UPDATEs returned 0 rows
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});

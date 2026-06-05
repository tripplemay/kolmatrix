/**
 * BL-083-F003 · import.ts upsert wiring for the fork-unlocked business
 * emails (`RawKolData.emails` → `kol.emails` JSONB + email_source).
 *
 * Three cases pin the contract (per features.json F003 acceptance):
 *   (1) mapper.emails non-empty → upsert data carries `emails` +
 *       `emailSource='business-unlock'` on BOTH create and update paths
 *   (2) mapper.emails null/empty → keys omitted, so a refresh that
 *       returns no emails never clobbers an already-unlocked value
 *   (3) updating an existing KOL writes `emails` but NEVER the legacy
 *       single `email` scalar (BL-031's 6 bio-regex rows stay put)
 *
 * Uses the same prisma-mock seam as kol-sync-import-failed.test.ts so the
 * assertions read the exact object handed to `prisma.kol.upsert(...)`
 * without needing a real DB.
 */
import { describe, expect, it, vi } from "vitest";

import {
  EMAIL_SOURCE_BUSINESS_UNLOCK,
  importRawKolData,
  mapToUpsertPayload,
} from "@/lib/kol-sync/import";
import type { RawKolData } from "@/lib/kol-sync/types";

const NOW = new Date("2026-06-05T00:00:00.000Z");
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function fakeRaw(overrides: Partial<RawKolData> = {}): RawKolData {
  return {
    externalId: "apify_default",
    platform: "youtube",
    handle: "@default",
    displayName: "Default Creator",
    description: "Plays competitive FPS daily.",
    country: "US",
    language: "en",
    subscriberCount: 200_000,
    topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
    engagement_rate: 5.5,
    engagement_outlier: false,
    scrapedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makePrismaMock(existing: { id: string } | null = null) {
  const findUnique = vi
    .fn()
    .mockResolvedValue(
      existing
        ? { id: existing.id, followerCount: 100_000, lastSyncedAt: null }
        : null,
    );
  const upsert = vi.fn().mockResolvedValue({});
  const auditCreate = vi.fn().mockResolvedValue({});
  const mock = {
    kol: { findUnique, upsert },
    auditLog: { create: auditCreate },
  } as unknown as Parameters<typeof importRawKolData>[0];
  return { prisma: mock, upsert };
}

describe("BL-083-F003 mapToUpsertPayload — emails projection", () => {
  it("surfaces non-empty emails + email_source='business-unlock'", () => {
    const payload = mapToUpsertPayload(
      fakeRaw({ emails: ["gamertechtoronto@gmail.com"] }),
      { source: "apify-kol", isDemo: false, nowIso: NOW.toISOString() },
    );
    expect(payload?.emails).toEqual(["gamertechtoronto@gmail.com"]);
    expect(payload?.emailSource).toBe(EMAIL_SOURCE_BUSINESS_UNLOCK);
  });

  it("leaves emails + emailSource null when the mapper didn't fill it", () => {
    const payload = mapToUpsertPayload(fakeRaw(), {
      source: "apify-kol",
      isDemo: false,
      nowIso: NOW.toISOString(),
    });
    expect(payload?.emails).toBeNull();
    expect(payload?.emailSource).toBeNull();
  });

  it("treats an empty emails array as 'not filled'", () => {
    const payload = mapToUpsertPayload(fakeRaw({ emails: [] }), {
      source: "apify-kol",
      isDemo: false,
      nowIso: NOW.toISOString(),
    });
    expect(payload?.emails).toBeNull();
    expect(payload?.emailSource).toBeNull();
  });

  it("never emits the legacy single `email` scalar", () => {
    const payload = mapToUpsertPayload(
      fakeRaw({ emails: ["a@b.com"] }),
      { source: "apify-kol", isDemo: false, nowIso: NOW.toISOString() },
    );
    expect(payload).not.toHaveProperty("email");
  });
});

describe("BL-083-F003 importRawKolData — upsert wiring", () => {
  it("(1) non-empty emails → create + update data carry emails + email_source", async () => {
    const { prisma, upsert } = makePrismaMock(null);
    await importRawKolData(
      prisma,
      [fakeRaw({ externalId: "apify_new", emails: ["a@b.com", "c@d.com"] })],
      { tenantId: TENANT_ID, source: "apify-kol", isDemo: false, now: () => NOW },
    );

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]?.[0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(arg.create.emails).toEqual(["a@b.com", "c@d.com"]);
    expect(arg.create.emailSource).toBe(EMAIL_SOURCE_BUSINESS_UNLOCK);
    expect(arg.update.emails).toEqual(["a@b.com", "c@d.com"]);
    expect(arg.update.emailSource).toBe(EMAIL_SOURCE_BUSINESS_UNLOCK);
  });

  it("(2) null/empty emails → emails + email_source keys omitted (no clobber)", async () => {
    const { prisma, upsert } = makePrismaMock(null);
    await importRawKolData(prisma, [fakeRaw({ externalId: "apify_noemail" })], {
      tenantId: TENANT_ID,
      source: "apify-kol",
      isDemo: false,
      now: () => NOW,
    });

    const arg = upsert.mock.calls[0]?.[0] as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(arg.create).not.toHaveProperty("emails");
    expect(arg.create).not.toHaveProperty("emailSource");
    expect(arg.update).not.toHaveProperty("emails");
    expect(arg.update).not.toHaveProperty("emailSource");
  });

  it("(3) updating an existing KOL writes emails but never the legacy `email` scalar", async () => {
    const { prisma, upsert } = makePrismaMock({ id: "existing-uuid" });
    await importRawKolData(
      prisma,
      [fakeRaw({ externalId: "apify_existing", emails: ["a@b.com"] })],
      { tenantId: TENANT_ID, source: "apify-kol", isDemo: false, now: () => NOW },
    );

    const arg = upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };
    expect(arg.update.emails).toEqual(["a@b.com"]);
    expect(arg.update.emailSource).toBe(EMAIL_SOURCE_BUSINESS_UNLOCK);
    // The legacy single-email column is owned by F006's backfill / manual
    // edits — the live sync path must never touch it.
    expect(arg.update).not.toHaveProperty("email");
  });
});

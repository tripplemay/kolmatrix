/**
 * BIx-mvp-polish-pass F004-P2 · YouTube `search.list` page-rotation
 * cursor.
 *
 * The daily cron walks 14 region × 6 keyword (today's
 * `pickDailyKeywords` slice). To avoid re-scraping the same first 50
 * channels every day we rotate page 1 → 2 → 3 over a 6-day cycle
 * (`pickDailyPage`). Each `(region, keyword)` row in
 * `kol_sync_cursor` records the most recent `nextPageToken` so the
 * next bucket of 50 channels is reachable on the appropriate cron
 * day.
 *
 * The provider is pulled out of the adapter so it can be stubbed in
 * unit tests without a Postgres testcontainer (see
 * `inMemoryKolSyncCursorProvider`).
 */
import type { PrismaClient } from "@prisma/client";

export interface KolSyncCursorRow {
  /** Last page index reached (1, 2, or 3). 1 means "haven't yet
   *  advanced past the first page". */
  page: number;
  /** Opaque YouTube `search.list` cursor for the *next* page after
   *  `page`. `null` when no advance has happened yet. */
  nextPageToken: string | null;
}

export interface KolSyncCursorProvider {
  /** Look up the cursor for `(region, keyword)`. Returns the default
   *  `{ page: 1, nextPageToken: null }` shape when the row doesn't
   *  exist yet — callers never have to special-case absence. */
  get(region: string, keyword: string): Promise<KolSyncCursorRow>;
  /** Upsert the cursor for `(region, keyword)`. Caller passes the
   *  page just *consumed* and the `nextPageToken` returned by
   *  YouTube; the table row reflects "what to use next time". */
  set(region: string, keyword: string, page: number, nextPageToken: string | null): Promise<void>;
}

/**
 * Prisma-backed cursor provider for the daily cron path. No tenant
 * scope — discovery is platform-level. Defensive against partial
 * upserts: a thrown DB error surfaces directly so the dispatcher
 * tallies it as a failed adapter run instead of silently degrading
 * to page-1-forever.
 */
export function prismaKolSyncCursorProvider(prisma: PrismaClient): KolSyncCursorProvider {
  return {
    async get(region, keyword) {
      const row = await prisma.kolSyncCursor.findUnique({
        where: {
          region_keyword: { region, keyword },
        },
        select: { page: true, nextPageToken: true },
      });
      if (!row) return { page: 1, nextPageToken: null };
      return { page: row.page, nextPageToken: row.nextPageToken };
    },
    async set(region, keyword, page, nextPageToken) {
      await prisma.kolSyncCursor.upsert({
        where: {
          region_keyword: { region, keyword },
        },
        create: { region, keyword, page, nextPageToken },
        update: { page, nextPageToken },
      });
    },
  };
}

/**
 * Pure in-memory cursor provider — only used by the unit tests. The
 * map is keyed `${region}::${keyword}` (separator chosen because no
 * real keyword contains "::").
 */
export function inMemoryKolSyncCursorProvider(
  seed: ReadonlyMap<string, KolSyncCursorRow> = new Map()
): KolSyncCursorProvider & { snapshot: () => Map<string, KolSyncCursorRow> } {
  const store = new Map<string, KolSyncCursorRow>(seed);
  const key = (r: string, k: string) => `${r}::${k}`;
  return {
    async get(region, keyword) {
      return store.get(key(region, keyword)) ?? { page: 1, nextPageToken: null };
    },
    async set(region, keyword, page, nextPageToken) {
      store.set(key(region, keyword), { page, nextPageToken });
    },
    snapshot() {
      return new Map(store);
    },
  };
}

/**
 * Map a calendar day to the page (1 / 2 / 3) the daily matrix should
 * call this run. Spec §F004 #4 — 6-day cycle (1-indexed):
 *
 *   cycle position 1, 2, 3 → page 1
 *   cycle position 4, 5    → page 2
 *   cycle position 6       → page 3
 *
 * cyclePos = ((dayOfYear - 1) mod 6) + 1, so Jan 1 → cyclePos 1 →
 * page 1. Pure / deterministic / unit-testable.
 */
export function pickDailyPage(date: Date = new Date()): 1 | 2 | 3 {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start;
  const dayOfYear = Math.floor(diff / 86_400_000);
  const cyclePos = ((dayOfYear - 1) % 6) + 1;
  if (cyclePos <= 3) return 1;
  if (cyclePos <= 5) return 2;
  return 3;
}

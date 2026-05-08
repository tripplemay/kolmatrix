/**
 * BL-012-F009 · ApifyKolSyncAdapter integration suite (msw fixture).
 *
 * Wires `ApifyKolSyncAdapter` to a msw mock of the `apify-kol-service`
 * upstream surface (GET /kol, GET /kol/:platform/:userId, GET /health)
 * and verifies the four contract guarantees the spec calls out:
 *
 *   1. discover() walks pages until upstream returns a short page
 *      (100 / 100 / 57 → 257 RawKolData) or the maxItemsPerRun cap
 *      kicks in (whichever first).
 *   2. discover() surfaces 429 + Retry-After through the dispatcher's
 *      withRetry wrapper — the second attempt succeeds and the adapter
 *      transparently returns the data.
 *   3. refresh() round-trips a single KOL via GET /kol/:platform/:userId
 *      and the projected RawKolData feeds straight into
 *      mapApifyKolItemToRawKolData (i.e. matches the discover-path
 *      shape so import.ts does the same upsert no matter the source
 *      method).
 *   4. healthCheck() returns healthy=true on `{ status: "ok" }`.
 *
 * Hermetic: msw intercepts every fetch; no Testcontainers / Prisma
 * boot. Threads pool keeps timers / fakeTimers cooperation predictable
 * — vitest forks pool would clobber Date.now under msw's interceptor.
 */
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  ApifyKolSyncAdapter,
  mapApifyKolItemToRawKolData,
} from "../../src/lib/kol-sync/adapters/apify-kol";
import { KolSyncDispatcher } from "../../src/lib/kol-sync/dispatcher";
import type { ApifyKolItem } from "../../src/lib/apify-kol/schemas";

const FORK_BASE = "http://apify-kol-it.test:3003";
const BUSINESS_KEY = "it-business-key";

function makeItem(idx: number, overrides: Partial<ApifyKolItem> = {}): ApifyKolItem {
  const platforms = ["instagram", "tiktok", "youtube"] as const;
  const platform = platforms[idx % platforms.length]!;
  return {
    id: `${platform}_${idx}`,
    platform,
    platformUserId: `${idx}`,
    username: `user${idx}`,
    displayName: `User ${idx}`,
    bio: "fork sample bio",
    avatarUrl: `https://cdn.example/${idx}.jpg`,
    profileUrl: `https://${platform}.com/user${idx}`,
    followers: 100_000 + idx,
    following: 100,
    postsCount: 50,
    totalLikes: 200_000,
    totalViews: 5_000_000,
    verified: false,
    isBusinessAccount: false,
    emails: [`u${idx}@example.com`],
    phones: [],
    socialHandles: { twitter: `@user${idx}` },
    externalUrl: null,
    externalUrls: [],
    aggregatorUrl: null,
    aggregatorEmails: [],
    aggregatorLinks: {},
    relevanceScore: 0.6,
    influenceScore: 0.55,
    qualityScore: 0.5,
    reachabilityScore: 0.5,
    matchedTags: ["gaming"],
    matchedKeywords: ["fortnite"],
    tier: "gold",
    isSeed: false,
    lastScrapedAt: "2026-05-08T00:00:00.000Z",
    ...overrides,
  } as ApifyKolItem;
}

function pageBody(start: number, count: number) {
  return {
    data: Array.from({ length: count }, (_, i) => makeItem(start + i)),
    page: Math.floor(start / 100) + 1,
    pageSize: 100,
    total: 257,
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeAdapter() {
  return new ApifyKolSyncAdapter({
    baseUrl: FORK_BASE,
    apiKey: BUSINESS_KEY,
    pageSize: 100,
    maxItemsPerRun: 5_000,
    timeoutMs: 5_000,
  });
}

describe("BL-012-F009 ApifyKolSyncAdapter integration", () => {
  it("Case 1 — discover walks 3 pages (100/100/57) and exits when a short page lands", async () => {
    let calls = 0;
    server.use(
      http.get(`${FORK_BASE}/kol`, ({ request }) => {
        expect(request.headers.get("x-api-key")).toBe(BUSINESS_KEY);
        calls += 1;
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "1");
        if (page === 1) return HttpResponse.json(pageBody(0, 100));
        if (page === 2) return HttpResponse.json(pageBody(100, 100));
        if (page === 3) return HttpResponse.json(pageBody(200, 57));
        // Page 4 must never be requested — short-page exit.
        return HttpResponse.json({ error: "should not be called" }, { status: 500 });
      })
    );

    const adapter = makeAdapter();
    const rows = await adapter.discover({});
    expect(calls).toBe(3);
    expect(rows).toHaveLength(257);
    // Spot-check the projection — first row is page-1 idx-0.
    expect(rows[0]).toMatchObject({
      externalId: "instagram_0",
      platform: "instagram",
      handle: "user0",
      subscriberCount: 100_000,
    });
    // Last row is page-3 idx-256.
    expect(rows[256]?.externalId).toBe("tiktok_256");
  });

  it("Case 2 — 429 + Retry-After is retried via the dispatcher's withRetry wrapper", async () => {
    const calls: number[] = [];
    server.use(
      http.get(`${FORK_BASE}/kol`, () => {
        calls.push(Date.now());
        if (calls.length === 1) {
          return HttpResponse.json(
            { error: "rate limited" },
            { status: 429, headers: { "retry-after": "5" } }
          );
        }
        // Second attempt succeeds — single short page so discover exits.
        return HttpResponse.json(pageBody(0, 3));
      })
    );

    const adapter = makeAdapter();
    const dispatcher = new KolSyncDispatcher([adapter]);

    // Inject a synchronous sleep so the test exits in <100ms instead of
    // waiting the real 5s. We assert the sleep was invoked with ≥5000ms
    // — proving the retry honoured the schedule. In production
    // `withRetry` uses the daily-script's 30s/2min/5min cadence; the
    // adapter's 429 → AdapterRateLimitError surfacing is the contract
    // verified here, not the schedule itself.
    const sleeps: number[] = [];
    const report = await dispatcher.runDailySync({
      retry: {
        backoffsMs: [5_000, 10_000, 20_000],
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
    });

    const outcome = report.outcomes.find((o) => o.adapter === "apify-kol");
    expect(outcome?.ok).toBe(true);
    if (outcome?.ok) {
      expect(outcome.data).toHaveLength(3);
    }
    expect(calls).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(5_000);
  });

  it("Case 3 — refresh round-trips a single KOL via /kol/:platform/:userId and matches the mapper", async () => {
    const fixture = makeItem(42, {
      id: "tiktok_42",
      platform: "tiktok",
      platformUserId: "42",
      username: "tt_dancer",
      followers: 980_000,
    });
    let observedKey: string | null = null;
    server.use(
      http.get(`${FORK_BASE}/kol/tiktok/42`, ({ request }) => {
        observedKey = request.headers.get("x-api-key");
        return HttpResponse.json(fixture);
      })
    );

    const adapter = makeAdapter();
    const out = await adapter.refresh(["tiktok:42"]);

    expect(observedKey).toBe(BUSINESS_KEY);
    expect(out).toHaveLength(1);
    // Adapter projection must equal the pure-mapper applied to the same
    // upstream payload — keeps discover and refresh import paths aligned.
    const expected = mapApifyKolItemToRawKolData(fixture, () => out[0]!.scrapedAt);
    expect(out[0]).toEqual(expected);
    expect(out[0]).toMatchObject({
      externalId: "tiktok_42",
      platform: "tiktok",
      handle: "tt_dancer",
      subscriberCount: 980_000,
    });
  });

  it("Case 4 — healthCheck returns healthy=true on { status: 'ok' }", async () => {
    server.use(
      http.get(`${FORK_BASE}/health`, () =>
        HttpResponse.json({ status: "ok", uptime: 1234 })
      )
    );
    const adapter = makeAdapter();
    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(true);
    expect(result.details).toMatchObject({
      upstream: "apify-kol-service",
      status: "ok",
    });
  });

  it("Case 5 — refresh skips upstream 404 and continues with the next id", async () => {
    server.use(
      http.get(`${FORK_BASE}/kol/instagram/missing`, () =>
        HttpResponse.json({ error: "not found" }, { status: 404 })
      ),
      http.get(`${FORK_BASE}/kol/instagram/found`, () =>
        HttpResponse.json(makeItem(7, { id: "ig_7", platform: "instagram", platformUserId: "found", username: "found_user" }))
      )
    );
    const adapter = makeAdapter();
    const out = await adapter.refresh(["instagram:missing", "instagram:found"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.handle).toBe("found_user");
  });
});

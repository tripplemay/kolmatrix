/**
 * BL-068-F006 · Conversational refine flow E2E.
 *
 * Covers the 6 acceptance points from features.json F006:
 *
 *   1. RefineInputBar mounts on /campaigns/[id] AND /match?campaignId,
 *      default no cache → input bar visible + Reset hidden.
 *   2. Refine success path → pool reordered + success feedback toast
 *      visible + Reset button visible.
 *   3. Refine unparsable → unparsable toast displays the LLM reason +
 *      pool order unchanged + rawQuery preserved in the input.
 *   4. Refine cap exhausted → capExhausted toast + pool unchanged.
 *   5. Reset to AI default → pool reverts to default order + Reset
 *      hidden + localStorage refine-... key removed.
 *   6. localStorage TTL >24h → stale cache silently ignored on reload,
 *      default order rendered.
 *
 * CI infrastructure constraints (per session_notes):
 *   - CI has no AIGCGATEWAY_* env, so /api/kols/smart-match would fail
 *     and the panel would render the error banner instead of the
 *     active state where RefineInputBar mounts. Tests therefore mock
 *     the smart-match endpoint via page.route to inject a stable pool.
 *   - applyRefineAction is a Next.js server action; we match it by the
 *     next-action header + body substring, identical to the
 *     campaign-explainability-flow.spec.ts pattern.
 *
 * Test isolation:
 *   - Routes are scoped per test (page.route is per browser context).
 *   - Each test opens a fresh page, so localStorage starts clean
 *     unless explicitly seeded via addInitScript.
 *   - test.skip() when the marketer tenant has no seeded campaigns.
 */
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.use({ storageState: "playwright/.auth/marketer.json" });

// Fixed 5-KOL pool — small enough to render entirely in the visible
// batch so each card has a stable position to assert on.
const POOL = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    displayName: "Alpha Creator",
    handle: "alpha",
    platform: "youtube",
    avatarUrl: null,
    followerCount: 100000,
    countryCode: "US",
    categories: ["Strategy"],
    matchScore: 95,
    valueScore: 90,
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    displayName: "Beta Creator",
    handle: "beta",
    platform: "twitch",
    avatarUrl: null,
    followerCount: 80000,
    countryCode: "JP",
    categories: ["Action"],
    matchScore: 88,
    valueScore: 80,
  },
  {
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
    displayName: "Gamma Creator",
    handle: "gamma",
    platform: "tiktok",
    avatarUrl: null,
    followerCount: 60000,
    countryCode: "KR",
    categories: ["RPG"],
    matchScore: 80,
    valueScore: 70,
  },
  {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    displayName: "Delta Creator",
    handle: "delta",
    platform: "youtube",
    avatarUrl: null,
    followerCount: 40000,
    countryCode: "ES",
    categories: ["Strategy"],
    matchScore: 72,
    valueScore: 60,
  },
  {
    id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    displayName: "Epsilon Creator",
    handle: "epsilon",
    platform: "youtube",
    avatarUrl: null,
    followerCount: 20000,
    countryCode: "DE",
    categories: ["Strategy"],
    matchScore: 65,
    valueScore: 50,
  },
];
const POOL_IDS = POOL.map((k) => k.id);
const REVERSED_IDS = [...POOL_IDS].reverse();

async function mockSmartMatch(page: Page): Promise<void> {
  await page.route("**/api/kols/smart-match", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: POOL }),
    });
  });
}

async function mockRefineAction(
  page: Page,
  responseData: {
    orderedKolIds: string[];
    feedback: string;
    unparsable: boolean;
    capExhausted: boolean;
    errorKind?: "unparsable" | "malformed" | "permutation_invalid";
  },
): Promise<void> {
  await page.route("**", async (route) => {
    const req = route.request();
    const headers = req.headers();
    const isServerAction = (headers["next-action"] ?? "").length > 0;
    const body = req.postData() ?? "";
    if (isServerAction && body.includes("applyRefineAction")) {
      await route.fulfill({
        status: 200,
        contentType: "text/plain;charset=UTF-8",
        body: JSON.stringify({ ok: true, data: responseData }),
      });
      return;
    }
    await route.continue();
  });
}

async function firstCampaignDetailUrl(
  page: Page,
): Promise<{ href: string; campaignId: string } | null> {
  await page.goto("/en/campaigns");
  await expect(page.getByTestId("campaigns-page-title")).toBeVisible({
    timeout: 15_000,
  });
  const firstRow = page.getByTestId("campaign-row").first();
  if ((await firstRow.count()) === 0) return null;
  const id = await firstRow.getAttribute("data-campaign-id");
  if (!id) return null;
  return { href: `/en/campaigns/${id}`, campaignId: id };
}

async function submitRefine(page: Page, query: string): Promise<void> {
  await page.getByTestId("campaign-refine-input").fill(query);
  await page.getByTestId("campaign-refine-apply").click();
}

async function readVisibleKolIds(page: Page): Promise<string[]> {
  const cards = page.getByTestId("campaign-ai-recommendation-card");
  const count = await cards.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = await cards.nth(i).getAttribute("data-kol-id");
    if (id) ids.push(id);
  }
  return ids;
}

test.describe("BL-068-F006 · /campaigns/[id] + /match conversational refine flow", () => {
  test("1. RefineInputBar mounts on /campaigns/[id] AND /match?campaignId (default no cache → input visible, Reset hidden)", async ({
    page,
  }) => {
    const found = await firstCampaignDetailUrl(page);
    if (!found) test.skip(true, "Tenant has no seeded campaigns");
    const { href, campaignId } = found!;
    await mockSmartMatch(page);

    // /campaigns/[id] mount.
    await page.goto(href);
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("campaign-refine-input-bar"),
    ).toBeVisible();
    await expect(
      page.getByTestId("campaign-refine-reset"),
    ).toHaveCount(0);

    // /match?campaignId mount — MatchRefineBar wraps the same
    // RefineInputBar, so the inner testid stays the same.
    await page.goto(`/en/match?campaignId=${campaignId}`);
    await expect(page.getByTestId("match-refine-bar")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByTestId("campaign-refine-input-bar"),
    ).toBeVisible();
    await expect(
      page.getByTestId("campaign-refine-reset"),
    ).toHaveCount(0);
  });

  test("2. Refine success: pool reorders, success toast visible, Reset button appears", async ({
    page,
  }) => {
    const found = await firstCampaignDetailUrl(page);
    if (!found) test.skip(true, "Tenant has no seeded campaigns");
    await mockSmartMatch(page);
    await mockRefineAction(page, {
      orderedKolIds: REVERSED_IDS,
      feedback: "Reranked by AI",
      unparsable: false,
      capExhausted: false,
    });

    await page.goto(found!.href);
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });

    const before = await readVisibleKolIds(page);
    expect(before[0]).toBe(POOL_IDS[0]);

    await submitRefine(page, "fewer micro, more female");

    await expect(
      page.getByTestId("campaign-refine-toast-success"),
    ).toContainText("Reranked by AI", { timeout: 10_000 });
    await expect(page.getByTestId("campaign-refine-reset")).toBeVisible();

    // First visible card should now be the previously-last KOL.
    await expect
      .poll(async () => (await readVisibleKolIds(page))[0])
      .toBe(POOL_IDS[POOL_IDS.length - 1]);
  });

  test("3. Refine unparsable: unparsable toast shows LLM reason, pool unchanged, rawQuery preserved", async ({
    page,
  }) => {
    const found = await firstCampaignDetailUrl(page);
    if (!found) test.skip(true, "Tenant has no seeded campaigns");
    await mockSmartMatch(page);
    await mockRefineAction(page, {
      orderedKolIds: POOL_IDS,
      feedback: "Please be more specific about audience.",
      unparsable: true,
      capExhausted: false,
      errorKind: "unparsable",
    });

    await page.goto(found!.href);
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });

    const before = await readVisibleKolIds(page);
    await submitRefine(page, "vibe");

    await expect(
      page.getByTestId("campaign-refine-toast-unparsable"),
    ).toContainText("Please be more specific about audience.", {
      timeout: 10_000,
    });
    await expect(
      page.getByTestId("campaign-refine-input"),
    ).toHaveValue("vibe");

    // Pool order must remain the input order (= default valueScore desc).
    expect(await readVisibleKolIds(page)).toEqual(before);
    // Reset must NOT appear — there is no applied refine state.
    await expect(page.getByTestId("campaign-refine-reset")).toHaveCount(0);
  });

  test("4. Refine cap exhausted: capExhausted toast renders, pool unchanged", async ({
    page,
  }) => {
    const found = await firstCampaignDetailUrl(page);
    if (!found) test.skip(true, "Tenant has no seeded campaigns");
    await mockSmartMatch(page);
    await mockRefineAction(page, {
      orderedKolIds: POOL_IDS,
      feedback: "",
      unparsable: false,
      capExhausted: true,
    });

    await page.goto(found!.href);
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });

    const before = await readVisibleKolIds(page);
    await submitRefine(page, "anything");

    await expect(
      page.getByTestId("campaign-refine-toast-cap"),
    ).toBeVisible({ timeout: 10_000 });
    expect(await readVisibleKolIds(page)).toEqual(before);
    await expect(page.getByTestId("campaign-refine-reset")).toHaveCount(0);
  });

  test("5. Reset to AI default: pool reverts to default order, Reset hidden, refine cache key cleared", async ({
    page,
  }) => {
    const found = await firstCampaignDetailUrl(page);
    if (!found) test.skip(true, "Tenant has no seeded campaigns");
    await mockSmartMatch(page);
    await mockRefineAction(page, {
      orderedKolIds: REVERSED_IDS,
      feedback: "Reranked",
      unparsable: false,
      capExhausted: false,
    });

    await page.goto(found!.href);
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });

    // Apply a refine first so we have state to reset.
    await submitRefine(page, "swap order");
    await expect(page.getByTestId("campaign-refine-reset")).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(async () => (await readVisibleKolIds(page))[0])
      .toBe(POOL_IDS[POOL_IDS.length - 1]);

    // Now reset.
    await page.getByTestId("campaign-refine-reset").click();

    await expect(page.getByTestId("campaign-refine-reset")).toHaveCount(0);
    await expect(
      page.getByTestId("campaign-refine-toast-success"),
    ).toHaveCount(0);
    await expect
      .poll(async () => (await readVisibleKolIds(page))[0])
      .toBe(POOL_IDS[0]);

    // localStorage refine-... key must be removed.
    const refineKeyRemaining = await page.evaluate(() => {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith("refine-")) return key;
      }
      return null;
    });
    expect(refineKeyRemaining).toBeNull();
  });

  test("6. localStorage 24h TTL boundary: stale refine cache on reload is silently ignored, default order rendered", async ({
    page,
  }) => {
    const found = await firstCampaignDetailUrl(page);
    if (!found) test.skip(true, "Tenant has no seeded campaigns");
    await mockSmartMatch(page);

    // First navigation hydrates the pool cache so we can derive the
    // tenantId from its key (campaign-recommendations-{tenant}-{campaign}).
    await page.goto(found!.href);
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });

    const tenantId = await page.evaluate((cid: string) => {
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        const prefix = "campaign-recommendations-";
        const suffix = `-${cid}`;
        if (key.startsWith(prefix) && key.endsWith(suffix)) {
          return key.slice(prefix.length, key.length - suffix.length);
        }
      }
      return null;
    }, found!.campaignId);
    if (!tenantId) {
      test.skip(true, "Pool cache key not found — cannot derive tenantId");
    }

    // Seed a stale refine cache 25 h ago.
    await page.evaluate(
      ({ tid, cid, reversed }) => {
        const key = `refine-${tid}-${cid}`;
        const stale = new Date(
          Date.now() - 25 * 60 * 60 * 1000,
        ).toISOString();
        window.localStorage.setItem(
          key,
          JSON.stringify({
            orderedKolIds: reversed,
            feedback: "Stale rerank",
            rawQuery: "stale query",
            createdAt: stale,
          }),
        );
      },
      { tid: tenantId, cid: found!.campaignId, reversed: REVERSED_IDS },
    );

    // Reload — the panel should ignore the stale cache and render the
    // default valueScore-desc order, with Reset hidden and no sticky
    // feedback toast.
    await page.reload();
    await expect(
      page.getByTestId("campaign-ai-recommendation-active"),
    ).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => (await readVisibleKolIds(page))[0])
      .toBe(POOL_IDS[0]);
    await expect(page.getByTestId("campaign-refine-reset")).toHaveCount(0);
    await expect(
      page.getByTestId("campaign-refine-toast-success"),
    ).toHaveCount(0);
  });
});

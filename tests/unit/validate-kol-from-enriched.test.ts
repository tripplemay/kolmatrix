/**
 * MVP-kol-seed-redo F002 path-2 · Unit fixtures for the enriched-seed
 * validator.
 *
 * Five fixtures cover the contract end-to-end without the network:
 *   1. parseArgs accepts --dry-run + --limit and rejects bad input.
 *   2. parseHandle pulls @handle out of the URL forms enriched.json
 *      uses, and returns null for unrecognisable URLs.
 *   3. classifyChannel maps a live response into one of the five
 *      ValidationStatus codes (real_kol / below_threshold /
 *      non_gaming_topic / handle_not_found / no_statistics).
 *   4. runValidate iterates the entries, swallows transient errors as
 *      handle_not_found, and records each result via onResult.
 *   5. summarize tallies the by-status histogram and surfaces the top
 *      real KOLs sorted by live subscriber count.
 */
import { describe, expect, it, vi } from "vitest";

import {
  classifyChannel,
  parseArgs,
  parseHandle,
  runValidate,
  summarize,
  type EnrichedEntry,
  type ValidationClient,
} from "@/../scripts/validate-kol-from-enriched";

describe("parseArgs", () => {
  it("defaults to live + gaming + no limit", () => {
    expect(parseArgs([])).toEqual({ dryRun: false, nonGamingOnly: false });
  });

  it("accepts --dry-run + --limit", () => {
    expect(parseArgs(["--dry-run", "--limit", "10"])).toEqual({
      dryRun: true,
      nonGamingOnly: false,
      limit: 10,
    });
  });

  it("flips to non-gaming when --non-gaming-only is set", () => {
    expect(parseArgs(["--non-gaming-only", "--limit", "1400"])).toEqual({
      dryRun: false,
      nonGamingOnly: true,
      limit: 1400,
    });
  });

  it("rejects bad --limit", () => {
    expect(() => parseArgs(["--limit", "0"])).toThrow();
    expect(() => parseArgs(["--limit", "junk"])).toThrow();
  });
});

describe("parseHandle", () => {
  it("extracts @handle from a /@x URL", () => {
    expect(parseHandle("https://www.youtube.com/@NintendoGalaxy")).toBe("@NintendoGalaxy");
    expect(parseHandle("https://youtube.com/@some_handle.123")).toBe("@some_handle.123");
  });

  it("returns null when there is no @segment", () => {
    expect(parseHandle("https://www.youtube.com/c/SomeChannel")).toBeNull();
    expect(parseHandle("https://www.youtube.com/channel/UC_xxx")).toBeNull();
    expect(parseHandle("not a url")).toBeNull();
  });
});

describe("classifyChannel", () => {
  const entry: EnrichedEntry = {
    idx: 1,
    name: "NintendoGalaxy",
    url: "https://www.youtube.com/@NintendoGalaxy",
    region: "德国",
    followers: 9000,
    is_gaming: true,
    confidence: "high",
  };

  it("status=real_kol when subs ≥ 10K and topics look gaming", () => {
    const out = classifyChannel(
      {
        id: "UC_real",
        snippet: { country: "DE" },
        statistics: { subscriberCount: "150000", videoCount: "200", viewCount: "1000000" },
        topicDetails: {
          topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
        },
      },
      entry
    );
    expect(out.status).toBe("real_kol");
    expect(out.liveSubscriberCount).toBe(150_000);
    expect(out.channelId).toBe("UC_real");
  });

  it("status=below_threshold when subs < 10K", () => {
    const out = classifyChannel(
      {
        id: "UC_micro",
        snippet: {},
        statistics: { subscriberCount: "5000", videoCount: "100" },
        topicDetails: { topicCategories: ["https://en.wikipedia.org/wiki/Action_game"] },
      },
      entry
    );
    expect(out.status).toBe("below_threshold");
  });

  it("status=non_gaming_topic when subs ≥ 10K but topics aren't gaming", () => {
    const out = classifyChannel(
      {
        id: "UC_cooking",
        snippet: {},
        statistics: { subscriberCount: "200000", videoCount: "300" },
        topicDetails: {
          topicCategories: ["https://en.wikipedia.org/wiki/Cuisine"],
        },
      },
      entry
    );
    expect(out.status).toBe("non_gaming_topic");
  });

  it("status=handle_not_found when YouTube returned null", () => {
    const out = classifyChannel(null, entry);
    expect(out.status).toBe("handle_not_found");
    expect(out.liveSubscriberCount).toBeNull();
  });

  it("status=no_statistics when channel exists but has no stats block", () => {
    const out = classifyChannel(
      { id: "UC_dead", snippet: { country: "JP" } },
      entry
    );
    expect(out.status).toBe("no_statistics");
    expect(out.channelId).toBe("UC_dead");
  });
});

describe("runValidate", () => {
  const entries: EnrichedEntry[] = [
    {
      idx: 1,
      name: "Real",
      url: "https://www.youtube.com/@real",
      region: "美国",
      followers: 5000,
      is_gaming: true,
      confidence: "high",
    },
    {
      idx: 2,
      name: "Micro",
      url: "https://www.youtube.com/@micro",
      region: "美国",
      followers: 2000,
      is_gaming: true,
      confidence: "low",
    },
    {
      idx: 3,
      name: "Bad URL",
      url: "https://www.youtube.com/c/oldschool",
      region: "美国",
      followers: 100,
      is_gaming: true,
      confidence: "medium",
    },
  ];

  it("dispatches one fetchByHandle call per parseable entry, skips unparseable URLs, fires onResult for each", async () => {
    const client: ValidationClient = {
      fetchByHandle: vi.fn(async (handle: string) => {
        if (handle === "@real") {
          return {
            id: "UC_real",
            snippet: {},
            statistics: { subscriberCount: "120000", videoCount: "300" },
            topicDetails: {
              topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
            },
          };
        }
        if (handle === "@micro") {
          return {
            id: "UC_micro",
            snippet: {},
            statistics: { subscriberCount: "1500", videoCount: "30" },
            topicDetails: {
              topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
            },
          };
        }
        return null;
      }),
    };
    const seen: string[] = [];
    const results = await runValidate(entries, {
      client,
      retry: { sleep: async () => {} },
      onResult: (r) => seen.push(`${r.idx}:${r.status}`),
    });
    // Bad URL doesn't reach fetchByHandle.
    expect(client.fetchByHandle).toHaveBeenCalledTimes(2);
    expect(results.map((r) => r.status)).toEqual([
      "real_kol",
      "below_threshold",
      "handle_not_found",
    ]);
    expect(seen).toEqual([
      "1:real_kol",
      "2:below_threshold",
      "3:handle_not_found",
    ]);
  });

  it("treats persistent fetch errors as handle_not_found", async () => {
    const client: ValidationClient = {
      fetchByHandle: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const results = await runValidate([entries[0]!], {
      client,
      retry: { backoffsMs: [1, 1, 1], sleep: async () => {} },
    });
    expect(results[0]!.status).toBe("handle_not_found");
  });
});

describe("summarize", () => {
  it("counts every status and surfaces real KOLs sorted desc by subs", () => {
    const summary = summarize([
      {
        idx: 1, enrichedName: "A", handle: "@a", enrichedFollowers: 1000,
        liveSubscriberCount: 50_000, liveVideoCount: 100, liveCountry: "US",
        liveTopicCategories: [], status: "real_kol", channelId: "UC_a",
      },
      {
        idx: 2, enrichedName: "B", handle: "@b", enrichedFollowers: 2000,
        liveSubscriberCount: 200_000, liveVideoCount: 200, liveCountry: "US",
        liveTopicCategories: [], status: "real_kol", channelId: "UC_b",
      },
      {
        idx: 3, enrichedName: "C", handle: "@c", enrichedFollowers: 100,
        liveSubscriberCount: 500, liveVideoCount: 10, liveCountry: null,
        liveTopicCategories: [], status: "below_threshold", channelId: "UC_c",
      },
      {
        idx: 4, enrichedName: "D", handle: "@d", enrichedFollowers: 10,
        liveSubscriberCount: null, liveVideoCount: null, liveCountry: null,
        liveTopicCategories: null, status: "handle_not_found", channelId: null,
      },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.byStatus.real_kol).toBe(2);
    expect(summary.byStatus.below_threshold).toBe(1);
    expect(summary.byStatus.handle_not_found).toBe(1);
    // B (200K) before A (50K).
    expect(summary.realKols.map((r) => r.idx)).toEqual([2, 1]);
  });
});

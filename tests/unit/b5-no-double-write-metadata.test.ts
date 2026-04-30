import type { youtube_v3 } from "googleapis";
import { describe, expect, it } from "vitest";

import { mapToUpsertPayload } from "@/lib/kol-sync/import";
import type { RawKolData } from "@/lib/kol-sync/types";

import { mapToEnrichmentUpdate } from "@/../scripts/enrich-kol-from-youtube";
import { mapToKolRow } from "@/../scripts/import-kol-from-youtube";

describe("B5-F005 no-double-write metadata guardrail", () => {
  it("seed import writes promoted YouTube fields to columns, not metadata.youtube", () => {
    const row = mapToKolRow({
      id: "UC_seed",
      handle: "@seeded",
      title: "Seeded Channel",
      description: "Gaming channel",
      country: "US",
      defaultLanguage: "en",
      publishedAt: "2018-01-01T00:00:00Z",
      thumbnailUrl: "https://yt.example/avatar.jpg",
      bannerUrl: "https://yt.example/banner.jpg",
      subscriberCount: 250_000,
      videoCount: 320,
      viewCount: 50_000_000,
      topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
      matrixRegion: "US",
      matrixKeyword: "gaming",
      scrapedAt: "2026-04-30T00:00:00.000Z",
    });

    expect(row).not.toBeNull();
    expect(row!.channelCreatedAt).toEqual(new Date("2018-01-01T00:00:00Z"));
    expect(row!.videoCount).toBe(320);
    expect(row!.totalViewCount).toEqual(BigInt(50_000_000));
    expect(row!.bannerUrl).toBe("https://yt.example/banner.jpg");
    expect(row!.metadata.youtube).toEqual({
      channelId: "UC_seed",
      topicCategories: ["https://en.wikipedia.org/wiki/Action_game"],
      scrapedAt: "2026-04-30T00:00:00.000Z",
    });
    expect(row!.metadata.youtube).not.toHaveProperty("channelCreatedAt");
    expect(row!.metadata.youtube).not.toHaveProperty("videoCount");
    expect(row!.metadata.youtube).not.toHaveProperty("totalViewCount");
    expect(row!.metadata.youtube).not.toHaveProperty("bannerUrl");
  });

  it("daily sync payload preserves only lightweight provenance under metadata.youtube", () => {
    const payload = mapToUpsertPayload(
      {
        externalId: "UC_daily",
        platform: "youtube",
        handle: "@daily",
        displayName: "Daily Channel",
        description: "Uploads every day",
        country: "JP",
        language: "ja",
        thumbnailUrl: "https://yt.example/daily-avatar.jpg",
        bannerUrl: "https://yt.example/daily-banner.jpg",
        subscriberCount: 150_000,
        videoCount: 480,
        viewCount: 12_000_000,
        topicCategories: ["https://en.wikipedia.org/wiki/Strategy_video_game"],
        publishedAt: "2017-05-04T00:00:00Z",
        scrapedAt: "2026-04-30T12:00:00.000Z",
        raw: {
          matrixRegion: "JP",
          matrixKeyword: "gaming",
        },
      } satisfies RawKolData,
      {
        source: "youtube-api-daily",
        isDemo: false,
        nowIso: "2026-04-30T12:00:00.000Z",
      }
    );

    expect(payload).not.toBeNull();
    expect(payload!.channelCreatedAt).toEqual(new Date("2017-05-04T00:00:00Z"));
    expect(payload!.videoCount).toBe(480);
    expect(payload!.totalViewCount).toEqual(BigInt(12_000_000));
    expect(payload!.bannerUrl).toBe("https://yt.example/daily-banner.jpg");
    expect(payload!.metadata.youtube).toEqual({
      topicCategories: ["https://en.wikipedia.org/wiki/Strategy_video_game"],
      scrapedAt: "2026-04-30T12:00:00.000Z",
    });
    expect(payload!.metadata.youtube).not.toHaveProperty("channelCreatedAt");
    expect(payload!.metadata.youtube).not.toHaveProperty("videoCount");
    expect(payload!.metadata.youtube).not.toHaveProperty("totalViewCount");
    expect(payload!.metadata.youtube).not.toHaveProperty("bannerUrl");
  });

  it("enrichment mapper emits only dedicated column updates", () => {
    const update = mapToEnrichmentUpdate({
      snippet: { publishedAt: "2016-03-02T00:00:00Z" },
      statistics: {
        videoCount: "640",
        viewCount: "987654321",
      },
      brandingSettings: {
        image: {
          bannerExternalUrl: "https://yt.example/enrich-banner.jpg",
        },
      },
    } satisfies youtube_v3.Schema$Channel);

    expect(Object.keys(update).sort()).toEqual([
      "bannerUrl",
      "channelCreatedAt",
      "totalViewCount",
      "videoCount",
    ]);
    expect(update.channelCreatedAt).toEqual(new Date("2016-03-02T00:00:00Z"));
    expect(update.videoCount).toBe(640);
    expect(update.totalViewCount).toEqual(BigInt("987654321"));
    expect(update.bannerUrl).toBe("https://yt.example/enrich-banner.jpg");
  });
});

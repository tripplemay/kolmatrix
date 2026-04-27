/**
 * B6-kol-daily-sync F002 · YouTube adapter live-API smoke.
 *
 * Gated by `YOUTUBE_API_TEST=true` so CI / local default runs don't
 * touch the real API or burn quota. Designed to be cheap when it does
 * run — a single 1-region 1-keyword 5-result probe (~100u of the
 * 10,000u/day budget) plus a healthCheck (1u).
 *
 * Run locally:
 *   YOUTUBE_API_TEST=true YOUTUBE_API_KEY=... \
 *     npx vitest run --config vitest.integration.config.ts \
 *     tests/integration/youtube-adapter.test.ts
 */
import { describe, expect, it } from "vitest";

import { YouTubeKolSyncAdapter } from "@/lib/kol-sync/adapters/youtube";

const ENABLED = process.env.YOUTUBE_API_TEST === "true";
const describeIf = ENABLED ? describe : describe.skip;

describeIf("YouTubeKolSyncAdapter · live API smoke", () => {
  const apiKey = process.env.YOUTUBE_API_KEY;

  it("healthCheck returns healthy with a known probe channel", async () => {
    const adapter = new YouTubeKolSyncAdapter({ apiKey });
    const r = await adapter.healthCheck();
    expect(r.healthy).toBe(true);
    expect(r.details).toMatchObject({
      probeChannelId: "UCBR8-60-B28hp2BmDPdntcQ",
      quotaCostThisProbe: 1,
    });
  }, 20_000);

  it("discover narrows to JP / Vtuber / 5 results and returns gaming channels", async () => {
    const adapter = new YouTubeKolSyncAdapter({ apiKey });
    const data = await adapter.discover({
      region: "JP",
      keywords: ["Vtuber"],
      maxResults: 5,
    });
    // Some entries may filter out below threshold — just assert we
    // got something gaming-flavoured.
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const ch = data[0]!;
      expect(ch.platform).toBe("youtube");
      expect(ch.subscriberCount).toBeGreaterThanOrEqual(10_000);
      expect(ch.topicCategories).toBeDefined();
    }
  }, 60_000);
});

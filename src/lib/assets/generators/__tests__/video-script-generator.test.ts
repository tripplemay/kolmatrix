/**
 * BL-025-F003 · Video script generator unit specs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateVideoScriptContent,
  VideoScriptContentParseError,
  __TEST_ONLY__,
} from "../video-script-generator";

beforeEach(() => {
  process.env.AIGCGATEWAY_BASE_URL = "https://aigc.test";
  process.env.AIGCGATEWAY_API_KEY = "k";
});

afterEach(() => {
  delete process.env.AIGCGATEWAY_BASE_URL;
  delete process.env.AIGCGATEWAY_API_KEY;
});

const product = {
  name: "Honor of Kings",
  category: "MOBA",
  targetAudience: "16-30 SEA",
  uniqueSellingPoints: "5v5 120Hz",
};

function chatResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "trace-v1",
      model: "claude-haiku-4.5",
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 60, completion_tokens: 200, total_tokens: 260 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

describe("generateVideoScriptContent", () => {
  it("validates a bare {title, script} object and surfaces durationHintSec when present", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      chatResponse(
        JSON.stringify({
          title: "HoK 60s Promo",
          script: "Scene 1: ...",
          durationHintSec: 60,
        })
      )
    );

    const result = await generateVideoScriptContent({ product, fetchImpl });
    expect(result.content.title).toBe("HoK 60s Promo");
    expect(result.content.durationHintSec).toBe(60);
    expect(result.traceId).toBe("trace-v1");
  });

  it("tolerates the {videoScripts:[{title, script}]} envelope shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      chatResponse(
        JSON.stringify({
          videoScripts: [{ title: "T", script: "S" }],
        })
      )
    );

    const result = await generateVideoScriptContent({ product, fetchImpl });
    expect(result.content.title).toBe("T");
  });

  it("throws VideoScriptContentParseError on missing required fields", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ title: "no script" })));

    await expect(
      generateVideoScriptContent({ product, fetchImpl })
    ).rejects.toBeInstanceOf(VideoScriptContentParseError);
  });

  it("buildUserPrompt swaps the format hint line for tiktok_15s", () => {
    const prompt = __TEST_ONLY__.buildUserPrompt({
      product,
      formatHint: "tiktok_15s",
    });
    expect(prompt).toContain("TikTok 15-second");
  });
});

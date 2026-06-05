import { describe, expect, it } from "vitest";

import {
  buildSmartMatchEvent,
  DEFAULT_TOP_K,
} from "@/lib/discovery/smart-match";

// BL-084-F001: runSmartMatch is the single emitter of
// `smart_match.invoked`. The campaignId-presence contract is captured by
// the pure `buildSmartMatchEvent` builder so it is testable without a DB.
describe("buildSmartMatchEvent (BL-084-F001 campaignId telemetry)", () => {
  const base = {
    tenantId: "tenant-1",
    actorId: "user-1",
    productId: "prod-1",
    resultCount: 30,
    durationMs: 1234,
    embeddedJustInTime: false,
  };

  it("includes campaignId in the payload when provided", () => {
    const event = buildSmartMatchEvent({
      ...base,
      campaignId: "camp-9",
    });
    expect(event.type).toBe("smart_match.invoked");
    expect(event.tenantId).toBe("tenant-1");
    expect(event.actorId).toBe("user-1");
    expect(event.resourceId).toBe("prod-1");
    expect(event.payload).toMatchObject({
      topK: 30,
      durationMs: 1234,
      embeddedJustInTime: false,
      campaignId: "camp-9",
    });
  });

  it("omits campaignId from the payload when not provided", () => {
    const event = buildSmartMatchEvent(base);
    expect(event.payload).toMatchObject({
      topK: 30,
      durationMs: 1234,
      embeddedJustInTime: false,
    });
    expect(event.payload).not.toHaveProperty("campaignId");
  });

  it("omits campaignId when passed an empty string (falsy guard)", () => {
    const event = buildSmartMatchEvent({ ...base, campaignId: "" });
    expect(event.payload).not.toHaveProperty("campaignId");
  });

  it("DEFAULT_TOP_K is 30 (BL-084-F001 wider recall for LLM rerank)", () => {
    expect(DEFAULT_TOP_K).toBe(30);
  });
});

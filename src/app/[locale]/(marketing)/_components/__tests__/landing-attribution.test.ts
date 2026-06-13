/**
 * BL-115-F001 · landing attribution spec — UTM capture/persistence/merge +
 * the analytics beacon (jsdom).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureUtm, readAttribution, sendLandingEvent } from "../landing-attribution";

beforeEach(() => {
  document.cookie = "kqlm_attribution=; path=/; max-age=0";
  window.history.replaceState({}, "", "/en");
});

describe("BL-115-F001 landing attribution", () => {
  it("captureUtm persists URL utm to a cookie that survives later navigation", () => {
    window.history.replaceState({}, "", "/en?utm_source=google&utm_medium=cpc&utm_campaign=launch");
    captureUtm();

    // Navigate to a utm-less path; cookie attribution must persist.
    window.history.replaceState({}, "", "/en/pricing");
    const attr = readAttribution();
    expect(attr.utmSource).toBe("google");
    expect(attr.utmMedium).toBe("cpc");
    expect(attr.utmCampaign).toBe("launch");
    expect(attr.landingPath).toBe("/en/pricing");
  });

  it("readAttribution prefers the live URL utm over the cookie", () => {
    document.cookie =
      "kqlm_attribution=" + encodeURIComponent(JSON.stringify({ utm_source: "old" })) + "; path=/";
    window.history.replaceState({}, "", "/en?utm_source=fresh");
    expect(readAttribution().utmSource).toBe("fresh");
  });

  it("captureUtm does not overwrite existing attribution on a utm-less visit", () => {
    document.cookie =
      "kqlm_attribution=" + encodeURIComponent(JSON.stringify({ utm_source: "keep" })) + "; path=/";
    window.history.replaceState({}, "", "/en");
    captureUtm();
    expect(readAttribution().utmSource).toBe("keep");
  });

  it("sendLandingEvent beacons the event to /api/landing-event", () => {
    const beacon = vi.fn();
    (navigator as unknown as { sendBeacon: unknown }).sendBeacon = beacon;
    sendLandingEvent("cta_click", { cta: "hero" });
    expect(beacon).toHaveBeenCalledOnce();
    expect(beacon).toHaveBeenCalledWith("/api/landing-event", expect.anything());
  });
});

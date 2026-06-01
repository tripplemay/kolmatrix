/**
 * BL-081-F001 · Mapper-level coverage for the fork `location` → country
 * wiring added in `adapters/apify-kol.ts`.
 *
 * The pure-function `mapApifyKolItemToRawKolData` previously hard-coded
 * `country: null`; these cases pin the new behaviour (normalised alpha-2
 * when the fork supplies a recognisable location, null otherwise) while
 * confirming the rest of the projection is unchanged.
 */
import { describe, expect, it } from "vitest";

import { mapApifyKolItemToRawKolData } from "../adapters/apify-kol";
import type { ApifyKolItem } from "../../apify-kol/schemas";

const FROZEN_NOW = () => "2026-06-01T00:00:00.000Z";

function makeItem(overrides: Partial<ApifyKolItem> = {}): ApifyKolItem {
  return {
    id: "abc123",
    platform: "youtube",
    platformUserId: "abc123",
    username: "creator",
    ...overrides,
  } as ApifyKolItem;
}

describe("mapApifyKolItemToRawKolData — country from fork location", () => {
  it("normalises a recognisable location to ISO alpha-2", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ location: "United States" }),
      FROZEN_NOW
    );
    expect(mapped?.country).toBe("US");
  });

  it("normalises a diacritic alias (Türkiye → TR)", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ location: "Türkiye" }),
      FROZEN_NOW
    );
    expect(mapped?.country).toBe("TR");
  });

  it("yields null country when the fork omits location (TikTok / Instagram)", () => {
    const mapped = mapApifyKolItemToRawKolData(makeItem(), FROZEN_NOW);
    expect(mapped?.country).toBeNull();
  });

  it("yields null country for an unrecognisable location", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ location: "Mars" }),
      FROZEN_NOW
    );
    expect(mapped?.country).toBeNull();
  });

  it("leaves the rest of the projection intact", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ location: "Japan", displayName: "Creator JP", followers: 1000 }),
      FROZEN_NOW
    );
    expect(mapped).toMatchObject({
      externalId: "abc123",
      platform: "youtube",
      handle: "creator",
      displayName: "Creator JP",
      country: "JP",
      language: null,
      subscriberCount: 1000,
      scrapedAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("still drops items missing id / username", () => {
    expect(
      mapApifyKolItemToRawKolData(makeItem({ username: "" }), FROZEN_NOW)
    ).toBeNull();
  });
});

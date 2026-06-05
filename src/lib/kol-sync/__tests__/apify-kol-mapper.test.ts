/**
 * BL-081-F001 · Mapper-level coverage for the fork `location` → country
 * wiring added in `adapters/apify-kol.ts`.
 *
 * The pure-function `mapApifyKolItemToRawKolData` previously hard-coded
 * `country: null`; these cases pin the new behaviour (normalised alpha-2
 * when the fork supplies a recognisable location, null otherwise) while
 * confirming the rest of the projection is unchanged.
 */
import { describe, expect, it, vi } from "vitest";

import {
  mapApifyKolItemToRawKolData,
  sanitizeForkEmails,
} from "../adapters/apify-kol";
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

describe("mapApifyKolItemToRawKolData — platformUserId persistence (BL-082-F001)", () => {
  it("persists a YouTube UC channel id", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ platform: "youtube", platformUserId: "UCnQ4TDbESxZ47uBH6cB_Nrg" }),
      FROZEN_NOW
    );
    expect(mapped?.platformUserId).toBe("UCnQ4TDbESxZ47uBH6cB_Nrg");
  });

  it("persists a TikTok / Instagram numeric platformUserId", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ platform: "tiktok", platformUserId: "6766325527592272902" }),
      FROZEN_NOW
    );
    expect(mapped?.platformUserId).toBe("6766325527592272902");
  });

  it("falls back to null when platformUserId is empty", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ platformUserId: "" }),
      FROZEN_NOW
    );
    expect(mapped?.platformUserId).toBeNull();
  });
});

describe("mapApifyKolItemToRawKolData — fork business emails (BL-083-F001)", () => {
  it("surfaces a single fork email onto emails[]", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ emails: ["gamertechtoronto@gmail.com"] }),
      FROZEN_NOW
    );
    expect(mapped?.emails).toEqual(["gamertechtoronto@gmail.com"]);
  });

  it("preserves every email + order when the fork returns multiple", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ emails: ["a@b.com", "Chandler@badmoontalent.com"] }),
      FROZEN_NOW
    );
    expect(mapped?.emails).toEqual(["a@b.com", "Chandler@badmoontalent.com"]);
  });

  it("yields null emails when the fork omits the field", () => {
    const mapped = mapApifyKolItemToRawKolData(makeItem(), FROZEN_NOW);
    expect(mapped?.emails).toBeNull();
  });

  it("falls back to null + warns when emails contains a non-string element", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mapped = mapApifyKolItemToRawKolData(
      // simulate a fork contract drift that bypasses the page schema
      makeItem({ emails: ["a@b.com", 42] as unknown as string[] }),
      FROZEN_NOW
    );
    expect(mapped?.emails).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("falls back to null + warns when emails is not an array", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ emails: "a@b.com" as unknown as string[] }),
      FROZEN_NOW
    );
    expect(mapped?.emails).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("drops whitespace-only entries and yields null for an all-empty array", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ emails: ["  ", ""] }),
      FROZEN_NOW
    );
    expect(mapped?.emails).toBeNull();
  });

  it("never overwrites the legacy single email field (mapper leaves it untouched)", () => {
    const mapped = mapApifyKolItemToRawKolData(
      makeItem({ emails: ["a@b.com"] }),
      FROZEN_NOW
    );
    // RawKolData carries no `email` scalar — F003 owns the kol.email column;
    // the mapper only ever fills the new emails[] array.
    expect(mapped).not.toHaveProperty("email");
    expect(mapped?.emails).toEqual(["a@b.com"]);
  });
});

// BL-083-F001 fix-round 1 — direct unit coverage of the exported
// `sanitizeForkEmails()` helper. The mapper-level cases above exercise it
// transitively, but the Reviewer's verifying round flagged the absence of
// tests naming the function itself; these pin its contract in isolation
// (per features.json F001 acceptance "单测 ≥4 case").
describe("sanitizeForkEmails (BL-083-F001)", () => {
  const EXT = "youtube:UC_test";

  it("(1) keeps a single valid fork email verbatim", () => {
    expect(sanitizeForkEmails(["a@b.com"], EXT)).toEqual(["a@b.com"]);
  });

  it("(2) preserves a multi-email array in order", () => {
    expect(
      sanitizeForkEmails(["a@b.com", "Chandler@badmoontalent.com"], EXT)
    ).toEqual(["a@b.com", "Chandler@badmoontalent.com"]);
  });

  it("(3) returns null (no warn) for undefined / null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(sanitizeForkEmails(undefined, EXT)).toBeNull();
    expect(sanitizeForkEmails(null, EXT)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("(4) returns null + warns when the array contains a non-string element", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(sanitizeForkEmails(["a@b.com", 42], EXT)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("(5) returns null + warns when the value is not an array", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(sanitizeForkEmails("a@b.com", EXT)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("(6) trims entries and drops blanks; an all-blank array yields null", () => {
    expect(sanitizeForkEmails(["  a@b.com  ", ""], EXT)).toEqual(["a@b.com"]);
    expect(sanitizeForkEmails(["  ", ""], EXT)).toBeNull();
  });
});

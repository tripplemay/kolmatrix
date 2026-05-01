import { describe, expect, it } from "vitest";

import { formatRelativeTime, resolveActivityMeta } from "../recent-activity";

describe("resolveActivityMeta", () => {
  it("maps a known action to its icon/accent/i18n key", () => {
    const meta = resolveActivityMeta("campaign.kol.added");
    expect(meta).toEqual({
      icon: "group_add",
      accent: "cyan",
      i18nKey: "campaignKolAdded",
    });
  });

  it("returns the fallback meta for an unknown action", () => {
    const meta = resolveActivityMeta("totally.unknown.event");
    expect(meta).toEqual({
      icon: "info",
      accent: "secondary",
      i18nKey: "unknown",
    });
  });

  it("covers the full canonical action registry without throwing", () => {
    const expectedKeys = [
      "campaign.kol.added",
      "campaign.kol.removed",
      "campaign.kol.status_changed",
      "campaign.kol.fee_updated",
      "campaign.status_transitioned",
      "campaign.fields_updated",
      "campaign.revenue_recorded",
      "kol.relationship_changed",
      "kol.bulk_added_to_campaign",
    ];
    for (const action of expectedKeys) {
      const meta = resolveActivityMeta(action);
      expect(meta.i18nKey).not.toBe("unknown");
      expect(meta.icon).not.toBe("info");
      expect(["cyan", "purple", "secondary"]).toContain(meta.accent);
    }
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for sub-minute deltas", () => {
    expect(formatRelativeTime(new Date(Date.now() - 30_000))).toBe("just now");
  });

  it("returns the right minute count for sub-hour deltas", () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(new Date(Date.now() - 59 * 60_000))).toBe("59m ago");
  });

  it("returns the right hour count for sub-day deltas", () => {
    expect(formatRelativeTime(new Date(Date.now() - 1 * 3600_000))).toBe("1h ago");
    expect(formatRelativeTime(new Date(Date.now() - 12 * 3600_000))).toBe("12h ago");
    expect(formatRelativeTime(new Date(Date.now() - 23 * 3600_000))).toBe("23h ago");
  });

  it("returns the right day count for ≥24h deltas", () => {
    expect(formatRelativeTime(new Date(Date.now() - 24 * 3600_000))).toBe("1d ago");
    expect(formatRelativeTime(new Date(Date.now() - 7 * 24 * 3600_000))).toBe("7d ago");
  });
});

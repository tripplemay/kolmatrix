/**
 * MVP-vf-F006 fix · Regression guard for the F005 i18n dot-key bug.
 *
 * CI run 24963708626 surfaced `INVALID_KEY: Namespace keys cannot
 * contain the character "."` because the activity-timeline action
 * names ("campaign.kol.added") were used verbatim as next-intl leaf
 * keys. The fix renames the i18n keys to underscored variants and
 * lets ActivityTimelineCard map between them. This test locks the
 * fix in by:
 *   - asserting every audit-log action string in ACTION_META has a
 *     corresponding underscored bundle key in en.json;
 *   - rejecting any dotted action key under
 *     campaigns.detail.insights.activity.actions across all locales.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../../../../..");
const CARD_SRC = readFileSync(
  resolve(__dirname, "../ActivityTimelineCard.tsx"),
  "utf8"
);

interface Bundle {
  campaigns?: {
    detail?: {
      insights?: {
        activity?: {
          actions?: Record<string, string>;
        };
      };
    };
  };
}

function loadActions(locale: string): Record<string, string> | undefined {
  const raw = readFileSync(
    resolve(REPO_ROOT, "messages", `${locale}.json`),
    "utf8"
  );
  const parsed = JSON.parse(raw) as Bundle;
  return parsed.campaigns?.detail?.insights?.activity?.actions;
}

const LOCALES = ["en", "zh", "ja", "ko", "es"] as const;

describe("activity-timeline i18n key shape (no dots in leaf keys)", () => {
  it("ActivityTimelineCard's ACTION_META lists exactly the keys present in en.json", () => {
    const enActions = loadActions("en");
    expect(enActions).toBeDefined();
    const enKeys = Object.keys(enActions!).sort();
    // Pull every `key: "..."` literal out of the source map.
    const metaKeys = Array.from(
      CARD_SRC.matchAll(/key:\s*"([a-zA-Z_]+)"/g)
    )
      .map((m) => m[1]!)
      .sort();
    expect(metaKeys).toEqual(enKeys);
  });

  it("no leaf key under activity.actions contains a dot, in any locale", () => {
    for (const locale of LOCALES) {
      const actions = loadActions(locale);
      expect(actions, `locale=${locale}`).toBeDefined();
      for (const key of Object.keys(actions!)) {
        expect(key, `locale=${locale} key=${key}`).not.toMatch(/\./);
      }
    }
  });

  it("every locale provides the same underscored keys (no drift)", () => {
    const baseline = Object.keys(loadActions("en") ?? {}).sort();
    for (const locale of LOCALES) {
      expect(
        Object.keys(loadActions(locale) ?? {}).sort(),
        `locale=${locale}`
      ).toEqual(baseline);
    }
  });
});

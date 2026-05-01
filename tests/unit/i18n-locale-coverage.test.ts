/**
 * MVP-i18n-F006 · Locale coverage gate (covers F002–F005).
 *
 * One test per locale that asserts:
 *   - every leaf in en.json has a matching leaf in the locale file
 *   - the locale's leaf is not equal to the en source value EXCEPT
 *     for the curated allowlist of intentionally-kept-English values
 *     (locale display labels, brand/glossary keep_en strings, tech
 *     codes, numeric ranges, market codes — see KEEP_AS_EN_PATHS
 *     below).
 *
 * The allowlist is the union of the post-F005 final state across all
 * four locales. If a future PR adds a new en.json key, this gate
 * fails until the translator runs against every locale (intended
 * behaviour — keeps locale drift visible at PR time).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../..");

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function load(locale: string): Record<string, Json> {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, `messages/${locale}.json`), "utf8")) as Record<
    string,
    Json
  >;
}

function* leaves(obj: Json, path: string[] = []): Generator<{ path: string; value: string }> {
  if (typeof obj === "string") {
    yield { path: path.join("."), value: obj };
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) yield* leaves(obj[i]!, [...path, String(i)]);
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const k of Object.keys(obj))
      yield* leaves((obj as Record<string, Json>)[k]!, [...path, k]);
  }
}

function getAt(obj: Json, dottedPath: string): Json | undefined {
  const keys = dottedPath.split(".");
  let cur: Json | undefined = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, Json>)[k];
  }
  return cur;
}

/**
 * Paths intentionally kept English in every locale. Adding a path here
 * is a deliberate translation-policy decision; reviewer should push
 * back if a translatable string appears here.
 */
const KEEP_AS_EN_PATHS = new Set<string>([
  // Locale display labels — language switchers show each language in
  // its own native spelling regardless of UI locale.
  "topbar.locale.en",
  "topbar.locale.zh",
  "topbar.locale.ja",
  "topbar.locale.ko",
  "topbar.locale.es",

  // Auth form placeholders + studio names (sample text)
  "auth.login.emailPlaceholder",
  "auth.login.orDivider",
  "auth.requestAccess.emailPlaceholder",
  "auth.requestAccess.firstNamePlaceholder",
  "auth.requestAccess.lastNamePlaceholder",
  "auth.requestAccess.studio1Name",
  "auth.requestAccess.studio2Name",
  "auth.requestAccess.studio3Name",
  "auth.requestAccess.campaignsOption05",
  "auth.requestAccess.campaignsOption620",
  "auth.requestAccess.campaignsOption2150",
  "auth.requestAccess.campaignsOption50plus",

  // Tech / brand codes — glossary keep_en
  "dashboard.quickActions.comingSoon",
  "knowledgeBase.modal.platformPc",
  "knowledgeBase.modal.platformWeb3",
  "knowledgeBase.modal.downloadUrlPlaceholder",
  "knowledgeBase.mockActivity.heading2",
  "knowledgeBase.mockActivity.heading3",
  "discovery.filters.brandSafetyG",
  "discovery.filters.brandSafetyPG",
  "discovery.filters.brandSafetyPG13",
  "discovery.filters.brandSafetyR",
  "discovery.header.aiSmartMatch",
  // B7a-F002 — Smart Match dialog keys land in en+zh now (B 方案
  // split lock 2026-04-28 16:45). ja/ko/es intentionally mirror en
  // until B7b F006 runs `npm run i18n:translate` for the four
  // languages. Reviewer should ensure these paths are removed once
  // B7b lands real translations.
  "discovery.smartMatch.button",
  "discovery.smartMatch.title",
  "discovery.smartMatch.subtitle",
  "discovery.smartMatch.productLabel",
  "discovery.smartMatch.productPlaceholder",
  "discovery.smartMatch.noProducts",
  "discovery.smartMatch.run",
  "discovery.smartMatch.loading",
  "discovery.smartMatch.empty",
  "discovery.smartMatch.metaCount",
  "discovery.smartMatch.metaLatency",
  "discovery.smartMatch.ringLabel",
  "discovery.smartMatch.followers",
  "discovery.smartMatch.saveAllToCampaign",
  "discovery.smartMatch.close",
  "discovery.smartMatch.errors.pickProduct",
  "discovery.smartMatch.errors.productMissing",
  "discovery.smartMatch.errors.embeddingDown",
  "discovery.smartMatch.errors.unauthorized",
  "discovery.smartMatch.errors.network",
  "discovery.smartMatch.errors.generic",
  "campaigns.new.smartMatch.banner",
  // B5-F003 / F004 / F006 paths previously seeded as English in
  // zh/ja/ko/es were removed in F005 after `npm run i18n:translate
  // -- --target {zh,ja,ko,es}` landed real translations
  // (commit 2026-04-30, batch B5).
  // Exception: regionGroup_asia in Spanish — "Asia" is spelled the
  // same in en + es. zh/ja/ko all translated correctly. Keep this
  // path on the allowlist so the cross-locale gate passes; reviewer
  // should NOT remove it without confirming es maintainers want a
  // synonym (none exists in standard Spanish).
  "discovery.filters.regionGroup_asia",
  "discovery.card.engagement",
  "discovery.card.unavailableMetric",
  "discovery.regions.VN",
  "discovery.categories.MOBA",
  "discovery.categories.RPG",
  "discovery.categories.FPS",
  "discovery.categories.Casual",
  "discovery.categories.Shooter",
  "discovery.categories.Sandbox",
  "discovery.platforms.youtube",
  "discovery.platforms.tiktok",
  "discovery.platforms.twitch",
  "discovery.platforms.bilibili",
  "discovery.platforms.twitter",
  "discovery.platforms.instagram",
  "database.table.engagement",
  "campaigns.filters.dateTo",
  "campaigns.table.kols",
  "campaigns.table.roi",
  "campaigns.detail.kpi.roi",
  "campaigns.detail.revenue.placeholder",
  "campaigns.detail.insights.health.noEndDate",
  "campaigns.new.markets.global",
  "campaigns.new.markets.us",
  "campaigns.new.markets.eu",
  "campaigns.new.markets.latam",
  "outreach.performance.statWindowValue",
  "outreach.domainHealth.dkim",
  "outreach.recentReplies.subjectPrefix",
  "outreach.recentlySent.cols.kol",
  "outreach.footer.engineVersion",
  "crm.pipeline.rowCount",
  "crm.recentChanges.cols.kol",
  "kolProfile.hero.unknown",
  "weeklyReport.header.aiLocale",
  "weeklyReport.header.localeOptionEn",
  "weeklyReport.header.localeOptionZh",
  "roi.header.range.7d",
  "roi.kpi.velocity.na",
  "roi.trend.legend.roi",
  "roi.table.cols.roi",
  // MVP-internal-demo-prep-F007: chipLocales is a locale-code list
  // that reads the same in every language (en/zh/ja/ko/es intentional).
  "auth.login.chipLocales",
]);

const en = load("en");
const enLeafPaths = [...leaves(en)].map((l) => l.path);

describe.each(["zh", "ja", "ko", "es"] as const)("i18n coverage — %s", (locale) => {
  const target = load(locale);

  it("locale file has every en leaf path", () => {
    const missing = enLeafPaths.filter((p) => typeof getAt(target, p) !== "string");
    expect(missing, `missing ${missing.length} leaves in ${locale}.json`).toEqual([]);
  });

  it("no untranslated leaves outside the keep-as-en allowlist", () => {
    const drift: { path: string; value: string }[] = [];
    for (const enLeaf of leaves(en)) {
      const v = getAt(target, enLeaf.path);
      if (v === enLeaf.value && !KEEP_AS_EN_PATHS.has(enLeaf.path)) {
        drift.push({ path: enLeaf.path, value: enLeaf.value });
      }
    }
    expect(
      drift,
      `${locale} has ${drift.length} leaves still equal to en outside the allowlist:\n` +
        drift.map((d) => `  ${d.path}: ${JSON.stringify(d.value).slice(0, 80)}`).join("\n")
    ).toEqual([]);
  });
});

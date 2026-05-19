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
  // BL-044 F002 — "🤖 AI: " is a brand prefix (the "AI" abbreviation
  // is the same English code across every locale; the chip query text
  // that follows is what carries the locale-specific intent).
  "discovery.activeFilters.aiPrefix",
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
  // BL-024-F001-3 Add KOL form — Handle is a technical term kept in
  // English across locales; "@channelhandle" is a literal sample handle.
  "database.addKolForm.handleLabel",
  "database.addKolForm.handlePlaceholder",
  // BL-065-F006 — match.* mirrors the discovery.* / database.* trees
  // that fed the new unified workbench. The brand / tech / glossary
  // keep-as-en allowlist needs counterparts on the new paths because
  // the original discovery.* / database.* keys also still exist (BL-070
  // will delete them).
  "match.filters.brandSafetyG",
  "match.filters.brandSafetyPG",
  "match.filters.brandSafetyPG13",
  "match.filters.brandSafetyR",
  "match.filters.regionGroup_asia",
  "match.savedSearch.aiSmartMatch",
  "match.activeFilters.aiPrefix",
  "match.card.engagement",
  "match.card.unavailableMetric",
  "match.regions.VN",
  "match.categories.MOBA",
  "match.categories.RPG",
  "match.categories.FPS",
  "match.categories.Casual",
  "match.categories.Shooter",
  "match.categories.Sandbox",
  "match.platforms.youtube",
  "match.platforms.tiktok",
  "match.platforms.twitch",
  "match.platforms.bilibili",
  "match.platforms.twitter",
  "match.platforms.instagram",
  "match.table.engagement",
  "match.addKolForm.handleLabel",
  "match.addKolForm.handlePlaceholder",
  // BL-024-F004 / F005 — "KOL" is an acronym that stays uppercase
  // across every locale; "Message ID" is a technical identifier we
  // don't translate.
  "outreach.tracking.columns.kol",
  "outreach.suppression.columns.kol",
  "outreach.suppression.columns.messageId",
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
  // BL-069-F003 — /brief route. "Brief" is a marketing-industry
  // loanword used identically across en/zh/es; market codes follow
  // the same convention as campaigns.new.markets above.
  "brief.pageTitle",
  "brief.markets.global",
  "brief.markets.latam",
  // BL-070-F007 — /reach + /insight new IA route names. Both are
  // marketing-industry loanwords intentionally rendered identically
  // across all 5 locales (consistent with nav.brief / nav.match keeping
  // "Brief"/"Match"). Native-translation review pending per BL-014
  // backlog if the product brief evolves.
  "reach.pageTitle",
  "insight.pageTitle",
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
  // MVP-internal-demo-prep-F001: "CPI" is a marketing acronym kept
  // verbatim across locales (en/zh/ja/ko/es intentional).
  "dashboard.cpi.cpiLabel",
  // BL-033-F004: "KOL" is the canonical industry acronym (Key Opinion
  // Leader) kept verbatim across all 5 locales; no localized equivalent
  // is in common use in zh/ja/ko/es marketing copy.
  "assets.usedIn.kolFallback",
  // BL-033-F004: "AI" tag chip — the acronym is identical to en in
  // zh/ja/ko (Spanish localizes to "IA"). Industry-standard.
  "assets.card.tagAi",
  // BL-012-F001 / F003 / F005: admin.apifyPreview.* is an internal admin
  // tool (data review for the Stage 1.5 4-dim decision gate). Spec §1.5
  // explicitly excludes ja/ko/es native review — admin operators read
  // English; en+zh have native copy. Keep the en strings in ja/ko/es
  // until BL-014 i18n round broadens admin coverage.
  "admin.apifyPreview.title",
  "admin.apifyPreview.readOnlyWarning",
  "admin.apifyPreview.filterPlatform",
  "admin.apifyPreview.filterPlatformAll",
  "admin.apifyPreview.filterMinFollowers",
  "admin.apifyPreview.filterHasEmail",
  "admin.apifyPreview.filterSort",
  "admin.apifyPreview.sortOptions.relevance",
  "admin.apifyPreview.sortOptions.followers",
  "admin.apifyPreview.sortOptions.influence",
  "admin.apifyPreview.sortOptions.quality",
  "admin.apifyPreview.sortOptions.reachability",
  "admin.apifyPreview.sortOptions.recent",
  "admin.apifyPreview.columns.username",
  "admin.apifyPreview.columns.platform",
  "admin.apifyPreview.columns.followers",
  "admin.apifyPreview.columns.verified",
  "admin.apifyPreview.columns.scores",
  "admin.apifyPreview.columns.emails",
  "admin.apifyPreview.columns.tags",
  "admin.apifyPreview.columns.lastScraped",
  "admin.apifyPreview.emptyTitle",
  "admin.apifyPreview.emptyDescription",
  "admin.apifyPreview.expandPanel",
  "admin.apifyPreview.copyJson",
  "admin.apifyPreview.copyJsonDone",
  "admin.apifyPreview.pagination.previous",
  "admin.apifyPreview.pagination.next",
  "admin.apifyPreview.pagination.status",
  "admin.apifyPreview.fetchError",
  "admin.apifyPreview.statsCards.statusPass",
  "admin.apifyPreview.statsCards.statusFail",
  "admin.apifyPreview.statsCards.sampleSize",
  "admin.apifyPreview.statsCards.card1.title",
  "admin.apifyPreview.statsCards.card1.description",
  "admin.apifyPreview.statsCards.card1.thresholds.requiredFields",
  "admin.apifyPreview.statsCards.card1.thresholds.emailRate",
  "admin.apifyPreview.statsCards.card2.title",
  "admin.apifyPreview.statsCards.card2.description",
  "admin.apifyPreview.statsCards.card2.thresholds.scoreAvg",
  "admin.apifyPreview.statsCards.card2.thresholds.qrCoverage",
  "admin.apifyPreview.statsCards.card2.thresholds.distribution",
  "admin.apifyPreview.statsCards.card3.title",
  "admin.apifyPreview.statsCards.card3.description",
  "admin.apifyPreview.statsCards.card3.thresholds.platforms",
  "admin.apifyPreview.statsCards.card3.thresholds.platformVolume",
  "admin.apifyPreview.statsCards.card3.thresholds.gamingTagRate",
  "admin.apifyPreview.statsCards.card4.title",
  "admin.apifyPreview.statsCards.card4.description",
  "admin.apifyPreview.statsCards.card4.thresholds.fresh7d",
  "admin.apifyPreview.statsCards.card4.thresholds.aged7to30d",
  "admin.apifyPreview.statsCards.card4.thresholds.stale30d",
  "admin.apifyPreview.statsCards.footer.gateOpen",
  "admin.apifyPreview.statsCards.footer.gateBlocked",
  "admin.apifyPreview.statsCards.footer.sampleNote",

  // BL-066-F006 — AcceptedKolsPanel source chip + fee placeholder.
  // "AI" / "CSV" are tech codes that read identically across locales;
  // feeUnset is a literal em-dash glyph used as the empty-state hint
  // in the fee column.
  "campaigns.detail.kolPanel.sourceChip.ai",
  "campaigns.detail.kolPanel.sourceChip.csv",
  "campaigns.detail.kolPanel.feeUnset",
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

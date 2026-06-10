/**
 * BL-099 fix-round 1 · regression spec for the TemplatePicker filter
 * predicate (extracted to templateFilter.ts).
 *
 * Codex F006 FAIL repro (staging, 2026-06-10): create a template in
 * /en/reach/templates (Asset user_created|published, productId=null),
 * open /en/reach, select any campaign → the BL-031-F002 (D2)
 * campaign-scoped default sets productFilter to the campaign's
 * productId, and the old strict `t.productId === productFilter`
 * predicate filtered out every product-agnostic row → "No matches —
 * try clearing the filters." Searching the new template's name also
 * found nothing because search is AND-ed after the product filter.
 *
 * Fixed semantics: an active product filter keeps the product's own
 * templates PLUS product-agnostic ones (productId null/undefined),
 * product-matched rows partitioned first (BL-031-F002 D2 intent —
 * its DoD expects both bands visible, product rows on top), so user
 * templates and system seeds stay visible.
 */
import { describe, expect, it } from "vitest";

import { __TEST_ONLY__ } from "@/lib/assets/queries";

import {
  filterComposerTemplates,
  TEMPLATE_PICKER_MAX_RESULTS,
} from "../templateFilter";

const systemSeed = {
  name: "Initial Outreach",
  subject: "Partnership with {brand}",
  productId: null,
};
const userTemplate = {
  name: "BL099 Local 1781056366624",
  subject: "Hey {kol_name}, quick idea",
  productId: null,
};
const pubgTemplate = {
  name: "PUBG Mobile — Signing invitation",
  subject: "PUBG Mobile signing",
  productId: "prod-pubg",
};
const clashTemplate = {
  name: "Clash Royale — Follow-up",
  subject: "Clash Royale follow-up",
  productId: "prod-clash",
};
const all = [systemSeed, userTemplate, pubgTemplate, clashTemplate];

describe("filterComposerTemplates — BL-099 fix-round 1", () => {
  it("(regression) campaign product filter keeps product-agnostic templates visible", () => {
    const result = filterComposerTemplates(all, "prod-pubg", "");
    expect(result).toContain(userTemplate);
    expect(result).toContain(systemSeed);
    expect(result).toContain(pubgTemplate);
    expect(result).not.toContain(clashTemplate);
  });

  it("(regression) searching a fresh workspace template by name finds it while the campaign filter is active", () => {
    const result = filterComposerTemplates(all, "prod-pubg", "BL099 Local");
    expect(result).toEqual([userTemplate]);
  });

  it("productId undefined counts as product-agnostic (optional field on legacy loader shapes)", () => {
    const legacy = { name: "Legacy import", subject: "hi" };
    const result = filterComposerTemplates([legacy, clashTemplate], "prod-pubg", "");
    expect(result).toEqual([legacy]);
  });

  it("no product filter → every template passes", () => {
    expect(filterComposerTemplates(all, null, "")).toEqual(all);
  });

  it("search matches name or subject, case-insensitive, after trimming", () => {
    expect(filterComposerTemplates(all, null, "  quick IDEA ")).toEqual([userTemplate]);
    expect(filterComposerTemplates(all, null, "follow-up")).toEqual([clashTemplate]);
    expect(filterComposerTemplates(all, null, "no-such-template")).toEqual([]);
  });

  it("(D2) product-matched rows partition ahead of generic ones when the filter is active", () => {
    const result = filterComposerTemplates(all, "prod-pubg", "");
    expect(result).toEqual([pubgTemplate, systemSeed, userTemplate]);
  });

  it("(cap × filter) many generic rows do not push the product's own templates out of the list", () => {
    // Mirrors the prod shape: a band of newer generic rows (June-dated
    // migrated user templates) ahead of an older product-tied asset.
    // Under the old slice(0, 20) the product row was truncated away;
    // the literal 31 keeps this assertion honest if the cap constant
    // ever shrinks again.
    const generics = Array.from({ length: 30 }, (_, i) => ({
      name: `Generic ${i}`,
      subject: "s",
      productId: null,
    }));
    const result = filterComposerTemplates([...generics, pubgTemplate], "prod-pubg", "");
    expect(result[0]).toEqual(pubgTemplate);
    expect(result).toHaveLength(31);
  });

  it("caps the visible list at TEMPLATE_PICKER_MAX_RESULTS", () => {
    const many = Array.from({ length: TEMPLATE_PICKER_MAX_RESULTS + 5 }, (_, i) => ({
      name: `Template ${i}`,
      subject: "s",
      productId: null,
    }));
    expect(filterComposerTemplates(many, null, "")).toHaveLength(TEMPLATE_PICKER_MAX_RESULTS);
  });

  it("picker cap stays aligned with the server payload ceiling (COMPOSER_MAX_RESULTS)", () => {
    // The "client never secondary-truncates below the server cap"
    // guarantee lives in this equality — guard against silent drift.
    expect(TEMPLATE_PICKER_MAX_RESULTS).toBe(__TEST_ONLY__.COMPOSER_MAX_RESULTS);
  });
});

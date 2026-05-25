/**
 * BL-070-F010 — fidelity guard for raw <img> → next/image migration.
 *
 * Acceptance (spec §F010): 9 raw <img> tags replaced with next/image;
 * each call carries explicit width/height (or fill+sizes) for CLS
 * reservation; legacy `eslint-disable-next-line @next/next/no-img-
 * element` markers removed; 4 IA route pages + transitively-affected
 * components contain zero raw <img> usages going forward.
 *
 * Source-grep style (no rendering) mirrors the other f00X-fidelity
 * tests and avoids async-server-component render cost in vitest.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const F010_TARGETS = [
  "src/app/[locale]/(app)/match/MatchKolCard.tsx",
  "src/app/[locale]/(app)/match/MatchKolTable.tsx",
  "src/app/[locale]/(app)/crm/CrmRecentChanges.tsx",
  "src/app/[locale]/(app)/reach/RecentRepliesCard.tsx",
  "src/app/[locale]/(app)/reach/RecentlySentTable.tsx",
  "src/app/[locale]/(app)/insight/weekly-report/WeeklyReportBrandHeader.tsx",
  "src/app/[locale]/(app)/kols/[id]/page.tsx",
  "src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx",
  "src/app/shared/weekly-report/[token]/page.tsx",
];

describe("BL-070-F010 next/image migration", () => {
  it("each of the 9 F010 targets imports next/image", () => {
    for (const target of F010_TARGETS) {
      const src = read(target);
      expect(
        src,
        `${target} missing next/image import`,
      ).toMatch(/import Image from "next\/image"/);
    }
  });

  it("each of the 9 F010 targets renders <Image …/>", () => {
    for (const target of F010_TARGETS) {
      const src = read(target);
      expect(src, `${target} missing <Image>`).toMatch(/<Image\b/);
    }
  });

  it("each of the 9 F010 targets has zero raw <img> tags", () => {
    for (const target of F010_TARGETS) {
      const src = read(target);
      expect(src, `${target} still has raw <img>`).not.toMatch(/<img\b/);
    }
  });

  it("each of the 9 F010 targets has dropped the @next/next/no-img-element eslint-disable", () => {
    for (const target of F010_TARGETS) {
      const src = read(target);
      expect(
        src,
        `${target} still carries @next/next/no-img-element disable`,
      ).not.toMatch(/@next\/next\/no-img-element/);
    }
  });

  it("each F010 <Image> reserves dimensions (explicit width/height OR fill+sizes)", () => {
    for (const target of F010_TARGETS) {
      const src = read(target);
      // Find every <Image …/> block (greedy across newlines until /> or >).
      const blocks = src.match(/<Image[\s\S]*?\/>/g) ?? [];
      expect(blocks.length, `${target} no <Image> blocks captured`).toBeGreaterThan(0);
      for (const block of blocks) {
        const hasExplicitDims = /\bwidth=\{?\d+\}?/.test(block) && /\bheight=\{?\d+\}?/.test(block);
        const hasFillSizes = /\bfill\b/.test(block) && /\bsizes=/.test(block);
        expect(
          hasExplicitDims || hasFillSizes,
          `${target} <Image> missing width+height or fill+sizes:\n${block}`,
        ).toBe(true);
      }
    }
  });
});

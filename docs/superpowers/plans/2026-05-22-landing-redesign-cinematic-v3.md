# Landing Redesign Cinematic v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the execution density of cinematic v2 — limit cinematic moments to 2 (Hero §1 + ProductDemo §5), rewrite 6 sections for compactness, fix ProductDemo's 3-shared-screenshot bug, collapse Trust 3→2 cards, and land Lighthouse ≥80 desktop / ≥70 mobile for `/{en,zh}/`.

**Architecture:** Independent task (not in `features.json`). Section order in `LandingPage.tsx` unchanged so the existing `SectionTransition` chain keeps dark/light alternation. `StickyParallax` API grows a `stickyAssets[]` prop for ProductDemo cross-fade; `StickyStack` keeps the file but no v3 caller. 6 components rewrite, 1 polish (HeroVideo), 2 rename (`EmailCenterDemo`→`ProductDemo`, `TrustPlaceholder`→`Trust`), 1 rewire (`LandingPage`).

**Tech Stack:** Next.js 16 App Router + React 19.2 + TypeScript + Tailwind v4 (CSS-first `@theme`) + next-intl (5 locales: en/zh/ja/ko/es) + Playwright E2E + vitest (`--pool=threads --maxWorkers=1` in WSL2) + visual baselines via GitHub `update-visual-baselines.yml` workflow.

**Spec:** `docs/superpowers/specs/2026-05-22-landing-redesign-cinematic-v3-design.md` (commit b3b186f). Read it once before starting.

**Branch policy:** Single `main`. Push after every commit; CI (lint + tsc + L1 unit) runs on push. Staging deploy is a separate explicit step (Task 16).

---

## File Structure

### Files created
- `src/app/[locale]/(marketing)/_components/ProductDemo.tsx` — `git mv` from `EmailCenterDemo.tsx`, then rewrite to call `StickyParallax` with new `stickyAssets[]` prop
- `src/app/[locale]/(marketing)/_components/Trust.tsx` — `git mv` from `TrustPlaceholder.tsx`, then rewrite as 2-card horizontal layout
- `src/components/landing/__tests__/StickyParallax.test.tsx` — new unit test covering `stickyAssets[]` cross-fade by `activeIdx`

### Files modified
- `src/components/landing/StickyParallax.tsx` — add `stickyAssets: ReadonlyArray<ReactNode>` prop (keep legacy `stickyAsset` deprecated for one batch), default `minHeight: "200vh"`, callout spacing `space-y-[50vh]`
- `src/app/[locale]/(marketing)/_components/HeroVideo.tsx` — mesh radial-gradients 4→2 layers + inline `<feTurbulence>` SVG noise overlay, subtitle key rewritten, mobile H1 64→56px, CTA secondary copy clarified
- `src/app/[locale]/(marketing)/_components/PainPoints.tsx` — change grid `lg:grid-cols-4` → `lg:grid-cols-2` (2×2), tighten `py-32` → `py-24`, copy rewrite to new 4 cards (discovery / compliance / attribution / spend)
- `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx` — remove `'use client'` + `useScrollProgress` + sticky parallax; rewrite as static dark 3-col grid (Old | step label | New) × 4 rows
- `src/app/[locale]/(marketing)/_components/Features.tsx` — replace `<StickyStack>` wrapper with `<section>` + 3×2 grid; rename 6 module keys library→brief, aiMatch→match (others unchanged: insight/reach/crm/roi)
- `src/app/[locale]/(marketing)/_components/FAQ.tsx` — rewrite 5 Q&A copy for specificity (no structural change)
- `src/app/[locale]/(marketing)/_components/FooterCTA.tsx` — remove secondary CTA (`landing-footer-cta-secondary`)
- `src/app/[locale]/(marketing)/_components/LandingPage.tsx` — rename imports `EmailCenterDemo`→`ProductDemo`, `TrustPlaceholder`→`Trust`; section order unchanged
- `messages/{en,zh,ja,ko,es}.json` — add ~60 new `landing.*` keys (full list in spec §7.1); flag obsolete keys with `_deprecated_by_v3_` prefix for next-batch cleanup
- `tests/e2e/landing.spec.ts` — add 6 new assertions (PainPoints 4 cards / Features 6 / ProductDemo callout-swap-screenshot / BeforeAfter 4 rows / Trust 2 cards / FooterCTA single CTA)
- `docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md` — add `**Status**: Superseded by 2026-05-22-landing-redesign-cinematic-v3-design.md` banner

### Files deleted (via `git mv`)
- `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx` → `ProductDemo.tsx`
- `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx` → `Trust.tsx`

### Files explicitly unchanged
- `src/app/[locale]/(marketing)/_components/SectionTransition.tsx`
- `src/app/[locale]/(marketing)/_components/TopNav.tsx`
- `src/components/landing/ScrollFadeIn.tsx`
- `src/components/landing/useScrollProgress.ts`
- `src/components/landing/StickyStack.tsx` (no v3 caller, file kept for future use)
- `public/landing/screenshots/*.png` (7 existing thumbnails reused by Features + ProductDemo)
- `public/landing/hero/hero-poster.jpg`

### Files NOT touched in this plan (user-delivered later, independent timeline)
- `public/landing/hero/hero-loop.{mp4,webm}` — HeroVideo `<video>` falls back to poster until these arrive

---

## Tasks

### Task 1: Add new EN i18n keys (foundation for all section rewrites)

**Files:**
- Modify: `messages/en.json`

Rationale: every component task below reads i18n keys via `getTranslations()`. Adding EN keys first lets every subsequent task render in EN immediately. ZH/JA/KO/ES come in Task 13 to keep this task small.

- [ ] **Step 1: Read current `messages/en.json` `landing` namespace**

Run: `python3 -c "import json; d=json.load(open('messages/en.json')); print(list(d['landing'].keys()))"`
Expected output includes: `hero, painPoints, beforeAfter, features, demo, trust, faq, footerCta, meta` (plus more).

- [ ] **Step 2: Edit `messages/en.json` — add/rewrite the following keys**

Within the `landing` object, **merge** these keys into existing structures. Do NOT wholesale-replace `landing.faq` etc. — preserve any existing keys not shown below (e.g. `landing.faq.sectionTitle` = "Frequently asked" stays; `landing.meta.*` stays). Renames documented after the JSON.

```json
{
  "landing": {
    "hero": {
      "eyebrow": "YOUR GLOBAL KOL MATRIX",
      "title_line1": "Built for",
      "title_line2": "game creators.",
      "subtitle": "Discover, match, and reach global gaming influencers — all in one AI-native matrix.",
      "ctaPrimary": "Request access",
      "ctaSecondary": "Book a demo",
      "videoAlt": "Loop of KolMatrix dashboard showcasing KOL discovery, matching, and outreach.",
      "scrollCue": "Scroll to explore"
    },
    "painPoints": {
      "eyebrow": "THE PROBLEM",
      "sectionTitle": "Game-creator marketing today is broken in 4 ways.",
      "items": {
        "discovery": {
          "title": "Discovery takes weeks",
          "body": "Manual spreadsheet + 4 platforms = 20–30 hours per brief."
        },
        "compliance": {
          "title": "Outreach drowns in compliance",
          "body": "Per-region tax forms, age gates, sponsorship disclosure — no platform handles it for you."
        },
        "attribution": {
          "title": "Attribution is guesswork",
          "body": "UTMs disappear on TikTok bio links. Creator-side data lives in 4 dashboards."
        },
        "spend": {
          "title": "Spend leaks across silos",
          "body": "Agency fees, platform cuts, currency conversion — your $50K becomes $36K of actual creator spend."
        }
      }
    },
    "beforeAfter": {
      "sectionTitle": "Old workflow vs KolMatrix",
      "colTask": "Step",
      "colBefore": "Old workflow",
      "colAfter": "KolMatrix",
      "rows": {
        "find": {
          "label": "Find KOLs",
          "old": "Spreadsheet across 4 platforms · ~25h",
          "new": "One AI brief → ranked matrix in minutes"
        },
        "reach": {
          "label": "Reach out",
          "old": "Per-creator email + DM, no template reuse",
          "new": "Multi-locale templates, compliance built-in"
        },
        "measure": {
          "label": "Measure",
          "old": "Wait for invoice, hope numbers align",
          "new": "Auto-attribution + weekly digest"
        },
        "iterate": {
          "label": "Iterate",
          "old": "Forget last campaign by next brief",
          "new": "CRM history available for next brief"
        }
      }
    },
    "features": {
      "intro": {
        "label": "THE PLATFORM",
        "title": "Six modules.\nOne workflow.",
        "subtitle": "From discovery to attribution — everything you need, none of the spreadsheet stitching."
      },
      "items": {
        "brief": {
          "title": "Brief",
          "body": "Parse natural-language briefs into structured campaigns."
        },
        "match": {
          "title": "Match",
          "body": "AI-ranked KOL recommendations with a natural-language refinement loop."
        },
        "insight": {
          "title": "Insight",
          "body": "Campaign attribution + weekly client reports."
        },
        "reach": {
          "title": "Reach",
          "body": "Templated outreach in 5 locales with SPF/DKIM/DMARC built in."
        },
        "crm": {
          "title": "CRM",
          "body": "KOL relationship history + contract lifecycle."
        },
        "roi": {
          "title": "ROI",
          "body": "Spend tracking across currencies and platforms."
        }
      }
    },
    "demo": {
      "sectionTitle": "See it in action",
      "callouts": [
        {
          "title": "Discover in minutes, not hours",
          "body": "Upload a brief. AI ranks creators across 4 platforms (TikTok, Instagram, YouTube, X) by audience match and engagement."
        },
        {
          "title": "Outreach with built-in compliance",
          "body": "Send templated outreach in 5 locales. SPF/DKIM verified domain, DMARC alignment, send-rate caps."
        },
        {
          "title": "Attribution across all 4 platforms",
          "body": "Auto-tagged UTM links + creator-side performance pull. Weekly digest of CPC, CTR, install conversion."
        }
      ],
      "screenshotAlt": {
        "match": "KolMatrix Match — AI-ranked KOL recommendations.",
        "reach": "KolMatrix Reach — outreach composer with templates.",
        "insight": "KolMatrix Insight — campaign attribution dashboard."
      }
    },
    "trust": {
      "sectionTitle": "Built on infrastructure that holds up.",
      "items": {
        "compliance": {
          "title": "Compliance built in",
          "body": "SPF, DKIM, DMARC verified domain. Per-region tax forms automated. GDPR + CCPA ready."
        },
        "uptime": {
          "title": "99.9% uptime",
          "body": "PM2 cluster behind Cloudflare. Public health endpoint at /api/health."
        }
      }
    },
    "faq": {
      "items": [
        {
          "q": "Which platforms does KolMatrix cover?",
          "a": "TikTok, Instagram, YouTube, and X — surfaced through a single AI-ranked matrix per brief."
        },
        {
          "q": "How is creator data sourced?",
          "a": "Public profile + post metrics via licensed APIs. We refresh active campaigns daily."
        },
        {
          "q": "Can we use our own outreach templates?",
          "a": "Yes — bring your own, or start from our 5-locale templates with compliance copy baked in."
        },
        {
          "q": "What's the pricing model?",
          "a": "Annual seat license plus usage-based AI call credits. Talk to us for a custom quote."
        },
        {
          "q": "Where is data stored?",
          "a": "Tokyo region (ap-northeast-1) with row-level isolation across tenants. Export available any time."
        }
      ]
    },
    "footerCta": {
      "sectionTitle": "Ready to run your next campaign on KolMatrix?",
      "ctaPrimary": "Request access",
      "footerLine": "© 2026 KolMatrix · Built in Tokyo"
    }
  }
}
```

Note: keep all other unrelated `landing.*` keys intact. Keys being removed (`landing.painPoints.items.find/match/email/workflow`, `landing.features.items.library/aiMatch`, `landing.trust.items.encryption/email/stack`, `landing.beforeAfter.demoBadge`, `landing.footerCta.ctaSecondary`) can be left in `en.json` flagged with `_deprecated_by_v3_` prefix (rename, not delete) so production keeps rendering until Task 12-13 land the new keys in all locales. Example:

```json
"painPoints": {
  "_deprecated_by_v3_find": { /* old content */ },
  ...
}
```

- [ ] **Step 3: Run typecheck + i18n EN-only quick parity check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: zero errors (i18n keys are looked up by string at runtime; tsc won't catch missing keys but will catch JSON syntax errors).

Run: `python3 -c "import json; json.load(open('messages/en.json')); print('EN JSON valid')"`
Expected: `EN JSON valid`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json
git commit -m "$(cat <<'EOF'
i18n(landing): add v3 EN keys (60 new) — foundation for component rewrites

Adds the new key namespace per spec v3 §7.1:
- landing.painPoints.items.{discovery,compliance,attribution,spend}
- landing.features.items.{brief,match,insight,reach,crm,roi}
- landing.demo.callouts[0..2].{title,body} + screenshotAlt.{match,reach,insight}
- landing.beforeAfter.rows.{find,reach,measure,iterate}.{label,old,new}
- landing.trust.items.{compliance,uptime}
- landing.faq.items[0..4].{q,a} (rewritten for specificity)
- landing.hero.{eyebrow,subtitle,ctaSecondary,scrollCue}

Obsolete keys (painPoints.items.find/match/email/workflow,
features.items.library/aiMatch, trust.items.encryption/email/stack,
footerCta.ctaSecondary) renamed with _deprecated_by_v3_ prefix; will
be removed in a follow-up cleanup batch once components no longer
reference them.

ZH/JA/KO/ES translations land in subsequent tasks (12-13) so this
commit alone fails i18n-locale-coverage until all 5 locales catch up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 2: StickyParallax — add `stickyAssets[]` API + unit test

**Files:**
- Modify: `src/components/landing/StickyParallax.tsx`
- Create: `src/components/landing/__tests__/StickyParallax.test.tsx`

- [ ] **Step 1: Write failing unit test**

Create `src/components/landing/__tests__/StickyParallax.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StickyParallax } from "../StickyParallax";

// useScrollProgress relies on IntersectionObserver; stub it to return a
// deterministic progress value per test.
vi.mock("../useScrollProgress", () => ({
  useScrollProgress: vi.fn(),
}));

import { useScrollProgress } from "../useScrollProgress";

describe("StickyParallax — stickyAssets[] cross-fade", () => {
  it("at progress 0, asset[0] is visible (opacity=1) and asset[1,2] are not (opacity=0)", () => {
    vi.mocked(useScrollProgress).mockReturnValue(0);
    render(
      <StickyParallax
        sectionTestId="sp-test"
        bgClassName="bg-surface"
        textClassName="text-on-surface"
        callouts={[<div key="c1">c1</div>, <div key="c2">c2</div>, <div key="c3">c3</div>]}
        stickyAssets={[
          <div key="a1" data-testid="asset-0">asset-0</div>,
          <div key="a2" data-testid="asset-1">asset-1</div>,
          <div key="a3" data-testid="asset-2">asset-2</div>,
        ]}
      />,
    );
    expect(screen.getByTestId("asset-0").parentElement).toHaveStyle({ opacity: "1" });
    expect(screen.getByTestId("asset-1").parentElement).toHaveStyle({ opacity: "0" });
    expect(screen.getByTestId("asset-2").parentElement).toHaveStyle({ opacity: "0" });
  });

  it("at progress 0.5, asset[1] is visible and asset[0,2] are not", () => {
    vi.mocked(useScrollProgress).mockReturnValue(0.5);
    render(
      <StickyParallax
        sectionTestId="sp-test"
        bgClassName="bg-surface"
        textClassName="text-on-surface"
        callouts={[<div key="c1">c1</div>, <div key="c2">c2</div>, <div key="c3">c3</div>]}
        stickyAssets={[
          <div key="a1" data-testid="asset-0">asset-0</div>,
          <div key="a2" data-testid="asset-1">asset-1</div>,
          <div key="a3" data-testid="asset-2">asset-2</div>,
        ]}
      />,
    );
    expect(screen.getByTestId("asset-0").parentElement).toHaveStyle({ opacity: "0" });
    expect(screen.getByTestId("asset-1").parentElement).toHaveStyle({ opacity: "1" });
    expect(screen.getByTestId("asset-2").parentElement).toHaveStyle({ opacity: "0" });
  });

  it("at progress 0.99, asset[2] is visible (clamped to last index)", () => {
    vi.mocked(useScrollProgress).mockReturnValue(0.99);
    render(
      <StickyParallax
        sectionTestId="sp-test"
        bgClassName="bg-surface"
        textClassName="text-on-surface"
        callouts={[<div key="c1">c1</div>, <div key="c2">c2</div>, <div key="c3">c3</div>]}
        stickyAssets={[
          <div key="a1" data-testid="asset-0">asset-0</div>,
          <div key="a2" data-testid="asset-1">asset-1</div>,
          <div key="a3" data-testid="asset-2">asset-2</div>,
        ]}
      />,
    );
    expect(screen.getByTestId("asset-2").parentElement).toHaveStyle({ opacity: "1" });
  });

  it("legacy stickyAsset prop still renders (backward-compat for one batch)", () => {
    vi.mocked(useScrollProgress).mockReturnValue(0);
    render(
      <StickyParallax
        sectionTestId="sp-test"
        bgClassName="bg-surface"
        textClassName="text-on-surface"
        callouts={[<div key="c1">c1</div>]}
        stickyAsset={<div data-testid="legacy-asset">legacy</div>}
      />,
    );
    expect(screen.getByTestId("legacy-asset")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx vitest run src/components/landing/__tests__/StickyParallax.test.tsx --pool=threads --maxWorkers=1`
Expected: tests FAIL with "stickyAssets is not a valid prop" or similar TypeScript / runtime error.

- [ ] **Step 3: Update `src/components/landing/StickyParallax.tsx` with new API**

Replace entire file contents with:

```tsx
"use client";

import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "./useScrollProgress";

interface Props {
  /** Array of sticky assets cross-faded by activeIdx (preferred API). */
  stickyAssets?: ReadonlyArray<ReactNode>;
  /** @deprecated since v3 — pass `stickyAssets={[asset]}` instead. Removed next batch. */
  stickyAsset?: ReactNode;
  /** Array of copy callouts revealed in sequence as the user scrolls. */
  callouts: ReactNode[];
  bgClassName: string;
  textClassName: string;
  sectionTestId: string;
  /** Section min-height; default 200vh (v3: tightened from 240vh). */
  minHeight?: string;
}

/**
 * Sticky-asset + scrolling-callouts container.
 *
 * v3: supports `stickyAssets[]` which cross-fades between assets by
 * activeIdx (each rendered absolute-positioned in a relative wrapper,
 * opacity toggled on the active index). Used by ProductDemo to swap
 * /match → /reach → /insight screenshots per callout.
 *
 * Legacy `stickyAsset` (single) still accepted for one batch; remove
 * next landing batch once zero callers remain.
 *
 * Mobile / reduced-motion: callouts stack vertically; assets stack
 * below their callouts (no sticky, no scale, no cross-fade).
 */
export function StickyParallax({
  stickyAssets,
  stickyAsset,
  callouts,
  bgClassName,
  textClassName,
  sectionTestId,
  minHeight = "200vh",
}: Props) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(sectionRef);
  const activeIdx = Math.min(
    callouts.length - 1,
    Math.floor(progress * callouts.length),
  );

  const assets: ReadonlyArray<ReactNode> = stickyAssets ?? (stickyAsset ? [stickyAsset] : []);

  return (
    <section
      ref={sectionRef}
      data-testid={sectionTestId}
      data-parallax="sticky"
      className={`${bgClassName} ${textClassName} px-6 lg:px-12`}
      style={{ minHeight }}
    >
      <div className="mx-auto max-w-6xl py-32 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16">
        {/* Callouts — scroll normally */}
        <div className="space-y-32 lg:space-y-[50vh]">
          {callouts.map((node, idx) => (
            <div
              key={idx}
              data-testid={`landing-parallax-callout-${idx}`}
              data-active={idx === activeIdx}
              className={`transition-opacity duration-500 ${
                idx === activeIdx ? "opacity-100" : "opacity-40"
              }`}
            >
              <span className="font-geist-mono text-[11px] tracking-[0.25em] text-cyan/80 uppercase">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="mt-3">{node}</div>
            </div>
          ))}
        </div>

        {/* Sticky asset stack — cross-fade between stickyAssets[activeIdx] */}
        <div className="lg:sticky lg:top-24 self-start" data-parallax="sticky">
          <div
            className="relative transition-transform duration-700"
            style={{ transform: `scale(${1 + progress * 0.08})` }}
          >
            {assets.map((node, idx) => (
              <div
                key={idx}
                className="transition-opacity duration-500"
                style={{
                  opacity: idx === activeIdx ? 1 : 0,
                  position: idx === 0 ? "relative" : "absolute",
                  inset: idx === 0 ? undefined : 0,
                  pointerEvents: idx === activeIdx ? "auto" : "none",
                }}
              >
                {node}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Re-run the test — verify PASS**

Run: `npx vitest run src/components/landing/__tests__/StickyParallax.test.tsx --pool=threads --maxWorkers=1`
Expected: all 4 tests PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep StickyParallax`
Expected: zero output (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/StickyParallax.tsx src/components/landing/__tests__/StickyParallax.test.tsx
git commit -m "feat(landing): StickyParallax stickyAssets[] API + cross-fade (v3)

Adds stickyAssets[] prop for ProductDemo to swap match/reach/insight
screenshots per active callout, with absolute-positioned layers and
opacity cross-fade. Legacy stickyAsset prop kept @deprecated for one
batch — removed in next landing cleanup once zero callers remain.

Default minHeight 240vh → 200vh, callout spacing 60vh → 50vh per
spec v3 §3 (17% tighter; reduces scroll-to-fill ratio).

Unit test covers 4 cases: progress 0 / 0.5 / 0.99 (clamp) / legacy
stickyAsset backward-compat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: HeroVideo polish — mesh 4→2 + feTurbulence + mobile H1 56px + subtitle copy

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/HeroVideo.tsx`

- [ ] **Step 1: Replace HeroVideo with polished version**

Overwrite `src/app/[locale]/(marketing)/_components/HeroVideo.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

export async function HeroVideo({ locale }: Props) {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      data-parallax="hero"
      className="relative overflow-hidden bg-surface min-h-screen flex items-center justify-center px-6 lg:px-12"
    >
      {/* Cinematic mesh — simplified from 4 to 2 radial-gradient layers (v3) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 15%, rgba(0,229,255,0.35), transparent 55%),
            radial-gradient(ellipse at 75% 85%, rgba(157,80,255,0.32), transparent 55%)
          `,
        }}
      />

      {/* Inline SVG feTurbulence noise — hides banding on the gradients */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.06] mix-blend-overlay"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="hero-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>

      {/* Looping product-demo video — fills the section as a background layer. */}
      {/* Until user delivers mp4/webm, this falls back to the poster image. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/landing/hero/hero-poster.jpg"
        aria-label={t("videoAlt")}
        className="absolute inset-0 w-full h-full object-cover opacity-40 motion-reduce:hidden"
        data-testid="landing-hero-video"
      >
        <source src="/landing/hero/hero-loop.webm" type="video/webm" />
        <source src="/landing/hero/hero-loop.mp4" type="video/mp4" />
      </video>

      {/* Reduced-motion fallback — static poster */}
      <Image
        src="/landing/hero/hero-poster.jpg"
        alt={t("videoAlt")}
        fill
        priority
        className="object-cover opacity-40 hidden motion-reduce:block"
        data-testid="landing-hero-poster-fallback"
      />

      {/* Foreground content */}
      <div className="relative z-10 max-w-5xl text-center font-geist">
        <div className="font-geist-mono text-[11px] tracking-[0.35em] text-cyan mb-6 uppercase">
          {t("eyebrow")}
        </div>
        <h1 className="cinematic-text font-extrabold leading-[0.9] tracking-[-0.04em] text-[56px] sm:text-[96px] lg:text-[124px]">
          {t("title_line1")}
          <br />
          {t("title_line2")}
        </h1>
        <p className="mt-8 mx-auto max-w-2xl text-base sm:text-lg text-on-surface-variant">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/request-access`}
            className="cta-glow-pulse inline-flex items-center gap-2 rounded-full bg-cyan px-7 py-3.5 text-sm font-semibold text-surface shadow-[0_0_24px_var(--glow-cyan)] hover:bg-cyan/90 transition"
            data-testid="landing-cta-primary"
          >
            {t("ctaPrimary")} →
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-surface/40 backdrop-blur-sm px-7 py-3.5 text-sm font-semibold text-cyan hover:bg-cyan/10 transition"
            data-testid="landing-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <p className="mt-16 font-geist-mono text-[10px] uppercase tracking-[0.3em] text-on-surface-variant/60">
          ↓ {t("scrollCue")}
        </p>
      </div>
    </section>
  );
}
```

Changes vs current: mesh radial-gradients 4→2 layers (dropped center cyan + linear backdrop), inline `<svg>` `feTurbulence` noise (replaces the heavy mesh as banding-hider), mobile H1 64px→56px, scroll-cue text now i18n key `scrollCue`, subtitle key intact (Task 1 already supplied new copy).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E 'HeroVideo|hero'`
Expected: zero output.

- [ ] **Step 3: Visual smoke (dev server)**

Run: `npm run dev` (background). Open `http://localhost:3000/en/` — verify hero renders with new mesh (no obvious regression), mobile H1 fits at 360px (use browser dev-tools responsive mode).

- [ ] **Step 4: Stop dev server, commit**

```bash
git add src/app/[locale]/(marketing)/_components/HeroVideo.tsx
git commit -m "feat(landing-v3): HeroVideo polish — mesh 4→2 layers + feTurbulence + mobile H1 56px

- Mesh radial-gradients reduced from 4 to 2 (dropped center cyan +
  linear backdrop) → ~30% paint cost reduction (per spec §6.1).
- Added inline SVG feTurbulence noise overlay (~4KB inline, no asset
  round-trip) for film-grain that hides the gradient banding.
- Mobile H1 64px → 56px (avoids overflow observed at 360px on
  BL-070 staging spot-check).
- Scroll cue text moved to i18n key (was hardcoded English).
- Video <source> tags unchanged — falls back to poster until user
  delivers hero-loop.{mp4,webm} (independent timeline).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: PainPoints — rewrite as light 2×2 grid

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/PainPoints.tsx`

- [ ] **Step 1: Replace PainPoints**

Overwrite `src/app/[locale]/(marketing)/_components/PainPoints.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface PainItem {
  key: "discovery" | "compliance" | "attribution" | "spend";
  icon: string;
}

const ITEMS: ReadonlyArray<PainItem> = [
  { key: "discovery", icon: "search" },
  { key: "compliance", icon: "verified_user" },
  { key: "attribution", icon: "track_changes" },
  { key: "spend", icon: "payments" },
];

export async function PainPoints() {
  const t = await getTranslations("landing.painPoints");

  return (
    <section
      data-testid="landing-painpoints"
      className="bg-surface-light text-on-surface-light px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-5xl">
        <ScrollFadeIn>
          <div className="text-center">
            <div className="font-geist-mono text-[11px] tracking-[0.25em] text-purple-fixed uppercase">
              {t("eyebrow")}
            </div>
            <h2 className="mt-3 font-geist text-3xl font-bold tracking-tight text-on-surface-light lg:text-4xl">
              {t("sectionTitle")}
            </h2>
          </div>
        </ScrollFadeIn>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {ITEMS.map(({ key, icon }, idx) => (
            <ScrollFadeIn key={key} delayMs={idx * 100}>
              <div
                data-testid={`landing-painpoint-${key}`}
                className="rounded-2xl bg-surface-light-container border border-on-surface-light/8 p-6 h-full transition hover:border-cyan/40 hover:shadow-[0_8px_28px_rgba(0,229,255,0.15)]"
              >
                <span
                  className="material-symbols-outlined text-[28px] text-cyan"
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <h3 className="mt-4 font-geist text-base font-semibold text-on-surface-light">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-on-surface-light-variant leading-relaxed">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </ScrollFadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Changes vs current: grid `lg:grid-cols-4` → `lg:grid-cols-2` (2×2), section padding `py-32` → `py-24`, eyebrow added (`THE PROBLEM`), 4 item keys renamed find/match/email/workflow → discovery/compliance/attribution/spend, tagline `<p>` removed (data leaked into footer; sectionTitle now carries the messaging).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i painpoint`
Expected: zero output.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(marketing)/_components/PainPoints.tsx
git commit -m "feat(landing-v3): PainPoints — light 2×2 grid + new 4 cards

- Grid lg:grid-cols-4 → lg:grid-cols-2 (2×2 layout per spec §4.1).
- Section padding py-32 → py-24 (tighter rhythm).
- 4 new item keys: discovery / compliance / attribution / spend
  (replacing find / match / email / workflow). Old keys still in
  en.json under _deprecated_by_v3_ prefix from Task 1 commit.
- Eyebrow 'THE PROBLEM' added.
- Tagline <p> removed (content now carried by sectionTitle).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: BeforeAfter — remove sticky parallax, rewrite as static dark 3-col

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx`

- [ ] **Step 1: Replace BeforeAfter**

Overwrite `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface Row {
  key: "find" | "reach" | "measure" | "iterate";
  icon: string;
}

const ROWS: ReadonlyArray<Row> = [
  { key: "find", icon: "search" },
  { key: "reach", icon: "outgoing_mail" },
  { key: "measure", icon: "insights" },
  { key: "iterate", icon: "loop" },
];

export async function BeforeAfter() {
  const t = await getTranslations("landing.beforeAfter");

  return (
    <section
      data-testid="landing-before-after"
      className="bg-surface text-on-surface px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-5xl">
        <ScrollFadeIn>
          <h2 className="font-geist text-center text-3xl font-bold tracking-tight text-white lg:text-4xl">
            {t("sectionTitle")}
          </h2>
        </ScrollFadeIn>

        <ScrollFadeIn delayMs={150}>
          <div className="mt-10 overflow-hidden rounded-2xl border border-cyan/15">
            {/* Header */}
            <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] gap-4 border-b border-cyan/15 bg-surface-low px-6 py-3 font-geist-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:grid">
              <div>{t("colTask")}</div>
              <div>{t("colBefore")}</div>
              <div className="text-cyan">{t("colAfter")}</div>
            </div>

            {/* Rows */}
            {ROWS.map(({ key, icon }, idx) => (
              <div
                key={key}
                data-testid={`landing-before-row-${key}`}
                className={`grid grid-cols-1 gap-2 px-6 py-5 md:grid-cols-[1fr_1.2fr_1.2fr] md:gap-4 ${
                  idx < ROWS.length - 1 ? "border-b border-cyan/10" : ""
                } ${idx % 2 === 0 ? "bg-surface" : "bg-surface-low"}`}
              >
                <div className="flex items-center gap-3 font-geist text-base font-semibold text-white">
                  <span
                    className="material-symbols-outlined text-[22px] text-cyan"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  {t(`rows.${key}.label`)}
                </div>
                <div className="text-sm text-on-surface-variant/70 line-through decoration-on-surface-variant/40">
                  <span className="md:hidden mr-2 font-geist-mono text-xs uppercase tracking-wider text-on-surface-variant/50 no-underline">
                    {t("colBefore")}:
                  </span>
                  {t(`rows.${key}.old`)}
                </div>
                <div className="text-sm font-medium text-cyan">
                  <span className="md:hidden mr-2 font-geist-mono text-xs uppercase tracking-wider text-on-surface-variant/50 no-underline">
                    {t("colAfter")}:
                  </span>
                  {t(`rows.${key}.new`)}
                </div>
              </div>
            ))}
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  );
}
```

Changes vs current: `'use client'` removed (server component now); `useScrollProgress` import + sticky parallax wrapper + progress-driven row highlight all removed; `minHeight: '180vh'` removed (returns to natural `py-24` height); `demoBadge` removed; `data-testid` pattern changed from `landing-before-after-{key}` to `landing-before-row-{key}` (spec §8.1); 4 row keys renamed discover/match/email/review → find/reach/measure/iterate to match new i18n shape; new column field `rows.{key}.label` replaces `rows.{key}.task`; `rows.{key}.before` → `rows.{key}.old`, `rows.{key}.after` → `rows.{key}.new`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i beforeafter`
Expected: zero output.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(marketing)/_components/BeforeAfter.tsx
git commit -m "feat(landing-v3): BeforeAfter — static 3-col (sticky parallax removed)

Per spec v3 §4.1: removes 'use client' + useScrollProgress + sticky
parallax wrapper + scroll-driven row-highlight + minHeight 180vh.
Becomes a server component with py-24 natural height.

Row keys renamed discover/match/email/review → find/reach/measure/
iterate; data-testid pattern landing-before-after-{key} →
landing-before-row-{key} (matches spec §8.1 E2E assertion). i18n
fields {task,before,after} → {label,old,new}. Old keys remain under
_deprecated_by_v3_ in en.json from Task 1.

This is the biggest height cut in v3 — section drops from 1.8 vp
sticky to ~0.9 vp static.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: Features — remove StickyStack, rewrite as light 3×2 grid

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/Features.tsx`

- [ ] **Step 1: Replace Features**

Overwrite `src/app/[locale]/(marketing)/_components/Features.tsx`:

```tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface FeatureMeta {
  key: "brief" | "match" | "insight" | "reach" | "crm" | "roi";
  href: string;
  screenshot: string;
}

const FEATURES: ReadonlyArray<FeatureMeta> = [
  { key: "brief", href: "/brief", screenshot: "/landing/screenshots/match-ai-sidebar.png" },
  { key: "match", href: "/match", screenshot: "/landing/screenshots/match-full.png" },
  { key: "insight", href: "/insight", screenshot: "/landing/screenshots/insight-full.png" },
  { key: "reach", href: "/reach", screenshot: "/landing/screenshots/reach-domain-health.png" },
  { key: "crm", href: "/crm", screenshot: "/landing/screenshots/crm-full.png" },
  { key: "roi", href: "/roi", screenshot: "/landing/screenshots/roi-full.png" },
];

interface Props {
  locale: string;
}

export async function Features({ locale }: Props) {
  const t = await getTranslations("landing.features");

  return (
    <section
      data-testid="landing-features"
      className="bg-surface-light text-on-surface-light px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollFadeIn>
          <div className="text-center">
            <div className="font-geist-mono text-[11px] tracking-[0.3em] text-cyan uppercase">
              {t("intro.label")}
            </div>
            <h2 className="mt-4 font-geist text-3xl font-bold tracking-tight whitespace-pre-line lg:text-4xl">
              {t("intro.title")}
            </h2>
            <p className="mt-5 mx-auto max-w-xl text-base text-on-surface-light-variant leading-relaxed">
              {t("intro.subtitle")}
            </p>
          </div>
        </ScrollFadeIn>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, href, screenshot }, idx) => (
            <ScrollFadeIn key={key} delayMs={idx * 60}>
              <a
                href={`/${locale}${href}`}
                data-testid={`landing-feature-${key}`}
                className="group flex flex-col gap-4 rounded-2xl border border-on-surface-light/10 bg-surface-light-container p-6 transition duration-200 hover:-translate-y-1 hover:border-cyan/60 hover:shadow-[0_12px_32px_rgba(0,229,255,0.18)]"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-geist-mono text-[11px] tracking-[0.2em] text-on-surface-light-muted">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-geist text-lg font-semibold text-on-surface-light">
                    {t(`items.${key}.title`)}
                  </h3>
                </div>
                <p className="text-sm text-on-surface-light-variant leading-relaxed">
                  {t(`items.${key}.body`)}
                </p>
                <div className="mt-1 overflow-hidden rounded-xl border border-on-surface-light/8 transition group-hover:border-cyan/30">
                  <Image
                    src={screenshot}
                    alt={t(`items.${key}.title`)}
                    width={640}
                    height={400}
                    className="h-auto w-full opacity-95 transition duration-200 group-hover:scale-[1.02]"
                  />
                </div>
              </a>
            </ScrollFadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Changes vs current: `<StickyStack>` wrapper removed → flat `<section>`; intro moved from sticky left-column to centered top header; cards now in 3-col grid (`lg:grid-cols-3`) — 6 cards display as 3×2; section padding `py-32` → `py-24`; 2 keys renamed `library`→`brief` (with /brief href) and `aiMatch`→`match` (with /match href); insight/reach/crm/roi unchanged. Card thumbnails retained from current 7 product screenshots.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i features`
Expected: zero output.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(marketing)/_components/Features.tsx
git commit -m "feat(landing-v3): Features — 3×2 grid, StickyStack wrapper removed

Per spec v3 §4.1: StickyStack split-column layout replaced with flat
3-col grid; intro moves from sticky-left to centered top header; py-32
→ py-24. Module keys library → brief (with /brief href) and aiMatch
→ match (with /match href) to align with current IA. Insight/reach/
crm/roi unchanged. Card screenshots from public/landing/screenshots/
retained (6 distinct thumbnails).

StickyStack.tsx file kept in src/components/landing/ for future use;
no v3 caller after this commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 7: ProductDemo — `git mv` from EmailCenterDemo + 3 distinct screenshots

**Files:**
- Delete (via `git mv`): `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`
- Create (via `git mv`): `src/app/[locale]/(marketing)/_components/ProductDemo.tsx`

- [ ] **Step 1: Git mv**

```bash
git mv src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx src/app/[locale]/(marketing)/_components/ProductDemo.tsx
```

- [ ] **Step 2: Replace ProductDemo contents**

Overwrite `src/app/[locale]/(marketing)/_components/ProductDemo.tsx`:

```tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyParallax } from "@/components/landing/StickyParallax";

interface CalloutData {
  title: string;
  body: string;
}

interface ScreenshotMeta {
  src: string;
  altKey: "match" | "reach" | "insight";
}

const SCREENSHOTS: ReadonlyArray<ScreenshotMeta> = [
  { src: "/landing/screenshots/match-full.png", altKey: "match" },
  { src: "/landing/screenshots/reach-full.png", altKey: "reach" },
  { src: "/landing/screenshots/insight-full.png", altKey: "insight" },
];

export async function ProductDemo() {
  const t = await getTranslations("landing.demo");
  const callouts = t.raw("callouts") as ReadonlyArray<CalloutData>;

  return (
    <StickyParallax
      sectionTestId="landing-demo"
      bgClassName="bg-surface"
      textClassName="text-on-surface"
      stickyAssets={SCREENSHOTS.map(({ src, altKey }) => (
        <div
          key={altKey}
          data-testid={`landing-demo-screenshot-${altKey}`}
          className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_12px_48px_rgba(0,229,255,0.15)]"
        >
          <Image
            src={src}
            alt={t(`screenshotAlt.${altKey}`)}
            width={1080}
            height={720}
            className="h-auto w-full"
          />
        </div>
      ))}
      callouts={callouts.map((c, idx) => (
        <div key={idx} data-testid={`landing-demo-callout-${idx}`}>
          <h3 className="font-geist text-2xl lg:text-3xl font-bold tracking-tight text-white">
            {c.title}
          </h3>
          <p className="mt-4 text-base text-on-surface-variant leading-relaxed max-w-md">
            {c.body}
          </p>
        </div>
      ))}
    />
  );
}
```

Changes vs current `EmailCenterDemo`: single `stickyAsset` prop → `stickyAssets[]` with 3 distinct screenshots (match / reach / insight); each screenshot gets its own `data-testid={landing-demo-screenshot-${altKey}}` for E2E (Task 14); `screenshotAlt` key changed from string to nested object with .match/.reach/.insight (matches Task 1 i18n shape).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'ProductDemo|EmailCenterDemo'`
Expected: zero errors (LandingPage.tsx still imports EmailCenterDemo — typecheck error expected here until Task 11 lands).

Note: if typecheck errors block your local dev loop, you can either land Task 11 immediately after this one, or temporarily add a stub: do NOT — instead, just keep going to Task 11.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/[locale]/(marketing)/_components/
git commit -m "feat(landing-v3): rename EmailCenterDemo → ProductDemo + 3 distinct screenshots

Per spec v3 §3 + §6.2: fixes the 'all 3 callouts share match-full.png'
bug by passing 3 screenshots via StickyParallax stickyAssets[] (from
Task 2). callout 1 → match-full, callout 2 → reach-full, callout 3 →
insight-full. Each screenshot has its own data-testid for E2E swap
assertion in Task 14.

i18n key landing.demo.screenshotAlt is now an object {match, reach,
insight} (was singular string). Old singular key stays under
_deprecated_by_v3_ from Task 1 commit.

LandingPage.tsx still imports old EmailCenterDemo name — fixed in
Task 11 (single rewire commit).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 8: Trust — `git mv` from TrustPlaceholder + 2-card layout

**Files:**
- Delete (via `git mv`): `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx`
- Create (via `git mv`): `src/app/[locale]/(marketing)/_components/Trust.tsx`

- [ ] **Step 1: Git mv**

```bash
git mv src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx src/app/[locale]/(marketing)/_components/Trust.tsx
```

- [ ] **Step 2: Replace Trust contents**

Overwrite `src/app/[locale]/(marketing)/_components/Trust.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface TrustItem {
  key: "compliance" | "uptime";
  icon: string;
}

const ITEMS: ReadonlyArray<TrustItem> = [
  { key: "compliance", icon: "verified_user" },
  { key: "uptime", icon: "monitor_heart" },
];

export async function Trust() {
  const t = await getTranslations("landing.trust");

  return (
    <section
      data-testid="landing-trust"
      className="bg-surface-light text-on-surface-light px-6 py-20 lg:px-12"
    >
      <div className="mx-auto max-w-5xl">
        <ScrollFadeIn>
          <h2 className="font-geist text-center text-3xl font-bold tracking-tight text-on-surface-light lg:text-4xl">
            {t("sectionTitle")}
          </h2>
        </ScrollFadeIn>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ITEMS.map(({ key, icon }, idx) => (
            <ScrollFadeIn key={key} delayMs={idx * 120}>
              <div
                data-testid={`landing-trust-card-${key}`}
                className="rounded-2xl border border-on-surface-light/10 bg-surface-light-container p-7 transition hover:border-cyan/40 hover:shadow-[0_8px_28px_rgba(0,229,255,0.15)]"
              >
                <span
                  className="material-symbols-outlined text-[30px] text-cyan"
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <h3 className="mt-4 font-geist text-lg font-semibold text-on-surface-light">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-3 text-sm text-on-surface-light-variant leading-relaxed">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </ScrollFadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Changes vs current `TrustPlaceholder`: `<StickyStack>` wrapper removed → flat `<section>`; 3 items (encryption/email/stack) → 2 items (compliance/uptime); `data-testid` pattern `landing-trust-{key}` → `landing-trust-card-{key}` to match spec §8.1; section padding `py-32` → `py-20`; `intro.label/title/subtitle` collapsed into single `sectionTitle` key.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -iE 'Trust(Placeholder)?'`
Expected: errors only from `LandingPage.tsx` still importing old `TrustPlaceholder` (fixed in Task 11).

- [ ] **Step 4: Commit**

```bash
git add -A src/app/[locale]/(marketing)/_components/
git commit -m "feat(landing-v3): rename TrustPlaceholder → Trust + 2-card horizontal

Per spec v3 §4.1 + §3 (Trust decision): 3 cards collapsed to 2
(Compliance + Uptime; Privacy implicitly covered by Compliance body).
StickyStack wrapper removed → flat section py-20.

data-testid landing-trust-{key} → landing-trust-card-{key} to match
spec §8.1 E2E assertion. i18n intro.* collapsed into single
sectionTitle key.

LandingPage.tsx still imports old TrustPlaceholder — fixed in Task
11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 9: FAQ — verify array-driven structure (no code change expected)

**Files:**
- Read: `src/app/[locale]/(marketing)/_components/FAQ.tsx`

`FAQ.tsx` currently uses `t.raw("items") as ReadonlyArray<{ q: string; a: string }>` and renders each item as a `<details>` accordion (verified at plan-writing time). Task 1's new EN copy for `landing.faq.items[0..4]` is array-shaped to match this exactly.

- [ ] **Step 1: Smoke-render in dev**

Run: `npm run dev` (background). Open `http://localhost:3000/en/` — scroll to FAQ section. Verify all 5 new questions render and accordion open/close works.

- [ ] **Step 2: Stop dev server**

No commit — Task 1 already shipped the new copy and FAQ.tsx requires no source change.

If smoke render shows any broken layout or missing copy, debug and add a focused commit. Otherwise Task 9 is verification-only.

---

### Task 10: FooterCTA — remove secondary CTA

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/FooterCTA.tsx`

- [ ] **Step 1: Edit FooterCTA — remove the secondary `<Link>`**

In `src/app/[locale]/(marketing)/_components/FooterCTA.tsx`, find this block (around lines 23-37):

```tsx
<div className="mt-12 flex flex-wrap justify-center gap-3">
  <Link
    href={`/${locale}/request-access`}
    className="cta-glow-pulse inline-flex items-center gap-2 rounded-full bg-cyan px-10 py-4 text-base font-semibold text-surface shadow-[0_0_24px_var(--glow-cyan)] hover:bg-cyan/90 transition"
    data-testid="landing-footer-cta-primary"
  >
    {t("ctaPrimary")} →
  </Link>
  <Link
    href={`/${locale}/request-access?demo=1`}
    className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-10 py-4 text-base font-semibold text-cyan hover:bg-cyan/10 transition"
    data-testid="landing-footer-cta-secondary"
  >
    {t("ctaSecondary")}
  </Link>
</div>
```

Replace with (drop the secondary Link, change wrapper to single-item):

```tsx
<div className="mt-12 flex justify-center">
  <Link
    href={`/${locale}/request-access`}
    className="cta-glow-pulse inline-flex items-center gap-2 rounded-full bg-cyan px-10 py-4 text-base font-semibold text-surface shadow-[0_0_24px_var(--glow-cyan)] hover:bg-cyan/90 transition"
    data-testid="landing-footer-cta-primary"
  >
    {t("ctaPrimary")} →
  </Link>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i footercta`
Expected: zero output. (`landing.footerCta.ctaSecondary` is still in `en.json` under `_deprecated_by_v3_` prefix from Task 1, so no missing-key error.)

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/(marketing)/_components/FooterCTA.tsx
git commit -m "feat(landing-v3): FooterCTA — remove secondary CTA, keep single primary

Per spec v3 §4.1 §4.2: footer CTA is single 'Request access →' with
glow-pulse. Secondary 'Book a demo' Link removed (data-testid
landing-footer-cta-secondary gone — E2E Task 14 asserts this).

i18n key landing.footerCta.ctaSecondary kept under _deprecated_by_v3_
prefix; cleanup next batch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 11: LandingPage — rewire imports for ProductDemo + Trust

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/LandingPage.tsx`

- [ ] **Step 1: Edit LandingPage imports + JSX**

In `src/app/[locale]/(marketing)/_components/LandingPage.tsx`:

Replace these two import lines:
```tsx
import { EmailCenterDemo } from "./EmailCenterDemo";
import { TrustPlaceholder } from "./TrustPlaceholder";
```

With:
```tsx
import { ProductDemo } from "./ProductDemo";
import { Trust } from "./Trust";
```

Replace these two JSX usages:
```tsx
<EmailCenterDemo />
...
<TrustPlaceholder />
```

With:
```tsx
<ProductDemo />
...
<Trust />
```

Section order (and all 7 `<SectionTransition>` placements) **unchanged**.

- [ ] **Step 2: Full typecheck — should pass now**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: zero errors (this is the commit that resolves Task 7 + 8's interim typecheck errors).

- [ ] **Step 3: Run all landing-related unit tests**

Run: `npx vitest run src/components/landing src/app/\\[locale\\]/\\(marketing\\) --pool=threads --maxWorkers=1`
Expected: all PASS (StickyParallax tests from Task 2 + any existing landing tests).

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/(marketing)/_components/LandingPage.tsx
git commit -m "feat(landing-v3): LandingPage rewire — ProductDemo + Trust imports

Final rewire that resolves typecheck errors from Tasks 7+8. Section
order and all 7 SectionTransition placements unchanged.

Components now wired:
- §1 Hero (HeroVideo polished)
- §2 PainPoints (2×2 grid)
- §3 BeforeAfter (static 3-col, sticky removed)
- §4 Features (3×2 grid, StickyStack removed)
- §5 ProductDemo (cinematic moment #2, was EmailCenterDemo)
- §6 Trust (2-card, was TrustPlaceholder)
- §7 FAQ (copy refresh)
- §8 FooterCTA (single CTA)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 12: ZH translation — Chinese for all new v3 keys

**Files:**
- Modify: `messages/zh.json`

- [ ] **Step 1: Add ZH translations**

Edit `messages/zh.json`. Within the `landing` object, add the following — values are Chinese translations of the Task 1 EN content. Where a brand term or product module (Brief/Match/Reach/Insight/CRM/ROI) is conventionally kept in English (per BL-070 KEEP_AS_EN_PATHS), keep it in English:

```json
{
  "landing": {
    "hero": {
      "eyebrow": "全球游戏 KOL 矩阵",
      "title_line1": "为游戏创作者",
      "title_line2": "而生。",
      "subtitle": "在一个 AI 原生矩阵中发现、匹配、触达全球游戏类 KOL。",
      "ctaPrimary": "申请试用",
      "ctaSecondary": "预约 Demo",
      "videoAlt": "KolMatrix 控制台演示 — KOL 发现、匹配与触达。",
      "scrollCue": "向下浏览"
    },
    "painPoints": {
      "eyebrow": "现状的痛点",
      "sectionTitle": "今天的游戏 KOL 营销，在 4 个环节是断的。",
      "items": {
        "discovery": {
          "title": "找人耗时数周",
          "body": "手动表格 + 4 个平台 = 每个 brief 20–30 小时。"
        },
        "compliance": {
          "title": "触达卡在合规",
          "body": "各地税表、年龄分级、广告披露 —— 没有平台帮你统一处理。"
        },
        "attribution": {
          "title": "归因靠猜",
          "body": "TikTok bio 链 UTM 直接丢失,创作者侧数据散在 4 个后台。"
        },
        "spend": {
          "title": "花费跨工具漏掉",
          "body": "代理费、平台抽成、汇率转换 —— $50K 真到创作者手里只剩 $36K。"
        }
      }
    },
    "beforeAfter": {
      "sectionTitle": "传统流程 vs KolMatrix",
      "colTask": "环节",
      "colBefore": "传统流程",
      "colAfter": "KolMatrix",
      "rows": {
        "find": {
          "label": "找 KOL",
          "old": "4 个平台手动跑表 · 约 25 小时",
          "new": "一份 AI brief → 分钟级排序矩阵"
        },
        "reach": {
          "label": "触达",
          "old": "逐人邮件 + DM,模板无法复用",
          "new": "5 语种模板,合规自动到位"
        },
        "measure": {
          "label": "度量",
          "old": "等账单,然后赌数字对得上",
          "new": "自动归因 + 周度摘要"
        },
        "iterate": {
          "label": "迭代",
          "old": "下一个 brief 时已经忘了上次",
          "new": "CRM 历史随下一个 brief 取用"
        }
      }
    },
    "features": {
      "intro": {
        "label": "平台一览",
        "title": "六个模块。\n一条工作流。",
        "subtitle": "从发现到归因 —— 所需的一切,无需再拼凑表格。"
      },
      "items": {
        "brief": {
          "title": "Brief",
          "body": "自然语言 brief 解析为结构化活动配置。"
        },
        "match": {
          "title": "Match",
          "body": "AI 排序的 KOL 推荐,支持自然语言再筛选。"
        },
        "insight": {
          "title": "Insight",
          "body": "活动归因 + 客户周报。"
        },
        "reach": {
          "title": "Reach",
          "body": "5 语种模板触达,SPF/DKIM/DMARC 内置。"
        },
        "crm": {
          "title": "CRM",
          "body": "KOL 关系历史 + 合同生命周期。"
        },
        "roi": {
          "title": "ROI",
          "body": "跨货币、跨平台的花费追踪。"
        }
      }
    },
    "demo": {
      "sectionTitle": "看产品跑起来",
      "callouts": [
        {
          "title": "分钟级,不是小时级的发现",
          "body": "上传 brief。AI 在 4 个平台(TikTok、Instagram、YouTube、X)按受众契合度与互动率排序。"
        },
        {
          "title": "合规内置的触达",
          "body": "5 语种模板触达。SPF/DKIM 验证域、DMARC 对齐、发送频率限制。"
        },
        {
          "title": "4 平台统一归因",
          "body": "自动 UTM 标签 + 创作者侧业绩拉取。每周摘要 CPC、CTR、安装转化。"
        }
      ],
      "screenshotAlt": {
        "match": "KolMatrix Match — AI 排序的 KOL 推荐。",
        "reach": "KolMatrix Reach — 模板触达编辑器。",
        "insight": "KolMatrix Insight — 活动归因看板。"
      }
    },
    "trust": {
      "sectionTitle": "基础设施够稳。",
      "items": {
        "compliance": {
          "title": "合规内置",
          "body": "SPF、DKIM、DMARC 已验证发件域。各地税表自动化。GDPR + CCPA 就绪。"
        },
        "uptime": {
          "title": "99.9% 可用性",
          "body": "PM2 cluster 部署在 Cloudflare 后,健康端点公开 /api/health。"
        }
      }
    },
    "faq": {
      "items": [
        {
          "q": "KolMatrix 覆盖哪些平台?",
          "a": "TikTok、Instagram、YouTube、X —— 在单个 brief 的 AI 排序矩阵中统一呈现。"
        },
        {
          "q": "创作者数据从哪来?",
          "a": "通过授权 API 抓取公开主页 + 内容数据。运行中的活动每日刷新。"
        },
        {
          "q": "能用自己的触达模板吗?",
          "a": "可以 —— 自带模板或基于内置 5 语种合规模板起步。"
        },
        {
          "q": "定价模式是什么?",
          "a": "年度席位 + AI 调用量计费。定制报价请与我们联系。"
        },
        {
          "q": "数据存在哪?",
          "a": "东京区 (ap-northeast-1),多租户行级隔离。随时可导出。"
        }
      ]
    },
    "footerCta": {
      "sectionTitle": "准备好用 KolMatrix 跑你的下一场活动?",
      "ctaPrimary": "申请试用",
      "footerLine": "© 2026 KolMatrix · 东京制造"
    }
  }
}
```

- [ ] **Step 2: Validate JSON + run i18n parity test (ZH only)**

```bash
python3 -c "import json; json.load(open('messages/zh.json')); print('ZH JSON valid')"
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1 2>&1 | tail -20
```

Expected: `ZH JSON valid`. i18n-locale-coverage will still **FAIL** because JA/KO/ES are not yet translated (Task 13). Confirm that the failure points at JA/KO/ES (not ZH).

- [ ] **Step 3: Commit**

```bash
git add messages/zh.json
git commit -m "i18n(landing-v3): add ZH translations for ~60 new keys

5-locale coverage now at 2/5 (EN from Task 1 + ZH here). JA/KO/ES
land in Task 13. i18n-locale-coverage test still fails until then.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 13: JA / KO / ES translations

**Files:**
- Modify: `messages/ja.json`
- Modify: `messages/ko.json`
- Modify: `messages/es.json`

Per BL-070 KEEP_AS_EN_PATHS pattern: brand terms (KolMatrix, Brief, Match, Reach, Insight, CRM, ROI), platform names (TikTok, Instagram, YouTube, X), and technical acronyms (SPF, DKIM, DMARC, GDPR, CCPA, UTM, CPC, CTR, API) stay English in JA/KO/ES.

- [ ] **Step 1: Add JA translations to `messages/ja.json`**

Merge the following into the `landing` object (preserve existing keys not shown, e.g. `landing.meta.*`, `landing.faq.sectionTitle`):

```json
{
  "landing": {
    "hero": {
      "eyebrow": "グローバル KOL マトリックス",
      "title_line1": "ゲームクリエイター",
      "title_line2": "のために。",
      "subtitle": "発見、マッチング、アウトリーチを 1 つの AI ネイティブマトリックスで。",
      "ctaPrimary": "アクセス申請",
      "ctaSecondary": "デモを予約",
      "videoAlt": "KolMatrix ダッシュボードのループ — KOL 発見、マッチング、アウトリーチ。",
      "scrollCue": "下にスクロール"
    },
    "painPoints": {
      "eyebrow": "現状の課題",
      "sectionTitle": "ゲーム KOL マーケティングは 4 つの工程で分断されています。",
      "items": {
        "discovery": {
          "title": "発見に数週間",
          "body": "手動スプレッドシート + 4 プラットフォーム = ブリーフあたり 20〜30 時間。"
        },
        "compliance": {
          "title": "コンプライアンスで止まるアウトリーチ",
          "body": "地域別の税フォーム、年齢ゲート、スポンサー開示 — どのプラットフォームも代行してくれません。"
        },
        "attribution": {
          "title": "推測のアトリビューション",
          "body": "TikTok bio リンクで UTM は消失。クリエイター側データは 4 つのダッシュボードに分散。"
        },
        "spend": {
          "title": "サイロ間で漏れる予算",
          "body": "代理店手数料、プラットフォーム手数料、為替変換 — $50K が実質クリエイター予算 $36K に。"
        }
      }
    },
    "beforeAfter": {
      "sectionTitle": "従来のフロー vs KolMatrix",
      "colTask": "工程",
      "colBefore": "従来のフロー",
      "colAfter": "KolMatrix",
      "rows": {
        "find": {
          "label": "KOL を探す",
          "old": "4 プラットフォーム横断のスプレッドシート · 約 25 時間",
          "new": "1 つの AI ブリーフ → 数分でランク付きマトリックス"
        },
        "reach": {
          "label": "アウトリーチ",
          "old": "個別メール + DM、テンプレート再利用なし",
          "new": "5 言語テンプレート、コンプライアンス内蔵"
        },
        "measure": {
          "label": "計測",
          "old": "請求書を待ち、数字の一致を祈る",
          "new": "自動アトリビューション + 週次ダイジェスト"
        },
        "iterate": {
          "label": "改善",
          "old": "次のブリーフ時には前回を忘れている",
          "new": "次のブリーフに CRM 履歴を活用"
        }
      }
    },
    "features": {
      "intro": {
        "label": "プラットフォーム",
        "title": "6 つのモジュール。\n1 つのワークフロー。",
        "subtitle": "発見からアトリビューションまで — 必要なものすべて、スプレッドシートの繋ぎ合わせなし。"
      },
      "items": {
        "brief": {
          "title": "Brief",
          "body": "自然言語のブリーフを構造化されたキャンペーン設定に変換。"
        },
        "match": {
          "title": "Match",
          "body": "AI ランキングの KOL レコメンド、自然言語による再フィルタリング。"
        },
        "insight": {
          "title": "Insight",
          "body": "キャンペーンのアトリビューション + クライアント週次レポート。"
        },
        "reach": {
          "title": "Reach",
          "body": "5 言語のテンプレートアウトリーチ、SPF/DKIM/DMARC 内蔵。"
        },
        "crm": {
          "title": "CRM",
          "body": "KOL リレーションシップ履歴 + 契約ライフサイクル。"
        },
        "roi": {
          "title": "ROI",
          "body": "通貨横断、プラットフォーム横断の予算トラッキング。"
        }
      }
    },
    "demo": {
      "sectionTitle": "実際に動かしてみる",
      "callouts": [
        {
          "title": "数時間ではなく数分で発見",
          "body": "ブリーフをアップロード。AI が 4 プラットフォーム(TikTok、Instagram、YouTube、X)でオーディエンス適合度とエンゲージメント率で順位付け。"
        },
        {
          "title": "コンプライアンス内蔵のアウトリーチ",
          "body": "5 言語のテンプレートで送信。SPF/DKIM 認証済みドメイン、DMARC 整合、送信レート制限。"
        },
        {
          "title": "4 プラットフォーム統合アトリビューション",
          "body": "自動 UTM タグ + クリエイター側パフォーマンス取得。週次ダイジェストで CPC、CTR、インストール変換。"
        }
      ],
      "screenshotAlt": {
        "match": "KolMatrix Match — AI ランキングの KOL レコメンド。",
        "reach": "KolMatrix Reach — テンプレートアウトリーチ作成画面。",
        "insight": "KolMatrix Insight — キャンペーンアトリビューションダッシュボード。"
      }
    },
    "trust": {
      "sectionTitle": "支える基盤は揺るぎません。",
      "items": {
        "compliance": {
          "title": "コンプライアンス内蔵",
          "body": "SPF、DKIM、DMARC 認証済み送信ドメイン。地域別税フォーム自動化。GDPR + CCPA 対応。"
        },
        "uptime": {
          "title": "99.9% アップタイム",
          "body": "Cloudflare 配下の PM2 クラスタ。ヘルスエンドポイント /api/health を公開。"
        }
      }
    },
    "faq": {
      "items": [
        {
          "q": "KolMatrix はどのプラットフォームに対応していますか?",
          "a": "TikTok、Instagram、YouTube、X — 単一のブリーフから AI ランキングのマトリックスで統合提示。"
        },
        {
          "q": "クリエイターデータはどこから取得しますか?",
          "a": "公開プロフィール + 投稿メトリクスをライセンス済み API 経由で取得。実行中のキャンペーンは毎日更新。"
        },
        {
          "q": "独自のアウトリーチテンプレートは使えますか?",
          "a": "はい — 持ち込みも可能、5 言語のコンプライアンス対応テンプレートから始めることもできます。"
        },
        {
          "q": "料金体系を教えてください。",
          "a": "年間シートライセンス + AI コール従量課金。カスタム見積もりはお問い合わせください。"
        },
        {
          "q": "データはどこに保管されますか?",
          "a": "東京リージョン (ap-northeast-1)、テナント間の行レベル分離。いつでもエクスポート可能。"
        }
      ]
    },
    "footerCta": {
      "sectionTitle": "次のキャンペーンを KolMatrix で実行する準備はできましたか?",
      "ctaPrimary": "アクセス申請",
      "footerLine": "© 2026 KolMatrix · 東京製"
    }
  }
}
```

- [ ] **Step 2: Add KO translations to `messages/ko.json`**

Merge into the `landing` object (same key paths as JA above):

```json
{
  "landing": {
    "hero": {
      "eyebrow": "글로벌 KOL 매트릭스",
      "title_line1": "게임 크리에이터",
      "title_line2": "를 위해.",
      "subtitle": "발견, 매칭, 아웃리치를 하나의 AI 네이티브 매트릭스에서.",
      "ctaPrimary": "액세스 신청",
      "ctaSecondary": "데모 예약",
      "videoAlt": "KolMatrix 대시보드 루프 — KOL 발견, 매칭, 아웃리치.",
      "scrollCue": "아래로 스크롤"
    },
    "painPoints": {
      "eyebrow": "현재의 문제점",
      "sectionTitle": "게임 KOL 마케팅은 4 가지 단계에서 단절되어 있습니다.",
      "items": {
        "discovery": {
          "title": "발견에 수 주 소요",
          "body": "수동 스프레드시트 + 4 개 플랫폼 = 브리프당 20〜30 시간."
        },
        "compliance": {
          "title": "컴플라이언스에 막힌 아웃리치",
          "body": "지역별 세금 양식, 연령 게이트, 후원 공시 — 어떤 플랫폼도 대신 처리해 주지 않습니다."
        },
        "attribution": {
          "title": "추측에 의존하는 어트리뷰션",
          "body": "TikTok bio 링크의 UTM 은 사라지고, 크리에이터 측 데이터는 4 개의 대시보드에 분산."
        },
        "spend": {
          "title": "사일로 사이로 새는 예산",
          "body": "에이전시 수수료, 플랫폼 수수료, 환율 변환 — $50K 가 실제 크리에이터 예산 $36K 로."
        }
      }
    },
    "beforeAfter": {
      "sectionTitle": "기존 워크플로우 vs KolMatrix",
      "colTask": "단계",
      "colBefore": "기존 워크플로우",
      "colAfter": "KolMatrix",
      "rows": {
        "find": {
          "label": "KOL 찾기",
          "old": "4 개 플랫폼 횡단 스프레드시트 · 약 25 시간",
          "new": "하나의 AI 브리프 → 몇 분 내 순위 매트릭스"
        },
        "reach": {
          "label": "아웃리치",
          "old": "개별 이메일 + DM, 템플릿 재사용 불가",
          "new": "5 개 언어 템플릿, 컴플라이언스 내장"
        },
        "measure": {
          "label": "측정",
          "old": "청구서를 기다리고 숫자가 맞기를 바람",
          "new": "자동 어트리뷰션 + 주간 다이제스트"
        },
        "iterate": {
          "label": "개선",
          "old": "다음 브리프 때는 이전 캠페인을 잊음",
          "new": "다음 브리프에 CRM 이력 활용 가능"
        }
      }
    },
    "features": {
      "intro": {
        "label": "플랫폼 개요",
        "title": "6 개 모듈.\n1 개 워크플로우.",
        "subtitle": "발견부터 어트리뷰션까지 — 필요한 모든 것, 스프레드시트 연결 작업 없이."
      },
      "items": {
        "brief": {
          "title": "Brief",
          "body": "자연어 브리프를 구조화된 캠페인 설정으로 변환합니다."
        },
        "match": {
          "title": "Match",
          "body": "AI 순위가 매겨진 KOL 추천, 자연어 재필터링 지원."
        },
        "insight": {
          "title": "Insight",
          "body": "캠페인 어트리뷰션 + 클라이언트 주간 리포트."
        },
        "reach": {
          "label": "Reach",
          "title": "Reach",
          "body": "5 개 언어 템플릿 아웃리치, SPF/DKIM/DMARC 내장."
        },
        "crm": {
          "title": "CRM",
          "body": "KOL 관계 이력 + 계약 라이프사이클."
        },
        "roi": {
          "title": "ROI",
          "body": "통화 횡단, 플랫폼 횡단 예산 추적."
        }
      }
    },
    "demo": {
      "sectionTitle": "실제로 작동하는 모습",
      "callouts": [
        {
          "title": "몇 시간이 아닌 몇 분 안에 발견",
          "body": "브리프를 업로드하세요. AI 가 4 개 플랫폼(TikTok, Instagram, YouTube, X)에서 오디언스 적합도와 인게이지먼트로 순위를 매깁니다."
        },
        {
          "title": "컴플라이언스 내장 아웃리치",
          "body": "5 개 언어 템플릿으로 발송. SPF/DKIM 인증 도메인, DMARC 정렬, 발송률 제한."
        },
        {
          "title": "4 개 플랫폼 통합 어트리뷰션",
          "body": "자동 UTM 태그 + 크리에이터 측 성과 가져오기. 주간 다이제스트로 CPC, CTR, 설치 전환."
        }
      ],
      "screenshotAlt": {
        "match": "KolMatrix Match — AI 순위 매겨진 KOL 추천.",
        "reach": "KolMatrix Reach — 템플릿 아웃리치 작성기.",
        "insight": "KolMatrix Insight — 캠페인 어트리뷰션 대시보드."
      }
    },
    "trust": {
      "sectionTitle": "받쳐주는 인프라는 흔들리지 않습니다.",
      "items": {
        "compliance": {
          "title": "컴플라이언스 내장",
          "body": "SPF, DKIM, DMARC 인증 발송 도메인. 지역별 세금 양식 자동화. GDPR + CCPA 대응."
        },
        "uptime": {
          "title": "99.9% 가동률",
          "body": "Cloudflare 뒤의 PM2 클러스터. 헬스 엔드포인트 /api/health 공개."
        }
      }
    },
    "faq": {
      "items": [
        {
          "q": "KolMatrix 는 어떤 플랫폼을 지원하나요?",
          "a": "TikTok, Instagram, YouTube, X — 하나의 브리프에서 AI 순위 매트릭스로 통합 제공."
        },
        {
          "q": "크리에이터 데이터는 어디서 가져오나요?",
          "a": "공개 프로필 + 게시물 메트릭을 라이선스 API 를 통해 가져옵니다. 진행 중인 캠페인은 매일 갱신."
        },
        {
          "q": "자체 아웃리치 템플릿을 사용할 수 있나요?",
          "a": "네 — 가져와서 사용하거나 5 개 언어 컴플라이언스 내장 템플릿에서 시작할 수 있습니다."
        },
        {
          "q": "요금 모델은 어떻게 되나요?",
          "a": "연간 시트 라이선스 + AI 호출 사용량 과금. 맞춤 견적은 문의해 주세요."
        },
        {
          "q": "데이터는 어디에 저장되나요?",
          "a": "도쿄 리전 (ap-northeast-1), 테넌트 간 행 수준 격리. 언제든 내보내기 가능."
        }
      ]
    },
    "footerCta": {
      "sectionTitle": "다음 캠페인을 KolMatrix 에서 실행할 준비가 되셨나요?",
      "ctaPrimary": "액세스 신청",
      "footerLine": "© 2026 KolMatrix · 도쿄에서 제작"
    }
  }
}
```

Note: the KO Features.items.reach entry in the JSON above accidentally has a duplicate `label` field — drop the `"label": "Reach",` line so the final shape only has `title` + `body` like the other modules.

- [ ] **Step 3: Add ES translations to `messages/es.json`**

Merge into the `landing` object (same key paths):

```json
{
  "landing": {
    "hero": {
      "eyebrow": "TU MATRIZ KOL GLOBAL",
      "title_line1": "Hecho para",
      "title_line2": "creadores de juegos.",
      "subtitle": "Descubra, empareje y contacte a influencers globales de juegos — todo en una matriz AI-nativa.",
      "ctaPrimary": "Solicitar acceso",
      "ctaSecondary": "Reservar demo",
      "videoAlt": "Loop del dashboard de KolMatrix mostrando descubrimiento, emparejamiento y contacto de KOLs.",
      "scrollCue": "Desplázate para explorar"
    },
    "painPoints": {
      "eyebrow": "EL PROBLEMA",
      "sectionTitle": "El marketing con creadores de juegos hoy está roto en 4 puntos.",
      "items": {
        "discovery": {
          "title": "Descubrir lleva semanas",
          "body": "Hoja de cálculo manual + 4 plataformas = 20–30 horas por brief."
        },
        "compliance": {
          "title": "Contacto ahogado en cumplimiento",
          "body": "Formularios fiscales por región, controles de edad, divulgación de patrocinio — ninguna plataforma lo resuelve por usted."
        },
        "attribution": {
          "title": "La atribución es adivinanza",
          "body": "Los UTMs desaparecen en enlaces bio de TikTok. Los datos del creador viven en 4 dashboards."
        },
        "spend": {
          "title": "El gasto se fuga entre silos",
          "body": "Comisiones de agencia, recortes de plataforma, conversión de moneda — sus $50K se convierten en $36K reales de gasto al creador."
        }
      }
    },
    "beforeAfter": {
      "sectionTitle": "Flujo tradicional vs KolMatrix",
      "colTask": "Paso",
      "colBefore": "Flujo tradicional",
      "colAfter": "KolMatrix",
      "rows": {
        "find": {
          "label": "Encontrar KOLs",
          "old": "Hoja de cálculo en 4 plataformas · ~25 h",
          "new": "Un brief AI → matriz rankeada en minutos"
        },
        "reach": {
          "label": "Contactar",
          "old": "Email + DM uno-a-uno, sin reutilización de plantillas",
          "new": "Plantillas multi-idioma, cumplimiento integrado"
        },
        "measure": {
          "label": "Medir",
          "old": "Esperar la factura, ojalá los números cuadren",
          "new": "Atribución automática + resumen semanal"
        },
        "iterate": {
          "label": "Iterar",
          "old": "Olvidó la campaña anterior al llegar el siguiente brief",
          "new": "Historial CRM disponible para el siguiente brief"
        }
      }
    },
    "features": {
      "intro": {
        "label": "LA PLATAFORMA",
        "title": "Seis módulos.\nUn flujo.",
        "subtitle": "De descubrimiento a atribución — todo lo que necesita, sin coser hojas de cálculo."
      },
      "items": {
        "brief": {
          "title": "Brief",
          "body": "Convierta briefs en lenguaje natural en campañas estructuradas."
        },
        "match": {
          "title": "Match",
          "body": "Recomendaciones de KOL rankeadas por AI con bucle de refinamiento en lenguaje natural."
        },
        "insight": {
          "title": "Insight",
          "body": "Atribución de campañas + reportes semanales para clientes."
        },
        "reach": {
          "title": "Reach",
          "body": "Contacto con plantillas en 5 idiomas con SPF/DKIM/DMARC integrados."
        },
        "crm": {
          "title": "CRM",
          "body": "Historial de relación con KOLs + ciclo de vida de contratos."
        },
        "roi": {
          "title": "ROI",
          "body": "Seguimiento de gasto multi-divisa y multi-plataforma."
        }
      }
    },
    "demo": {
      "sectionTitle": "Véalo en acción",
      "callouts": [
        {
          "title": "Descubrir en minutos, no horas",
          "body": "Suba un brief. AI rankea creadores en 4 plataformas (TikTok, Instagram, YouTube, X) por ajuste de audiencia y engagement."
        },
        {
          "title": "Contacto con cumplimiento integrado",
          "body": "Envíe plantillas en 5 idiomas. Dominio verificado SPF/DKIM, alineación DMARC, límites de tasa de envío."
        },
        {
          "title": "Atribución unificada en las 4 plataformas",
          "body": "Etiquetas UTM automáticas + extracción de rendimiento del creador. Resumen semanal de CPC, CTR, conversión a instalación."
        }
      ],
      "screenshotAlt": {
        "match": "KolMatrix Match — recomendaciones KOL rankeadas por AI.",
        "reach": "KolMatrix Reach — editor de contacto con plantillas.",
        "insight": "KolMatrix Insight — dashboard de atribución de campañas."
      }
    },
    "trust": {
      "sectionTitle": "Sobre infraestructura que aguanta.",
      "items": {
        "compliance": {
          "title": "Cumplimiento integrado",
          "body": "Dominio verificado SPF, DKIM, DMARC. Formularios fiscales por región automatizados. Listo para GDPR + CCPA."
        },
        "uptime": {
          "title": "99.9% de disponibilidad",
          "body": "Cluster PM2 detrás de Cloudflare. Endpoint de salud público en /api/health."
        }
      }
    },
    "faq": {
      "items": [
        {
          "q": "¿Qué plataformas cubre KolMatrix?",
          "a": "TikTok, Instagram, YouTube y X — presentadas en una única matriz rankeada por AI por cada brief."
        },
        {
          "q": "¿De dónde provienen los datos de creadores?",
          "a": "Perfil público + métricas de publicaciones vía APIs licenciadas. Refrescamos campañas activas a diario."
        },
        {
          "q": "¿Podemos usar nuestras propias plantillas de contacto?",
          "a": "Sí — traiga las suyas o comience con nuestras plantillas en 5 idiomas con cumplimiento integrado."
        },
        {
          "q": "¿Cuál es el modelo de precios?",
          "a": "Licencia anual por asiento más créditos de uso de llamadas AI. Hable con nosotros para una cotización personalizada."
        },
        {
          "q": "¿Dónde se almacenan los datos?",
          "a": "Región de Tokio (ap-northeast-1) con aislamiento por filas entre tenants. Exportación disponible en cualquier momento."
        }
      ]
    },
    "footerCta": {
      "sectionTitle": "¿Listo para ejecutar su próxima campaña en KolMatrix?",
      "ctaPrimary": "Solicitar acceso",
      "footerLine": "© 2026 KolMatrix · Hecho en Tokio"
    }
  }
}
```

- [ ] **Step 4: Validate JSON + run full i18n-locale-coverage**

```bash
for f in messages/ja.json messages/ko.json messages/es.json; do
  python3 -c "import json; json.load(open('$f')); print('$f valid')"
done
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1
```

Expected: all 3 JSON valid. i18n-locale-coverage **PASS** (8/8) — all 5 locales now have parity for the new `landing.*` keys.

- [ ] **Step 5: Commit**

```bash
git add messages/ja.json messages/ko.json messages/es.json
git commit -m "i18n(landing-v3): add JA/KO/ES translations — 5-locale parity 8/8

Hand-written per BL-070 KEEP_AS_EN_PATHS pattern: brand terms
(KolMatrix, module names), platform names, technical acronyms (SPF,
DKIM, DMARC, GDPR, CCPA, UTM, CPC, CTR, API) kept English.

i18n-locale-coverage 8/8 PASS — closes the failing test introduced
by Task 1's EN-only commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 14: E2E landing.spec.ts — 6 new assertions

**Files:**
- Modify: `tests/e2e/landing.spec.ts`

- [ ] **Step 1: Inspect current landing.spec.ts**

Run: `grep -n 'test(' tests/e2e/landing.spec.ts | head -20`

Note the existing test names + the import / page-fixture pattern. New tests should follow the same pattern.

- [ ] **Step 2: Add 6 new tests at the end of the existing describe block**

Append the following inside the main `test.describe(...)` for `/{locale}/`:

```typescript
test("PainPoints renders 4 cards with correct testids", async ({ page }) => {
  await page.goto("/en/");
  for (const key of ["discovery", "compliance", "attribution", "spend"]) {
    await expect(page.getByTestId(`landing-painpoint-${key}`)).toBeVisible();
  }
});

test("Features renders 6 module cards with correct testids", async ({ page }) => {
  await page.goto("/en/");
  for (const key of ["brief", "match", "insight", "reach", "crm", "roi"]) {
    await expect(page.getByTestId(`landing-feature-${key}`)).toBeVisible();
  }
});

test("BeforeAfter renders 4 rows with correct testids", async ({ page }) => {
  await page.goto("/en/");
  for (const key of ["find", "reach", "measure", "iterate"]) {
    await expect(page.getByTestId(`landing-before-row-${key}`)).toBeVisible();
  }
});

test("ProductDemo renders 3 distinct sticky screenshots", async ({ page }) => {
  await page.goto("/en/");
  // All 3 screenshots are mounted (cross-faded by opacity in viewport).
  for (const altKey of ["match", "reach", "insight"]) {
    await expect(page.getByTestId(`landing-demo-screenshot-${altKey}`)).toBeAttached();
  }
});

test("Trust renders exactly 2 cards", async ({ page }) => {
  await page.goto("/en/");
  for (const key of ["compliance", "uptime"]) {
    await expect(page.getByTestId(`landing-trust-card-${key}`)).toBeVisible();
  }
  // Ensure old 3-card testids are gone.
  await expect(page.getByTestId("landing-trust-encryption")).toHaveCount(0);
});

test("FooterCTA has single primary CTA, no secondary", async ({ page }) => {
  await page.goto("/en/");
  await expect(page.getByTestId("landing-footer-cta-primary")).toBeVisible();
  await expect(page.getByTestId("landing-footer-cta-secondary")).toHaveCount(0);
});
```

- [ ] **Step 3: Run new E2E tests locally**

Run: `bash scripts/test/codex-e2e.sh tests/e2e/landing.spec.ts`
Expected: existing tests + 6 new tests all PASS.

(If `codex-e2e.sh` is not available locally, fallback: `npx playwright test tests/e2e/landing.spec.ts --project=chromium`.)

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/landing.spec.ts
git commit -m "test(landing-v3): add 6 E2E assertions per spec §8.1

- PainPoints 4 cards (discovery/compliance/attribution/spend)
- Features 6 module cards (brief/match/insight/reach/crm/roi)
- BeforeAfter 4 rows (find/reach/measure/iterate) under new
  data-testid landing-before-row-{key}
- ProductDemo 3 distinct screenshots (match/reach/insight)
  attached (all mounted, cross-faded by opacity)
- Trust exactly 2 cards (compliance/uptime); old 3-card testids
  asserted absent
- FooterCTA single primary, secondary absent

All existing landing.spec.ts tests retained.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 15: Trigger visual baseline regen + verify CI

**Files:**
- (Workflow execution, no source code changes in this task)

- [ ] **Step 1: Watch CI from Task 14's push**

Run: `gh run list --limit 3 --branch main`
Expected: most recent push has lint + tsc + L1 unit all 🟢 green.

If anything is red, stop and triage before proceeding.

- [ ] **Step 2: Trigger visual baseline regen workflow**

Run:

```bash
gh workflow run update-visual-baselines.yml --ref main -f reason='landing v3 redesign: regen 4 landing baselines (en/zh × desktop/mobile)'
```

- [ ] **Step 3: Watch the workflow until completion**

Run: `gh run list --workflow update-visual-baselines.yml --limit 1` to get the run id, then `gh run watch <id> --exit-status`.

Expected: workflow succeeds, auto-commits regenerated baselines for:
- `tests/screenshots/baseline/landing-en-desktop.png`
- `tests/screenshots/baseline/landing-en-mobile.png`
- `tests/screenshots/baseline/landing-zh-desktop.png`
- `tests/screenshots/baseline/landing-zh-mobile.png`

- [ ] **Step 4: Pull the bot commit + verify visual project**

```bash
git pull --ff-only origin main
gh run list --limit 3 --branch main
```

Expected: the bot commit shows up in `git log`. Re-trigger CI if needed via `gh workflow run ci.yml --ref main` (per `.auto-memory/role-context/generator.md` — github-actions[bot] commits don't cascade workflows automatically).

---

### Task 16: Deploy to staging + Lighthouse audit

**Files:**
- (Deploy + audit, no source code changes)

- [ ] **Step 1: Trigger staging deploy**

```bash
gh workflow run deploy-staging.yml --ref main -f ref=main -f run_seed=false
```

- [ ] **Step 2: Watch deploy until completion**

```bash
gh run list --workflow deploy-staging.yml --limit 1
gh run watch <id> --exit-status
```

Expected: deploy succeeds.

- [ ] **Step 3: Verify staging HEAD matches local main**

```bash
LOCAL_SHA=$(git rev-parse --short HEAD)
REMOTE_SHA=$(ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix-staging && git rev-parse --short HEAD')
[ "$LOCAL_SHA" = "$REMOTE_SHA" ] && echo "MATCH $LOCAL_SHA" || echo "MISMATCH local=$LOCAL_SHA remote=$REMOTE_SHA"
```

Expected: `MATCH <sha>`.

- [ ] **Step 4: Health endpoint**

```bash
ssh tripplezhou@34.180.93.185 'curl -fsSL http://localhost:3002/api/health' | head -3
```

Expected: 200 with `"status":"healthy"`.

- [ ] **Step 5: Run Lighthouse audits**

```bash
npx lighthouse https://staging.kol.guangai.ai/en/ --form-factor=desktop --output=html --output-path=/tmp/lh-landing-en-desktop.html --chrome-flags='--headless'
npx lighthouse https://staging.kol.guangai.ai/zh/ --form-factor=desktop --output=html --output-path=/tmp/lh-landing-zh-desktop.html --chrome-flags='--headless'
npx lighthouse https://staging.kol.guangai.ai/en/ --form-factor=mobile --output=html --output-path=/tmp/lh-landing-en-mobile.html --chrome-flags='--headless'
npx lighthouse https://staging.kol.guangai.ai/zh/ --form-factor=mobile --output=html --output-path=/tmp/lh-landing-zh-mobile.html --chrome-flags='--headless'
```

Read each report's Performance + Accessibility scores.

Expected: Performance ≥ 80 desktop / ≥ 70 mobile (both en + zh). Accessibility ≥ 90 all.

- [ ] **Step 6: If any score below target, surface to user**

If Performance < 80 desktop, the spec invariant fails. Do not retry blindly — report scores back to user along with the Lighthouse "Opportunities" panel highlights (LCP / CLS / TBT) so the user can decide: tune further vs ship at current score.

If all scores meet target, this task completes — proceed to Task 17.

---

### Task 17: Mark v2 spec superseded + handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md`

- [ ] **Step 1: Add superseded banner to v2 spec**

In `docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md`, locate the existing header (around line 3-6):

```markdown
**Created**: 2026-05-21
**Type**: Independent task (not in features.json state machine)
**Status**: Draft
**Predecessor**: 2026-05-19 landing-page-design (initial v1, see `2026-05-19-landing-page-design.md`)
```

Replace the `**Status**: Draft` line with:

```markdown
**Status**: **Superseded** by [`docs/superpowers/specs/2026-05-22-landing-redesign-cinematic-v3-design.md`](2026-05-22-landing-redesign-cinematic-v3-design.md) — v2's execution overused sticky/parallax; v3 fixes density without changing direction.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md
git commit -m "docs(landing): mark v2 spec as superseded by v3

v2 (2026-05-21) locked the direction correctly but its execution
produced a 15+ viewport page with sparse content bands across every
sticky/parallax section. v3 (2026-05-22) keeps the direction and
limits cinematic moments to 2 (Hero + ProductDemo), with the other
6 sections rewritten for density.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Report to user**

Summarize for user:
- Landing v3 redesign complete (Tasks 1-17, ~4 days).
- Staging deploy verified at `<sha>`.
- Lighthouse scores recorded (paste from Task 16).
- Hero video files still pending user delivery (`hero-loop.{mp4,webm}` to `public/landing/hero/`) — when delivered, no code change needed (already wired in HeroVideo from Task 3).
- 4 visual baselines regenerated via update-visual-baselines bot commit.
- v2 spec marked superseded.

Ask user for subjective sign-off: does the staging deploy now feel like the cinematic intent, without scroll fatigue?

---

## Out-of-scope (deferred to future batches)

These appeared in the v3 spec but are intentionally NOT in this plan:

- TopNav K-letter logomark (spec §13 — defer continues).
- StickyStack.tsx deletion (kept this batch, remove next batch if still no caller).
- StickyParallax legacy `stickyAsset` prop removal (kept this batch as `@deprecated`, remove next batch).
- Old `_deprecated_by_v3_` i18n keys cleanup (remove next batch after Generator verifies no Production caller).
- Hero video assets — user delivers externally, no engineering involvement.

---

## Notes for the executor

- **WSL2 vitest:** always pass `--pool=threads --maxWorkers=1`. Fork pool is unstable in WSL2 (per `.auto-memory/role-context/generator.md`).
- **Staging deploy is a hard prerequisite** to switch any state-machine status — but this is an independent task (not in features.json), so the staging deploy here is only for the Lighthouse audit (Task 16), not for a verifying handoff.
- **CI cascade after bot commits:** `update-visual-baselines.yml` auto-commits via `github-actions[bot]`; that commit does NOT trigger CI. After Task 15 bot commit, manually `gh workflow run ci.yml --ref main` if you need a CI re-verification.
- **Commit hygiene:** before every `git commit`, run `git diff --cached --name-only` to verify the staged set is exactly what this task expects. The harness rule "iron 12" (per CLAUDE.md / harness-rules.md §"铁律") requires this — multi-agent shared worktrees can leak WIP into your commit otherwise.
- **No state machine writes:** this is an independent task. Do NOT update `progress.json`, `features.json`, or `backlog.json`. The work is judged by the spec acceptance criteria (spec §14) plus user subjective sign-off (Task 17 Step 3).

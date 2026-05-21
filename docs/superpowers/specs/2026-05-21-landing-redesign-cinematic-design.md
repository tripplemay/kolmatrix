# Landing Redesign — Cinematic v2 Design Spec

**Created**: 2026-05-21
**Type**: Independent task (not in features.json state machine)
**Status**: Draft
**Predecessor**: 2026-05-19 landing-page-design (initial v1, see `2026-05-19-landing-page-design.md`)

## 1. Goals

Bring the KolMatrix landing page up to "modern high-end tech brand" visual language. User has explicitly rejected the v1 + P0/P1 polish output as still feeling like a "feature-dump SaaS template" rather than a brand-led product page.

Reference cohort: Apple product pages (iPhone 17), Riot Games landing, Anthropic Claude landing, Vercel/Resend/Linear homepages, Stripe Sessions.

Concrete improvements over current state:

- **Hero promoted from "info dense KPI strip" to single dominant video + 1 line + 1 CTA** (cinematic, brand-led)
- **8 sections rewritten with dark/light alternation + parallax editorial rhythm** (vs current all-dark + uniform py-20)
- **H1 typography pushed to 124px desktop / 64px mobile with Geist Sans** (vs current 4xl-6xl with default Tailwind)
- **Scroll-driven micro-interactions** (sticky stack, reveal masks, fade-up stagger) replace current passive scroll
- **Dual-theme color tokens** introduced so light sections can render with full design fidelity (米白底 #F7F5F0 + 深色文字 + 暗色 component variants)

## 2. Non-Goals

- **No re-architecture of `/match` `/reach` `/insight` `/brief` app surfaces.** Out of scope — those follow their own BL-066 → BL-070 trajectory.
- **No new product feature.** The change is presentational only — no DB schema, no server action, no API. (Hero KOL count was already removed in 2026-05-21 commit `ba5fcc3`, so even the existing `prisma.kol.count()` is gone.)
- **No multi-locale extension.** The 5-locale namespace (zh/en/ja/ko/es) already exists and will be re-populated for any new copy, but no new locales added.
- **No AB testing / analytics instrumentation** in this batch — measure ad-hoc post-launch.
- **No SEO restructure.** Existing `generateMetadata` / `sitemap.ts` / `robots.ts` / dynamic OG image from v1 stay as-is.
- **No tracking pixels / 3rd-party scripts.** Privacy/Terms still removed (per 2026-05-20 ack).

## 3. Locked Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Visual direction | **C — Apple / Game-brand cinematic** | User Q1 selection. Highest brand ambition; closest to Riot / Apple product pages. |
| Hero visual asset | **3 — Video / Product Demo** | User Q2 selection. "See-it-want-to-try-it" strongest hook. |
| Video source | **C — AI-generated (Runway / Kling / Sora)** | User Q3 selection. Engineer prepares prompts + code scaffold; **user owns video production externally** (4-8h prompt iteration). |
| Color palette | **1 — Cyan + Purple (current)** | User Q4 selection. Zero migration cost; matches existing app-side secondary (purple in `/match` AI sidebar). |
| Typography | **A — Geist Sans + 苹方 PingFang SC + H1 124px** | User Q5 selection. Vercel/Resend lineage; system 苹方 for CN (zero-cost CN font). |
| Section rhythm | **B+D Fusion v2 — Dark/Light alternation + 5 parallax sections** | User Q6 (Fusion) + Q7 (expand parallax to 5 sections). Rhythm beats both pure-B (3-4 day, no editorial polish) and pure-D (5-6 day, all-dark fatigue). |

## 4. Component Architecture

### 4.1 Section-by-section layout

| # | Section | Theme | Parallax / Animation | Notes |
|---|---|---|---|---|
| 1 | Hero | 🌑 Dark | Video auto-play loop only (no parallax — video is the motion) | New: `<video>` `<source mp4 / webm>` `<poster>` + reduced-motion fallback to `<img>` |
| 2 | PainPoints | ☀️ Light (#F7F5F0) | **Reveal mask** — clip-path scroll-driven | 4 cards transition from transparent → opaque as user scrolls in |
| 3 | BeforeAfter | 🌑 Dark | **Sticky row-highlight** — 4 rows light up sequentially as user scrolls | cyan progress line follows scroll position |
| 4 | Features | ☀️ Light | **Sticky split + stack** — left col `position: sticky` holds H2 "Six modules. One workflow."; right col 6 cards scroll & stack | Each card stack point is one snap step inside the section |
| 5 | EmailCenterDemo | 🌑 Dark | **Sticky large parallax** — product screenshot stays half-screen, left copy scrolls through 3 callouts; screenshot subtly zooms (scale 1.0 → 1.08) | The most polished moment of the page |
| 6 | Trust | ☀️ Light | **Sticky split + stagger reveal** — left col sticky "Built on trust" H2; right col 3 cards reveal in sequence as user scrolls | mirrors Features structure (#4) |
| 7 | FAQ | 🌑 Dark | `fade-up` only (FAQ has its own collapse interaction, no parallax) | Existing 5 questions; no copy change |
| 8 | FooterCTA | 🌑 Dark | CTA `glow-pulse` + headline `fade-up` | Single dominant CTA `Request access →` (footer secondary CTA → demo) |

### 4.2 New / changed components

| File | Status | Purpose |
|---|---|---|
| `src/app/[locale]/(marketing)/_components/HeroVideo.tsx` | NEW (replaces current `Hero.tsx`) | Video-driven hero with `<video>` + poster + reduced-motion `<img>` fallback |
| `src/app/[locale]/(marketing)/_components/PainPoints.tsx` | REWRITE | Light theme + reveal-mask scroll anim |
| `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx` | REWRITE | Dark + sticky row-highlight |
| `src/app/[locale]/(marketing)/_components/Features.tsx` | REWRITE | Light + sticky split + stack |
| `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx` | REWRITE | Dark + sticky large parallax (existing only had static 3-image grid) |
| `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx` | REWRITE | Light + sticky split + stagger reveal |
| `src/app/[locale]/(marketing)/_components/FAQ.tsx` | MINOR | Same component logic; add `fade-up` wrapper |
| `src/app/[locale]/(marketing)/_components/FooterCTA.tsx` | MINOR | Add `glow-pulse` to CTA + `fade-up` to headline |
| `src/app/[locale]/(marketing)/_components/TopNav.tsx` | MINOR | Adjust logo treatment, may add `K`-letter logomark |
| `src/app/[locale]/(marketing)/_components/LandingPage.tsx` | REWIRE | Wrap each section in `<ScrollFadeIn>` / parallax containers |
| `src/app/[locale]/(marketing)/_components/SectionTransition.tsx` | NEW | 12px cyan→transparent gradient strip between dark↔light sections |
| `src/components/landing/useScrollProgress.ts` | NEW (client hook) | IntersectionObserver-backed util for fade-up + parallax progress |
| `src/components/landing/ScrollFadeIn.tsx` | NEW | Wrapper that applies `opacity-0 translate-y-4` → animated state when in-view |
| `src/components/landing/StickyStack.tsx` | NEW | Sticky split-layout container for Features + Trust |
| `src/components/landing/StickyParallax.tsx` | NEW | Sticky single-element + scroll-driven copy switching for EmailCenterDemo |
| `src/app/globals.css` (or tailwind theme) | ADD | New tokens: `surface-light`, `on-surface-light`, `surface-light-container`, etc. |
| `src/app/fonts/` | ADD | `Geist-Variable.woff2` + `GeistMono-Variable.woff2` (next/font/local) |
| `public/landing/hero/` | NEW dir | `hero-loop.mp4`, `hero-loop.webm`, `hero-poster.jpg` (user-provided) |

### 4.3 Component dependency graph

```
LandingPage
├── TopNav
├── HeroVideo  ──────── (no scroll lib; video native loop)
├── SectionTransition  (dark → light)
├── ScrollFadeIn → PainPoints  (reveal-mask)
├── SectionTransition  (light → dark)
├── ScrollFadeIn → BeforeAfter  (sticky row-highlight, uses useScrollProgress)
├── SectionTransition  (dark → light)
├── StickyStack → Features  (sticky split + stack)
├── SectionTransition  (light → dark)
├── StickyParallax → EmailCenterDemo  (sticky single + copy scroll)
├── SectionTransition  (dark → light)
├── StickyStack → Trust  (sticky split + stagger reveal)
├── SectionTransition  (light → dark)
├── ScrollFadeIn → FAQ
└── ScrollFadeIn → FooterCTA  (glow-pulse on CTA)
```

`useScrollProgress` is the shared hook. Each parallax container computes its own `progress: 0..1` from IntersectionObserver `rootMargin` + `getBoundingClientRect`, then drives CSS variables (no JS-driven inline styles in render loop).

## 5. Theme System

### 5.1 Dual-theme color tokens (Tailwind `@theme`)

Currently `globals.css` defines a single dark-leaning M3 palette (`--color-surface`, `--color-on-surface`, etc). We extend it without breaking the app side:

```css
@theme {
  /* Existing dark tokens — unchanged */
  --color-surface: #0a0a0a;
  --color-on-surface: #e8e8e8;
  --color-surface-container: #1a1a1a;
  /* ... */

  /* NEW — light theme tokens (landing-page light sections only) */
  --color-surface-light: #f7f5f0;
  --color-on-surface-light: #1a1a1a;
  --color-surface-light-container: #ffffff;
  --color-surface-light-container-lowest: #ede9df;
  --color-on-surface-light-variant: #5a5a5a;

  /* NEW — parallax / sticky helpers */
  --color-glow-cyan: rgba(0, 229, 255, 0.5);
  --color-glow-purple: rgba(168, 85, 247, 0.4);
}
```

Light section components use `bg-surface-light text-on-surface-light` Tailwind classes. **App-side components are NOT migrated** — they continue using the dark tokens. The light tokens are landing-page-local additions, no breaking change.

### 5.2 Typography setup (next/font/local)

```typescript
// src/app/fonts.ts (NEW or extend existing)
import localFont from "next/font/local";

export const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

export const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});
```

`layout.tsx` adds `${geistSans.variable} ${geistMono.variable}` to the `<html>` `className` so the CSS variables are available globally — but **only landing-page components reference them**. Tailwind config exposes them as `font-geist` / `font-geist-mono` utility classes:

```typescript
// tailwind.config.ts (excerpt)
fontFamily: {
  geist: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
  "geist-mono": ["var(--font-geist-mono)", "ui-monospace", "Menlo", "monospace"],
}
```

Landing page hero H1 uses:

```tsx
<h1 className="font-geist text-[88px] leading-[0.9] font-extrabold tracking-[-0.04em] sm:text-[124px]">
  Built for<br/>game creators.
</h1>
```

**App-side components do NOT switch to Geist** — they continue using the existing default sans stack. The font variable is loaded globally (single woff2 fetch) but only landing components opt in via `font-geist` class.

Chinese text (`messages/zh.json`) on landing renders with `font-geist` too; Geist falls through to system 苹方 / Noto Sans CJK SC for CJK glyphs automatically via the fallback chain.

### 5.3 Cinematic gradient text recipe

```css
.cinematic-text {
  background: linear-gradient(135deg, #ffffff 0%, #00e5ff 50%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 80px rgba(0, 229, 255, 0.4);
}
```

Used on Hero H1 + FooterCTA H2. Other H2s stay solid `text-white` / `text-on-surface-light` (don't overuse the effect).

## 6. Video Asset Pipeline

### 6.1 Files expected at `public/landing/hero/`

| File | Format | Size cap | Purpose |
|---|---|---|---|
| `hero-loop.mp4` | H.264 yuv420p | ≤ 8 MB | Primary `<source>` for Safari / iOS |
| `hero-loop.webm` | VP9 | ≤ 6 MB | Primary `<source>` for Chrome / Firefox / Android |
| `hero-poster.jpg` | JPEG ~80 quality | ≤ 200 KB | Shown before video loads; shown when `prefers-reduced-motion: reduce` |

Duration: 8-12 seconds, no audio, seamless loop. Resolution 1920×1080 (downscaled to 1280×720 served via Next.js Image if bandwidth budget tight).

### 6.2 Prompt scaffolding (Generator delivers, user runs externally)

Provided as 5 reusable prompts in `docs/landing/hero-video-prompts.md` (created in implementation phase, not in this spec). Examples (placeholder copy):

```
1. "Cinematic shot, cyan and purple data streams flowing through a stylized
   global network globe, neon highlights, dark space background, 8 second
   seamless loop, 16:9, no text, no humans."

2. "Abstract motion graphic: glowing cyan particles converging into a central
   purple orb, then radiating outward, geometric precision, dark background,
   8 second loop, 1920x1080."

(plus 3-5 variants)
```

User picks 1-2, runs through Runway Gen-3 / Kling / Pika, delivers final files. We do not generate the prompts inside this spec — they live in their own doc to allow iteration without churning this spec.

### 6.3 Fallback chain

```tsx
<video autoPlay muted loop playsInline poster="/landing/hero/hero-poster.jpg" preload="metadata">
  <source src="/landing/hero/hero-loop.webm" type="video/webm" />
  <source src="/landing/hero/hero-loop.mp4" type="video/mp4" />
</video>
```

- If both sources fail to load → browser shows poster image
- If `prefers-reduced-motion: reduce` → we replace `<video>` with `<Image src="hero-poster.jpg" />` at build time (`useReducedMotion()` hook on client; for SSR consistency, default to video and downgrade on hydrate)
- Mobile `< 768px`: still serve video (modern phones handle it fine; lazy-load `preload="metadata"` is enough)

## 7. Scroll-driven Animation System

### 7.1 useScrollProgress (single hook)

```typescript
// src/components/landing/useScrollProgress.ts
"use client";
import { useEffect, useState, useRef, type RefObject } from "react";

export function useScrollProgress(
  ref: RefObject<HTMLElement>,
  options: { startOffset?: number; endOffset?: number } = {}
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = options.startOffset ?? vh;
      const end = options.endOffset ?? -rect.height;
      const total = start - end;
      const current = start - rect.top;
      setProgress(Math.max(0, Math.min(1, current / total)));
    };

    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [ref, options.startOffset, options.endOffset]);

  return progress;
}
```

Components consume `progress` and write to `style={{ "--p": progress }}` then drive CSS transforms via `calc()`. **No inline style mutations on every scroll event** (the only state change is one CSS var per container).

### 7.2 ScrollFadeIn — basic fade-up (used 4 places)

IntersectionObserver-based, fires once per element. ~20 LOC.

### 7.3 prefers-reduced-motion

Single global media query in `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  [data-parallax] { position: static !important; }
}
```

Sticky elements get `data-parallax` so they degrade to normal flow under reduced motion.

### 7.4 Mobile fallback (`< 1024px`)

CSS media query disables sticky in narrow viewports:

```css
@media (max-width: 1023px) {
  [data-parallax="sticky"] { position: static !important; }
  /* Stagger times reduced; cards reveal closer together */
}
```

JS hook (`useScrollProgress`) still runs on mobile but its output is unused there (cheap; no perf cost).

## 8. Section Transitions

`SectionTransition.tsx` is a 12-16px tall divider component placed between dark↔light boundaries:

```tsx
export function SectionTransition({ from, to }: { from: "dark" | "light"; to: "dark" | "light" }) {
  const direction = from === "dark" ? "from-surface to-surface-light" : "from-surface-light to-surface";
  return (
    <div className={`h-3 bg-gradient-to-b ${direction}`} aria-hidden />
  );
}
```

(Same component, just direction-aware.) Optional `cyan` accent line at midpoint can be added later if the bare gradient feels too soft.

## 9. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| Video files missing (404) | `<video>` shows poster image (set on `<video poster=...>`). Poster image is required — never serve without it. |
| Video too large for slow connection | `preload="metadata"` only loads metadata + poster on initial paint. Video starts loading on `play()` trigger. |
| User has `prefers-reduced-motion: reduce` | Server renders `<video>` (SSR consistency); client `useReducedMotion()` swaps to `<img>` post-hydrate. Parallax sticky elements fall back to normal flow via CSS. |
| Mobile narrow viewport (`< 1024px`) | All sticky elements fall back to normal flow. Parallax progress hook still runs but its CSS-var output is unused in stylesheet. |
| JS disabled | Server-rendered HTML shows all sections in correct theme, no animations. CTAs work. Video poster shows but won't loop. |
| Geist font fails to load | `font-display: swap` → fallback to system sans-serif (Geist → Inter → Helvetica → sans-serif). No FOIT. |
| Light section H1 readability on米白 | Min text contrast WCAG AAA verified: `#1a1a1a` on `#F7F5F0` = 16.5:1 contrast. |
| Parallax causes layout shift (CLS) | Each parallax container has a fixed `min-height: 200vh` reserved at render so layout doesn't shift on scroll. |

## 10. Testing Strategy

### 10.1 Visual baselines (full regen required)

The existing 4 landing baselines (`landing-{en,zh}-{desktop,mobile}.png`) will all drift since every section changes. Plan: complete drop and re-generate via `update-visual-baselines.yml` workflow (same pattern as 2026-05-19 → 2026-05-21 churn).

Additionally: **add 2 new visual checkpoints**:
- `landing-{en,zh}-mid-scroll.png` — captured at `scroll: 50vh` to verify EmailCenterDemo sticky parallax stays parked correctly
- `landing-light-section.png` — single section snapshot of light Features to lock the new light theme palette

### 10.2 E2E tests

| File | Change |
|---|---|
| `tests/e2e/landing.spec.ts` | Keep existing 3 tests (hero visible / CTA primary / CTA secondary + demo). Add 1 test: video element present + autoplay attribute + poster image accessible. |
| `tests/e2e/locale-detection.spec.ts` | No change |
| `tests/e2e/request-access.spec.ts` | No change |
| `tests/e2e/visual-regression.spec.ts` | Update 4 existing landing baselines; add 2 new (`*-mid-scroll`, `*-light-section`) |

### 10.3 Unit tests

| File | Test |
|---|---|
| `src/components/landing/useScrollProgress.test.ts` | NEW — mock IntersectionObserver, assert progress 0 → 1 over fake scroll |
| `src/components/landing/ScrollFadeIn.test.tsx` | NEW — verify `data-state="in-view"` flips when IO callback fires |
| `tests/unit/i18n-locale-coverage.test.ts` | Update KEEP_AS_EN_PATHS for any new copy that legitimately stays English (likely none — Hero now uses minimal English-style copy in zh too) |

### 10.4 A11y

- Manual axe-core run on light + dark sections
- Lighthouse a11y score must stay ≥ 90 (currently 91-97 per BL-070 audit)
- Verify all decorative animations don't have `aria-live`
- Video has `aria-label` set from i18n; no captions needed (no audio)

### 10.5 Performance

- Lighthouse Performance current baseline: 75-78 (under BL-070 ceiling)
- Target after redesign: **stay ≥ 70**, ideally ≥ 75
- Hero video lazy-loaded (`preload="metadata"`) — initial bundle should not regress
- Geist fonts: ~80KB total (Sans + Mono); offset by removal of any Material Symbols overhead (kept; they're already 11KB)
- Parallax JS: ~3KB gzipped (single hook + 3 thin wrappers)

## 11. Implementation Phases

Break implementation into 3 phases to keep PRs reviewable:

### Phase 1 — Foundations (~2.5 day)
- Light theme tokens in `globals.css`
- Geist + GeistMono fonts via `next/font/local`
- `SectionTransition.tsx` component
- `useScrollProgress.ts` hook + unit test
- `ScrollFadeIn.tsx` wrapper + unit test
- `globals.css` reduced-motion + mobile fallback rules
- Tailwind config: add `font-geist` / `font-geist-mono` utility classes; do NOT change global `font-sans` (app side stays default)

### Phase 2 — Section rewrites + Hero video integration (~4 day)
- `HeroVideo.tsx` (with placeholder `<video>` pointing to expected file path — user delivers files later)
- `PainPoints.tsx` light + reveal-mask
- `BeforeAfter.tsx` dark + sticky row-highlight
- `Features.tsx` light + sticky stack (uses new `StickyStack.tsx`)
- `EmailCenterDemo.tsx` dark + sticky parallax (uses new `StickyParallax.tsx`)
- `TrustPlaceholder.tsx` light + sticky stagger reveal (uses `StickyStack.tsx`)
- `FAQ.tsx` minor — add `<ScrollFadeIn>` wrapper
- `FooterCTA.tsx` minor — add `glow-pulse` to primary CTA
- `LandingPage.tsx` rewire with new transitions
- i18n updates (any new copy keys for "Six modules. One workflow." etc.)

### Phase 3 — Video + visual baselines + polish (~1.5 day)
- User delivers `hero-loop.{mp4,webm}` + `hero-poster.jpg` to `public/landing/hero/`
- E2E test update (add video presence assertion)
- Trigger `update-visual-baselines.yml` to regenerate 4 existing + 2 new baselines
- Manual a11y + Lighthouse audit on staging
- Final polish round (timing fine-tune for parallax curves)

**Total: ~8 day** (slightly higher than the 8-day estimate from brainstorming due to Phase 3 polish overhead; absorbable).

## 12. Migration & Compatibility

| Concern | Handling |
|---|---|
| Existing landing 4 visual baselines | Drop all 4 + add 2 new in Phase 3 |
| App-side surface tokens | Untouched. Light theme is landing-page-local. |
| `BeforeAfter.tsx` from current main | Full rewrite; existing one becomes git history reference |
| `messages/{5 locales}.json` `landing.*` | Some keys removed (the implicit empty-array `linkLabel`s), some added (Features sticky H2, etc.). Re-run KEEP_AS_EN_PATHS audit. |
| `tests/e2e/landing.spec.ts` data-testids | All existing testids preserved (no breaking change to test infrastructure) |
| TopNav (independent change pending) | Stay as-is; the K-letter logomark idea is deferred to Phase 4 (out of scope this batch) |

## 13. Open Questions

1. **Hero video copy**: current Hero displays subtitle + 4 KPI strip + dual CTA. New cinematic hero is "1 line + 1 sub + 1 CTA". KPI strip moves to... where? (Proposal: drop it entirely — info is restated in Features section. Re-confirm in implementation kickoff.)
2. **TopNav K-letter logomark**: deferred. Design decision (which character form, color treatment) postponed to a follow-up batch.
3. **Hero video prompts**: 5 prompt candidates to be written by Generator in Phase 2 kickoff; stored in `docs/landing/hero-video-prompts.md` so user can iterate without re-touching this spec.
4. **Light section illustrative content**: PainPoints / Features / Trust on light backgrounds — should the icons stay current Material Symbols (cyan-accented), or are some elements redesigned with light-theme appropriate strokes? Deferred to Phase 2 component implementation; default = keep Material Symbols in cyan even on light bg (sufficient contrast against #F7F5F0).

## 14. Success Criteria

- ✅ Visual direction unambiguously reads as "Apple / Stripe / Linear class" rather than "SaaS template"
- ✅ All 8 sections render correctly on both desktop and mobile
- ✅ Lighthouse Performance ≥ 70 (no regression from current 75-78 floor)
- ✅ Lighthouse A11y ≥ 90 (no regression)
- ✅ All existing E2E tests pass
- ✅ 5 locales render the new copy with parity (i18n-locale-coverage 8/8)
- ✅ User confirms the staging deploy "now feels modern high-end tech" (subjective sign-off; this user-perceived gate is what triggered the rewrite, so it is the canonical acceptance signal)
- ✅ Video assets in place; reduced-motion users see still poster correctly

## 15. References

- Predecessor spec: `docs/superpowers/specs/2026-05-19-landing-page-design.md`
- Predecessor commits: 98c9a90 → ff2d407 (v1 18 commits), ba5fcc3 (v2 P0+P1 polish), f4f254a (visual baseline regen)
- Brainstorming visual mockups: `.superpowers/brainstorm/289102-1779346030/content/` (visual-direction.html, hero-asset.html, video-strategy.html, color-palette.html, typography.html, section-rhythm.html)
- Reference cohort: Apple iPhone 17 / iPad pages, Riot Games landing, Anthropic Claude landing, Vercel/Resend/Linear homepages, Stripe Sessions, Anthropic Claude API docs landing

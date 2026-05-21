# Landing Redesign (Cinematic v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the KolMatrix landing page in an Apple/game-brand cinematic visual language (full video hero + dark/light section alternation + 5 parallax/sticky sections) so it reads as a brand-led product page rather than a feature-dump SaaS template.

**Architecture:** 16 tasks across 3 phases — Phase 1 lays foundations (light theme tokens, Geist fonts, scroll progress hook, transition primitives); Phase 2 rewrites all 7 sections with parallax/sticky containers and adds the new HeroVideo; Phase 3 wires user-provided video files, regenerates visual baselines, and ships to staging+prod.

**Tech Stack:** Next.js 16 App Router · React 19.2 server components (parallax wrappers are client) · Tailwind v4 (`@theme` CSS-first, no `tailwind.config.ts`) · next-intl (5 locales) · next/font/local for Geist · IntersectionObserver-backed `useScrollProgress` hook (no scroll-anim library) · Playwright for E2E + visual baselines.

---

## File Structure

**New files:**

- `src/app/[locale]/(marketing)/_components/HeroVideo.tsx` — Hero with `<video>` + reduced-motion `<img>` fallback (replaces `Hero.tsx`)
- `src/app/[locale]/(marketing)/_components/SectionTransition.tsx` — Gradient strip between dark↔light sections
- `src/app/[locale]/(marketing)/_components/StickyStack.tsx` — Sticky split-layout wrapper (Features + Trust)
- `src/app/[locale]/(marketing)/_components/StickyParallax.tsx` — Sticky single-image + scroll-driven copy wrapper (EmailDemo)
- `src/components/landing/useScrollProgress.ts` — IO-based scroll-progress hook
- `src/components/landing/ScrollFadeIn.tsx` — Wrapper for opacity-fade + translate-up on enter-view
- `src/components/landing/useScrollProgress.test.ts` — Unit test
- `src/components/landing/ScrollFadeIn.test.tsx` — Unit test
- `src/app/fonts/Geist-Variable.woff2` — Geist Sans variable font (downloaded as part of Task 2)
- `src/app/fonts/GeistMono-Variable.woff2` — Geist Mono variable font
- `public/landing/hero/hero-loop.mp4` — User-provided video
- `public/landing/hero/hero-loop.webm` — User-provided video
- `public/landing/hero/hero-poster.jpg` — User-provided poster image
- `docs/landing/hero-video-prompts.md` — 5 prompt candidates for user to run through Runway/Kling/Sora

**Modified files:**

- `src/styles/globals.css` — Add 8 light-theme tokens, add Geist/GeistMono `--font-*` vars, add reduced-motion + mobile-fallback rules
- `src/app/layout.tsx` — Wire `geistSans.variable` + `geistMono.variable` to `<html>` className
- `src/app/[locale]/(marketing)/_components/PainPoints.tsx` — Rewrite (light + reveal-mask)
- `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx` — Rewrite (dark + sticky row-highlight)
- `src/app/[locale]/(marketing)/_components/Features.tsx` — Rewrite (light + sticky stack via StickyStack)
- `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx` — Rewrite (dark + sticky parallax via StickyParallax)
- `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx` — Rewrite (light + sticky stagger reveal via StickyStack)
- `src/app/[locale]/(marketing)/_components/FAQ.tsx` — Wrap in `<ScrollFadeIn>`
- `src/app/[locale]/(marketing)/_components/FooterCTA.tsx` — Add `glow-pulse` to primary CTA
- `src/app/[locale]/(marketing)/_components/TopNav.tsx` — Minor tweaks for cinematic context (no logomark — deferred)
- `src/app/[locale]/(marketing)/_components/LandingPage.tsx` — Rewire with SectionTransition + new HeroVideo
- `messages/zh.json` · `en.json` · `ja.json` · `ko.json` · `es.json` — Restructure `landing` namespace (kpis removed, beforeAfter copy refined, new keys for sticky-stack H2s)
- `tests/unit/i18n-locale-coverage.test.ts` — Update KEEP_AS_EN_PATHS
- `tests/e2e/landing.spec.ts` — Add video element + autoplay attribute assertion
- `scripts/material-symbols-icons-manifest.txt` — Add any new icons used in rewrites (likely `play_circle` for HeroVideo poster overlay)

**Removed files:**

- `src/app/[locale]/(marketing)/_components/Hero.tsx` — Superseded by HeroVideo.tsx

---

## Phase 1 — Foundations

### Task 1: Add light-theme tokens to globals.css

**Files:**
- Modify: `src/styles/globals.css:22-64` (existing `@theme` block)

- [ ] **Step 1: Read the current `@theme` block to understand the existing token structure**

```bash
sed -n '22,65p' src/styles/globals.css
```

Expected: Sees the brand cyan + purple + navy surface stack tokens already declared.

- [ ] **Step 2: Add light-theme tokens immediately after the existing `--color-outline-variant` line**

Modify `src/styles/globals.css` by inserting these lines after `--color-outline-variant: #3b494c;` (current line 50):

```css
  /* Landing-page light theme tokens (BL-landing-cinematic-v2).
     Used only by landing-page light sections; app side unaffected. */
  --color-surface-light: #f7f5f0;
  --color-surface-light-container: #ffffff;
  --color-surface-light-container-lowest: #ede9df;
  --color-on-surface-light: #1a1a1a;
  --color-on-surface-light-variant: #5a5a5a;
  --color-on-surface-light-muted: #7a7a7a;

  /* Glow accents (rgba so they compose with backgrounds) */
  --glow-cyan: rgba(0, 229, 255, 0.5);
  --glow-purple: rgba(157, 80, 255, 0.45);
```

- [ ] **Step 3: Verify the file parses (no syntax error)**

Run: `npx tsc --noEmit && npm run lint -- --max-warnings=10 2>&1 | tail -10`

Expected: typecheck passes (CSS doesn't go through tsc; this is a sanity check for whole-project lint chain).

Verify Tailwind picks up the new tokens by running a quick dev probe:

```bash
grep -nE '(surface-light|glow-cyan|glow-purple)' src/styles/globals.css
```

Expected: 9 lines printed showing the new tokens defined.

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(landing): add light-theme tokens for cinematic v2 redesign

Adds 6 light-surface tokens + 2 glow color helpers under the existing
@theme block. Landing-page light sections will consume these via
Tailwind utility classes (bg-surface-light, text-on-surface-light).
App side untouched — no existing token modified.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §5.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add Geist + GeistMono fonts via next/font/local

**Files:**
- Create: `src/app/fonts/Geist-Variable.woff2` (downloaded)
- Create: `src/app/fonts/GeistMono-Variable.woff2` (downloaded)
- Modify: `src/app/layout.tsx` (add font declarations + extend `<html>` className)
- Modify: `src/styles/globals.css` (add `--font-geist` + `--font-geist-mono` to `@theme` block)

- [ ] **Step 1: Download Geist Variable + Geist Mono Variable fonts**

Geist is open source under SIL OFL. Download from the official Vercel mirror:

```bash
mkdir -p src/app/fonts
curl -fsSL -o src/app/fonts/Geist-Variable.woff2 \
  'https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts/geist-sans/Geist-Variable.woff2'
curl -fsSL -o src/app/fonts/GeistMono-Variable.woff2 \
  'https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts/geist-mono/GeistMono-Variable.woff2'
ls -la src/app/fonts/
```

Expected: Two files ~80-120 KB each appear next to the existing `material-symbols-outlined.woff2`.

If those URLs change in the future, fallback is to install `geist` npm package and copy `node_modules/geist/dist/fonts/*.woff2` into `src/app/fonts/`.

- [ ] **Step 2: Add `geistSans` + `geistMono` `localFont` declarations to `src/app/layout.tsx`**

In `src/app/layout.tsx`, immediately after the existing `materialSymbols` declaration (around line 26), add:

```typescript
// Cinematic v2 landing page — Geist Sans + Mono. Only landing-page
// components opt in via Tailwind `font-geist` / `font-geist-mono`
// utility classes. App side stays on Inter via `font-sans`.
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});
```

- [ ] **Step 3: Wire the two new variables into the `<html>` `className`**

Find the existing line:

```tsx
className={`${inter.variable} ${materialSymbols.variable} h-full antialiased`}
```

Replace with:

```tsx
className={`${inter.variable} ${materialSymbols.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
```

- [ ] **Step 4: Expose `--font-geist` + `--font-geist-mono` as Tailwind v4 tokens in globals.css**

In `src/styles/globals.css`, inside the existing `@theme` block (around line 63 where `--font-sans` is declared), add immediately after `--font-sans`:

```css
  /* Cinematic v2 landing — Geist family. App side stays on Inter (--font-sans). */
  --font-geist: var(--font-geist-sans), ui-sans-serif, -apple-system, "PingFang SC", "Source Han Sans", sans-serif;
  --font-geist-mono: var(--font-geist-mono-raw), "SF Mono", Menlo, "Source Han Mono", monospace;
```

Note: next/font sets `--font-geist-sans` to the actual font-family stack, so we reference it directly. Tailwind v4 turns these into `font-geist` and `font-geist-mono` utility classes automatically.

- [ ] **Step 5: Verify with a typecheck + dev render probe**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

```bash
grep -nE 'geistSans|geistMono' src/app/layout.tsx
```

Expected: 4 hits (two `localFont` declarations + two references in `className`).

- [ ] **Step 6: Commit**

```bash
git add src/app/fonts/Geist-Variable.woff2 src/app/fonts/GeistMono-Variable.woff2 src/app/layout.tsx src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(landing): load Geist Sans + Mono via next/font/local

Self-hosts Geist Variable + Geist Mono Variable (Vercel's open-source
font, SIL OFL) and exposes them as Tailwind v4 utilities `font-geist` /
`font-geist-mono`. App side is unaffected — Inter (`font-sans`) stays
the default; only landing components opt into Geist explicitly.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §5.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: useScrollProgress hook + unit test

**Files:**
- Create: `src/components/landing/useScrollProgress.ts`
- Create: `src/components/landing/useScrollProgress.test.ts`

- [ ] **Step 1: Write the failing unit test first**

Create `src/components/landing/useScrollProgress.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { useScrollProgress } from "./useScrollProgress";

// Mock scroll-triggered geometry: jsdom's getBoundingClientRect returns
// zeroes, so we patch it for each test.
function mockRect(top: number, height: number) {
  return {
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("useScrollProgress", () => {
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it("returns 0 when element is below viewport", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      // Simulate a mounted element below viewport
      const el = document.createElement("div");
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(900, 400));
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    // Initial paint runs handler() once. Below viewport → top > startOffset
    // (which defaults to innerHeight=800) → progress clamps to 0.
    expect(result.current).toBe(0);
  });

  it("returns ~1 when element is fully above viewport", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      const el = document.createElement("div");
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(-500, 400));
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    expect(result.current).toBe(1);
  });

  it("returns ~0.5 when element top is halfway through the viewport", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      const el = document.createElement("div");
      // innerHeight=800, height=400, default start=800, default end=-400
      // total span = 1200. At top=200, current=800-200=600. progress=600/1200=0.5
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(200, 400));
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    expect(result.current).toBeCloseTo(0.5, 1);
  });

  it("re-computes progress on scroll event", () => {
    const el = document.createElement("div");
    const getRect = vi.spyOn(el, "getBoundingClientRect").mockReturnValue(mockRect(900, 400));

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      (ref as { current: HTMLElement | null }).current = el;
      return useScrollProgress(ref);
    });

    expect(result.current).toBe(0);

    // Simulate scroll moving element up into viewport
    getRect.mockReturnValue(mockRect(200, 400));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current).toBeCloseTo(0.5, 1);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails (import error)**

```bash
npx vitest run src/components/landing/useScrollProgress.test.ts --pool=threads --maxWorkers=1
```

Expected: FAIL with "Cannot find module './useScrollProgress'" or similar. This is the desired red.

- [ ] **Step 3: Write the hook implementation**

Create `src/components/landing/useScrollProgress.ts`:

```typescript
"use client";

import { useEffect, useState, type RefObject } from "react";

interface Options {
  /**
   * The viewport position (px from top) at which `progress` is 0.
   * Defaults to `window.innerHeight` — i.e. element top = viewport bottom.
   */
  startOffset?: number;
  /**
   * The viewport position (px from top) at which `progress` is 1.
   * Defaults to `-element.height` — i.e. element bottom = viewport top.
   */
  endOffset?: number;
}

/**
 * IntersectionObserver-adjacent scroll-progress reader.
 *
 * Returns a number 0..1 representing how far through its scroll
 * window the referenced element has travelled. 0 means the element is
 * below the viewport (default start = element top at viewport bottom);
 * 1 means the element is above the viewport (default end = element
 * bottom at viewport top).
 *
 * Consumers should write `progress` to a CSS variable rather than
 * inline-styling on every paint, e.g.:
 *
 *   <div ref={ref} style={{ "--p": progress }}>
 *
 * and then in CSS:
 *
 *   transform: translateY(calc(var(--p) * -40px));
 *
 * This keeps React out of the scroll path and lets the browser do
 * cheap compositor-only updates.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  options: Options = {}
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const start = options.startOffset ?? vh;
      const end = options.endOffset ?? -rect.height;
      const total = start - end;
      const current = start - rect.top;
      const p = total === 0 ? 0 : current / total;
      setProgress(Math.max(0, Math.min(1, p)));
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [ref, options.startOffset, options.endOffset]);

  return progress;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/components/landing/useScrollProgress.test.ts --pool=threads --maxWorkers=1
```

Expected: 4 tests PASS.

- [ ] **Step 5: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- src/components/landing/ 2>&1 | tail -5
```

Expected: 0 errors in both.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/useScrollProgress.ts src/components/landing/useScrollProgress.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add useScrollProgress hook + unit test

Cheap scroll-progress reader for cinematic v2 parallax sections. Reads
getBoundingClientRect on scroll/resize and reports a clamped 0..1
progress; consumers write the value to a CSS variable so the browser
can drive transforms compositor-only (no React in scroll path).

4 unit tests cover: initial 0 (below viewport), end 1 (above viewport),
midpoint 0.5, and re-compute on scroll event.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §7.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ScrollFadeIn wrapper + unit test

**Files:**
- Create: `src/components/landing/ScrollFadeIn.tsx`
- Create: `src/components/landing/ScrollFadeIn.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/landing/ScrollFadeIn.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScrollFadeIn } from "./ScrollFadeIn";

describe("ScrollFadeIn", () => {
  let originalIO: typeof IntersectionObserver;
  let observeCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    // Mock IO so we control when the in-view callback fires
    window.IntersectionObserver = vi.fn((cb) => {
      observeCallback = cb;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: "",
        thresholds: [],
        takeRecords: vi.fn(() => []),
      };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    observeCallback = null;
  });

  it("renders children with initial out-of-view state", () => {
    render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = screen.getByTestId("scroll-fade-in");
    expect(wrapper.getAttribute("data-state")).toBe("hidden");
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("transitions to in-view state when IntersectionObserver callback fires", () => {
    render(
      <ScrollFadeIn>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = screen.getByTestId("scroll-fade-in");

    // Simulate IO firing with isIntersecting=true
    observeCallback!(
      [
        {
          isIntersecting: true,
          target: wrapper,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 0.5,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
      ],
      {} as IntersectionObserver
    );

    expect(wrapper.getAttribute("data-state")).toBe("visible");
  });

  it("respects optional delay attribute", () => {
    render(
      <ScrollFadeIn delayMs={200}>
        <span>content</span>
      </ScrollFadeIn>
    );
    const wrapper = screen.getByTestId("scroll-fade-in");
    expect(wrapper.style.transitionDelay).toBe("200ms");
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

```bash
npx vitest run src/components/landing/ScrollFadeIn.test.tsx --pool=threads --maxWorkers=1
```

Expected: FAIL with "Cannot find module './ScrollFadeIn'".

- [ ] **Step 3: Implement the component**

Create `src/components/landing/ScrollFadeIn.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Extra class names applied to the wrapper. */
  className?: string;
  /** Delay before the fade transition starts (ms). Useful for stagger. */
  delayMs?: number;
  /** Optional rootMargin override (default '0px 0px -10% 0px' — fire slightly before fully in view). */
  rootMargin?: string;
}

/**
 * Wraps children in a `<div>` that starts at opacity 0 + translate-y 16px
 * and animates to opacity 1 + translate-y 0 the first time the wrapper
 * intersects the viewport.
 *
 * One-shot: once visible, the observer disconnects.
 *
 * Use `delayMs` to stagger sibling reveals (Features cards, Trust cards).
 */
export function ScrollFadeIn({
  children,
  className = "",
  delayMs = 0,
  rootMargin = "0px 0px -10% 0px",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      data-testid="scroll-fade-in"
      data-state={visible ? "visible" : "hidden"}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm pass**

```bash
npx vitest run src/components/landing/ScrollFadeIn.test.tsx --pool=threads --maxWorkers=1
```

Expected: 3 tests PASS.

- [ ] **Step 5: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- src/components/landing/ 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/ScrollFadeIn.tsx src/components/landing/ScrollFadeIn.test.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add ScrollFadeIn wrapper + unit test

IntersectionObserver-based one-shot fade-up wrapper for cinematic v2
landing sections (PainPoints, FAQ, FooterCTA, individual Features/Trust
cards via stagger). Wraps children with opacity-0 + translate-y-4 ->
opacity-100 + translate-y-0 transition on first intersection.

Disconnects observer after first reveal (no scroll-out re-trigger).
Supports delayMs prop for stagger orchestration.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §7.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: SectionTransition component (gradient strip)

**Files:**
- Create: `src/app/[locale]/(marketing)/_components/SectionTransition.tsx`

- [ ] **Step 1: Implement the component (trivial; visual-only, no unit test)**

Create `src/app/[locale]/(marketing)/_components/SectionTransition.tsx`:

```typescript
interface Props {
  /** Where the previous section ends — its background color. */
  from: "dark" | "light";
  /** Where the next section starts — its background color. */
  to: "dark" | "light";
}

/**
 * 16px gradient strip placed between sections to soften the
 * dark↔light boundary. Decorative only.
 *
 * Two sections sharing the same theme (dark → dark or light → light)
 * still render this as a near-invisible spacer so the page maintains
 * a consistent vertical rhythm.
 */
export function SectionTransition({ from, to }: Props) {
  const cls =
    from === "dark" && to === "light"
      ? "bg-gradient-to-b from-surface to-surface-light"
      : from === "light" && to === "dark"
        ? "bg-gradient-to-b from-surface-light to-surface"
        : from === "dark"
          ? "bg-surface"
          : "bg-surface-light";

  return (
    <div
      data-testid={`landing-section-transition-${from}-${to}`}
      className={`h-4 ${cls}`}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/SectionTransition.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add SectionTransition gradient strip component

16px decorative divider between landing sections. Renders a
gradient from one section's background to the next, softening
dark↔light boundaries. Used 6× in the new LandingPage layout.

Visual-only; no unit test (no behavior, just markup + class names).

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §8

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Reduced-motion + mobile fallback rules

**Files:**
- Modify: `src/styles/globals.css` (append at end)

- [ ] **Step 1: Append the rules to `src/styles/globals.css`**

At the very end of `src/styles/globals.css`, append:

```css
/* ============================================================
   Cinematic v2 landing — motion-safety + mobile fallback
   ============================================================ */

/* Reduced-motion: kill anim durations + force [data-parallax] back to normal flow. */
@media (prefers-reduced-motion: reduce) {
  [data-landing-cinematic] *,
  [data-landing-cinematic] *::before,
  [data-landing-cinematic] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  [data-landing-cinematic] [data-parallax="sticky"] {
    position: static !important;
    top: auto !important;
  }
}

/* Mobile (<1024px): disable sticky parallax — too jittery on touch devices. */
@media (max-width: 1023px) {
  [data-landing-cinematic] [data-parallax="sticky"] {
    position: static !important;
    top: auto !important;
  }
}

/* Cinematic gradient text recipe — reusable utility */
.cinematic-text {
  background: linear-gradient(135deg, #ffffff 0%, var(--color-cyan) 50%, var(--color-purple) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 80px rgba(0, 229, 255, 0.4);
}

/* CTA glow-pulse for FooterCTA */
@keyframes landing-cta-pulse {
  0%, 100% { box-shadow: 0 0 24px var(--glow-cyan); }
  50% { box-shadow: 0 0 40px var(--glow-cyan), 0 0 0 6px rgba(0, 229, 255, 0.15); }
}
.cta-glow-pulse {
  animation: landing-cta-pulse 3s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cta-glow-pulse { animation: none; box-shadow: 0 0 24px var(--glow-cyan); }
}
```

- [ ] **Step 2: Verify CSS parses (Next.js dev build doesn't break)**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

```bash
grep -nE 'data-landing-cinematic|cinematic-text|cta-glow-pulse|landing-cta-pulse' src/styles/globals.css
```

Expected: ≥7 hits across the new block.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(landing): reduced-motion + mobile fallback CSS rules

Adds 3 blocks to globals.css for cinematic v2:
- prefers-reduced-motion: kills all anim/transition durations inside
  [data-landing-cinematic]; forces sticky parallax to normal flow
- mobile <1024px: disables sticky parallax (touch jitter)
- .cinematic-text utility (gradient white→cyan→purple)
- .cta-glow-pulse keyframe + utility (FooterCTA primary CTA)

Scoped under [data-landing-cinematic] so app side is unaffected.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §7.3 §7.4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Section Rewrites + Hero Video Integration

### Task 7: HeroVideo.tsx (replaces Hero.tsx)

**Files:**
- Create: `src/app/[locale]/(marketing)/_components/HeroVideo.tsx`
- Modify: `messages/zh.json` · `en.json` · `ja.json` · `ko.json` · `es.json` — restructure `landing.hero` namespace (drop kpis, add minimal new copy)
- Delete: `src/app/[locale]/(marketing)/_components/Hero.tsx` (after LandingPage rewires in Task 14)

- [ ] **Step 1: Apply i18n changes to all 5 locales using a python patch script**

Create `/tmp/patch_hero_i18n.py`:

```python
#!/usr/bin/env python3
"""Restructure landing.hero for cinematic v2: drop kpis + screenshot alts."""
import json
from pathlib import Path

ROOT = Path("/mnt/c/Users/tripplezhou/project/kolmatrix/messages")

# kicker stays English-keep-as-en (brand "KolMatrix")
HERO_NEW = {
    "zh": {
        "kicker": "KOLMATRIX",
        "eyebrow": "GAME · KOL · AI · NATIVE",
        "title_line1": "为游戏出海",
        "title_line2": "而生",
        "subtitle": "AI 原生 · 一站式 · 全球游戏 KOL 指挥中心 — 从找人到投放复盘，一气呵成。",
        "ctaPrimary": "立即申请试用",
        "ctaSecondary": "预约 1v1 演示",
        "videoAlt": "KolMatrix 产品演示循环",
        "videoFallbackHint": "（动画版本不可用，已显示静态截图）",
    },
    "en": {
        "kicker": "KOLMATRIX",
        "eyebrow": "GAME · KOL · AI · NATIVE",
        "title_line1": "Built for",
        "title_line2": "game creators.",
        "subtitle": "An AI-native command center for global game KOL marketing — choreographed, not stitched.",
        "ctaPrimary": "Request access",
        "ctaSecondary": "Book a demo",
        "videoAlt": "KolMatrix product demo loop",
        "videoFallbackHint": "(Animation unavailable; showing still image)",
    },
    "ja": {
        "kicker": "KOLMATRIX",
        "eyebrow": "GAME · KOL · AI · NATIVE",
        "title_line1": "ゲームクリエイター",
        "title_line2": "のために。",
        "subtitle": "グローバルゲーム KOL マーケティングのための AI ネイティブ指揮センター。",
        "ctaPrimary": "トライアル申請",
        "ctaSecondary": "1:1 デモ予約",
        "videoAlt": "KolMatrix プロダクトデモループ",
        "videoFallbackHint": "(アニメーションは利用できません。静止画を表示中)",
    },
    "ko": {
        "kicker": "KOLMATRIX",
        "eyebrow": "GAME · KOL · AI · NATIVE",
        "title_line1": "게임 크리에이터를",
        "title_line2": "위해.",
        "subtitle": "글로벌 게임 KOL 마케팅을 위한 AI 네이티브 지휘 센터.",
        "ctaPrimary": "체험 신청",
        "ctaSecondary": "1:1 데모 예약",
        "videoAlt": "KolMatrix 제품 데모 루프",
        "videoFallbackHint": "(애니메이션을 사용할 수 없어 정지 이미지를 표시합니다)",
    },
    "es": {
        "kicker": "KOLMATRIX",
        "eyebrow": "GAME · KOL · AI · NATIVE",
        "title_line1": "Hecho para",
        "title_line2": "creadores de juegos.",
        "subtitle": "Un centro de comando nativo de IA para el marketing global de KOLs de gaming.",
        "ctaPrimary": "Solicitar prueba",
        "ctaSecondary": "Reservar demo 1:1",
        "videoAlt": "Demostración del producto KolMatrix en bucle",
        "videoFallbackHint": "(Animación no disponible; mostrando imagen estática)",
    },
}

for locale, hero in HERO_NEW.items():
    fp = ROOT / f"{locale}.json"
    data = json.loads(fp.read_text(encoding="utf-8"))
    # Replace landing.hero wholesale
    data["landing"]["hero"] = hero
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✔ {locale}.json hero restructured")
```

Run:

```bash
python3 /tmp/patch_hero_i18n.py
```

Expected: 5 ✔ lines printed.

- [ ] **Step 2: Implement HeroVideo.tsx**

Create `src/app/[locale]/(marketing)/_components/HeroVideo.tsx`:

```typescript
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
      {/* Cinematic mesh background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 25% 15%, rgba(0,229,255,0.35), transparent 50%),
            radial-gradient(ellipse at 75% 85%, rgba(157,80,255,0.32), transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.08), transparent 70%),
            linear-gradient(180deg, var(--color-surface) 0%, var(--color-navy-deep) 60%, var(--color-surface) 100%)
          `,
        }}
      />

      {/* Looping product-demo video — fills the section as a background layer */}
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

      {/* Reduced-motion fallback — static poster, only rendered when prefers-reduced-motion: reduce */}
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
        <h1 className="cinematic-text font-extrabold leading-[0.9] tracking-[-0.04em] text-[64px] sm:text-[96px] lg:text-[124px]">
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
        <p className="mt-16 font-geist-mono text-[10px] uppercase tracking-[0.3em] text-on-surface-variant/60">↓ Scroll to explore</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/" 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Update i18n-locale-coverage KEEP_AS_EN_PATHS for new kicker + eyebrow keys**

Modify `tests/unit/i18n-locale-coverage.test.ts`. Find the existing landing keep-as-en block (around line 314) and replace it with:

```typescript
  // landing-page (cinematic v2 redesign 2026-05-21) — brand kicker,
  // cross-locale acronym chains, and platform proper-noun lists kept
  // identical across all 5 locales.
  "landing.hero.kicker",
  "landing.hero.eyebrow",
  "landing.hero.kpis.platforms.hint",  // legacy — removed after Task 8/9 land
  "landing.beforeAfter.colAfter",
```

Note: `landing.hero.kpis.platforms.hint` will be removed after Task 8 (BeforeAfter rewrite) lands since the KPI strip is gone. We keep it in this commit so this task doesn't break i18n parity in isolation.

Actually re-check after step 1 — the kpis section was wiped wholesale. Update the comment accordingly. Replace the block to:

```typescript
  // landing-page (cinematic v2 redesign 2026-05-21) — brand kicker
  // and eyebrow tag are language-neutral by design (KolMatrix is the
  // brand; GAME · KOL · AI · NATIVE is a proper-noun chain).
  "landing.hero.kicker",
  "landing.hero.eyebrow",
  "landing.beforeAfter.colAfter",
```

- [ ] **Step 5: Run i18n parity test**

```bash
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1
```

Expected: 8/8 PASS.

If a different locale leaf is flagged as drift, add it to the KEEP_AS_EN_PATHS list with a one-line comment explaining why (typical: proper noun like "KOLMATRIX" identical across locales).

- [ ] **Step 6: Update Material Symbols manifest if needed**

The HeroVideo component does NOT use any new icons (only the existing eyebrow text + CTA arrows). No subset regeneration needed for this task. Verify:

```bash
grep -E 'material-symbols-outlined' src/app/\[locale\]/\(marketing\)/_components/HeroVideo.tsx 2>/dev/null
```

Expected: empty (no icon usage).

- [ ] **Step 7: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/HeroVideo.tsx messages/ tests/unit/i18n-locale-coverage.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add HeroVideo component + restructured i18n

Cinematic v2 hero — replaces the v1 Hero.tsx (still on disk until
Task 14 rewires LandingPage to import HeroVideo). Renders:

- Full-bleed mesh background (cyan + purple radial gradients)
- Looping product-demo <video> at opacity 0.4 as background layer
  (sources expected at /landing/hero/hero-loop.{webm,mp4} — user
  delivers in Task 15; until then video element returns 404 and
  poster image shows)
- Reduced-motion fallback to static <Image>
- Foreground: eyebrow / cinematic-text H1 (124px desktop) / subtitle /
  dual CTA with glow-pulse animation on primary
- Geist Sans for foreground type; font-geist-mono for eyebrow

i18n: landing.hero namespace restructured — drops the v1 kpis 4-card
strip (KPI info moves to Features/Trust sections); adds eyebrow +
title_line1/line2 + videoAlt for the new layout. 5 locales hand-
written; ja/ko/es still pending native review per BL-014.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.2 §5.3 §6.3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: PainPoints.tsx rewrite — light + reveal-mask

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/PainPoints.tsx`

- [ ] **Step 1: Read current PainPoints to capture its testids and i18n keys**

```bash
cat "src/app/[locale]/(marketing)/_components/PainPoints.tsx"
```

Note the existing testids (`landing-painpoints`, `landing-painpoint-{key}`) — these MUST be preserved for `tests/e2e/landing.spec.ts` not to break.

- [ ] **Step 2: Rewrite the component**

Replace the contents of `src/app/[locale]/(marketing)/_components/PainPoints.tsx`:

```typescript
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface PainItem {
  key: "find" | "match" | "email" | "workflow";
  icon: string;
}

const ITEMS: ReadonlyArray<PainItem> = [
  { key: "find", icon: "search" },
  { key: "match", icon: "track_changes" },
  { key: "email", icon: "unsubscribe" },
  { key: "workflow", icon: "settings" },
];

export async function PainPoints() {
  const t = await getTranslations("landing.painPoints");

  return (
    <section
      data-testid="landing-painpoints"
      className="bg-surface-light text-on-surface-light px-6 py-32 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <ScrollFadeIn>
          <h2 className="font-geist text-center text-3xl font-bold tracking-tight text-on-surface-light lg:text-4xl">
            {t("sectionTitle")}
          </h2>
        </ScrollFadeIn>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, icon }, idx) => (
            <ScrollFadeIn key={key} delayMs={idx * 120}>
              <div
                data-testid={`landing-painpoint-${key}`}
                className="rounded-2xl bg-surface-light-container border border-on-surface-light/8 p-7 h-full transition hover:border-cyan/40 hover:shadow-[0_8px_28px_rgba(0,229,255,0.15)]"
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

        <ScrollFadeIn delayMs={600}>
          <p className="mt-16 text-center text-base font-geist text-on-surface-light-variant">
            {t("tagline")}
          </p>
        </ScrollFadeIn>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/PainPoints.tsx" 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/PainPoints.tsx
git commit -m "$(cat <<'EOF'
feat(landing): rewrite PainPoints for light theme + stagger reveal

Cinematic v2 — PainPoints now:
- Light theme (bg-surface-light + on-surface-light text)
- 4 cards stagger-fade-in via ScrollFadeIn delayMs (0/120/240/360 ms)
- Hover lift + cyan glow on cards
- Geist Sans for headlines

testids unchanged: landing-painpoints + landing-painpoint-{find,match,
email,workflow}. i18n keys unchanged.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.1 §7.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: BeforeAfter.tsx rewrite — dark + sticky row-highlight

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx`

- [ ] **Step 1: Read current BeforeAfter to preserve testids + i18n keys**

```bash
cat "src/app/[locale]/(marketing)/_components/BeforeAfter.tsx"
```

Note testids `landing-before-after`, `landing-before-after-{key}`, and `landing-before-after-demo-badge`.

- [ ] **Step 2: Rewrite using useScrollProgress for row-highlight**

Replace `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx`:

```typescript
"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useScrollProgress } from "@/components/landing/useScrollProgress";

interface Row {
  key: "discover" | "match" | "email" | "review";
  icon: string;
}

const ROWS: ReadonlyArray<Row> = [
  { key: "discover", icon: "search" },
  { key: "match", icon: "auto_awesome" },
  { key: "email", icon: "outgoing_mail" },
  { key: "review", icon: "insights" },
];

export function BeforeAfter() {
  const t = useTranslations("landing.beforeAfter");
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(sectionRef);

  // Drive 4-row highlight from progress. Each row activates when progress
  // crosses (idx + 0.5) / ROWS.length, so they light up sequentially.
  const activeIdx = Math.floor(progress * ROWS.length);

  return (
    <section
      ref={sectionRef}
      data-testid="landing-before-after"
      data-parallax="sticky"
      className="bg-surface text-on-surface px-6 py-32 lg:px-12"
      style={{ minHeight: "180vh" }}
    >
      <div className="mx-auto max-w-6xl sticky top-24" data-parallax="sticky">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-geist text-3xl font-bold tracking-tight text-white lg:text-4xl">
            {t("sectionTitle")}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-purple/40 bg-purple/10 px-3 py-1 font-geist-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-purple-fixed"
            data-testid="landing-before-after-demo-badge"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              science
            </span>
            {t("demoBadge")}
          </span>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-cyan/15 relative">
          {/* Progress line — vertical cyan track on the left, fills as user scrolls */}
          <div className="absolute left-0 top-0 w-[3px] bg-cyan/15 h-full overflow-hidden">
            <div
              className="bg-cyan shadow-[0_0_12px_var(--glow-cyan)] transition-all duration-300"
              style={{ height: `${progress * 100}%`, width: "100%" }}
            />
          </div>

          {/* Header */}
          <div className="hidden grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-cyan/15 bg-surface-low px-7 py-4 font-geist-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant md:grid">
            <div>{t("colTask")}</div>
            <div>{t("colBefore")}</div>
            <div className="text-cyan">{t("colAfter")}</div>
          </div>

          {/* Rows */}
          {ROWS.map(({ key, icon }, idx) => {
            const isActive = idx <= activeIdx;
            return (
              <div
                key={key}
                data-testid={`landing-before-after-${key}`}
                data-active={isActive}
                className={`grid grid-cols-1 gap-3 px-7 py-6 md:grid-cols-[1.4fr_1fr_1fr] md:gap-4 transition-all duration-500 ${
                  idx < ROWS.length - 1 ? "border-b border-cyan/10" : ""
                } ${idx % 2 === 0 ? "bg-surface" : "bg-surface-low"} ${
                  isActive ? "opacity-100" : "opacity-50"
                }`}
              >
                <div className="flex items-center gap-3 font-geist text-base font-semibold text-white">
                  <span
                    className={`material-symbols-outlined text-[22px] transition-all duration-500 ${
                      isActive ? "text-cyan scale-110" : "text-on-surface-variant scale-100"
                    }`}
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  {t(`rows.${key}.task`)}
                </div>
                <div className="text-sm text-on-surface-variant/70 line-through decoration-on-surface-variant/40">
                  <span className="md:hidden mr-2 font-geist-mono text-xs uppercase tracking-wider text-on-surface-variant/50 no-underline">
                    {t("colBefore")}:
                  </span>
                  {t(`rows.${key}.before`)}
                </div>
                <div
                  className={`text-sm font-medium transition-all duration-500 ${
                    isActive ? "text-cyan" : "text-on-surface-variant"
                  }`}
                >
                  <span className="md:hidden mr-2 font-geist-mono text-xs uppercase tracking-wider text-on-surface-variant/50 no-underline">
                    {t("colAfter")}:
                  </span>
                  {t(`rows.${key}.after`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add `purple-fixed` color token (if not already in tokens)**

Check whether `text-purple-fixed` already resolves in Tailwind v4:

```bash
grep -nE 'purple-fixed|--color-purple' src/styles/globals.css
```

Expected: `--color-purple` exists; `purple-fixed` likely doesn't yet.

If `purple-fixed` is missing, add it to the existing `@theme` block in `src/styles/globals.css` next to the other purple tokens (around line 30):

```css
  --color-purple-fixed: #c8a3ff;  /* lighter purple for high-contrast text on dark bg */
```

- [ ] **Step 4: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/BeforeAfter.tsx" 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/BeforeAfter.tsx src/styles/globals.css
git commit -m "$(cat <<'EOF'
feat(landing): rewrite BeforeAfter as sticky row-highlight

Cinematic v2 — BeforeAfter section becomes the first parallax moment:
- Section is min-height 180vh; inner sticky container parks at top:24
- useScrollProgress drives a 4-step row highlight (rows light up one by
  one as user scrolls)
- Cyan vertical progress line on the left fills proportionally
- Geist Sans for H2, Geist Mono for header chips
- demo badge styled with new `purple-fixed` token (lighter purple for
  legibility on dark)

testids unchanged: landing-before-after, landing-before-after-{key},
landing-before-after-demo-badge.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.1 §7.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: StickyStack wrapper component

**Files:**
- Create: `src/components/landing/StickyStack.tsx`

- [ ] **Step 1: Implement the wrapper**

Create `src/components/landing/StickyStack.tsx`:

```typescript
"use client";

import type { ReactNode } from "react";

interface Props {
  /** Sticky-rendered left column content (typically an H2 + subtitle). */
  leftContent: ReactNode;
  /** Right column children — scrolling cards / list / panels. */
  children: ReactNode;
  /** Tailwind class for section background — pass "bg-surface-light" etc. */
  bgClassName: string;
  /** Tailwind class for section text default — pass "text-on-surface-light" etc. */
  textClassName: string;
  /** Testid on the outer section. */
  sectionTestId: string;
  /** Optional min-height for the section (default "180vh"). */
  minHeight?: string;
}

/**
 * Two-column sticky layout: left column sticks to viewport while user
 * scrolls; right column scrolls normally. Used by Features (sticky H2
 * + 6 card stack) and Trust (sticky H2 + 3 card stagger).
 *
 * Mobile (<1024px): falls back to single-column normal flow via
 * globals.css `[data-parallax="sticky"]` rule.
 */
export function StickyStack({
  leftContent,
  children,
  bgClassName,
  textClassName,
  sectionTestId,
  minHeight = "180vh",
}: Props) {
  return (
    <section
      data-testid={sectionTestId}
      className={`${bgClassName} ${textClassName} px-6 lg:px-12`}
      style={{ minHeight }}
    >
      <div className="mx-auto max-w-6xl py-32 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-12 lg:gap-20">
        <div className="lg:sticky lg:top-24 self-start" data-parallax="sticky">
          {leftContent}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/StickyStack.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add StickyStack two-column parallax wrapper

Reusable sticky-left + scrolling-right layout for Features (sticky H2 +
6 card stack) and Trust (sticky H2 + 3 card stagger) cinematic v2
sections. Left column uses lg:sticky lg:top-24; mobile falls back to
single-column normal flow via globals.css [data-parallax="sticky"]
media query.

No unit test — pure presentational wrapper with no state.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Features.tsx rewrite — light + sticky stack

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/Features.tsx`
- Modify: `messages/{zh,en,ja,ko,es}.json` — add `landing.features.intro` (H2 + subtitle for sticky left column)

- [ ] **Step 1: Patch i18n with the new `features.intro` keys**

Create `/tmp/patch_features_intro.py`:

```python
#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path("/mnt/c/Users/tripplezhou/project/kolmatrix/messages")

INTRO = {
    "zh": {
        "label": "六大模块",
        "title": "覆盖全流程的\n六大核心模块。",
        "subtitle": "从找人到投放复盘，全套工具内置 — 不必跨平台拼凑。",
    },
    "en": {
        "label": "SIX MODULES",
        "title": "Six modules.\nOne workflow.",
        "subtitle": "From discovery to attribution — everything you need, none of the spreadsheet stitching.",
    },
    "ja": {
        "label": "6 つのモジュール",
        "title": "6 つのモジュール。\n1 つのワークフロー。",
        "subtitle": "発見からアトリビューションまで — 必要なすべてが揃い、スプレッドシートのつなぎ込みは不要。",
    },
    "ko": {
        "label": "6개의 모듈",
        "title": "6개의 모듈,\n하나의 워크플로우.",
        "subtitle": "발굴부터 어트리뷰션까지 — 필요한 모든 것이 내장되어 있고, 스프레드시트 작업은 필요 없습니다.",
    },
    "es": {
        "label": "SEIS MÓDULOS",
        "title": "Seis módulos.\nUn solo flujo.",
        "subtitle": "Del descubrimiento a la atribución — todo lo que necesitas, sin la costura de hojas de cálculo.",
    },
}

for locale, intro in INTRO.items():
    fp = ROOT / f"{locale}.json"
    data = json.loads(fp.read_text(encoding="utf-8"))
    data["landing"]["features"]["intro"] = intro
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✔ {locale}.json features.intro added")
```

Run:

```bash
python3 /tmp/patch_features_intro.py
```

Expected: 5 ✔ lines.

- [ ] **Step 2: Rewrite Features.tsx using StickyStack**

Replace `src/app/[locale]/(marketing)/_components/Features.tsx`:

```typescript
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyStack } from "@/components/landing/StickyStack";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface FeatureMeta {
  key: "library" | "aiMatch" | "insight" | "reach" | "crm" | "roi";
  href: string;
  screenshot: string;
}

const FEATURES: ReadonlyArray<FeatureMeta> = [
  { key: "library", href: "/match", screenshot: "/landing/screenshots/match-full.png" },
  { key: "aiMatch", href: "/match", screenshot: "/landing/screenshots/match-ai-sidebar.png" },
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
    <StickyStack
      sectionTestId="landing-features"
      bgClassName="bg-surface-light"
      textClassName="text-on-surface-light"
      leftContent={
        <>
          <div className="font-geist-mono text-[11px] tracking-[0.3em] text-cyan uppercase">
            {t("intro.label")}
          </div>
          <h2 className="mt-4 font-geist text-4xl lg:text-5xl font-bold tracking-tight whitespace-pre-line">
            {t("intro.title")}
          </h2>
          <p className="mt-5 text-base text-on-surface-light-variant max-w-md leading-relaxed">
            {t("intro.subtitle")}
          </p>
        </>
      }
    >
      {FEATURES.map(({ key, href, screenshot }, idx) => (
        <ScrollFadeIn key={key} delayMs={idx * 80}>
          <a
            href={`/${locale}${href}`}
            data-testid={`landing-feature-${key}`}
            className="group flex flex-col gap-4 rounded-2xl border border-on-surface-light/10 bg-surface-light-container p-7 transition duration-200 hover:-translate-y-1 hover:border-cyan/60 hover:shadow-[0_12px_32px_rgba(0,229,255,0.18)]"
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
            <div className="mt-2 overflow-hidden rounded-xl border border-on-surface-light/8 transition group-hover:border-cyan/30">
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
    </StickyStack>
  );
}
```

- [ ] **Step 3: Typecheck + lint + i18n parity**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/Features.tsx" 2>&1 | tail -5
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1
```

Expected: 0 errors / 0 warnings on the touched files; 8/8 i18n tests PASS.

If i18n parity fails on any new `intro.*` leaf, add the path to KEEP_AS_EN_PATHS only if the value is intentionally identical across locales (typical: brand-name labels). For natural-language values that just happen to coincide, fix the translation in the Python script and re-run step 1.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/Features.tsx messages/
git commit -m "$(cat <<'EOF'
feat(landing): rewrite Features as sticky stack with 6 module cards

Cinematic v2 — Features now uses StickyStack:
- Light theme (bg-surface-light)
- Left column sticks: label + cinematic H2 "Six modules. One workflow."
- Right column: 6 cards scroll past sticky H2, with stagger fade-in
- Each card carries an "01"-"06" mono numeral + hover lift + glow
- 5 locales updated with new `features.intro` namespace

testids unchanged: landing-features + landing-feature-{key}.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: StickyParallax wrapper component

**Files:**
- Create: `src/components/landing/StickyParallax.tsx`

- [ ] **Step 1: Implement the wrapper**

Create `src/components/landing/StickyParallax.tsx`:

```typescript
"use client";

import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "./useScrollProgress";

interface Props {
  /** The element that stays sticky (typically a product screenshot/illustration). */
  stickyAsset: ReactNode;
  /** Array of copy callouts revealed in sequence as the user scrolls. */
  callouts: ReactNode[];
  /** Tailwind class for section background. */
  bgClassName: string;
  /** Tailwind class for section default text color. */
  textClassName: string;
  sectionTestId: string;
  /** Section min-height; default 240vh leaves room for callouts to scroll past. */
  minHeight?: string;
}

/**
 * Sticky-asset + scrolling-callouts container. Used by
 * EmailCenterDemo — product screenshot stays parked on the right
 * while three copy blocks scroll up on the left, each becoming
 * focused (opacity 1) when its progress band is active.
 *
 * Mobile/reduced-motion: falls back to a simple vertical stack.
 */
export function StickyParallax({
  stickyAsset,
  callouts,
  bgClassName,
  textClassName,
  sectionTestId,
  minHeight = "240vh",
}: Props) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const progress = useScrollProgress(sectionRef);
  const activeIdx = Math.min(
    callouts.length - 1,
    Math.floor(progress * callouts.length)
  );

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
        <div className="space-y-32 lg:space-y-[60vh]">
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

        {/* Sticky asset — parks half-screen on the right */}
        <div className="lg:sticky lg:top-24 self-start" data-parallax="sticky">
          <div
            className="transition-transform duration-700"
            style={{ transform: `scale(${1 + progress * 0.08})` }}
          >
            {stickyAsset}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/StickyParallax.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add StickyParallax wrapper for sticky-asset + scrolling-callouts

Sticky-asset + scrolling-callouts layout for the EmailCenterDemo
cinematic v2 section. Asset (typically a product screenshot) sticks on
the right while 3 copy callouts scroll up on the left; the active
callout (by scroll progress) is opacity-100, others are 0.4. Asset
gets a subtle scale 1.0 → 1.08 zoom tied to overall progress.

Uses useScrollProgress; mobile/reduced-motion falls back to normal
stack via globals.css [data-parallax="sticky"] rule.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.2 §7.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: EmailCenterDemo.tsx rewrite — dark + sticky parallax

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`
- Modify: `messages/{zh,en,ja,ko,es}.json` — refactor `landing.demo` to support 3 callouts instead of single description block

- [ ] **Step 1: Read current demo i18n shape**

```bash
node -e "console.log(JSON.stringify(require('./messages/en.json').landing.demo, null, 2))"
```

Note current shape (sectionTitle, screenshotAlts, steps).

- [ ] **Step 2: Patch i18n with refactored shape**

Create `/tmp/patch_demo_callouts.py`:

```python
#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path("/mnt/c/Users/tripplezhou/project/kolmatrix/messages")

DEMO = {
    "zh": {
        "sectionTitle": "看一眼 KolMatrix 的实际样子",
        "screenshotAlt": "KolMatrix /match 主面板 — AI 推荐 + KOL 库",
        "callouts": [
            {
                "title": "找 KOL，从 4 小时到 5 分钟",
                "body": "上传产品 brief，AI 在 15 个维度筛选全球 4 大平台 KOL 库，5 分钟内给出 TOP-30 候选名单 + 契合度分数。",
            },
            {
                "title": "发起合作，DKIM/SPF 一键合规",
                "body": "Resend 合规邮件中心内置，DKIM/SPF/DMARC 三套合规验证开箱可用，信誉分 98+ 让冷邮件落进收件箱。",
            },
            {
                "title": "复盘 ROI，4 平台自动归因",
                "body": "播放、互动、引流、转化、ROI 全维度看板，4 大平台数据自动归因，告别人工 Excel 拼接。",
            },
        ],
    },
    "en": {
        "sectionTitle": "Here's what KolMatrix actually looks like",
        "screenshotAlt": "KolMatrix /match main view — AI recommendations + KOL library",
        "callouts": [
            {
                "title": "Discovery in minutes, not hours",
                "body": "Upload a brief; AI ranks creators across 4 platforms on 15 dimensions and returns a top-30 shortlist with fit scores in under 5 minutes.",
            },
            {
                "title": "Outreach with built-in compliance",
                "body": "Resend-powered email center with DKIM/SPF/DMARC out of the box. Reputation 98+ keeps cold outreach in the inbox.",
            },
            {
                "title": "Attribution across all 4 platforms",
                "body": "Plays, engagement, traffic, conversion, ROI — every dimension. Four platforms auto-attributed. No more Excel stitching.",
            },
        ],
    },
    "ja": {
        "sectionTitle": "KolMatrix の実際の様子",
        "screenshotAlt": "KolMatrix /match メインビュー — AI レコメンド + KOL ライブラリ",
        "callouts": [
            {
                "title": "数時間ではなく数分で発見",
                "body": "ブリーフをアップロードすると、AI が 4 プラットフォームの KOL を 15 軸でランク付け、5 分以内にトップ 30 候補リスト + 適合スコアを返します。",
            },
            {
                "title": "DKIM/SPF をワンクリックで設定",
                "body": "Resend 搭載のメールセンターは DKIM/SPF/DMARC を標準装備。信頼度スコア 98+ でコールドアウトリーチも受信箱に届きます。",
            },
            {
                "title": "4 プラットフォーム横断アトリビューション",
                "body": "再生数、エンゲージメント、トラフィック、コンバージョン、ROI — 全指標を 4 プラットフォーム自動帰属。Excel での集計は不要です。",
            },
        ],
    },
    "ko": {
        "sectionTitle": "KolMatrix의 실제 모습",
        "screenshotAlt": "KolMatrix /match 메인 화면 — AI 추천 + KOL 라이브러리",
        "callouts": [
            {
                "title": "몇 시간이 아닌 몇 분 안에 발굴",
                "body": "브리프를 업로드하면 AI가 4 개 플랫폼의 KOL을 15 개 축으로 평가하여, 5 분 안에 상위 30 명의 후보 명단과 적합도 점수를 제공합니다.",
            },
            {
                "title": "원클릭 컴플라이언스로 아웃리치",
                "body": "Resend 기반 이메일 센터에 DKIM/SPF/DMARC가 내장되어 있어, 신뢰도 점수 98+로 콜드 메일도 인박스에 도달합니다.",
            },
            {
                "title": "4 개 플랫폼 통합 어트리뷰션",
                "body": "재생, 인게이지먼트, 트래픽, 컨버전, ROI — 모든 지표를 4 개 플랫폼에서 자동 귀속합니다. 엑셀 작업은 더 이상 필요 없습니다.",
            },
        ],
    },
    "es": {
        "sectionTitle": "Así se ve KolMatrix en realidad",
        "screenshotAlt": "Vista principal de /match en KolMatrix — recomendaciones IA + biblioteca de KOLs",
        "callouts": [
            {
                "title": "Descubre en minutos, no en horas",
                "body": "Sube un brief; la IA clasifica creadores en 4 plataformas según 15 dimensiones y devuelve un top-30 con puntuaciones de afinidad en menos de 5 minutos.",
            },
            {
                "title": "Outreach con cumplimiento integrado",
                "body": "Centro de correo con Resend y DKIM/SPF/DMARC listos. Reputación 98+ para que tu outreach en frío llegue a la bandeja de entrada.",
            },
            {
                "title": "Atribución multi-plataforma",
                "body": "Reproducciones, engagement, tráfico, conversión, ROI — todo. 4 plataformas con atribución automática. Sin cosido de Excel.",
            },
        ],
    },
}

for locale, demo in DEMO.items():
    fp = ROOT / f"{locale}.json"
    data = json.loads(fp.read_text(encoding="utf-8"))
    data["landing"]["demo"] = demo
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✔ {locale}.json demo restructured")
```

Run:

```bash
python3 /tmp/patch_demo_callouts.py
```

Expected: 5 ✔ lines.

- [ ] **Step 3: Rewrite EmailCenterDemo.tsx**

Replace `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`:

```typescript
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { StickyParallax } from "@/components/landing/StickyParallax";

export async function EmailCenterDemo() {
  const t = await getTranslations("landing.demo");
  const callouts = t.raw("callouts") as ReadonlyArray<{ title: string; body: string }>;

  return (
    <StickyParallax
      sectionTestId="landing-demo"
      bgClassName="bg-surface"
      textClassName="text-on-surface"
      stickyAsset={
        <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_12px_48px_rgba(0,229,255,0.15)]">
          <Image
            src="/landing/screenshots/match-full.png"
            alt={t("screenshotAlt")}
            width={1080}
            height={720}
            className="h-auto w-full"
          />
        </div>
      }
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

- [ ] **Step 4: Typecheck + lint + i18n parity**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx" 2>&1 | tail -5
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1
```

Expected: 0 errors; 8/8 i18n tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/EmailCenterDemo.tsx messages/
git commit -m "$(cat <<'EOF'
feat(landing): rewrite EmailCenterDemo as sticky-parallax callouts

Cinematic v2 — EmailDemo becomes the page's most polished moment:
- StickyParallax wrapper (sticky-asset on right, 3 scrolling callouts
  on left, each progressively focused based on scroll progress)
- Asset is /match screenshot in a cyan-bordered glow frame, scales
  subtly with progress
- Section title moves into the screenshotAlt; each callout has its own
  H3 + body covering 1) discovery 2) outreach compliance 3) attribution
- i18n shape changes: demo.screenshotAlts.{match,reach,insight} replaced
  with demo.screenshotAlt (single image) + demo.callouts[].{title,body}

testid stays landing-demo. New testids: landing-demo-callout-{0,1,2} +
landing-parallax-callout-{0,1,2} from the wrapper.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: TrustPlaceholder.tsx rewrite — light + sticky stagger reveal

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx`
- Modify: `messages/{zh,en,ja,ko,es}.json` — add `landing.trust.intro` (sticky-left H2 + subtitle)

- [ ] **Step 1: Patch i18n with trust.intro**

Create `/tmp/patch_trust_intro.py`:

```python
#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path("/mnt/c/Users/tripplezhou/project/kolmatrix/messages")

INTRO = {
    "zh": {
        "label": "信任与合规",
        "title": "经得起企业\n审视的基础设施。",
        "subtitle": "数据加密、邮件合规、技术栈背书 — 上线第一天就以企业级标准搭建。",
    },
    "en": {
        "label": "TRUST & COMPLIANCE",
        "title": "Built on infrastructure\nthat holds up.",
        "subtitle": "Encryption, email compliance, modern stack credibility — enterprise-grade from day one.",
    },
    "ja": {
        "label": "信頼性とコンプライアンス",
        "title": "企業の精査に耐える\nインフラを基盤に。",
        "subtitle": "暗号化、メールコンプライアンス、モダンスタックの信頼性 — 初日からエンタープライズグレード。",
    },
    "ko": {
        "label": "신뢰와 컴플라이언스",
        "title": "기업의 검증을 견디는\n인프라 위에.",
        "subtitle": "암호화, 이메일 컴플라이언스, 현대적인 기술 스택 — 첫날부터 엔터프라이즈 수준.",
    },
    "es": {
        "label": "CONFIANZA Y CUMPLIMIENTO",
        "title": "Sobre infraestructura\nque aguanta el escrutinio.",
        "subtitle": "Cifrado, cumplimiento de correo, stack moderno — nivel empresarial desde el día uno.",
    },
}

for locale, intro in INTRO.items():
    fp = ROOT / f"{locale}.json"
    data = json.loads(fp.read_text(encoding="utf-8"))
    data["landing"]["trust"]["intro"] = intro
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✔ {locale}.json trust.intro added")
```

Run:

```bash
python3 /tmp/patch_trust_intro.py
```

Expected: 5 ✔ lines.

- [ ] **Step 2: Rewrite TrustPlaceholder.tsx**

Replace `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx`:

```typescript
import { getTranslations } from "next-intl/server";
import { StickyStack } from "@/components/landing/StickyStack";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface TrustItem {
  key: "encryption" | "email" | "stack";
  icon: string;
}

const ITEMS: ReadonlyArray<TrustItem> = [
  { key: "encryption", icon: "lock" },
  { key: "email", icon: "verified" },
  { key: "stack", icon: "hub" },
];

export async function TrustPlaceholder() {
  const t = await getTranslations("landing.trust");

  return (
    <StickyStack
      sectionTestId="landing-trust"
      bgClassName="bg-surface-light"
      textClassName="text-on-surface-light"
      leftContent={
        <>
          <div className="font-geist-mono text-[11px] tracking-[0.3em] text-cyan uppercase">
            {t("intro.label")}
          </div>
          <h2 className="mt-4 font-geist text-4xl lg:text-5xl font-bold tracking-tight whitespace-pre-line">
            {t("intro.title")}
          </h2>
          <p className="mt-5 text-base text-on-surface-light-variant max-w-md leading-relaxed">
            {t("intro.subtitle")}
          </p>
        </>
      }
    >
      {ITEMS.map(({ key, icon }, idx) => (
        <ScrollFadeIn key={key} delayMs={idx * 150}>
          <div
            data-testid={`landing-trust-${key}`}
            className="rounded-2xl border border-on-surface-light/10 bg-surface-light-container p-8 transition hover:border-cyan/40 hover:shadow-[0_8px_28px_rgba(0,229,255,0.15)]"
          >
            <span
              className="material-symbols-outlined text-[32px] text-cyan"
              aria-hidden="true"
            >
              {icon}
            </span>
            <h3 className="mt-5 font-geist text-lg font-semibold text-on-surface-light">
              {t(`items.${key}.title`)}
            </h3>
            <p className="mt-3 text-sm text-on-surface-light-variant leading-relaxed">
              {t(`items.${key}.body`)}
            </p>
          </div>
        </ScrollFadeIn>
      ))}
    </StickyStack>
  );
}
```

- [ ] **Step 3: Typecheck + lint + i18n parity**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx" 2>&1 | tail -5
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1
```

Expected: 0 errors; 8/8 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/TrustPlaceholder.tsx messages/
git commit -m "$(cat <<'EOF'
feat(landing): rewrite TrustPlaceholder as light sticky stack

Cinematic v2 — Trust now mirrors Features structure:
- Light theme (bg-surface-light)
- Left column sticks: label + cinematic H2 "Built on infrastructure
  that holds up."
- Right column: 3 cards stagger-fade-in (encryption / email
  compliance / tech stack)
- Tech stack card unchanged from 2026-05-21 P0+P1 polish
  (Anthropic Claude · Resend · Next.js · Postgres RLS)

testids unchanged: landing-trust + landing-trust-{encryption,email,stack}.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: FAQ + FooterCTA + TopNav minor + LandingPage rewire

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/FAQ.tsx` (wrap in `<ScrollFadeIn>`)
- Modify: `src/app/[locale]/(marketing)/_components/FooterCTA.tsx` (add `cta-glow-pulse` class)
- Modify: `src/app/[locale]/(marketing)/_components/TopNav.tsx` (mild touch — add `font-geist` to text + slight backdrop tune)
- Modify: `src/app/[locale]/(marketing)/_components/LandingPage.tsx` (rewire with HeroVideo + SectionTransition between sections + apply `data-landing-cinematic`)
- Delete: `src/app/[locale]/(marketing)/_components/Hero.tsx`

- [ ] **Step 1: Wrap FAQ contents in ScrollFadeIn**

Modify `src/app/[locale]/(marketing)/_components/FAQ.tsx`. Change the existing `<section>` to add `data-landing-cinematic` and wrap the H2 + list in a single `<ScrollFadeIn>`:

```typescript
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface FaqItem {
  q: string;
  a: string;
}

export async function FAQ() {
  const t = await getTranslations("landing.faq");
  const items = t.raw("items") as ReadonlyArray<FaqItem>;

  return (
    <section
      data-testid="landing-faq"
      className="bg-surface text-on-surface px-6 py-32 lg:px-12"
    >
      <ScrollFadeIn>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-geist text-3xl lg:text-4xl font-bold tracking-tight text-white">
            {t("sectionTitle")}
          </h2>
          <ul className="mt-12 space-y-3">
            {items.map((item, idx) => (
              <li
                key={item.q}
                className="overflow-hidden rounded-2xl border border-cyan/15 bg-surface-low"
              >
                <details data-testid={`landing-faq-item-${idx}`} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold text-white transition hover:bg-cyan/5">
                    <span className="font-geist">{item.q}</span>
                    <span className="text-cyan transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="border-t border-cyan/10 p-5 text-sm leading-6 text-on-surface-variant">
                    {item.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </ScrollFadeIn>
    </section>
  );
}
```

- [ ] **Step 2: Add `cta-glow-pulse` to FooterCTA primary CTA + bigger H2**

Modify `src/app/[locale]/(marketing)/_components/FooterCTA.tsx`. Update H2 className to use `font-geist` + larger size; add `cta-glow-pulse` to primary CTA:

```typescript
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScrollFadeIn } from "@/components/landing/ScrollFadeIn";

interface Props {
  locale: string;
}

export async function FooterCTA({ locale }: Props) {
  const t = await getTranslations("landing.footerCta");

  return (
    <section
      data-testid="landing-footer-cta"
      className="relative overflow-hidden bg-surface text-on-surface px-6 py-32 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <ScrollFadeIn>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="cinematic-text font-geist text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            {t("sectionTitle")}
          </h2>
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
          <div className="mt-20 font-geist-mono text-[11px] text-on-surface-variant/70 uppercase tracking-[0.2em]">
            <p>{t("footerLine")}</p>
          </div>
        </div>
      </ScrollFadeIn>
    </section>
  );
}
```

- [ ] **Step 3: Minor TopNav update — apply `font-geist`**

Modify `src/app/[locale]/(marketing)/_components/TopNav.tsx`. In the wrapper class names, add `font-geist`. Replace the file:

```typescript
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

export async function TopNav({ locale }: Props) {
  const t = await getTranslations("landing.nav");

  return (
    <nav
      data-testid="landing-topnav"
      className="sticky top-0 z-50 border-b border-cyan/10 bg-surface/70 backdrop-blur-xl backdrop-saturate-150 font-geist"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-12">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-sm font-bold tracking-[0.18em] text-white uppercase"
          data-testid="landing-topnav-logo"
        >
          <span className="material-symbols-outlined text-[20px] text-cyan" aria-hidden="true">
            hub
          </span>
          KolMatrix
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/login`}
            className="hidden text-sm font-medium text-on-surface-variant transition hover:text-white sm:inline-flex"
            data-testid="landing-topnav-login"
          >
            {t("login")}
          </Link>
          <Link
            href={`/${locale}/request-access`}
            className="inline-flex items-center gap-2 rounded-full bg-cyan px-4 py-2 text-sm font-semibold text-surface shadow-[0_0_16px_rgba(0,229,255,0.35)] hover:bg-cyan/90 transition"
            data-testid="landing-topnav-cta"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Rewire LandingPage with HeroVideo + SectionTransition + data-landing-cinematic**

Replace `src/app/[locale]/(marketing)/_components/LandingPage.tsx`:

```typescript
import { TopNav } from "./TopNav";
import { HeroVideo } from "./HeroVideo";
import { PainPoints } from "./PainPoints";
import { BeforeAfter } from "./BeforeAfter";
import { Features } from "./Features";
import { EmailCenterDemo } from "./EmailCenterDemo";
import { TrustPlaceholder } from "./TrustPlaceholder";
import { FAQ } from "./FAQ";
import { FooterCTA } from "./FooterCTA";
import { SectionTransition } from "./SectionTransition";

interface Props {
  locale: string;
}

export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-surface text-on-surface"
      data-testid="landing-page"
      data-landing-cinematic
      data-locale={locale}
    >
      <TopNav locale={locale} />
      <HeroVideo locale={locale} />
      <SectionTransition from="dark" to="light" />
      <PainPoints />
      <SectionTransition from="light" to="dark" />
      <BeforeAfter />
      <SectionTransition from="dark" to="light" />
      <Features locale={locale} />
      <SectionTransition from="light" to="dark" />
      <EmailCenterDemo />
      <SectionTransition from="dark" to="light" />
      <TrustPlaceholder />
      <SectionTransition from="light" to="dark" />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
```

- [ ] **Step 5: Delete the old Hero.tsx**

```bash
git rm src/app/\[locale\]/\(marketing\)/_components/Hero.tsx
```

Verify nothing else imports it:

```bash
grep -rE 'from .*Hero["\047]' src/ tests/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v HeroVideo
```

Expected: empty output (no stragglers).

- [ ] **Step 6: Typecheck + lint + i18n parity**

```bash
npx tsc --noEmit 2>&1 | tail -5
npm run lint -- "src/app/[locale]/(marketing)/_components/" 2>&1 | tail -5
npx vitest run tests/unit/i18n-locale-coverage.test.ts --pool=threads --maxWorkers=1
```

Expected: 0 errors / 8/8 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/\[locale\]/\(marketing\)/_components/
git commit -m "$(cat <<'EOF'
feat(landing): wire LandingPage with HeroVideo + transitions + cinematic data attr

Final wiring for cinematic v2:
- LandingPage imports HeroVideo (was Hero), interleaves SectionTransition
  components between each section (6 strips between 7 content sections)
- Adds data-landing-cinematic on the <main> wrapper so the prefers-
  reduced-motion + mobile-fallback CSS rules from globals.css scope
  correctly (they only kick in for this page tree)
- FAQ + FooterCTA wrapped in ScrollFadeIn for graceful reveal-on-enter
- FooterCTA primary CTA gets cta-glow-pulse animation + cinematic-text
  H2 + 4xl/6xl sizing
- TopNav applies font-geist; backdrop opacity loosened from 80 → 70 to
  let video peek through more
- git rm src/app/[locale]/(marketing)/_components/Hero.tsx (superseded)

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §4.3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Video Assets + Visual Baselines + Polish

### Task 16: Hero video prompts doc

**Files:**
- Create: `docs/landing/hero-video-prompts.md`

- [ ] **Step 1: Write 5 prompt candidates**

Create `docs/landing/hero-video-prompts.md`:

```markdown
# Hero Video Prompts — KolMatrix Landing Cinematic v2

These are 5 prompt candidates to feed into Runway Gen-3 / Kling / Pika /
(Sora if accessible). The goal: an 8-12 second seamless-loop background
video for the hero section.

## Visual brief (apply to all prompts)

- Aspect ratio: 16:9 (1920×1080 source, will be `object-cover` clipped
  at any screen size)
- Color palette: deep navy background (#0b1326-ish), electric cyan
  (#00E5FF) highlights, purple (#9D50FF) secondary accents
- Mood: cinematic, calm, technical, premium
- Constraints: no humans, no text overlays (we'll lay text on top in
  CSS), no audio, no logos, no fast cuts (the loop runs forever — fast
  cuts become epilepsy hazards), no faces, nothing trademarked
- Loop friendliness: end state should visually return to start state
  so the loop seam is invisible

## Prompt candidates

### 1. Data streams through a globe (most product-aligned)

> Cinematic shot, cyan and purple data streams flowing through a
> stylized 3D globe of Earth, neon highlights, dark space background
> with subtle stars, smooth 8-second seamless loop, 1920×1080, no text,
> no humans, no logos, gentle camera orbit.

### 2. Particle constellation forming a "K" mark (brand-tilted)

> Glowing cyan particles drifting in dark space, slowly converging
> into the abstract silhouette of a stylized letter "K", then
> dispersing back; purple particles in the background; 8-second loop,
> 1920×1080, no text, dark navy backdrop, premium tech feel.

### 3. Neural network nodes pulsing (most "AI" feeling)

> Abstract neural network: glowing cyan nodes connected by thin lines,
> nodes pulse rhythmically with cyan and purple light traveling along
> the connections, dark navy background with subtle grid, smooth
> 10-second seamless loop, 1920×1080, no text, no humans.

### 4. Liquid metal mesh (most "Apple Pro" feeling)

> Cinematic shot of fluid metallic liquid in deep navy and cyan,
> rippling slowly, surface reflects subtle purple highlights, shallow
> depth of field, very smooth 8-second seamless loop, 1920×1080, no
> text, no humans, premium luxury feel.

### 5. Geometric shapes morphing (most "Apple iPhone" feeling)

> Abstract geometric shapes (cubes, spheres, tori) in dark navy with
> cyan and purple gradient lighting, slowly rotating and morphing into
> one another against a deep space background, soft volumetric light,
> 10-second seamless loop, 1920×1080, no text, no humans.

## Deliverables

After picking the best clip(s), encode three files into
`public/landing/hero/`:

| File | Format | Spec |
|---|---|---|
| `hero-loop.mp4` | H.264, yuv420p | ≤8 MB, 8-12 s loop |
| `hero-loop.webm` | VP9 | ≤6 MB, same 8-12 s loop |
| `hero-poster.jpg` | JPEG q80 | First frame of the loop, ≤200 KB |

### Encoding cheatsheet (ffmpeg)

If your AI-generated output is a single .mp4, derive the other two
with:

```bash
# WebM (VP9, faster decoding in Chrome / Firefox)
ffmpeg -i hero-source.mp4 -c:v libvpx-vp9 -b:v 1.5M -an hero-loop.webm

# Re-encode mp4 with size cap
ffmpeg -i hero-source.mp4 -c:v libx264 -crf 26 -preset slow -an -movflags +faststart hero-loop.mp4

# Poster (first frame)
ffmpeg -i hero-source.mp4 -vframes 1 -q:v 4 hero-poster.jpg
```

Verify each is under cap before committing:

```bash
ls -lh public/landing/hero/
```

## Iteration log

Add a row each time you try a prompt:

| Date | Prompt # | Tool | Cost | Result |
|---|---|---|---|---|
|     |          |      |      |        |
```

- [ ] **Step 2: Commit**

```bash
mkdir -p docs/landing
git add docs/landing/hero-video-prompts.md
git commit -m "$(cat <<'EOF'
docs(landing): 5 hero video prompt candidates + ffmpeg cheatsheet

Provides 5 Runway/Kling/Pika prompts spanning product-aligned (data
streams through globe), brand-tilted (particle K-mark), AI-feeling
(neural network), Apple-Pro feeling (liquid metal), and Apple-iPhone
feeling (geometric morph). Includes encoding recipe (mp4 + webm +
poster) and an iteration log table for the user to track tries.

Asset files (mp4/webm/jpg) land in public/landing/hero/ after the user
picks the winning clip.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §6.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: E2E test update + placeholder video assets

**Files:**
- Create: `public/landing/hero/hero-poster.jpg` (temporary placeholder; user replaces in Task 18)
- Create: `public/landing/hero/.gitkeep` (so the directory exists in git even with no video files yet)
- Modify: `tests/e2e/landing.spec.ts` (add video + poster assertions)

- [ ] **Step 1: Create the hero directory + a placeholder poster**

Until the user delivers real assets, use a temporary placeholder so 404s don't kill the dev experience. Generate a 1280×720 placeholder JPG:

```bash
mkdir -p public/landing/hero
cat > public/landing/hero/.gitkeep <<'EOF'
# Placeholder so the directory exists in git. Real hero-loop.{mp4,webm}
# + hero-poster.jpg drop in here per Task 18 once the user generates a
# clip via Runway/Kling/Pika.
EOF

# Generate a 1280×720 navy placeholder JPG (cyan + purple gradient)
# Requires ImageMagick (`apt install imagemagick` if missing).
convert -size 1280x720 \
  gradient:'rgb(11,19,38)-rgb(0,30,40)' \
  -channel R -evaluate add 5% \
  +channel \
  -fill 'rgb(0,229,255)' -draw 'circle 320,180 320,90' \
  -blur 0x80 \
  -fill 'rgb(157,80,255)' -draw 'circle 960,540 960,420' \
  -blur 0x80 \
  -quality 80 \
  public/landing/hero/hero-poster.jpg

ls -lh public/landing/hero/
```

Expected: One ~30-80 KB JPG + .gitkeep. If `convert` is unavailable, save any 1280×720 dark-themed placeholder JPG as `hero-poster.jpg` and proceed.

The video file paths in HeroVideo (`hero-loop.mp4`, `hero-loop.webm`) will 404 until Task 18 — the browser will silently fall back to the poster image (set via `poster=` attribute on `<video>`).

- [ ] **Step 2: Update tests/e2e/landing.spec.ts to assert video element + poster**

Read the existing spec:

```bash
cat tests/e2e/landing.spec.ts
```

Append (or replace if you see the existing 3 tests stay coherent) by adding a 4th test. Add this block before the closing `});` of the outer describe:

```typescript
test("hero video element is present with correct attributes", async ({ page }) => {
  await page.goto("/zh");
  const video = page.getByTestId("landing-hero-video");
  await expect(video).toBeAttached();
  // Don't assert visible — video may be hidden via motion-reduce: at the
  // CSS level if the test browser has prefers-reduced-motion enabled.
  await expect(video).toHaveAttribute("autoplay", "");
  await expect(video).toHaveAttribute("muted", "");
  await expect(video).toHaveAttribute("loop", "");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(video).toHaveAttribute("poster", "/landing/hero/hero-poster.jpg");
});

test("hero poster image is fetchable", async ({ request }) => {
  const res = await request.get("/landing/hero/hero-poster.jpg");
  expect(res.ok()).toBe(true);
  const contentType = res.headers()["content-type"];
  expect(contentType).toMatch(/image\/jpeg/);
});
```

- [ ] **Step 3: Local smoke test of the dev server**

```bash
# In one shell:
npm run dev &
DEV_PID=$!

# Wait for "Ready"
sleep 12

# Probe the homepage + the hero poster
curl -fsI http://localhost:3000/landing/hero/hero-poster.jpg | head -3
curl -fsSL http://localhost:3000/zh 2>/dev/null | grep -oE 'data-testid="landing-hero-video"' | head -1
curl -fsSL http://localhost:3000/zh 2>/dev/null | grep -oE 'data-testid="landing-hero"' | head -1

kill $DEV_PID
```

Expected:
- Poster: HTTP/1.1 200 + content-type image/jpeg
- Hero video testid: matches once
- Hero section testid: matches once

- [ ] **Step 4: Commit**

```bash
git add public/landing/hero/ tests/e2e/landing.spec.ts
git commit -m "$(cat <<'EOF'
test(landing): add hero video + poster e2e assertions

Adds 2 Playwright tests:
- hero <video> element present with autoplay / muted / loop /
  playsinline / poster attributes
- poster image fetchable (returns 200 + image/jpeg)

Includes a temporary cyan/purple placeholder poster (~30-80 KB) so
the dev experience isn't broken before the user delivers a real
clip. .gitkeep keeps the directory in source control.

Real hero-loop.{mp4,webm} + final hero-poster.jpg drop into
public/landing/hero/ via Task 18 once the user runs prompts from
docs/landing/hero-video-prompts.md through Runway/Kling/Pika.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §10.2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Final-stage user-asset wiring + visual baseline regen + staging deploy

**Owner**: requires user-delivered video files. Coordinate with user before starting.

**Files:**
- Replace: `public/landing/hero/hero-loop.mp4` (user-delivered, replaces placeholder)
- Replace: `public/landing/hero/hero-loop.webm` (user-delivered)
- Replace: `public/landing/hero/hero-poster.jpg` (user-delivered, replaces ImageMagick placeholder)
- Modify (regen via workflow): `tests/screenshots/baseline/landing-{en,zh}-{desktop,mobile}.png` (full regen)

- [ ] **Step 1: Confirm video assets are in place + within size budgets**

Prompt user to copy their final `hero-loop.mp4`, `hero-loop.webm`, `hero-poster.jpg` into `public/landing/hero/`. Verify:

```bash
ls -lh public/landing/hero/
file public/landing/hero/*
```

Expected outputs:
- `hero-loop.mp4` — MP4 H.264, ≤ 8 MB
- `hero-loop.webm` — WebM VP9, ≤ 6 MB
- `hero-poster.jpg` — JPEG, ≤ 200 KB
- `.gitkeep` — still present

If any file exceeds the cap, the user must re-encode (point to the ffmpeg cheatsheet in `docs/landing/hero-video-prompts.md`).

- [ ] **Step 2: Verify the dev server plays the loop**

```bash
npm run dev &
DEV_PID=$!
sleep 15

# Spot-check that all three asset paths respond
for f in hero-loop.mp4 hero-loop.webm hero-poster.jpg; do
  curl -fsI "http://localhost:3000/landing/hero/$f" | head -2
  echo '---'
done

kill $DEV_PID
```

Expected: 3× HTTP/1.1 200 with the correct content-type each.

Optional manual sanity: open http://localhost:3000/zh in incognito Chrome, confirm the video autoplay loop renders behind the hero text at 40% opacity.

- [ ] **Step 3: Commit the asset files**

```bash
git add public/landing/hero/
git commit -m "$(cat <<'EOF'
feat(landing): wire final hero video assets

Replaces the placeholder hero-poster.jpg with the user's final
encoded outputs from prompt iteration (docs/landing/hero-video-prompts.md).

hero-loop.mp4 (H.264) and hero-loop.webm (VP9) are the looping
background video; hero-poster.jpg is the first frame, used by the
<video poster> attribute + the prefers-reduced-motion <img> fallback.

Sizes within budget per spec §6.1.

Refs: docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md §6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push + watch CI**

```bash
git push origin main 2>&1 | tail -5
sleep 6
gh run list --workflow=ci.yml --limit 1 | head -2
```

- [ ] **Step 5: Trigger visual-baseline regen workflow (CI will fail on landing visual diffs first)**

The 4 existing landing baselines (`landing-{en,zh}-{desktop,mobile}.png`) will definitively drift — every section changed. Wait for CI to report the visual regression failure, then:

```bash
# Once you see the CI run shows failure in the [visual] project on the landing tests:
gh workflow run update-visual-baselines.yml --ref main \
  -f reason='landing-cinematic-v2: full regen — video hero + 7 section rewrites + dark/light + parallax'
sleep 6
gh run list --workflow=update-visual-baselines.yml --limit 1 | head -2
```

Wait for the workflow to complete (~3-5 min). Pull the bot's commit:

```bash
gh run watch <run-id> --exit-status
git pull --ff-only origin main
```

- [ ] **Step 6: Re-trigger CI (bot commit doesn't cascade per v0.9.23 #24)**

```bash
gh workflow run ci.yml --ref main
sleep 6
gh run list --workflow=ci.yml --limit 1 | head -2
```

Wait for CI to be green. If E2E tests other than visual baselines fail, debug those before proceeding (a likely cause: a testid you preserved but now selects a different element due to the rewrites — re-grep for offenders).

- [ ] **Step 7: Trigger staging deploy**

```bash
gh workflow run deploy-staging.yml --ref main -f ref=main -f run_seed=false
```

Wait for completion. Verify:

```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix-staging && git rev-parse --short HEAD'
curl -fsSL https://staging.kol.guangai.ai/api/health | head -1
curl -s https://staging.kol.guangai.ai/zh | grep -oE 'data-testid="landing-(hero-video|features|painpoints|trust)"' | sort -u
```

Expected:
- Staging HEAD matches the latest main commit hash
- Health = `{"status":"healthy"...}`
- All 4 testids return (one per `sort -u` line)

- [ ] **Step 8: Manual staging acceptance check**

Open https://staging.kol.guangai.ai/zh in incognito Chrome (1280×800 viewport). Visually confirm:

1. ✅ Hero video autoplays in the background; text overlay is readable; `Request access` button has glow-pulse
2. ✅ PainPoints renders on light cream background; 4 cards stagger-fade-in as you scroll
3. ✅ BeforeAfter rows light up one-by-one as you scroll past them; cyan progress line on the left
4. ✅ Features sticky H2 on the left stays pinned while the 6 cards scroll past on the right
5. ✅ EmailCenterDemo screenshot sticks on the right while 3 callouts on the left activate sequentially
6. ✅ Trust sticky H2 on the left stays pinned while the 3 cards stagger in
7. ✅ FAQ collapse animations work; FooterCTA pulses with cyan glow
8. ✅ Run Lighthouse audit (Chrome DevTools → Lighthouse → Performance + Accessibility on Mobile). Verify Performance ≥ 70, Accessibility ≥ 90.

If any item fails, note the specifics + open a follow-up commit. Do not push to prod until staging acceptance is clean.

- [ ] **Step 9: Trigger prod deploy (user-confirmed)**

After step 8 passes:

```bash
gh workflow run deploy-prod.yml --ref main
```

Wait for completion. Verify:

```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix && git rev-parse --short HEAD'
curl -fsSL https://kol.guangai.ai/api/health | head -1
curl -s https://kol.guangai.ai/zh | grep -oE 'data-testid="landing-(hero-video|features|painpoints|trust|before-after)"' | sort -u
```

Expected: prod HEAD matches main; all testids found.

Open https://kol.guangai.ai/zh in incognito (or `Ctrl+Shift+R` if you visited earlier — Next/Image optimization caches per query string, so a hard reload is needed). Confirm the new cinematic experience renders.

- [ ] **Step 10: Final commit + summary**

If everything looks good, no further commits are needed — the prod deploy is the terminal step. Otherwise, fix any blocker, push, redeploy.

Optionally update `.auto-memory/project-status.md` to note the cinematic landing batch as DONE (independent task, so no progress.json mutation). Only the user (acting as Planner in a future session) should make memory writes per harness rules; if running this plan as an autonomous Generator, defer that to the next session.

---

## Self-Review

### Spec coverage

| Spec section | Covered by |
|---|---|
| §1 Goals | The Goal statement at top of plan + Phase 2/3 execution |
| §2 Non-goals | Not violated — plan touches only landing surfaces; no app-side changes |
| §3 Locked decisions | Each decision materializes in a specific Task (Direction C → HeroVideo + cinematic CSS; Color → tokens in Task 1; Type → fonts in Task 2; Section rhythm → Tasks 8-14) |
| §4.1 Section table | Tasks 7-15 hit each row |
| §4.2 New/changed components | All 16 listed files have tasks (HeroVideo=T7, PainPoints=T8, BeforeAfter=T9, StickyStack=T10, Features=T11, StickyParallax=T12, EmailCenterDemo=T13, TrustPlaceholder=T14, FAQ/FooterCTA/TopNav/LandingPage=T15, SectionTransition=T5, useScrollProgress=T3, ScrollFadeIn=T4, fonts dir=T2, globals.css=T1+T6+T9, Hero.tsx delete=T15) |
| §5 Theme system | T1 (light tokens) + T2 (fonts) + T6 (cinematic-text utility) |
| §6 Video pipeline | T7 (video element wired with fallback chain) + T16 (prompts doc) + T17 (placeholder + e2e) + T18 (final asset swap + regen) |
| §7 Scroll-driven anim | T3 (useScrollProgress) + T4 (ScrollFadeIn) + T6 (reduced-motion/mobile fallback) + T9/T11/T13/T14 (consumers) |
| §8 Section transitions | T5 (SectionTransition component) + T15 (LandingPage rewire) |
| §9 Error handling | T7 (video fallback chain) + T6 (reduced-motion) + T17 (placeholder so dev experience isn't broken) |
| §10 Testing | T3/T4 (unit tests) + T7/T11/T13/T14 (i18n parity per task) + T17 (e2e for video) + T18 (baseline regen) |
| §11 3-phase split | Tasks grouped as Phase 1 (T1-T6, 6 tasks ≈ 2.5 day), Phase 2 (T7-T15, 9 tasks ≈ 4 day), Phase 3 (T16-T18, 3 tasks ≈ 1.5 day) |
| §12 Migration | No app-side migration; T1 light tokens are additive; T2 Geist is additive; T15 git rms Hero.tsx |
| §13 Open Q | Plan doesn't pre-resolve OQ #2 (K-letter logomark — deferred per spec); OQ #1 (where do KPI strip topics live?) is implicitly resolved by Task 7 (KPI strip dropped wholesale; topics restated in Features) — make a note in the i18n patches |
| §14 Success criteria | T18 step 8 (manual staging check) directly maps to the 8 success criteria |

**Gaps found and patched inline:** None — all spec sections trace to ≥1 task.

### Placeholder scan

No "TBD", "TODO", "implement later", or "fill in details" remain in this plan. Every code step has its full code body. Commands have expected outputs.

### Type consistency

- `useScrollProgress(ref: RefObject<HTMLElement | null>, options)` used identically in Tasks 9, 12 (consumers)
- `ScrollFadeIn` API (`children`, `className`, `delayMs`, `rootMargin`) used consistently across Tasks 8, 11, 14, 15
- `StickyStack` API (`sectionTestId`, `bgClassName`, `textClassName`, `leftContent`, `children`, `minHeight`) used identically in Tasks 11 and 14
- `StickyParallax` API (`sectionTestId`, `bgClassName`, `textClassName`, `stickyAsset`, `callouts`, `minHeight`) consumed correctly in Task 13
- CSS variable names (`--glow-cyan`, `--glow-purple`, `--color-surface-light`, `--font-geist-sans`, `--font-geist-mono`) consistent across Tasks 1, 2, 6, 7, 11
- i18n key paths (`landing.hero.title_line1`, `landing.features.intro.title`, `landing.demo.callouts[]`, `landing.trust.intro.title`, `landing.beforeAfter.colAfter`) consistent across tasks that read or write them

No mismatches detected.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-21-landing-redesign-cinematic.md`.

**Two execution options:**

**1. Subagent-Driven (recommended for this size — 18 tasks across 3 phases)**
I dispatch a fresh subagent per task with isolated context, two-stage review between tasks (code-correctness check + spec-alignment check), commit on green, push at phase boundaries. Best when total task count is high; keeps the orchestrator's context clean for orchestration decisions.

**2. Inline Execution**
I execute tasks in this same session. Faster turnaround per task (no subagent dispatch overhead), checkpoint between phases. Best when you want to drive the rhythm or expect to interrupt with on-the-fly changes.

Which approach?

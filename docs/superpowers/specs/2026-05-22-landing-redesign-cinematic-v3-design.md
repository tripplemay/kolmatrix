# Landing Redesign — Cinematic v3 Design Spec

**Created**: 2026-05-22
**Type**: Independent task (not in features.json state machine)
**Status**: Draft (pending user review)
**Predecessors**:
- `2026-05-19-landing-page-design.md` (v1)
- `2026-05-21-landing-redesign-cinematic-design.md` (v2 — superseded by this doc; v2's `§13` open questions are resolved here)

## 1. Goals

The cinematic v2 (predecessor spec) locked the visual direction correctly — Apple / Linear / Vercel cinematic, dark/light alternation, sticky parallax, Geist + light-theme tokens — but the **execution overused sticky/parallax on every section**, producing a page that scrolls 15+ viewports tall with large empty bands between sparse content. The visual baseline (`tests/screenshots/baseline/landing-en-desktop.png` @ 1280×11152) makes this concrete: PainPoints, Features, EmailCenterDemo, Trust sections all occupy 2–3 viewport heights with content density too low to justify the height.

v3 fixes execution without changing direction:

- **Cinematic moment limit = 2** (Hero §1 + ProductDemo §4). The other 6 sections become tight, high-density, non-sticky.
- **Page height target ~10 viewports** (down from 15, ↓ 33%) — reduces scroll fatigue + DOM cost.
- **ProductDemo screenshots fixed**: rotates `/match`, `/reach`, `/insight` per callout (current code uses `match-full.png` for all three — bug).
- **Section content rewritten** to be denser, more specific, and more honest (e.g., BeforeAfter old-vs-new in 4 concrete workflow rows, not abstract themes).
- **Trust placeholder collapsed from 3 sparse cards to 2 focused cards** (Compliance + Uptime).
- **Hero secondary CTA kept** ("Book a demo"), but copy clarified (was "查看试用"/ambiguous).
- **Lighthouse target ≥ 80 desktop / ≥ 70 mobile** for landing (matches BL-070 F008 standard; redesign supports it via DOM reduction).

The v3 redesign covers 7 of 8 sections. Hero §1 receives only polish — the user-delivered `hero-loop.{mp4,webm}` is still pending and arrives on the user's independent timeline; the structural HeroVideo component stays.

## 2. Non-Goals

- **No direction pivot.** Apple / Linear / Vercel cinematic stays the visual language. (User: `优化, 方向对但执行破了`.)
- **No re-architecture of `/match` `/reach` `/insight` `/brief` app surfaces.** Out of scope.
- **No new product feature.** Presentational only — no DB schema, no server action, no API.
- **No multi-locale extension.** Same 5 locales (zh/en/ja/ko/es). New copy is hand-written (~50 keys × 5 locale = ~250 strings, ~3h human translation).
- **No tracking pixels / 3rd-party scripts** (Privacy/Terms still removed per 2026-05-20).
- **No TopNav K-letter logomark** — defer continues. (User did not promote it in this batch.)
- **No StickyStack.tsx deletion** — the component file stays for future use (e.g., next batch may need it); v3 simply does not invoke it from any section.
- **No SectionTransition.tsx change** — the 12px cyan→transparent gradient strips between dark↔light sections stay (6 instances in `LandingPage.tsx`).

## 3. Locked Design Decisions

Carried forward from v2 (still valid):

| Decision | Choice | Source |
|---|---|---|
| Visual direction | Apple / Game-brand cinematic | v2 §3 Q1 |
| Hero visual asset | Video / Product Demo (user-delivered) | v2 §3 Q2-Q3 |
| Color palette | Cyan + Purple (current) | v2 §3 Q4 |
| Typography | Geist Sans + 苹方 PingFang SC + H1 124px desktop | v2 §3 Q5 |
| Dark/light section rhythm | Alternation with SectionTransition gradient strips | v2 §3 Q6-Q7 |

Net-new in v3 (this brainstorm 2026-05-22):

| Decision | Choice | Rationale |
|---|---|---|
| Cinematic moment count | **Exactly 2** (Hero §1 + ProductDemo §4) | User feedback: every-section sticky → scroll fatigue. Apple/Linear use sticky on 1-2 hero moments only. |
| Approach selection | **B — Two-pillar Cinema** (8 sections, 7 redesigned, ~10 viewports total) | User chose B over Spine (no cinema mid-page) and Editorial Flow (3 cinema + high copy risk). |
| §5 BeforeAfter | Static 2-column compare, **sticky row-highlight removed** | User explicit ack — `§5 BeforeAfter sticky row-highlight 完全删`. |
| §6 Trust | **2 cards: Compliance + Uptime** (drop Privacy) | User chose default — Privacy concern is implicitly covered by Compliance card body. |
| Hero CTAs | **Dual CTA preserved** (primary Request access + secondary Book a demo) | User did not promote `Hero secondary CTA 删` option — kept. |
| Section count | **8 sections preserved** (Trust kept independent, not merged into FAQ) | User did not promote `8→7 合并` option. |
| Hero KPI strip | **Permanently removed** | v2 §13 #1 resolved; already removed in commit `ba5fcc3` 2026-05-21. |
| Hero subtitle copy | **Rewritten to concrete verbs + numerics** | "An AI-native command center for game KOL marketing — choreographed, not stitched" → "Discover, match, and reach global gaming influencers — all in one AI-native matrix." |
| Mobile H1 size | **56px** (was 64px) | Avoid overflow observed on BL-070 staging spot-check at 360px width. |
| ProductDemo screenshots | **3 distinct: /match, /reach, /insight** (was 1 shared) | Current code reuses `match-full.png` for all 3 callouts — bug. |
| StickyParallax minHeight | **200vh** (was 240vh) | 17% tighter; reduces scroll-to-fill ratio. |
| StickyParallax callout spacing | **50vh** (was 60vh) | Matches minHeight reduction. |
| Hero mesh layers | **2 radial-gradients** (was 4) + 1 noise overlay | GPU paint cost reduction; visible effect preserved. |
| Material Symbols on light bg | **Keep, cyan-accent** | v2 §13 #4 resolved. |
| TopNav K-letter logomark | **Defer continues** | v2 §13 #2 — user did not promote in v3. |
| Lighthouse target | **≥80 desktop / ≥70 mobile** for landing | Match BL-070 F008 standard. |

## 4. Component Architecture

### 4.1 Section-by-section layout

Section order matches current `LandingPage.tsx` (no reordering — preserves dark/light alternation through the existing `SectionTransition` chain).

| # | Section | Theme | Sticky? | Height | Content shape |
|---|---|---|---|---|---|
| 1 | Hero ★ | 🌑 dark | no | ~1 vp (min-h-screen) | Single video bg + eyebrow + H1 (Geist 124/56px) + sub + dual CTA + ↓ scroll cue. KPI strip removed. |
| 2 | PainPoints | ☀️ light | no | ~1 vp | H3 "Game-creator marketing today is broken in 4 ways." + 2×2 card grid (4 pain cards, each = icon + title + 1 evidence line). `py-24`. fade-up only. |
| 3 | BeforeAfter | 🌑 dark | no | ~1 vp | H3 "Old workflow vs KolMatrix" + static 3-col grid (Old | step label | New) × 4 rows (Find KOLs / Reach Out / Measure / Iterate). `py-24`. fade-up only. **Sticky parallax + scroll-driven row-highlight removed.** |
| 4 | Features | ☀️ light | no | ~1.5 vp | H3 "Six modules. One workflow." + 3×2 grid (6 module cards: Brief / Match / Reach / Insight / CRM / ROI; each = card with title + body + product thumbnail screenshot from `public/landing/screenshots/`). `py-24`. fade-up only. **StickyStack wrapper removed.** |
| 5 | ProductDemo ★ | 🌑 dark | **sticky parallax (cinematic #2)** | ~2 vp (minHeight 200vh) | Left: 3 callouts (Discover / Outreach / Attribution) scroll past. Right: sticky screenshot, swaps `/match` → `/reach` → `/insight` per active callout (cross-fade 500ms). Scales 1.0 → 1.08. |
| 6 | Trust | ☀️ light | no | ~0.7 vp | 2-card horizontal: Compliance (SPF/DKIM/DMARC + GDPR/CCPA) + 99.9% Uptime (PM2 cluster + public health endpoint). `py-20`. fade-up only. **StickyStack wrapper removed.** |
| 7 | FAQ | 🌑 dark | no | ~1 vp | Existing 5-Q&A accordion, copy rewritten for specificity (each A includes a concrete number or product reference). fade-up only. |
| 8 | FooterCTA | 🌑 dark | no | ~0.7 vp | Large H2 + single primary CTA "Request access →" with glow-pulse. 1-line footer (©, year, "Built in 东京"). |

**Total ~10 viewports** (vs current 15 vp). All 7 `SectionTransition` placements in `LandingPage.tsx` unchanged (alternation preserved).

### 4.2 Component delta (vs current main)

| File | Status | Change |
|---|---|---|
| `HeroVideo.tsx` | 🟡 polish | Mesh 4 radial-gradients → 2 + noise overlay. Mobile H1 64→56px. Subtitle i18n key rewritten. Dual CTA copy clarified. |
| `PainPoints.tsx` | 🔴 rewrite | Light 2×2 grid. Remove reveal-mask scroll anim. fade-up via existing ScrollFadeIn. py-24. |
| `Features.tsx` | 🔴 rewrite | Dark 3×2 grid. Remove StickyStack call. py-24. |
| `EmailCenterDemo.tsx` | 🟡 rename + restructure | Rename file → `ProductDemo.tsx` + matching import in `LandingPage.tsx`. Pass `stickyAssets: [<match/>, <reach/>, <insight/>]` to StickyParallax. |
| `BeforeAfter.tsx` | 🔴 rewrite | Light static 3-col grid (Old / label / New) × 4 rows. Remove sticky row-highlight. py-24. |
| `TrustPlaceholder.tsx` | 🔴 rename + rewrite | Rename file → `Trust.tsx` + matching import. Light 2-card horizontal. Remove StickyStack call. py-20. |
| `FAQ.tsx` | 🟡 copy | Rewrite 5 questions for specificity. No structural change. |
| `FooterCTA.tsx` | 🟡 minor | Remove secondary CTA (`landing-footer-cta-secondary`) — keep single primary "Request access →" with glow-pulse. 1-line footer copy review. |
| `SectionTransition.tsx` | 🟢 untouched | 6 instances in LandingPage stay. |
| `TopNav.tsx` | 🟢 untouched | K-letter logomark deferred. |
| `LandingPage.tsx` | 🟡 rewire | EmailCenterDemo → ProductDemo. TrustPlaceholder → Trust. Section order unchanged. |
| `src/components/landing/StickyParallax.tsx` | 🟡 API change | Add `stickyAssets: ReadonlyArray<ReactNode>` prop (legacy `stickyAsset` deprecated; not removed in v3 to avoid breaking any non-landing callers — `grep -rn 'StickyParallax' src/` confirms zero non-landing callers, but the legacy prop is kept for one batch then dropped). Default `minHeight: "200vh"`. Cross-fade asset swap on `activeIdx` change. |
| `src/components/landing/StickyStack.tsx` | ⚪ unused (kept) | No caller in v3; file stays for future batches. |
| `src/components/landing/ScrollFadeIn.tsx` | 🟢 untouched | Reused on 6+ sections for fade-up. |
| `src/components/landing/useScrollProgress.ts` | 🟢 untouched | Powers StickyParallax progress. |
| `messages/{en,zh,ja,ko,es}.json` | 🔴 ~60 new/rewritten keys | See §7 for full breakdown. Old keys flagged `_deprecated_by_v3` for one batch (mirrors BL-066 → BL-070 pattern); cleanup in next landing batch. |
| `tests/e2e/landing.spec.ts` | 🟡 add ~6 assertions | See §8. |
| `tests/screenshots/baseline/landing-{en,zh}-{desktop,mobile}.png` | 🔴 regen × 4 | Trigger `update-visual-baselines.yml` after merge. |
| `public/landing/screenshots/` | 🟢 untouched | 7 existing screenshots; ProductDemo uses 3 of them. |
| `public/landing/hero/hero-loop.{mp4,webm}` | ⏸️ user-delivered | Independent timeline; `<video>` falls back to poster until files arrive. |

### 4.3 Dependency graph

```
LandingPage
├─ TopNav (untouched)
├─ HeroVideo (polish)
├─ SectionTransition × 6 (untouched)
├─ PainPoints (rewrite)
├─ Features (rewrite)
├─ ProductDemo (was EmailCenterDemo)
│  └─ StickyParallax (API change: stickyAssets[])
│     └─ useScrollProgress
├─ BeforeAfter (rewrite, no sticky)
├─ Trust (was TrustPlaceholder, rewrite, no sticky)
├─ FAQ (copy only)
└─ FooterCTA (minor)

Reused but not invoked in v3:
- StickyStack.tsx (kept)
- ScrollFadeIn.tsx (used by sections for fade-up)
```

## 5. Invariants (must not regress)

1. **All 8 sections render at desktop AND mobile** with no horizontal overflow, no layout shift > 0.1 CLS.
2. **i18n parity 8/8** across 5 locales (`landing.*` + `auth.requestAccess.wantsDemoLabel` + `nav.*`). New keys present in all 5 locales; KEEP_AS_EN_PATHS allowlist unchanged.
3. **reduced-motion fallback** intact: HeroVideo poster `<img>` shown, ProductDemo callouts stacked vertically (no sticky, no scale).
4. **All existing E2E tests pass** (current `landing.spec.ts` + `locale-detection.spec.ts` + `request-access.spec.ts`). New assertions are additive.
5. **Lighthouse perf ≥ 80 desktop / ≥ 70 mobile** on staging for `/{en,zh}/` landing. (Local audit on dev mode gives a floor estimate, but staging build is the gate.)

## 6. UX Details

### 6.1 Hero (§1)

- Video bg covers `min-h-screen`, `opacity-40` so foreground text remains legible.
- Mesh simplification: keep cyan top-left + purple bottom-right radial-gradients. Drop the centered cyan + the linear-gradient backdrop (those 2 layers contribute most GPU cost for least visible difference).
- Add a single inline SVG `<feTurbulence>` noise overlay (~4KB inline, no asset round-trip) sized to the section bounds for subtle film-grain that hides banding on the radial gradients.
- Subtitle i18n key `landing.hero.subtitle`: rewrite to concrete verbs + numbers.
- Mobile breakpoint `< 640px`: H1 56px, sub 14px, CTAs stack vertically (already in current).
- ↓ Scroll-to-explore micro-copy stays.

### 6.2 ProductDemo (§4)

- StickyParallax receives `stickyAssets={[<MatchScreenshot/>, <ReachScreenshot/>, <InsightScreenshot/>]}` instead of single `stickyAsset`.
- All `stickyAssets[i]` mount once, then layer absolutely-positioned inside a `relative` container; cross-fade between them by toggling `opacity` (active = 1, others = 0) with `transition-opacity duration-500`.
- React stays mounted for all 3 (avoids re-decode of `<Image>` on each swap); only paint cost differs.
- `scale(1 + progress * 0.08)` retained.
- Mobile fallback (lg breakpoint absent): all 3 screenshots stack vertically below their callouts.

## 7. Content & Copy (i18n)

Hand-written by Generator across 5 locales (en/zh/ja/ko/es). No `aigcgateway` translation calls (cost saving + marketing precision).

### 7.1 New i18n keys (~50)

```
landing.hero.subtitle                 [rewrite, 1 key change]
landing.hero.ctaPrimary               [unchanged]
landing.hero.ctaSecondary             [copy clarify: "Book a demo"]

landing.pain.eyebrow                  [new]
landing.pain.title                    [new]
landing.pain.cards.discovery.title    [new]
landing.pain.cards.discovery.body
landing.pain.cards.compliance.title
landing.pain.cards.compliance.body
landing.pain.cards.attribution.title
landing.pain.cards.attribution.body
landing.pain.cards.spend.title
landing.pain.cards.spend.body         (9 keys total)

landing.features.eyebrow              [new]
landing.features.title                [rewrite from current "Six modules. One workflow."]
landing.features.cards.brief.title    [new]
landing.features.cards.brief.body
landing.features.cards.match.title
landing.features.cards.match.body
landing.features.cards.reach.title
landing.features.cards.reach.body
landing.features.cards.insight.title
landing.features.cards.insight.body
landing.features.cards.crm.title
landing.features.cards.crm.body
landing.features.cards.roi.title
landing.features.cards.roi.body       (13 keys total)

landing.demo.callouts[0].title        [rewrite, "Discover in minutes, not hours"]
landing.demo.callouts[0].body
landing.demo.callouts[1].title        [rewrite, "Outreach with built-in compliance"]
landing.demo.callouts[1].body
landing.demo.callouts[2].title        [rewrite, "Attribution across all 4 platforms"]
landing.demo.callouts[2].body
landing.demo.screenshotAlt.match      [new — was singular landing.demo.screenshotAlt]
landing.demo.screenshotAlt.reach      [new]
landing.demo.screenshotAlt.insight    [new]   (9 keys)

landing.before.title                  [rewrite]
landing.before.rows.find.label        [new]
landing.before.rows.find.old
landing.before.rows.find.new
landing.before.rows.reach.label
landing.before.rows.reach.old
landing.before.rows.reach.new
landing.before.rows.measure.label
landing.before.rows.measure.old
landing.before.rows.measure.new
landing.before.rows.iterate.label
landing.before.rows.iterate.old
landing.before.rows.iterate.new       (13 keys)

landing.trust.title                   [new]
landing.trust.cards.compliance.title  [new]
landing.trust.cards.compliance.body
landing.trust.cards.uptime.title
landing.trust.cards.uptime.body       (5 keys)

landing.faq.items[0].q                [rewrite]
landing.faq.items[0].a
landing.faq.items[1].q
landing.faq.items[1].a
landing.faq.items[2].q
landing.faq.items[2].a
landing.faq.items[3].q
landing.faq.items[3].a
landing.faq.items[4].q
landing.faq.items[4].a                (10 keys)
```

**Total ≈ 60 new / rewritten keys × 5 locales = 300 strings**. Generator hand-writes EN first, then translates to ZH (native speaker), then JA/KO/ES (BL-070 KEEP_AS_EN_PATHS pattern continues — leave brand/jargon English).

### 7.2 KEEP_AS_EN_PATHS

No change to `tests/unit/i18n-locale-coverage.test.ts` allowlist. New brand terms like "AI-native matrix" or product names ("Brief", "Match", "Reach", "Insight", "CRM", "ROI") follow the existing pattern (English in JA/KO/ES locale files).

## 8. Visual baseline & E2E test plan

### 8.1 E2E (`tests/e2e/landing.spec.ts`)

Existing assertions (hero video poster present, CTA links resolve, locale switcher works) **retained**. New assertions:

```
test("PainPoints renders 4 cards") → assert 4 `[data-testid^="landing-pain-card-"]`
test("Features renders 6 module cards") → assert 6 `[data-testid^="landing-feature-card-"]`
test("ProductDemo callout 1/2/3 swaps screenshot src on scroll") → scroll into each callout, assert active `<Image>` `src` contains match/reach/insight respectively
test("BeforeAfter renders 4 rows") → assert 4 `[data-testid^="landing-before-row-"]`
test("Trust renders exactly 2 cards") → assert 2 `[data-testid^="landing-trust-card-"]`
test("FooterCTA has single primary CTA") → assert 1 `[data-testid="landing-cta-footer"]`
```

`data-testid` attributes added on rewrite. Tests use existing `mockLandingPage` fixture pattern.

### 8.2 L1 unit

- `src/components/landing/__tests__/StickyParallax.test.tsx` — new test for `stickyAssets[]` API: render 3 assets, scroll progress 0% → expect asset[0] visible / asset[1,2] hidden; progress 50% → asset[1] visible; progress 100% → asset[2] visible.

### 8.3 Visual baselines

After merge, trigger `update-visual-baselines.yml` to regen:
- `tests/screenshots/baseline/landing-en-desktop.png`
- `tests/screenshots/baseline/landing-en-mobile.png`
- `tests/screenshots/baseline/landing-zh-desktop.png`
- `tests/screenshots/baseline/landing-zh-mobile.png`

### 8.4 Lighthouse audit (manual, not CI)

On staging, run `npx lighthouse https://staging.kol.guangai.ai/en/ --form-factor=desktop` and same for `/zh/`. Both must score Performance ≥ 80, Accessibility ≥ 90. Record in handoff notes.

## 9. Resources

| Resource | Status | Path |
|---|---|---|
| Product screenshots × 7 | ✅ in repo | `public/landing/screenshots/` |
| Geist Sans + Mono fonts | ✅ wired via next/font/local | `src/app/fonts/` |
| Light theme tokens (#F7F5F0 etc.) | ✅ in CSS | `src/app/globals.css` |
| Hero poster | ✅ in repo | `public/landing/hero/hero-poster.jpg` (11.3KB) |
| Hero video (mp4/webm) | ⏸️ pending user delivery | `public/landing/hero/hero-loop.{mp4,webm}` (HeroVideo falls back to poster until present) |
| Material Symbols woff2 subset | ✅ regenerated 2026-05-19 | `public/fonts/material-symbols-*.woff2` |
| Hero video prompts (5 candidates) | ✅ in repo | `docs/landing/hero-video-prompts.md` |

## 10. Accessibility & Performance

### 10.1 A11y target

- Lighthouse a11y ≥ 90 (current 91-97 across 4 IA routes; landing not separately measured but spec'd ≥ 90).
- All decorative `<div>` backgrounds: `aria-hidden="true"`.
- Hero `<video>`: `aria-label` from i18n; no captions needed (no audio).
- Cards reachable via Tab; keyboard focus visible.

### 10.2 Performance target

- **Landing Lighthouse Performance ≥ 80 desktop / ≥ 70 mobile** (staging).
- DOM nodes target: ~1500 (current cinematic v2 ~2300; reduction comes from 3 StickyParallax/Stack removals + Features grid replacing stack + Trust 3→2 card).
- Hero video `preload="metadata"` (no autoplay download until in viewport).
- Mesh radial-gradient 4 → 2 layers (paint cost ~30% reduction in DevTools profile).
- No client-side JS added beyond existing `useScrollProgress` (still ≤ 3KB gzipped).

## 11. Implementation Phases

Implementation plan to be generated by `writing-plans` skill in next step. Rough phase breakdown for the spec:

| Phase | Days | Scope |
|---|---|---|
| 1 | ~1.5 | StickyParallax API change + unit test. PainPoints, Features, BeforeAfter, Trust, ProductDemo, FAQ rewrites (6 components). |
| 2 | ~1.0 | HeroVideo polish (mesh, subtitle, mobile H1). LandingPage import rewires. i18n ~60 keys × 5 locales hand-written. |
| 3 | ~1.0 | E2E ~6 new assertions. Trigger `update-visual-baselines.yml` (4 baselines). Lighthouse staging audit. Perf tuning if < 80. |
| 4 | ~0.5 | User visual review + spec sign-off. Mark v2 spec as superseded. |

**Total ~4 days** (within the user's 5-7 day budget). User's hero video delivery runs in parallel.

## 12. Migration & Compatibility

| Concern | Handling |
|---|---|
| v2 spec `docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md` | Add `**Status**: Superseded by 2026-05-22-landing-redesign-cinematic-v3-design.md` banner at top in Phase 4 commit. |
| Existing landing 4 visual baselines | Regen in Phase 3 via `update-visual-baselines.yml`. |
| App-side surface tokens | Untouched. Light theme is landing-page-local. |
| Old i18n keys (existing landing.* keys being rewritten) | Mark `_deprecated_by_v3` for one batch; clean up next landing batch (mirrors BL-066 → BL-070 pattern, see `.auto-memory/role-context/generator.md` §"删除文件类批次"). |
| `tests/e2e/landing.spec.ts` data-testids | All existing testids preserved. New testids additive. |
| `StickyParallax.tsx` legacy `stickyAsset` prop | Marked `@deprecated` in JSDoc but kept for one batch; remove in next landing batch (zero non-landing callers, confirmed by `grep -rn 'StickyParallax' src/`). |

## 13. Open Questions

**Resolved in v3** (vs v2 §13):

1. ✅ Hero KPI strip → permanently removed.
2. ✅ TopNav K-letter logomark → defer continues.
3. ✅ Hero video prompts → 5 candidates in `docs/landing/hero-video-prompts.md`; user produces video externally.
4. ✅ Light section icon treatment → keep Material Symbols cyan-accent.

**New, still open in v3** (low priority, can be resolved during implementation):

1. **Hero subtitle final copy**: drafted "Discover, match, and reach global gaming influencers — all in one AI-native matrix." but JA/KO/ES localized versions need a final pass for tone. To resolve in Phase 2.
2. **Trust card copy specifics**: "99.9% uptime" — verify SLA claim is defensible (or change to factual "Built on PM2 cluster + Cloudflare with health endpoint at /api/health"). To resolve in Phase 1.
3. **BeforeAfter "Iterate" row copy**: "CRM history feeds AI next round" — verify Match module actually uses CRM history at the time of v3 ship (current BL-066 → BL-070 work touched it). If false, soften to "CRM history available for next brief". To resolve in Phase 1.

## 14. Success Criteria

- ✅ All 8 sections render correctly on desktop and mobile (no horizontal overflow, no CLS > 0.1).
- ✅ Page total height ≤ 11 viewports at 1280×720 (vs current 15+).
- ✅ ProductDemo (§4) shows 3 distinct screenshots correctly mapped to callouts.
- ✅ Lighthouse Performance ≥ 80 desktop / ≥ 70 mobile on staging (`/en/`, `/zh/`).
- ✅ Lighthouse Accessibility ≥ 90 (no regression).
- ✅ All existing E2E tests pass + 6 new assertions pass.
- ✅ i18n-locale-coverage 8/8 pass (5 locales × new keys all present).
- ✅ User confirms staging deploy "no more empty bands / scroll fatigue, density now matches cinematic intent" (subjective sign-off; this user-perceived gate triggered the rewrite, so it is the canonical acceptance signal).
- ✅ When user delivers `hero-loop.{mp4,webm}`, hero video plays without code change (already wired).

## 15. References

- Predecessor v1: `docs/superpowers/specs/2026-05-19-landing-page-design.md`
- Predecessor v2: `docs/superpowers/specs/2026-05-21-landing-redesign-cinematic-design.md`
- v2 implementation plan: `docs/superpowers/plans/2026-05-21-landing-redesign-cinematic.md`
- v2 commits: 7aecea9 → ef3594e (Phase 1 + 2 + 3 of v2)
- Current visual baselines diagnosing the v2 execution gap: `tests/screenshots/baseline/landing-{en,zh}-{desktop,mobile}.png`
- Hero video prompts: `docs/landing/hero-video-prompts.md`
- Brainstorm visual companion mockups: `.superpowers/brainstorm/398071-1779383767/content/` (approaches.html, section-stack.html, cinematic-moments.html, sections-detail.html, perf-migration.html)
- Reference cohort (unchanged from v2): Apple iPhone 17 / iPad pages, Riot Games landing, Anthropic Claude landing, Vercel/Resend/Linear homepages, Stripe Sessions.
- Related framework guidance: `.auto-memory/role-context/generator.md` §"删除文件类批次的 CI 多轮自修预期" (i18n deprecated keys), `framework/harness/ui-fidelity-guardrail.md` (UI page acceptance hardcoded).

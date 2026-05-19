# KolMatrix 官网落地页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public marketing landing page at `/` with 7 sections, zh/en i18n, dual CTA flow into existing `/request-access`, and Playwright-captured product screenshots — per `docs/superpowers/specs/2026-05-19-landing-page-design.md`.

**Architecture:** Middleware splits root traffic by auth state. Anonymous users land on a server-rendered marketing page composed of 7 self-contained section components reading copy from a new `landing` next-intl namespace. Authenticated users are redirected to `/insight`. CTAs link to existing `/request-access` flow; `?demo=1` pre-checks a new `wantsDemo` checkbox persisted to `AccessRequest.wantsDemo`. Product screenshots are baked once into `public/landing/screenshots/` via a one-off Playwright script.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript, Tailwind v4, next-intl, NextAuth v5, Prisma, Playwright, Vitest

---

## Stage 1 — Infrastructure & Auth-Aware Routing (Tasks 1-4)

### Task 1: AccessRequest.wantsDemo column + zod + actions

Adds a boolean column to track "I want a 1v1 demo" intent from the landing page's secondary CTA.

**Files:**
- Modify: `prisma/schema.prisma` (AccessRequest model — find by `^model AccessRequest`)
- Create: `prisma/migrations/<auto-timestamped>_access_request_wants_demo/` (auto-generated)
- Modify: `src/app/[locale]/request-access/actions.ts`
- Test (create): `tests/unit/request-access-wants-demo.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/request-access-wants-demo.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Re-import the schema once it's exported (Step 4). Until then this
// import will fail at compile time — that IS the failing test.
import { AccessRequestSchema } from "@/app/[locale]/request-access/actions";

describe("AccessRequestSchema.wantsDemo", () => {
  const base = {
    firstName: "A",
    lastName: "B",
    email: "a@b.com",
    company: "Acme",
    role: "founder" as const,
    campaignsPerQuarter: "0-5" as const,
  };

  it("parses wantsDemo='on' to true", () => {
    const r = AccessRequestSchema.parse({ ...base, wantsDemo: "on" });
    expect(r.wantsDemo).toBe(true);
  });

  it("parses missing wantsDemo to false", () => {
    const r = AccessRequestSchema.parse({ ...base });
    expect(r.wantsDemo).toBe(false);
  });

  it("parses wantsDemo='false' to false", () => {
    const r = AccessRequestSchema.parse({ ...base, wantsDemo: "false" });
    expect(r.wantsDemo).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails (import error / not exported)**

```bash
npm run test -- tests/unit/request-access-wants-demo.test.ts
```

Expected: FAIL — `AccessRequestSchema` is not exported from `actions.ts`.

- [ ] **Step 3: Add `wantsDemo` to the Prisma schema**

In `prisma/schema.prisma`, find the `model AccessRequest { ... }` block. Insert this line directly above the `status` field:

```prisma
  wantsDemo            Boolean   @default(false) @map("wants_demo")
```

(Resulting block keeps existing fields; only this one is added.)

- [ ] **Step 4: Generate migration and run it**

```bash
npx prisma migrate dev --name access_request_wants_demo
```

Expected: New migration directory under `prisma/migrations/<timestamp>_access_request_wants_demo/`, migration applies cleanly, Prisma Client regenerated.

- [ ] **Step 5: Extend zod schema and export it; persist wantsDemo in upsert**

Modify `src/app/[locale]/request-access/actions.ts`. Change the schema definition from `const AccessRequestSchema` to `export const AccessRequestSchema`, and add the `wantsDemo` field:

```typescript
export const AccessRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(64),
  lastName: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(320),
  company: z.string().trim().min(1).max(128),
  role: z.enum(ROLE_OPTIONS),
  campaignsPerQuarter: z.enum(CAMPAIGNS_OPTIONS),
  games: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  wantsDemo: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
```

Then in the `prisma.accessRequest.upsert` call, ensure `data` already spreads `...data` so `wantsDemo` is automatically included in both `create` and `update`. No further change needed if the existing code uses `...data`.

- [ ] **Step 6: Run the unit test — it should now pass**

```bash
npm run test -- tests/unit/request-access-wants-demo.test.ts
```

Expected: 3 passing tests.

- [ ] **Step 7: Run typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/app/[locale]/request-access/actions.ts tests/unit/request-access-wants-demo.test.ts
git commit -m "feat(landing): add wantsDemo to AccessRequest + zod schema

Pre-work for landing page secondary CTA — '预约 1v1 演示' will link
to /request-access?demo=1 which pre-checks a new wantsDemo checkbox.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §8"
```

---

### Task 2: RequestAccessForm wantsDemo checkbox + searchParams

Adds the checkbox UI to the form so users coming from the landing page's secondary CTA see it pre-checked.

**Files:**
- Modify: `src/components/auth/RequestAccessForm.tsx`
- Modify: `messages/zh.json` (auth.requestAccess namespace)
- Modify: `messages/en.json` (auth.requestAccess namespace)
- Test: extend `tests/e2e/landing.spec.ts` in Task 4 (we ship the form change here, test there)

- [ ] **Step 1: Add i18n key `wantsDemoLabel` to both locales**

In `messages/zh.json`, find the `"auth"` → `"requestAccess"` block. Add a key (anywhere alphabetically reasonable):

```json
"wantsDemoLabel": "希望产品经理与我进行 1v1 演示"
```

In `messages/en.json`, same namespace:

```json
"wantsDemoLabel": "I'd like a 1:1 product demo from a product manager"
```

- [ ] **Step 2: Add `useSearchParams` import and checkbox to RequestAccessForm**

In `src/components/auth/RequestAccessForm.tsx`, change the navigation imports to include `useSearchParams`:

```typescript
import { useRouter, useSearchParams } from "next/navigation";
```

Inside the `RequestAccessForm` function, after the existing `useActionState` line, add:

```typescript
const searchParams = useSearchParams();
const wantsDemoDefault = searchParams.get("demo") === "1";
```

Then in the form JSX, locate the existing ToS checkbox (search for `tosAccepted` — typically the last field before submit). Insert this block immediately *above* the ToS checkbox:

```tsx
<label className="flex items-start gap-2 text-sm text-on-surface-variant">
  <input
    type="checkbox"
    name="wantsDemo"
    defaultChecked={wantsDemoDefault}
    className="mt-1 h-4 w-4 accent-cyan"
    data-testid="request-access-wants-demo"
  />
  <span>{t("wantsDemoLabel")}</span>
</label>
```

- [ ] **Step 3: Verify form still typechecks and renders**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Manual smoke (dev server)**

```bash
npm run dev
```

Open `http://localhost:3000/zh/request-access` — verify the new checkbox renders unchecked.
Open `http://localhost:3000/zh/request-access?demo=1` — verify the new checkbox renders pre-checked.

(Stop the dev server with Ctrl-C after verifying.)

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/RequestAccessForm.tsx messages/zh.json messages/en.json
git commit -m "feat(landing): RequestAccessForm wantsDemo checkbox

Landing page's secondary CTA will append ?demo=1; the form reads
the query param via useSearchParams and pre-checks a new optional
checkbox. Plumbing to AccessRequest.wantsDemo was added in the
previous commit.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §8.3"
```

---

### Task 3: Extract resolveAuthAwareRoot helper + unit test

Extracts the auth-aware `/` redirect target into a pure helper so the routing decision is unit-testable without spinning up middleware.

**Files:**
- Modify: `src/middleware-helpers.ts`
- Test (create): `tests/unit/resolve-auth-aware-root.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/resolve-auth-aware-root.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { resolveAuthAwareRoot } from "@/middleware-helpers";

describe("resolveAuthAwareRoot", () => {
  it("returns /<locale>/insight when session present", () => {
    const result = resolveAuthAwareRoot({ locale: "zh", hasSession: true });
    expect(result).toBe("/zh/insight");
  });

  it("returns /<locale>/ when session absent", () => {
    const result = resolveAuthAwareRoot({ locale: "en", hasSession: false });
    expect(result).toBe("/en/");
  });

  it("treats undefined session as anonymous", () => {
    const result = resolveAuthAwareRoot({ locale: "zh", hasSession: undefined });
    expect(result).toBe("/zh/");
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

```bash
npm run test -- tests/unit/resolve-auth-aware-root.test.ts
```

Expected: FAIL — `resolveAuthAwareRoot` is not exported.

- [ ] **Step 3: Add the helper to middleware-helpers.ts**

Append to `src/middleware-helpers.ts`:

```typescript
/**
 * 2026-05-19 landing page · Determines the redirect target for `/`
 * based on whether the request carries an authenticated session.
 *
 * - Authenticated → user's home surface (`/insight`)
 * - Anonymous → marketing landing page (`/{locale}/`)
 *
 * Extracted so middleware.ts can stay short and the decision is
 * trivially unit-testable.
 */
export function resolveAuthAwareRoot(args: {
  locale: string;
  hasSession: boolean | undefined;
}): string {
  return args.hasSession
    ? `/${args.locale}/insight`
    : `/${args.locale}/`;
}
```

- [ ] **Step 4: Run the test — it should pass**

```bash
npm run test -- tests/unit/resolve-auth-aware-root.test.ts
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/middleware-helpers.ts tests/unit/resolve-auth-aware-root.test.ts
git commit -m "feat(landing): extract resolveAuthAwareRoot helper

Pure helper that middleware.ts will use for /-path routing so
anonymous users land on the marketing page and authenticated ones
go to /insight. Unit-tested separately from NextAuth integration.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §5"
```

---

### Task 4: Wire middleware + page.tsx + update existing landing.spec.ts

Wires the new helper into middleware.ts and changes `src/app/[locale]/page.tsx` to render the landing page (skeleton stub) instead of unconditionally redirecting.

**Files:**
- Modify: `src/middleware.ts` (lines 46-54 — the `/` block)
- Modify: `src/app/[locale]/page.tsx` (full rewrite)
- Create (skeleton, to be filled in Stage 2): `src/app/[locale]/(marketing)/_components/LandingPage.tsx`
- Modify: `tests/e2e/landing.spec.ts`

- [ ] **Step 1: Update landing.spec.ts to assert the new behavior (failing tests)**

Replace the entire contents of `tests/e2e/landing.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

/**
 * 2026-05-19 landing page · Anonymous root path renders the
 * marketing landing page; authenticated users get redirected to
 * /insight. The full content lives in
 * src/app/[locale]/(marketing)/_components/LandingPage.tsx.
 */
test.describe("Anonymous root path", () => {
  test("/ resolves to /<locale>/ and shows the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(zh|en)\/?$/);
    await expect(page.getByTestId("landing-hero")).toBeVisible();
  });

  test("/zh shows the landing page in Chinese", async ({ page }) => {
    await page.goto("/zh");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
    await expect(page).toHaveTitle(/KolMatrix|KOLMatrix/);
  });

  test("/en shows the landing page in English", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("landing-hero")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e to confirm failure**

```bash
npm run test:e2e -- tests/e2e/landing.spec.ts
```

Expected: FAIL — no `landing-hero` testid exists yet.

- [ ] **Step 3: Create the skeleton LandingPage component**

Create `src/app/[locale]/(marketing)/_components/LandingPage.tsx`:

```tsx
/**
 * 2026-05-19 landing page · Marketing landing page composition root.
 *
 * Stage 1 ships an empty shell so middleware + page.tsx routing can
 * be verified end-to-end before the section components land in
 * Stage 2 (Tasks 6-12).
 */
interface Props {
  locale: string;
}

export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-surface text-on-surface"
      data-testid="landing-page"
      data-locale={locale}
    >
      <section data-testid="landing-hero" className="px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white">KolMatrix</h1>
        <p className="mt-4 text-on-surface-variant">
          [Stage 2 — section components land here]
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Rewrite `src/app/[locale]/page.tsx`**

Replace the entire file:

```tsx
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { LandingPage } from "./(marketing)/_components/LandingPage";

/**
 * 2026-05-19 landing page · Root locale page.
 *
 * Anonymous → render marketing landing.
 * Authenticated → redirect to /insight (user's home surface).
 *
 * Middleware also performs this split for the un-prefixed `/` so
 * authenticated users skip the landing page entirely; this server
 * component is the fallback for direct `/zh/` or `/en/` visits.
 */
interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LocalizedRootPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}/insight`);
  }
  return <LandingPage locale={locale} />;
}
```

- [ ] **Step 5: Update middleware to use the new helper**

In `src/middleware.ts`, locate the existing `/` block (lines ~46-54):

```typescript
if (pathname === "/") {
  const locale = resolveTargetLocale(req);
  return NextResponse.redirect(new URL(`/${locale}/insight`, nextUrl));
}
```

Replace it with:

```typescript
if (pathname === "/") {
  const locale = resolveTargetLocale(req);
  // Fail-safe by construction: NextAuth's auth() wrapper returns
  // req.auth=undefined on session lookup errors. Boolean(undefined)=false
  // → routes to the landing page rather than locking everyone in /login
  // (matches spec §9 "fail-safe to landing").
  const target = resolveAuthAwareRoot({ locale, hasSession: Boolean(req.auth) });
  return NextResponse.redirect(new URL(target, nextUrl));
}
```

Add `resolveAuthAwareRoot` to the existing import from `@/middleware-helpers`:

```typescript
import {
  detectLocaleFromAcceptLanguage,
  isProtected,
  resolveAuthAwareRoot,
  resolveIaRefactorRedirect,
  stripLocale,
} from "@/middleware-helpers";
```

- [ ] **Step 6: Run the e2e — landing tests should pass**

```bash
npm run test:e2e -- tests/e2e/landing.spec.ts
```

Expected: 3 passing tests.

- [ ] **Step 7: Run typecheck + lint + unit tests**

```bash
npm run typecheck && npm run lint && npm run test
```

Expected: 0 errors. Unit tests from Tasks 1 + 3 still pass.

- [ ] **Step 8: Commit**

```bash
git add src/middleware.ts src/app/[locale]/page.tsx src/app/[locale]/\(marketing\)/_components/LandingPage.tsx tests/e2e/landing.spec.ts
git commit -m "feat(landing): wire auth-aware root + skeleton LandingPage

Middleware now routes / based on auth state; /{locale}/ renders a
marketing landing page (skeleton this commit, sections in Stage 2)
for anonymous users and redirects authenticated ones to /insight.

The pre-existing tests/e2e/landing.spec.ts placeholder is replaced
with 3 real tests asserting the new contract.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §5"
```

---

## Stage 2 — Content Sections (Tasks 5-12)

All seven section components are server components (no `'use client'`), live under `src/app/[locale]/(marketing)/_components/`, and read copy from a new `landing` next-intl namespace.

### Task 5: Add landing namespace skeleton + LandingPage composition

Adds empty (but well-typed) i18n keys for all 7 sections and replaces the LandingPage skeleton with a real composition root that imports them.

**Files:**
- Modify: `messages/zh.json` (add `landing` top-level namespace)
- Modify: `messages/en.json` (mirror)
- Modify: `src/app/[locale]/(marketing)/_components/LandingPage.tsx`

- [ ] **Step 1: Add `landing` namespace to both messages files**

In `messages/zh.json`, add a top-level key (paste this verbatim — the section content lands in Tasks 6-12 but the keys need to exist so next-intl doesn't throw):

```json
"landing": {
  "meta": {
    "title": "KolMatrix — 全球游戏 KOL 营销指挥中心",
    "description": "AI 智能匹配 · 全流程协作 · 邮件合规一站搞定。覆盖 YouTube/TikTok/Twitch/Bilibili 全平台游戏 KOL 投放。"
  },
  "hero": {},
  "painPoints": {},
  "features": {},
  "demo": {},
  "trust": {},
  "faq": {},
  "footerCta": {}
}
```

In `messages/en.json`:

```json
"landing": {
  "meta": {
    "title": "KolMatrix — Global Game KOL Marketing Command Center",
    "description": "AI-powered matching, end-to-end collaboration, and email compliance in one place. Covering KOLs across YouTube, TikTok, Twitch, and Bilibili."
  },
  "hero": {},
  "painPoints": {},
  "features": {},
  "demo": {},
  "trust": {},
  "faq": {},
  "footerCta": {}
}
```

- [ ] **Step 2: Replace LandingPage skeleton with composition root**

Replace `src/app/[locale]/(marketing)/_components/LandingPage.tsx`:

```tsx
import { Hero } from "./Hero";
import { PainPoints } from "./PainPoints";
import { Features } from "./Features";
import { EmailCenterDemo } from "./EmailCenterDemo";
import { TrustPlaceholder } from "./TrustPlaceholder";
import { FAQ } from "./FAQ";
import { FooterCTA } from "./FooterCTA";

interface Props {
  locale: string;
}

export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-surface text-on-surface"
      data-testid="landing-page"
      data-locale={locale}
    >
      <Hero locale={locale} />
      <PainPoints />
      <Features locale={locale} />
      <EmailCenterDemo />
      <TrustPlaceholder />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
```

- [ ] **Step 3: Create empty placeholder components (so build doesn't break)**

For each of the 7 components, create a placeholder so the build can continue. Run these 7 in one task — each file is 6 lines:

`src/app/[locale]/(marketing)/_components/Hero.tsx`:
```tsx
export function Hero({ locale: _ }: { locale: string }) {
  return <section data-testid="landing-hero" className="h-1" />;
}
```

`src/app/[locale]/(marketing)/_components/PainPoints.tsx`:
```tsx
export function PainPoints() {
  return <section data-testid="landing-painpoints" className="h-1" />;
}
```

`src/app/[locale]/(marketing)/_components/Features.tsx`:
```tsx
export function Features({ locale: _ }: { locale: string }) {
  return <section data-testid="landing-features" className="h-1" />;
}
```

`src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`:
```tsx
export function EmailCenterDemo() {
  return <section data-testid="landing-demo" className="h-1" />;
}
```

`src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx`:
```tsx
export function TrustPlaceholder() {
  return <section data-testid="landing-trust" className="h-1" />;
}
```

`src/app/[locale]/(marketing)/_components/FAQ.tsx`:
```tsx
export function FAQ() {
  return <section data-testid="landing-faq" className="h-1" />;
}
```

`src/app/[locale]/(marketing)/_components/FooterCTA.tsx`:
```tsx
export function FooterCTA({ locale: _ }: { locale: string }) {
  return <section data-testid="landing-footer-cta" className="h-1" />;
}
```

- [ ] **Step 4: Verify build and existing e2e still pass**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
```

Expected: 0 type errors. 3 e2e tests still pass (landing-hero testid still exists).

- [ ] **Step 5: Commit**

```bash
git add messages/zh.json messages/en.json src/app/[locale]/\(marketing\)/
git commit -m "feat(landing): scaffold 7 section components + i18n namespace

Placeholder components let the build succeed while Stage 2 tasks
fill in each section's real content.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6"
```

---

### Task 6: Hero section

Implements the above-fold Hero — H1 + subtitle + 4-KPI strip + dual CTA + dual screenshot placeholders.

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/Hero.tsx`
- Modify: `messages/zh.json` (landing.hero subtree)
- Modify: `messages/en.json` (landing.hero subtree)

Screenshots are added in Stage 3 (Task 13); this task uses `next/image` with placeholder src and adds a TODO comment so the build doesn't break.

- [ ] **Step 1: Populate `landing.hero` keys in both locales**

In `messages/zh.json`, replace `"hero": {}` with:

```json
"hero": {
  "kicker": "KolMatrix",
  "title": "全球游戏 KOL 营销指挥中心",
  "subtitle": "AI 智能匹配 · 全流程协作 · 邮件合规一站搞定 — 让游戏出海 KOL 投放效率提升 10 倍",
  "kpis": {
    "kolLibrary": "{count}+ 游戏垂类 KOL 库",
    "platforms": "4 大平台覆盖",
    "platformsHint": "YouTube · TikTok · Twitch · Bilibili",
    "aiMatch": "AI 智能匹配",
    "aiMatchHint": "上传素材，3 分钟锁定最优达人",
    "compliance": "DKIM/SPF 合规 + 98% 信誉分"
  },
  "ctaPrimary": "立即申请试用",
  "ctaSecondary": "预约 1v1 演示",
  "screenshotAiAlt": "KolMatrix /match AI suggestions sidebar",
  "screenshotReachAlt": "KolMatrix /reach email center domain health"
}
```

In `messages/en.json`:

```json
"hero": {
  "kicker": "KolMatrix",
  "title": "Global Game KOL Marketing Command Center",
  "subtitle": "AI-powered matching · end-to-end collaboration · email compliance — 10× faster KOL outreach for game studios",
  "kpis": {
    "kolLibrary": "{count}+ Game-vertical KOLs",
    "platforms": "4 major platforms",
    "platformsHint": "YouTube · TikTok · Twitch · Bilibili",
    "aiMatch": "AI Match",
    "aiMatchHint": "Upload a brief, get the right creators in 3 minutes",
    "compliance": "DKIM/SPF compliance + 98 reputation"
  },
  "ctaPrimary": "Request a trial",
  "ctaSecondary": "Book a 1:1 demo",
  "screenshotAiAlt": "KolMatrix /match AI suggestions sidebar",
  "screenshotReachAlt": "KolMatrix /reach email center domain health"
}
```

- [ ] **Step 2: Implement the Hero component**

Replace `src/app/[locale]/(marketing)/_components/Hero.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

// Stage 3 Task 14 replaces this with a real count read from the DB.
const KOL_COUNT_DISPLAY = 2500;

export async function Hero({ locale }: Props) {
  const t = await getTranslations("landing.hero");

  return (
    <section
      data-testid="landing-hero"
      className="relative overflow-hidden bg-surface px-6 py-20 lg:px-12 lg:py-28"
    >
      {/* ambient glow */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-cyan/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-fixed">
            {t("kicker")}
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white lg:text-5xl xl:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-xl text-base text-on-surface-variant lg:text-lg">
            {t("subtitle")}
          </p>

          {/* 4-KPI strip */}
          <ul className="mt-8 grid grid-cols-2 gap-3">
            <li className="rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">🎮</span>
              {t("kpis.kolLibrary", { count: KOL_COUNT_DISPLAY })}
            </li>
            <li className="rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">🌐</span>
              <span className="font-semibold">{t("kpis.platforms")}</span>
              <div className="mt-1 text-xs text-on-surface-variant">{t("kpis.platformsHint")}</div>
            </li>
            <li className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">🤖</span>
              <span className="font-semibold text-secondary">{t("kpis.aiMatch")}</span>
              <div className="mt-1 text-xs text-on-surface-variant">{t("kpis.aiMatchHint")}</div>
            </li>
            <li className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-on-surface">
              <span aria-hidden="true" className="mr-2">✉️</span>
              {t("kpis.compliance")}
            </li>
          </ul>

          {/* dual CTA */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/request-access`}
              className="inline-flex items-center gap-2 rounded-full bg-cyan px-6 py-3 text-sm font-semibold text-surface shadow-[0_0_20px_rgba(0,229,255,0.4)] transition hover:bg-cyan/90"
              data-testid="landing-cta-primary"
            >
              {t("ctaPrimary")} →
            </Link>
            <Link
              href={`/${locale}/request-access?demo=1`}
              className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-6 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/10"
              data-testid="landing-cta-secondary"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>

        {/* screenshot stack (right column, hidden on mobile) */}
        <div className="hidden flex-col gap-3 lg:flex">
          <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <Image
              src="/landing/screenshots/match-ai-sidebar.png"
              alt={t("screenshotAiAlt")}
              width={640}
              height={420}
              priority
              className="h-auto w-full"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-cyan/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <Image
              src="/landing/screenshots/reach-domain-health.png"
              alt={t("screenshotReachAlt")}
              width={640}
              height={420}
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add temporary placeholder screenshots so build doesn't fail**

```bash
mkdir -p public/landing/screenshots
# 1×1 transparent PNG — replaced by Task 13
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x03\x00\x06\x00\x02\xfe\xa3\x9a\xb3\xed\x00\x00\x00\x00IEND\xaeB`\x82' > public/landing/screenshots/match-ai-sidebar.png
cp public/landing/screenshots/match-ai-sidebar.png public/landing/screenshots/reach-domain-health.png
```

- [ ] **Step 4: Run typecheck and the existing e2e**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
```

Expected: 0 errors, 3 e2e pass.

- [ ] **Step 5: Manual smoke**

```bash
npm run dev
```

Open `http://localhost:3000/zh` — verify hero H1, subtitle, 4 KPI cards, two CTA buttons render correctly. Click primary CTA → should land on `/zh/request-access`. Click secondary CTA → should land on `/zh/request-access?demo=1` with wantsDemo checkbox already checked.

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/\(marketing\)/_components/Hero.tsx messages/zh.json messages/en.json public/landing/screenshots/
git commit -m "feat(landing): Hero section

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.1"
```

---

### Task 7: PainPoints section

4 horizontally arranged pain points (2×2 grid on mobile).

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/PainPoints.tsx`
- Modify: `messages/zh.json` (landing.painPoints)
- Modify: `messages/en.json` (landing.painPoints)

- [ ] **Step 1: Populate i18n**

`messages/zh.json` — replace `"painPoints": {}`:

```json
"painPoints": {
  "sectionTitle": "游戏出海 KOL 营销 4 大痛点",
  "items": {
    "find": {
      "icon": "🔍",
      "title": "跨平台找 KOL 慢",
      "body": "筛选散、数据不准，4 大平台来回切换效率低"
    },
    "match": {
      "icon": "🎯",
      "title": "受众分析模糊匹配不准",
      "body": "凭感觉投放，ROI 不可控，烧钱不见声量"
    },
    "email": {
      "icon": "📭",
      "title": "邮件送达率低开信率为 0",
      "body": "不知道是合规配置问题还是内容问题"
    },
    "workflow": {
      "icon": "⚙️",
      "title": "全流程割裂合规风险高",
      "body": "合作进度全靠人工 Excel 统计，回款复盘没体系"
    }
  },
  "tagline": "找达人 → AI 匹配 → 发起合作 → 邮件协作 → 数据复盘 — 一站搞定"
}
```

`messages/en.json`:

```json
"painPoints": {
  "sectionTitle": "Four challenges every game studio faces",
  "items": {
    "find": {
      "icon": "🔍",
      "title": "Cross-platform KOL discovery is slow",
      "body": "Scattered data, inconsistent metrics, four platforms to juggle"
    },
    "match": {
      "icon": "🎯",
      "title": "Audience fit is a gut call",
      "body": "Imprecise matching, unpredictable ROI, wasted spend"
    },
    "email": {
      "icon": "📭",
      "title": "Emails never reach the inbox",
      "body": "Open rate stuck at zero with no way to tell if it's compliance or content"
    },
    "workflow": {
      "icon": "⚙️",
      "title": "Workflow is fragmented and risky",
      "body": "Progress tracked in spreadsheets; compliance gaps create brand risk"
    }
  },
  "tagline": "Find → AI Match → Outreach → Collaborate → Measure — all in one place"
}
```

- [ ] **Step 2: Implement the component**

Replace `src/app/[locale]/(marketing)/_components/PainPoints.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export async function PainPoints() {
  const t = await getTranslations("landing.painPoints");
  const items = ["find", "match", "email", "workflow"] as const;

  return (
    <section
      data-testid="landing-painpoints"
      className="bg-surface-container-lowest px-6 py-20 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((key) => (
            <div
              key={key}
              data-testid={`landing-painpoint-${key}`}
              className="rounded-2xl bg-surface-container p-6"
            >
              <div className="text-2xl" aria-hidden="true">
                {t(`items.${key}.icon`)}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-xs text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-primary-fixed">
          {t("tagline")}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build + e2e**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/\(marketing\)/_components/PainPoints.tsx messages/zh.json messages/en.json
git commit -m "feat(landing): PainPoints section

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.2"
```

---

### Task 8: Features section (6 modules)

3-column × 2-row grid of feature cards.

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/Features.tsx`
- Modify: `messages/zh.json` (landing.features)
- Modify: `messages/en.json` (landing.features)

- [ ] **Step 1: Populate i18n**

`messages/zh.json` — replace `"features": {}`:

```json
"features": {
  "sectionTitle": "覆盖全流程的 6 大核心模块",
  "items": {
    "library": {
      "title": "游戏垂类 KOL 库",
      "body": "15 维筛选，按品类 / 画风 / 地区 / 粉丝画像精准定位",
      "linkLabel": "前往 /match"
    },
    "aiMatch": {
      "title": "AI 智能匹配",
      "body": "上传游戏素材，AI 自动推荐高契合度 KOL 组合",
      "linkLabel": "前往 /match"
    },
    "insight": {
      "title": "多平台数据分析",
      "body": "播放 / 互动 / 受众画像 / 转化实时看板",
      "linkLabel": "前往 /insight"
    },
    "reach": {
      "title": "邮件协作 & 合规中心",
      "body": "DKIM/SPF/DMARC 一键配置 + 信誉分 98 + 全流程追踪",
      "linkLabel": "前往 /reach"
    },
    "crm": {
      "title": "KOL CRM 管理",
      "body": "标签 / 分组 / 沟通记录 / 合作进度一体化",
      "linkLabel": "前往 /crm"
    },
    "roi": {
      "title": "数据复盘 & ROI",
      "body": "曝光 / 互动 / 引流 / 转化 / ROI 全维度追踪",
      "linkLabel": "前往 /roi"
    }
  }
}
```

`messages/en.json`:

```json
"features": {
  "sectionTitle": "Six modules cover the full lifecycle",
  "items": {
    "library": {
      "title": "Game-vertical KOL library",
      "body": "15-dimension filtering by genre, style, region, audience profile",
      "linkLabel": "Open /match"
    },
    "aiMatch": {
      "title": "AI-powered matching",
      "body": "Upload your brief; AI recommends the highest-fit creator mix",
      "linkLabel": "Open /match"
    },
    "insight": {
      "title": "Multi-platform analytics",
      "body": "Plays, engagement, audience profile, conversion — all in one dashboard",
      "linkLabel": "Open /insight"
    },
    "reach": {
      "title": "Email collaboration & compliance",
      "body": "One-click DKIM/SPF/DMARC + reputation 98 + full-funnel tracking",
      "linkLabel": "Open /reach"
    },
    "crm": {
      "title": "KOL CRM",
      "body": "Tags, segments, conversation history, deal progress — unified",
      "linkLabel": "Open /crm"
    },
    "roi": {
      "title": "Reporting & ROI",
      "body": "Impressions, engagement, traffic, conversion, ROI — every dimension",
      "linkLabel": "Open /roi"
    }
  }
}
```

- [ ] **Step 2: Implement the component**

Replace `src/app/[locale]/(marketing)/_components/Features.tsx`:

```tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

interface FeatureMeta {
  key: "library" | "aiMatch" | "insight" | "reach" | "crm" | "roi";
  href: string;
  screenshot: string;
  accent: "cyan" | "secondary" | "cyanStrong";
}

const FEATURES: ReadonlyArray<FeatureMeta> = [
  { key: "library", href: "/match", screenshot: "/landing/screenshots/match-full.png", accent: "cyan" },
  { key: "aiMatch", href: "/match", screenshot: "/landing/screenshots/match-ai-sidebar.png", accent: "secondary" },
  { key: "insight", href: "/insight", screenshot: "/landing/screenshots/insight-full.png", accent: "cyan" },
  { key: "reach", href: "/reach", screenshot: "/landing/screenshots/reach-domain-health.png", accent: "cyanStrong" },
  { key: "crm", href: "/crm", screenshot: "/landing/screenshots/crm-full.png", accent: "cyan" },
  { key: "roi", href: "/roi", screenshot: "/landing/screenshots/roi-full.png", accent: "cyan" },
];

function accentClass(accent: FeatureMeta["accent"]): string {
  if (accent === "secondary") return "border-secondary/30 bg-secondary/5";
  if (accent === "cyanStrong") return "border-cyan/40 bg-cyan/10";
  return "border-cyan/15 bg-surface-container";
}

function titleColorClass(accent: FeatureMeta["accent"]): string {
  if (accent === "secondary") return "text-secondary";
  return "text-cyan";
}

export async function Features({ locale }: Props) {
  const t = await getTranslations("landing.features");

  return (
    <section
      data-testid="landing-features"
      className="bg-surface px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, href, screenshot, accent }) => (
            <a
              key={key}
              href={`/${locale}${href}`}
              data-testid={`landing-feature-${key}`}
              className={`group flex flex-col gap-4 rounded-2xl border p-6 transition hover:bg-cyan/5 ${accentClass(accent)}`}
            >
              <h3 className={`text-base font-semibold ${titleColorClass(accent)}`}>
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
              <div className="mt-auto overflow-hidden rounded-xl border border-cyan/10">
                <Image
                  src={screenshot}
                  alt={t(`items.${key}.title`)}
                  width={480}
                  height={300}
                  className="h-auto w-full opacity-90 transition group-hover:opacity-100"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add placeholder screenshots for the 4 new paths**

```bash
cp public/landing/screenshots/match-ai-sidebar.png public/landing/screenshots/match-full.png
cp public/landing/screenshots/match-ai-sidebar.png public/landing/screenshots/insight-full.png
cp public/landing/screenshots/match-ai-sidebar.png public/landing/screenshots/crm-full.png
cp public/landing/screenshots/match-ai-sidebar.png public/landing/screenshots/roi-full.png
```

- [ ] **Step 4: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/\(marketing\)/_components/Features.tsx messages/zh.json messages/en.json public/landing/screenshots/
git commit -m "feat(landing): Features section (6 modules)

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.3"
```

---

### Task 9: EmailCenterDemo section

3 large screenshots in a row (stacked on mobile) + 5-step flow notation.

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`
- Modify: `messages/zh.json` (landing.demo)
- Modify: `messages/en.json` (landing.demo)

- [ ] **Step 1: Populate i18n**

`messages/zh.json` — replace `"demo": {}`:

```json
"demo": {
  "sectionTitle": "看一眼 KolMatrix 的实际样子",
  "screenshotAlts": {
    "match": "/match 全景 — AI 匹配 + KOL 库",
    "reach": "/reach 全景 — Email Center",
    "insight": "/insight 全景 — 数据看板"
  },
  "steps": ["找 KOL", "AI 匹配", "发起合作", "邮件协作", "数据复盘"]
}
```

`messages/en.json`:

```json
"demo": {
  "sectionTitle": "Here's what KolMatrix actually looks like",
  "screenshotAlts": {
    "match": "/match overview — AI matching + KOL library",
    "reach": "/reach overview — Email Center",
    "insight": "/insight overview — analytics dashboard"
  },
  "steps": ["Find KOLs", "AI Match", "Outreach", "Collaborate", "Measure"]
}
```

- [ ] **Step 2: Implement the component**

Replace `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`:

```tsx
import Image from "next/image";
import { getTranslations } from "next-intl/server";

const SCREENSHOTS: ReadonlyArray<{
  key: "match" | "reach" | "insight";
  src: string;
}> = [
  { key: "match", src: "/landing/screenshots/match-full.png" },
  { key: "reach", src: "/landing/screenshots/reach-full.png" },
  { key: "insight", src: "/landing/screenshots/insight-full.png" },
];

export async function EmailCenterDemo() {
  const t = await getTranslations("landing.demo");
  const steps = t.raw("steps") as ReadonlyArray<string>;

  return (
    <section
      data-testid="landing-demo"
      className="bg-surface-container-lowest px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {SCREENSHOTS.map(({ key, src }) => (
            <div
              key={key}
              data-testid={`landing-demo-${key}`}
              className="overflow-hidden rounded-2xl border border-cyan/15 shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
            >
              <Image
                src={src}
                alt={t(`screenshotAlts.${key}`)}
                width={640}
                height={400}
                className="h-auto w-full"
              />
            </div>
          ))}
        </div>

        {/* flow strip */}
        <ol className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs text-primary-fixed sm:text-sm">
          {steps.map((step, idx) => (
            <li key={step} className="flex items-center gap-3">
              <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 font-semibold">
                {idx + 1}. {step}
              </span>
              {idx < steps.length - 1 && (
                <span className="text-cyan/60" aria-hidden="true">→</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Add missing placeholder screenshot**

```bash
cp public/landing/screenshots/match-ai-sidebar.png public/landing/screenshots/reach-full.png
```

- [ ] **Step 4: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/\(marketing\)/_components/EmailCenterDemo.tsx messages/zh.json messages/en.json public/landing/screenshots/
git commit -m "feat(landing): EmailCenterDemo section (3 screenshots + flow)

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.4"
```

---

### Task 10: TrustPlaceholder section

3 equal-width cards — encryption / email compliance / "partners in talks". No fake logos.

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx`
- Modify: `messages/zh.json` (landing.trust)
- Modify: `messages/en.json` (landing.trust)

- [ ] **Step 1: Populate i18n**

`messages/zh.json` — replace `"trust": {}`:

```json
"trust": {
  "sectionTitle": "企业级合规与安全",
  "items": {
    "encryption": {
      "icon": "🔒",
      "title": "企业级数据加密",
      "body": "TLS 1.3 传输加密 + Postgres RLS 多租户隔离"
    },
    "email": {
      "icon": "✉️",
      "title": "邮件合规资质",
      "body": "Resend SPF / DKIM / DMARC 全认证，信誉分 98"
    },
    "partners": {
      "icon": "🤝",
      "title": "合作伙伴洽谈中",
      "body": "头部出海游戏发行商接洽中，名单稍后公开"
    }
  }
}
```

`messages/en.json`:

```json
"trust": {
  "sectionTitle": "Enterprise-grade security and compliance",
  "items": {
    "encryption": {
      "icon": "🔒",
      "title": "Enterprise data encryption",
      "body": "TLS 1.3 in transit + Postgres RLS multi-tenant isolation"
    },
    "email": {
      "icon": "✉️",
      "title": "Email compliance",
      "body": "Resend SPF / DKIM / DMARC fully verified, reputation 98"
    },
    "partners": {
      "icon": "🤝",
      "title": "Partners in conversation",
      "body": "Top global game publishers in discussion — list coming soon"
    }
  }
}
```

- [ ] **Step 2: Implement the component**

Replace `src/app/[locale]/(marketing)/_components/TrustPlaceholder.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export async function TrustPlaceholder() {
  const t = await getTranslations("landing.trust");
  const items = ["encryption", "email", "partners"] as const;

  return (
    <section
      data-testid="landing-trust"
      className="bg-surface px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((key) => (
            <div
              key={key}
              data-testid={`landing-trust-${key}`}
              className="flex flex-col items-center rounded-2xl border border-cyan/15 bg-surface-container p-8 text-center"
            >
              <div className="text-3xl" aria-hidden="true">
                {t(`items.${key}.icon`)}
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm text-on-surface-variant">
                {t(`items.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/\(marketing\)/_components/TrustPlaceholder.tsx messages/zh.json messages/en.json
git commit -m "feat(landing): TrustPlaceholder section

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.5"
```

---

### Task 11: FAQ section

5 collapsible Q&A using native `<details>` (no JS).

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/FAQ.tsx`
- Modify: `messages/zh.json` (landing.faq)
- Modify: `messages/en.json` (landing.faq)

- [ ] **Step 1: Populate i18n**

`messages/zh.json` — replace `"faq": {}`:

```json
"faq": {
  "sectionTitle": "常见问题",
  "items": [
    {
      "q": "支持游戏细分品类筛选吗？",
      "a": "支持。RPG / 卡牌 / 休闲 / 竞技等全品类，按玩法、画风、目标地区精准定位。"
    },
    {
      "q": "AI 匹配是怎么算契合度的？真的精准吗？",
      "a": "基于素材语义 + KOL 历史合作数据，由 aigcgateway 多模态分析。匹配建议附契合度分数，可逐条解释。"
    },
    {
      "q": "邮件 DKIM/SPF 配置需要技术成本吗？",
      "a": "不需要。平台提供一键配置引导，3 分钟完成合规部署，无需运维介入。"
    },
    {
      "q": "数据更新频率是多少？",
      "a": "邮件开信率 / 状态实时更新；播放 / 互动指标 T+1；受众画像每周更新。"
    },
    {
      "q": "试用账号权限范围？",
      "a": "可完整体验全部 6 大模块，支持真实数据筛选、AI 匹配演示、模板发送、数据复盘。"
    }
  ]
}
```

`messages/en.json`:

```json
"faq": {
  "sectionTitle": "Frequently asked",
  "items": [
    {
      "q": "Does the KOL library support genre-level filtering?",
      "a": "Yes — RPG, card, casual, competitive, and more. Filter by gameplay style, art style, and target region."
    },
    {
      "q": "How does AI matching score creator fit?",
      "a": "We combine semantic analysis of your brief with a creator's historical collaboration data via aigcgateway. Every recommendation comes with a fit score and a per-criterion explanation."
    },
    {
      "q": "Do DKIM/SPF settings require an engineer?",
      "a": "No. Our guided setup deploys compliant DNS records in under 3 minutes, no DevOps needed."
    },
    {
      "q": "How fresh is the data?",
      "a": "Email opens and statuses are real-time. Plays and engagement metrics update T+1. Audience profiles refresh weekly."
    },
    {
      "q": "What does the trial account include?",
      "a": "Full access to all six modules — real data filtering, AI matching, template sending, and analytics."
    }
  ]
}
```

- [ ] **Step 2: Implement the component**

Replace `src/app/[locale]/(marketing)/_components/FAQ.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

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
      className="bg-surface-container-lowest px-6 py-24 lg:px-12"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <ul className="mt-12 space-y-3">
          {items.map((item, idx) => (
            <li
              key={item.q}
              className="overflow-hidden rounded-2xl border border-cyan/15 bg-surface-container"
            >
              <details
                data-testid={`landing-faq-item-${idx}`}
                className="group"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-sm font-semibold text-white transition hover:bg-cyan/5">
                  <span>{item.q}</span>
                  <span
                    className="text-cyan transition group-open:rotate-45"
                    aria-hidden="true"
                  >
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
    </section>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/\(marketing\)/_components/FAQ.tsx messages/zh.json messages/en.json
git commit -m "feat(landing): FAQ section (5 native <details>)

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.6"
```

---

### Task 12: FooterCTA section

Centered final CTA + footer line. Reuses Hero's `ctaPrimary`/`ctaSecondary` link targets.

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/FooterCTA.tsx`
- Modify: `messages/zh.json` (landing.footerCta)
- Modify: `messages/en.json` (landing.footerCta)

- [ ] **Step 1: Populate i18n**

`messages/zh.json` — replace `"footerCta": {}`:

```json
"footerCta": {
  "sectionTitle": "立即开启全球游戏 KOL 高效投放",
  "ctaPrimary": "申请试用",
  "ctaSecondary": "预约 1v1 演示",
  "footerLine": "© 2026 KolMatrix · 全球游戏 KOL 营销 SaaS",
  "links": {
    "privacy": "隐私政策",
    "terms": "服务条款"
  }
}
```

`messages/en.json`:

```json
"footerCta": {
  "sectionTitle": "Start running smarter KOL campaigns today",
  "ctaPrimary": "Request a trial",
  "ctaSecondary": "Book a 1:1 demo",
  "footerLine": "© 2026 KolMatrix · Global Game KOL Marketing SaaS",
  "links": {
    "privacy": "Privacy",
    "terms": "Terms"
  }
}
```

- [ ] **Step 2: Implement the component**

Replace `src/app/[locale]/(marketing)/_components/FooterCTA.tsx`:

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface Props {
  locale: string;
}

export async function FooterCTA({ locale }: Props) {
  const t = await getTranslations("landing.footerCta");

  return (
    <section
      data-testid="landing-footer-cta"
      className="relative overflow-hidden bg-surface px-6 py-24 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" />
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
          {t("sectionTitle")}
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/${locale}/request-access`}
            className="inline-flex items-center gap-2 rounded-full bg-cyan px-8 py-3 text-sm font-semibold text-surface shadow-[0_0_20px_rgba(0,229,255,0.4)] transition hover:bg-cyan/90"
            data-testid="landing-footer-cta-primary"
          >
            {t("ctaPrimary")} →
          </Link>
          <Link
            href={`/${locale}/request-access?demo=1`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan/40 px-8 py-3 text-sm font-semibold text-cyan transition hover:bg-cyan/10"
            data-testid="landing-footer-cta-secondary"
          >
            {t("ctaSecondary")}
          </Link>
        </div>
        <div className="mt-16 text-xs text-on-surface-variant">
          <p>{t("footerLine")}</p>
          <p className="mt-2 flex justify-center gap-4">
            {/* Privacy / Terms routes don't yet exist — use # so we don't ship dead links */}
            <a href="#" className="cursor-default opacity-50">
              {t("links.privacy")}
            </a>
            <span aria-hidden="true">·</span>
            <a href="#" className="cursor-default opacity-50">
              {t("links.terms")}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/\(marketing\)/_components/FooterCTA.tsx messages/zh.json messages/en.json
git commit -m "feat(landing): FooterCTA section + page composition complete

All 7 sections now live; Stage 2 done.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.7"
```

---

## Stage 3 — Screenshots & Live Data (Tasks 13-14)

### Task 13: Playwright screenshot capture script

One-off script: log into staging, screenshot 6 module pages + 3 component locator crops into `public/landing/screenshots/`.

**Files:**
- Create: `scripts/capture-landing-screenshots.ts`
- Modify: `package.json` (add npm script)

- [ ] **Step 1: Add npm script**

In `package.json`, find the `"scripts"` object and add:

```json
"landing:capture": "tsx scripts/capture-landing-screenshots.ts"
```

(Alphabetical insertion is fine; the engineer should place it near the other `seed:` / `import:` scripts.)

- [ ] **Step 2: Create the capture script**

Create `scripts/capture-landing-screenshots.ts`:

```typescript
/**
 * 2026-05-19 landing page · One-off Playwright screenshot script.
 *
 * Logs into staging (or a configurable target) using the seeded
 * admin account, then writes 6 module full-page screenshots + 3
 * locator-scoped component crops into public/landing/screenshots/.
 *
 * Run manually:
 *   STAGING_URL=https://staging.kolmatrix.com \
 *   STAGING_EMAIL=admin@kolmatrix.local \
 *   STAGING_PASSWORD=Kolmatrix@2026 \
 *   npm run landing:capture
 *
 * Defaults work for local dev (`npm run dev`).
 */
import { mkdir } from "fs/promises";
import { resolve } from "path";

import { chromium, type Page } from "@playwright/test";

const TARGET_URL = process.env.STAGING_URL ?? "http://localhost:3000";
const EMAIL = process.env.STAGING_EMAIL ?? "admin@kolmatrix.local";
const PASSWORD = process.env.STAGING_PASSWORD ?? "Kolmatrix@2026";
const OUT_DIR = resolve(process.cwd(), "public/landing/screenshots");
const VIEWPORT = { width: 1440, height: 900 };

async function login(page: Page): Promise<void> {
  await page.goto(`${TARGET_URL}/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(zh|en)\/insight/, { timeout: 15000 });
}

async function capture(
  page: Page,
  pathname: string,
  outName: string,
  options: { locator?: string } = {}
): Promise<void> {
  await page.goto(`${TARGET_URL}${pathname}`);
  await page.waitForLoadState("networkidle");
  const out = resolve(OUT_DIR, outName);
  if (options.locator) {
    await page.locator(options.locator).screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: false });
  }
  console.log(`✔ ${outName}`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();

  await login(page);

  await capture(page, "/zh/match", "match-full.png");
  await capture(page, "/zh/match", "match-ai-sidebar.png", {
    locator: '[data-testid="match-ai-sidebar"]',
  });
  await capture(page, "/zh/reach", "reach-full.png");
  await capture(page, "/zh/reach", "reach-domain-health.png", {
    locator: '[data-testid="outreach-domain-health"]',
  });
  await capture(page, "/zh/reach", "reach-recently-sent.png", {
    locator: '[data-testid="outreach-recently-sent"]',
  });
  await capture(page, "/zh/insight", "insight-full.png");
  await capture(page, "/zh/crm", "crm-full.png");
  await capture(page, "/zh/roi", "roi-full.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify the script's locator testids actually exist**

Run a grep on the codebase to confirm `match-ai-sidebar`, `outreach-domain-health`, `outreach-recently-sent` exist. If any are missing, the engineer should either add the testid to the corresponding component (small edit) or change the locator in the script to a stable existing testid.

```bash
grep -rE "data-testid=\"(match-ai-sidebar|outreach-domain-health|outreach-recently-sent)\"" src/
```

Expected: at least `outreach-domain-health` (DomainHealthCard) exists. If `match-ai-sidebar` is missing, add `data-testid="match-ai-sidebar"` to the root of `src/app/[locale]/(app)/match/AiSuggestionsSidebar.tsx`. Same pattern if `outreach-recently-sent` is missing — add to the root of `RecentlySentTable.tsx`.

- [ ] **Step 4: Run the script against local dev**

Start dev server in one terminal (`npm run dev`), then in another:

```bash
npm run landing:capture
```

Expected output: 8 `✔` lines. Inspect `public/landing/screenshots/*.png` — should show real product screenshots, not 1×1 placeholders.

- [ ] **Step 5: Commit (script + real screenshots together)**

```bash
git add scripts/capture-landing-screenshots.ts package.json public/landing/screenshots/
git commit -m "feat(landing): Playwright screenshot capture + bake initial set

scripts/capture-landing-screenshots.ts logs into a target URL and
writes 6 full-page + 3 locator-scoped screenshots into
public/landing/screenshots/. This commit also bakes in the initial
set captured against local dev; re-run when /reach /match /insight
UI changes.

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §7.3"
```

---

### Task 14: Hero KPI — real KOL count

Replaces the hard-coded `2500` in Hero with a server-side count rounded down to the nearest 500.

**Files:**
- Modify: `src/app/[locale]/(marketing)/_components/Hero.tsx`

- [ ] **Step 1: Find the existing KOL count query helper**

```bash
grep -rE "prisma\.kol\.count|prisma\.\w+\.count" src/lib/ | head -5
```

Note the pattern used elsewhere — usually `withTenant` wrapping for RLS. Marketing page is unauthenticated and we want the *total* count across tenants, so use the raw Prisma client (no `withTenant`).

- [ ] **Step 2: Update Hero to fetch and round the count**

In `src/app/[locale]/(marketing)/_components/Hero.tsx`, replace the line:

```typescript
const KOL_COUNT_DISPLAY = 2500;
```

with:

```typescript
import { prisma } from "@/lib/db";

function roundDownTo500(n: number): number {
  return Math.max(500, Math.floor(n / 500) * 500);
}
```

(Move the `import` to the top of the file with the other imports.)

Inside the `Hero` component, before the `return`, add:

```typescript
const kolCount = await prisma.kol.count();
const kolCountDisplay = roundDownTo500(kolCount);
```

Replace the existing KPI line `{t("kpis.kolLibrary", { count: KOL_COUNT_DISPLAY })}` with `{t("kpis.kolLibrary", { count: kolCountDisplay })}`.

- [ ] **Step 3: Verify model name**

```bash
grep -E "^model " prisma/schema.prisma | grep -i "kol"
```

If the model is named `Kol` (Prisma camelCases to `prisma.kol`), the code above is correct. If it's `KOL` or something else, adjust accordingly.

- [ ] **Step 4: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/\(marketing\)/_components/Hero.tsx
git commit -m "feat(landing): Hero KPI uses real KOL count (rounded down to 500)

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §6.1"
```

---

## Stage 4 — SEO, Tests, Polish (Tasks 15-18)

### Task 15: generateMetadata for landing page

Per-locale `<title>` / `<meta description>` / OG tags / hreflang.

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Add `generateMetadata` to page.tsx**

Open `src/app/[locale]/page.tsx`. Add this import at the top:

```typescript
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
```

Add this function above `LocalizedRootPage`:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  const url = `${baseUrl}/${locale}`;
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url,
      images: [{ url: "/landing/og-image.png", width: 1200, height: 630 }],
      locale,
    },
    twitter: { card: "summary_large_image" },
    alternates: {
      canonical: url,
      languages: {
        zh: `${baseUrl}/zh`,
        en: `${baseUrl}/en`,
      },
    },
  };
}
```

- [ ] **Step 2: Verify + commit**

```bash
npm run typecheck && npm run test:e2e -- tests/e2e/landing.spec.ts
git add src/app/[locale]/page.tsx
git commit -m "feat(landing): generateMetadata for SEO (title/description/OG/hreflang)

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §11.1"
```

---

### Task 16: sitemap.ts + robots.ts

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`

- [ ] **Step 1: Create sitemap.ts**

Create `src/app/sitemap.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  return [
    {
      url: `${base}/zh`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: { languages: { en: `${base}/en` } },
    },
    {
      url: `${base}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
      alternates: { languages: { zh: `${base}/zh` } },
    },
    {
      url: `${base}/zh/request-access`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/en/request-access`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
```

- [ ] **Step 2: Create robots.ts**

Create `src/app/robots.ts`:

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/zh/request-access", "/en/request-access"],
      disallow: [
        "/insight",
        "/match",
        "/reach",
        "/crm",
        "/brief",
        "/campaigns",
        "/roi",
        "/assets",
        "/admin",
        "/api",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Visit `http://localhost:3000/sitemap.xml` and `http://localhost:3000/robots.txt` — both should render correctly.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts
git commit -m "feat(landing): sitemap.xml + robots.txt

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §11.3"
```

---

### Task 17: OG image (dynamic via next/og)

**Files:**
- Create: `src/app/[locale]/opengraph-image.tsx`

- [ ] **Step 1: Create the dynamic OG image route**

Create `src/app/[locale]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const runtime = "edge";
export const alt = "KolMatrix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function OpengraphImage({ params }: Props): Promise<ImageResponse> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1326 0%, #131b2e 100%)",
          color: "#dae2fd",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 24,
            color: "#9cf0ff",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          KolMatrix
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            maxWidth: "900px",
          }}
        >
          {t("meta.title")}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 24,
            color: "#bac9cc",
            maxWidth: "900px",
            lineHeight: 1.4,
          }}
        >
          {t("meta.description")}
        </div>
        <div
          style={{
            marginTop: 40,
            height: 4,
            width: 120,
            background: "#00E5FF",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 2: Verify the OG image renders**

```bash
npm run dev
```

Open `http://localhost:3000/zh/opengraph-image` — should return a PNG showing the title text on a dark gradient.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/opengraph-image.tsx
git commit -m "feat(landing): dynamic OG image via next/og

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §11.2"
```

---

### Task 18: CTA navigation e2e + visual regression baselines

Wraps up testing — adds the 4th e2e test (CTA navigation + wantsDemo checkbox) and 4 visual baselines.

**Files:**
- Modify: `tests/e2e/landing.spec.ts` (add CTA test)
- Modify: `tests/e2e/visual-regression.spec.ts` (add 4 toHaveScreenshot calls)
- Modify: `tests/unit/visual-baselines-shape.test.ts` (update EXPECTED_BASELINES)
- Create: `tests/screenshots/baseline/landing-zh-desktop.png` (via Playwright)
- Create: `tests/screenshots/baseline/landing-en-desktop.png`
- Create: `tests/screenshots/baseline/landing-zh-mobile.png`
- Create: `tests/screenshots/baseline/landing-en-mobile.png`

- [ ] **Step 1: Append CTA navigation test to landing.spec.ts**

In `tests/e2e/landing.spec.ts`, after the existing `test.describe("Anonymous root path", ...)` block, append:

```typescript
test.describe("Landing CTAs", () => {
  test("Hero primary CTA goes to /request-access", async ({ page }) => {
    await page.goto("/zh");
    await page.getByTestId("landing-cta-primary").click();
    await expect(page).toHaveURL(/\/zh\/request-access$/);
  });

  test("Hero secondary CTA goes to /request-access?demo=1 with wantsDemo pre-checked", async ({ page }) => {
    await page.goto("/zh");
    await page.getByTestId("landing-cta-secondary").click();
    await expect(page).toHaveURL(/\/zh\/request-access\?demo=1$/);
    await expect(page.getByTestId("request-access-wants-demo")).toBeChecked();
  });
});
```

- [ ] **Step 2: Run the new tests — they should pass**

```bash
npm run test:e2e -- tests/e2e/landing.spec.ts
```

Expected: 5 passing tests (3 from Task 4 + 2 new).

- [ ] **Step 3: Add visual regression tests for the 4 new baselines**

In `tests/e2e/visual-regression.spec.ts`, add 4 new test blocks (follow the existing patterns at the end of the file; locate the section that visits `/en/login` and `/en/request-access` for context):

```typescript
test("landing-zh-desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/zh");
  await page.getByTestId("landing-hero").waitFor();
  await expect(page).toHaveScreenshot("landing-zh-desktop.png", { fullPage: true });
});

test("landing-en-desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  await page.getByTestId("landing-hero").waitFor();
  await expect(page).toHaveScreenshot("landing-en-desktop.png", { fullPage: true });
});

test("landing-zh-mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh");
  await page.getByTestId("landing-hero").waitFor();
  await expect(page).toHaveScreenshot("landing-zh-mobile.png", { fullPage: true });
});

test("landing-en-mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/en");
  await page.getByTestId("landing-hero").waitFor();
  await expect(page).toHaveScreenshot("landing-en-mobile.png", { fullPage: true });
});
```

- [ ] **Step 4: Update EXPECTED_BASELINES in the unit test**

In `tests/unit/visual-baselines-shape.test.ts`, find the `EXPECTED_BASELINES` array and add 4 entries (alphabetical insertion):

```typescript
  { name: "landing-en-desktop.png", width: 1280 },
  { name: "landing-en-mobile.png", width: 375 },
  { name: "landing-zh-desktop.png", width: 1280 },
  { name: "landing-zh-mobile.png", width: 375 },
```

- [ ] **Step 5: Generate the baseline screenshots**

```bash
npm run test:e2e -- tests/e2e/visual-regression.spec.ts --update-snapshots --grep "landing-"
```

This populates `tests/screenshots/baseline/landing-*.png` with the 4 new files. Playwright will mark these tests as passing because they're being updated.

- [ ] **Step 6: Re-run all tests to verify everything is green**

```bash
npm run test && npm run test:e2e -- tests/e2e/landing.spec.ts tests/e2e/visual-regression.spec.ts --grep "landing-"
```

Expected: all unit tests pass; all 5 landing e2e tests pass; 4 visual regression tests pass.

- [ ] **Step 7: Run lint + typecheck**

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/landing.spec.ts tests/e2e/visual-regression.spec.ts tests/unit/visual-baselines-shape.test.ts tests/screenshots/baseline/
git commit -m "test(landing): CTA navigation e2e + 4 visual regression baselines

Spec: docs/superpowers/specs/2026-05-19-landing-page-design.md §10"
```

---

## Final Verification

Before declaring the feature done, run the full test suite end-to-end:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

Expected: 0 errors across the board.

Then start the dev server and manually walk the spec's §12.1 acceptance checklist (anonymous root → landing; authenticated root → /insight; 7 sections visible at desktop and mobile; CTAs route correctly; wantsDemo prefill works; submitting a form with wantsDemo=true persists to the DB).

```bash
npm run dev
```

If everything passes, ask the user whether to push to `main` (per project convention, all code commits go to `main`; user manually triggers deployment afterwards).

---

## Out of Scope (deferred to follow-up work)

The following items are in the spec's §14 but explicitly not in this plan:

- DNS / Vercel / Nginx / SSL for `kol.guangai.ai`
- UTM tracking + conversion funnel analytics
- AB testing infrastructure
- Cal.com / Calendly integration to replace `?demo=1` placeholder
- Real customer logos / testimonials
- ja / ko / es language additions
- CMS-ifying the copy
- Privacy / Terms page routes

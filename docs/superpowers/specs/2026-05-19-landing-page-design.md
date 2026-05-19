# KolMatrix 官网落地页 — Design Spec

> **状态**：草案待 review
> **日期**：2026-05-19
> **类型**：独立任务（非 features.json 批次）
> **来源需求**：飞书 wiki（Spec A 全流程定位 + Spec B 邮件协作定位，本 spec 合并两者）

---

## 1. 背景与目标

KolMatrix 是面向全球游戏工作室的 KOL 营销 SaaS。产品现已具备 7+ 业务模块（KOL 库 / AI 匹配 / 数据分析 / 邮件协作 / CRM / ROI / Brief 等），但当前根路径 `/` 无论 auth 状态都直接 redirect 到 `/insight`（未登录再被弹去 `/login`），**没有任何公开营销页面**。

本批次产出一个测试期吸量/转化用的落地页，部署后面向：

- 游戏工作室创始人 / 市场负责人
- 出海游戏发行商
- 游戏 KOL 营销 agency 负责人

主投放渠道：LinkedIn / Google Ads / Reddit r/gaming / Bilibili 游戏出海社群。

**目标域名**：`https://kol.guangai.ai`（DNS / 部署配置在本 spec 范围外）。

---

## 2. 范围（Scope）

### IN

- 新增匿名可见落地页，挂在 `/{locale}/` 根路径
- 语言：zh + en（与产品现有运行期 allowlist 对齐）
- 7 个 section：Hero / PainPoints / Features / Demo / Trust（占位）/ FAQ / FooterCTA
- 主 CTA「申请试用」与副 CTA「预约 1v1 演示」全部复用 `/request-access` flow
- `RequestAccessForm` 扩展：新增 `wantsDemo` 字段（checkbox + DB 列）
- 中间件 `/` 路径分流：已登录 → /insight，未登录 → 落地页
- 截图管线：一次性 Playwright 脚本截 `/match`、`/reach`、`/insight` 真实页面到 `public/landing/`
- SEO：metadata / og-image / sitemap / robots
- 测试：Playwright E2E 4 条 + 视觉 baseline + middleware 单测

### OUT

- 5 语言全覆盖（ja/ko/es 后续追加）
- AB 测试 / 多变体 hero（投放数据回流后再决定）
- 独立子域部署 / DNS / CDN 配置
- Sales 后台（access_request 列表已有 `/admin` 入口，本批次不动）
- Cal.com / Calendly 接入（副 CTA 当前用 `?demo=1` query 兜底）
- 真实客户证言 / IP logo 墙（产品方有真实合作后再补，本批次留占位）
- 邮件营销自动化（投放回流后再说）

---

## 3. 已 lock 的关键决策

| 决策点 | 选项 | 理由 |
|---|---|---|
| 定位方向 | Spec A + Spec B 合并：全流程 + AI 匹配 + 邮件合规三主线 | 产品实际是多模块平台，单一邮件定位会浪费 AI 能力卖点 |
| 页面位置 | 根路径 `/`，中间件分流 | 标准 SaaS 实践，SEO 友好，不需新建子域 |
| i18n 范围 | zh + en | 覆盖国内出海 + 海外 LinkedIn/Google Ads 主流量；ja/ko/es 后续 |
| 主 CTA 接入 | 跳 `/request-access` | 复用 form + actions + AccessRequest 表 + success 页，0 新表单代码 |
| 副 CTA 接入 | `/request-access?demo=1` + form 加 `wantsDemo` checkbox | 复用一套 form，sales 按勾选优先回拨，不暴露邮箱给爬虫 |
| 演示素材 | Playwright 自动截 `/reach` `/match` `/insight` 真实页面 | 可重复生成、不需设计师、reflects 真实 UI |
| 营销数字 | DKIM/SPF/DMARC + 98 信誉分 = 真实可上；"1000+ 模板" 改为定性描述；"开信率 +300%" 保留为市场口号；客户证言留占位（不放虚假）| 平衡 SEO 关键词覆盖 vs 投放渠道侧人员的可信度判断 |
| 实现路径 | Path C 渐进版（5+1 section + 信任占位） | 兼顾上线速度（2-3 天）与企业级感，不留虚假内容 |

---

## 4. 文件布局

```
src/
├── middleware.ts                              # MODIFY: / 路径根据 auth 分流
├── middleware-helpers.ts                      # MODIFY: 提取 resolveAuthAwareRoot()
├── app/[locale]/
│   ├── page.tsx                               # REWRITE: server-side auth check + 渲染 <LandingPage>
│   ├── layout.tsx                             # （不动，i18n provider 复用）
│   └── (marketing)/
│       └── _components/
│           ├── LandingPage.tsx                # 入口，组合 7 sections
│           ├── Hero.tsx
│           ├── PainPoints.tsx
│           ├── Features.tsx
│           ├── EmailCenterDemo.tsx            # demo section（3 张大图 + 流程注释）
│           ├── TrustPlaceholder.tsx
│           ├── FAQ.tsx
│           └── FooterCTA.tsx
├── components/auth/
│   └── RequestAccessForm.tsx                  # MODIFY: 加 wantsDemo checkbox + useSearchParams 预勾选
├── app/[locale]/request-access/
│   └── actions.ts                             # MODIFY: zod schema 加 wantsDemo
├── app/sitemap.ts                             # NEW (若不存在): 列出 /zh /en + /zh/request-access /en/request-access
├── app/robots.ts                              # NEW (若不存在): allow all + sitemap pointer
prisma/
├── schema.prisma                              # MODIFY: AccessRequest 加 wantsDemo Boolean
└── migrations/                                # 新 migration
public/landing/
├── screenshots/
│   ├── match-full.png                         # /match 整页
│   ├── match-ai-sidebar.png                   # AiSuggestionsSidebar 局部
│   ├── reach-full.png                         # /reach 整页
│   ├── reach-domain-health.png                # DomainHealthCard 局部
│   ├── reach-recently-sent.png                # RecentlySentTable 局部
│   └── insight-full.png                       # /insight 整页
└── og-image.png                               # 1200×630 social preview
messages/
├── zh.json                                    # ADD: landing namespace
└── en.json                                    # ADD: landing namespace
scripts/
└── capture-landing-screenshots.ts             # NEW: 一次性 Playwright 截图脚本
tests/e2e/
└── landing-page.spec.ts                       # NEW: 4 条 E2E
```

---

## 5. 路由与中间件改动

### 5.1 当前行为（待改）

`src/middleware.ts` 行 51-54：
```typescript
if (pathname === "/") {
  const locale = resolveTargetLocale(req);
  return NextResponse.redirect(new URL(`/${locale}/insight`, nextUrl));
}
```
不论 auth 状态都 redirect 到 `/insight`，未登录用户再被 PROTECTED_PREFIXES 检查弹去 `/login`（2 跳）。

`src/app/[locale]/page.tsx`：无条件 `redirect(\`/${locale}/insight\`)`。

### 5.2 新行为

**`src/middleware.ts`** 处理 `/`：
```typescript
if (pathname === "/") {
  const locale = resolveTargetLocale(req);
  if (req.auth) {
    return NextResponse.redirect(new URL(`/${locale}/insight`, nextUrl));
  }
  // 匿名 → 落地页（/{locale}/）
  return NextResponse.redirect(new URL(`/${locale}/`, nextUrl));
}
```

**`src/app/[locale]/page.tsx`** 改写：
```typescript
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "./(marketing)/_components/LandingPage";

export default async function LocalizedRootPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}/insight`);
  }
  return <LandingPage locale={locale} />;
}
```

### 5.3 边界情况

- **auth lookup 失败**：middleware 包 try/catch，异常时按"未登录"处理，落到落地页（避免 session 故障锁住所有用户）
- **`/` 无 locale 前缀 + 已登录**：middleware 直接 redirect 到 `/{userLocale}/insight`
- **`/zh` `/en` 路径**：交给 `page.tsx` 服务端 auth check，无 session 渲染落地页
- **`/ja` `/ko` `/es` 路径**：next-intl 已 clamp 到 en/zh allowlist，直接落到 en 落地页

---

## 6. 页面 section 结构与内容

每个 section 是独立的 server component，无 client state，文案完全走 `next-intl` `landing.<section>` namespace。

### 6.1 Hero（above-fold）

- **主标题**（H1）：「全球游戏 KOL 营销指挥中心」（zh）/「Global Game KOL Marketing Command Center」（en）
- **副标题**：「AI 智能匹配 · 全流程协作 · 邮件合规一站搞定 — 让游戏出海 KOL 投放效率提升 10 倍」
- **KPI strip**（4 项）：
  - 🎮 KOL 库规模数字：generator 实现时跑 `select count(*) from "Kol"` 取整数下界四舍五入到 500（如实际 2870 → 显示 "2500+"，实际 1230 → 显示 "1000+"）。不阻塞 ship — 任何情况都给出一个数字
  - 🌐 4 大平台覆盖（YT / TikTok / Twitch / Bili）
  - 🤖 AI 智能匹配（紫色 #9D50FF accent）
  - ✉️ DKIM/SPF 合规 + 98% 信誉分（青色 #00E5FF accent）
- **CTA**：
  - 主 CTA「立即申请试用」→ `/{locale}/request-access`
  - 副 CTA「预约 1v1 演示」→ `/{locale}/request-access?demo=1`
- **视觉**：右侧上下双截图拼贴 — `match-ai-sidebar.png` 在上，`reach-domain-health.png` 在下；移动端折叠到下方
- **i18n keys**：`landing.hero.kicker`, `.title`, `.subtitle`, `.kpis.kolLibrary`, `.kpis.platforms`, `.kpis.aiMatch`, `.kpis.compliance`, `.cta.primary`, `.cta.secondary`

### 6.2 Pain Points

4 条横排（移动端 2×2 grid），来自合并两份 spec：

| # | 痛点 | i18n key |
|---|---|---|
| 1 | 跨平台找游戏 KOL 慢、筛选散、数据不准 | `landing.painPoints.find` |
| 2 | 受众分析模糊、匹配不精准、ROI 不可控 | `landing.painPoints.match` |
| 3 | 邮件送达率低、开信率为 0，不知合规还是内容问题 | `landing.painPoints.email` |
| 4 | 全流程割裂、合规风险高、合作进度全靠人工 | `landing.painPoints.workflow` |

底部一句话承诺：「找达人 → AI 匹配 → 发起合作 → 邮件协作 → 数据复盘，一站搞定」

### 6.3 Features（6 模块）

3 列 × 2 行 grid（移动端 1 列）。每个 card：图标 + 标题 + 一句描述 + 缩略截图 + （可选）链接到产品对应路由。

| # | 模块 | 对应路由 | 截图 | accent 色 |
|---|---|---|---|---|
| ① | 游戏垂类 KOL 库 | `/match` | `match-full.png` (裁剪左侧 sidebar) | 默认 cyan |
| ② | AI 智能匹配 | `/match` AiSidebar | `match-ai-sidebar.png` | **紫色 #9D50FF** |
| ③ | 多平台数据分析 | `/insight` | `insight-full.png` | 默认 cyan |
| ④ | 邮件协作 & 合规中心 | `/reach` | `reach-domain-health.png` + `reach-recently-sent.png` 拼贴 | **强化 cyan #00E5FF** |
| ⑤ | KOL CRM 管理 | `/crm` | `crm-full.png` | 默认 cyan |
| ⑥ | 数据复盘 & ROI | `/roi` | `roi-full.png` | 默认 cyan |

截图脚本必须截全 6 个模块，无"如可截"豁免。若某路由报错或空数据，先填测试数据再截。

文案要求：每个模块描述 ≤ 25 字（zh）/ ≤ 12 词（en）。

### 6.4 Demo

3 张大图横排（移动端纵向堆叠）：`match-full.png` / `reach-full.png` / `insight-full.png`。

下方流程注释：① 找 KOL → ② AI 匹配 → ③ 发起合作 → ④ 邮件协作 → ⑤ 数据复盘。

### 6.5 Trust Placeholder

3 列等宽 card：

| 卡片 | 内容 |
|---|---|
| 🔒 企业级数据加密 | TLS 1.3 + Postgres RLS 多租户隔离 |
| ✉️ 邮件合规资质 | Resend SPF/DKIM/DMARC 全认证 |
| 🤝 合作伙伴洽谈中 | 头部出海发行商接洽中（不放具体 IP logo） |

**严禁**：放 PUBG / Honor of Kings / Genshin 等真实游戏 IP logo（未授权风险），不放虚假客户证言。

### 6.6 FAQ

5 条可折叠（HTML `<details>`，无 JS）：

| Q | A 要点 |
|---|---|
| 支持游戏细分品类筛选吗？ | RPG/卡牌/休闲/竞技全品类，按玩法/画风/地区精准定位 |
| AI 匹配是怎么算契合度的？真的精准吗？ | 基于素材语义 + KOL 历史合作数据，由 aigcgateway 多模态分析 |
| 邮件 DKIM/SPF 配置需要技术成本吗？ | 平台一键配置引导，3 分钟完成合规部署 |
| 数据更新频率是多少？ | 开信率/状态实时；播放/互动 T+1 |
| 试用账号权限范围？ | 完整体验全功能，支持真实数据筛选与流程演示 |

### 6.7 Footer CTA

居中布局：

- H2「立即开启全球游戏 KOL 高效投放」
- 主 CTA「申请试用」+ 副 CTA「预约 1v1 演示」（与 Hero 同链接）
- Footer 行：© KolMatrix 2026 · 全球游戏 KOL 营销 SaaS · 隐私政策 · 服务条款

隐私/条款链接：generator 实现时检查 `/privacy` `/terms` 是否存在。**v1 一律用 `#` 占位**，不进 `<a>`（避免出现死链或 404）。产品方补好后追加一个微改动 PR 改成真实链接 — 不在本 spec 范围。

---

## 7. 数据流

### 7.1 页面渲染

```
浏览器 → /
  middleware.ts
    ├─ req.auth 存在 → redirect /{userLocale}/insight  → AppShell
    └─ req.auth 不存在 → redirect /{locale}/             ↓
                                                      page.tsx (server)
                                                        ├─ auth() 再次兜底
                                                        │   └─ 有 session → redirect /insight
                                                        └─ 无 session → <LandingPage locale={locale} />
                                                                          ├─ next-intl loads messages
                                                                          ├─ 各 section 渲染（纯 JSX）
                                                                          └─ next/image 加载 public/landing/*
```

### 7.2 CTA 行为

```
点 hero 主 CTA  → <Link href="/zh/request-access">
点 hero 副 CTA  → <Link href="/zh/request-access?demo=1">
  RequestAccessForm 渲染
    ├─ useSearchParams 读 demo=1
    └─ wantsDemo checkbox 默认 checked
  用户填表 → submitAccessRequest server action
    ├─ zod 加 wantsDemo: z.boolean().optional()
    └─ prisma upsert AccessRequest (含 wantsDemo)
  → redirect /zh/request-access/success
```

### 7.3 截图管线（一次性 + 按需重跑）

```
scripts/capture-landing-screenshots.ts
  ├─ Playwright launch chromium { viewport: 1440×900 }
  ├─ goto staging-url/zh/login
  ├─ fill admin@kolmatrix.local / Kolmatrix@2026
  ├─ 逐页截图:
  │   ├─ /match     → match-full.png   + locator(AiSuggestionsSidebar).screenshot → match-ai-sidebar.png
  │   ├─ /reach     → reach-full.png   + locator(DomainHealthCard).screenshot     → reach-domain-health.png
  │   │                                + locator(RecentlySentTable).screenshot    → reach-recently-sent.png
  │   ├─ /insight   → insight-full.png
  │   ├─ /crm       → crm-full.png
  │   └─ /roi       → roi-full.png
  └─ 写入 public/landing/screenshots/
```

由 generator 在实现 batch 中跑一次；UI 变化时人工触发重跑（不进 CI，避免每次 build 跑 Playwright）。

---

## 8. RequestAccessForm 扩展

### 8.1 Schema 改动

`prisma/schema.prisma`：

```prisma
model AccessRequest {
  // ... existing fields ...
  wantsDemo  Boolean  @default(false)
  // ... rest ...
}
```

新 migration：`prisma/migrations/<timestamp>_add_wants_demo_to_access_request/migration.sql`

### 8.2 Zod schema 改动

`src/app/[locale]/request-access/actions.ts`：

```typescript
const AccessRequestSchema = z.object({
  // ... existing fields ...
  wantsDemo: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});
```

写入 prisma upsert 时一并传入。

### 8.3 Form UI

`src/components/auth/RequestAccessForm.tsx` 在 ToS checkbox 上方追加：

```tsx
const params = useSearchParams();
const wantsDemoDefault = params.get("demo") === "1";

<label className="flex items-start gap-2 text-sm">
  <input
    type="checkbox"
    name="wantsDemo"
    defaultChecked={wantsDemoDefault}
    className="mt-1"
  />
  <span>{t("wantsDemoLabel")}</span>
</label>
```

i18n key 加 `auth.requestAccess.wantsDemoLabel`（zh/en 两份）。

---

## 9. 错误处理

| 故障 | 处理 |
|---|---|
| LandingPage 渲染异常（缺 i18n key） | next-intl 抛错 → Next error boundary 显示通用错误页。zh/en messages 上线前必须 100% 对齐 |
| 截图文件缺失 | `next/image` 找不到文件时 Next.js build 失败 → CI 拦截 |
| middleware auth lookup 异常 | try/catch 包裹，按"未登录"处理（fail-safe to landing） |
| `/request-access` 已有错误处理 | wantsDemo 加入不破坏（zod optional + 默认 false） |
| Database migration 失败 | 新列 wantsDemo 有 default，不会 break 现有 row。回滚直接 drop column |

---

## 10. 测试策略

### 10.1 E2E (Playwright) — `tests/e2e/landing-page.spec.ts`

| # | 场景 | 断言 |
|---|---|---|
| 1 | 匿名访问 `/zh` | 200 + 看到 hero H1 + 7 个 section 全部 visible（用 testid 定位） |
| 2 | 匿名访问 `/en` | 200 + hero 英文 H1 + 6 features visible |
| 3 | 已登录访问 `/zh` | 自动 redirect 到 `/zh/insight` |
| 4 | 点 hero 主/副 CTA | 主 → `/zh/request-access`；副 → `/zh/request-access?demo=1` 且 wantsDemo checkbox.checked === true |

### 10.2 视觉回归 baseline

项目已有 Playwright visual baseline 机制（BL-064-F006 / playwright/.cache/ 路径）。新增 4 个 baseline 截图：
- `landing-zh-desktop.png`（1440×900）
- `landing-zh-mobile.png`（375×812）
- `landing-en-desktop.png`
- `landing-en-mobile.png`

若发现项目截图机制与本 spec 路径不一致，generator 应沿用既有机制（不另起新机制），仅调整文件名。

### 10.3 Unit

`tests/unit/middleware-helpers.test.ts`：新增 `resolveAuthAwareRoot()` 单测，覆盖：
- session 存在 → 返回 `/{locale}/insight`
- session 不存在 → 返回 `/{locale}/`
- auth() 抛错 → 返回 `/{locale}/`

### 10.4 类型 / lint

`npx tsc --noEmit` + `npm run lint`，必须 0 错。CI 已有 workflow 拦截。

---

## 11. SEO & metadata

### 11.1 `<metadata>` export

Next.js 的 `metadata.title` 是字符串，不直接支持 per-locale 对象。用 `generateMetadata` 异步函数按 locale 返回不同 title/description：

```typescript
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  return {
    title: t("title"),                     // landing.meta.title
    description: t("description"),         // landing.meta.description
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `${baseUrl}/${locale}`,
      images: [{ url: "/landing/og-image.png", width: 1200, height: 630 }],
      locale,
    },
    twitter: { card: "summary_large_image" },
    alternates: {
      canonical: `${baseUrl}/${locale}`,
      languages: { zh: `${baseUrl}/zh`, en: `${baseUrl}/en` },
    },
  };
}
```

### 11.2 OG image

`public/landing/og-image.png` 1200×630。**v1 实现方式**：使用 `next/og` (Edge runtime) 的 `ImageResponse` 在新增的 `src/app/[locale]/opengraph-image.tsx` 路由里动态生成，避免手工出图。模板：navy gradient + KolMatrix 字标 + 主标题 + 青色 accent line。

若 `next/og` 在项目当前依赖不可用，回退到一张静态 PNG 占位（generator 用 ImageMagick / sharp 脚本一次性渲染，写入 `public/landing/og-image.png`）。两种路径都不依赖外部设计师，generator 可自洽完成。

### 11.3 sitemap & robots

`src/app/sitemap.ts`（新增）：

```typescript
export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  return [
    { url: `${base}/zh`, alternates: { languages: { en: `${base}/en` } } },
    { url: `${base}/en`, alternates: { languages: { zh: `${base}/zh` } } },
    { url: `${base}/zh/request-access` },
    { url: `${base}/en/request-access` },
  ];
}
```

`src/app/robots.ts`（新增）：

```typescript
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/insight", "/match", "/reach", "/crm", "/admin"] },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai"}/sitemap.xml`,
  };
}
```

### 11.4 结构化数据

第一版不加。v2 投放数据回流后再决定是否加 `Organization` / `Product` JSON-LD。

---

## 12. 验收标准

### 12.1 功能

- [ ] 匿名访问 `/` → 在 zh/en 任一语言下渲染落地页（无 redirect loop）
- [ ] 已登录访问 `/` → 自动 redirect 到 `/{locale}/insight`
- [ ] 7 个 section 在桌面和移动端均正确渲染
- [ ] 主 CTA → `/request-access`；副 CTA → `/request-access?demo=1` 且 wantsDemo checkbox 已勾选
- [ ] 提交带 `wantsDemo=true` 的表单 → AccessRequest 行的 wantsDemo 字段为 true
- [ ] Playwright 截图脚本可重复运行 → 输出 6 个 PNG 到 `public/landing/screenshots/`
- [ ] zh + en i18n key 100% 对齐（缺 key 时 next-intl 报错）

### 12.2 视觉

- [ ] 整页色调与 `design-draft/design-system.md` Neural Velocity 一致（深色 navy + 青色 + 紫色）
- [ ] Hero 在 1440 桌面下首屏完整可见（H1 + 副标题 + KPI + 双 CTA + 截图）
- [ ] 移动端 375 视口无横向滚动，按钮 ≥ 44px 触摸区
- [ ] 4 个 visual baseline 截图通过

### 12.3 性能 / SEO

- [ ] Lighthouse 桌面性能 ≥ 90，可达性 ≥ 95，SEO = 100
- [ ] LCP < 2.5s（hero 截图用 `next/image priority`）
- [ ] sitemap.xml 可访问，包含 zh/en 落地页 + request-access
- [ ] og-image preview 在 OpenGraph debugger 通过
- [ ] hreflang 标签存在且正确

### 12.4 其他

- [ ] `npx tsc --noEmit` 0 错
- [ ] `npm run lint` 0 错
- [ ] 所有 E2E 测试通过

---

## 13. 实施分阶建议（供 writing-plans 参考）

为给后续 plan 一个起点，建议 4 个相对独立的实施阶段：

1. **Stage 1 — 基础设施**：middleware + page.tsx 改造 + (marketing) route group 骨架 + 空 LandingPage 渲染 + landing namespace 占位
2. **Stage 2 — 内容 sections**：7 个 section 组件全部写完，文案用 i18n key，截图先用占位图
3. **Stage 3 — 截图管线 + form 扩展**：Playwright capture 脚本 + wantsDemo prisma migrate + RequestAccessForm UI
4. **Stage 4 — SEO + 测试**：metadata / sitemap / robots / og-image + E2E 4 条 + visual baseline + unit test

writing-plans 会进一步拆 task。

---

## 14. 不在本 spec 范围（后续工作）

- 子域 `kol.guangai.ai` 的 DNS / Vercel/Nginx / SSL 配置
- 投放 UTM 埋点 + 转化漏斗分析（GA4 / 自研）
- AB 测试基础设施
- Cal.com / Calendly 接入替换 `?demo=1` 兜底
- 内容 CMS 化（让 marketing 团队自助改文案）
- 真实客户 logo / 证言获取（产品方业务侧）
- ja / ko / es 三语扩展
- 落地页 v2：投放数据回流后的迭代（hero 文案 AB / section 增删）

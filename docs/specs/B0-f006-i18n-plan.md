# B0 F006 · next-intl 国际化规划稿

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-19
> **触发：** F006 开工前审计（最后一个 B0 feature），按 "pre-impl 审计 → Planner 裁决" 工作范式
> **状态：** 等待 Planner 明确回复，**未收到前不开工**

---

## 1. 背景 & 目标

F006 acceptance（`docs/specs/B0-foundation-spec.md` §4）：

- `/[locale]/dashboard` 路由结构生效
- `messages/{en,zh,ja,ko,es}.json` 完整文件，EN 全翻译，其他占位
- Topbar EN 切换器点 ZH 后 Sidebar 8 项文案变 ZH
- 缺 key fallback EN 不报错
- `user.locale` 持久化到 cookie

**技术栈锁定**：Next.js 16.2.4 + NextAuth v5 beta.31 + next-intl 4.9.1（已在 package.json）

本规划稿提交 **8 条决议请求** + **路由 migration 清单** + **middleware 组合代码骨架** + **messages 草案** 供裁决。

---

## 2. 路由 migration 清单

### 2.1 当前结构
```
src/app/
├── page.tsx                  # 根路由（redirect 到 /login）
├── layout.tsx                # root html lang="en" 硬编码
├── login/                    # 未认证可访问
│   ├── page.tsx
│   ├── login-form.tsx
│   └── actions.ts
├── (app)/                    # 认证 route group
│   ├── layout.tsx            # auth guard + AppShellLayout
│   └── dashboard/page.tsx
└── api/auth/[...nextauth]/route.ts
```

### 2.2 F006 后预期结构
```
src/app/
├── page.tsx                  # 保留，redirect /{defaultLocale}/dashboard
├── layout.tsx                # 保留，lang 通过 [locale] 层级注入
├── [locale]/                 # ← 新加
│   ├── layout.tsx            # 读 params.locale + NextIntlClientProvider
│   ├── login/                # ← login 位置决议 F1
│   │   └── ... (或保留根 src/app/login/)
│   └── (app)/                # ← mv from src/app/(app)/
│       ├── layout.tsx
│       └── dashboard/page.tsx
└── api/auth/[...nextauth]/route.ts   # 保留根，matcher 排除 /api
```

### 2.3 新建/修改/移动清单

| 操作 | 路径 | 目的 |
|---|---|---|
| **新建** | `src/i18n/routing.ts` | `defineRouting` 注册 5 语言 + defaultLocale + cookie 配置 |
| **新建** | `src/i18n/request.ts` | `getRequestConfig` 异步加载对应 messages |
| **新建** | `src/app/[locale]/layout.tsx` | `NextIntlClientProvider` + 注入 params.locale |
| **新建** | `messages/{en,zh,ja,ko,es}.json` | 5 份文案文件 |
| **移动** | `src/app/(app)/` → `src/app/[locale]/(app)/` | route group 嵌入 locale 段 |
| **移动 or 保留** | `src/app/login/` → `src/app/[locale]/login/` | 决议 F1 |
| **修改** | `next.config.ts` | 挂 `createNextIntlPlugin('./src/i18n/request.ts')` |
| **修改** | `src/middleware.ts` | 组合 next-intl middleware + NextAuth auth |
| **修改** | `src/auth.config.ts` | `authorized` callback 支持 `/{locale}/...` 保护路径 |
| **修改** | `src/app/layout.tsx` | 可能需要动态 lang 属性（或接受由 [locale]/layout 注入） |
| **修改** | `src/components/layout/SidebarNav.tsx` | 改用 `useTranslations('nav')` 替代硬编码 `item.label` |
| **修改** | `src/components/layout/LanguageSwitcher.tsx` | 从单按钮改为真实联动下拉菜单 |
| **修改** | `src/components/layout/TopbarSearch.tsx` | placeholder 走 messages |
| **修改** | `src/components/layout/UserAvatarMenu.tsx` | Profile / Settings / Sign out 走 messages |
| **修改** | `src/app/[locale]/(app)/dashboard/page.tsx` | greeting / section 标题 / CTA → `getTranslations` |
| **修改** | `src/features/dashboard/*.tsx` | KpiRow / SectionHeader 文案 → messages |
| **修改** | `src/app/[locale]/login/login-form.tsx` | Email / Password / Submit 标签 → messages |

---

## 3. next-intl v4 配置方案

### 3.1 `src/i18n/routing.ts`
```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh", "ja", "ko", "es"],
  defaultLocale: "en",
  localePrefix: "always",     // /en/dashboard 显式前缀
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,  // 1 年
  },
});
```

### 3.2 `src/i18n/request.ts`
```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "UTC",
  };
});
```

### 3.3 `next.config.ts`
```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const nextConfig: NextConfig = { /* 现有配置 */ };
export default withNextIntl(nextConfig);
```

### 3.4 `src/app/[locale]/layout.tsx`
```typescript
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
```

---

## 4. Middleware 组合方案（关键风险点）

### 4.1 当前 `src/middleware.ts`
```typescript
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
const { auth } = NextAuth(authConfig);
export default auth;
export const config = { matcher: [...] };
```

### 4.2 F006 组合方案
**次序**：先 next-intl 处理 locale 前缀（确保 URL 规范）→ 再 NextAuth auth 校验（检查 session）

```typescript
// src/middleware.ts
import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);
const { auth } = NextAuth(authConfig);

const AUTH_ROUTES = ["/login"];
const PROTECTED_PREFIXES = ["/dashboard", "/kols", "/campaigns", "/emails", "/products", "/analytics", "/settings"];

function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (match && routing.locales.includes(match[1] as (typeof routing.locales)[number])) {
    return match[2] ?? "/";
  }
  return pathname;
}

export default auth((req) => {
  const { nextUrl } = req;
  const bare = stripLocale(nextUrl.pathname);

  if (PROTECTED_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`))) {
    if (!req.auth) {
      const loginUrl = new URL("/login", nextUrl);
      return NextResponse.redirect(loginUrl);
    }
  }
  if (AUTH_ROUTES.includes(bare) && req.auth) {
    const locale = req.auth.user?.locale ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, nextUrl));
  }

  return handleI18nRouting(req);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**关键设计点**：
- `auth()` 包装后的 middleware 接受 request（含 `req.auth`），在做路由/鉴权判断后调用 `handleI18nRouting(req)` 完成 locale 重定向
- `stripLocale` 把 `/zh/dashboard` → `/dashboard` 供 PROTECTED_PREFIXES 匹配
- 登录后的 redirect target = `/{user.locale}/dashboard`（F2 决议 A 时适用；F2 决议 B 时改 `/{routing.defaultLocale}/dashboard`）

---

## 5. `messages/en.json` 完整草案

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "kolDiscovery": "KOL Discovery",
    "kolDatabase": "KOL Database",
    "campaigns": "Campaigns",
    "emailCenter": "Email Center",
    "products": "Products",
    "analytics": "Analytics",
    "settings": "Settings"
  },
  "topbar": {
    "searchPlaceholder": "Search KOLs, campaigns, emails...",
    "languageAriaLabel": "Change language",
    "locale": {
      "en": "English",
      "zh": "中文（简体）",
      "ja": "日本語",
      "ko": "한국어",
      "es": "Español"
    }
  },
  "userMenu": {
    "profile": "Profile",
    "settings": "Settings",
    "signOut": "Sign out"
  },
  "login": {
    "title": "Sign in to KOLMatrix",
    "email": "Email",
    "password": "Password",
    "submit": "Sign in",
    "submitting": "Signing in…",
    "invalidCredentials": "Invalid email or password"
  },
  "dashboard": {
    "greeting": "Welcome back, {name}.",
    "subtitle": "Here is your global KOL marketing pulse for {date}.",
    "newCampaign": "New Campaign",
    "activeCampaigns": "Active Campaigns",
    "viewAll": "View All",
    "recommendedKols": "AI-Recommended KOLs",
    "autoMatch": "Auto-Match",
    "seeMatrix": "See Matrix",
    "emailPerformance": "Email Performance",
    "recentActivity": "Recent Activity",
    "mockNote": "Dashboard mock data: 7d rolling window. KPI values reflect current tenant only.",
    "kpi": {
      "totalKols": "Total KOLs",
      "activeCampaigns": "Active Campaigns",
      "emailsSent": "Emails Sent",
      "avgAiMatch": "Avg AI Match"
    }
  },
  "common": {
    "openRate": "Open Rate",
    "progress": "Progress"
  }
}
```

其他 4 语言（zh/ja/ko/es）初始值策略 → 决议 F4。

---

## 6. LanguageSwitcher 真联动（骨架预览）

```typescript
// src/components/layout/LanguageSwitcher.tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateUserLocale } from "@/app/[locale]/(app)/actions";
import { cn } from "@/lib/utils";

type Locale = "en" | "zh" | "ja" | "ko" | "es";
const LOCALES: Locale[] = ["en", "zh", "ja", "ko", "es"];

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("topbar.locale");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    const segments = pathname.split("/").filter(Boolean);
    if (LOCALES.includes(segments[0] as Locale)) segments[0] = next;
    else segments.unshift(next);
    const newPath = "/" + segments.join("/");

    start(async () => {
      await updateUserLocale(next);   // 异步写 DB, cookie 由 next-intl 自动写
      router.push(newPath);
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} /* ...same styling as current */>
        <span className="material-symbols-outlined text-[18px]" aria-hidden>language</span>
        {locale.toUpperCase()}
      </button>
      {open ? (
        <ul role="menu" className="bg-surface-low ring-cyan/15 absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-[12px] p-1 shadow-lg ring-1">
          {LOCALES.map((l) => (
            <li key={l}>
              <button
                role="menuitem"
                disabled={l === locale || isPending}
                onClick={() => change(l)}
                className={cn("w-full rounded-[8px] px-3 py-2 text-left text-[13px]", l === locale ? "bg-cyan/10 text-cyan" : "text-on-surface hover:bg-surface-high/60")}
              >
                {t(l)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

`updateUserLocale` 是 server action（`"use server"`），更新 `user.locale`。

---

## 7. 8 条 Planner 裁决请求

| # | 决议点 | A 方案 | B 方案 | johnsong 建议 |
|---|---|---|---|---|
| F1 | Login 页是否加 locale 前缀 | 保留根 `src/app/login/`（未认证无 locale 概念，登录后 redirect 带 locale） | `src/app/[locale]/login/` 统一结构 | **A**（简洁，冷启动无歧义） |
| F2 | URL locale 与 `user.locale` 冲突时策略 | 登录后强制 redirect `/{user.locale}/dashboard`（重置 URL） | 尊重 URL 显式 locale；LanguageSwitcher 主动切换时双写 DB+cookie | **B**（允许临时切换不同语言，不破坏 URL 意图） |
| F3 | Activity feed 5 条 mock 文本是否 i18n | 放 `messages/` 里走 i18n | 保留英文硬编码在 `mocks.ts`（mock 数据不 i18n） | **B**（目前是 mock，B3+ 接真实数据时重新设计） |
| F4 | 非 EN 语言文案的初始值 | 完整复制 EN + `// TODO: translate` 行注释 | 空字符串 `""`（靠 next-intl 自动 fallback EN） | **A**（spec 原文明写"复制 EN 后标 TODO"） |
| F5 | 中文/日韩字体 | 保持 Inter（中文走系统 fallback，目前可用不惊艳） | 引入 Noto Sans SC / PingFang SC 等 CJK 字体（Tailwind v4 加 font family） | **A**（B0 不引字体依赖，视觉验收时若发现严重问题再 B1+ 升级） |
| F6 | 日期格式 | `new Date().toLocaleDateString(locale, options)` 动态 | 固定 en-US 不随 locale 变 | **A**（国际化基础要求） |
| F7 | `user.locale` 更新时机（除 LanguageSwitcher 之外） | 仅 LanguageSwitcher 手动切换更新 | 登录时把 cookie NEXT_LOCALE 回写到 user.locale（双向同步） | **A**（避免 side effect，显式切换才改 DB） |
| F8 | Login redirect target（登录后） | `/{user.locale}/dashboard` | `/{routing.defaultLocale}/dashboard`（冷启动简单） | **A**（尊重用户偏好） |

**裁决格式：** `#F1:A #F2:B #F3:B #F4:A #F5:A #F6:A #F7:A #F8:A` 或偏离建议给理由。

---

## 8. 开工条件

收到 Planner 对 **8 条决议** 的明确回复后，johnsong 会按以下顺序实现：

| 步骤 | 动作 | 预估 |
|---|---|---|
| G1 | 路由 migration + `src/app/[locale]/layout.tsx` | 1.0 h |
| G2 | next-intl 配置 3 件套（routing / request / next.config） | 0.75 h |
| G3 | middleware 组合（intl + auth 链式） | 0.75 h |
| G4 | `messages/{en,zh,ja,ko,es}.json` 5 文件 | 0.5 h |
| G5 | 替换硬编码文案（Sidebar / Topbar / Dashboard / Login） | 1.0 h |
| G6 | LanguageSwitcher 真联动 + `updateUserLocale` server action | 0.75 h |
| G7 | 验收闸门 + 本地 `/en/dashboard` / `/zh/dashboard` 点测 + CI | 1.0 h |
| **总计** | | **~5.75 h** |

验收口径：
- HEX 扫描 0 命中
- tsc / lint / build 全绿
- CI 全绿
- 本地登录后跳 `/en/dashboard`；点 ZH 下拉 → URL 变 `/zh/dashboard` → Sidebar 8 项文案变 ZH
- DevTools Application 看 `NEXT_LOCALE` cookie
- DB `user.locale` 字段已改

**未收到明确回复前不开工。**

---

## 9. 相关文档

- `docs/specs/B0-foundation-spec.md` §4 F006 — 原规格
- `docs/specs/B0-f007-dashboard-plan.md` — F007 先例（pre-impl 审计流程模板）
- `docs/specs/B0-app-shell-canonical-review.md` — F005 先例
- `src/components/layout/nav-config.ts` — 已预留 `i18nKey` 字段
- `prisma/schema.prisma` — `User.locale String @default("en")` 字段已有
- Context7 `next-intl` v4.x 文档 — 审计时已查

---

## 10. Planner 裁决（Kimi · 2026-04-19）

F006 是 B0 最后一个 feature。审计扎实，路由/middleware/messages 三大块方案已经成熟。全部 8 条决议采纳 johnsong 建议——只有 #F2/#F3 两条是 B 方案，其余 A。

### 10.1 §7 8 条决议

**短格式：** `#F1:A #F2:B #F3:B #F4:A #F5:A #F6:A #F7:A #F8:A`

| # | 决定 | 理由 |
|---|---|---|
| F1 | **A** 保留根 `src/app/login/` 无 locale 前缀 | 未认证时无 locale 上下文；登录页文字极少（Email / Password / Sign in）；B0 不引浏览器 Accept-Language 探测，B1+ 视觉打磨时再加 |
| F2 | **B** 尊重 URL 显式 locale | 共享链接 `/zh/kols` 不应因 `user.locale=en` 被强行重定向；LanguageSwitcher 主动切换才双写 DB+cookie |
| F3 | **B** Activity feed mock 保留英文硬编码 | mock 数据本就是 transient，B3 接真实 DB 数据后重新设计字段结构；把 transient 文案塞进 messages 会污染翻译清单 |
| F4 | **A** 非 EN 初始值复制 EN + `// TODO: translate` | spec 明写此策略；next-intl v4 空字符串不自动跨 locale fallback，空值会显空字符，用户体验差 |
| F5 | **A** 保持 Inter（系统 CJK fallback） | B0 不引字体依赖；视觉若严重差 B1 再加 Noto Sans SC / PingFang SC |
| F6 | **A** 日期动态 locale | `Date.toLocaleDateString(locale, options)` 是 i18n 基础要求 |
| F7 | **A** 仅 LanguageSwitcher 显式切换才更新 DB | 登录 cookie 不回写，避免副作用；用户 DB 偏好应显式控制 |
| F8 | **A** 登录后 redirect `/{user.locale}/dashboard` | 尊重 DB 偏好；与 F2:B 组合 = 登录时用 DB 默认语言 + URL 可临时覆盖 |

### 10.2 §4 Middleware 组合方案评审

johnsong 的 `auth() + handleI18nRouting()` 链式方案正确，**无需修改**。顺序 intl→auth 保证 URL 先规范化再鉴权。`stripLocale` helper 是务实的 path 剥离方案。

**唯一补充：** `updateUserLocale` server action 文件路径最终位于 `src/app/[locale]/(app)/actions.ts`（johnsong §6 已引用），但 `"use server"` 必须标在文件首行，且必须用 `"use server"` + zod 参数校验（防越权）：

```typescript
"use server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { routing } from "@/i18n/routing";

const schema = z.object({ locale: z.enum(routing.locales) });

export async function updateUserLocale(raw: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const { locale } = schema.parse({ locale: raw });
  await prisma.user.update({ where: { id: session.user.id }, data: { locale } });
}
```

### 10.3 §2 路由 migration 清单评审

全部操作合理，**无增删**。注意：

1. `src/app/[locale]/layout.tsx` 不需要改 `<html lang>`（根 `src/app/layout.tsx` 保留 `lang="en"` 作为外层默认；locale 可用 `data-lang` 传递给 meta tag 或 SEO）—— 如果视觉 QA 认为需要，B1+ 再加动态 `<html lang={locale}>` 处理
2. 所有 `src/app/(app)/**` 移到 `src/app/[locale]/(app)/**` 后，**import paths 不变**（`@/` 别名不受影响），唯一要改的是 route-relative 路径（`../` 级数可能变）
3. `messages/{locale}.json` 放**项目根**还是 `src/messages/`？johnsong 方案是项目根，一致 next-intl 文档——accept

### 10.4 §5 messages/en.json 草案评审

**结构合理**，只加 2 点建议（非阻塞）：

1. `login.invalidCredentials` 建议措辞细化成占位："Email 或 password 不正确。请重试或找管理员重置"（国际化通用更清晰）
2. `dashboard.kpi` 子命名空间 keys 顺序（totalKols / activeCampaigns / emailsSent / avgAiMatch）应与 UI 渲染顺序一致，方便译员对齐视觉

这些是微调，johnsong 自行决定即可。

### 10.5 §6 LanguageSwitcher 实现评审

**方案可行**。只提醒 3 点：

1. `useTransition` 配合 server action 正确；切语言期间整块 dropdown 应 disabled（当前 `disabled={l === locale || isPending}` 已做）
2. `segments[0] = next` 替换 URL 首段是正确做法；但要处理无 locale 前缀的情况（如访问 `/` 根），johnsong 的 `if (LOCALES.includes(segments[0])) ... else segments.unshift(next)` 正确
3. LanguageSwitcher 位置：当前在 `TopbarActions.tsx` 里，locale dropdown 展开时注意不要被 topbar sticky 遮挡（需 `z-50` + 超出 topbar 范围）

### 10.6 B0 收尾预告（F006 是最后一个）

F006 完成后：
1. `progress.json` → `status: "building"` → Generator 推送最后 push
2. 用户告知"B0 build 完成"→ 我 update `status: "verifying"` → Codex (Reviewer) 按 B0 spec §7 严格手工验收
3. Codex 跑完 4 层验收（L1 构建扫描 / L1.5 严格手工 / L2 视觉回归 / L3 E2E / L4 文档）
4. 若全 PASS → `status: "done"` + signoff 写 `docs/test-reports/B0-foundation-signoff.md`
5. 启动 **BI1 测试基建**（按 Option α 序列）

### 10.7 B0 整体统计（预告）

B0 从启动到 F006 开工，用户 + Planner + Generator 三方协作产出：
- 代码：Next 16 + React 19 + Tailwind v4 完整脚手架 + Auth + RLS + 12 common 组件 + Dashboard 5 区块 + CI workflow
- 文档：4 份 pre-impl 审计 + 4 份 Planner 裁决（裁决机制已成熟）
- 设计：canonical App Shell 写入 designMd 自动注入 + 色彩 token 边界政策沉淀
- 状态机：10 features 完整跑通 planning → building（即将 → verifying → done）

**pre-impl 审计 → Planner 裁决**模式显著降低了返工成本。F005 4 次裁决 + F010 6 决议 + F007 7 决议 + F006 8 决议共 25 个决策点，**没有一个导致 building 阶段返工**。

---

**johnsong 可按此立即开工 F006**（无需进一步确认）。预计 5.75 小时完成 + 本地点测 + push main → B0 进入 verifying。

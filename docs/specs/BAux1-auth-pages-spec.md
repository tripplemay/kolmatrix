# BAux1 — 登录 + 请求访问页面 批次规格

> 类型：Auxiliary Sprint（辅助批次，B1 前补做）
> 状态：2026-04-21 定稿，Generator 可开工
> Planner: Kimi · Generator: johnsong · Evaluator: Reviewer

## 1. 背景与目标

B0 已实现 NextAuth Credentials 登录 + `/login` 功能页面，但 UI 是最简工具化样式，与 V5 Stitch 设计（58/42 cinematic split，游戏氛围版）不匹配。同时"请求访问"（Request workspace access）页面尚未实现，当前无法对外引流。

本批次把登录页重写成 cinematic 设计 + 新建请求访问页面 + 配套 DB 模型 + 邮件通知 + en/zh i18n。**作为 B1 业务批次前的最后一块 UX 基建补齐。**

**Definition of Done：**
- 访客到 `https://kol.guangai.ai/login` 看到 world-map cinematic 登录页（58/42 split），凭邮箱密码可登录（NextAuth 流程不变）
- 访客到 `https://kol.guangai.ai/request-access` 填表提交，记录写入 `access_request` 表，admin `tripplezhou@gmail.com` 收到 Resend 邮件通知
- 访客提交后看到 "We'll get back to you within 1 business day" 确认页
- 登录/请求访问页面支持 en + zh 双语切换（ja/ko/es 走 en 回退，待译员补）

**Out of Scope：**
- ❌ Google OAuth 真实接入（button 保留 disabled "Coming soon"，B5+ 评估）
- ❌ 审批管理 UI（admin 暂 SSH 到 DB 手 UPDATE `status='approved'` + 手建 User/Tenant，B9 Settings & Team 批次再做）
- ❌ ja / ko / es 翻译（留 stub key，译员补到 `messages/*.json` 即可生效）
- ❌ 手机端响应式完美还原（先给 < 768px 窄屏一个居中表单的 fallback，大屏优先）
- ❌ 自动注册 / 发欢迎邮件 + 临时密码（违背邀请制，不做）

## 2. 范围

### In Scope
- Prisma model `AccessRequest` + migration + ROLLBACK SQL
- `/login` 页面重写（58/42 split，world-map cinematic 左图 + 下划线输入右表单）
- `/request-access` 新建（58/42 split，war-room cinematic 左图 + 长表单 + 成功态）
- POST `/api/access-request` Server Action（Zod 校验 + Prisma create + Resend 邮件）
- Resend 邮件模板（简 HTML，从 `marketer@kolquest.com` 发到 `tripplezhou@gmail.com`）
- i18n 键：en + zh（ja/ko/es stub）
- Unit / Integration / E2E 测试
- 两张 AI 生成的 cinematic hero 图入库 `public/brand/`（Planner 执行）

### Out of Scope
见 §1 Out of Scope。

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 登录左图主题 | **全球创作者网络 world map**（深色底 + cyan 光点 + 大洲间连线）| 匹配 "Run global KOL campaigns like a launch day" 叙事；电竞场馆是游戏子品类，语义过窄；world map 是全球 SaaS 标配视觉（Linear/Framer/Vercel）|
| 请求访问左图主题 | **War room / Ops 指挥室** | 匹配 "Every launch has a war room. This is yours." 叙事；与 login 形成视觉 pair（login 看全球网络 → register 进入操盘室）|
| Google OAuth | 按钮保留，disabled + "Coming soon" tooltip | UI 忠实 Stitch 设计；不扩后端 scope（B5+ 需要再接）|
| 请求访问后端流程 | `AccessRequest` 表 + pending 状态 + admin 邮件通知 + 手动审批 | 匹配邀请制语义；审批 UI 留到 B9（当前 admin 直接 DB 操作）|
| i18n | en + zh 双语；ja/ko/es 走 en 回退 | en 覆盖出海国际用户；zh 覆盖国内用户；其他 locale 等译员 |
| 邮件发件 | `marketer@kolquest.com` via Resend API（复用 BI3-F005 已验证渠道）| BI3-F005 实测根域发件可用；API key 在 `.env.production` 就绪 |
| Hero 图格式 | `.png`（1024×1024，gpt-image 输出格式）| OpenAI gpt-image 原生 PNG；所有浏览器支持；single file，不做 .jpg 回退；若未来发现 LCP 慢可批量转 .webp（优化批次做）|
| 图生成 | aigcgateway `generate_image`（Planner 执行，批次启动前入库）| 不依赖外部 stock 库；内容可控；与项目 AI 能力一致 |
| 窄屏 (< 768px) | 左图隐藏，表单居中全宽 | 大屏优先；移动端响应式完美还原推迟 |
| Zod 校验 | Server Action 内嵌 schema | 符合 Next 16 app router 最佳实践，不引入 form 库 |
| 防刷 | 每 email 24h 只能提交一次（DB unique index on email + 近期 createdAt 检查） | 最小防刷；未来可加 Cloudflare Turnstile / rate limit |

## 4. 功能列表（4 项，全 executor:generator）

### F001 — `AccessRequest` Prisma 模型 + migration

**实现：**

`prisma/schema.prisma` 追加：

```prisma
model AccessRequest {
  id                    String   @id @default(cuid())
  email                 String   @unique @db.VarChar(320)
  firstName             String   @db.VarChar(64)
  lastName              String   @db.VarChar(64)
  company               String   @db.VarChar(128)
  role                  String   @db.VarChar(64)      // Marketing Manager / Influencer Relations / Growth Lead / Founder / Agency PM / Other
  campaignsPerQuarter   String   @db.VarChar(32)      // 0-5 / 6-20 / 21-50 / 50+
  games                 String?  @db.Text
  status                String   @default("pending") @db.VarChar(16)  // pending / approved / rejected
  reviewedBy            String?  @db.VarChar(320)
  reviewedAt            DateTime?
  notes                 String?  @db.Text             // admin 备注
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([status, createdAt])
  @@map("access_request")
}
```

Migration：`20260421000000_access_request/migration.sql` 含 CREATE TABLE + `-- ROLLBACK: DROP TABLE "access_request";`。**无 RLS**（公共 pending 表，只有 platform admin 应用层读，访客只能 insert）。

**Acceptance：**
- `npx prisma migrate dev` 本地通过，`npx prisma migrate deploy` 在测试容器通过
- `_prisma_migrations` 表新增一条 `20260421000000_access_request`
- migration 文件含完整 ROLLBACK SQL（F007 CI 校验通过）
- `tests/integration/access-request.test.ts` 覆盖：insert → unique email 冲突抛错 → 查询 status=pending

### F002 — 登录页 UI 重写（58/42 cinematic + world map）

**实现：**

`src/app/[locale]/login/page.tsx` 重写为：

```tsx
// 文件结构示意
export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[58fr_42fr]">
      {/* 左: cinematic hero (lg+ 才显示) */}
      <section className="hidden lg:block relative overflow-hidden">
        <Image src="/brand/login-hero.png" alt="" fill priority sizes="58vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-950/20" />
        <LoginBrandOverlay />      {/* 品牌 wordmark + 标语 + HUD chips + studio logos */}
      </section>
      {/* 右: 表单 */}
      <section className="flex items-center justify-center px-6 py-12">
        <LoginForm />            {/* Credentials 登录表单 + Google disabled 占位 */}
      </section>
    </main>
  );
}
```

**核心组件：**
- `src/components/auth/LoginForm.tsx`（client component）
  - email + password 输入：下划线样式（无 card 框，`bg-transparent border-b border-slate-700 focus:border-cyan-400`）
  - "Sign in" 按钮：实心 cyan + navy text + `drop-shadow-[0_0_24px_rgba(0,229,255,0.25)]`
  - "Continue with Google" 按钮：disabled + `title="Coming soon"` + 灰 Google 图标
  - "Remember device" checkbox + "Forgot password?" link（forgot 后端 B5+ 做，先留 link）
  - 底部 "Request access" 链接跳 `/request-access`
  - 错误态：401 时表单下方显示 "Invalid email or password" 红字
  - NextAuth `signIn("credentials", ...)` 流程不动
- `src/components/auth/LoginBrandOverlay.tsx`（server component，静态）
  - KOLMatrix wordmark + "CREATOR OPERATIONS · 2026" 小字
  - 主标题 "Run global KOL campaigns **like a launch day**."
  - 副标题 "Discover, score, and coordinate with 800K+ verified creators..."
  - 4 个 HUD glass chips：`850K+ creators indexed` / `AI match 94%` / `9 locales · 24/7 ops` / `200+ studios trust us`
  - 底部 "TRUSTED BY CREATORS WORKING WITH" + 5 个 placeholder studio logos

**Hero 图：**
- `public/brand/login-hero.png` **1024×1024 PNG**，Planner 2026-04-21 通过 aigcgateway `gpt-image` 生成（trace `trc_p1bgn90814sqmnh02m97xz49`，cost $0.083，latency 64.8s）。生成请求虽为 1792×1024，但 OpenAI 侧 clamp 到 1024×1024 —— 58/42 左区用 `object-fit: cover` 适配 ~835×900 显示区域，视觉裁剪极小
- 内容验证：深色世界地图 + cyan 创作者光点密布 + 大洲间连线 + 底部辉光；无水印；B2B editorial 调性

**i18n：**
- `messages/en.json` + `messages/zh.json` 添加 `auth.login.*` 键：title / subtitle / emailLabel / emailPlaceholder / passwordLabel / passwordPlaceholder / rememberDevice / forgotPassword / signInButton / orDivider / continueWithGoogle / googleDisabledTooltip / newToKolmatrix / requestAccessLink / errorInvalidCredentials
- zh 翻译全部补齐；ja/ko/es 在 JSON 文件中仅保留 key stub（值为 en 原文或留空待译员）

**Acceptance：**
- `/en/login` 渲染 58/42 split，world-map 左图可见，HUD chips 位置与 `design-draft/stitch-references/login.html` 对齐 ±2px
- `/zh/login` 切换到中文文案（标题 "像发售日那样运营全球 KOL 活动" 或类似）
- Credentials 登录成功跳 `/dashboard`（保持现有 B0 flow）
- Credentials 登录失败显示错误 "Invalid email or password" / "邮箱或密码错误"
- Google button 禁用（`aria-disabled="true"` + hover tooltip "Coming soon"）
- 窄屏 < 768px 时左图隐藏，右表单居中全宽
- 图片 `login-hero.png` 首屏 LCP < 2s（实测 aside prod）
- 视觉回归：`tests/e2e/visual-regression.spec.ts` 新增 `/en/login` screenshot baseline（F009 机制延用）

### F003 — 请求访问页面 + POST API + admin 邮件

**实现：**

`src/app/[locale]/request-access/page.tsx`（Server Component + client form）：

- 58/42 split（与 login 相同结构，用 `RequestAccessBrandOverlay`）
- 左图 `public/brand/signup-hero.png` war-room 主题
- 左覆盖内容：wordmark + "OPERATOR PROGRAM · BY INVITE" / 主标题 "Every launch has a war room. / This is yours." / 副标题 "KOLMatrix is invite-only..." / HUD chips：`48h median response time` / `6,200 campaigns shipped` / `Live ops in 9 timezones` / `Zero churn in year one`；底部 "RECENTLY JOINED" + 3 张迷你 studio 卡片

**表单字段（Server Action 接收）：**

| Field | Type | Validation |
|---|---|---|
| firstName | string | 1-64 字，required |
| lastName | string | 1-64 字，required |
| email | string | RFC email + 长度 ≤ 320，required，unique on server 侧 |
| company | string | 1-128 字，required |
| role | enum | `marketing-manager` / `influencer-relations` / `growth-lead` / `founder` / `agency-pm` / `other` |
| campaignsPerQuarter | enum | `0-5` / `6-20` / `21-50` / `50+` |
| games | string? | ≤ 2000 字，optional |
| tosAccepted | boolean | must be `true` |

**Server Action `submitAccessRequest`:**

```ts
// src/app/[locale]/request-access/actions.ts
'use server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendAccessRequestNotification } from '@/lib/email/access-request';

const AccessRequestSchema = z.object({ /* 8 fields above */ });

export async function submitAccessRequest(formData: FormData) {
  const parsed = AccessRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: 'invalid_input', issues: parsed.error.issues };

  // 1) 防刷：同 email 24h 内已有 pending 请求则静默成功（不告诉调用方是否已请求过）
  const existing = await prisma.accessRequest.findUnique({ where: { email: parsed.data.email } });
  if (existing && Date.now() - existing.createdAt.getTime() < 86_400_000) {
    return { ok: true };  // 静默去重，避免 enumeration attack
  }

  // 2) upsert 入库
  const req = await prisma.accessRequest.upsert({
    where: { email: parsed.data.email },
    create: { ...parsed.data, status: 'pending' },
    update: { ...parsed.data, status: 'pending', updatedAt: new Date() },
  });

  // 3) 邮件通知 admin
  await sendAccessRequestNotification(req);

  return { ok: true };
}
```

**Resend 邮件 helper `src/lib/email/access-request.ts`:**

```ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendAccessRequestNotification(req: AccessRequest) {
  await resend.emails.send({
    from: 'KOLMatrix Access <marketer@kolquest.com>',
    to: ['tripplezhou@gmail.com'],
    subject: `[KOLMatrix] New access request: ${req.company}`,
    html: /* 简 HTML 列 request 字段 + "Run SSH UPDATE in runbook" 指引 */,
  });
}
```

**成功态：**
- 提交后客户端 redirect 到 `/request-access/success`（或 inline 换态）
- 显示 "We'll get back to you within 1 business day" / "我们会在 1 个工作日内与你联系"
- 含返回登录链接

**i18n：**
- 新增 `auth.requestAccess.*` 键（title / subtitle / 8 字段 label+placeholder / tosLabel / submitButton / successTitle / successMessage / backToLogin / errorGeneric）

**Hero 图：**
- `public/brand/signup-hero.png` **1024×1024 PNG**，Planner 2026-04-21 通过 `gpt-image` 生成（trace `trc_e576uaw4pk09k7a9lltfpzsk`，cost $0.083，latency 59.6s）。构图：dark broadcast ops room + 两 operator 背影 + cyan 监控墙（含 world map / 波形 / data table）。无水印

**Acceptance：**
- `/en/request-access` 渲染 58/42 split，war-room 图可见
- 填完 8 字段 + 勾 ToS → 提交 → 成功页 "We'll get back to you within 1 business day"
- 同 email 24h 内再提交 → 成功页相同（静默去重，不提示"已申请过"）
- Missing required field → 表单字段下方红字错误（多语言）
- admin `tripplezhou@gmail.com` 实测收到邮件（Reviewer L3 阶段 integration 时不发真邮件，用 MSW mock Resend API）
- DB `access_request` 表有新行，status=pending

### F004 — 测试覆盖 + i18n 键补齐

**实现：**

**Unit tests:**
- `src/components/auth/__tests__/LoginForm.test.tsx`（renders / email+password input / disabled Google button / error state / forgot link）
- `src/components/auth/__tests__/RequestAccessForm.test.tsx`（renders 8 fields / ToS checkbox blocks submit when unchecked / role dropdown all options / submit calls action）
- `src/lib/email/__tests__/access-request.test.ts`（Resend mock，验证 from / to / subject / body 含 company+email）

**Integration tests:**
- `tests/integration/access-request-flow.test.ts`：
  - Server Action 接收 valid FormData → DB 新行 + 调 Resend mock
  - Invalid FormData（缺 ToS）→ 返回 `{ ok: false, error: 'invalid_input' }`，不写 DB
  - 重复 email 在 24h 内 → upsert 幂等，不重复发邮件
  - Zod 校验边界（email 超长、role enum 外值、campaignsPerQuarter 非枚举值）

**E2E tests:**
- `tests/e2e/login-cinematic.spec.ts`（extend existing `marketer-dashboard.spec.ts` 不破坏）：
  - 访问 `/en/login` → 看到 58/42 split + world-map 图 + "Sign in" 按钮
  - 用 Sarah Chen credential 登录 → 跳 `/dashboard`
  - 访问 `/zh/login` → 看到中文标题
  - Google 按钮 disabled
- `tests/e2e/request-access.spec.ts`（新文件）：
  - 访问 `/en/request-access` → 看到 war-room 图 + 8 字段
  - 填 Sarah's Org Inc. 提交 → 跳成功页
  - 验证 DB 写入（via Testcontainers Prisma 查询）
  - 验证 Resend mock 收到邮件（via MSW handler）

**Visual regression（延用 BI1-F009）:**
- `/en/login` 新增 screenshot baseline
- `/en/request-access` 新增 screenshot baseline
- 两图都 mask 动态元素（如时间戳、CSRF token）

**i18n 键完整性：**
- `messages/en.json` + `messages/zh.json` 所有 `auth.login.*` 和 `auth.requestAccess.*` 键全翻译
- `messages/ja.json` + `messages/ko.json` + `messages/es.json` 添加对应 keys，值可以是 en 原文（TODO 标记）或空字符串 + 运行时 fallback 到 en

**Acceptance：**
- `npm run test:unit` 新增 ~15 cases 全绿
- `npm run test:integration` 新增 ~6 cases 全绿
- `npm run test:e2e` 新增 2 文件 ~6 cases 全绿
- `test:coverage` 整体 lines ≥ 80%（维持），`src/app/[locale]/login/` + `src/app/[locale]/request-access/` + `src/lib/email/` 单独看 lines ≥ 80%
- `npm run lint` + `npx tsc --noEmit` 无错
- Visual regression 新增 2 baseline 入库

## 5. 依赖关系

```
F001 (DB schema) ─┐
                  ├─► F003 (Register uses AccessRequest)
F002 (Login UI) ──┘
                  ├─► F004 (tests cover F001+F002+F003)
```

**强制执行顺序：** F001 → F002 并行 → F003 → F004

（Planner 在 Generator 开工前生成 2 张 hero 图并 commit 入库，不计入 feature 数）

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| AI 生成图不达预期（太普通 / 文字乱码 / 不是 16:9） | Planner 先生成 2-3 张备选，选最佳入库；不满意重跑 prompt |
| Resend 邮件发不出（API 错 / 配额满） | Server Action 捕获 `resend.emails.send` 异常，即使邮件失败 DB 写入仍生效（admin 可 SSH 查表），log 错误到 server-side |
| 同 email 反复提交做 enumeration attack | 24h 内静默去重，永远返回 success，不泄漏该邮箱是否在库 |
| 窄屏用户首屏掉帧 | 左图区域 `hidden lg:block`，< 768px 根本不渲染 |
| Google disabled button 让用户期望值管理差 | Tooltip 明确 "Coming soon"；文案避开 "Not supported" 这种负面表述 |
| i18n zh 翻译质量差 | Planner 主审，必要时用 aigcgateway 翻译辅助；未来译员覆盖 |
| Zod schema 与 Prisma model 不一致漂移 | 本批次用 hand-written Zod，未来用 `zod-prisma-types` 或类似工具自动同步；留 TODO |

## 7. 验收方式（Evaluator 阶段）

Reviewer 执行：

### L1 自动化
- `npm run test:unit` + `test:integration` + `test:e2e` + `test:coverage` 全绿
- `npm run lint` + `npx tsc --noEmit` 无错
- `scripts/validate-rollback-sql.sh` 通过（F007 门禁）
- CI 8 jobs 全绿

### L2 生产端
- staging `https://staging.kol.guangai.ai/en/login` 可访问，世界地图背景 + 表单都渲染
- staging 用 Sarah Chen 凭证登录 → 跳 `/dashboard`
- staging `/en/request-access` 提交一次测试 request（email 用 Reviewer 自己的测试账号），admin `tripplezhou@gmail.com` 收到真实邮件
- staging DB `access_request` 表查询到新行 status=pending
- SSL Labs A+ 维持（不受 UI 重写影响）

### L3 视觉
- Reviewer 用 Chrome/Safari 打开 `/en/login` 和 `/zh/login`，对照 `design-draft/stitch-references/login.png` 视觉差异 ≤ 5px（字重字号 100%，配色 ΔE<2）
- 同上对比 `/en/request-access` 和 `design-draft/stitch-references/signup.png`
- 窄屏 375px (iPhone SE) 左图隐藏，表单居中全宽，无横向滚动

## 8. 引用文档

- V5 Stitch 参考：`design-draft/stitch-references/login.html` + `.png` + `signup.html` + `.png`
- V5 设计原 prompt：`design-draft/stitch-references/V5-prompts.md`
- 设计系统 token：`design-draft/design-system.md` + `docs/specs/visual-baseline.md`
- B0 Auth 实现：`src/auth.ts` + `src/auth.config.ts` + `src/app/[locale]/login/page.tsx`（当前最简版）
- 邮件基础设施：`.auto-memory/environment.md` §品牌域 + ADR-010
- 测试基建：`docs/dev/testing.md`（BI1 落地）

## 9. 启动检查清单（Generator 开工前）

- [x] BI3 status=done（已签收 2026-04-20）
- [x] `public/brand/login-hero.png` 入库（1024×1024 PNG，Planner 2026-04-21 gpt-image 生成 trace `trc_p1bgn90814sqmnh02m97xz49`）
- [x] `public/brand/signup-hero.png` 入库（1024×1024 PNG，Planner 2026-04-21 gpt-image 生成 trace `trc_e576uaw4pk09k7a9lltfpzsk`）
- [ ] `role_assignments` 在 progress.json 设置（Planner: Kimi / Generator: johnsong / Evaluator: Reviewer）
- [ ] 用户确认批次范围（本文件 §1 §2）✅ 2026-04-21 确认 1A/2A/3B/图B world-map

## 10. 完成后效果

- `kol.guangai.ai/login` 和 `kol.guangai.ai/request-access` 对外可见，视觉与 V5 Stitch 设计对齐
- 访客可以填写请求访问，admin 有邮件通知可以人工审批并手动建 User/Tenant
- en + zh 双语运行，ja/ko/es 待译员
- B1 KOL Database 批次可以放心开始，不再被 UX 碎片阻塞

---

**Planner 行动清单（Generator 开工前完成）：**
1. 用 aigcgateway `generate_image` 生成 2 张 hero 图（world map + war room），入库 `public/brand/`
2. 起草 features.json
3. 切 progress.json → status=building + role_assignments
4. 推送后立刻进入 B1 planning（并行）

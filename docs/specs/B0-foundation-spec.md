# B0 — Foundation 批次规格

> 类型：Foundation Sprint（首批次）
> 状态：planning → building（待 generator 接手）
> Planner: Kimi · Generator: johnsong · Evaluator: Reviewer
> 起草日期：2026-04-18

## 1. 背景与目标

KOLMatrix 项目在视觉基调（Neural Velocity）+ Stitch 参考稿（Dashboard / KOL Discovery / KOL Detail）就绪后，需要从零搭建可运行的 Next.js 工程。本批次（B0）目标是把"地基"打好——脚手架、设计系统映射、组件框架、数据库、认证、首屏 Dashboard——使后续 V3+ 业务批次能在稳定基线上做纯功能开发。

**版本基线（2026-04-18 latest）：** Next.js 16 (App Router) + React 19.2 + TypeScript 5+ + Tailwind v4（CSS-first config via `@theme`）+ shadcn/ui 最新版（已原生支持 Tailwind v4）。

**完成标准（Definition of Done）：**
- 新 dev 按 README 操作，30 分钟内本地能跑通 `npm run dev` 看到 Dashboard
- 数据库结构、认证、RLS、国际化、CI 全部到位
- Dashboard 视觉与 Stitch 设计稿 `8b4aa02ae47c4da181239399c6ef4658` 一致
- 后续业务开发只需"加页面 + 加 API"，不需再碰底层

## 2. 范围

### In Scope
- 项目脚手架（Next.js 16 App Router + React 19.2 + TypeScript + Tailwind v4）
- Neural Velocity 设计 token → Tailwind 映射
- App Shell 组件实现（Sidebar + Topbar + Layout）
- Prisma schema 设计 + 初始 migration + seed
- PostgreSQL RLS 多租户策略
- NextAuth v5 认证 + 简单登录页
- Dashboard 页面（mock + 真组件，对照 Stitch 视觉）
- next-intl 5 语言基础接入
- GitHub Actions CI workflow
- README + 本地开发文档

### Out of Scope（留给后续批次）
- KOL Discovery / Detail / Campaigns / Email Center 等业务页面
- BullMQ workers / Redis 队列实现
- aigcgateway 集成（AI 评分/邮件生成）
- Resend 邮件发送 + DNS 配置
- YouTube/TikTok/Twitch API 接入
- Webhook 接收
- E2E 测试（保留 unit + integration）
- 部署脚本到 Tokyo VM（CI 已建好，部署留给独立批次）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 包管理器 | npm | CLAUDE.md 已用，无需切换 |
| Next.js | **v16**（2026-04 latest） | greenfield 上最新栈零成本；锁旧版半年后被迫升 |
| React | **v19.2**（随 Next 16） | Actions / useOptimistic / native form actions 提升 DX |
| Tailwind | **v4**（CSS-first config via `@theme`） | shadcn 2026-04 已原生支持；性能更优；新项目无 v3 兼容包袱 |
| 认证 | NextAuth v5（Auth.js） | 开源、零成本、与 Next.js App Router 适配最好 |
| 服务端数据 | TanStack Query v5 | 行业标配，缓存/重试/失效完善 |
| 表单 | react-hook-form + zod | TypeScript 友好，schema 复用到 API 校验 |
| 图表 | recharts | 轻量、SSR 友好、API 简洁 |
| Icon | Material Symbols Outlined（CDN） | 与 Stitch 生成稿一致 |
| 多租户策略 | 共享 DB + 行级 RLS（tenant_id） | 资源利用率高，符合 PRD §6 多账号管理隔离 |
| RLS 启用方式 | PostgreSQL RLS + Prisma 中间件设置 `set local app.tenant_id` | 数据库强制保证，应用层无法绕过 |
| API 风格 | Next.js Route Handlers + RSC（默认） | 减少手写 API 层 |
| 文件夹组织 | feature-first（`/src/features/{feature}/`） | 后续业务批次可按特性独立扩展 |

## 4. 功能列表（10 项，全 executor:generator）

每条 acceptance 必须可独立验证。**功能编号与 features.json 的 F00X 严格对应**。

### F001 — 项目脚手架
**实现：**
- `npx create-next-app@latest` 创建项目（TypeScript / App Router / Tailwind / ESLint / src 目录 / 不要 turbopack）
  - 自然得到 Next 16 + React 19.2 + Tailwind v4
- 安装：`prisma @prisma/client`、`next-auth@beta`、`@auth/prisma-adapter`、`next-intl`、`@tanstack/react-query`、`react-hook-form zod @hookform/resolvers`、`recharts`、`bcrypt`
- `npx shadcn@latest init`（自动检测 Tailwind 4 并适配）
- 配置 ESLint + Prettier + import order
- `tsconfig.json` 路径别名 `@/*` → `src/*`
- `.gitignore` 补 `.env*`, `node_modules`, `.next`

**Acceptance：**
- `npm install` 成功
- `npm run dev` 启动到 http://localhost:3000
- `npm run build` 产出 `.next/`
- `npx tsc --noEmit` 0 错误
- `npm run lint` 0 错误

### F002 — 设计 Token → Tailwind 映射（Tailwind v4 CSS-first）
**实现：**
- Tailwind v4 不再用 `tailwind.config.ts`，而是在 `src/styles/globals.css` 用 `@theme` 块定义 token：
  ```css
  @import "tailwindcss";
  @theme {
    --color-navy-base: #0b1326;
    --color-cyan: #00E5FF;
    --color-purple: #9D50FF;
    /* ... 全部 surface 阶层 + cyan/purple variants */
    --radius-md: 12px;
    --radius-lg: 16px;
    --font-sans: "Inter", sans-serif;
  }
  ```
- `globals.css` 同时定义自定义 utilities：`.glass-panel`、`.ambient-glow`、`.ai-glow`、`.gradient-text`、`.gradient-cta`
- 引入 Inter 字体（next/font/google）并暴露为 `--font-inter` CSS variable
- 引入 Material Symbols Outlined（layout 注入 CDN `<link>`）

**Acceptance：**
- 任意组件用 `bg-navy-base`、`text-cyan`、`rounded-md` 渲染颜色与设计系统完全一致
- `.glass-panel` 渲染出 backdrop-blur + 20% cyan bg + cyan glow
- 所有页面默认 Inter 字体
- **代码 grep 任何 6 位 HEX 字符串（如 `#00E5FF`）必须为 0 命中**（除 `globals.css` 唯一 token 定义文件外）

### F003 — Prisma Schema + Migration
**实现：**
- `prisma/schema.prisma`：B0 核心 7 表（参见 `B0-database-schema.md`）
- 本地 `docker-compose.yml`：PostgreSQL 16 + Redis 7（仅本地开发用）
- `npx prisma migrate dev --name init` 生成首次 migration
- `prisma/seed.ts`：1 tenant + 2 users（admin + marketer）+ 12 KOLs（取自 Stitch mock 数据）+ 3 campaigns + 4 templates

**Acceptance：**
- `docker-compose up -d` 起 PG + Redis
- `npx prisma migrate dev` 通过，生成 migration 文件
- `npx prisma db seed` 通过
- `npx prisma studio` 能看到 seed 数据

### F004 — RLS 策略 + Auth + 登录页
**实现：**
- migration 中追加 RLS policies（tenant_id 等于 `current_setting('app.tenant_id')`）
- `src/lib/db.ts`：包装 PrismaClient，每次请求前 `set local app.tenant_id = '...'`
- `src/auth.ts`：NextAuth v5 配置（CredentialsProvider + Prisma adapter + JWT session）
- `src/middleware.ts`：受保护路由检查 session
- `src/app/login/page.tsx`：基础登录表单（email + password），不要求视觉抠图
- 登录成功跳 `/dashboard`

**Acceptance：**
- 未登录访问 `/dashboard` → 跳 `/login`
- marketer 账号登录后 `/dashboard` 仅看到自己 tenant 的 KOL 数据
- 直接 SQL 查询 `kol` 表（不带 tenant_id 上下文）返回 0 行

### F005 — App Shell 组件实现
**实现：**
- `src/components/layout/Sidebar.tsx`：8 nav 项 + Logo + UserChip（参见 `B0-app-shell-component.md`）
- `src/components/layout/Topbar.tsx`：page title + search + EN switcher + bell + divider + avatar
- `src/components/layout/AppShellLayout.tsx`：wraps Sidebar + Topbar + main slot
- `src/app/(app)/layout.tsx`：route group layout 使用 AppShellLayout
- 激活态根据 `usePathname()` 推导
- nav labels 走 next-intl

**Acceptance（像素级还原 — 严格）：**
- 访问 `/dashboard`、`/kols`、`/campaigns` 等路由，sidebar 自动高亮对应项
- **视觉对照 Stitch 截图 `design-draft/stitch-references/dashboard.png` 像素级还原**：
  - 色彩值 100% 走 token，禁止硬编码 HEX
  - 字体 / 字号 / 字重 / 字距 / 行高与设计稿一致
  - 间距（padding / margin / gap）与设计稿一致
  - 圆角 / 阴影 / 渐变与设计稿一致
  - 布局结构（flex / grid / 元素顺序与定位）100% 对齐
- sidebar 8 项顺序与图标完全匹配 `B0-app-shell-component.md` §4
- topbar 三段式（page title / search 居中 max-480px / actions cluster）
- 玻璃拟态 topbar 背景 + cyan 渐变 logo 方块
- 无 Help Center / Connect Wallet / 横向 nav 链接

> **像素级还原的实务定义：** Stitch HTML 用 CDN Tailwind 与项目本地配置略有差异，100% 字节级一致不可能。验收标准 = 截屏并排对比无可见差异（间距 ±2px / 颜色 ΔE < 2 / 字号 100% 匹配）。

### F006 — next-intl 国际化基础
**实现：**
- `src/i18n.ts` + `messages/{en,zh,ja,ko,es}.json`
- `src/middleware.ts` 集成 next-intl middleware（默认 EN）
- 路由结构 `/[locale]/dashboard`
- 提取 sidebar/topbar/dashboard 全部文案到 messages
- EN 完整翻译，其他 4 语言 key 占位（value 复制 EN，标注 TODO）

**Acceptance：**
- 直接访问 `/zh/dashboard` 渲染（EN 兜底）
- topbar EN 切换器点 ZH 后路由切换 + 至少 sidebar 8 项 ZH 文案显示
- 缺 key 不报错（fallback EN）

### F007 — Dashboard 页面（mock + 真组件）
**实现：**
- `src/app/(app)/dashboard/page.tsx`（Server Component）
- 5 区块：
  1. 问候栏（动态时间 + Sarah Chen 名字 + "+ New Campaign" 渐变 CTA）
  2. KPI 行（4 卡：Total KOLs / Active Campaigns / Emails Sent 7d / Avg AI Match Score）
  3. Active Campaigns（3 行卡片，含进度条）
  4. AI-Recommended KOLs（2x2 网格 + 玻璃拟态评分徽章）
  5. Email Performance 图表（recharts LineChart 14 天）+ Recent Activity feed
- KPI / Campaigns / KOLs 数据从 Prisma 拉（seed 数据）
- 邮件图表 + activity feed 暂用静态 mock
- **必须使用 F010 抽出的公共组件**（`StatCard` / `KolCard` / `CampaignRow` / `AiScoreBadge` / `GlassPanel` / `GradientButton` / `TagChip` / `AvatarWithPlatformBadge` / `ActivityFeedItem` / `SectionHeader`），不允许在 page.tsx 内 inline 写同等视觉的 div

**Acceptance（像素级还原 + 组件复用）：**
- 视觉对照 Stitch 截图 `design-draft/stitch-references/dashboard.png` 像素级还原（标准同 F005）
- 5 区块全部渲染，无空白
- KPI 数字来自 DB（删除 seed 后变 0）
- 切换 EN/ZH topbar 后 nav 标签变化（dashboard 文案至少 EN）
- **`page.tsx` 内 JSX 总长度 ≤ 80 行**（强制把 UI 拆到组件）
- **F010 12 组件接入口径**（F007 裁决 §11.2 修订，2026-04-19）：
  1. page.tsx 直接 import **≥5 个**真实顶层使用的 F010 组件
  2. Dashboard 渲染树中 **12 个 F010 组件全部出现**（直接 page.tsx 或间接经 KolCard 等封装引入都算）——通过 import 图静态分析验证
  3. page.tsx 内**不允许** inline 写 card / button / chip / header 等视觉片段（静态 grep 检查无 `<div className="... rounded-xl ...">` 等直接仿组件样式）
- **重复样式片段（同一 className 组合出现 ≥2 次）必须抽组件**
- **任何硬编码 HEX 直接 fail**
- F007 sprint 内**允许**补 Campaign.openRate migration + EmailLog seed（G1/G2 合并 PR，见 F007 裁决 §11.4）

### F008 — CI Workflow
**实现：**
- `.github/workflows/ci.yml`：on push/PR to main
  - jobs: install → lint → typecheck → build
  - PostgreSQL service（用于 `prisma migrate deploy` smoke）
  - Node 20 LTS
  - npm cache
- paths-ignore: `.auto-memory/**`, `progress.json`, `features.json`, `backlog.json`, `docs/**`, `design-draft/**`, `framework/**`, `*.md`, `harness-rules.md`
- `.github/dependabot.yml`：weekly npm + actions

**Acceptance：**
- PR 创建触发 CI 全绿
- 修改 docs 不触发 CI（验证 paths-ignore）

### F009 — README + 本地搭建文档
**实现：**
- `README.md`：项目介绍 + 5 行 quickstart
- `docs/dev/setup.md`：详细环境搭建（Node 20 / Docker / 环境变量 / 首次 seed）
- `.env.example`：所有需要的环境变量（DATABASE_URL / NEXTAUTH_SECRET / NEXTAUTH_URL / AIGCGATEWAY_BASE_URL / AIGCGATEWAY_API_KEY / RESEND_API_KEY 占位等）
- `CONTRIBUTING.md`：提交规范引用 harness-rules

**Acceptance：**
- 新 dev fork 仓库 + 按 README 操作 30 分钟内能本地起服务看到 Dashboard
- `.env.example` 与代码实际读取的变量名一一对应

### F010 — 公共组件库抽取（src/components/common/）

**背景：** Dashboard / KOL Discovery / KOL Detail 等多页共用大量视觉元素（KPI 卡 / KOL 卡 / 玻璃徽章 / 渐变按钮 / 标签 chip 等）。必须在 B0 一次性抽出 12 个通用组件，强制 Dashboard 复用。后续 B1+ 业务批次直接复用，避免重复实现 + 视觉漂移。

**实现：** 在 `src/components/common/` 下建立以下 12 个组件，全部导出：

| # | 组件 | 文件 | 用途 |
|---|---|---|---|
| 1 | `StatCard` | `common/StatCard.tsx` | KPI / 任何小指标卡（label + 大数字 + delta + 可选 sparkline） |
| 2 | `KolCard` | `common/KolCard.tsx` | KOL 卡（avatar + 名字 + 平台 + 关注数 + AiScoreBadge + tags + 操作） |
| 3 | `CampaignRow` | `common/CampaignRow.tsx` | 活动行（图标 + 名字 + 元数据 + 进度条 + 状态 chip） |
| 4 | `AiScoreBadge` | `common/AiScoreBadge.tsx` | AI 评分徽章（玻璃拟态 + cyan glow + 大数字，可选环形进度） |
| 5 | `GlassPanel` | `common/GlassPanel.tsx` | 玻璃拟态容器（backdrop-blur + 20% cyan bg + cyan glow） |
| 6 | `GradientButton` | `common/GradientButton.tsx` | 主 CTA（135° 渐变 + lit-from-within） |
| 7 | `SecondaryButton` | `common/SecondaryButton.tsx` | 紫色次级动作 |
| 8 | `GhostButton` | `common/GhostButton.tsx` | 透明边框动作 |
| 9 | `TagChip` | `common/TagChip.tsx` | primary_fixed 色无边框标签 |
| 10 | `AvatarWithPlatformBadge` | `common/AvatarWithPlatformBadge.tsx` | 头像 + YouTube/TikTok 角标 |
| 11 | `ActivityFeedItem` | `common/ActivityFeedItem.tsx` | 动态流条目（icon + text + timestamp） |
| 12 | `SectionHeader` | `common/SectionHeader.tsx` | 区块标题 + 可选副标题 + 可选右侧动作链接 |

**实现原则：**
- 每个组件 props 用 TypeScript interface 严格定义，导出
- 内部色彩 / 字体 / 圆角必须走 Tailwind token，禁止硬编码 HEX
- 每个组件单文件 ≤ 100 行（更复杂的拆子组件）
- 文件头注释：用途 + 主要 props + 哪些页面会用

**Acceptance：**
- `src/components/common/` 下 12 个文件全部存在并导出
- 每个文件 props interface 完整 + 文件头说明注释
- F007 Dashboard 必须 `import` 并使用上述全部 12 个组件（grep 可验证）
- `page.tsx` 内不得 inline 写同等视觉的 div（重复样式片段 ≥2 次必须抽出来）
- 组件本身视觉对照 Stitch 设计稿截图 `design-draft/stitch-references/dashboard.png` 一致

## 5. 依赖关系

```
F001 → F002 → {F003, F005, F010}
F003 → F004
F005 + F010 → F007 (Dashboard 综合)
F006 与 F005 并行
F008 与 F007 并行
F009 跨阶段，最后写
```

**强制执行顺序：**
F001 → F002 → F003 → F004 → F005 → **F010 → F007** → F006 → F008 → F009

> F010 必须在 F007 之前完成。Dashboard 不允许"先写 inline 后重构"——直接基于 F010 组件实现。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| NextAuth v5 文档不完整 / API 变动 | 锁版本到 `5.0.0-beta.20+`；遇阻立即创建框架提案 |
| RLS + Prisma 集成踩坑 | 用 Prisma `$extends` 中间件统一注入 `set local`；编单元测试覆盖 cross-tenant 隔离 |
| Tailwind v4 CSS-first config 学习曲线 | 文档完善（tailwindcss.com/docs/v4），与 v3 区别小 — 配置从 JS 移到 CSS，类名几乎不变 |
| 像素级还原难度 | Stitch HTML 用 CDN Tailwind，与项目本地配置存在差异。验收用截屏并排对比（间距 ±2px / 颜色 ΔE<2 / 字号 100%），不要求字节级一致 |
| 公共组件抽象过早 | B0 12 组件直接对照 Stitch 截图抽取，不预测未来需求。后续如果 props 不够灵活，B1 再演进 |
| Material Symbols 加载阻塞 | 用 `font-display: swap`；如影响 LCP 改为本地子集 |

## 7. 验收方式（Evaluator 阶段 — 严格手工模式）

由 Reviewer (codex) 执行。**严格标准，不放水**；因 BI1 测试基建未到位，自动化部分由手工深度验证替代（手段变，标准不变）。BI1 F006-F009 完成后将补打 B0 自动化覆盖，形成回归保护网（若届时发现 B0 漏洞起 B0 hotfix 批次）。

### L1 — 构建与代码扫描（可自动化，不依赖 BI1）
- 构建验证：`npm run build` + `npx tsc --noEmit` + `npm run lint` 全绿
- HEX 硬编码扫描：`grep -rE '#[0-9a-fA-F]{6}' src/` 在 `globals.css` 之外命中数 = 0
- 公共组件复用扫描：Dashboard `page.tsx` 必 import 全部 12 个 F010 组件；`page.tsx` JSX 总长度 ≤ 80 行
- Token 映射校验：`globals.css` 的 `@theme` 块含 `design-system.md §2` 全部色阶 token（手工 diff 字段名 + 值）

### L1.5 — 严格手工深度验证（BI1 前的等效替代，不得跳过）

**RLS 隔离手工验证（6 张多租户表全覆盖）：**

```bash
# Codex 在本地用 psql 连到 kolmatrix_app 角色（不是 superuser）
# 对以下 6 张表分别验证：user / kol / campaign / kol_campaign / email_template / email_log

# 场景 1: 带 tenant 上下文
psql -U kolmatrix_app kolmatrix -c "
BEGIN;
SET LOCAL app.tenant_id = '<seed-tenant-A-id>';
SELECT count(*) FROM kol;  -- 应 = 12 (seed 数据)
SELECT count(*) FROM campaign;  -- 应 = 3
-- ...其余 4 张表
COMMIT;
"

# 场景 2: 不带 tenant 上下文
psql -U kolmatrix_app kolmatrix -c "SELECT count(*) FROM kol;"
# 应 = 0 (RLS 拦截)

# 场景 3: 跨 tenant 泄漏测试
# SET LOCAL app.tenant_id = '<fake-uuid>'; SELECT * FROM kol; -- 应 = 0
```

每张表都必须跑这 3 个场景，Codex 在 signoff 报告中记录 psql 输出。

**Auth 完整流手工验证：**

浏览器（Chrome / Safari 任一）完整跑一遍：
1. 未登录直接访问 `/dashboard` → 应 302 跳 `/login`
2. 错误 email → 登录表单返回错误提示
3. 正确 email + 错误密码 → 返回 401 / 表单错误
4. 正确凭证（`marketer@kolmatrix.local` / `KOLM@2026!`）→ 应跳 `/dashboard`
5. DevTools → Cookies 确认 `next-auth.session-token` 存在
6. 刷新 Dashboard 仍登录态
7. 登出（如有登出按钮）→ session 失效
8. 使用另一个 tenant 的 `admin@kolmatrix.local` 账号登录，确认只见自己 tenant 数据

Codex 必须按顺序走完，在 signoff 记录每步通过情况。

### L2 — 视觉回归（手工并排对比，标准 ΔE<2 不放水）

- Codex 启动 `npm run dev` → 打开 `/dashboard`
- 窗口调整到 1280×2048（Stitch 设计稿原生尺寸）
- 用**任一图像对比工具**截屏并与 `design-draft/stitch-references/dashboard.png` 并排比对：
  - 推荐：Photoshop 图层叠加 + Difference blend mode
  - 或：`pixelmatch` CLI（`npm install -g pixelmatch-cli` + 跑 `pixelmatch a.png b.png diff.png`）
  - 或：Kaleidoscope / Beyond Compare 等专业 diff 工具
- 严格标准（与自动化一致）：
  - 间距偏差 ≤ 2px
  - 颜色偏差 ΔE < 2
  - 字号 100% 匹配
  - 布局结构（元素顺序 / 对齐 / 网格）100% 对齐
- Codex **必须在 signoff 报告中贴对比截图**（actual / baseline / diff 三张），标注所有差异点
- 任一差异 > 标准 → 判 PARTIAL，写 evaluator_feedback 推回 fixing

### L3 — 端到端用户流（手工 checklist）

Codex 用 marketer 账号按顺序跑完整流程，每步截屏留证：

1. 访问 `/login` → 输入凭证 → 跳 `/dashboard`
2. Dashboard 5 区块（greeting / KPI 4 卡 / Active Campaigns / AI KOLs / Email Chart + Activity）全部渲染
3. KPI "Total KOLs" 数值 = 12（seed 数据）
4. Sidebar 8 个 nav 项均可点（点 Campaigns → 应到 `/campaigns`，未实现页面可 404，但路由对）
5. Topbar `EN` 切换器点 ZH → sidebar 8 项文案变 ZH
6. 返回 EN → 文案恢复
7. 用户头像 dropdown 有 Sign out 选项

### L4 — 文档与 DX

- README 步骤可重现：Reviewer 在干净环境（如 Docker / 新账户）按 README 从零跑 30 分钟内起服务
- `.env.example` 与代码实际读取的环境变量名一一对应
- 全部 12 个 F010 公共组件文件头注释完整

---

### signoff 报告要求

Codex 在 `docs/test-reports/B0-foundation-signoff.md` 必须包含：

1. **4 层验收逐项结论**（L1 自动化 + L1.5 手工深度 + L2 视觉 + L3 E2E + L4 文档）
2. **RLS psql 输出全文**（6 张表 × 3 场景 = 18 个结果）
3. **视觉对比截图**（actual + baseline + diff，至少 Dashboard 一张）
4. **E2E 截屏 7 张**（L3 checklist 每步一张）
5. **发现的问题清单**（PARTIAL / FAIL，含复现步骤 + 建议）
6. **最终判定：** 全 PASS → `status=done`；有问题 → `status=fixing` + `evaluator_feedback`

### BI1 后的延伸工作（非 B0 验收阻塞）

BI1 `F006-F009` 实施时会在 `tests/` 下写 B0 代码的自动化测试（component unit / RLS integration / E2E / 视觉回归）。跑通这些测试相当于对 B0 做自动化回归检查：

- 测试跑通 → 确认 B0 实现经得起自动化验证
- 测试跑不通 → 区分原因：
  - 测试逻辑错 → BI1 fixing 修
  - B0 实现错 → 起 **B0-hotfix 独立批次**修复（按 harness §铁律 9：生产紧急故障也要走流程）

## 8. 引用文档

- `docs/dev/architecture.md` — 系统架构总览
- `docs/specs/B0-database-schema.md` — 数据库 schema 详情
- `docs/specs/B0-app-shell-component.md` — App Shell 组件 props 与实现细节
- `docs/specs/PRD.md` — 产品总需求
- `docs/specs/visual-baseline.md` — 视觉基调约束
- `design-draft/design-system.md` — 设计 token 与组件规则

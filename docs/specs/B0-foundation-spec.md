# B0 — Foundation 批次规格

> 类型：Foundation Sprint（首批次）
> 状态：planning → building（待 generator 接手）
> Planner: Kimi · Generator: johnsong · Evaluator: Reviewer
> 起草日期：2026-04-18

## 1. 背景与目标

KOLMatrix 项目在视觉基调（Neural Velocity）+ Stitch 参考稿（Dashboard / KOL Discovery / KOL Detail）就绪后，需要从零搭建可运行的 Next.js 工程。本批次（B0）目标是把"地基"打好——脚手架、设计系统映射、组件框架、数据库、认证、首屏 Dashboard——使后续 V3+ 业务批次能在稳定基线上做纯功能开发。

**完成标准（Definition of Done）：**
- 新 dev 按 README 操作，30 分钟内本地能跑通 `npm run dev` 看到 Dashboard
- 数据库结构、认证、RLS、国际化、CI 全部到位
- Dashboard 视觉与 Stitch 设计稿 `8b4aa02ae47c4da181239399c6ef4658` 一致
- 后续业务开发只需"加页面 + 加 API"，不需再碰底层

## 2. 范围

### In Scope
- 项目脚手架（Next.js 15 App Router + TypeScript + Tailwind）
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
| 认证 | NextAuth v5（Auth.js） | 开源、零成本、与 Next.js App Router 适配最好 |
| 服务端数据 | TanStack Query v5 | 行业标配，缓存/重试/失效完善 |
| 表单 | react-hook-form + zod | TypeScript 友好，schema 复用到 API 校验 |
| 图表 | recharts | 轻量、SSR 友好、API 简洁 |
| Icon | Material Symbols Outlined（CDN） | 与 Stitch 生成稿一致 |
| 多租户策略 | 共享 DB + 行级 RLS（tenant_id） | 资源利用率高，符合 PRD §6 多账号管理隔离 |
| RLS 启用方式 | PostgreSQL RLS + Prisma 中间件设置 `set local app.tenant_id` | 数据库强制保证，应用层无法绕过 |
| API 风格 | Next.js Route Handlers + RSC（默认） | 减少手写 API 层 |
| 文件夹组织 | feature-first（`/src/features/{feature}/`） | 后续业务批次可按特性独立扩展 |
| Tailwind 版本 | v3.4 LTS（暂不上 v4） | shadcn/ui 当前对 v3 适配最稳 |

## 4. 功能列表（10 项，全 executor:generator）

每条 acceptance 必须可独立验证。**功能编号与 features.json 的 F00X 严格对应**。

### F001 — 项目脚手架
**实现：**
- `npx create-next-app@latest` 创建项目（TypeScript / App Router / Tailwind / ESLint / src 目录 / 不要 turbopack）
- 安装：`prisma @prisma/client`、`next-auth@beta`、`@auth/prisma-adapter`、`next-intl`、`@tanstack/react-query`、`react-hook-form zod @hookform/resolvers`、`recharts`、`bcrypt`、`shadcn-ui`（init）
- 配置 ESLint + Prettier + import order + tailwind plugin
- `tsconfig.json` 路径别名 `@/*` → `src/*`
- `.gitignore` 补 `.env*`, `node_modules`, `.next`

**Acceptance：**
- `npm install` 成功
- `npm run dev` 启动到 http://localhost:3000
- `npm run build` 产出 `.next/`
- `npx tsc --noEmit` 0 错误
- `npm run lint` 0 错误

### F002 — 设计 Token → Tailwind 映射
**实现：**
- `tailwind.config.ts`：扩展 colors（navy / cyan / purple / surface 阶层）、borderRadius（含 12px / 16px）、fontFamily（Inter）
- `src/styles/globals.css`：CSS variables 同步色彩 token，定义 `.glass-panel`、`.ambient-glow`、`.ai-glow`、`.gradient-text`、`.gradient-cta`
- 引入 Inter 字体（next/font/google）
- 引入 Material Symbols Outlined（layout 注入 `<link>`）

**Acceptance：**
- 任意组件用 `bg-navy`、`text-cyan`、`rounded-md` 渲染颜色与设计系统完全一致
- `.glass-panel` 渲染出 backdrop-blur + 20% cyan bg + cyan glow
- 所有页面默认 Inter 字体
- **代码 grep 任何 6 位 HEX 字符串（如 `#00E5FF`）必须为 0 命中**（除 `tailwind.config.ts` / `globals.css` 这两个 token 定义文件外）

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
- **重复样式片段（同一 className 组合出现 ≥2 次）必须抽组件**
- **任何硬编码 HEX 直接 fail**

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
| Tailwind v3 → v4 迁移压力 | 本批次锁 v3.4，v4 留给后续独立批次 |
| 像素级还原难度 | Stitch HTML 用 CDN Tailwind，与项目本地配置存在差异。验收用截屏并排对比（间距 ±2px / 颜色 ΔE<2 / 字号 100%），不要求字节级一致 |
| 公共组件抽象过早 | B0 12 组件直接对照 Stitch 截图抽取，不预测未来需求。后续如果 props 不够灵活，B1 再演进 |
| Material Symbols 加载阻塞 | 用 `font-display: swap`；如影响 LCP 改为本地子集 |

## 7. 验收方式（Evaluator 阶段）

由 Reviewer (codex) 执行，包括：

### L1 — 自动化检查
- Prisma schema 单元测试：所有表的 RLS 隔离（cross-tenant 查询返回 0）
- Auth 流单元测试：登录 / 跳转 / 会话验证
- Token 映射回归：assert `tailwind.config.ts` 含 12 个色阶 token
- 构建验证：`npm run build` + `tsc --noEmit` + `lint` 全绿
- **HEX 硬编码扫描：** `grep -rE '#[0-9a-fA-F]{6}' src/` 在 `globals.css` / `tailwind.config.ts` 之外的命中数 = 0
- **公共组件复用扫描：** Dashboard `page.tsx` 必须 import 全部 12 个 F010 组件；`page.tsx` JSX 总长度 ≤ 80 行

### L2 — 视觉回归
- 启动 `npm run dev` → 访问 `/login` 截屏（仅功能验收，无视觉要求）
- 访问 `/dashboard` 截屏（1280x2048 viewport）
- **与 `design-draft/stitch-references/dashboard.png` 并排比对**，验收标准：
  - 间距偏差 ≤ 2px
  - 颜色偏差 ΔE < 2（`tailwind.config.ts` token 必须严格对应设计 HEX）
  - 字号 100% 匹配
  - 布局结构（元素顺序、对齐、网格）100% 对齐
- 发现差异 → 写入 `evaluator_feedback`，回退 fixing 阶段

### L3 — 文档与 DX
- README 步骤可重现（Reviewer 在干净环境跑一遍 30 分钟内起服务）
- `.env.example` 与代码实际读取的环境变量名一一对应
- 全部 12 个 F010 组件文件头注释完整

## 8. 引用文档

- `docs/dev/architecture.md` — 系统架构总览
- `docs/specs/B0-database-schema.md` — 数据库 schema 详情
- `docs/specs/B0-app-shell-component.md` — App Shell 组件 props 与实现细节
- `docs/specs/PRD.md` — 产品总需求
- `docs/specs/visual-baseline.md` — 视觉基调约束
- `design-draft/design-system.md` — 设计 token 与组件规则

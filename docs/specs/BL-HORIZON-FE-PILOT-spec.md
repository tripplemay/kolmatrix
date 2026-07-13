# BL-HORIZON-FE-PILOT — 前端 Horizon 视觉焕新（试点批次）Spec

> 状态：spec locked（2026-07-13，用户 4 项拍板确认）
> 批次类型：新功能批次（UI 视觉重构）— spec 硬性要求
> 车道：快车道（同会话） · 编排：building 串行 / verifying 单隔离 evaluator subagent

---

## 1. 背景与目标

用户希望用一套付费 admin 模板 **Horizon UI Tailwind React NextJS Pro 3.0.0**
（`/Users/yixingzhou/project/db4rDjuaSCqaEFW9XcFo_horizon-tailwind-react-nextjs-pro-3.0.0/horizon-tailwind-react-nextjs-pro-main`）
重构 KOLMatrix 前端。

Planner 可行性分析结论：**模板无法"直接套入"替换底座**——两边框架/路由/样式引擎/i18n/数据层几乎每层不兼容（详 §3）。
可行且有价值的路径是 **保留 KOLMatrix 生产级底座（App Router + RSC + 5 语言 i18n + 多租户 RLS），把 Horizon 的视觉设计语言重实现进现有 shadcn + Tailwind v4 栈**。

考虑到全量重塑涉及 ~165 组件 + 339 处 i18n 调用 + ~30 视觉基线，本批次为**试点**：
把 Horizon 紫色美学落到一个有界切片（全局 App Shell + 旗舰页 `/insight`），跑通「视觉 + i18n + 水合 + 视觉基线」全链路，作为「是否全量铺开」的**决策点**。符合 harness 铁律 1「分批可独立回滚」。

### 用户拍板记录（spec lock 依据）

| # | 决策项 | 用户选择 |
|---|---|---|
| 1 | 重构范围/深度 | **试点先行的设计语言移植**（保留 App Router/RSC/i18n/RLS 底座） |
| 2 | 视觉身份取向 | **整体切换到 Horizon 紫色美学**（紫 brand + navy + 20px 柔和阴影卡 + DM Sans） |
| 3 | 旗舰页 | **`/insight` dashboard**（KPI+recharts 图表最密集） |
| 4 | ADR-003 像素级标准 | **重定基线，标准继续生效**（±2px/ΔE<2 参照物换成 Horizon 新截图，严格度保留） |

---

## 2. 范围边界

| ✅ 本试点包含 | ⏸️ 推迟到「全量铺开」批次（本试点不做） |
|---|---|
| Horizon design token + 字体译进 Tailwind v4 `@theme`（additive） | 其余 ~20 页内容重做（~165 组件大头） |
| App Shell（Sidebar + Topbar）Horizon 化（共享框架，全页生效） | 删除旧 Neural Velocity token（试点期并存） |
| 旗舰页 `/insight` dashboard 内容 Horizon 化 | Stitch 原型重做（改用 design-system.md + 模板作真相源） |
| 新建 ADR-021 + 更新 design-draft/design-system.md | 登录/auth 页、landing 营销页焕新 |
| 受影响页视觉基线重生 + i18n 保真回归 | apexcharts 替换 recharts（recharts 未被 ADR 锁，无需换） |
| Evaluator 试点验收 + 全量铺开可行性建议 | 引入 Chakra/Emotion（模板 7 个 Chakra 交互原语用 Radix/shadcn 等价重写或规避） |

---

## 3. 技术现状与不兼容性分析（论证为何不能直接套模板）

| 层 | KOLMatrix（现网生产） | Horizon 模板 | 结论 |
|---|---|---|---|
| 框架/路由 | Next 16.2.4 **App Router** + RSC + `[locale]` 段 + 中间件鉴权（23 页） | Next 15.1.5 + `routes.tsx` 数组式导航（CRA 移植 SPA 风格） | ❌ 路由范式根本不同 |
| 样式引擎 | Tailwind **v4** CSS-first `@theme`（globals.css 单一真相源） | Tailwind **v3.3** `tailwind.config.js` token | ❌ 大版本不兼容，v3 class token 在 v4 直接失效，须译进 @theme |
| 组件库 | shadcn/ui（Radix headless，8 ui 组件）+ Material Symbols | 纯 Tailwind 为主（215 中 183 纯 className）+ 7 个 Chakra 交互原语 + react-icons | ⚠️ 视觉层可移植；图标/交互原语需换 |
| 图表 | recharts ^3.8.1（未被 ADR 锁，可保留） | apexcharts | ✅ 保留 recharts，只借鉴图表卡视觉 |
| i18n | next-intl 5 语言 × ~1783 key，**339 处调用 / 134 文件** | 无（全硬编码英文） | ❌ 移植组件须逐个回接翻译（最大隐性工作量） |
| 数据 | RSC + server actions + Prisma **RLS 多租户** | 纯客户端 **mock 数据** | ❌ 模板无数据层，只取视觉 |
| React | 19.2.4 稳定 | 19.0.0-**rc** | ⚠️ 只取设计不取代码运行时 |

**Horizon 的真实资产 = 视觉设计语言**（紫 brand `#4318FF`/`#422AFB` + navy 暗色 + 20px 圆角 + 柔和悬浮阴影 shadow-3xl + DM Sans/Poppins + 招牌 dashboard widget/图表卡布局），且以可移植的 Tailwind class 形式交付（不被 Chakra 锁死）。两边**同为 navy 暗色基底**，气质不冲突。

---

## 4. 关键设计决策

### D1 — token 策略 = additive（可回滚核心）
F001 把 Horizon token 作为**新增** `@theme` 条目引入（`--color-brand-*` 紫色阶 / navy 表面调和 / 柔和阴影 utility / 20px radius），
**不删**现有 Neural Velocity token。试点页面（App Shell + `/insight`）消费新 token；其余页面继续消费旧 NV 色 token，内容色不碎。
全量铺开批次再逐页迁移 + 删旧 token。→ 本批次**可整体 revert**。

### D2 — 全局外壳 + 字体切换会波及所有页基线（诚实的有界性）
App Shell（Sidebar/Topbar）是全 23 页共享框架；全局字体 Inter → DM Sans（正文）+ Poppins（标题）也是 `<body>` 级。
因此**所有 app 页的视觉基线都会位移**（框架区 + 字体渲染）。这是选择「整体切 Horizon 美学」的必然代价。
本试点仅**旗舰页 `/insight` 做深度内容重做**；其余页内容样式暂不动（会呈现「旧内容 + 新外壳/字体」的过渡态，可接受）。F005 统一重生受影响基线。

### D3 — ADR-021 正式修订视觉契约
视觉身份整体切换触及 **ADR-003（像素级视觉标准）+ ADR-004（组件库锁定 12）**——它们是"视觉契约"。
F004 新建 **ADR-021「前端视觉语言切换 — Horizon 紫色美学」**：
- amend **ADR-003**：像素级验收标准（±2px / ΔE<2 CIE76 / 字号布局 100%）**继续生效**，仅将参照基线从 Neural Velocity 截图**重定为 Horizon 新截图**（用户拍板 4）
- 记 **ADR-004** 组件库演进：Horizon 引入的新 widget/卡样式纳入公共组件层的口径
- design-draft/design-system.md 增/改「Horizon 设计语言」段，仍作唯一视觉真相源（Stitch 原型重做推迟）

### D4 — 旗舰页 = `/insight` dashboard
`src/app/[locale]/(app)/insight/page.tsx` 动态挂载 `DashboardContent`（`await import()`），
承载 `src/features/dashboard/*`（KpiRow / EmailPerformanceChart / RoiTrendCard / AiMatchRingCard 等 ~14 组件）。
KPI 卡 + recharts 图表密集，最匹配 Horizon 招牌 dashboard 观感。**保 RSC 数据获取 + i18n + 铁律 14 水合边界不破**。

### D5 — i18n 保真（硬约束）
所有被 restyle 的组件**必须保留** next-intl 接线：不得引入模板的硬编码英文文案，
不得断 5 locale（en/zh/ja/ko/es）× ~1783 key 中任何被触及的 key。F002/F003 acceptance 硬性要求 + F005 专门回归。

### D6 — 水合正确性（铁律 14 硬约束）
App Shell + `/insight` 含交互的 `'use client'`/SSR 组件，重构后必须：
console 无 React #418/#425 水合错误 + 交互 onClick 生效。
Evaluator L2 用 headless 浏览器**标准 `locator.click()` 或先等 `[data-ready]` 再点**，
**严禁 `force:true` / `dispatchEvent` / `evaluate(el=>el.click())`**（铁律 14 测法铁律）。

### D7 — 编排
- **车道：快车道**（同会话、单机、无跨机 role_assignments）
- **building：串行** F001→F002→F003→F004→F005（F001/F002/F003 共享 globals.css token 层 + 视觉/水合敏感，**不并行** subagent+worktree）
- **verifying：** 单隔离 evaluator subagent（仅 1 evaluator feature，不 fan-out）
- **role_assignments = null**（默认映射）

---

## 5. 数据准备 / 验收前提

- `/insight` dashboard 需有可渲染的真实/种子数据（KPI 非空、图表有数据点）才能验收视觉。
  Evaluator 验收前确认 staging/local 有登录态 + 该 tenant 的 dashboard 数据非空态（KpiRow 四卡有真值 + 至少一图表有数据）。
- 视觉基线在 **Linux canonical runner** 重生（`update-visual-baselines.yml`），非本机 macOS 直生（跨平台漂移，BL-015 已知）。
- 5 locale 抽查以 en + zh 为主（ja/ko/es LLM 翻译，BL-014 口径）。

---

## 6. Features 摘要（详见 features.json）

| # | executor | 交付物 |
|---|---|---|
| F001 | generator | Horizon token + 字体译进 `@theme`（additive）+ token 映射表 |
| F002 | generator | App Shell（Sidebar+Topbar）Horizon 化（保 nav-config/i18n/水合） |
| F003 | generator | 旗舰页 `/insight` dashboard 内容 Horizon 化（保 RSC/数据/i18n） |
| F004 | generator | ADR-021 + design-draft/design-system.md 更新 |
| F005 | generator | 视觉基线重生 + shape 测试同步 + i18n 5 locale 保真回归 |
| F006 | evaluator | 试点验收 signoff（L1 + L2 headless 水合 + 基线复核 + i18n + ADR 一致性 + 全量铺开建议） |

---

## 7. 铁律核查矩阵（spec lock 前自检）

| 铁律 | 适用性 | 落实 |
|---|---|---|
| #1 分功能实现、独立 commit | ✅ | F001-F006 各独立 commit，可独立回滚 |
| #6 executor 边界 | ✅ | F001-F005 generator / F006 evaluator，不越界 |
| #10 commit-tag 映射 features | ✅ | commit 用 `feat(BL-HORIZON-FE-PILOT-F00X):` |
| #11 状态 JSON 校验 | ✅ | 写盘后 `python3 -c json.load` 校验 |
| #13 commit 前查 staged 索引 | ✅ | 每 commit 前 `git diff --cached --name-only` |
| **#14 SSR 水合验收** | ✅✅ | **本批核心约束**——D6 + F002/F003 acceptance + F006 headless 验收 |
| Planner 铁律 1（核查源码） | ✅ | 旗舰页/字体/ADR/workflow 均已 grep 实物核查（见对话记录） |
| §2.5 Stitch 检查 | ✅ | UI 架构视觉变更；决策：试点期 Stitch 原型重做**推迟**，design-system.md + 模板作真相源（记于 D3） |
| §IA refactor outbound 扫描 | ➖ | 本批不改路由/IA（仅视觉），outbound 一致性不涉及 |

---

## 8. 全量铺开决策点（试点交付后）

F006 evaluator 除 PASS/FAIL 外，须输出**全量铺开可行性建议**：单页平均工时估算、i18n 回接成本、水合风险点、基线重生规模，供用户决定是否启动 `BL-HORIZON-FE-ROLLOUT`（其余 ~20 页 + 删旧 NV token + Stitch 重做）。

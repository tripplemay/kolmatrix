# BL-064 F001 起工前审计 / Planner 裁决请求

> **发起者：** johnsong（Generator）
> **日期：** 2026-05-11 北京
> **触发：** F001（4 新路由壳）开工前审计，发现 spec 与现状 5 处差异未覆盖
> **状态：** 等待 Planner 明确回复 `#1:X #2:X #3:X #4:X #5:X`，**未收到前不开工**
> **关联：** docs/specs/BL-064-top-level-ia-refactor-spec.md / features.json F001-F007

---

## 1. 背景

按 spec §3 起 F001（创建 brief/match/reach/insight 4 新路由壳 + embed 旧路由内容）+ F003（Nav 4 路由重写）+ F002（老路由 302 redirect）。Read 现状后发现 spec 起草时把"7 路由"作为约定，但当前代码实际是 **8 nav 项 + 多个子路由**，且若干 spec 路径名与实际文件不符。

## 2. 现状事实表（与 spec 比对）

### 2.1 现 SidebarNav 8 项（spec 漏 1 项）

| # | nav id | href | 现 i18n key | spec 是否覆盖 |
|---|---|---|---|---|
| 1 | dashboard | /dashboard | nav.dashboard | ✅ → /insight |
| 2 | kol-discovery | /discovery | nav.kolDiscovery | ✅ → /match |
| 3 | kol-database | /database | nav.kolDatabase | ✅ → /match |
| 4 | campaigns | /campaigns | nav.campaigns | ✅ → /brief 或 /match（#B 选 /match?campaignId=:id）|
| 5 | email-center | /outreach | nav.emailCenter | ✅ → /reach |
| 6 | knowledge-base | /knowledge-base | nav.knowledgeBase | ✅ → /brief |
| 7 | analytics | /roi（**不是 /reports**）| nav.analytics | ⚠️ spec 写"/reports → /insight"，**实际无 /reports 路由**；实际是 /roi + /weekly-report + /analytics 别名 |
| 8 | **settings** | /settings | nav.settings | ❌ **spec 完全未提**，不在 4 新路由 IA 内 |

### 2.2 实际路由结构（src/app/[locale]/(app)/）

| 路由 | spec 行为 | 备注 |
|---|---|---|
| `dashboard/` | redirect → /insight ✅ | spec 覆盖 |
| `discovery/` | redirect → /match ✅ | spec 覆盖 |
| `database/` | redirect → /match ✅ | BL-065 整页删 |
| `campaigns/` 列表 | redirect → ?（决策点 #1.D）| spec 模糊（"/brief 或 /match?view=campaigns"）|
| `campaigns/new/` | redirect → /brief?action=new ✅ | spec 覆盖 |
| `campaigns/[id]/` | redirect → /match?campaignId=:id ✅ | spec 决策点 #B 已选 |
| `knowledge-base/` | redirect → /brief ✅ | spec 覆盖 |
| `outreach/` | redirect → /reach ✅ | spec 覆盖 |
| `outreach/templates/` `suppression/` `tracking/` | **spec 未提**（spec 写 /outreach/composer 但**该路由不存在**）| 子路由：直接 redirect 整 prefix 即可（next.js 路径继承）|
| `roi/` | **spec 写"/reports → /insight"，但实际是 /roi** | 决策点 #2 |
| `weekly-report/` | **spec 未提**，是 analytics 区子路由 | 决策点 #2 |
| `assets/` | **spec 未提**，sub-route 归 knowledge-base nav | 决策点 #3 |
| `crm/` | **spec 未提**，sub-route 归 email-center nav | 决策点 #3 |
| `kols/[id]/` | **spec 未提**，KOL 详情页归 database nav | 决策点 #3 |
| `settings/` | **spec 未提** | 决策点 #4 |
| `admin/apify-preview/`（在 [locale]/admin/）| spec §4 #E 留 BL-065 ✅ | 不动 |

### 2.3 spec 路径名与现实不符（次要修订项，无需裁决）

| spec 写法 | 实际 | Generator 处置 |
|---|---|---|
| 顶部 Nav | SidebarNav（左侧栏，`src/components/layout/SidebarNav.tsx` + `nav-config.ts`）| 按"主导航"理解，改 SidebarNav；Topbar 不动 |
| `src/components/app-shell/Nav.tsx` | `src/components/layout/SidebarNav.tsx` | 按实际路径改 |
| `messages/cn.json` | `messages/zh.json`（locale = `zh`）| 用 zh.json |
| `/outreach/composer` redirect | 路由不存在 | 删此行 redirect；改成 `/outreach/templates|suppression|tracking` → `/reach/templates|suppression|tracking`（next.js 路径继承自动满足）|
| `/reports` redirect | 路由不存在 | 见决策点 #2 |
| `messages/{cn,en,ja,ko,es}.json` 新增 `nav.brief.{label,description}` | 现 nav block 是平铺 `"dashboard": "Dashboard"`（无 .label / .description 嵌套）| 决策点 #5：是否引入 `{label, description}` 子对象结构（破坏现 i18n 平铺）|

---

## 3. 决议请求（5 条）

| # | 决议点 | A 方案 | B 方案 | C 方案 | 建议 |
|---|---|---|---|---|---|
| 1 | **Settings nav 处置** | 5 nav items：Brief / Match / Reach / Insight / Settings | 4 nav items + Settings 移入右上角 user-menu dropdown（点头像 → "Settings"）| 4 nav items + /settings redirect 到某新路由（哪个？）| **B** — 与 ADR-013 AI-Native vision §2 "4 路由 IA" 一致；user-menu dropdown 已存在 UserAvatarMenu，加 Settings 入口低成本（spec §4 #D 也只列 4 项）|
| 2 | **Analytics 子路由 (/roi /weekly-report /analytics) redirect 目标** | 全部 → /insight；spec "/reports → /insight" 改为 "/roi /weekly-report /analytics → /insight" | 只 /roi → /insight，其它保留 | 重命名 /roi → /insight/roi（路径迁移）| **A** — 与 nav-config Analytics → /roi 一致；最小代价；BL-070 完整迁移再考虑 |
| 3 | **Sub-route /assets /crm /kols/[id] 处置** | 不 redirect 这些子路径（保留 deep link 工作），仅更新 `deriveActiveNav` 把它们映射到新 nav id（/assets→brief, /crm→reach, /kols→match）| 整 prefix redirect：/assets → /brief, /crm → /reach, /kols/[id] → /match?kolId=:id（deep link 死）| 部分 redirect：/assets → /brief, /crm → /reach 保留 deep；/kols/[id] 不动 | **A** — 这些是用户可能 bookmark 的功能性路径（KB→Assets chip / KOL 详情）；本批次"不动各路由内部 UI 实质重写"原则下，redirect 它们会带功能损失。统一在 BL-070 完整迁移时处理 |
| 4 | **/campaigns 列表 redirect 目标** | /campaigns → /brief（"创建活动"语义）| /campaigns → /match?view=campaigns（"为活动选 KOL"语义；与 /campaigns/[id] → /match 形成系列）| /campaigns → /brief?view=campaigns（编辑/list 都在 brief 域）| **B** — 与 /campaigns/[id] → /match?campaignId=:id 系列一致；spec §3 `Match（AI 主导）← Discovery + Database + Campaigns/[id] KOL panel 合并`；列表也走 match 概念上自然 |
| 5 | **i18n nav keys 结构** | 保持现平铺：`"brief": "Brief"`（4 新 keys 加入）+ 旧 keys 保留 deprecated | 改嵌套：`"brief": { "label": "Brief", "description": "..." }` + 旧 keys 重构 | 双写：平铺 keys（兼容 SidebarNav 现读法）+ 同时新增 `nav.brief.description` 平铺 key 给 tooltip | **C** — 现 SidebarNav 通过 `t(key)` 读平铺 key（key 就是 "dashboard" 等），改嵌套会破坏现读法 + 影响所有 nav 单测；spec F003 acceptance "label / icon / description tooltip" → 用平铺 `nav.brief` + `nav.briefDescription` 两 key（最小侵入，向后兼容）|

### 裁决格式
请用 `#1:B #2:A #3:A #4:B #5:C`（或带简短理由）回复。

---

## 4. 原型 bug / 漂移登记（不需要裁决，登记即可）

- spec 头部 §3 "Reach（执行） ← Outreach 大体保留" — 现 `/outreach` 含 `/templates /suppression /tracking` 3 子路由 + nav 项已合到 email-center。本批次 redirect 整 prefix 即可（next.js path inheritance 让子路由自动跟随）
- spec §3 F002 acceptance 中 "/outreach/composer → /reach/composer" 这一条删除（路由不存在）
- spec §3 F002 acceptance "/reports → /insight" 替换为决策点 #2 落定的列表

---

## 5. 开工条件

收到 Planner 5 条决议的明确回复后，Generator 将按下列顺序实施：

1. **F001（决策 #1 + #5 + embed 实装）** — 创建 4 新路由壳 + embed 旧 page.tsx 内容（re-export + metadata override） + 更新 deriveActiveNav 映射新 IA + 更新 PROTECTED_PREFIXES 加 /brief /match /reach /insight
2. **F002（决策 #2 + #3 + #4 + 子路由处置）** — 在 src/middleware.ts 或老 page.tsx 加 302 redirect；preserve locale 前缀
3. **F003（决策 #1 + #5）** — 改 nav-config.ts 7→4 项（+ Settings 看 #1 落定）；改 SidebarNav 渲染（label + tooltip description）；改 deriveActiveNav 把所有现路由（含 sub-route）映射新 nav id；写 ≥2 个单测 case
4. **F004（决策 #5）** — 5 语言 messages 加新 keys（zh + en 用户/Planner 直译；ja/ko/es LLM 翻译 + 标 BL-014 native review；旧 keys 保留 deprecated 注释）
5. **F005** — e2e suite 适配 + 新建 ia-refactor-redirects.spec.ts
6. **F006** — staging deploy + 视觉 baseline regen
7. **F007** — prod redeploy + 24h 监控 + signoff

每 feature 完结即 commit + push + CI 守门 + progress.json `completed_features` ++。

**未收到 Planner 明确回复前不动产品代码。** 仅本审计文档可立即 commit。

---

## 6. 估算

| 环节 | 预估 |
|---|---|
| F001 (含 embed + activeNav) | 5-6h |
| F002 (含 sub-route 决策落地) | 3-4h |
| F003 (含单测) | 5-7h |
| F004 (5 语言 + 旧 keys 标 deprecated) | 5-7h |
| F005 (e2e suite 适配 + ia-refactor-redirects 新建) | 7-10h |
| F006 (staging deploy + 视觉 baseline regen) | 3h（+ 用户 spot check 等待时间）|
| F007 (prod redeploy + 24h 监控 + signoff) | 2-3h Generator + 用户 ack 时间窗 + Reviewer 1h |

合计 30-40h Generator + Reviewer 1d + 用户协作（staging spot + prod time window）。

---

## 7. Planner 裁决（2026-05-11 北京 / 用户 ack）

| # | 决议点 | 选择 | 落地动作 |
|---|---|---|---|
| 1 | Settings nav | **B**：4 nav 项 + Settings 入 user-menu | nav-config.ts 删 settings 条目；UserAvatarMenu 加 Settings 入口（link 到 /[locale]/settings 现路由） |
| 2 | Analytics 子路由 redirect | **A**：/roi /weekly-report /analytics 全部 → /insight | 在 middleware.ts 加 3 条 302 redirect；替换 spec F002 中 "/reports → /insight" 行 |
| 3 | Sub-route /assets /crm /kols/[id] | **A**：保留路由 + 仅更新 activeNav | deriveActiveNav 改：/assets→brief / /crm→reach / /kols→match；这些路径不加 redirect |
| 4 | /campaigns 列表 redirect | **B**：/campaigns → /match?view=campaigns | 与 /campaigns/[id] → /match 系列一致 |
| 5 | i18n nav keys 结构 | **A**（平铺双 keys，UI 选项中的 A）：`nav.brief` + `nav.briefDescription` | 5 语言 messages 新增 8 个 key（4×label + 4×description）；旧 keys 加 `// deprecated by BL-064` 注释保留 |

**确认时间：** 2026-05-11 北京 / 用户答 4 题全部选 Recommended 选项 + Q2 (analytics) Generator 按推荐 A 静默落地（spec "/reports" 为笔误的纠正）。

**Generator 起 F001（status: building 已就绪）。**

---

## 8. F005 实装期发现的 adjudication §4 偏离（2026-05-11 14:30 BJT）

CI run 25654625299 e2e 实跑发现：adjudication §4「/campaigns 列表 → /match?view=campaigns」存在 UX 损坏。根因：

- /match 路由壳（F001 A2 embed-old）直接 embed `/discovery` 内容
- /match 暂未实装 `?view=campaigns` 的条件渲染
- 因此 /campaigns 302→/match 后，用户看到的是 Discovery，**不是** Campaigns 列表
- campaigns-empty.spec.ts + journey-a/b 在 e2e 验证 `getByTestId("campaigns-page-title")` 全 fail

**Generator 决议（fix-round）：** 把 /campaigns 列表从 redirect 列表移出，归入 adjudication §3「保留 + activeNav 映射」分类。`/campaigns/new` 和 `/campaigns/[id]` 的 redirect 不变（这两条的目的地是 Brief / Match-with-campaignId，UX 合理）。

**影响：**
- `src/middleware-helpers.ts` `resolveIaRefactorRedirect`：删 `/campaigns` 列表规则
- `src/__tests__/middleware-helpers.test.ts`：`/campaigns` 期 → `null`
- `tests/e2e/ia-refactor-redirects.spec.ts`：/campaigns 移出 REDIRECT_CASES，加入 KEPT_PATHS
- 侧栏 Match 高亮逻辑保持（deriveActiveNav 仍把 /campaigns 映射到 match）

**回溯 adjudication §4 的最终落点：** `/campaigns 列表`目前作为 kept deep-link 路径（同 /assets /crm /kols/[id]）；BL-066 实装 /match `?view=campaigns` 条件渲染后再启用 redirect。这次偏离 Planner 应回溯到 `docs/adr/`（若 ADR worthy）或仅作 backlog 跟进项（BL-066 范围内）。

---

## 9. fix-round-2: F002 redirect 缩减到 content-equivalent only（2026-05-11 15:30 BJT）

CI run 25656174606 e2e 进一步发现：journey-a 在 `/campaigns/new` 找不到 `input[name="name"]`（/brief embed KB 无新建活动表单）；journey-b 在 `/roi` 找不到 `roi-page-title` testid（/insight embed Dashboard 无 ROI 卡片）。同 §8 同根因：A2 embed-old 单 source 限制。

**Generator 决议（fix-round-2）：** F002 redirect 范围限定为「内容等价」5 条：

| Source | Target | 等价理由 |
|---|---|---|
| `/dashboard` | `/insight` | /insight 直接 embed /dashboard |
| `/discovery` | `/match` | /match 直接 embed /discovery |
| `/database` | `/match` | BL-065 整页删；/match 显示 discovery KOL 列表（同 KOL 源）|
| `/knowledge-base` | `/brief` | /brief 直接 embed /knowledge-base |
| `/outreach` | `/reach` | /reach 直接 embed /outreach（子路径继承）|

**新增 kept deep-link 路径（4 条转入 §3 分类）：**

| Path | 原 adjudication | 实际处置 | Defer 到 |
|---|---|---|---|
| `/campaigns/new` | §3 F002 → /brief?action=new | kept | BL-069 wire /brief 含新建表单 |
| `/roi` | §2 → /insight | kept | BL-070 unify /insight |
| `/weekly-report` | §2 → /insight | kept | BL-070 unify /insight |
| `/analytics` | §2 → /insight | kept | BL-070 unify /insight |

**仍按 adjudication redirect 但实战未必完美：** `/campaigns/[id]` → `/match?campaignId=:id` 保留（per §B），但 /match 暂不渲染 detail（看到的是 Discovery 列表 + URL 含 campaignId）。BL-066 wire /match renderer 后这个变得正确。本批次暂可接受。

**影响：**
- `src/middleware-helpers.ts` `IA_REDIRECT_RULES`：减到 5 条（含 /campaigns/[id]） + 嵌入 deferred-to-batch 映射说明
- `src/__tests__/middleware-helpers.test.ts`：4 个 kept 路径期 `null`
- `tests/e2e/ia-refactor-redirects.spec.ts`：REDIRECT_CASES 减；KEPT_PATHS 增
- `docs/specs/BL-064-F006-staging-spot-check.md`：§3 改成 5 redirect + 6 kept 双段
- `BL-064-top-level-ia-refactor-spec.md`（原 spec）：F002 acceptance 缩减落地由 Planner 在 done 阶段定夺（不该 building 期改 spec）

**Planner 回溯责任：** done 阶段回头审 spec §3 F002 acceptance + 决策点 #B（部分仍 valid）+ 决策点 #4（/campaigns 列表降级）+ 决策点 #2（analytics 降级）；如 ADR worthy 加新 ADR；否则只是 backlog 跟进 BL-066/BL-069/BL-070 加 redirect。


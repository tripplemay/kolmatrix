# BL-072 Prod Hotfix — Phase A0 Audit + A1 Lock 决策

> **执行：** 2026-05-25 北京 / Planner Kimi
> **范围：** 4 prod issues 用户描述 + Planner 实地 grep 根因 + lock 修复方向
> **状态：** ✅ Phase A0 + A1 完成 → 待 BL-071 done 后入 planning（用户 5/25 ack 顺序 C）
> **类型：** Prod hotfix（铁律 #9）— src/ business code 修复 + CI 防御补强，与 BL-071 framework only 不冲突域

---

## §1 4 Prod Issues 汇总

| # | 症状 | 根因模式 | 文件数 | 严重度 |
|---|---|---|---|---|
| 1 | /brief 宽度异常窄（768 vs 1600） | BL-069 起 /brief 时窄表单审美设计；BL-070 4 路由 IA 统一后**未同步对齐** max-width | 1 | P2 |
| 2 | /insight 中文模式大量英文 | BL-070-F003 实装 /insight 漏 t() wiring（6 处硬编码 + InsightTabs labels prop 未传 + ReportsPanel/AnalyticsPanel zh.json keys 缺） | 3-5 | P1 |
| 3 | /match TABLE_RO 字面文字 | Material Symbols 子集 script Pattern 1-5 不能捕跨行 JSX 三元；BL-066/070 IA refactor 新增 `table_rows` ligature 未追 manifest | 2 (1 src + 1 script) | P1 |
| 4 | /insight QuickActions / GreetingBar 等按钮 404 | BL-070-F004 删 5 老路由 + middleware 即停 redirect，但**未 grep 全仓更新 outbound 链接**（10 处残留） | 10 | P1 |

## §2 总根因模式（共性反思）

BL-070-F003/F004/F005 IA refactor 大范围结构改动后，缺乏 **outbound 一致性扫描**：
- Issue #1 ↔ visual 宽度一致性（4 路由）
- Issue #2 ↔ i18n 消费侧 t() wiring（page.tsx 创建后）
- Issue #3 ↔ Material Symbols 子集 manifest（新增 ligature 时）
- Issue #4 ↔ 路由删除后 outbound 链接（"删 X 前 grep callers"）

**测试基建漏检共同点：** 4 个 bug 都有现成测试都不命中 —
- visual baseline test 不验跨 4 路由宽度一致性（spec checklist 漏项）
- i18n-locale-coverage test 不验 page-side 消费侧（仅 key parity + value ≠ en）
- material-symbols subset script 不验 woff2 glyph table ⊇ src 提及 ligature
- E2E IA refactor 测入站 redirect 不测 outbound link target

**沉淀价值：** 4 个 bug 沉淀至少 4-6 条 framework 规律候选（可入 BL-071 sediment batch 末尾 or BL-073 独立 sediment）。

---

## §3 Issue #1 详细根因

**文件：** `src/app/[locale]/(app)/brief/page.tsx:75`

```tsx
<div className="mx-auto max-w-3xl space-y-6 pb-16">
//                    ^^^^^^^^^ 768px 上限，明显比其他 3 路由窄
```

**4 路由 IA 容器宽度对比：**

| 路由 | 容器 | max-width |
|---|---|---|
| /brief | `mx-auto max-w-3xl` | **768px** ← 异常 |
| /match | `mx-auto max-w-[1600px]` | 1600px |
| /reach | `mx-auto flex max-w-[1600px]` | 1600px |
| /insight | `mx-auto max-w-[1600px]` | 1600px |

**修复：** `page.tsx:75` 改 `max-w-3xl` → `max-w-[1600px]`，与 3 路由对齐。

**注意点：** /brief 含 2 个 tab：
- `tab=campaign`（默认）：CampaignForm 是窄表单，1600px 容器下需确保 form 本身保持可读宽度（form 内部已有 `max-w-2xl` 等约束）
- `tab=products`：ProductListPanel 列表，1600px 顺势变宽，符合预期

需 Generator 实装时 spot check：BriefPageClient / CampaignForm 内 form 行宽不能因外容器变 1600 而变得不可读。

---

## §4 Issue #2 详细根因

### 4.1 Layer 1 — /insight/page.tsx 硬编码英文

| 位置 | 硬编码 | 应走 i18n key |
|---|---|---|
| L61 `<h1>` | `Insight` | `t("pageTitle")` |
| L64 subtitle | `Dashboard, reports, and (soon) analytics — your global KOL marketing pulse.` | `t("subtitle")` |
| L98 ReportsPanel `<h2>` | `Reports` | 缺 zh.json key（待补 `reports.title`） |
| L100 ReportsPanel body | `AI-generated weekly performance reports for your tenant.` | 缺 key（待补 `reports.body`） |
| L119 AnalyticsPanel `<h2>` | `Analytics` | 缺 key（待补 `analytics.title`） |
| L121 AnalyticsPanel body | `Phase 5 — coming after the public launch. Stay tuned for AI-learned preferences and cross-campaign trend analysis.` | 缺 key（待补 `analytics.body`） |
| L38 metadata | `title: "Insight — KOLMatrix"` | 通常 metadata 单独处理（保 brand 英文 OK） |

### 4.2 Layer 2 — InsightTabs labels prop 默认英文 + 调用方未传

`src/app/[locale]/(app)/insight/InsightTabs.tsx:46-50`：

```tsx
const DEFAULT_LABELS: TabLabels = {
  dashboard: "Dashboard",
  reports: "Reports",
  analytics: "Analytics",
};
```

`page.tsx:68` 调用：`<InsightTabs locale={locale} activeTab={tab} />` 不传 labels → fallback 永远英文。但 zh.json 有 `insight.tabs.{dashboard,reports,analytics}` = "仪表盘"/"报告"/"分析"，**消费侧未调用**。

修复：page.tsx 改 `<InsightTabs locale={locale} activeTab={tab} labels={{dashboard: t("tabs.dashboard"), reports: t("tabs.reports"), analytics: t("tabs.analytics")}} />`。

### 4.3 Layer 3 — zh.json insight 段半英文（A1 lock：brand kept-en）

```json
"insight": {
  "pageTitle": "Insight",                           // brand kept-en（lock A）
  "subtitle": "Dashboard、Reports、(即将) Analytics — 全局 KOL 营销脉搏。",  // brand kept-en（lock A）
  "tabs": { "dashboard": "仪表盘", "reports": "报告", "analytics": "分析" }  // 真翻保
}
```

**A1 用户 5/25 lock 翻译策略 A（brand kept-en）：**
- Insight / Dashboard / Reports / Analytics 全部保英文作 brand 名（与 sidebar.insight = "洞察" 形成 brand 与 nav 分层 — sidebar 用本地化中文，page heading 用 brand 英文）
- 加入 `tests/unit/i18n-locale-coverage.test.ts` 的 `KEEP_AS_EN_PATHS` allowlist：`insight.pageTitle` / `insight.subtitle` 完全保 en；新补的 `insight.reports.title`/`.body` 和 `insight.analytics.title`/`.body` 也保 en
- subtitle 中 "Dashboard、Reports、(即将) Analytics" 这部分 brand 英文保留，"全局 KOL 营销脉搏" 中文保留 → 混杂可接受（实际是 brand 名 + 描述）
- Sidebar 的 `sidebar.insight = "洞察"` 与 page heading 的 `insight.pageTitle = "Insight"` 是双层设计：nav 帮用户认知，brand 帮用户记住产品名

### 4.4 Layer 4 — i18n 测试基建漏检 page-side 消费侧

`tests/unit/i18n-locale-coverage.test.ts` 只验：
1. zh.json key parity == en.json
2. zh leaf 值 ≠ en 源（除 allowlist brand 等）

**不验：** page.tsx / 组件是否实际调用 `t(<key>)` 或硬编码英文。BL-070-F003 实装 /insight 即使全硬编码，i18n-locale-coverage 仍 8/8 PASS。

### 4.5 4 路由 t() 使用频次粗扫（issue 2 全面 audit 起点）

| 路由 | t() 调用 | 评估 |
|---|---|---|
| /brief | 23 | ✅ |
| /match | 24 | ✅ |
| /reach | **10** | ⚠️ 偏低需细查 |
| /insight | **6** | ❌ 严重不足 |

F003 全面 audit 时需要：
- /reach + 4 路由嵌入组件（DashboardContent / KpiRow / WorkflowSteps 等）硬编码英文 sweep
- 5 locale 翻译完善度 spot check
- 补 page-side i18n 消费侧 test 探针（v0.9.21 BL-064-R1 沉淀方向类似但未落地）

---

## §5 Issue #3 详细根因

### 5.1 直接原因

`src/app/[locale]/(app)/match/MatchSummaryBar.tsx:94-99`

```tsx
<span className="material-symbols-outlined text-[16px]" aria-hidden>
  {v === "card" ? "grid_view" : "table_rows"}
</span>
```

Material Symbols 子集字体（`src/app/fonts/material-symbols-outlined.woff2` 11008B）**不含 `table_rows` glyph**，浏览器 fallback 到 system font → 字面渲染 ligature 文字。

### 5.2 Subset script 5 个 Pattern 都不能捕跨行 JSX 三元

`scripts/regenerate-material-symbols-subset.sh`：

| Pattern | 能否捕 JSX 三元 | 解释 |
|---|---|---|
| 1 同行 `>icon<` | ❌ | 多行 + 表达式不匹配 |
| 2 多行 (`-A 1`) | ❌ | 跨行偏移 + 表达式不是 bare string |
| 3 `icon: "name"` | ❌ | 不是 object key |
| 4 `icon="name"` | ❌ | 不是 JSX prop |
| 5 manifest 手工 | 视维护 | grid_view 历史在 manifest 标 `discovery/SummaryBar.tsx:83 \| JSX ternary`；table_rows 未追加 |

### 5.3 为什么 grid_view OK 但 table_rows 漏？

- grid_view manifest 历史已添加（labeled "discovery/SummaryBar.tsx:83 | JSX ternary"）— 老路径 discovery 改名 match/MatchSummaryBar.tsx 时 manifest 标签未更新但 icon 已在
- table_rows 是 BL-066/070 IA refactor 引入的新 icon，仅出现在该一处 JSX 三元，Pattern 1-5 全部漏 + manifest 未追加

### 5.4 同类问题全面 audit

扫全 src/ 所有 `material-symbols-outlined` 上下文 ±5 行 quoted strings vs 当前 subset：

| 候选 ligature | 来源 | 是否真 icon |
|---|---|---|
| `table_rows` | MatchSummaryBar JSX 三元 | ✅ **真漏（本 bug，唯一一例）** |
| `ai_generated`, `card`, `duplicate`, `end`, `offline`, `body`, `cta`, `h2`, `invisible`, `left`, `lg`, `normal`, `platforms`, `sm`, `start`, `title`, `truncate` | 变量值 / asset source / CSS variant / data-state | ❌ false positive |

15 个 JSX 三元 ligature 中，其余 14 个（auto_awesome / check / close / done_all / edit / grid_view / mail / movie / progress_activity / remove / subdirectory_arrow_right / view_list / wifi / wifi_off）因在其他**单行 callsites 也使用** → Pattern 1 catches。**仅 table_rows 一例**因孤本 JSX 三元 + manifest 未追加而漏。

### 5.5 潜伏风险（未来必爆）

- 任何新 ligature 仅出现在 JSX 三元 / 对象 value（非 `icon:` key）/ return 语句 / `??` fallback 都会沉默 ship 损坏的 UI
- 没有 CI step 在 build time 验「所有 src/ 提及 ligature ⊆ subset 字体 glyph 表」
- 没有 visual test 探针在 staging 跑 4 路由 icon 区域快照对比
- script `BL-025-F009 sweep retro` 已警告 Pattern 6/7（array elements / return statements）false-positive 高所以保 manifest，但 manifest **维护靠人记忆**，BL-066/070 IA refactor 改名时未同步追新 ligature

---

## §6 Issue #4 详细根因

### 6.1 全 src/ outbound stale link audit — 10 处

| # | 文件:行 | 现 href | 触发 UI | 应改 |
|---|---|---|---|---|
| 1 | `features/dashboard/QuickActions.tsx:22` | `/knowledge-base` | "录入产品" (本 bug) | `/brief?tab=products` |
| 2 | `features/dashboard/QuickActions.tsx:23` | `/discovery` | "发现 KOL" (本 bug) | `/match` |
| 3 | `features/dashboard/QuickActions.tsx:24` | `/database` | dashboard QuickAction | `/match?view=table` |
| 4 | `features/dashboard/GreetingBar.tsx:29` | `/campaigns/new` | "新建活动" gradient button | `/brief` |
| 5 | `app/[locale]/(app)/crm/CrmPipelineBars.tsx:55` | `/database?status=` | CRM 漏斗 bar click | **`/crm?status=`**（A1 lock A） |
| 6 | `app/[locale]/(app)/insight/weekly-report/WeeklyReportHeader.tsx:100` | `/weekly-report?range=` | 周报顶部 range tabs | `/insight/weekly-report?range=` |
| 7 | `app/[locale]/(app)/insight/weekly-report/WeeklyReportNavSelectors.tsx:57` | `/weekly-report?` | 周报 nav selector router.push | `/insight/weekly-report?` |
| 8 | `app/[locale]/(app)/kols/[id]/page.tsx:157` | `/database` | KOL 详情 "Back to Database" | **`/kols`**（A1 lock A） |
| 9 | `app/[locale]/(app)/campaigns/page.tsx:69` | `/campaigns/new` (`newCampaignHref` var) | /campaigns 列表 "新建" | `/brief` |
| 10 | `app/[locale]/(app)/campaigns/AiSuggestionsCard.tsx:12` | `/discovery` (fallback) | empty state CTA | `/match` |

`/campaigns` (list) 本身 alive；仅 `/campaigns/new` 死。

### 6.2 i18n 标签同步问题

QuickActions 用 i18n key `dashboard.quickActions.{knowledgeBase|discovery|database|campaigns}` — 标签"录入产品"、"发现 KOL"等指向**已废业务名**。href 改 + 5 locale 翻译同步：

| key | 现 zh 值 | 建议改 |
|---|---|---|
| `knowledgeBase` | "录入产品" | "管理产品" 或 "Brief 产品库" |
| `knowledgeBaseDescription` | （待查） | 对齐新 IA |
| `discovery` | "发现 KOL" | "匹配 KOL" 或 "Match" |
| `discoveryDescription` | （待查） | 对齐新 IA |
| `database` | "KOL 库" (推测) | "KOL 表视图" 或合并入 discovery |
| `databaseDescription` | （待查） | 对齐 |

Generator 实装时需读 messages/{zh,en,ja,ko,es}.json 实际值再决定改名 vs 改 description。

### 6.3 为什么测试没捕

- BL-070 F006 e2e 全量重写测的是 IA 入站 redirects（middleware 层「老路径 → 新路径」）
- **没有 outbound link target validation** — 没探针验"src/ 中每个 Link href 都对应 valid 路由"
- Visual baseline 不测 click target
- next 没启 `experimental.typedRoutes`（启用后 TypeScript 会在 build 时验 href 在路由 manifest 中）

---

## §7 A1 Lock 决策（用户 5/25 18:30 ack）

| 决策 | Lock | 理由 |
|---|---|---|
| **顺序** | C: BL-071 先完后 BL-072 | BL-071 已 F001 done 进 building，~4-5 day 完成；BL-072 4 issue 均 src/ 业务代码（与 BL-071 framework-only 不冲突域），可顺序排队不影响 IA refactor 主线 |
| **范围** | A: 完整版 F001-F008 | 含 i18n 全 audit (F003) + Material Symbols Pattern 6 (F005) + CI 三向防御 (F007)；长期收益最大，~20-25h ≈ 2.5-3 day Generator + 0.5 day Reviewer |
| **i18n** | A: brand kept-en | Insight/Dashboard/Reports/Analytics 全部保英文 brand；sidebar.insight = "洞察" 与 page heading 双层（nav 本地化 + brand 英文）；test 加 KEEP_AS_EN_PATHS allowlist |
| **stale link** | A: CrmPipelineBars → /crm?status=, kols/[id] → /kols | CRM 跟进留 /crm 内简单；KOL 详情 Back 返回 /kols（仍 alive）；语义合理不混路由 |

---

## §8 BL-072 预案 features（待 BL-071 done 后 lock）

| # | Feature | 估时 | executor |
|---|---|---|---|
| F001 | /brief 宽度 `max-w-3xl` → `max-w-[1600px]` 对齐 4 路由 + form 行宽 spot check | 0.5h | generator |
| F002 | /insight i18n wiring 补全（page.tsx 6 处 + InsightTabs labels 传值 + ReportsPanel/AnalyticsPanel zh.json keys 补 + 5 locale + KEEP_AS_EN_PATHS allowlist 加） | 2.5h | generator |
| F003 | i18n 全面 audit 修复（/reach 偏低复查 + 4 路由嵌入组件 hardcoded English sweep + 5 locale 完善度 + KEEP_AS_EN_PATHS 增量） | 4-6h | generator |
| F004 | Material Symbols `table_rows` 加 manifest + 跑 regenerate-material-symbols-subset.sh + 重生 woff2 + commit | 0.5h | generator |
| F005 | 改 regenerate script Pattern 6 JSX 三元 grep（含 false-positive 词排除）+ 重生 manifest 增量 + 文档化 manifest 维护惯例 | 2h | generator |
| F006 | 10 处 outbound stale link 修复（含 QuickActions / GreetingBar / CrmPipelineBars / WeeklyReportHeader / WeeklyReportNavSelectors / kols/[id] / campaigns list / AiSuggestionsCard）+ i18n key 标签同步（4 key × 5 locale） | 3-4h | generator |
| F007 | CI / test 防御三件套：(1) link-target audit test（grep src/ href literals 比对路由树 + middleware redirect map）(2) Material Symbols glyph 三向断言（manifest ⊆ woff2 ⊇ src/ 提及）(3) i18n page-side 消费侧探针（grep raw English ≥4 char in 4 路由 page.tsx + 主组件） | 4-6h | generator |
| F008 | Reviewer L1+L2 抽样验证 + signoff doc | 3h | codex |

**总：** ~20-25h ≈ 2.5-3 day Generator + 0.5 day Reviewer

---

## §9 Sediment 候选（BL-072 done 后入下个 framework batch）

4 条预候选规律：

1. **大范围结构改动（IA refactor / 路由删除 / 重构）必须有 outbound 一致性扫描清单**：visual 宽度 / i18n t() wiring / Material Symbols manifest / 路由 outbound links — 这 4 维度合并入「IA refactor checklist」段（planner-checklists.md 新 §或合并 v0.9.21 BL-064 沉淀）
2. **subset script grep pattern 漏 JSX 三元 — Pattern 6 模板**（含 false-positive 排除清单 + manifest 增量维护惯例）→ generator.md 或 checklists/material-symbols-pattern.md
3. **i18n 消费侧 test 探针缺失** — page-side hardcoded English sweep + correlate t() usage 模式（与 v0.9.21 BL-064-R1 沉淀方向类似但未落地，本次补）→ evaluator.md L1 验收前置或 generator.md i18n 段
4. **删路由前必须 grep 全仓 outbound 链接**（与 BL-070 #19 i18n callers 同主题合并）→ generator.md §"删 X 前 grep callers" 矩阵扩展（v0.9.23 候选 #19 路由版本）

---

## §10 下一步

- BL-071 building 继续（johnsong F001 done, F002-F010 pending）
- BL-072 入 backlog 排队（本 audit doc 是 spec material）
- BL-071 done 后，Planner 读 backlog.json 看到 BL-072 high priority + 本 audit doc → 按 §8 起 features.json + 完整 spec → status=building
- 4 issue 待 BL-072 done 后进 prod，预期总耗时 BL-071 5 day + BL-072 3 day = ~8 day after 本 lock

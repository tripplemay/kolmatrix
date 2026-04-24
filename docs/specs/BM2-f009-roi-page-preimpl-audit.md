# BM2 F009 · `/roi` 前置审计（正式）

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-24
> **依据：** `framework/harness/ui-fidelity-guardrail.md` §3 + `framework/harness/pre-impl-adjudication.md`
> **状态：** 🟡 **等待 Planner 裁决**。本审计 §13 留白；不自裁决；Generator 不开工直至 Planner 提交 main 裁决。
> **提交：** 单 commit `docs(audit): BM2-F009 /roi pre-impl audit` 推 main。

---

## 1. 背景 & 主漂移要点

spec §F009 定义 4 section（4 KPI / 30 天趋势线图 / Campaign ROI 表 / AI Insights on-demand）。
Stitch `roi-tracking.html`（563 行）实际呈现：
- 顶部：breadcrumb（Analytics → ROI Tracking）+ 页标题 + 描述 + 时间 toggle（7D / **30D** / 90D / All-time）+ Sync 按钮 + AI Insights 按钮 + **Record revenue** 主 CTA
- Section A — 4 KPI（Total Spend + sparkline + period-vs / Total Revenue + sparkline / **Average ROI** 高亮 cyan-gradient + bolt 标记 / **Active Campaigns** 含"3 ending in <48h" 副标）
- Section B — 60/40 split：左是 **Quarterly Budget Q2 2026** 卡（Spent/Committed/Remaining 堆叠条）+ **Spend & Revenue Trend** 6 月柱状图（每月 cyan bar revenue + 灰 bar spend + 紫色 ROI% 折线 SVG overlay）；右是 **AI Insights** panel（3 例硬编 + "Generate Full Report" 按钮）
- Section C — Campaign ROI Analysis 表（Campaign / Product / Period / Spend / Revenue / ROI badge / Status；行点击跳详情；右上 filter input）

⚠️ **核心漂移：**
- spec KPI #4 = "Top Campaign ROI"，Stitch KPI #4 = "Active Campaigns"
- spec 趋势 = recharts line chart（spend+revenue 双线 + ROI% 次轴），Stitch = bar+line（柱状 + 紫色折线 overlay）
- spec AI Insights = 4 section 平级整块，on-demand 按钮 + localStorage cache；Stitch 把 AI Insights 当 Section B 右侧 panel 又同时在顶部放按钮（双重入口）
- Stitch 顶部 "Record revenue" CTA 在 spec 找不到（revenue 录入在 /campaigns/:id detail 的 RevenueRecorder，不在 /roi）
- Stitch "Quarterly Budget" 卡需要 `Tenant.budgetTotal` 字段（schema 无）+ committed 数据（无）

---

## 2. Stitch 元素逐条分类（`ui-fidelity-guardrail §3.1`）

| # | Stitch 元素 | 数据可得性 | A 照原型 | B 简化/drop | C 占位 |
|---|---|---|---|---|---|
| 1 | Breadcrumb (Analytics → ROI Tracking) | 静态 | 实现 | drop | — |
| 2 | 时间 toggle 4 段 (7D / 30D / 90D / All-time) | 需要 `?days=N` 贯穿到 trend / summary | 全实现：URL `?days=N` + UI 切换 | drop（默认 30D 不可调）| 仅 30D active + 其余 disabled+tooltip "B4 time-range filter" |
| 3 | Sync 按钮 | 数据本身就是实时（RSC 直读 DB），不需要 sync | 实现"刷新"语义（router.refresh）| drop | disabled + tooltip "Auto-refresh on page load" |
| 4 | AI Insights 顶栏按钮 | 与 §F009 §4 spec 重复 | 实现，与 Section B 右侧 panel 联动滚动 | drop（仅 Section B 右侧 panel 唯一入口）| — |
| 5 | "Record revenue" 主 CTA | 数据流不在 /roi（在 /campaigns/:id）| 跳 /campaigns 列表（用户挑 campaign 后再录）| drop | disabled + tooltip "Record on the campaign detail page" |
| 6 | KPI #1 Total Spend + 5 段红色 sparkline + "+12.4% vs last period" | F008 summary.totalSpend ✓；sparkline 需 daily history; 比例对比需保留上一窗口数据 | 全实现 | drop sparkline + period-vs（仅大数字）| 实现大数字 + sparkline，drop period-vs（无窗口对比能力 MVP）|
| 7 | KPI #2 Total Revenue + sparkline + "+28.1% vs last period" | 同上 | 同上 | 同上 | 同上 |
| 8 | KPI #3 Average ROI + cyan-gradient + "High Velocity detected" 副标 | F008 summary.avgRoiPercent ✓；副标静态 | 全实现：动态 + 静态副标"High Velocity / Steady / Cooling" 由 ROI 阈值判断 | 实现：仅大数字，副标静态"30D average" | — |
| 9 | KPI #4 Active Campaigns + "3 ending in <48h" | F008 summary.campaignCount.active ✓；ending<48h 需 endDate 比较 | 全实现 | 改 spec 原版 "Top Campaign ROI"（F008 summary.topCampaign）| — |
| 10 | Quarterly Budget Q2 2026 卡（Total Cap $500K + Spent/Committed/Remaining 堆叠条）| **schema 无 Tenant.budgetTotal**；Committed/Remaining 派生需要"未来计划"概念 | 加 schema migration + UI（超 F009 scope）| drop 整块 | 显示静态展示卡 "Quarterly budget tracking ships in B4" |
| 11 | Spend & Revenue Trend chart 6 月柱状（bar+line overlay）| F008 trend ✓ daily 数据；需要 monthly bucket 转换 OR 直接显 30 天 daily | recharts ComposedChart：bar(spend) + bar(revenue) + line(roi% 次轴)；30D daily | 实现 spec 原版 line chart（spend / revenue 双线 + ROI% 次轴）| — |
| 12 | AI Insights 3 例 hardcoded + "Generate Full Report" 按钮 | spec §4 要求 on-demand button + 3-5 真实 insights via aigcgateway + localStorage cache | 实现 on-demand 模式（Stitch 例子作为加载前 placeholder）| drop | — |
| 13 | Campaign ROI Analysis 表 7 列含 Status pill | F008 loadRoiCampaigns ✓ 但只返完成的；Status 默认全 "completed"（无变化）| 全实现 7 列 | drop Status 列（仅 6 列）| — |
| 14 | 表 filter input "Filter by name…" | 客户端 filter（URL `?q=` 或 React state）| 客户端 React filter（pure UX）| drop | disabled + tooltip "Filter ships in B4" |

---

## 3. 主决议请求（13 条）

### #A — 顶部布局（CTA 数 + 时间 toggle 模式）

| 方案 | 描述 |
|---|---|
| A1 | 全照 Stitch：breadcrumb + title + 时间 toggle（4 段全 active）+ Sync + AI Insights + Record revenue 4 按钮 |
| A2 | spec 极简：仅 title + AI Insights 按钮（无 toggle / Sync / Record revenue）|
| A3 | Hybrid（建议）：breadcrumb + title + 时间 toggle 4 段（30D active + 其余 disabled tooltip "B4"） + AI Insights 按钮（联动 Section B 右侧）+ "Record revenue → /campaigns" 链接（不是 disabled，跳列表让用户挑）+ Sync drop |
| **建议** | 待 Planner 裁决 — A3 性价比高 |

### #B — KPI #4：spec "Top Campaign ROI" vs Stitch "Active Campaigns"

| 方案 | 描述 |
|---|---|
| A | spec 原版 Top Campaign ROI（F008 summary.topCampaign 直接渲染：name + roi% + 跳 detail）|
| B | Stitch 原版 Active Campaigns（F008 summary.campaignCount.active）|
| C | 二者并显（一个用 KPI 卡 + 一个用副标）|
| **建议** | **A** spec 原版 — Top Campaign 信号更稀缺（"哪个最赚"是 marketer 第一关心）；Active Campaigns 在 /campaigns 列表已能秒数 |

### #C — KPI 卡 sparkline + period-vs-period

| 方案 | 描述 |
|---|---|
| A | 全实现 sparkline + period-vs（需要"上一窗口"对比；目前 F008 不返）|
| B | 仅 sparkline（用 F008 trend 14d 派生）|
| C | drop sparkline + period-vs，仅大数字 |
| **建议** | **B**：复用 F007 hotfix 抽出的 `<Sparkline>` 组件；period-vs MVP drop（避免 F008 增 contract）|

### #D — KPI #3 "High Velocity detected" 副标

| 方案 | 描述 |
|---|---|
| A | 动态：ROI > 200% → "High Velocity" / 50-200% → "Steady" / <50% → "Cooling" / null → "—" |
| B | 静态："30D average" |
| **建议** | **A**：信号化 + 视觉强；阈值由 spec §11 决议或本 audit 当场锁 |

### #E — Section B 60/40 vs spec 4 section 平级

| 方案 | 描述 |
|---|---|
| A | 全 Stitch 60/40：左 Trend chart + 右 AI Insights panel；Quarterly Budget 卡按 #F 决议 |
| B | spec 平级：Trend chart 全宽 + AI Insights 全宽 |
| C | Hybrid：60/40，左 Trend full-height（无 Quarterly Budget），右 AI Insights |
| **建议** | **C**：保 60/40 视觉但 Quarterly Budget drop（schema 不支持）；Trend chart 占满左侧 60% |

### #F — Quarterly Budget 卡

| 方案 | 描述 |
|---|---|
| A | 加 schema migration: `Tenant.quarterlyBudget Decimal? @map("quarterly_budget")`；UI 全实现 |
| B | drop 整块 |
| C | 占位卡："Quarterly budget tracking ships in B4"（保视觉块）|
| **建议** | **B**：schema 改非 F009 scope；C 保占位增加视觉杂质且无 actionable；MVP 客户没明确诉求 |

### #G — Trend chart 类型

| 方案 | 描述 |
|---|---|
| A | recharts ComposedChart bar(spend) + bar(revenue) + line(roi%) 次轴（最贴 Stitch）|
| B | recharts LineChart spend + revenue 双线 + ROI% 次轴（spec 原版）|
| C | 手搓 CSS bar chart（无 recharts dep）|
| **建议** | **A**：recharts 已装 ✓；ComposedChart 视觉最贴 Stitch；spec 写"line chart"是文字简化，ComposedChart 是 line chart 的超集 |

### #H — Trend bucket: daily vs monthly

| 方案 | 描述 |
|---|---|
| A | 30 daily（spec + F008 已支持）|
| B | 6 monthly（Stitch 显示 JAN-JUN）|
| **建议** | **A**：spec + F008 已对齐 30 daily；6 monthly 需要新 F008 函数 + 历史 6 月数据 MVP 没有；30D 与时间 toggle "30D" active 一致 |

### #I — AI Insights 数据源 + cache 策略

spec：
- 默认显示 "点击生成 AI 洞察" 按钮
- 点击 → aigcgateway Action `roi-insights` (id=`cmob2zgae000jbnnuue2i7uaf`, gemini-3-flash)
- 返回 3-5 条中英双语洞察（按当前 locale 匹配）
- localStorage cache key=`roi-insights-{tenantId}-{YYYYMMDD}`
- 有缓存时显示 "2026-XX-XX 生成，重新生成"

| 方案 | 描述 |
|---|---|
| A | 完全照 spec：客户端 button → server action → AI call → state + localStorage |
| B | RSC 服务器端预生成（每页加载就调 AI，loading 期间显 skeleton）|
| C | 同 A，但 cache 在服务端（`unstable_cache` with daily revalidate tag）|
| **建议** | **A**：spec 锚定 + 用户控制成本（不点不调，不浪费 token）|

子决议：**调用契约 endpoint** 与 BM2-F006 customize.ts 一致（`POST /actions/{id}/run`，`Bearer ${AIGCGATEWAY_API_KEY}`，body `{variables, dry_run}`）。需 Planner 确认 `roi-insights` 的 input variables shape（spec §F009 §3 给了 input 类型，但 Action 内部 prompt 模板的 `{{var}}` 名称需要现场列）。

### #J — AI Insights 顶栏按钮 vs 右侧 panel 双入口

| 方案 | 描述 |
|---|---|
| A | 双入口：顶栏按钮 click → smooth scroll 到右 panel + 触发 generate（首次）|
| B | 仅右侧 panel（drop 顶栏按钮）|
| **建议** | **A**：保视觉还原度；click 自动滚到 panel 是合理的 UX 增强 |

### #K — Campaign ROI 表 Status 列 + filter input

子决议 K1 — Status 列：
- A 全实现（即便都是 "Completed"）
- B drop（仅 6 列）
- 建议 **A**：保 Stitch 视觉块，且未来含 paused 时 drop 改逻辑

子决议 K2 — Filter input：
- A 客户端 React filter（pure UX，~10 LOC）
- B drop
- 建议 **A**：成本低 + 价值高（completed 多时 filter 是核心功能）

### #L — Section 4 (AI Insights) 与 Section B (60/40) 的合并

spec 把 AI Insights 当 Section 4 平级；Stitch 把 AI Insights 嵌入 Section B 60/40 右侧。

| 方案 | 描述 |
|---|---|
| A | spec 原版 4 平级 section（Trend chart 全宽，AI Insights 全宽，下方 Campaign 表） |
| B | Stitch 原版 60/40（Trend 占左 60%，AI Insights 占右 40%；Section C Campaign 表全宽）|
| **建议** | **B**：60/40 视觉密度更好；marketer 看 trend 同时看 insights 更高效 |

### #M — i18n + AI Insights locale

spec：根据当前页面 locale 调 AI（en / zh）。Action 内部 prompt 应支持 locale 参数。

子决议：
- A：Action input 含 `locale` 字段，prompt 模板 `请用 {{locale}} 输出` 
- B：Action 内固定 en，前端按需翻译（增加翻译延迟 + 不准）
- 建议 **A**：与 BM2-F006 customize 一致（`locale` 在 variables）

---

## 4. 必用公共组件清单（`ui-fidelity-guardrail §3.2`）

来自 hotfix-F001 + 现有：
- `<Button variant="primary-gradient | secondary | ghost | chip">` — 顶栏按钮 + 时间 toggle chips + AI Generate 按钮
- `<Table>` + parts — Campaign ROI 表
- `<Input>` — Filter input
- `<StatusBadge domain="campaign">` — 表 Status 列（Completed pill）
- `<Sparkline>` — 4 KPI 卡的小 sparkline（hotfix-F001 已抽）
- `<RingProgress>` — 不直接用（可能 KPI #3 ROI 加 ring 装饰，#D 决议后再定）
- `<GlassPanel>` — 所有半透明容器
- `<SectionHeader>` — section titles

**新组件需 Planner 批准：**
- `<RoiTrendChart>` 业务组件 — 内部用 recharts ComposedChart；inline 在 page 不抽 common
- `<AiInsightsPanel>` — 内部 useTransition + localStorage + states (idle/loading/data/error)；inline 在 page

---

## 5. 幽灵控件清单（`ui-fidelity-guardrail §3.3`）

按 #A/#B/#C/#D/#E/#F/#G/#H 决议默认 disabled+tooltip：

| 控件 | MVP 处置 |
|---|---|
| 时间 toggle "7D/90D/All-time"（按 #A C 方案）| disabled + title="Time-range filter ships in B4" |
| Sync 按钮（按 #A C 方案 drop）| 不渲染 |
| Record revenue 按钮 | active link 跳 /campaigns（不 disabled）|
| Quarterly Budget 卡 | drop（不渲染） |
| KPI 卡 period-vs 副标（按 #C B 方案 drop） | 不渲染 |
| Campaign 表 Status 列 | active 渲染但所有行都是 "Completed" 静态 pill |

---

## 6. AI Insights 实现细节

### 6.1 调用契约

```typescript
// src/lib/roi/insights.ts
export interface RoiInsightInput {
  campaigns: Array<{
    name: string;
    product: string | null;
    spendTotal: number;
    revenueRecorded: number | null;
    roiPercent: number | null;
    closedAt: string | null;
  }>;
  summary: {
    totalSpend: number;
    totalRevenue: number;
    avgRoiPercent: number | null;
    topCampaignName: string | null;
    topCampaignRoi: number | null;
  };
  locale: 'en' | 'zh';
}

export interface RoiInsightItem {
  title: string;
  body: string;
  /** Tone for visual category: positive / warning / info */
  tone?: 'positive' | 'warning' | 'info';
  recommendation?: string;
}

export async function generateRoiInsights(
  input: RoiInsightInput
): Promise<{ insights: RoiInsightItem[]; traceId: string }>;
```

### 6.2 localStorage 协议

- Key: `roi-insights-{tenantId}-{YYYYMMDD}`（按 UTC 当日）
- Value: `JSON.stringify({ insights, traceId, generatedAt: ISO })`
- Read on mount → 若有 cache 渲染 + 显示 "2026-XX-XX 生成 / 重新生成"
- "重新生成" → 清 cache + 触发新调用
- 失败时不写 cache，按钮回到 idle

### 6.3 错误处理

- aigcgateway 401/403/429/5xx → 显示友好错误 + retry button
- 解析失败（不是 JSON / shape 不对）→ 友好错误
- timeout 30s → "AI 服务无响应，请重试"
- 错误埋点：`event_log type='roi.insights_failed'` 含 error code

### 6.4 埋点

- `roi.insights_clicked`（按钮点击时）
- `roi.insights_generated`（成功返回时，含 cache=hit/miss）
- `roi.insights_failed`（失败时）

---

## 7. 测试策略

### L1 unit
- `src/lib/roi/insights.ts` mock fetch — code fence handling / shape validation / error mapping

### L2 integration
- 不需要新 integration（F008 loaders 已覆盖；insights 是纯外部 API call，mock fetch 在 unit）

### L3 E2E（staging）
- `tests/e2e/roi-fidelity.spec.ts`（按 BM1 F009 教训）
  - 登录 → /roi → 看到 4 KPI + Trend chart + Campaign 表
  - 点 AI Insights button → 出现 loading → 调 staging Action → 渲染 3-5 insights
  - 刷新页面 → 直接读 cache（不重调）

### Visual
- `tests/screenshots/baseline/en-roi.png` 入 git（F011 前硬门槛）

---

## 8. i18n

新 namespace `roi.*` 约 40-60 keys（标题/副标/4 KPI labels/trend legend/AI Insights states/table headers/filter）。en + zh 真译；ja/ko/es en-stub。

---

## 9. BM1 F009 教训遵守

- [x] E2E 不用 `waitForLoadState("networkidle")`
- [x] 不硬编 seed-dependent count（用 regex/>0）
- [x] AI 调用后 toast/alert 不 polling 15s（直接 setState）
- [x] 所有 redirect / Link locale-prefixed

---

## 10. 风险登记

| 风险 | 缓解 |
|---|---|
| roi-insights Action 内部 prompt 期望的 variables 名 | §3 #I + §13 请 Planner 列出（已知 model gemini-3-flash）|
| recharts SSR + Next 16 兼容 | recharts 3.8.1 已装 + 已经在其他地方用过；client-only `<RoiTrendChart>` 加 `"use client"` |
| AI 返回 schema 漂移（非数组等）| §6.3 错误处理 + zod parse safe guard |
| AI cost: gemini-3-flash 每次 ~$0.002 | 用户控制（点按钮才调）+ daily cache + 显示 traceId 便于追踪 |
| localStorage 跨设备不同步 | MVP 接受（同设备日级缓存），B4 可改 server-side cache |

---

## 11. 实现清单（裁决后顺序）

1. `src/lib/roi/insights.ts` — aigcgateway client + zod parse + 错误码（30 min）
2. `src/lib/roi/__tests__/insights.test.ts` — mock fetch unit（20 min）
3. `src/app/[locale]/(app)/roi/page.tsx` RSC + 子组件（KpiStrip / TrendChart / CampaignTable / AiInsightsPanel / Header）（120 min）
4. `RoiTrendChart.tsx` recharts ComposedChart inline（30 min）
5. `AiInsightsPanel.tsx` client + useTransition + localStorage（45 min）
6. i18n + lint + typecheck + build（30 min）
7. CI watch + staging deploy + L2 真调一次 AI verify（30 min）

总计 ~5h。

---

## 12. 估算

| 环节 | 预估 |
|---|---|
| 审计 + 自裁决 | 30 min |
| 实现 | ~5h |
| 测试 + 闸门 | 1 h |
| **总计** | **~6.5 h** |

---

## 13. Planner 裁决（johnsong Planner · 2026-04-24）

### 13.1 短格式裁决

```
#A:A3（Hybrid：breadcrumb + title + 时间 toggle 30D active + 其余 disabled+tooltip "B4" + AI Insights 按钮 + "Record revenue → /campaigns" link + Sync drop）
#B:A（KPI #4 spec 原版 Top Campaign ROI，F008 summary.topCampaign 直渲）
#C:B（sparkline only，从 F008 trend 30d 派生；period-vs drop 避 F008 contract 改）
#D:A（动态副标：roi>200% "High Velocity" / 50-200% "Steady" / <50% "Cooling" / null "—"）
#E:C（保 60/40 视觉 + Quarterly Budget drop；Trend 占左 60% 满高；AI Insights 占右 40%）
#F:B（Quarterly Budget 整块 drop，不加 schema）
#G:A（recharts ComposedChart：bar(spend) + bar(revenue) + line(roi%) 次轴）
#H:A（30 daily bucket，对齐时间 toggle "30D" active）
#I:A（客户端 button + Server Action + state + localStorage cache 按日 key）
#J:A（顶栏按钮 + 右侧 panel 双入口；顶栏 click → smooth scroll 到 panel + 触发 generate 首次）
#K1:A（Status 列全渲，MVP 都显 "Completed"）
#K2:A（客户端 React filter input）
#L:B（per #E，Stitch 60/40 合并，Section C Campaign 表全宽）
#M:A（Action input 含 locale 字段）
```

### 13.2 roi-insights Action variables 契约（回应 §3 #I 子决议）

**已建 Action 的 variables（Planner 2026-04-23 建时定型，Generator 必须对齐，不得改 Action）：**

```typescript
// Action ID: cmob2zgae000jbnnuue2i7uaf
// Model: gemini-3-flash
// Variables（严格按此 3 个名字，不多不少）：
{
  tenant_context: string;   // 例 "Gaming studio with 8 campaigns. Avg ROI 43%. Top campaign: Galactic Forge Alpha Launch."
  campaigns_json: string;   // JSON.stringify(Array of campaign objects with name/product/spendTotal/revenueRecorded/roiPercent/startedAt/closedAt/kolCount)
  locale: string;           // "en" or "zh"
}
```

**Action output shape（已验证，见 Planner 2026-04-23 real call 测试）：**

```json
{
  "insights": [
    {
      "title_en": "Galactic Forge High ROI: Successful Sandbox Market Fit",
      "title_zh": "Galactic Forge 表现强劲：沙盒市场契合度极高",
      "body_en": "The Alpha Launch exceeded expectations with a 173.3% ROI...",
      "body_zh": "Galactic Forge 首测表现远超预期...",
      "severity": "positive"      // positive / neutral / warning
    }
  ]
}
```

**Generator toVariables 样板：**

```typescript
// src/lib/roi/insights.ts
function toVariables(input: RoiInsightInput) {
  const summary = input.summary;
  const topLine = summary.topCampaignName
    ? `Top campaign: ${summary.topCampaignName} (${summary.topCampaignRoi?.toFixed(1)}% ROI).`
    : "No top campaign yet.";

  const tenantContext = [
    `Gaming studio with ${input.campaigns.length} completed campaigns.`,
    `Total spend $${summary.totalSpend.toFixed(0)}, revenue $${summary.totalRevenue.toFixed(0)}, avg ROI ${summary.avgRoiPercent?.toFixed(1) ?? "—"}%.`,
    topLine,
  ].join(" ");

  return {
    tenant_context: tenantContext,
    campaigns_json: JSON.stringify(input.campaigns),
    locale: input.locale,
  };
}
```

**Generator response 解析样板（locale 过滤 + shape 映射）：**

```typescript
import { stripCodeFence } from "@/lib/ai/json-extract"; // F006 抽出的公用 helper

function parseResponse(output: string, locale: "en" | "zh"): RoiInsightItem[] {
  const raw = JSON.parse(stripCodeFence(output)) as {
    insights: Array<{
      title_en: string;
      title_zh: string;
      body_en: string;
      body_zh: string;
      severity: "positive" | "neutral" | "warning";
    }>;
  };
  return raw.insights.map((i) => ({
    title: locale === "zh" ? i.title_zh : i.title_en,
    body: locale === "zh" ? i.body_zh : i.body_en,
    tone: i.severity === "neutral" ? "info" : i.severity,
  }));
}
```

Generator 可自选 `RoiInsightItem` 内部 shape（此处样板用 `{title, body, tone}` 已 locale-resolved）；也可改用 `{titleEn, titleZh, bodyEn, bodyZh, severity}` 结构在 UI 层做 locale 分支，两种都可接受。

### 13.3 逐条裁决理由

| # | 决定 | 理由 |
|---|---|---|
| A | A3 Hybrid | 全照 Stitch 有 Sync + 4 段 toggle 都 active 违 MVP 现状；spec 极简丢视觉还原度；A3 保 breadcrumb + 4 段 toggle 视觉块（非 30D 的 disabled）+ AI 按钮双入口，Record revenue 改 link 跳 /campaigns（active link 不 disabled）+ Sync 无 use-case drop |
| B | A Top Campaign ROI | "哪个最赚"是 marketer 核心信号；"Active Campaigns"在 /campaigns 列表秒查；spec 原版更有价值 |
| C | B sparkline only | F008 trend 数据已有，Sparkline（hotfix-F001 抽出）直接绑；period-vs 需 F008 返上一窗口数据，contract 改成本高 MVP 不做 |
| D | A 动态 | 信号化副标 vs 静态"30D average"信息密度高；3 档阈值（200%/50%/<50%）业内常见合理 |
| E | C 60/40 drop Budget | Quarterly Budget schema 无（`Tenant.quarterlyBudget` 不存在），F 采 B drop；C drop 避免占位卡无 actionable 的视觉杂质；60/40 视觉保持 |
| F | B drop Quarterly Budget | 不加 schema（MVP scope）；Tenant 表 BM2 F001 migration 已定，再改需补 migration；F008 也不算 budget 相关 metrics |
| G | A ComposedChart | spec 写 "line chart" 是文字简化；Stitch bar+line overlay 更贴设计；recharts 已装 ✓ |
| H | A 30 daily | F008 `computeRoiTrend(tenantId, days=30)` 已返 daily；与时间 toggle "30D" active 一致 |
| I | A 客户端 + localStorage | spec §4 明确要求；用户控制成本；day-level cache 减少重复调用 |
| J | A 双入口 smooth scroll | 保视觉还原度 + UX 增强（click 自动滚到 panel + 首次触发 generate）|
| K1 | A Status 列全渲 | F008 `loadRoiCampaigns` 仅返 completed，MVP 全显 "Completed"；未来含 paused 时 drop 是更小改动 |
| K2 | A 客户端 filter | `useState` + `.filter(name.includes)` ~10 LOC 成本低；客户端因无 pagination 即时响应 |
| L | B（与 #E 绑定）| 60/40 视觉密度更好；marketer 边看 trend 边看 insights 更高效；Section C 表全宽 |
| M | A Action locale | 与 BM2-F006 customize 一致的模式；Action 已有 locale variable（见 §13.2） |

### 13.4 同步文档修订清单

Planner 本次 commit 同步修订：

1. **BM2 spec §F009** 补说明：
   - KPI #4 = Top Campaign ROI（非 Active Campaigns）
   - Trend chart 为 recharts ComposedChart（bar+bar+line），30 daily bucket
   - Quarterly Budget 不实现（schema 无 budgetTotal，drop 整块）
   - 时间 toggle 4 段仅 "30D" active（其余 disabled+tooltip "B4"）
   - AI Insights 双入口（顶栏按钮 + 右侧 panel），smooth scroll
   - Campaign 表加 client-side filter input + Status 列静态 "Completed"
2. **features.json F009 acceptance**：不动（acceptance 在 spec §F009 body 层级展开，features.json 仅头条描述不受影响）
3. **不**加 schema migration（Quarterly Budget drop）
4. **不**改 aigcgateway Action（沿用 2026-04-23 建好的 variables/output shape）
5. **不**影响 MVP-visual-fidelity hotfix（hotfix 仅覆盖 BM1 + BM2 F003/F005 已做页面，/roi 是 F009 新页）

### 13.5 额外叮嘱（非阻塞）

1. **recharts client-only**：`<RoiTrendChart>` 必须 `"use client"` directive（recharts 含 DOM measure 逻辑，SSR 会 mismatch）
2. **AI Insights 首屏 placeholder**：idle 状态不要显 Stitch 的 3 条硬编例子（会被 Reviewer 当成幽灵控件；改为"点击按钮查看 AI 分析"空态 + 按钮）
3. **localStorage tenant 边界**：cache key 含 `tenantId`，多 tenant 切换（用户 impersonate scenario）不串扰
4. **Filter input debounce**：~150ms debounce 避免每字符 re-render（虽然客户端 filter 便宜，但表大时仍有视觉抖动）
5. **ComposedChart bar 颜色**：spend 用 `on-surface-variant`（中性灰）/ revenue 用 `cyan-fixed`（品牌色）/ ROI% line 用 `accent-purple`（per Stitch 紫色折线）
6. **ROI % 次轴 scaling**：y 轴 right 显 %，左 y 轴显 $；ROI 可能 -∞ 到 +∞，限 [-100, 500] 防极端值压扁 spend/revenue bars
7. **"High Velocity" subtitle 的 i18n**：en "High Velocity" / "Steady" / "Cooling" ; zh "强势增长" / "稳定" / "降温"（i18n 键 `roi.kpi.velocity.{high|steady|cooling|na}`）
8. **AI 双入口的 UX 细节**：顶栏按钮 click 先判断是否有 cache；有 → smooth scroll to panel（不重调）；无 → smooth scroll + trigger generate。避免首次 click 后再 click 又触发一次（防抖 2s）
9. **ZOD schema for insights parse**：虽然我给的 parseResponse 样板用了类型断言，实际建议 Generator 在 `src/lib/roi/insights.ts` 加 zod schema `RoiInsightResponseSchema`，parse 失败 fallback 到错误 toast（Action 漂移防护）
10. **BM1 F009 教训**：`tests/e2e/roi-fidelity.spec.ts` 不用 `waitForLoadState("networkidle")`（recharts 可能持续 resize observer），用 `await page.waitForSelector('[data-testid="roi-kpi-total-spend"]')` 锁首次渲染完成
11. **埋点 3 事件**：`roi.insights_clicked` / `roi.insights_generated`（success + cache hit/miss flag） / `roi.insights_failed`（含 errorCode）
12. **视觉参照 HTML 主**：Generator 开工前浏览器打开 `design-draft/stitch-references/roi-tracking.html` 并排 staging（不看 .png 缩略图，per ui-fidelity-guardrail §1.1）

### 13.6 开工确认

**Planner 本次 commit 推 main 后 Generator 立即开工 F009**。按 §11 顺序 7 步推进（~5h）。开工前确认：
- [x] F008 已 done（ROI engine 三函数 + 3 API 就绪）
- [x] hotfix-F001 公共组件库就绪（Sparkline / Table / Input / StatusBadge 等）
- [x] F007 抽出的 Sparkline + RingProgress 已入 common/（F009 Sparkline 直接用；RingProgress 按 #D 决议不直接用）
- [x] aigcgateway `roi-insights` Action 已建 + real call 验证（action_id 见 §13.2）
- [x] 批准 recharts ComposedChart（recharts@3.8.1 已装）
- [x] 批准 Quarterly Budget drop（不加 schema）
- [x] BM1 F009 E2E 教训清单必遵守

---

**Generator 开工。本审计 §13 已裁决。**

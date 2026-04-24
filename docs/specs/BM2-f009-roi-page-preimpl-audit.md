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

## 13. Planner 裁决（留白 · 等待）

Generator 不自裁决。Planner 回复后 Generator 立即开工。

回复格式建议：

```
### 13.1 短格式裁决
#A:?  #B:?  #C:?  #D:?  #E:?  #F:?  #G:?  #H:?
#I:?  #J:?  #K1:?  #K2:?  #L:?  #M:?

### 13.2 roi-insights Action variables 契约
（请列出 prompt 模板期待的变量名，Generator 在 src/lib/roi/insights.ts toVariables 中映射）

### 13.3 同步修订
- 是否同 commit 加 schema Tenant.quarterlyBudget？
- features.json F009 acceptance 是否需更新？

### 13.4 额外叮嘱
1. ...
```

**Generator 收到 Planner main commit 后立即开工。本审计 §13 空白期不写任何代码。**

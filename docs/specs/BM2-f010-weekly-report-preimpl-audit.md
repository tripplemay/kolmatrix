# BM2 F010 · `/weekly-report` 前置审计（正式）

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-24
> **依据：** `framework/harness/ui-fidelity-guardrail.md` §3 + `framework/harness/pre-impl-adjudication.md`
> **状态：** 🟡 **等待 Planner 裁决**。本审计 §13 留白；不自裁决；Generator 不开工直至 Planner 提交 main 裁决。
> **提交：** 单 commit `docs(audit): BM2-F010 /weekly-report pre-impl audit` 推 main。

---

## 1. 背景 & 主漂移要点

spec §F010（BM2 spec lines 535-572）定义 5 段式 markdown 周报（Executive Summary / Top Performers / Key Activity / Key Insights / Looking Ahead）+ branded header + PDF 导出 + 分享链接。aigcgateway Action `weekly-report-for-client`（id=`cmob2zqkp0001bnnvel4vjapu`，gemini-3-flash）已 Planner 预建 + real call 验证。

Stitch `weekly-report.html`（545 行）实际呈现 9 个 section：
1. 顶部 sidebar + topbar（已有 AppShell）
2. Page header：breadcrumb（Reports → Weekly Report）+ title + range toggle（**Last Week active** / Last Month）+ settings 按钮
3. **Client brand header**：圆形 logo（initials fallback "LG"） + tenant name + Q2 Spring Campaign Program 副标 + 周日期范围 + AI-Generated badge + **Download PDF** 主 CTA + Share 按钮 + Regenerate 按钮
4. **Executive Summary** 卡：2 列叙述段（hardcoded "501% ROI" / "GamerXia partnership" 高亮）
5. **3-Tile Metric Highlights**：KOL Reach this week (23 +4) / Combined Impressions (2.1M +23%) / ROI Realized (+501%)
6. **Two-Column Row 60/40**：左 60% Top Performing Partnerships 表（5 行，KOL/Platform/Audience/ROI Stats），右 40% AI Insights & Recommendations（3 条 emerald/amber/cyan 边色）
7. **Budget Pacing Q2** 卡：3-color 堆叠条 + Spent/Committed/Remaining
8. **Next Week Outlook**：Upcoming Launches / Follow-ups Needed / Reports & Reviews 三栏
9. Footer：Report ID + Gen Cost + "AI powered by..."

⚠️ **核心漂移：**
- spec 周报 = AI 生成 markdown 5 段，react-markdown 渲染；Stitch 周报 = 8 个手写 section（其中 Executive Summary / AI Insights 是 AI 文本，其余是结构化 KPI 卡 / 表 / 进度条）
- spec 没有 "3-Tile Metric Highlights" 区域；Stitch 有（KOL Reach + Combined Impressions + ROI Realized）
- spec 没有 "Top Performing Partnerships" 表；Stitch 有（5 行 KOL × ROI%）
- spec 没有 "Budget Pacing" 区域；Stitch 有（schema 不支持 — Tenant.budgetTotal 无，与 F009 #F 同样问题）
- spec 没有 "Next Week Outlook" 三栏；Stitch 有
- spec 没有 "AI Insights & Recommendations" 右侧 panel；Stitch 有（实际复用 F009 RoiInsightsPanel 的视觉模式）
- Stitch 顶部 "Last Month / Last Week" range toggle；spec 是 date picker（过去 7 天）+ locale selector
- Stitch 没有 locale selector（spec 必须）
- Stitch 没有"生成"按钮；按隐含语义周报已生成（重做 = "autorenew"）；spec 强调 on-demand 按钮
- Stitch 把 PDF "Download PDF" 是 mock；spec 是 `window.print()` + @media print stylesheet
- Stitch share 按钮无明显 modal；spec 要求 token 生成 + 链接复制 UX
- 历史周报：spec 要求 `?id=:id` 切换最近 10 份；Stitch 无此入口
- 匿名分享路由 `/shared/weekly-report/[token]` Stitch 无独立 mock，但视觉应与登录态相同（仅去掉 sidebar/topbar）

---

## 2. Stitch 元素逐条分类（`ui-fidelity-guardrail §3.1`）

| # | Stitch 元素 | 数据可得性 | A 照原型 | B 简化/drop | C 占位 |
|---|---|---|---|---|---|
| 1 | Breadcrumb (Reports → Weekly Report) | 静态 | 实现 | drop | — |
| 2 | Page header range toggle (Last Week / Last Month) | spec 是 date picker；Stitch 是 2 段 toggle | 改为 spec 模式：`<input type="date">`（默认上周一 00:00）+ 7 天窗口自动算 | Stitch 模式 2 段 toggle（Last Week active + Last Month disabled+tooltip B4）| disabled+tooltip "B4 custom range" |
| 3 | Page header settings 按钮 | 不在 spec | drop | drop | disabled+tooltip |
| 4 | Locale selector (en/zh) | spec 必须；Stitch 无 | 加 `<select>` 在 page header（en/zh 2 选项，默认当前页 locale）| drop（用全局 locale）| — |
| 5 | "生成周报" 按钮 | spec 必须；Stitch 暗示已生成 | 显式按钮，未生成时显空态 + "Generate weekly report" CTA | 隐式生成（页加载时即调）| — |
| 6 | Client brand header（圆形 logo + tenant name + 副标 + AI badge + Download PDF + Share + Regenerate）| Tenant.logoUrl（已存在）+ Tenant.name；副标 "Q2 Spring Campaign Program" 不在 schema | 全实现；副标改为日期范围（"Week of Apr 14-20, 2026"）；logo 缺时 initials 渐变圆 fallback | drop 副标 only | — |
| 7 | Executive Summary 卡（AI 文本 2 列）| AI markdown 第 1 段 | AI markdown 第 1 段渲染到此卡；保留 cyan 顶部光带 | 渲染为单列 plain markdown | — |
| 8 | 3-Tile Metric Highlights (KOL Reach +N new / Impressions +N% / ROI +N%) | KOL Reach = 本周新增 KolCampaign count；Impressions 无 schema（CampaignMetric.impressions 有但 MVP 未必有数据）；ROI = F008 trend 本周 sum | 全实现 3 卡（Impressions 无数据时 "—"）| drop 整段（Stitch 这段无 spec 对应）| 显示静态展示卡 |
| 9 | Top Performing Partnerships 表（KOL/Platform/Audience/ROI Stats）| 需要本周参与 campaign 的 KOL 列表 + 各自 ROI；现有 KolCampaign 无 ROI 字段，需从所属 Campaign.spendTotal/revenueRecorded 派生 | 全实现 5 行表 | drop 整段（让 AI markdown body 自然带 Top Performers 段）| — |
| 10 | AI Insights & Recommendations 右侧 panel（3 条彩边）| AI markdown 中 "Key Insights" 段 | 解析 markdown "Key Insights" section 渲染为右 panel 3 条；severity 由 AI 标 emoji/keyword 反推 | drop 右侧 panel，AI markdown body 一段一段渲染 | — |
| 11 | Budget Pacing Q2 卡（3-color 堆叠条）| schema 无 Tenant.budgetTotal | 加 schema migration | drop 整块（与 F009 #F 同样处理）| 占位卡 "Budget pacing ships in B4" |
| 12 | Next Week Outlook 三栏（Upcoming Launches / Follow-ups Needed / Reports & Reviews）| 无 schema 直接对应；可从 Campaign.startedAt 未来 7 天 / KolCampaign 状态 stuck > 7 天 / 等派生 | 实现：派生 3 个数据源（upcoming = campaigns startedAt within next 7d；follow-ups = KolCampaign status='quoted' age >7d；reports = static "Q2 Month 1 attribution" placeholder）| drop 整块（让 AI markdown body 带 "Looking Ahead" 段自然）| 占位卡 "Outlook ships in B4" |
| 13 | Footer (Report ID + Gen Cost + AI powered by...) | Report ID = WeeklyReport.id 前 8 位；Gen Cost = aigcgateway response.usage 美元化（如可得）| 全实现 | drop | 仅显示 "AI powered by KOLMatrix" 静态 |
| 14 | History switcher（最近 10 份周报）| spec 必须；Stitch 无 | 实现：page header 加 `<select>` 列出最近 10 份按 weekEnd DESC，URL `?id=:id` 切换 | drop（仅显示最新一份）| — |
| 15 | Share 按钮 → 生成 token + 复制 URL | spec POST `/api/weekly-reports/:id/share-token` | 实现：button 触发 server action → token gen + 写回 → 复制到剪贴板 + toast | drop | disabled+tooltip |
| 16 | Download PDF 按钮 → window.print() | spec MVP 要求 | 实现：button onClick = `window.print()`；页加 `@media print` stylesheet | drop | disabled+tooltip |

---

## 3. 主决议请求（13 条）

### #A — 顶部布局（range / locale / settings 按钮）

| 方案 | 描述 |
|---|---|
| A1 | 全照 Stitch：2 段 toggle (Last Week / Last Month) + settings 按钮，无 locale selector |
| A2 | spec 极简：date picker（过去 7 天）+ locale selector（en/zh）；drop settings |
| A3 | Hybrid（建议）：2 段 toggle 视觉块（Last Week active + Last Month disabled+tooltip "B4"）+ locale `<select>`（en/zh）+ settings drop |
| **建议** | 待 Planner 裁决 — A3 性价比高 |

### #B — Executive Summary 内容来源

| 方案 | 描述 |
|---|---|
| A | AI markdown 第 1 节（# Executive Summary 标题下两段）渲染到 Stitch 的 2 列卡 |
| B | AI markdown 整篇渲染（不解析 section），Stitch 9 个 section 全部 drop |
| C | 后端二次拆分 markdown（按 ## 标题切片），分发到 Stitch 各 section（hybrid） |
| **建议** | **A** — Stitch 视觉块基本对应 spec 5 段 H2，按 H2 切片分发到对应卡可保留 Stitch 设计；C 是 A 的扩展 |

### #C — 3-Tile Metric Highlights 是否实现

| 方案 | 描述 |
|---|---|
| A | 全实现 3 卡（KOL Reach 新增 / Impressions 总和 or "—" / ROI Realized %）|
| B | drop 整段（让 AI markdown body 自然带 metrics）|
| C | 仅实现 KOL Reach + ROI Realized 2 卡（Impressions 无 reliable 数据）|
| **建议** | **C** — Impressions 数据 MVP 无 reliable 来源（CampaignMetric.impressions 需手动填，seed 不会有），保 2 卡视觉块 |

### #D — Top Performing Partnerships 表是否实现

| 方案 | 描述 |
|---|---|
| A | 全实现 5 行表（按本周 KOL × campaign ROI 排序，最多 5 条）|
| B | drop（让 AI 在 markdown 内自带 "Top Performers" 段，2-3 名 + 简短理由）|
| C | 实现简化 3 行表（KOL 头像 + name + ROI%；drop Platform/Audience 列）|
| **建议** | **B** — AI 已被 prompt 要求生成 "Top Performers" 段（spec §F010 §4 layout #3），重复结构化表 + AI 段是冗余；保留 AI markdown 自然渲染 |

### #E — AI Insights & Recommendations 右侧 panel

| 方案 | 描述 |
|---|---|
| A | 解析 AI markdown "Key Insights" section，提取 3-5 bullet 渲染为右 panel 彩边卡 |
| B | drop 右侧 panel，整篇 markdown 单列渲染 |
| C | 复用 F009 `<RoiInsightsPanel>` 但改为读 markdown 段落 |
| **建议** | **A** — 解析 markdown 简单（split `## Key Insights` … 下一个 `## ` ）；右 panel 视觉密度高且与 F009 风格一致 |

### #F — Budget Pacing Q2 卡

| 方案 | 描述 |
|---|---|
| A | 加 schema migration `Tenant.budgetTotal Decimal`；UI 全实现 |
| B | drop 整块 |
| C | 占位卡 |
| **建议** | **B**（与 F009 #F 一致） — schema 改非 F010 scope；占位无 actionable |

### #G — Next Week Outlook 三栏

| 方案 | 描述 |
|---|---|
| A | 全实现 3 栏（upcoming = next 7d Campaign.startedAt；follow-ups = quoted age >7d；reports = static placeholder）|
| B | drop 整块（AI markdown "Looking Ahead" 段渲染替代）|
| C | 仅实现 Upcoming 1 栏 + drop Follow-ups + Reports |
| **建议** | **B** — AI markdown 已带 "Looking Ahead" 段；3 栏中 Reports 完全是 placeholder 无数据，violation 幽灵控件 |

### #H — 历史周报切换

| 方案 | 描述 |
|---|---|
| A | Page header 加 `<select>` 显示最近 10 份按 weekEnd DESC，URL `?id=:id` 切换 |
| B | drop（仅显示最新一份）|
| C | 单独 `/weekly-report/history` 列表页 |
| **建议** | **A** — spec 明确要求；select 成本低 |

### #I — 周报生成的"幂等"语义

spec：用户每次 click "生成周报" → AI 调用 → 写一行 WeeklyReport。如果同一 (tenantId, weekStart, weekEnd, locale) 已有 row：

| 方案 | 描述 |
|---|---|
| A | 每次生成都新增一行（历史完整 audit）|
| B | upsert：(tenantId, weekStart, weekEnd, locale) 唯一约束，重新生成 = 覆盖 contentMd + summaryJson + 重置 share token |
| C | 显示 "本周已生成于 X，重新生成？" 二次确认，确认后走 B |
| **建议** | **B** — schema 没有 unique constraint，需要先加；但 upsert 语义清晰；如果走 A 历史会膨胀且 share token 复用混乱；C 增 UI 复杂度 |

**子决议 I.1**：B 方案需加 migration `ALTER TABLE weekly_report ADD CONSTRAINT uq_weekly_report_tenant_week_locale UNIQUE (tenant_id, week_start, week_end, locale)`；可在 F010 一并迁移 vs 留 F011。

### #J — Share 链接 UX

| 方案 | 描述 |
|---|---|
| A | Click → server action 生成 token → 自动复制到剪贴板 + toast "Link copied"；7 天有效 |
| B | Click → 打开 modal 显示 link + Copy 按钮 + 7 天提示 |
| C | A + 二次 click 显示 modal（双层）|
| **建议** | **A** — 最少摩擦；spec 明示 7 天过期可在 toast 一并显示 |

### #K — PDF 打印样式

| 方案 | 描述 |
|---|---|
| A | 全局 `@media print` stylesheet 隐藏 nav/sidebar/header CTA 按钮；A4 page-size；force-color；隐藏 history switcher / locale selector |
| B | 开新 print-only route `/weekly-report/print/:id`，打印时跳转此路由 |
| C | A + 在按钮 click 时 `document.title` 改为 "WeeklyReport_YYYYMMDD" 影响保存文件名 |
| **建议** | **A + C** — 最低成本 + 文件名友好；B 增加路由复杂度 |

### #L — react-markdown 依赖

react-markdown **未安装**，spec 明示要求。需 Planner 批准 `npm install react-markdown` + 选 plugin 集合：

| 方案 | 描述 |
|---|---|
| A | `react-markdown` 单独（无 GFM 表 / 任务列表 / autolink）|
| B | `react-markdown` + `remark-gfm`（支持 GFM 表 / 任务列表 / strikethrough）|
| C | 不装 react-markdown，自手解析 markdown（按 H2 切 + 段落 join，无 inline ` ` 处理）|
| **建议** | **B** — AI 输出可能含表（Top Performers 段），GFM 是 markdown de-facto；bundle 增 ~30KB 可接受 |

### #M — Action variables 契约（roi-insights 的 §13.2 同款）

aigcgateway Action `weekly-report-for-client`（cmob2zqkp0001bnnvel4vjapu，gemini-3-flash）。Planner 2026-04-23 建时定型的 variables 名是？以下为 Generator 推测，**Planner 必须确认或修订**：

```typescript
// 推测的 variables（Planner 修正）：
{
  tenant_name: string;          // "Lightning Games Inc."
  tenant_logo_url: string;      // for branded header (or "")
  week_range: string;           // "Apr 14-20, 2026"
  locale: string;               // "en" or "zh"
  kol_activity_json: string;    // JSON: 本周新增 KolCampaign / 新增邮件发送
  roi_data_json: string;        // JSON: 本周 spend/revenue/topCampaigns/trend
  prev_week_comparison_json: string; // JSON: 上周同字段（如有，否则 "{}"）
}
```

**Action output shape（Planner 必须确认）：**

```json
{
  "markdown": "# Executive Summary\n...\n## Top Performers\n...\n## Key Activity\n...\n## Key Insights\n- ...\n## Looking Ahead\n- ..."
}
```

或：

```json
{
  "executive_summary": "...",
  "top_performers": [...],
  "key_activity": "...",
  "key_insights": [...],
  "looking_ahead": [...]
}
```

请 Planner 在 §13.2 给出 variables 与 output shape 的精确定义。

---

## 4. 必用公共组件清单（`ui-fidelity-guardrail §3.2`）

来自 hotfix-F001 + 现有 + F009：
- `<Button variant="primary-gradient | secondary | ghost | chip">` — Download PDF / Generate / Share / Regenerate / range toggle
- `<GlassPanel>` — section 容器
- `<SectionHeader>` — 各段标题
- `<StatCard>` — 3-Tile Metric Highlights（如果 #C 选 A/C）
- `<StatusBadge>` — Top Performers 表 Platform pill（如果 #D 选 A/C）
- 复用 F009 的 toast 模式（`<ShareToast>`）

**新组件需 Planner 批准：**
- `<WeeklyReportRenderer>` 业务组件 — react-markdown wrapper + 按 ## H2 切片分发到 Stitch 各 section
- `<WeeklyReportShareToast>` — share 按钮的 toast UI
- `<WeeklyReportPrintStyles>` — Style 标签注入 @media print 规则
- `<WeeklyReportHistorySelector>` — `<select>` 历史周报切换器

**新依赖：** `react-markdown`（+ `remark-gfm` 如选 #L:B）— 需 Planner 批准

---

## 5. 幽灵控件清单（`ui-fidelity-guardrail §3.3`）

按 #A/#B/#C/#D/#E/#F/#G 决议：

| 控件 | MVP 处置 |
|---|---|
| Last Month range toggle | disabled + title="Custom range ships in B4"（如 #A:A3）|
| Settings button (页 header) | drop（不渲染）|
| Budget Pacing 卡 | drop（不渲染）|
| Next Week Outlook 三栏（如 #G:B）| drop |
| Top Performing Partnerships 表（如 #D:B）| drop（AI markdown 内自然带）|
| AI Insights 右 panel（如 #E:A）| 渲染（解析 markdown）|
| Combined Impressions 卡（如 #C:C）| drop |
| Footer Gen Cost（如 aigcgateway response 不返 cost）| 显示 "—" |

---

## 6. AI Insights 实现细节

### 6.1 调用契约（待 Planner §13.2 锁定）

```typescript
// src/lib/weekly-report/generate.ts
export const WEEKLY_REPORT_ACTION_ID = "cmob2zqkp0001bnnvel4vjapu";

export interface WeeklyReportInput {
  tenant: { id: string; name: string; logoUrl: string | null };
  weekStart: Date; // Monday 00:00 UTC
  weekEnd: Date;   // Sunday 23:59 UTC
  locale: "en" | "zh";
  kolActivity: { /* 待 §13.2 定型 */ };
  roiData: { /* F008 summary + trend */ };
  prevWeekComparison: { /* 上周同字段 */ } | null;
}

export interface WeeklyReportResult {
  markdown: string;
  traceId?: string;
  cost?: number; // USD
}

export async function generateWeeklyReport(
  input: WeeklyReportInput
): Promise<WeeklyReportResult>;
```

### 6.2 数据装配

- **kol_activity**：本周新增 KolCampaign 行 / 本周状态切换 / 本周发送的 EmailLog count
- **roi_data**：F008 `loadRoiSummary(tenantId)` + `loadRoiTrend(tenantId, 7)` + `loadRoiCampaigns(tenantId).slice(0, 10)`
- **prev_week_comparison**：把 weekStart 减 7 天再调一次 F008 loaders（仅 summary，不 trend）

### 6.3 错误处理（与 F009 insights 一致）

- aigcgateway 401/403/429/5xx → friendly error + retry button
- 解析失败（不是合法 markdown / 缺 H2）→ 友好错误
- timeout 30s → "AI 服务无响应"
- 错误埋点：`event_log type='weekly_report.generated_failed'` 含 errorCode

### 6.4 埋点

- `weekly_report.generate_clicked`（按钮点击时）
- `weekly_report.generated`（成功，含 traceId / cost / week_range）
- `weekly_report.generated_failed`（含 errorCode）
- `weekly_report.share_token_created`（share 按钮 click 成功时）
- `weekly_report.pdf_export_clicked`（Download PDF click 时）
- `weekly_report.shared_view`（匿名路由命中时，含 token + days_until_expiry）

---

## 7. 测试策略

### L1 unit
- `src/lib/weekly-report/generate.ts` mock fetch — markdown parse / shape validation / error mapping
- `src/lib/weekly-report/markdown-split.ts` — 按 ## H2 切片纯函数

### L2 integration
- `tests/integration/weekly-report.test.ts`：
  - 生成 → 写 WeeklyReport 行（contentMd / summaryJson / createdByUserId）
  - 重新生成（#I 决议方案 B）→ upsert 同 (tenantId, weekStart, weekEnd, locale)
  - share-token 生成 + 7 天过期写 shareTokenExpiresAt
  - share-token 过期后访问 → 404
  - 跨租户 RLS：tenant B 不能 SELECT tenant A 的 WeeklyReport（除非走 superuser by token）
  - 匿名 token 路由：superuser 连接 SELECT 仅 4 列（content_md/summary_json/created_at/share_token_expires_at），不 join tenant
  - 历史周报列表：loadRecentWeeklyReports(tenantId, 10) 按 weekEnd DESC

### L3 E2E（staging）
- `tests/e2e/weekly-report-flow.spec.ts`：登录 → /weekly-report → 看到 empty state → click Generate → 等 markdown 渲染 → click Download PDF（验证 print dialog open）→ click Share → toast 出 + 剪贴板含 URL → 新 tab 打开 share URL → 匿名渲染同 markdown
- BM1 F009 教训：no `waitForLoadState("networkidle")`；revalidate 后 polling 15s；用 `waitForSelector('[data-testid="weekly-report-markdown"]')`

### Visual
- `tests/screenshots/baseline/en-weekly-report.png` 入 git（F011 前硬门槛）
- 匿名分享版 `tests/screenshots/baseline/en-weekly-report-shared.png` 入 git

---

## 8. i18n

新 namespace `weeklyReport.*` 约 50-70 keys（标题/副标/range toggle/locale selector labels/Generate button/Share toast/PDF button/empty state/error states/section headers/历史 selector）。en + zh 真译；ja/ko/es en-stub。

**locale 双重含义提醒：** `weeklyReport.*` namespace 本身按页 locale 翻译；但周报内容 markdown 由 AI 按用户选的 `locale` selector 生成（默认页 locale），二者独立。

---

## 9. BM1 F009 教训遵守

- [x] E2E 不用 `waitForLoadState("networkidle")`
- [x] 不硬编 seed-dependent count（用 regex/>0）
- [x] AI 调用后 toast/alert 不 polling 15s（直接 setState）
- [x] 所有 redirect / Link locale-prefixed
- [x] revalidatePath 后 E2E 加 polling buffer 15s

---

## 10. 风险登记

| 风险 | 缓解 |
|---|---|
| weekly-report-for-client Action 内部 prompt 期望的 variables 名 | §3 #M + §13.2 请 Planner 列出（已知 model gemini-3-flash）|
| AI 生成 markdown 不含期望 H2 标题（"## Top Performers" 等）→ §6.1 #E:A 解析失败 | zod schema 兜底 + parse 失败时整篇 fallback 渲染 + log warning |
| AI cost: gemini-3-flash 每次 ~$0.005 | 用户控制（点按钮才调）+ #I:B upsert（同周不重生）+ 显示 traceId + cost |
| @media print 各浏览器差异（Chrome/Safari/Firefox 各异）| spec §6 接受手动 cross-browser 测试 |
| 匿名分享路由被搜索引擎索引 | `<meta name="robots" content="noindex" />` + `/shared/` 加入 robots.txt |
| WeeklyReport 历史膨胀（同 tenant 每周 1 行 × 5 locale = 260 行/年）| MVP 接受；归档策略后 batch 决 |
| react-markdown / remark-gfm bundle 增 ~30KB | Next.js 自动 code-split；仅 /weekly-report 路由加载 |
| 匿名页 RLS bypass 依赖 superuser 连接配置正确 | 现有 superuser 连接已用于其他 anonymous query（如分享链接）；测试覆盖 SELECT 仅 4 列 |
| Stitch hardcoded "Lightning Games Inc." / "GamerXia" 误入 i18n | i18n 仅页 chrome；report content 全来自 AI / DB |
| #I:B 加 unique constraint 与已有 schema 冲突（如有 dup row）| F010 migration 前 cleanDb 验证；prod 该表初始空，无 dup |

---

## 11. 实现清单（裁决后顺序）

1. `src/lib/weekly-report/generate.ts` — aigcgateway client + zod parse + 错误码（30 min）
2. `src/lib/weekly-report/__tests__/generate.test.ts` — mock fetch unit（25 min）
3. `src/lib/weekly-report/markdown-split.ts` + 单元测试 — H2 切片纯函数（15 min）
4. `src/lib/weekly-report/data-assembly.ts` — 装配 kolActivity / roiData / prevWeek 的 RSC-side helpers（45 min）
5. `prisma/migrations/20260424_F010_weekly_report_unique/` — 加 unique constraint（如 #I 决 B）（15 min）
6. `src/app/[locale]/(app)/weekly-report/page.tsx` RSC + Generate Server Action + 子组件（120 min）
7. `WeeklyReportRenderer.tsx` + `WeeklyReportShareToast.tsx` + `WeeklyReportHistorySelector.tsx` 客户端（60 min）
8. `src/app/api/weekly-reports/[id]/share-token/route.ts` POST 生成 token（25 min）
9. `src/app/shared/weekly-report/[token]/page.tsx` 匿名路由 superuser 查询 + meta noindex（45 min）
10. PDF print stylesheet（src/app/[locale]/(app)/weekly-report/print.css 或 inline `<style>`）（25 min）
11. `tests/integration/weekly-report.test.ts`（90 min）
12. i18n + nav-config（/weekly-report → "analytics"）+ lint + typecheck + build（45 min）
13. CI watch + staging deploy + L2 真调一次 verify（30 min）

总计 ~9 h（含 schema migration 和匿名路由的额外复杂度）。

---

## 12. 估算

| 环节 | 预估 |
|---|---|
| 审计 + Planner 裁决 | 1 h |
| 实现 | ~9 h |
| 测试 + 闸门 | 1 h |
| **总计** | **~11 h** |

---

## 13. Planner 裁决（johnsong Planner · 2026-04-25）

### 13.1 短格式裁决

```
#A:A3（Hybrid：range toggle "Last Week" active + "Last Month" disabled+tooltip "B4" + locale selector en/zh + settings drop）
#B:A（AI markdown ## Executive Summary 段渲染到 Stitch 2 列卡，需 markdown-split.ts H2 切片）
#C:C（2 卡 Metric Highlights：KOL Reach + ROI Realized；Combined Impressions drop 因 CampaignMetric.impressions seed 无 reliable 数据）
#D:B（Top Performing Partnerships 表 drop；AI markdown 自带 ## Top Performers 段足够，重复结构化表是冗余）
#E:A（AI Insights 右侧 panel：解析 ## Key Insights 段提取 3-5 bullets 渲染为彩边卡，与 F009 RoiInsightsPanel 视觉一致）
#F:B（Budget Pacing Q2 整块 drop；与 F009 同处理；schema 不加 budgetTotal migration）
#G:B（Next Week Outlook 三栏 drop；AI markdown ## Looking Ahead 段已带；Reports 列纯 placeholder 违幽灵控件）
#H:A（历史周报 select 切换器 + URL ?id=:id 显近 10 份按 weekEnd DESC）
#I:B + I.1:F010 同 commit migration（upsert 语义：(tenantId, weekStart, weekEnd, locale) UNIQUE；F010 加 ALTER TABLE 一并迁；prod 无 dup row 风险）
#J:A（Share click → server action 生成 token → 自动复制剪贴板 + toast "Link copied · 7 days"，无 modal）
#K:A+C（@media print 全局 stylesheet + document.title = "WeeklyReport_{tenant}_{YYYYMMDD}"，影响保存文件名）
#L:B（npm i react-markdown + remark-gfm；批准；bundle ~30KB Next code-split 仅 /weekly-report 加载，可接受）
#M:见 §13.2 精确契约（Generator §3 #M 推测有偏差，必须按 §13.2 修正）
```

### 13.2 weekly-report-for-client Action 精确契约（Planner 必给，覆盖 Generator §3 #M 推测）

**已建 Action variables（Planner 2026-04-23 建时定型，**严格按此 7 个字段，不多不少**，**Generator 不得改 Action**）：**

```typescript
// Action ID: cmob2zqkp0001bnnvel4vjapu
// Model: gemini-3-flash
// Variables（命名 ⚠️ 注意：Generator §3 #M 推测的 tenant_logo_url 不在；week_range 拆为 start+end）：
{
  tenant_name: string;              // 例 "Lightning Games Inc."
  report_week_start: string;        // YYYY-MM-DD（周一）例 "2026-04-14"
  report_week_end: string;          // YYYY-MM-DD（周日）例 "2026-04-20"
  locale: string;                   // "en" or "zh"
  kol_activity_json: string;        // JSON.stringify({newPartnerships, statusChanges:[{kol,from,to}], emailsSent, aiCustomizedEmails, ...})
  roi_data_json: string;            // JSON.stringify({totalSpend, totalRevenue, avgRoiPercent, topCampaign:{name, roiPercent}})
  prev_week_comparison_json: string; // JSON.stringify({totalSpendDelta:"+20%", totalRevenueDelta:"+35%"}) 可选；空时传 ""（注意是空字符串非 "{}"）
}
```

**关键：`tenant.logoUrl` 不传给 AI**（logo 不影响 AI 文本生成；UI 层从 DB 读 Tenant.logoUrl 渲染 branded header；写入 WeeklyReport.summaryJson 快照便于匿名页渲染）。

**Action output shape（Planner 2026-04-23 real call 已验证，与 Generator §3 #M 推测都不同）：**

**output 是 raw markdown 字符串**，不是 JSON 包裹。直接 `## Executive Summary\n...\n## Top Performers\n...\n## Key Activity This Week\n...\n## Key Insights\n- ...\n## Looking Ahead\n- ...` 5 段式。

```
## Executive Summary
This week marked a period of accelerated growth for ...

## Top Performers
*   **Galactic Forge Alpha Campaign:** ...
*   **Revenue Generation:** ...
*   **Email Outreach Efficiency:** ...

## Key Activity This Week
*   Onboarded 3 new high-potential KOL partnerships ...
*   ...

## Key Insights
*   **Scaling Efficiency:** ...
*   ...

## Looking Ahead
*   Finalize terms with NintendoGalaxy ...
*   ...
```

**Generator `generateWeeklyReport()` 实现样板：**

```typescript
// src/lib/weekly-report/generate.ts
import 'dotenv/config';
import { stripCodeFence } from '@/lib/ai/json-extract'; // F006 抽出，仍可用作 markdown 防御性 strip

const ACTION_ID = 'cmob2zqkp0001bnnvel4vjapu';

export async function generateWeeklyReport(input: WeeklyReportInput): Promise<WeeklyReportResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) throw new Error('AIGCGATEWAY_API_KEY not set');

  const baseUrl = process.env.AIGCGATEWAY_BASE_URL ?? 'http://localhost:3099/v1';
  const url = `${baseUrl}/actions/${ACTION_ID}/run`;

  const variables = {
    tenant_name: input.tenant.name,
    report_week_start: formatDateUTC(input.weekStart), // YYYY-MM-DD
    report_week_end: formatDateUTC(input.weekEnd),
    locale: input.locale,
    kol_activity_json: JSON.stringify(input.kolActivity),
    roi_data_json: JSON.stringify(input.roiData),
    prev_week_comparison_json: input.prevWeekComparison
      ? JSON.stringify(input.prevWeekComparison)
      : '', // 空字符串，非 "{}"
  };

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ variables, dry_run: false }),
    timeout: 30_000,
    retries: 1,
  });

  const { output, traceId, usage } = await res.json();
  // Gemini 实测无 code fence（vs Claude Haiku F006 case），但防御性 strip
  const markdown = stripCodeFence(output);

  // 校验 5 个 H2 标题存在
  const requiredHeadings = ['Executive Summary', 'Top Performers', 'Key Activity', 'Key Insights', 'Looking Ahead'];
  for (const h of requiredHeadings) {
    if (!markdown.includes(`## ${h}`)) {
      throw new Error(`AI output missing required section: ${h}`);
    }
  }

  return {
    markdown,
    traceId,
    cost: usage ? estimateCost(usage) : undefined,  // gemini-3-flash $0.5 in / $3 out per 1M
  };
}
```

**Generator markdown-split.ts 样板（H2 切片纯函数）：**

```typescript
// src/lib/weekly-report/markdown-split.ts
export function splitByH2(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split('\n');
  let currentKey = '_preamble';
  let buffer: string[] = [];

  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (buffer.length) sections[currentKey] = buffer.join('\n').trim();
      currentKey = m[1].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  if (buffer.length) sections[currentKey] = buffer.join('\n').trim();
  return sections;
}

// 使用：
const sections = splitByH2(report.markdown);
// sections["Executive Summary"] = "This week marked..."
// sections["Top Performers"] = "*   **Galactic Forge..."
// sections["Key Insights"] = "*   **Scaling Efficiency..."
// 等
```

### 13.3 逐条裁决理由

| # | 决定 | 理由 |
|---|---|---|
| A | A3 Hybrid | range toggle 视觉块保 Stitch 还原度；Last Month 是 "B4 custom range" 占位幽灵控件合规；locale selector 必须（spec 明示）；settings 按钮无 use case，drop 不渲染（per §3.3 隐藏 vs disabled 二选一） |
| B | A | spec 5 段式与 Stitch 9 section 的最大公约数：把 AI markdown 5 个 H2 子段分发到 Stitch 视觉块（Executive Summary 卡 + AI Insights 右 panel 等）；C Hybrid 已被 A 包含 |
| C | C 2 卡 | Combined Impressions 数据靠 CampaignMetric.impressions，MVP seed 不会有 → drop 真诚 > 占位假数；KOL Reach 从 KolCampaign 派生 + ROI Realized 从 F008 派生均可信 |
| D | B drop | AI markdown ## Top Performers 段已被 prompt 要求 "3 bullet points: top 3 campaigns or KOLs with specific numbers"，重复结构化表 = 视觉重复；spec 也未要求结构化表 |
| E | A 右 panel | Stitch 视觉块明确 + 解析成本低（splitByH2）+ 与 F009 RoiInsightsPanel 视觉一致维持产品一致性 |
| F | B drop | F009 #F 同款（Quarterly Budget schema 无）；MVP scope |
| G | B drop | AI markdown ## Looking Ahead 段已被 prompt 要求 "2-3 bullets — actionable next steps"；Reports 列硬编 placeholder 违 §3.3 anti-pattern；upcoming/follow-ups 派生数据但 UX 价值低（Campaign 详情页已有） |
| H | A select 切换 | spec 明示；select 成本低；URL ?id 维持 share-friendliness（B4 加书签可行） |
| I | B upsert + I.1 同 commit migration | 同周重生 audit 价值低（A 方案）；upsert 简洁（B）；prod WeeklyReport 表初始空无 dup 风险，F010 同 commit 加 unique constraint 是合理时机 |
| J | A 自动复制 + toast | 最低摩擦；spec 7 天有效期可在 toast "Link copied · expires in 7 days" 一并展示 |
| K | A + C | @media print 是低成本 UX；document.title 改影响保存默认文件名（macOS Safari + Chrome 都支持）；B 开新路由复杂度高且多一次 SSR |
| L | B react-markdown + remark-gfm | AI 输出 ## Top Performers 段会用 GFM bullet（实测 `*   **bold:** ...`），无 GFM 渲染 bold 不出 + 表对齐丢失；30KB bundle 仅 /weekly-report 加载 Next 自动 code-split |
| M | 见 §13.2 | Generator §3 #M 推测有 2 处偏差需对齐：(1) 推测 `tenant_logo_url` 实际 Action 不接 logo；(2) 推测 `week_range` 实际是 `report_week_start` + `report_week_end` 两字段。Output 推测 JSON 包裹实际是 raw markdown |

### 13.4 同步文档修订清单

Planner 本次 commit 同步修订：

1. **BM2 spec §F010**：在 §F010 acceptance 段补 5 处对齐：
   - locale selector 显式（en/zh）+ "Last Month" disabled+tooltip
   - 3-Tile Metrics 改为 2 卡（Impressions drop）
   - Top Performing Partnerships 表 drop
   - AI Insights 右 panel = markdown ## Key Insights 段渲染
   - Budget Pacing + Next Week Outlook drop
   - 历史周报 select + ?id 切换
   - upsert (tenantId, weekStart, weekEnd, locale) 唯一约束 + F010 同 commit migration
2. **features.json BM2 F010 acceptance**：不动（features.json 仅头条描述，详细 acceptance 在 spec body）
3. **新依赖**：批准 `npm install react-markdown remark-gfm`，commit message 注明
4. **WeeklyReport unique constraint migration**：F010 同 commit 一起 push（路径 `prisma/migrations/20260425_F010_weekly_report_unique/migration.sql`，纯 ALTER TABLE，零数据风险）
5. **匿名路由 SQL**：明确 SELECT 4 列 + 不 join tenant；tenant 信息全靠 WeeklyReport.summaryJson 写入时快照（含 tenant.name + tenant.logoUrl）
6. **不**改 aigcgateway Action（沿用 2026-04-23 建好的 7 variables）

### 13.5 额外叮嘱（非阻塞）

1. **react-markdown SSR 兼容**：默认支持 SSR，但 GFM 表渲染在某些版本有 hydration mismatch 风险；建议 `<WeeklyReportRenderer>` 含 `"use client"` 强制客户端渲染（避免 SSR/CSR mismatch）
2. **markdown 校验失败 fallback**：5 个 H2 标题缺失时（极端 AI 漂移）→ 整段 raw markdown 全宽渲染 + 顶部 warning bar "AI output missing some sections, displaying raw"，不要 throw exception 让用户看不到周报
3. **匿名页 OG meta**：除 `<meta name="robots" content="noindex">` 外，加 `<meta property="og:title">` + `og:description` 让客户分享到 IM 时有预览（但 noindex 防搜索引擎）
4. **share token 32 chars**：用 `crypto.randomBytes(24).toString('base64url')` 生成（24 bytes base64url ≈ 32 chars，URL-safe，无 `+/=` 字符）
5. **PDF 文件名**：`document.title = '"WeeklyReport_" + tenantName.replace(/[^a-z0-9]/gi, "_") + "_" + weekStart.replace(/-/g, "")'`；保存默认 `WeeklyReport_Lightning_Games_Inc__20260414.pdf`
6. **历史周报 select 显示**：`<option>` 文本格式 "Apr 14-20, 2026 (en)"；按 weekEnd DESC + locale 同时显示便于跨语言切换
7. **upsert 与 share token 关系**：重新生成（覆盖 contentMd / summaryJson）必须**同时清掉** shareToken / shareTokenExpiresAt（旧 token 链接打开后看到的是旧内容，不应该；upsert 时重置）
8. **gemini-3-flash 实测无 code fence**（F009 + F006 测试都干净），仍防御性 stripCodeFence；不要 throw 失败
9. **BM1 F009 教训**：E2E waitForSelector `[data-testid="weekly-report-markdown"]` 锁渲染完成；不用 networkidle（react-markdown 含 syntax highlight 持续 work）
10. **埋点 6 事件**：generate_clicked / generated（cost+traceId）/ generated_failed（errorCode）/ share_token_created / pdf_export_clicked / shared_view（含 days_until_expiry）
11. **i18n 双重 locale**：`weeklyReport.*` namespace 按页 locale 翻译（按钮/标题/UI chrome），AI 生成的 markdown 内容按用户选的 locale selector 调（默认 = 页 locale；用户可改）；二者解耦
12. **跨浏览器 PDF 测试**：Chrome / Safari / Firefox 各试一次（Stitch 设计 cyan + glass-panel 在 print mode 可能黑底白字反向 → 用 `@media print { ... background: white; color: black; ... }` force light）
13. **WeeklyReport.summaryJson 字段**：写入时含 `{ tenantSnapshot: {name, logoUrl}, kolActivity, roiData, prevWeekComparison, generatedAt, traceId }`；匿名路由从 summaryJson.tenantSnapshot 读 logo（避免 join Tenant 表）
14. **视觉参照 HTML 主**：浏览器打开 `design-draft/stitch-references/weekly-report.html` 作为主参照（per ui-fidelity-guardrail §1.1，PNG 缩略图不参照）

### 13.6 开工确认

**Planner 本次 commit 推 main 后 Generator 立即开工 F010**。按 §11 顺序 13 步推进（~9-11h）。开工前确认：
- [x] F009 已 done（依赖 ROI 数据装配 helpers）
- [x] hotfix-F001 公共组件库就绪（Button / GlassPanel / SectionHeader / StatCard / StatusBadge）
- [x] aigcgateway `weekly-report-for-client` Action 已建 + real call 验证（action_id 见 §13.2）
- [x] 批准 `npm i react-markdown remark-gfm`（~30KB bundle，Next code-split）
- [x] 批准 F010 同 commit 加 WeeklyReport unique constraint migration
- [x] 批准抽 `<WeeklyReportRenderer>` / `<WeeklyReportShareToast>` / `<WeeklyReportHistorySelector>` inline 在 page 目录（不抽 common，仅本页用）
- [x] BM1 F009 E2E 教训清单必遵守
- [x] §13.5 14 条额外叮嘱已读

---

**Generator 开工。本审计 §13 已裁决。**

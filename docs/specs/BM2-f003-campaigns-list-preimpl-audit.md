# BM2 F003 · Campaigns List 页面前置审计

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-24
> **触发：** F003 开工前 spec vs Stitch design vs schema 三方漂移审计
> **状态：** 自裁决（planner=generator=johnsong），见 §7

## 1. 背景与目标

F003 做 `/campaigns` 列表页 —— BM2 第一个可见 UI 页面，用户在此浏览现有 Campaign 并入口到新建 (F004) 或详情 (F005)。Stitch 设计稿 `campaigns-list.html` 506 行，含多个 MVP 不做的组件（bulk actions / 缩略图 / 数字分页 / 多 owner 头像），与 spec §F003 文字描述存在明显差异。开工前必须锁定"这轮实现到哪一步"。

## 2. 跨源比对

| 字段/区块 | Spec §F003 | Stitch `campaigns-list.html` | Schema 支持度 | 结论 |
|---|---|---|---|---|
| **整体布局** | "列表卡片（每卡一个 campaign）" | Table（7 列：checkbox/name/status/reach/ROI/owner/menu）| — | 冲突 → **#A** |
| **顶部按钮** | "新建 Campaign"主按钮 | 顶部 "New Campaign" 主按钮 | ✓ | ✓ 一致 |
| **Filter** | status + search by name | 下拉 status + search input | ✓ | ✓ 一致 |
| **KPI 列 1** | KOL 数 | Reach Progress（impressions 进度条）| Campaign.kolCampaigns.count ✓；CampaignMetric.impressions 暂无数据 | 冲突 → **#B** |
| **KPI 列 2** | spendTotal | ROI 趋势（`4.2x` + trending_up icon）| Campaign.spendTotal ✓ | 冲突 → **#B** |
| **KPI 列 3** | ROI%（仅 completed）| Owner 头像 | Campaign.revenueRecorded + spendTotal → ROI ✓；User.image 可用但 MVP 单 owner | 冲突 → **#B** |
| **缩略图** | 不提 | `<img>` 产品艺术图 | Product 无 image 字段 | → **#D**（drop） |
| **Checkbox + Bulk actions 浮动条** | 不提 | 7 个 bulk action（edit/duplicate/pause/delete）| — | MVP 不做 → **#D** |
| **Status 值域** | draft / active / completed（3 值 + all 过滤）| Active / Paused（只展示 2 值）| 自由文本 | 对齐 spec 3 值 → **#E** |
| **分页** | "cursor pagination（BI4-F004 util 复用）"| 数字翻页（1/2/3/.../5）| cursor util 已实现 | 冲突 → **#C** |
| **空态** | "插画 + '还没有 Campaign，点右上角创建一个'" | 未展示（design 假设有数据）| — | 采 spec → **#F**（空态文案） |
| **Campaign name sub-label** | 不提 | "Project-08 • Action RPG" | Campaign.product?.name + product.category（F001 已做 FK）| 采 design 补全 → 非决议，直接实现 |

### 2.1 其他观察（非决议）

- Campaign.status 目前是自由 String，default `'draft'`（B0 init）。BM2 enum {draft, active, completed} 在 app 层用 zod 校验。与 BM1 做法一致（不加 DB CHECK）。
- Filter 的 status dropdown 值：`all`（不传）/ `draft` / `active` / `completed`。`all` 在 URL 层表现为不带 `status` 参数，保持 URL 最短。
- Search 必须 tenant-scoped，走 `withTenant`。应避免在 WHERE 里拼接用户输入（SQL 注入）—— 用 Prisma `contains` mode insensitive。
- 排序：默认按 `createdAt DESC`（最新在前，符合"新建后立刻看到"直觉）。设计稿未明示，选此为默认。
- Campaign 行点击跳 `/campaigns/:id`（F005 页）。design 没有显式"Open"按钮，整行 clickable + Enter key。

## 3. 5 条决议请求

### #A — 列表呈现：卡片 vs 表格

| 方案 | 描述 | 利 | 弊 |
|---|---|---|---|
| **A** 表格（对齐 Stitch） | `<table>` + 7 列（裁剪到 5 列）| 信息密度高；与 BM1 /database 一致 | 列数收缩后留白较多 |
| B 卡片网格（spec 文字字面）| 3 列 grid，每卡 1 campaign | 移动端友好；适配少数据量 | 与 Stitch design 偏离；后续 F005 详情页是表格上下文 |

**建议：A**（设计稿 canonical；BM1 /database 相同风格；spec 文字"列表卡片"按"列表项"字面理解无歧义）

### #B — KPI 三列内容

Stitch: Reach / ROI / Owner；Spec: KOL 数 / spendTotal / ROI%。选定方向后决定 3 列内容：

| 方案 | 3 列组合 |
|---|---|
| **A** Spec 原版（推荐）| **KOLs** (count) / **Spend** (`$X,XXX` + 可选进度条 vs budget) / **ROI%** (completed 才显示) |
| B Design 原版 | Reach / ROI / Owner |
| C 混合 | KOLs + Spend / ROI / Owner |

**建议：A（spec 原版）**——数据完全来自 schema 现成字段；Reach 需要 CampaignMetric 聚合（MVP 无 seed 数据全显示 0%，空洞）；Owner 列 MVP 单 owner，价值低。ROI% 用 F008 的 `computeCampaignRoi` 不能用（F008 还没实现），先用简单公式 `(revenue - spend) / spend * 100` 并加注释"F008 完成后替换为 computeCampaignRoi"。

### #C — 分页

| 方案 | 描述 |
|---|---|
| **A** Cursor pagination（spec + BI4-F004 util）| URL: `?cursor=<opaque>&limit=20`；UI: Prev/Next 按钮 |
| B 数字翻页（Stitch）| URL: `?page=1&limit=10`；offset-based |

**建议：A**——spec 明写 cursor util，且 BI4-F004 已备；BM1 /discovery /database 同款；偏离会造成跨页风格不一致。UI 仅显示 Prev/Next + "Showing X campaigns"（去掉具体总数显示以避免 count 全表扫）。

### #D — 缩略图 / Checkbox / Bulk actions / Owner 头像

Stitch 的"表格周边"功能（缩略图 img / 左列 checkbox / 底部浮动 bulk-actions 条 / Owner avatar 列）MVP 全部不做：

- 缩略图：Product 无 image 字段，要么空白要么走占位符 —— 都显得劣质；drop。
- Bulk actions：MVP 单 campaign 操作，多选无场景；drop（对齐 BM1 database 的 `bulkActions` disabled 风格）。
- Owner avatar：MVP 单 owner，与 name 同列附带 "by {ownerName}" 文字即可替代；不单独列。
- `more_vert` kebab menu：操作入口只需"点整行进详情"一个即可；drop。

**建议：全部 drop**；Campaign name 单元格补 "by {ownerName}" 文案。

### #E — Status 值域

| 方案 | 值域 |
|---|---|
| **A** Spec 3 值 + all | {draft, active, completed} + 过滤器多 'all' |
| B Stitch 2 值 | {active, paused} |
| C 合并 | {draft, active, paused, completed} |

**建议：A**——对齐 spec + MVP scope；F005 StatusController（spec §F005 "draft→active→completed 按钮链"）也是 3 值，跨页一致。`paused` 留给 Post-MVP（见 spec §2 Out of Scope 明列"暂停功能"）。

### #F — 空态文案位置 / 触发时机

空态 UI (spec §F003 "插画 + '还没有 Campaign'" + CTA 按钮)：

| 方案 | 描述 |
|---|---|
| **A** 仅当 tenant 真的 0 campaign 时显示 | filter 结果为空时显示"无匹配结果"（非空态）|
| B 所有 `result.items.length === 0` 场景都用空态 | 无论是 0-campaign 还是 filter 无命中 |

**建议：A**——区分两态更贴近用户心理：0 总 campaign 时给 CTA "创建"；有 campaign 但 filter 没命中时提示"试试调整筛选"。这样避免用户在 filter=completed 看到 "没有 campaign，点右上角创建"的误导。实现上：额外跑一个 `campaign.count({ where: { tenantId } })` 判断是否真的 0 行。

## 4. 非决议但实现期必守

1. **RLS via withTenant**：所有查询走 `withTenant` 而非直接 prisma；search 用 Prisma `contains` + `mode: 'insensitive'`，不拼字符串。
2. **i18n 覆盖**：en + zh 必出译；ja/ko/es stub（BM1 F008 引入的防 MISSING_MESSAGE 风格）。
3. **nav 现状**：sidebar 已有 `campaigns` 链接（BM1 AppShell），不需新增 nav entry。
4. **BM1 F009 教训遵守**：
   - E2E 不用 `waitForLoadState("networkidle")`
   - 不硬编 seed-dependent count（test 数据自建）
   - revalidate-after-mutation 15s poll（F003 本身无 mutation，F004 会有）
5. **Product 产品名引用**：列表行显示 `Campaign.product?.name` 需要 `include: { product: { select: { name: true, category: true } } }`。Campaign.product 可能 null（spec 允许 optional productId）—— 显示"—"或"No product"。
6. **Visual baseline**：F011 会统一补 screenshots；本 F003 只确保 testid 和 markup 合理，截图延后。

## 5. 开工条件

§7 自裁决完成后立即开工：
1. `src/app/api/campaigns/route.ts` — GET list（filter / search / cursor）
2. `src/app/[locale]/(app)/campaigns/page.tsx` + `CampaignsFilterBar.tsx` + `CampaignRow.tsx`
3. `src/lib/campaigns/{filters.ts,search.ts,status.ts}` — filter schema / cursor wrapper / status enum
4. `messages/*.json` — `campaigns.*` namespace
5. `tests/integration/campaigns-list.test.ts`
6. `tests/e2e/campaigns-empty.spec.ts` 空态校验
7. 闸门：tsc + lint + npm test + integration + CI push
8. Staging deploy（build + restart，不需要新 migration）

## 6. 估算开工时长

| 环节 | 预估 |
|---|---|
| 审计 + 自裁决 | 25 min（本文档）|
| 路由 + API + lib + page + 组件 | 70 min |
| i18n 5 locales | 15 min |
| Integration test | 30 min |
| E2E 空态 + tsc + lint + integration run | 20 min |
| Commit + push + CI watch | 15 min |
| Staging deploy | 10 min |
| **总计** | **~3 h** |

## 7. Planner 裁决（johnsong · 2026-04-24）

**短格式决议：** `#A:A #B:A #C:A #D:A(全 drop) #E:A #F:A`

| # | 决定 | 理由 |
|---|---|---|
| #A | 表格布局 | Stitch design canonical；BM1 database 同风格；spec "列表卡片" 按"列表项"字面理解 |
| #B | Spec 三 KPI（KOLs / Spend / ROI%）| 数据现成；Reach 需 CampaignMetric 但 MVP 无 seed 全为 0；Owner 单值低价值 |
| #C | Cursor pagination + Prev/Next | spec 明要 + BI4-F004 util 现成 + 跨页风格统一 |
| #D | 全 drop（缩略图 / checkbox / bulk-actions / owner-avatar / kebab）| MVP 单用户单 campaign；Product 无 image；与 BM1 database `bulkActionsDisabled` 风格一致 |
| #E | {draft, active, completed} + filter 'all' | 与 F005 StatusController 一致；paused 列入 Out of Scope |
| #F | 区分"真 0 campaign"和"filter 无命中"两态 | 用户体验更清晰；避免在 completed filter 下显示"没创建任何 campaign"误导 |

### 7.2 同步文档更新

- 不修 spec §F003 文字（与实现思路不冲突，"列表卡片"词义扩展理解即可）
- 不修 features.json F003 acceptance（匹配程度足够）
- 实现时同步在 `CampaignRow.tsx` 顶部注释引用本 audit 的 #A/#B/#D 决议（对齐 BM1 F001 migration 头部注释风格）

### 7.3 实现期容易踩的坑

1. **ROI% 计算**：F008 有 `computeCampaignRoi` 的契约，本 F003 先简单 inline `(revenue - spend) / spend * 100`，代码注释标 `// TODO(BM2-F008): replace with computeCampaignRoi()`。F008 落地时回来替换。
2. **cursor util 的 orderBy**：默认 `createdAt` DESC。cursor 编码 `createdAt` 作为 sortValue。
3. **search 防抖**：URL 层同步（不做客户端防抖 OR 500ms 防抖。MVP 接受每键敲一次 server roundtrip）。对齐 BM1 discovery 的同款 pattern。
4. **count 全表扫问题**：`prisma.campaign.count({ where })` 在 n < 1000 无影响，MVP 接受；后续 > 10k 时换 `pg_class.reltuples` 估计。
5. **URL filter 编码**：status 值 `all` 不传；否则传 `?status=draft`。Search 用 `?q=...` 键名（与 BM1 discovery `search` 键保持一致 —— 检查一遍）。

**裁决推送 main 后，Generator 立即开工。**

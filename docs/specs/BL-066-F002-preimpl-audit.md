# BL-066 F002 · /campaigns/[id] 三段 layout 重写 · Pre-Impl 审计

> **发起者：** Kimi (Generator，本会话以 generator 角色执行；本机 .agent-id=johnsong 但 role_assignments.generator=Kimi，用户 5/14 同意先不动 .agent-id 由本会话替 Kimi 执行 Generator 工作)
> **日期：** 2026-05-14
> **触发：** F002 开工前审计，按 `framework/harness/pre-impl-adjudication.md` pre-impl 审计 → Planner 裁决工作范式
> **状态：** 等待 Planner johnsong 明确回复，**未收到前不开工**
> **关联：** docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md / features.json F002 / design-draft/bl066-campaign-detail-ai-main-panel/

---

## 1. 背景 & 目标

F002 acceptance（features.json + spec §3 F002）要求：
1. 重写 `src/app/[locale]/(app)/campaigns/[id]/page.tsx` 为新三段 layout（Brief 顶 / AI 主面板中 / AcceptedKolsPanel 底）
2. 严格按 Stitch F001 main.html 1:1 还原（per generator.md §设计稿还原规则）
3. 数据 load：**复用 `runCampaignDetail(tenantId, id)` 现 query** + 新增 smart-match 调用（F003 提供 client wrapper）
4. 空态 / loading 态按 Stitch 还原
5. 移除 AiSuggestionsCard sidebar（保留 generateCampaignSuggestionsAction 给未来批次使用，本批次仅卸载 UI）
6. L1 lint 0 / tsc 0 / unit test PASS（≥3 case 验三段渲染 + Brief 摘要数据 + 空态）
7. staging git_sha 与本 commit 一致

关键约束：
- spec §6 不变量「不动 BL-065 已 lock 的 /match 工作台」
- 不变量「F002 仅 mount，F003 才实装 AiRecommendationPanel.tsx」（spec §3 F003 acceptance 第 1 条）
- 不变量「F006 才 git mv CampaignKolPanel → AcceptedKolsPanel」（spec §3 F006 acceptance 第 1 条）

---

## 2. 跨源 / 数据 / 范围 漂移审计

### 2.1 Brief 区数据 vs `runCampaignDetail` shape 比对

读 Stitch main.html line 184-242 顶部 Brief 区，要求 4 列 grid + 状态 pills + 计数：

| Brief 区元素 | main.html 文案 | runCampaignDetail 返回字段 | 是否可派生 |
|---|---|---|---|
| ACTIVE pill | `ACTIVE` cyan + 圆点 pulse | `campaign.status` ('draft'/'active'/'completed') | ✅ 直派 |
| AI-DRIVEN pill | `AI-DRIVEN` 紫 + auto_awesome | （硬编码 visual marker，非数据） | ✅ 纯 visual |
| H1 | `Galactic Forge Alpha` | `campaign.name` | ✅ 直派 |
| Accepted 计数（右上）| `12 / 30` | `kols.length` ✓ / **"30 target" 无字段** | ⚠️ 部分缺 |
| Contacted 计数（右上）| `8` | **无 `contactedCount` 字段** | ❌ 可 filter kols 派生但需口径决策 |
| 第 1 列 Target Market | `Mobile, APAC` | `campaign.markets[]` (string[]) + `product.category` | ✅ 派生（`markets.join(", ")` 或加 product 国家） |
| 第 2 列 Demographics | `18-30, Strategy` | **无 demographics 字段**；`product.category` ≈ "Strategy" | ❌ Age 段无 source |
| 第 3 列 Budget | `$50,000` | `budgetAmount + budgetCurrency` | ✅ 直派 |
| 第 4 列（按钮组）| `Edit Brief` + `Launch Comm` | （纯 CTA 按钮） | ✅ 链 `/campaigns/[id]/edit` + outreach |

**关键缺口：**
- **Demographics "18-30, Strategy"** — `runCampaignDetail` 不返回任何 age/gender shape；`kpiTarget` 是 unknown JSON，未规范化
- **Accept target "/30"** — 无 `targetKolCount` 字段；`kpiTarget` 未规范化
- **Contacted 计数** — 可派生 `kols.filter(k => k.contactStatus !== "pending").length`，但 main.html 是固定数字 8（说明设计期望"已接触" = 非 pending 计数）

spec §3 F002 acceptance 第 3 条「复用 `runCampaignDetail(tenantId, id)` **现** query」明确禁扩 schema → 与设计稿 1:1 还原存在张力。

### 2.2 现 fidelity test 阻塞

`src/app/[locale]/(app)/campaigns/[id]/__tests__/campaign-detail-fidelity.test.ts` line 30-33 锁死 page.tsx 必须含 4 个 component import：

```ts
expect(page).toMatch(/<CampaignHealthCard\b/);   // line 30
expect(page).toMatch(/<AiSuggestionsCard\b/);    // line 31
expect(page).toMatch(/<ActivityTimelineCard\b/); // line 32
expect(page).toMatch(/<EmailPerformanceChart\b/);// line 33
```

F002 unmount 这 4 个组件 → 本 test 必须同 commit 更新（删 4 个 expect，加 BriefSummaryPanel + AiRecommendationPanel + CampaignKolPanel 的 import 期望）。

属于 spec acceptance 第 1 条"替换现 layout"的合理蕴含；仅作 audit 透明披露，无需 Planner 决策。

### 2.3 被 unmount 的组件文件存留处理

F002 page.tsx unmount 后，下列组件文件 page.tsx 端无引用：

| 组件 / 文件 | spec 是否明示保留 / 删除 | 其他引用 |
|---|---|---|
| `AiSuggestionsCard.tsx` (detail 页版) | spec §3 F002 明示「保留供未来批次」 | `campaigns-fidelity.test.ts` 引（list 页用） |
| `AiSuggestionsClient.tsx` | spec 隐含保留（依赖 generateCampaignSuggestionsAction） | `__tests__/AiSuggestionsClient.test.tsx` 引 |
| `ai-suggestions-actions.ts` | spec §3 F002 明示「保留 generateCampaignSuggestionsAction」 | AiSuggestionsClient 引 |
| `CampaignHealthCard.tsx` | spec 未明示 | 仅 page.tsx 引（F002 后 0 引用）|
| `ActivityTimelineCard.tsx` | spec 未明示 | 仅 page.tsx 引（F002 后 0 引用）；`__tests__/activity-i18n.test.ts` 引 |
| `EmailPerformanceChart.tsx` + `EmailPerformanceChartImpl.tsx` | spec 未明示 | 仅 page.tsx 引（F002 后 0 引用）|
| `CampaignRevenueRecorder.tsx` | spec 未明示 | 仅 page.tsx 引（F002 后 0 引用）|
| `CampaignStatusController.tsx` | spec 未明示 | 仅 page.tsx 引（F002 后 0 引用）；`tests/integration/campaign-detail-rsc-boundary.test.ts` 引 |
| `OutreachCta` (inline component) | spec 未明示 | 仅 page.tsx 局部定义 |
| `detail-insights.ts` (`loadCampaignDetailInsights`) | spec 未明示 | 仅 page.tsx 引（F002 后 0 引用）|
| `runAvailableKolsForCampaign` (detail.ts) | spec 未明示 | F005 删 AddKolDialog 后 0 引用（F002 先 unmount 时同步删此 import） |

spec §3 F002 acceptance 第 5 条说"保留 generateCampaignSuggestionsAction"建立了"保留模式"先例，但未推广到其它 6 个组件。**spec 灰色地带**。

### 2.4 中部 AI 主面板 F002 时形态

F002 acceptance 第 1 条要求"新三段 layout"；spec §3 F003 acceptance 第 1 条"新组件 `AiRecommendationPanel.tsx`"。

如果 F002 期间 `AiRecommendationPanel.tsx` 未存在，则 F002 page.tsx 中部需要 placeholder。但 F002 acceptance 第 4 条「空态 / loading 态按 Stitch 还原」+ 第 6 条「≥3 case 验三段渲染 + Brief 摘要数据 + 空态」要求 F002 完成时中部"空态"可视。

候选：
- (a) F002 page.tsx 直接 inline 写"空态"段 + F003 取代 → page.tsx 在 F003 commit 中再改一次
- (b) F002 同 commit 起 `AiRecommendationPanel.tsx` skeleton（无 useEffect 无 fetch，固定渲染空态/loading 态 per empty.html + loading.html），F003 commit 在同文件加 smart-match fetch + 5×2 卡片 + 按钮逻辑
- (c) F002 仅 mount `<div data-testid="ai-recommendation-placeholder" />` 占位，F003 替换

### 2.5 数据派生口径决策

如果接受方案 1A (限现字段派生)，需要锁口径：

- Contacted 计数定义：`kols.filter(k => k.contactStatus !== "pending").length`
  - 含义："已接触" = 任何 status 不是初始 pending 即算（contacted/quoted/signed/delivered/paid 全计）
  - 替代：`!== "pending" && !== "removed"` 排除被移除的（但 BL-066 已删 remove 入口，可能后续 kol_campaign 软删？）
- Demographics 渲染：仅显 product.category（如 "Strategy"）+ i18n "{ageDefault}" 文案 = "18-34" 默认段
  - 替代：完全隐藏 Demographics 列，4 列变 3 列 + 按钮组
- "/30 target" 隐藏：仅显 accepted 计数（`kols.length`），不显"/N target"

---

## 3. 决议请求

| # | 决议点 | A 方案 | B 方案 | C 方案 | 建议 |
|---|---|---|---|---|---|
| **1** | Brief 区数据 gap（Demographics / target / contacted） | **限现字段派生** + i18n 默认值占位（无 schema 改动） | **扩 schema** 加 `targetKolCount` + `demographics` 字段 + migration + Brief edit 表单更新（F002 范围 +3h） | **缩 Brief 列数 4→3**，删 Demographics 列 + 隐藏"/N target" | **A**（不违反 spec "复用现 query" + 不超 F002 scope；C 偏离 Stitch 1:1） |
| **2** | F002 中部 AI 主面板形态 | F002 page.tsx **inline 写空态段** （F003 再改一次 page.tsx） | F002 同 commit 起 **`AiRecommendationPanel.tsx` skeleton**（固定空态/loading 显示，F003 加 fetch + 卡片 + 按钮） | F002 仅 mount **`<div>` 占位**，F003 替换 | **B**（F002 完成时页面视觉完整、可视觉验收；F003 commit 局限于同文件加交互层，减少 page.tsx 重复改动） |
| **3** | 被 unmount 6 个组件文件存留 | F002 仅 unmount，**6 文件原位保留** 供 BL-070 二次清理；附带不动 fidelity test 之外的引用测试 | F002 同步加 `_deprecated_by_BL-066` 文件头 comment + test skip + i18n key deprecated marker | F002 同步 `git rm` 这 6 文件 + 关联测试 + i18n keys（F002 scope +1.5h；BL-070 scope -1.5h） | **A**（spec §3 F002 已建立"保留模式"先例；C 易破坏 e2e/integration test 现状导致 fix-round 浪费） |
| **4** | Contacted 口径锁定（仅当 #1 选 A 时生效） | `kols.filter(k => k.contactStatus !== "pending").length` | `kols.filter(k => ["contacted","quoted","signed","delivered","paid"].includes(k.contactStatus)).length`（白名单显式枚举） | 不显 Contacted 数字，删该 element | **B**（显式枚举避开未来新增 status 引入解读漂移，更稳定） |
| **5** | F002 是否提前 git mv 底部 CampaignKolPanel.tsx → AcceptedKolsPanel.tsx | F002 沿用 CampaignKolPanel.tsx 名字 + 删 AddKol button 入口（F006 范围）保留旧 mount，**F006 才 rename** | F002 提前 `git mv` 文件 + 删 AddKol button 入口（提前完成 F006 1/3 工作），F006 仅做"仅显已确认 KOL + source chip"重构 | F002 完全不动底部组件，连 AddKol button 入口也保留，F006 一次性做完 rename + 删入口 + source chip 重构 | **C**（features 边界严格 — F002 仅做"新三段 layout"骨架 + unmount sidebar；底部 panel 内部改造 F006 一次性做，最干净；按 anti-pattern 4.7 不越界） |

### 裁决格式要求
请 Planner johnsong 用 `#1:A #2:B #3:A #4:B #5:C` 短格式回复在本文件末尾追加 `## 5. Planner 裁决` 段。

---

## 4. 原型 bug / 已知漂移追加

**Stitch 渲染漂移（README §"已知 Stitch 渲染漂移"已记 4 项）：** 不重复，按 README 处理。

**审计期间新发现：**

| # | 漂移 / Bug | 影响 | 建议处理 |
|---|---|---|---|
| 5 | main.html line 269-272 KOL 卡 platform chip 颜色硬编码 `text-[#FF0000]` (YouTube red)、line 302-305 `text-[#9146FF]` (Twitch purple) | 未走 @theme tokens；与项目设计系统 token-only 原则有张力 | F003 实装时按 platform 派生颜色 token（已有 `tokens/platforms.ts`？需 grep）；非 F002 范围，仅登记 |
| 6 | empty.html line 240-242 「Reconnect product」CTA 链 `href="#"` 占位 | spec §3 F002 第 4 条「空态按 Stitch 还原」需 wire 此链接 | F002 wire 到 `/${locale}/campaigns/[id]/edit` 或 `/${locale}/products/${product.id}/edit`；按 #1 裁决方向，建议链前者（在 campaign edit 页选/换 product） |
| 7 | loading.html Brief 区 layout 与 main.html 不同（仅 2 元素 vs main 4 列） | 仅是 Stitch 生成漂移 | 以 main.html 为 canonical，loading 态 Brief 区沿用 main 结构（仅中部 AI 区切 loading 骨架） |

---

## 5. 开工条件

收到 Planner johnsong 对 #1-#5 决议 + #6 wire 目标的明确回复后，Generator 将：
1. 按裁决方向新建 `BriefSummaryPanel.tsx`（顶部）+ 按 #2 方向 mount/起 `AiRecommendationPanel.tsx` + 按 #5 方向处理底部
2. 重写 `page.tsx` 三段 layout（删 sidebar + Email/Revenue/Status/Outreach mount，按 #3 方向处理 unmount 文件存留）
3. 新增 i18n keys `campaigns.detail.brief.*` + `campaigns.detail.aiPanel.*` 框架（en/zh/ja/ko/es 5 locale）
4. 更新 `__tests__/campaign-detail-fidelity.test.ts`（删 4 个旧期望，加新组件期望）
5. 新增 ≥3 case 单测（建议：BriefSummaryPanel 三栏渲染 + Contacted 派生口径 + 空 product 处理）
6. L1 lint + tsc + vitest 全绿
7. staging deploy（SSH `git pull + npm ci --include=dev + npx prisma generate + npx prisma migrate deploy + NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=... npm run build + pm2 reload kolmatrix-staging --update-env`）+ 验证 git_sha 一致
8. 更新 features.json F002 status pending → completed + progress.json completed_features 1 → 2 + session_notes
9. push main + 检查 CI

**未收到 Planner 明确回复前不开工。**

---

## 6. 估算开工时长（per 方案 A/B/A/B/C 建议组合，未含 staging deploy）

| 环节 | 预估 |
|---|---|
| BriefSummaryPanel.tsx 新建 + 4 列 grid + 派生计算 + 链接 wire | 2.5h |
| AiRecommendationPanel.tsx skeleton（empty / loading 态固定，per Stitch empty.html + loading.html）| 1.5h |
| page.tsx 三段 layout 重写 + sidebar 卸载 + 6 组件 unmount | 1h |
| i18n 5 locale × campaigns.detail.brief.* + campaigns.detail.aiPanel.* | 1.5h |
| campaign-detail-fidelity.test.ts 更新 + 新 ≥3 case 单测 | 1.5h |
| L1 lint/tsc/vitest 排错 | 0.5h |
| **总计** | **~8.5h Generator** |

（spec §3 F002 estimated_hours 12h，本估算 8.5h 在范围内，预留 3.5h 给 staging deploy + CI 自修）

---

## 7. 相关文档

- `docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md`（主 spec）
- `features.json` F002（acceptance 7 条 + executor:generator + estimated_hours 12.0）
- `design-draft/bl066-campaign-detail-ai-main-panel/README.md` + `main.html` + `empty.html` + `loading.html`（F001 Stitch 设计稿，1:1 还原源）
- `src/app/[locale]/(app)/campaigns/[id]/page.tsx`（现 BM2-F005 实装，本 audit 比对源）
- `src/lib/campaigns/detail.ts`（`runCampaignDetail` shape，§2.1 数据 gap 来源）
- `src/app/[locale]/(app)/campaigns/[id]/__tests__/campaign-detail-fidelity.test.ts`（fidelity test 阻塞源，§2.2）
- `framework/harness/pre-impl-adjudication.md`（本 pattern）

---

# BL-105 campaign 编辑 UI 补回(波3)

> **Type：** 功能补回(审计 M1：下层 action/API/lib 已实装有测试但零 UI 入口)。spec 硬性。
> **用户决策(2026-06-09)：** 补回编辑入口(非退役死代码)。
> **来源：** docs/reviews/full-feature-chain-audit-2026-06-09.md M1 + H6 · 路线图波3
> **ADR 一致性：** 与 ADR-013(AI-native)/ADR-015(IA)一致——**详情页保持 AI-native 只读**，编辑走**独立 `/edit` 页 + 名单 inline**，不把详情页改回可编辑表单。

## §1 现状(源码实证，审计 M1)

详情页 `campaigns/[id]/page.tsx`(BL-066-F002 / BL-070-F005)= AI-native 只读 3 panel(BriefSummaryPanel / AiRecommendationPanel / AcceptedKolsPanel)。BL-070-F005 删了 6 个编辑组件。**6 个孤儿 server action 全实装有单测、零 UI 调用方**(`campaigns/[id]/actions.ts`)：

| action | 行 | 作用 | 入参(FormData) |
|---|---|---|---|
| `updateCampaignFieldsAction` | 57 | 改 campaign 字段 | campaignId + name/brief/budget 等 |
| `transitionStatusAction` | 101 | 状态流转 | campaignId + next(draft/active/completed) |
| `recordRevenueAction` | 124 | 记录营收 | campaignId + revenue |
| `removeKolAction` | 162 | 移除 KOL | campaignId + kolId |
| `updateKolContactStatusAction` | 185 | 改 KOL 联系状态 | campaignId + kolId + status |
| `updateKolFeeAction` | 215 | 改 KOL fee | campaignId + kolId + fee |

下层 `lib/campaigns/update.ts`(updateCampaignFields/transitionCampaignStatus/recordCampaignRevenue)+ `kol-operations.ts`(removeKolFromCampaign/updateKolCampaign)已实装有测试。H6：`BriefSummaryPanel.tsx` "Edit Brief" → `/[locale]/campaigns/[id]/edit`(路由不存在 → 404)。

> 复用现成已测 action/lib，本批主要是**前端接线** + 权限门控 + i18n。各 action 的精确字段/校验以 actions.ts + update.ts 现有实现为准(Generator 读源对齐，不改 action 契约)。

## §2 Features

> 全 generator 含单测 + i18n 5 locale + L1 全绿。权限：编辑限 campaign owner / admin(复用现有 requireSession + 既有 action 内鉴权)。

### F001 — /campaigns/[id]/edit 页 + campaign 字段编辑 + H6 接线(generator)
- 新建路由 `src/app/[locale]/(app)/campaigns/[id]/edit/page.tsx`：加载 campaign(复用 runCampaignDetail 或精简 loader)，非 owner/admin 或不存在 → notFound/redirect。
- 表单编辑 campaign 字段(name / brief / budget amount+currency / markets 等，以 `updateCampaignFieldsAction` 实际接受字段为准)，提交接 `updateCampaignFieldsAction`，成功 toast + 回详情页/revalidate。
- **H6 修复**：`BriefSummaryPanel.tsx` "Edit Brief" href 已是 `/[locale]/campaigns/[id]/edit` → 现在指向真页(不再 404)。
- i18n 5 locale(编辑表单标签/校验/成功)。单测(表单提交调 action / 非 owner 不可达 / 校验)。

### F002 — 编辑页状态流转 + 营收记录(generator)
- 编辑页加状态流转控件(draft→active→completed，合法流转，接 `transitionStatusAction`)+ 营收记录输入(接 `recordRevenueAction`)。
- 成功后 revalidate 详情页(BriefSummaryPanel status pill / ROI 页营收随之更新)。
- i18n + 单测(流转调 action / 非法流转挡 / 营收校验)。

### F003 — AcceptedKolsPanel 名单 inline 操作恢复(generator)
- `AcceptedKolsPanel.tsx` 每行恢复操作(BL-070 删的)：移除 KOL(`removeKolAction`)/ 改 fee(`updateKolFeeAction`)/ 改 contact-status(`updateKolContactStatusAction`)。inline 控件 + 确认(移除)+ 乐观/revalidate。
- 详情页保持只读基调，仅名单行加最小编辑操作(不改 AI panel)。
- i18n + 单测(每操作调对应 action / 移除确认 / 乐观回滚)。

### F004 — Codex L1+L2 + signoff(codex)
- L1：lint 0err warn≤3 / tsc=0 / npm test(含各 feature 新测)。
- L2 部署后 staging：① 详情页/BriefSummaryPanel "Edit Brief" → `/edit` 不再 404 ② 编辑 campaign 字段保存生效(详情页/DB 反映)③ 状态流转 draft→active→completed 生效 ④ 营收记录 → ROI 页反映 ⑤ 名单移除/改fee/改status 生效 ⑥ 非 owner/admin 不可编辑。
- signoff `docs/test-reports/BL-105-signoff-2026-06-XX.md`。

## §3 风险

- **孤儿 action 首次真用**:虽有单测，UI 接线是首次端到端；Generator 读 action/lib 源对齐字段契约(不改 action)，Codex L2 端到端验。
- **详情页只读基调**:F003 仅名单行加最小操作，不把详情页改回编辑表单(守 ADR-013 AI-native)。
- 纯 kolmatrix，无 schema/env 变更(下层表/字段已存在)。⚠️ 部署 staging+prod 手动触发 OOM NODE_OPTIONS=4096。
- 权限:编辑操作限 owner/admin(既有 action 鉴权 + 页面门控双层)。

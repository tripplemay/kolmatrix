# BM2 F005 · Campaign Detail 页面前置审计（短版）

> **发起者：** johnsong (Generator + Planner)
> **日期：** 2026-04-24
> **状态：** 已自裁决，§5 给出决议表

## 1. 背景

F005 做 `/campaigns/:id`，4 section：Header+KPI / KOL 面板 / Revenue+Status / 邮件入口。Stitch `campaign-detail.html` 568 行，内容远超 MVP，包含 Campaign Health 小部件、6 KPI、Share/Pause 按钮、Activity Timeline、Schedule Chip 等。此审计锁定 MVP 裁剪边界 + 核心交互语义。

## 2. 决议

| # | 决议点 | 方案 | 理由 |
|---|---|---|---|
| #A | Stitch 的 Campaign Health 小部件（Progress/Open Rate/Reply Rate/Projected ROI）| **drop** | 数据需 email tracking / AI 预测，MVP 无；Out-of-Scope 对齐 spec §2 |
| #B | Share / Pause 按钮 | **drop** | Paused 状态 MVP 不做；Share 是 F010 周报链接的职责 |
| #C | KPI 条 Stitch 6 个 vs spec 4 个 | **采 spec 4 个**（Budget / SpendTotal / Revenue / ROI%）| Contacted / Open Rate / Reply Rate 需要 F006 发邮件后才有数据，本页显示 0 空洞 |
| #D | Schedule chip（"12 days left"）| **drop** | 派生自 endDate，信息价值低，留给 F011 完成后的 polish；不值得初版成本 |
| #E | Activity Timeline | **drop** | 已有 event_log + audit_log 写入，但本页做 timeline UI 成本 > 价值；放 F007 CRM 统一展示"最近关系变化表"更合适 |
| #F | Breadcrumb `Campaigns / 当前名` | **保留** | 廉价 UX（AppShell Topbar 已给 page title，页内 breadcrumb 重复度低但有导航回上一级的价值）|
| #G | Mutation pattern | **Server Action + 薄 API wrapper** | Server Action 匹配 BM1 实现；API 为未来 mobile/webhook 保留；共享同一 lib helper |
| #H | spendTotal 重算 | **服务端事务** | spec 明写"避免隐形魔法"，选事务内 recompute 而非 DB trigger |
| #I | audit_log | **BI4-F003 `logAudit`** | 记 `campaign.kol.status_changed` + `campaign.kol.fee_updated`（spec §F005）+ `campaign.status_transitioned` + `campaign.revenue_recorded`（隐性要求，改动有业务影响）|
| #J | Status transitions | **`draft → active → completed` 严格前向 + `completed → active` 一键 Reactivate** | spec §F005 "重新激活 切回 active 解锁"。禁止 `completed → draft` 或 `active → draft`（语义逆转）|
| #K | AddKolDialog 数据源 | **`Kol.isSaved=true` ∩ 本 campaign 未加入** | spec §F005 明写；加 search input + scroll 列表（MVP 无分页；假设一个 tenant 单次 campaign KOL 量 < 50） |
| #L | KolCampaign.contactStatus 6 值 | **线性 + 跳跃允许** `pending → contacted → quoted → signed → delivered → paid` | PRD §11 锁定（可跳前进不可回退）；MVP 在 select 控件上不做硬约束（用户误点可被审计出来），app 层 zod 校验值域 |
| #M | kolFee 输入 onBlur 保存 | **接受**；0 值视为 null（无协议费用）；精度 Decimal(10,2) | spec §F005；与 F001 schema 一致 |
| #N | Revenue 录入锁 | status=completed 后只读；Reactivate 后解锁 | spec §F005 |
| #O | 4 KPI 中 ROI% 计算 | 复用 F003 的 `computeRoiPercentInline`（未来 F008 替换）| DRY；同 TODO(BM2-F008) 注释 |

## 3. API 契约

| 路由 | 方法 | 用途 | 调用方 |
|---|---|---|---|
| `/api/campaigns/[id]` | `GET` | 获取详情 + KOL 列表 + product | 外部；UI 走 RSC 直读 |
| `/api/campaigns/[id]` | `PATCH` | 更新 name / dates / budget / status / revenue | UI Server Action + 外部 |
| `/api/campaigns/[id]/kols` | `POST` | 加 KOL（body: `{kolId, kolFee?}`）| UI + 外部 |
| `/api/campaigns/[id]/kols/[kolId]` | `DELETE` | 移除 KOL | UI + 外部 |
| `/api/campaigns/[id]/kols/[kolId]` | `PATCH` | 改 status / kolFee | UI + 外部 |

## 4. 开工步骤 / 文件清单

1. `src/lib/campaigns/kol-campaign-status.ts` — 6 值 enum + zod
2. `src/lib/campaigns/detail.ts` — `runCampaignDetail(tenantId, id)` RSC 读数据
3. `src/lib/campaigns/update.ts` — 更新字段（name/dates/budget/revenue/status）+ audit_log
4. `src/lib/campaigns/kol-operations.ts` — 加/删/改 KolCampaign（事务内 recompute spendTotal + audit_log）
5. `src/app/[locale]/(app)/campaigns/[id]/actions.ts` — Server Actions 7 条
6. API 3 个 route 文件
7. `page.tsx` + `CampaignHeader.tsx` + `CampaignKolPanel.tsx` + `AddKolDialog.tsx` + `CampaignRevenueRecorder.tsx` + `CampaignStatusController.tsx`
8. i18n `campaigns.detail.*`
9. `tests/integration/campaign-detail.test.ts`
10. pure-fn unit tests（status transitions + payload diffs）
11. commit / CI / staging

## 5. 非决议但实现期遵守

- BM1 F009 教训继续遵守：revalidatePath 后 15s polling，不硬编 seed count
- `redirect()` locale-prefixed（复用 F004 helper）
- 所有 mutation 走 withTenant；不在查询参数里手拼 tenantId
- 删除 KOL 前的 `confirm()` 放在客户端；服务端不做二次确认
- `CampaignCreateError` 风格复用到本批次的 `CampaignUpdateError` / `CampaignKolError`

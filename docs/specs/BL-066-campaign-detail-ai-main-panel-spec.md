# BL-066 Campaign 详情页 AI 推荐主面板 — Spec

> **起草：** 2026-05-14 北京 / Planner johnsong
> **状态：** Accepted（4 决策点用户 5/14 ack；待 user ack → building）
> **批次类型：** 普通批次（全部 executor:generator）+ 1 条 Planner 任务（F001 Stitch 设计稿）
> **优先级：** P0（Phase 2 第二批 / ADR-013 AI native 核心体验）
> **预估工时：** ~9-11 day Generator + 1 day Reviewer（含 BL-048 valueScore 合并）
> **依赖：** BL-065 done ✅（Match 页 ready + ?campaignId AI sidebar shell 起步）
> **关联：** ADR-013 §Decision 第 2 条 / vision §2 §3 场景 4-5 / roadmap §4 BL-066

---

## §1 背景

BL-065 完成 Match 页统一工作台 + AI sidebar (campaign-context mode 起步，sidebar 形式)。本批次升级 `/campaigns/[id]` 详情页为 AI native 体验 — 顶部 Brief 摘要 + 中部 AI 推荐主面板 + 底部已确认 KOLs 工作流（roadmap §4 BL-066 + vision §2 Match 路由定义 + 场景 4 触达邮件 AI 生成）。

同时合入 BL-048 valueScore 公式区分度优化（用户决策 5/14 合一为同 batch；roadmap §4 原计划并行，简化为单 batch atomic 发布以避免 staging valueScore + AI 推荐 quality 双源不同步）。

### 当前 /campaigns/[id] 现状（13 文件 + actions.ts + ai-suggestions-actions.ts）

- `page.tsx` (server) — 顶部 CampaignHeader + 中部 CampaignKolPanel + 右侧 AiSuggestionsCard sidebar
- `CampaignKolPanel.tsx` (client) — 已确认 KOL 列表 + AddKolDialog 入口 + KolCampaignRow（contactStatus / kolFee / addedAt）
- `AddKolDialog.tsx` — 手动添加单 KOL 到本 campaign（与 /database AddKolDialog 不同；它是 add-to-campaign 而非 add-new-KOL）
- `AiSuggestionsCard.tsx` — 右侧 sidebar，AiSuggestionsClient wrapper
- `AiSuggestionsClient.tsx` — 调 `generateCampaignSuggestionsAction` 返回 `Suggestion[]`（priority/title/description/action_link）— **campaign action 建议**而非 KOL 推荐
- `ActivityTimelineCard.tsx` / `CampaignHealthCard.tsx` / `CampaignRevenueRecorder.tsx` / `CampaignStatusController.tsx` / `EmailPerformanceChart.tsx`

### 合入 BL-048 范围

BL-023 全量 recompute 后 prod top-15 valueScore=100 含 2080-12.6M 粉双峰（区分度失真）。三处设计 gap：
1. followerScore: `min(50, log10(followerCount) × 15)` → cap 在 2154 粉，mega vs nano 同分
2. categoryScore: `min(20, categories.length × 8)` → length-only 无质量信号
3. engagementScoreFromRate: `>= 10%` 一刀切 → 22

修复策略（spec §3 F007 锁）：follower 公式调整 + engagement 阶梯 + category weighted（如需）。

---

## §2 业务目标

- `/campaigns/[id]` 详情页升级为 AI native 主面板 — marketer 看到 AI 推荐 top N KOL，可一键"接受 / 跳过 / 换一批"，"为什么"占位（C2 浅版，C3 完整在 BL-067）
- AI 推荐源复用 `/api/kols/smart-match`（用户决策 5/14 #1）— 用 campaign.productId 喂 cosine 匹配；F002 building 后期评估是否质量不足拆 BL-068
- AddKolDialog 完全删除（用户决策 5/14 #2）— marketer 不再手动加 KOL，仅 AI 推荐 + CSV 导入（/admin/kol-csv-import）+ API 触达
- BL-048 valueScore 区分度优化合入（用户决策 5/14 #3）— 同 staging + prod recompute，AI 推荐 quality 同步升级
- Stitch 设计稿新建（用户决策 5/14 #4）— Planner F001 先出设计稿，Generator F002 按 Stitch HTML 1:1 还原

### 不在本批次范围

- BL-067 C3 双向 explainability（每个 KOL 完整"为什么"段 + 用户 query "为什么这个排前"）
- BL-068 B3 自然语言 refine（用户对话式调整推荐方向）
- BL-070 二次清理（旧 discovery.* / database.* i18n 键 / /api/database/export-csv 路由 / nav 旧 key 等技术债）
- AI 邮件个性化升级（场景 4 触达 — 现 outreach 已有部分，BL-066 范围仅推荐主面板）

---

## §3 范围（9 features）

### F001 — [Planner] Stitch 设计稿新建：/campaigns/[id] AI 推荐主面板 layout

**Executor：** generator（但 Planner 主导，Generator 仅核 acceptance）
**周期：** ~1 day Planner（独立于 Generator 开工）
**Acceptance：**
- 新 Stitch 项目 `bl066-campaign-detail-ai-main-panel`（不复用 BL-065 / canonical app shell asset），包含 3 屏：
  - 主屏：顶部 Brief 摘要（产品名 + 活动目标 + budget + 关联 KOL 计数）+ 中部 AI 推荐主面板（top 5/10/30 KOL 候选，每个 KOL valueScore + 一句话"为什么"占位）+ 底部 AcceptedKolsPanel（contactStatus / kolFee / addedAt）
  - 空态：AI 推荐 0 候选时显「等数据」占位 + 引导文案
  - Loading 态：smart-match 调用中的骨架屏
- Stitch URL + screenshot 写入 `design-draft/` 目录（路径：`design-draft/bl066-campaign-detail-ai-main-panel/`）
- Generator 核对 Stitch HTML 含 acceptance KOL 卡 + 操作按钮（接受 / 跳过 / 换一批）+ "为什么"占位段

### F002 — /campaigns/[id] page.tsx 三段 layout 重写

**周期：** ~1.5 day Generator + 1h Reviewer
**Acceptance：**
- `src/app/[locale]/(app)/campaigns/[id]/page.tsx` 重写：替换现 layout（CampaignHeader + CampaignKolPanel + sidebar）为新三段（Brief 顶 / AI 主面板中 / AcceptedKolsPanel 底）
- 严格按 Stitch F001 1:1 还原（按 generator.md §设计稿还原规则）
- 数据 load：复用 `runCampaignDetail(tenantId, id)` 现 query + 新增 smart-match 调用（F003 提供 client wrapper）
- 空态 / loading 态按 Stitch 还原
- 移除 AiSuggestionsCard sidebar（被中部主面板替代；保留 generateCampaignSuggestionsAction 给未来其它批次使用，本批次仅卸载 UI）
- L1 lint 0 / tsc 0 / unit test PASS（≥3 case 验三段渲染 + Brief 摘要数据 + 空态）
- staging git_sha 与本 commit 一致

### F003 — AiRecommendationPanel 组件 — smart-match 集成 + 接受/跳过/换一批 状态层

**周期：** ~2 day Generator + 1h Reviewer
**Acceptance：**
- 新组件 `src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx`（"use client"）
- 调用 `/api/kols/smart-match` POST { productId, count: 30 } 取候选 top 30 KOLs（cosine matchScore desc，已含 valueScore）
- 客户端 status state：`pending` / `accepted` / `skipped` / `replaced` per KOL，Set<kolId>
- 操作 UI：每个 KOL 卡片含「接受」「跳过」「换一批」按钮 + valueScore + "为什么"占位（C2 浅版："matched on cosine similarity {matchScore}; valueScore {valueScore}"）
- 「换一批」从 client cache（candidate 池 top 30）取下一组 5 个，不重 fetch（cache miss 时重 fetch）
- 「接受」调 F004 acceptKolAction → 状态切 accepted + 加入 AcceptedKolsPanel（router.refresh）
- 「跳过」纯 client state 切 skipped（不入 DB；BL-067 C3 时可记入 kol_campaign extra metadata）
- localStorage cache `campaign-recommendations-{tenantId}-{campaignId}`：candidate 池 + status state，TTL 24h
- L1 PASS

### F004 — acceptKolAction / skipKolAction 路径 + kol_campaign 表写入

**周期：** ~1 day Generator + 1h Reviewer
**Acceptance：**
- 新文件 `src/app/[locale]/(app)/campaigns/[id]/recommend-actions.ts`（"use server"）含 `acceptKolToCampaignAction({ campaignId, kolId, source: "ai_smart_match" })` server action
- 写入 `kol_campaign` 表：`{ campaignId, kolId, contactStatus: "not_contacted", source: "ai_smart_match", addedAt: now }`
- `audit_log` event type `campaign.kol_accepted_via_ai` + payload `{ source, matchScore }`
- Rate limit 用 rateLimitBatchSend (20/min/user)
- 单测 ≥5 case：(a) unauthorized / (b) campaignId not in tenant / (c) kolId not found / (d) duplicate accept 静默 noop / (e) success + audit log shape
- skipKolAction 本批次仅 client-state（不写 DB），保留 server action 框架供 BL-067 升级时用
- L1 PASS

### F005 — 删除 AddKolDialog（/campaigns/[id] + /match）

**周期：** ~0.5 day Generator + 0.5h Reviewer
**Acceptance：**
- 删除 `src/app/[locale]/(app)/campaigns/[id]/AddKolDialog.tsx`（campaign-detail add-to-campaign 旧路径）
- 删除 `src/app/[locale]/(app)/match/AddKolDialog.tsx`（BL-065-F006 git mv 进 /match 的手动加 KOL 路径）
- 删除 `addKolAction` from `src/app/[locale]/(app)/match/actions.ts`
- 删除 `src/app/[locale]/(app)/match/__tests__/addKolAction.test.ts`
- 移除 `match/page.tsx` 中 AddKolDialog mount + tDbHeader/tAddKol 翻译别名 + match.headerActions / match.addKolForm i18n 键（保留 i18n 键但加 `_deprecated_by_BL-066` 后缀避免误用，BL-070 删）
- 删除 `campaigns/[id]/CampaignKolPanel.tsx` 中 AddKolDialog 引用
- 更新 e2e match-fidelity.spec.ts 移除 admin/marketer 角色 AddKolDialog 探针 case
- L1 PASS

### F006 — CampaignKolPanel 重构为 AcceptedKolsPanel

**周期：** ~1 day Generator + 1h Reviewer
**Acceptance：**
- `git mv src/app/[locale]/(app)/campaigns/[id]/CampaignKolPanel.tsx → AcceptedKolsPanel.tsx`
- 删除组件内 AddKolDialog 入口 + 「添加 KOL」 button
- UI 改造：仅显已确认 KOL（kol_campaign 表 source IN ('ai_smart_match', 'csv_import', 'manual_legacy')）
- 卡片显 source chip（AI / CSV / Legacy）方便 marketer 区分来源
- 移除手动 contactStatus / kolFee 编辑入口（保留只读显示；后续 outreach flow 写）
- L1 PASS

### F007 — BL-048 valueScore 公式优化合入

**周期：** ~2-3 day Generator + 1 day Reviewer（含 ADR-014 起草 + recompute SQL ops + 全量 SQL apply）
**Acceptance：**
- 修改 `src/lib/kol/value-score.ts`（如不存在则在 BL-023 实装位置）：
  - followerScore: `min(50, log10(followerCount) × 10) + cap 80`（拉伸到 1M+ 才接近满分）
  - categoryScore: 仅按 length（保留现 logic）但 normalize 范围调到 max 15（让 follower + engagement 占更大权重）
  - engagementScoreFromRate: 改阶梯 — `>= 5% → 12`, `>= 8% → 16`, `>= 12% → 20`, `>= 16% → 25`（nano 高 engagement 不再一刀切到 20）
  - RAW_MAX 改 95（normalize 总分）
- 新增 ADR `docs/adr/ADR-014-value-score-formula-v2.md`：背景 + 三处调整理由 + 公式 before/after + impact analysis（top-15 分布变化预期 mega 重登顶 + nano 区分度回来）
- 单测扩充：value-score.test.ts 加 ≥6 case 覆盖新公式
- Recompute SQL ops（独立 SSH session）：staging 跑 `UPDATE kol SET value_score = <formula>(...)`；prod 同步（用户 ack 时间窗）；audit_log 写 `value_score_recompute_v2` event with row_count
- 验证 staging prod top-15 不再出现 2K vs 12.6M 同分；mega-tier 重登顶
- L1 PASS

### F008 — i18n 5 语言 + e2e (campaign-match-flow.spec.ts) + match-fidelity 适配

**周期：** ~1 day Generator + 0.5 day Reviewer
**Acceptance：**
- `messages/{en,zh,ja,ko,es}.json` 加 `campaigns.detail.aiPanel.*` 完整 keys（顶部 Brief / 中部 AI 主面板 / 操作按钮 / 空态 / loading / 来源 chip）
- 删除 `campaigns.detail.aiSuggestions.*` keys（AiSuggestionsCard 被卸下，标 deprecated 留 BL-070 删）
- 新建 `tests/e2e/campaign-match-flow.spec.ts` — 6 case：
  - 三段 layout 渲染
  - AI 主面板 mounted + top N 候选可见
  - 「接受」按钮 click → kol 入 AcceptedKolsPanel
  - 「跳过」按钮 click → kol 从主面板消失（client state 切）
  - 「换一批」按钮 click → 下一组候选可见
  - Stale productId（campaign.productId 指向已删 product）→ 主面板显空态 + 引导文案
- 更新 `tests/e2e/match-fidelity.spec.ts` 移除 "Add KOL trigger mounts in the header actions row" case
- L1 PASS

### F009 — staging + prod redeploy + 视觉 baseline regen + 24h 监控 + signoff

**周期：** ~0.5-1 day Generator + 1 day Reviewer
**Acceptance：**
- staging deploy via deploy-staging.yml（含 BL-048 valueScore recompute SQL）
- 视觉 baseline regen via update-visual-baselines workflow（en-campaign-detail.png 必新生成 + 可能更新 en-match.png）
- 团队 staging dogfood spot check（Planner 在 building 后期给清单）
- prod redeploy 用户 ack 时间窗（per BL-063/064/065 实战流程）
- 24h pm2 monitor（Reviewer 自行评估加速 — 沿 BL-065 决策模式）
- `scripts/bl066-f009-prod-audit.sh` 类比 BL-065-F007 audit script
- `docs/test-reports/BL-066-signoff-2026-05-XX.md` 写最终结论 + Phase 2 第二批完成确认 + BL-048 valueScore v2 落地 marker
- Reviewer 复验全部 acceptance + signoff v2，progress.json status reverifying → done

---

## §4 关键决策点（5/14 全 lock）

| ID | 决策 | 选项 / 理由 |
|---|---|---|
| #A | AI 推荐源 = `/api/kols/smart-match` 复用 | smart-match 在 /discovery SmartMatchDialog 6 个月生产实战 + 与 campaign.productId 天然契合；F002 building 后期评估是否拆 BL-068 |
| #B | AddKolDialog 完全删除（/campaigns/[id] + /match 两处）| roadmap F004 原描述；marketer 只走 AI 推荐 + CSV / API 导入；UI 管道纯净 |
| #C | BL-048 valueScore 合入本 batch | atomic 发布避免 staging valueScore + AI 推荐 quality 双源不同步；BL-048 spec scope 已 mature（backlog 含 3 候选方向，本 batch §3 F007 锁公式细节） |
| #D | Stitch 设计稿新建（BL-066 F001）| 顶/中/底三段 layout 大改 + 中部 AI 推荐主面板新 UX，沿用 prototype 增量难承载；Planner F001 出设计稿后 Generator F002 1:1 还原 |
| #E | AI 推荐 status state 客户端管理（不入 DB）| skip/replace 操作纯 client；只有 accept 写 kol_campaign。BL-067 C3 时可升级 skip/replace 写 DB 用作个性化学习信号 |
| #F | localStorage cache TTL = 24h | 同 BL-065 F005 AiSuggestionsClient cache 策略一致；marketer 一天可重 "换一批" 多次而不重压 smart-match endpoint |

---

## §5 风险

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| /api/kols/smart-match cosine 质量不足，AI 推荐质量低于预期 | 中 | 高 | F002 building 后期 dogfood + 团队 spot check；不足 → BL-068 (B3 refine) / BL-067 (C3 explainability) 加权 |
| BL-048 valueScore recompute 影响其他批次依赖（如 BL-067 explainability / BL-061 weekly growth-curve）| 中 | 中 | F007 同 commit ADR-014 + 全量 recompute SQL apply on staging 先；prod 用户 ack 时间窗 + audit_log 完整记录 |
| AddKolDialog 删除后 marketer 报"找不到手动加 KOL" | 低 | 低 | i18n 删除时加 deprecated marker + /admin/kol-csv-import 仍可用 + 文档说明 |
| Stitch 设计稿延迟阻塞 building | 中 | 高 | F001 Planner 主导，独立于 Generator 开工；F002 不开工 until F001 done |
| kol_campaign 表 source 字段（如不存在）需 migration | 低 | 中 | F004 先 read schema.prisma 核实；若需新增 source 列则同 commit 加 migration（BL-046 product soft-delete pattern） |

---

## §6 不变量（执行期间不得违反）

- **不动 BL-065 已 lock 的 /match unified workbench**（除 F005 删 AddKolDialog 入口）
- **不实装 B3 自然语言 refine**（BL-068 工作）
- **不实装 C3 完整 explainability**（BL-067 工作 — F003 仅 C2 浅版"为什么"占位）
- **不动 BL-064 顶层 4 路由 IA**（Brief/Match/Reach/Insight 顶层 nav 不变）
- **F009 prod redeploy 必须用户 ack 时间窗**（per BL-063/064/065 实战流程）
- **BL-048 valueScore recompute 必须先 staging + audit_log 完整 + 用户 ack 后才上 prod**
- **删除 AddKolDialog 不得破坏 e2e match-fidelity 其他 case（仅删该 1 case）**

---

## §7 关联文档

- ADR-013 (AI native pivot) §Decision 第 2 条
- docs/product/ai-native-vision.md §2 (Match 路由定义) + §3 场景 4-5
- docs/product/ai-native-roadmap.md §4 BL-066 + BL-048
- docs/specs/BL-065-match-page-internal-rewrite-spec.md（前置 ?campaignId mode + AI sidebar 起步）
- BL-065 signoff `docs/test-reports/BL-065-signoff-2026-05-14.md`
- ADR-014 (本批次 F007 新建) value-score-formula-v2

---

## §8 后续 backlog 影响

本批次完成后：
- **BL-067** C3 双向 explainability — Phase 3 第一批，依赖本批次 F003 "为什么"占位段升级为 aigcgateway action `kol-recommendation-explain` 接入
- **BL-068** B3 自然语言 refine — Phase 3 第二批，依赖本批次 F003 client status state 升级为对话式 refine
- **BL-070** 二次清理 — F005 deprecated i18n + 已删 /api/database/export-csv 路由 + nav 旧 key 等技术债

Phase 2 完成 gate（roadmap §11）= BL-065 + BL-066 done + BL-048 已合入。Phase 2 第二批 done = Phase 2 整体 done，解锁 Phase 3。

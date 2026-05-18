# BL-070 Reach + Insight + 二次清理 — Spec（Phase 4 第二批 / 项目近期最后一批）

> **起草：** 2026-05-19 北京 / Planner johnsong
> **状态：** Drafted（7 决策点 + 1 自动 lock 用户 2026-05-18/19 brainstorming 全 lock；BL-069 done @ c247fd8 后立即启动）
> **批次类型：** 普通批次（全部 executor:generator）— 项目近期最后一批
> **优先级：** P0（Phase 4 第二批 / ADR-013 §Decision #1 4 路由 IA 最后一片 + 对外上线 ready）
> **预估工时：** 8-10 day Generator + 2 day Reviewer（项目近期最大批次：Reach 重构 + Insight 合并 + 二次清理 + e2e 重写 + 对外上线 checklist）
> **依赖：** BL-064 done ✅（4 路由 IA + 老路由 redirect）+ BL-065 done ✅（Match 工作台）+ BL-066-BL-069 done ✅（Phase 2+3+4 第一批 / runAigcAction SDK + checkLlmCostBudget + prompt v3 + IaRedirectRule status field 沉淀）
> **关联：** ADR-013 §Decision 第 1 条 / vision §2 Reach + Insight 路由 + §3 场景 4-5 / roadmap §6 BL-070 + §11 Phase 4 verifying gate / framework v0.9.22 archive (待 BL-070 done 集中沉淀 v0.9.23)

---

## §1 背景

BL-064 完成 4 路由 IA 顶级 nav + 老路由 redirect 兜底；BL-065 实装 /match；BL-066-068 升级 Campaign 详情页 (AI 推荐主面板 + explainability + refine)；BL-069 实装 /brief + 老 KB/Campaigns/new redirect 301。**剩余：/reach 实装 + /insight 实装 + 二次清理 + 对外上线 ready**。

本批次按 ADR-013 §Decision #1 + roadmap §6 BL-070 + vision §2 Reach/Insight 路由定义完成 Phase 4 第二批，是 4 路由 IA 完整闭环 + 对外上线前最后一批。

### vision §2 路由功能映射（本批次范围）

- **Reach** = Outreach（触达 composer + 邮件 thread）→ /reach + AI 邮件个性化升级（customize.ts 迁移 runAigcAction）+ Match accept KOL 衔接
- **Insight** = Dashboard + Reports → /insight 合并（含 weekly report / ROI / Phase 5 候选 "AI 学到偏好"留 Phase 5）

### 二次清理累积来源

| 来源 | Deprecated 内容 |
|---|---|
| BL-066 | 6 unmount 旧组件（CampaignHealthCard / ActivityTimelineCard / EmailPerformanceChart + Impl / CampaignRevenueRecorder / CampaignStatusController / detail-insights.ts）+ i18n `_deprecated_by_BL-066` keys（campaigns.detail.activity.* / revenue.* / health.* / insights.emailChart.*） + match.headerActions / match.addKolForm（BL-066 F005 已加 marker）|
| BL-067 | staging seed 数据 gap（≥5 game cat campaign 数据补全）|
| BL-068 | customize.ts / topic-cloud.ts 迁移 runAigcAction SDK（v0.9.22 #6 沉淀触发条件已满足 — 4 处 inline POST 已存在）|
| BL-069 | i18n `_deprecated_by_BL-069` keys（knowledgeBase.* / campaigns.new.*）+ /knowledge-base/ + /campaigns/new/ 目录 git rm + middleware redirect 3 条删除 |
| BL-064 | 老路由 redirect 全部停用（/dashboard /outreach /reports /discovery /database → 直接 404，per 决策点 #5 BL-070 同批即停）|

---

## §2 业务目标

### Reach（A 段）

- 新建 `/reach` 路由 + 实装 Outreach 现有功能（邮件 composer + thread + 调度 + 跟踪）迁移
- 老 `/outreach` → `/reach` (301，1 commit 即停, BL-070 同 commit 删除 outreach 目录)
- **Match accept KOL 衔接**：accept KOL 后从 /campaigns/[id] 主动跳 `/reach/[campaignId]` 或显侧栏 'Send outreach' shortcut
- **AI 邮件 customize.ts + topic-cloud.ts 迁移到 runAigcAction SDK**（v0.9.22 #6 沉淀触发条件已满足）：使用 v0.9.22 #11 prompt v3 自检 § + v0.9.22 #10 dedupe-then-validate（如适用）+ 5 locale 输出
- 不动 AI 邮件调度 / 跟踪反馈闭环（Phase 5 候选）

### Insight（B 段）

- 新建 `/insight` 路由 + Dashboard + Reports 合并 layout（tab / 并排 / 分屏择 1 — 待 F004 实施）
- 老 `/dashboard` + `/reports` → `/insight` (301, 即停)
- 不加 "AI 学到的偏好"展示（vision §3 场景 5 + roadmap §6 F002 标 Phase 5 candidate, 留 Phase 5）

### 二次清理（C 段）

- 删除 5 老路由目录：`src/app/[locale]/(app)/knowledge-base/` + `/campaigns/new/` + `/outreach/` + `/dashboard/` + `/reports/`（discovery / database 已 BL-065/BL-066 删）
- 删除 6 BL-066 unmount 旧组件文件
- 删除 deprecated i18n keys（5 locale × N keys, per `_deprecated_by_BL-066/067/068/069` markers）
- customize.ts / topic-cloud.ts 迁移 runAigcAction SDK + 删 inline POST 代码（v0.9.22 #6 沉淀触发）
- middleware-helpers.ts 删 BL-064 + BL-069 共 ≥5 条 redirect rules（老路由直接 404，per 决策点 #5）
- 视觉 baseline regen：4 路由全量（en-brief / en-match / en-reach / en-insight + sub-page）
- tests/e2e/ 老 spec 清理 + 新 4 路由 IA 全量 e2e suite 重写

### 对外上线 ready（D 段 / F008 spec §10 嵌入）

- spec §10 列对外上线 checklist（8-12 项）+ Reviewer signoff doc 逐项验证
- F008 staging + prod deploy + 24h cost 监控 + signoff PASS

### 不在本批次范围

- "AI 学到的偏好"展示（vision §3 场景 5）— Phase 5 候选
- AI 邮件调度 / 跟踪反馈闭环升级 — Phase 5 候选
- 个性化推荐 + 跨 campaign trends — Phase 5 候选
- skip/replace 写 DB → 个性化学习 — Phase 5 候选
- comparative query — Phase 5 候选
- KOL data coverage gap 治理（BL-062 backlog）— 独立 batch
- Brief 模板库 — Phase 5 候选

---

## §3 范围（8 features）

### F001 — `/reach` 路由 layout + Outreach 功能迁移 + 老 /outreach 301 redirect

**Executor：** generator
**Priority：** high
**Estimated hours：** 12.0

**Acceptance：**
- 新建 `src/app/[locale]/(app)/reach/page.tsx`（server component）+ subroute（如 `/reach/[campaignId]` 等，per 现 outreach 结构）
- 迁移 outreach 全部功能：邮件 composer + thread view + schedule + tracking（不动 AI 邮件个性化 — F002 单独迁）
- 老 `/outreach` → `/reach` middleware redirect 301（同 commit 加 IaRedirectRule + status:301 per BL-069 v0.9.22 #14 模式）
- **Match accept KOL 衔接**（per §2 业务目标）：BL-066 F004 acceptKolToCampaignAction 成功后选添 toast 'View in Reach' CTA → 跳 `/reach/[campaignId]`（或加侧栏 shortcut）
- 不动 AI 邮件 customize.ts（F002 单独迁）
- 单测 ≥4 case：mount reach page / accept KOL → reach 衔接 / 老路由 301 redirect / outreach 子路径迁移
- L1 PASS（lint + tsc + vitest）
- staging git_sha 与本 commit 一致

---

### F002 — customize.ts + topic-cloud.ts 迁移到 runAigcAction SDK（v0.9.22 #6 沉淀落地）

**Executor：** generator
**Priority：** high
**Estimated hours：** 8.0

**Acceptance：**
- 改 `src/lib/email/customize.ts`：inline POST `/actions/run` → 调 `runAigcAction({ actionId: AIGCGATEWAY_EMAIL_CUSTOMIZE_ACTION_ID, variables, tenantId, actionLabel: 'email_customize' })`（复用 BL-067 F001 沉淀 SDK）
- 改 `src/lib/kol-detail/topic-cloud.ts`：同模式迁移
- 删除两文件 inline `parseFencedJson` + cost-cap + audit + error mapping 重复代码（~80 LOC × 2 = ~160 LOC 删）
- 现有 cost-cap / audit 行为不变（runAigcAction 内部已含 assertDailyCostBudget + recordAiUsage）
- 现有单测保持 PASS（mock 改为 mock `runAigcAction` 而非 mock `fetchWithRetry`）
- 不动 customize.ts / topic-cloud.ts 业务逻辑（仅基础设施迁移）
- L1 PASS（lint + tsc + vitest 全 customize.ts + topic-cloud.ts 现有测试无 regression）
- staging git_sha 与本 commit 一致

---

### F003 — `/insight` 路由 layout + Dashboard + Reports 合并 + 老 /dashboard /reports 301 redirect

**Executor：** generator
**Priority：** high
**Estimated hours：** 10.0

**Acceptance：**
- 新建 `src/app/[locale]/(app)/insight/page.tsx`（server component）+ subroute（如 `/insight/weekly-report/[id]` 等）
- Layout 选择（F003 implementer 决定 + 单元测试 mock）：tab 切换 / 并排分屏 / nested route — 推荐 tab（与 BL-069 /brief 同模式 + URL state ?tab=dashboard / ?tab=reports）
- 迁移 Dashboard 全部功能（KPI cards / activity feed / ROI 等）
- 迁移 Reports 全部功能（weekly report / analytics 等）
- 老 `/dashboard` → `/insight?tab=dashboard` (301) + `/reports` → `/insight?tab=reports` (301) + `/weekly-report/*` → `/insight/weekly-report/*` (301) + `/analytics` → `/insight?tab=analytics` (301)
- 不加 "AI 学到偏好"段（Phase 5 候选）
- 单测 ≥5 case：mount /insight default tab / ?tab 切换 / 老 dashboard/reports/weekly-report/analytics 4 条 301 redirect
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F004 — 5 老路由目录 git rm + middleware redirect 删除（BL-070 同批即停 per 决策点 #5）

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- `git rm -r` 5 老路由目录：
  - `src/app/[locale]/(app)/knowledge-base/`（BL-069 redirect 已生效, 现 git rm 目录 + middleware redirect 删）
  - `src/app/[locale]/(app)/campaigns/new/`（BL-069 redirect 已生效, 现 git rm）
  - `src/app/[locale]/(app)/outreach/`（F001 迁移已完成, 现 git rm + middleware redirect 删）
  - `src/app/[locale]/(app)/dashboard/`（F003 迁移已完成, 现 git rm + middleware redirect 删）
  - `src/app/[locale]/(app)/reports/`（F003 迁移已完成, 现 git rm + middleware redirect 删）
- `src/middleware-helpers.ts` IA_REDIRECT_RULES 删除 ≥6 条规则（BL-064 + BL-069 共 6+ 条 redirect → 老路由删除后规则失效改 404）
- `src/__tests__/middleware-helpers.test.ts` 同步删除对应 cases + 加 '路径已删除返 null（直接 404）' 新 case 验证
- 老 e2e tests/e2e/ia-refactor-redirects.spec.ts REDIRECT_CASES 全删 + spec 文件名改 `tests/e2e/ia-refactor-cleanup-2026-05-19.spec.ts` 留 audit trail
- 验证 staging 老路径直接 404（curl -I /en/dashboard /en/outreach /en/reports /en/knowledge-base /en/campaigns/new → 404）
- 单测 ≥6 case：5 老路径 → 404 / 新路径 / brief|match|reach|insight 正常 mount
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F005 — 删 6 BL-066 unmount 旧组件 + 5 locale deprecated i18n keys 全删

**Executor：** generator
**Priority：** high
**Estimated hours：** 4.0

**Acceptance：**
- `git rm` 6 文件（BL-066 F002 acceptance 写明的 `_deprecated_by_BL-066` 文件）：
  - `src/app/[locale]/(app)/campaigns/[id]/CampaignHealthCard.tsx`
  - `src/app/[locale]/(app)/campaigns/[id]/ActivityTimelineCard.tsx`
  - `src/app/[locale]/(app)/campaigns/[id]/EmailPerformanceChart.tsx` + Impl
  - `src/app/[locale]/(app)/campaigns/[id]/CampaignRevenueRecorder.tsx`
  - `src/app/[locale]/(app)/campaigns/[id]/CampaignStatusController.tsx`
  - `src/lib/campaigns/detail-insights.ts` `loadCampaignDetailInsights`
- 同 commit grep 全仓 import 验证 0 引用（per BL-066 F002 acceptance "page.tsx unmount 后 0 引用"）
- `messages/{en,zh,ja,ko,es}.json` 删除 deprecated i18n keys（全 5 locale 一致）：
  - `_deprecated_by_BL-066`: campaigns.detail.activity.* / revenue.* / health.* / insights.emailChart.* + match.headerActions / match.addKolForm
  - `_deprecated_by_BL-069`: knowledgeBase.* / campaigns.new.*
  - 任何 `_deprecated_by_BL-067/068` markers（如有）
- i18n-locale-coverage parity test 验 5 locale 删除一致 PASS
- 单测 ≥3 case：grep 0 旧组件 import / i18n keys 删除 / i18n parity 8/8 PASS
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F006 — 4 路由 IA 全量 e2e suite 重写 + 老 e2e spec 清理

**Executor：** generator
**Priority：** high
**Estimated hours：** 16.0

**Acceptance：**
- `tests/e2e/` 老 spec 全清：删 `dashboard-fidelity.spec.ts` / `discovery-fidelity.spec.ts` / `database-*` / `outreach-*` / `knowledge-base-*` / `reports-*` / `campaigns-new-*` 等 7-10 个 deprecated spec 文件
- 4 路由 IA 全量 e2e suite 重写：
  - `tests/e2e/brief-flow.spec.ts`（BL-069 F006 已有 6 case，保留 + 验证 4 路由统一性）
  - `tests/e2e/match-flow.spec.ts`（合并现有 match-fidelity.spec.ts + campaign-match-flow.spec.ts + campaign-explainability-flow.spec.ts + campaign-refine-flow.spec.ts 等 BL-066+067+068 e2e → 1 个统一 suite，~12 case）
  - `tests/e2e/reach-flow.spec.ts`（**新建**，~6 case）：reach 页 mount / outreach 迁移 / 邮件 composer / Match accept→Reach 衔接 / 老路由 redirect / cleanup 后 404 验
  - `tests/e2e/insight-flow.spec.ts`（**新建**，~6 case）：insight 页 mount + tab 切换 / dashboard 内容 / reports 内容 / 老路由 redirect / cleanup 后 404 验
- Playwright project deps 梳理：visual / setup / chromium dependencies 确认正确
- L1 PASS（lint + tsc + vitest + e2e 全套）
- staging git_sha 与本 commit 一致

---

### F007 — 视觉 baseline 全量 regen + 5 locale i18n 完整 cover

**Executor：** generator
**Priority：** high
**Estimated hours：** 6.0

**Acceptance：**
- 触发 `.github/workflows/update-visual-baselines.yml` workflow 全量重 gen baseline（含 reach 新 baseline + insight 新 baseline + 删除老 baseline）
- 新生成 baseline 列表：
  - `en-reach.png` + `en-reach-detail.png`（subroute）
  - `en-insight.png` + `en-insight-reports.png`（?tab=reports）
  - 重新生成 `en-brief.png` + `en-brief-products.png` + `en-match.png` + `en-match-with-campaign.png` + `en-campaign-detail.png` + `en-campaign-detail-detailed-dialog.png`（视觉漂移修）
- 老 baseline git rm：`en-dashboard.png` / `en-discovery.png` / `en-database.png` / `en-outreach.png` / `en-reports.png` / `en-knowledge-base.png` / `en-knowledge-base-bottom.png` / `en-campaigns-new.png`
- `messages/{en,zh,ja,ko,es}.json` 加 `reach.*` + `insight.*` 完整 keys（5 locale 全 cover, parity 8/8 PASS）
- i18n-locale-coverage test 验 5 locale parity + 0 deprecated marker 剩余
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F008 — staging + prod deploy + 24h 监控 + 对外上线 ready signoff

**Executor：** generator
**Priority：** high
**Estimated hours：** 8.0

**Acceptance：**
- staging deploy via `deploy-staging.yml`（含 BL-070 全部 commit + F002 customize.ts 迁移后 AIGCGATEWAY_EMAIL_CUSTOMIZE_ACTION_ID 复用现 BL-067 SDK 同 env var）
- **prod deploy 触发条件**（用户 ack 时间窗）：
  - 1. BL-067 + BL-068 + BL-069 + BL-070 累积 prod deploy（Phase 3 + Phase 4 一次性 prod 上）
  - 2. scripts/deploy-prod.sh 已含 v0.9.22 #4 `--webpack` 防御
  - 3. 用户 ack 时间窗
- 24h prod 监控：scripts/bl070-prod-audit.sh（类比 BL-066 F009 bl066-f009-prod-audit.sh）验 4 路由全 active / 老路由 404 / cost cap 内 / 0 P0 bug
- 对外上线 ready checklist（per §10）：Reviewer signoff doc 逐项验证
- `docs/test-reports/BL-070-signoff-2026-05-XX.md` Reviewer 写最终结论：所有 8 features + cleanup + e2e 全 PASS + checklist 全通过
- Reviewer 复验全部 acceptance + signoff，progress.json `status: reverifying → done`
- **本批次 done → 对外上线 ready**

---

## §4 关键决策点（brainstorming 2026-05-18/19 lock）

| # | 决策点 | 用户 ack | 影响 |
|---|---|---|---|
| #1 | spec 成熟度 | **A: ready-to-build** | spec 立即可进 building，不等 BL-067/068/069 prod dogfood |
| #2 | Reach 重构深度 | **A: 路径迁移 + Match→Reach 衔接 + customize.ts 迁移** | F001 + F002 范围 |
| #3 | Insight 重构深度 | **A: 仅合并 + 路径迁移**（AI 学到偏好留 Phase 5）| F003 范围 |
| #4 | 二次清理范围 | **A: 全清**（5 老路由目录 + i18n keys + 6 unmount 组件 + customize.ts/topic-cloud.ts 迁移）| F004 + F005 + F002 范围 |
| #5 | middleware redirect 关闭时机 | **B: BL-070 同批即停 redirect（老路由 404）** | F004 删 redirect rules + 老路由 404 验 |
| #6 | e2e suite 重写范围 | **A: 完整重写 + 老 e2e 清理** | F006 7-10 老 spec git rm + 4 新 suite 重写 |
| #7 | 对外上线 checklist 形态 | **B: 嵌入 spec §结尾 + signoff doc 验证** | §10 列 checklist + F008 Reviewer signoff 验 |
| #8 | 基础设施复用 | **全 ack 自动 lock 同 BL-067/068/069 模式** | F002 复用 runAigcAction + 5 locale + 等 v0.9.22 沉淀 |

---

## §5 不变量（Generator 落地必查）

1. **基础设施 100% 复用 v0.9.22**：F002 customize.ts 迁移走 `runAigcAction` SDK（BL-067 F001 沉淀）；不新建抽象层；不动 cost cap / rate limit 等中央策略
2. **老路由直接 404**（per 决策点 #5）：F004 BL-070 同批即停 redirect + 老路由目录 git rm，老 URL 直接 404（项目近期未 prod 上线，SEO inbound link 风险可控）
3. **6 unmount 组件 grep 0 引用**：F005 git rm 前必 grep 全仓验 0 引用（per BL-066 F002 acceptance 已保 "page.tsx unmount 后 0 引用"）
4. **i18n 5 locale 删除一致性**：F005 + F007 删 deprecated keys 必 5 locale 同时删除；i18n-locale-coverage parity test 全 PASS
5. **e2e 重写不破坏 Phase 2+3 现有 e2e**：F006 重写 match-flow.spec.ts 时合并而非破坏 BL-066/067/068 现 e2e 案例（accept/skip/show-next/explainability/refine 全保留）
6. **视觉 baseline 全量 regen**（F007）：4 路由全 baseline 新生成 + 老 baseline git rm；不留 stale baseline
7. **Match → Reach 衔接行为**（F001）：BL-066 F004 acceptKolToCampaignAction 成功后加 toast 'View in Reach' CTA 或侧栏 shortcut；不强制 router.push（用户可继续 accept 其他 KOL）
8. **customize.ts / topic-cloud.ts 业务逻辑不动**（F002）：仅基础设施层（inline POST → runAigcAction）迁移；prompt 内容不动；现有单测 mock 改 mock SDK 即可
9. **prod deploy F008 必含 v0.9.22 #4 防御**：scripts/deploy-prod.sh 已含 `--webpack` flag + Turbopack artifact cleanup；BL-070 F008 验证 prod build 全程使用 webpack
10. **F006 e2e Playwright project deps 梳理**：visual project deps chromium 不破坏（BL-068 fix-round 1 修后正常）；新 reach-flow / insight-flow 加入 chromium project
11. **对外上线 checklist 闭环**（per §10）：F008 Reviewer signoff doc 必逐项验证，任何项 FAIL 触发 fix-round 不放行

---

## §6 cost 估算与风险

### Cost 估算（per v0.9.22 #2:A flat $0.01/call meter view）

| 场景 | 调用次数 | meter（flat $0.01/call）| 真实 token spend |
|---|---|---|---|
| F002 customize.ts 迁移后 | 不变（已有 caller）| $0/incremental | $0/incremental |
| F008 prod deploy 24h 监控 | 不增 LLM call 仅监控 | $0 | $0 |
| **BL-070 自身 0 incremental LLM cost** | — | **$0** | **$0** |

### 风险表

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F001 Reach 迁移破坏现 outreach 邮件 thread 业务逻辑 | 中 | 高 | F006 e2e reach-flow.spec.ts ≥6 case + staging dogfood 完整 outreach 路径回归验 |
| F002 customize.ts 迁移导致现 BL-034 cost-cap / audit 行为漂移 | 低 | 中 | runAigcAction 内部已封装相同 cost-cap + audit 逻辑；现单测 mock 改 mock SDK 即可保覆盖 |
| F004 老路由 404 后用户 inbound 链接失效 | 低 | 低 | 项目近期未 prod 上线，SEO inbound link 风险可控（per 决策点 #5 用户 ack） |
| F006 e2e 重写 BL-066/067/068 case 漏迁 | 中 | 中 | 重写前 grep 现 e2e 用例清单 + 重写后比对覆盖矩阵 |
| F007 视觉 baseline regen 误漏 | 低 | 低 | update-visual-baselines workflow 全量 trigger + Reviewer L2 spot check 验 baseline 列表 |
| F008 prod deploy Turbopack/webpack 漂移 | 低 | 高 | v0.9.22 #4 防御已 lock —scripts/deploy-prod.sh force `--webpack` + cleanup |
| 4 路由对外上线 dogfood 反馈不达预期 | 中 | 高 | F008 24h prod 监控 + Reviewer L2 signoff doc 必含 ≥5 maketer dogfood spot check |
| Phase 5 候选误进 BL-070（scope creep）| 中 | 中 | §2 不在范围明确划 Phase 5 候选（AI 学到偏好 / 调度 / 跟踪 / 个性化学习 / comparative）；Generator 不得越界（铁律 #6）|

---

## §7 下一批后续

- **本批次 done = Phase 4 完整 done = 4 路由 IA 完整闭环 + 对外上线 ready**
- 对外上线动作（用户 ack 时间窗）：
  1. scripts/deploy-prod.sh trigger（含 BL-067-070 累积 deploy）
  2. 团队 prod dogfood 1-2 周
  3. 真客户 onboarding (vision §6 客户画像匹配)
- **Phase 5 候选**（不在 6-10 周硬上线范围）：
  - "AI 学到的偏好" Insight 页展示（vision §3 场景 5）
  - 个性化学习（捕获 accept/skip/refine raw query → valueScore 权重调整）
  - skip/replace 状态升级写 DB（Phase 5 学习数据基础）
  - comparative query（"为什么 @kol45 排在第十位"）
  - AI 邮件调度 / 跟踪反馈闭环升级
  - Brief 模板库
  - KOL data coverage 治理（BL-062 backlog）

---

## §8 对外上线 ready checklist（嵌入 spec, F008 Reviewer signoff 逐项验证）

| # | Checklist 项 | 验证方式 |
|---|---|---|
| 1 | 4 路由全 active（/brief /match /reach /insight）| curl -I 各路径 200 |
| 2 | 老路由全 404（/knowledge-base /campaigns/new /outreach /dashboard /reports / discovery / database）| curl -I 各老路径 404 |
| 3 | 5 locale UI 全 PASS（en/zh/ja/ko/es）| 浏览器逐 locale 跑 4 路由 + key 界面 |
| 4 | cost cap dashboard < $5/day/tenant | aigcgateway dashboard + scripts/bl070-prod-audit.sh |
| 5 | 4 路由 e2e suite 全 PASS（brief / match / reach / insight）| CI run 全绿 |
| 6 | 视觉 baseline 全 PASS（无视觉漂移）| Playwright visual project 全绿 |
| 7 | accessibility（a11y）扫描 PASS（axe-core 或 lighthouse a11y ≥90）| F008 实施时跑 |
| 8 | Lighthouse 性能分数 ≥80（4 路由各页）| F008 实施时跑 |
| 9 | ≥5 marketer dogfood spot check 完整 brief → match → reach → insight 链路 | F008 Reviewer 实测 |
| 10 | cost / token 24h 监控数据正常 | scripts/bl070-prod-audit.sh + aigcgateway dashboard |
| 11 | prod /api/health git_sha == BL-070 final commit | F008 deploy 后 curl 验 |
| 12 | i18n-locale-coverage parity 8/8 PASS | F005 + F007 |

---

## References

- ADR-013-ai-native-product-pivot §Decision 第 1 条（4 路由 IA 完整闭环）
- docs/product/ai-native-vision.md §2 Reach + Insight 路由 / §3 场景 4-5 / §6 客户画像 / §8 划界
- docs/product/ai-native-roadmap.md §6 BL-070 / §11 Phase 4 verifying gate + 对外上线 ready
- docs/specs/BL-064-... + BL-066-...-BL-069-... spec（依赖 IA + AiRecommendationPanel + runAigcAction SDK + IaRedirectRule status 沉淀）
- framework/archive/proposed-learnings-archive-v0.9.22.md（13 条沉淀直接复用 #4 Turbopack 防御 / #6 SDK 抽象层 / #11 prompt v3 / #14-16 BL-069 学习）
- src/lib/aigc/run-action.ts（BL-067 F001 沉淀 SDK，F002 customize.ts 迁移目标）
- src/middleware-helpers.ts IA_REDIRECT_RULES + IaRedirectRule status field（BL-069 fix-round 1 沉淀）

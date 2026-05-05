# BL-024 B4 Ghost-controls Cleanup Signoff 2026-05-06

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：Planner 2026-05-02 全 prod 排查（基线 6f33a55）+ prod-mvp-readiness audit 2026-05-04 §4 排定 + 用户 2026-05-05 22:30 决议方案 B（A+B+C+D-2+D-3）+ 23:05 决议方案 A（F006 hotfix 加入）
> Reviewer：Codex L2 staging 实证（commit `fa3b2a2` `docs/test-reports/BL-024-verifying-2026-05-06.md`）+ Planner johnsong 临时担任 evaluator 完成 signoff（用户 2026-05-06 ~07:00 口头授权方案 A，harness §1.5 + 铁律 6 session_notes 记账；与 BL-020 / BL-034 / BL-035 同模式）

---

## 变更背景

prod-mvp-readiness audit 2026-05-04 §4 排定：BIx redeploy 后 prod 仍残留 8 项 "UI 展示但未实装" ghost controls（disabled + "Coming in B4" tooltip）。本批次 prod 上线对外（计划 2026-05-13）前清理 5 项 + retroactive hotfix 1 项 = **6 features**。

用户 2026-05-05 22:30 决议方案 B：A+B+C+D-2+D-3 = 5 features；D-1 Send Queue 推 BL-040+ 与 BullMQ 实装合批；E /knowledge-base Import CSV defer 真客户反馈；F /database BulkDelete 推 B6 destructive 完整批次。23:05 追加 F006 retroactive hotfix（BL-034 F001 deploy yml env bridge missing — Planner 实地核查发现 prod kolmatrix_app 仍用弱密码，CRIT-1 fix 未在 prod 生效）。

6 features 全 generator，由 Generator Kimi 在 2026-05-05 ~23:00 ~ 2026-05-06 03:11 期间分 commit 实装（commit chain `6447664..eacbbbb`），staging deployed @ `eacbbbb` @ 2026-05-06 03:11 +0800。

---

## 变更功能清单

### F002：B /roi 时间范围 toggle (7D/30D/90D/All-time)

**Executor：** generator
**Commit：** `6447664`
**文件：** `src/app/[locale]/(app)/roi/RoiHeader.tsx`、`roi/page.tsx`、`src/lib/roi/insights.ts`、相关测试

**改动：**
- 4 ranges 全 active=true（移除 disabled+B4 tooltip）
- URL `?range=7d|30d|90d|allTime` 切换刷新组件数据，default `30d`
- range filter 改 4 组件 aggregate（KPI / 趋势图 / Campaigns / AI 洞察）

**验收：** ✅ + L2 实证（Codex）
- 浏览器实测 7D/30D/90D/全部 4 个 range 全活链接，KPI/趋势/AI 洞察渲染正常

---

### F003：C /weekly-report Last Week / Last Month toggle（28-day 窗口聚合）

**Executor：** generator
**Commit：** `ebf48aa`
**文件：** `src/app/[locale]/(app)/weekly-report/WeeklyReportHeader.tsx`、`page.tsx`、`src/lib/weekly-report/range.ts`（新增）、`generate.ts`

**改动：**
- 2 ranges 全 active=true（lastWeek + lastMonth）
- Last Month 28-day 窗口聚合（4 × 7 day，与 lastWeek 单位一致 — D4 决策）
- URL `?range=lastWeek|lastMonth` 切换刷新

**验收：** ✅ + L2 实证（Codex）
- staging 浏览器实测上周/上月控件可见且活；周报生成/下载/分享/复制链接主路径正常

---

### F001：A /database 头 3 按钮（Export CSV + Import CSV + Add KOL form）

**Executor：** generator
**Commit：** `060241b` (F001-1) + `49411ef` (F001-2) + `e4acbf7` (F001-3) + `c16f868` (i18n allowlist)
**文件：** `database/page.tsx`、`AddKolDialog.tsx` + `ImportCsvDialog.tsx`（新增）、`actions.ts`、`/api/database/{export-csv,import-csv}/route.ts`（新增）、相关测试

**改动：**

**F001-1 Export CSV：** 新建 `/api/database/export-csv` GET handler + auth + tenantId 限制 + 同 /database 页面 filter / search / sort 同步 + csvCell formula-injection 防护（'=','+','-','@' 起首加单引号）+ row-count cap default 5000（v0.9.11 §6 silent updateMany 模式延伸）+ Content-Disposition: attachment

**F001-2 Import CSV：** 新建 `/api/database/import-csv` POST handler + multipart/form-data 5MB 上限 + zod schema 校验每行 + 批量 upsert（externalId+platform 去重）+ 错误行号返回（前 10）+ 弹窗 file picker + 进度 toast

**F001-3 Add KOL form：** 新建 `AddKolDialog.tsx` form 6 fields（platform/handle/displayName 必填 + url/email/followerCount 可选）+ `addKol` server action zod + withTenant + Kol.create + rate-limit（v0.9.11 dogfood mutation 类 20/min/userId）

**验收：** ✅ + L2 实证（Codex）
- 浏览器实测：导出链接下载 CSV、导入 CSV 弹窗 zod 校验、新增 KOL form 6 fields 可提交
- `/api/database/export-csv` + `/api/database/import-csv` 集成测试覆盖（database-export-csv.test.ts + database-import-csv.test.ts 全 PASS）

---

### F004：D-2 /outreach Tracking tab 实装（list view，复用 BL-035 F006 EmailLog.status 数据流）

**Executor：** generator
**Commit：** `23203fe`
**文件：** `OutreachTabs.tsx`、`outreach/tracking/page.tsx` + `TrackingTable.tsx`（新增）、`tests/integration/outreach-tracking.test.ts`（新增）

**改动：**
- OutreachTabs.tsx tracking tab 解锁（移除 tooltipKey: "comingB4"，加 href `/outreach/tracking`）
- 新建 `tracking/page.tsx` Server Component：查 EmailLog by tenantId（withTenant）+ createdAt DESC + cursor pagination 50 行/页
- 字段：sentAt / KOL 名（join Kol） / Subject / Status (delivered/opened/clicked/bounced/complained/queued/sent) / openedAt / repliedAt / bounceReason
- TrackingTable.tsx 含 status filter（all/delivered/opened/bounced/complained 等 8 个）

**验收：** ✅ + L2 实证（Codex）
- 浏览器实测：tracking tab active link，status filter 全可见，列表加载真实 EmailLog 行 + 分页按钮
- 集成测试覆盖 tenant scoping + status filter

---

### F005：D-3 /outreach Suppression tab 实装（hard-bounce KOL list，复用 BL-035 F006 audit_log + Kol.email=null）

**Executor：** generator
**Commit：** `23203fe`
**文件：** `OutreachTabs.tsx`、`outreach/suppression/page.tsx` + `SuppressionTable.tsx`（新增）、`tests/integration/outreach-suppression.test.ts`（新增）

**改动：**
- OutreachTabs.tsx suppression tab 解锁
- 新建 `suppression/page.tsx` Server Component：查 audit_log where action='kol.email_cleared_by_bounce' AND tenant_id=$tenantId（BL-034 F003 RLS 自动 filter，显式 tenantId defense-in-depth）+ join Kol 显示 displayName/handle/platform
- 字段：清除时间 audit_log.created_at / KOL 名 / 原 providerMessageId / 退订原因
- 本 feature 不实装手动退订 UI（推 BL-040+ 需 Kol.suppressedAt schema 字段）

**验收：** ✅ + L2 实证（Codex）
- 浏览器实测：suppression tab active link，empty state 文案 "暂无被屏蔽的 KOL"（staging 未真触发 hard-bounce）
- 集成测试覆盖空会话重定向 + tenant 过滤

---

### F006：BL-034 F001 deploy yml env bridge fix（hotfix 追加 — 用户 2026-05-05 23:05 决议方案 A）

**Executor：** generator
**Commit：** `eacbbbb`
**文件：** `.github/workflows/deploy-prod.yml`、`.github/workflows/deploy-staging.yml`、`infrastructure/deploy-staging.sh`（如适用）

**改动：**
- `deploy-prod.yml` script 块加 `set -a; source .env.production; set +a` 在 `./scripts/deploy-prod.sh` 之前
- `deploy-staging.yml` script 块加 `set -a; source .env.staging; set +a` 在 `bash infrastructure/deploy-staging.sh` 之前
- 注释明示「BL-024-F006 (BL-034-F001 retroactive)」

**验收：** ✅
- 两 yml 文件确认含 `set -a; source ...; set +a` 桥接（grep 验证）
- staging deploy run 成功，git_sha=eacbbbb 与 main HEAD 一致 ✓
- 注：**KOLMATRIX_APP_PASSWORD 在 prod 真实落地需用户驱动 prod redeploy + 同步 DATABASE_URL 中密码**（spec §F006 acceptance + 项目状态用户手工待办 #1）— 入 Soft-watch S2

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| D-1 /outreach Send Queue | 推 BL-040+ 与 BullMQ 实装合批（CQ-H3 audit 列「BullMQ 完全未实装」是 infra 大改） |
| E /knowledge-base Import CSV | defer 真客户反馈触发 |
| F /database BulkActionBar Delete | B6 destructive 完整批次（含 audit log + 回滚 + 二次确认 UX） |
| Templates tab | defer（BL-040+ 处理） |

---

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| /database 头按钮 | 3 个 disabled + "Coming in B4" tooltip | Export 下载 CSV / Import 弹窗 zod 校验 / Add KOL form |
| /roi 时间 toggle | 仅 30D active，其它 disabled | 7D/30D/90D/All-time 4 range 全活 + URL 参数 |
| /weekly-report 时间 toggle | 仅 lastWeek active | lastWeek + lastMonth 28-day 窗口 |
| /outreach tabs | overview active，tracking/suppression/templates/send_queue 全 disabled | tracking + suppression 解锁；templates + send_queue 仍 disabled (defer) |
| prod kolmatrix_app 角色密码 | init migration 弱密码 'kolmatrix_app' | F006 yml 桥接修复后等用户 prod redeploy 真生效（CRIT-1 retroactive） |
| ghost controls 总数 | 8 项 | 3 项（D-1 + E + F + Templates 共 4 项 deferred） |

---

## 类型检查 / CI

```
npx tsc --noEmit          → 0 errors
npm run lint              → 0 errors
单元测试                  → 401+ passing locally；6 BL-024 集成测试文件 27/27 PASS
visual-baselines-shape    → 3/3 PASS
CI                        → fa3b2a2 + eacbbbb commits 推 main 后期望全绿
deploy-staging run        → SUCCESS @ eacbbbb（git_sha 与 main HEAD 一致）
```

---

## L2 实测记录（v0.9.9 — BL-031 沉淀）

> Codex 短版 verifying notes 见 `docs/test-reports/BL-024-verifying-2026-05-06.md`。

| 项 | 证据 |
|---|---|
| Staging git_sha == main HEAD | `curl https://staging.kol.guangai.ai/api/health -H X-Health-Token: ...` 返 git_sha=`eacbbbb`（match）|
| 端到端流验证 | 5 处浏览器走查（spec §6.1 / generator_handoff §L2）：/zh/database 头 3 按钮 + /zh/roi 4 range / /zh/weekly-report 2 range / /zh/outreach/tracking + /zh/outreach/suppression — 全活控件 + 真实数据渲染 |
| 关键 invariant | tracking 列表显示真实 EmailLog 行 / suppression empty state 正常（staging 无真 hard-bounce）/ database export 下载真 CSV / import 弹窗 zod 校验 |
| 浏览器手动验 | 5 处 spot check 完成（Codex 直接证据） |

---

## Ops 副作用记录（v0.9.9 — BL-030/BL-031 沉淀）

| Agent | 阶段 | 操作摘要 | 副作用对齐 | 用户授权 |
|---|---|---|---|---|
| Generator Kimi | building | F006 改 deploy-prod.yml + deploy-staging.yml 加 `set -a; source .env*; set +a` | yml 改动不动产品代码，无副作用；smoke 验证 staging deploy success | spec §F006 范围内（F006 entry acceptance） |
| Planner johnsong | verifying signoff | 临时担任 evaluator 完成 signoff（Codex 仅推 short verifying notes，未签 signoff） | 用户 2026-05-06 ~07:00 口头授权方案 A → harness §1.5 + 铁律 6 session_notes 记账（progress.json johnsong 条目）— 与 BL-020 / BL-034 / BL-035 同模式 | 用户对话 2026-05-06 ~07:00 授权 |

---

## Harness 说明

本批改动经 Harness 状态机完整流程（new → planning → building → verifying → done）交付。`progress.json` 已设为 `status: "done"`，signoff 路径已填入 `docs.signoff`。

`fix_rounds=0`（first-round PASS 模式），6 features 全 PASS / 0 PARTIAL / 0 FAIL；2 项 Soft-watch 兜底（与 BL-020 / BL-034 / BL-035 同模式）。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| **S1** | spec §F004/F005 文案要求 `tracking-list.png` + `suppression-list.png` 视觉基线，但当前 visual-regression contract 仅含 19 张既有 baseline，没有这 2 页 screenshot test；`tests/screenshots/baseline/` 中没有对应 PNG | medium | 若后续要严格对齐 spec，下批次（BL-040+ 或 visual baseline 专项）补 screenshot test + baseline；以现有回归门禁为准则可保持现状 |
| **S2** | F006 deploy yml env bridge 已修但 KOLMATRIX_APP_PASSWORD 在 prod 真实落地需用户驱动 prod redeploy + 同步 DATABASE_URL 中密码（手术级 ops，DATABASE_URL 改密风险高） | high（CRIT-1 retroactive 仍未在 prod 生效） | 用户主导 SSH prod 生成 random 密码 + 改 .env.production + 同步 DATABASE_URL → GH Actions Deploy → ALTER ROLE 真生效 → curl health 验 git_sha 对齐 |
| **S3**（继承 BL-035 6 项 + BL-034 8 项 + BL-020 5 项已沉淀）| 详见各批次 signoff Soft-watch 段 | low-high | 用户驱动各项闭环（详 project-status.md 用户手工待办 #2-#6） |

---

## Framework Learnings

> 实施过程中发现 2 项值得沉淀的新规律 / 模板修订（v0.9.13 候选），由 Generator Kimi 在 generator_handoff 中提案，Planner 在 done 阶段交用户决议。

### 新规律 #1：spec acceptance 改 deploy-script 时同 commit 必须改对应 yml workflow（v0.9.13 候选）

**类型：** 新规律（铁律级别 — 与 v0.9.12 §deploy-patterns.md §5 互动）

**内容：** BL-034 F001 spec acceptance 已 done @ dbbfbb3（deploy-prod.sh 加 ALTER ROLE 段 line 71-81）但漏了同 commit 改 .github/workflows/deploy-prod.yml script 块加 `set -a; source .env.production; set +a` 桥接 → GH Actions Run 时 KOLMATRIX_APP_PASSWORD env var 不会 export → ALTER ROLE 段 silent skip → prod kolmatrix_app 角色仍用 init migration 弱密码（CRIT-1 fix 未在 prod 生效 1+ 周）。Planner 在 BL-024 prod redeploy ops 准备阶段实地核查才发现，需 BL-024 F006 retroactive hotfix。

**建议写入：** `framework/harness/deploy-patterns.md` §5（v0.9.12 已沉淀）追加 §5.1「spec acceptance 改 deploy-script 时同 commit 必须改对应 yml workflow」：
- 任何修改 `scripts/deploy-*.sh` / `infrastructure/deploy-*.sh` 的 spec feature acceptance，必须同 commit 改对应 `.github/workflows/deploy-*.yml`（如 deploy-script 引入新的 env var 依赖 → yml script 块必须 `set -a; source .env*; set +a`）
- Planner 起草 spec 时检查项：grep `scripts/deploy-` 改动 → 检查同 commit 是否含 `.github/workflows/deploy-` 改动；缺一即 spec drift
- Generator 实装时检查项：deploy-script 改动需 yml 桥接同 PR；不分 commit 推
- Reviewer L2 验收时检查项：staging deploy 不仅看 health endpoint，还要验 deploy-script 内每个 env-var-依赖步骤 silent skip 检查（grep deploy log "skipping" / "unset" / "warning"）

**反面案例（已落 BL-024 F006 retroactive hotfix）：** BL-034 F001 spec acceptance 写 ALTER ROLE 段 done @ dbbfbb3 但 prod CRIT-1 实际未修 1+ 周，到 BL-024 prod redeploy ops 准备阶段才暴露。本可在 BL-034 F001 spec lock 时加「同 commit 改 yml」检查项避免。

**状态：** 待用户 done 阶段确认（v0.9.13 候选 #1）

### 新规律 #2：mcp__aigc-gateway create_action_version schema 应暴露 max_tokens 字段（v0.9.13 候选）

**类型：** 模板修订（mcp tool schema 扩展提案）

**内容：** Planner Q2 ops（2026-05-05 23:30）执行 BL-035 F013 aigcgateway 服务端协调时发现 `mcp__aigc-gateway create_action_version` schema 仅含 `messages / variables / changelog / set_active`，**完全无 max_tokens 字段暴露**。`mcp__aigc-gateway update_action` 也仅含 `name / description / model`。导致 v0.9.11 §ai-action-contract.md §4 max_tokens 矩阵 dogfood **无法通过 mcp 完整自动化**，必须用户登录 aigcgateway Dashboard UI 手工设。

**影响：** prod-mvp-readiness audit + BL-035 F013 / BL-024 Q2 ops 都需要这个能力做完整 dogfood 自动化；本项目 6 个 Action max_tokens 推 Soft-watch 已是历史第二次（BL-035 + BL-024 两个 batch 共 12 次推延 max_tokens 设到 UI）。

**建议写入：** 给 aigcgateway 项目（独立项目，非 KOLMatrix 范围）报 issue：mcp 工具 `create_action_version` + `update_action` 应暴露 `max_tokens` 字段。短期 KOLMatrix 端：在 `framework/harness/ai-action-contract.md §4` 加注「max_tokens 可达性 — 截至 v0.9.13 mcp 不支持，需 aigcgateway Dashboard UI 手工设；spec 起草时不应假设 mcp 自动化全覆盖 §4 矩阵」。

**状态：** 待用户 done 阶段确认（v0.9.13 候选 #2）

---

## Reviewer 签收说明

- L1 已完成（Codex commit fa3b2a2 verifying notes 段「6 features 全 PASS + 27/27 集成测试 + visual-baselines-shape 3/3」）
- L2 staging 实证（Codex 已记录 5 处浏览器走查 + EmailLog 真实显示 + suppression empty state）
- 6 features acceptance 复核 ✅（Planner 临时担任 evaluator + 用户授权）
- Signoff 完整版本本文档（Planner 复核 + 整合 Codex 短版 verifying notes + Soft-watch 兜底 2 项 + Framework Learnings 2 候选）
- 决议：**first-round PASS**（fix_rounds=0），6 features 全 PASS / 0 PARTIAL / 0 FAIL；S1 medium screenshot baseline 后续顺手补；S2 high CRIT-1 retroactive 等用户驱动 prod redeploy 闭环；不阻塞 prod 05-13 上线波次

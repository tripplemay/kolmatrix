# BL-024 B4 Ghost-controls 实装 mini-batch — Spec

> **状态：** Planner draft → 待 Generator 开工
> **触发：** Planner 2026-05-02 全 prod 排查（基线 6f33a55）发现 BIx redeploy 后仍残留 8 项 ghost controls；prod-mvp-readiness audit 2026-05-04 §4 排定（A/B/C 必做、D 启动时再裁、E/F deferred）
> **作者：** Planner johnsong @ 2026-05-05 22:45
> **依赖：** BL-020 / BL-034 / BL-035 全 done（F004/F005 复用 BL-035 F006 Resend webhook 后端 EmailLog.status 数据流）
> **预估：** ~2.5 day building + 0.5 day verifying
> **批次类型：** 普通批次（5 features 全 `executor:generator`）→ status 流转 `new → planning → building → verifying → done`

---

## 1. 背景与目标

prod-mvp-readiness audit 2026-05-04 §4 排定：BIx redeploy 后 prod 仍残留 8 项 "UI 展示了但未实装" ghost controls，全部 disabled + "Coming in B4" tooltip。团队内部 demo 不阻塞，但**对外客户接触时这些 ghost controls 暴露产品成熟度问题**。本批次 prod 上线对外（计划 2026-05-13）前清理。

**用户 2026-05-05 22:30 决议方案 B：** A+B+C + D-2 Tracking + D-3 Suppression = 5 features；D-1 Send Queue 推 BL-040+ 与 BullMQ 实装合批；E/F deferred。

**5 features 范围：**

| ID | 范围 | ROI | 工时 |
|---|---|---|---|
| F001 | A /database 头 3 按钮（Export / Import / Add KOL） | 高（对外客户必用入口） | ~1 day |
| F002 | B /roi 时间范围 toggle (7D/30D/90D/All-time) | 中 | ~3-4h |
| F003 | C /weekly-report Last Week/Last Month toggle（含 Last Month 4 周窗口聚合） | 中 | ~2h |
| F004 | D-2 /outreach Tracking tab 实装（复用 BL-035 F006 EmailLog.status 数据流） | 中（CRM-like 客户必看） | ~0.5 day |
| F005 | D-3 /outreach Suppression tab 实装（复用 BL-035 F006 hard-bounce 清 Kol.email + audit_log） | 中 | ~0.5 day |

**Deferred / 不做：**
- D-1 Send Queue（推 BL-040+ 与 BullMQ 实装合批；当前 CQ-H3 audit 列「BullMQ 完全未实装」，单独成 infra 批次）
- E /knowledge-base Import CSV（低 ROI，等真客户反馈触发）
- F /database BulkActionBar Delete（destructive，B6 完整批次处理含 audit log + 回滚 + 二次确认 UX）

**Definition of Done：**
- 5 features 全 PASS by Reviewer L1+L2
- staging git_sha 与 main HEAD 一致
- prod redeploy 后浏览器走 `/zh/database` + `/zh/roi` + `/zh/weekly-report` + `/zh/outreach/tracking` + `/zh/outreach/suppression` 5 处 spot check 各 toggle / list 真切换 / 加载
- signoff 报告明示哪些 ghost controls 已消除（**5 个**）/ 哪些保留 disabled（**send_queue + templates + import-csv + bulk-delete = 4 个 deferred**）/ 哪些推 BL-040+

---

## 2. 功能清单（5 features 全 generator，按推荐实装顺序）

### F002 · B /roi 时间范围 toggle（7D / 30D / 90D / All-time）— 先做（建立时间范围范式）

**Executor:** generator
**Priority:** medium
**预估工时:** 3-4h

**Audit 引用：** `src/app/[locale]/(app)/roi/RoiHeader.tsx:73-88`（4 个 ranges 数组 + ts 已写好但仅 30D active=true，其它 disabled+tooltip "B4"）

**复用范式：** `docs/specs/BIx-mvp-polish-pass-spec.md §F001` /crm 时间 toggle 完整范式（URL 参数 `?range=...` + range filter 改组件 + integration test 验证 4 range × N 组件）。

**改动：**

1. **`src/app/[locale]/(app)/roi/RoiHeader.tsx:73-88`** 4 个 ranges 全 `active: true`，移除 disabled + tooltip "B4"
2. **`src/app/[locale]/(app)/roi/page.tsx`** 接 `searchParams.range` 传给数据加载函数，default `"30d"`
3. **`src/lib/roi/insights.ts` 或对应数据加载层** 加 `range: '7d' | '30d' | '90d' | 'allTime'` 参数，按 range 算 createdAt filter window：
   - `7d`: `gte: NOW() - 7 day`
   - `30d`: `gte: NOW() - 30 day`
   - `90d`: `gte: NOW() - 90 day`
   - `allTime`: 无 filter
4. **影响下游组件**（按现有 /roi 页面结构 grep）：generateRoiInsightsAction / RoiKpiStrip / RoiTrendChart / RoiCampaignBreakdown 等，全按 range filter 重新 aggregate
5. **i18n:** 5 locale 加 `roi.range.7d / 30d / 90d / allTime`（如已存在则保留），删 `roi.rangeDisabledTooltip`（不再用）

**Acceptance：**
- [ ] RoiHeader.tsx 4 个 ranges 全 active=true（grep `disabled={!r.active}` 仍存在但条件全 false）
- [ ] URL `?range=7d|30d|90d|allTime` 切换刷新组件数据
- [ ] generateRoiInsightsAction（spec §F003 BL-035 F003 已加 rate-limit）参数加 range
- [ ] 既有集成 / unit 测试同步加 ≥4 case 验证 4 range × 关键组件
- [ ] visual baseline 重生（如需要 —— `update-visual-baselines` workflow）
- [ ] `npm run lint + tsc + test` 全绿

---

### F003 · C /weekly-report Last Week / Last Month toggle（含 Last Month 4 周窗口聚合）

**Executor:** generator
**Priority:** medium
**预估工时:** 2h

**Audit 引用：** `src/app/[locale]/(app)/weekly-report/WeeklyReportHeader.tsx:85-100`（2 个 ranges 数组 lastWeek/lastMonth，仅 lastWeek active=true）

**改动：**

1. **`WeeklyReportHeader.tsx:41`** ranges 数组 2 个全 `active: true`
2. **`src/app/[locale]/(app)/weekly-report/page.tsx`** 接 `searchParams.range` 传给数据加载，default `"lastWeek"`
3. **`src/lib/weekly-report/generate.ts`** 数据聚合层加 range 参数：
   - `lastWeek`: 上周 created_at 范围（同当前实装）
   - `lastMonth`: 4 周（28 day）窗口聚合 — 周报字段（KOL active count / Email sent / response rate / new contacts 等）按 4 周累计
4. **i18n:** 5 locale `weekly-report.range.lastWeek / lastMonth`（已有则保留）
5. **测试：** Last Month 4 周聚合需新单测 case 验证 28-day window 的数据点数 + 累计 metric 与 4 × 单周近似

**Acceptance：**
- [ ] WeeklyReportHeader.tsx 2 个 ranges 全 active=true
- [ ] URL `?range=lastWeek|lastMonth` 切换刷新
- [ ] generateWeeklyReportAction 参数加 range
- [ ] Last Month 28-day 聚合实现 + 单测覆盖
- [ ] visual baseline 重生
- [ ] `npm run lint + tsc + test` 全绿

---

### F001 · A /database 头 3 按钮（Export CSV / Import CSV / Add KOL form）

**Executor:** generator
**Priority:** high
**预估工时:** ~1 day（3 子功能）

**Audit 引用：** `src/app/[locale]/(app)/database/page.tsx:127-159`（3 个 disabled Button，data-testid=database-export / database-import / database-add-kol）

**3 子改动：**

#### F001-1 · Export CSV

**复用范式：** `src/app/api/crm/export-csv/route.ts`（既有 CRM Export CSV 范式）

1. **新建 `src/app/api/database/export-csv/route.ts`** Server route handler：
   - GET handler with auth + tenantId
   - 查 KOL 列表（按当前 filter / search / sort 参数 — 同 /database 页面查询）
   - 生成 CSV：列 = displayName / handle / platform / followerCount / engagementRate / valueScore / categories / language / countryCode / email / firstSeenAt（参 KolResultCard 字段；formula injection 防护用 csvCell helper if exists 或新加）
   - `Content-Disposition: attachment; filename="kols-{tenant}-{YYYYMMDD}.csv"`
2. **`database/page.tsx:127-138`** Export button 改 `<Link href="/api/database/export-csv?...">`（带当前 URL 参数）+ 移除 disabled

**Acceptance：**
- [ ] `/api/database/export-csv` 端点存在 + auth + tenantId 限制 + filter 同步
- [ ] CSV 文件名格式 `kols-{tenant}-{YYYYMMDD}.csv`
- [ ] CSV 字段含 displayName / handle / platform / followerCount / engagementRate / valueScore / categories
- [ ] formula-injection 防护（csvCell helper：`=` / `+` / `-` / `@` 起首加单引号前缀）
- [ ] row-count cap（避免大租户 OOM；建议 default 5000，URL `?limit=N` 可 override）— v0.9.11 §database-patterns.md §6 silent updateMany 模式延伸（CSV 上限明示，避免 silent OOM）
- [ ] 集成测试 ≥2 case：基本 CSV 内容 + formula-injection 防御
- [ ] `npm run lint + tsc + test` 全绿

#### F001-2 · Import CSV

1. **新建 `src/app/api/database/import-csv/route.ts`** POST handler：
   - multipart/form-data 接收 CSV 文件（限 5MB）
   - 解析 + zod schema 校验每行（同 KolSyncAdapter 字段格式）
   - 批量 upsert：按 `externalId + platform` 去重（既有 KolSyncAdapter 接口约定）
   - 返回 `{ ok: true, importedCount, skippedCount, errors: [] }`
2. **`database/page.tsx:140-150`** Import button → 弹窗 file picker + 上传 + 进度 toast
3. **新建 `src/app/[locale]/(app)/database/ImportCsvDialog.tsx`** client component（弹窗 + 上传逻辑）

**Acceptance：**
- [ ] `/api/database/import-csv` 端点存在 + auth + tenantId 限制 + 5MB 上限
- [ ] zod schema 校验 + 错误行号返回（前 10 个错误细节）
- [ ] upsert 去重（externalId + platform）
- [ ] 集成测试 ≥3 case：valid CSV / invalid 字段 / oversize 5MB+ 拒
- [ ] 弹窗 UX：上传中 disabled + 进度 toast + 完成 toast
- [ ] `npm run lint + tsc + test` 全绿

#### F001-3 · Add KOL form

1. **`database/page.tsx:152-159`** Add KOL button → 弹窗 form
2. **新建 `src/app/[locale]/(app)/database/AddKolDialog.tsx`** client component：form fields = platform (select) + handle (input, required) + displayName (required) + url (optional, URL 校验) + email (optional, email 校验) + followerCount (number, optional)
3. **新建 server action `src/app/[locale]/(app)/database/actions.ts addKol(input)`** 含 zod schema + withTenant + Kol.create

**Acceptance：**
- [ ] AddKolDialog 含 6 个 form fields + zod 校验
- [ ] addKol server action 含 rate-limit（v0.9.11 §rate-limit dogfood：mutation 类 20/min/userId — 复用 BL-035 F003 `rateLimitBatchSend` 模式或新建 `rateLimitMutation`）
- [ ] 重复 handle+platform 返 conflict 提示
- [ ] 集成测试 ≥3 case：valid / 重复冲突 / invalid URL
- [ ] `npm run lint + tsc + test` 全绿

---

### F004 · D-2 /outreach Tracking tab 实装（list view）

**Executor:** generator
**Priority:** medium
**预估工时:** ~0.5 day

**Audit 引用：** `src/app/[locale]/(app)/outreach/OutreachTabs.tsx` TABS 数组中 `tracking` tab 当前 disabled+tooltip "comingB4"

**BL-035 F006 后端复用：** EmailLog.status 写回（5 event type：delivered/bounced/complained/opened/clicked）+ deliveredAt / openedAt / repliedAt 时间戳已就绪，本 feature 仅做前端 list view。

**改动：**

1. **`OutreachTabs.tsx`** TABS 数组 `tracking` 移除 `tooltipKey: "comingB4"` + 改 disabled→active，加 href `/outreach/tracking`
2. **新建 `src/app/[locale]/(app)/outreach/tracking/page.tsx`** Server Component：
   - 查 EmailLog 表 by tenantId（withTenant）
   - 默认按 `createdAt DESC` 排序，cursor pagination 50 行/页（复用 `src/lib/pagination/cursor.ts`）
   - 字段：发送时间 sentAt / KOL 名（join Kol） / Subject / Status (delivered/opened/clicked/bounced/complained/queued/sent) / openedAt / repliedAt / bounceReason
3. **新建 `TrackingTable.tsx`** client component（filter by status + 分页）
4. **i18n** outreach.tabs.tracking 已有；新增 outreach.tracking.{title, columns, statuses, emptyState, ...}

**Acceptance：**
- [ ] OutreachTabs.tsx tracking tab 解锁，link 到 `/zh/outreach/tracking`
- [ ] tracking/page.tsx 列表显示 EmailLog 行（按 tenantId filter + cursor pagination）
- [ ] status filter（all / delivered / opened / bounced / complained 等）
- [ ] visual baseline 新增（tracking-list.png）
- [ ] 集成测试 ≥2 case：基本列表加载 + status filter
- [ ] `npm run lint + tsc + test` 全绿

---

### F005 · D-3 /outreach Suppression tab 实装（hard-bounce + manual unsubscribe list）

**Executor:** generator
**Priority:** medium
**预估工时:** ~0.5 day

**Audit 引用：** `src/app/[locale]/(app)/outreach/OutreachTabs.tsx` TABS 数组中 `suppression` tab 当前 disabled+tooltip "comingB4"

**BL-035 F006 后端复用：** hard-bounce 路径 `tx.kol.update({ where: { id: log.kolId! }, data: { email: null } })` + audit_log `action: "kol.email_cleared_by_bounce"` 已就绪。

**Suppression 数据源（2 路）：**

1. **Hard-bounce 自动清空：** audit_log where action='kol.email_cleared_by_bounce' AND tenant_id=$tenantId
2. **手动退订（未来扩展）：** 为完整 CRM 后续 BL-040+ 加 `Kol.suppressedAt + suppressedReason` 字段；本 feature 不实装手动退订 UI（仅 audit_log 路径），但保留 list view 架构以便后续扩

**改动：**

1. **`OutreachTabs.tsx`** TABS 数组 `suppression` tab 解锁
2. **新建 `src/app/[locale]/(app)/outreach/suppression/page.tsx`** Server Component：
   - 查 audit_log where action='kol.email_cleared_by_bounce' AND tenant_id=$tenantId（按 BL-034 F003 RLS 已自动 filter；显式 tenantId 是 defense-in-depth）
   - join Kol 显示 displayName / handle / platform
   - 字段：清除时间 audit_log.created_at / KOL 名 / 原 email（after.providerMessageId）/ 退订原因 (before.reason)
3. **新建 `SuppressionTable.tsx`** client component（基本列表，cursor pagination）
4. **i18n** outreach.tabs.suppression 已有；新增 outreach.suppression.{title, columns, emptyState, ...}

**Acceptance：**
- [ ] OutreachTabs.tsx suppression tab 解锁
- [ ] suppression/page.tsx 列表显示 hard-bounce 清除的 KOL（按 tenantId filter）
- [ ] empty state 友好提示（"No suppressed KOLs yet"）
- [ ] visual baseline 新增（suppression-list.png）
- [ ] 集成测试 ≥2 case：basic list / cross-tenant filter
- [ ] `npm run lint + tsc + test` 全绿

---

### F006 · BL-034 F001 deploy yml env bridge fix（hotfix 追加 — 用户 2026-05-05 23:05 决议方案 A）

**Executor:** generator
**Priority:** high（CRIT-1 后置阻塞 — 当前 prod kolmatrix_app 仍用弱密码）
**预估工时:** 30 min（2 yml 改 + 可能 1 个 staging deploy script ALTER ROLE 段补 + manual smoke）

**触发：** Planner johnsong 2026-05-05 ~23:00 prod redeploy ops 准备阶段实地核查发现 BL-034 F001 spec acceptance 已 done @ dbbfbb3（deploy-prod.sh 加 ALTER ROLE 段 line 71-81）但漏了同 commit 改 `.github/workflows/deploy-prod.yml` script 块加 `set -a; source .env.production; set +a`。后果：
- deploy-prod.sh:71 `if [ -n "${KOLMATRIX_APP_PASSWORD:-}" ]` 取空 → silent skip 「⚠️ KOLMATRIX_APP_PASSWORD unset — skipping app-role password rotation」
- prod kolmatrix_app 角色实际仍用 init migration 写的字面 `'kolmatrix_app'` 弱密码 — **CRIT-1 fix 未在 prod 生效**

**改动：**

1. **`.github/workflows/deploy-prod.yml` script 块改：**
   ```yaml
   script: |
     cd /opt/kolmatrix
     # F006 (BL-034 F001 retroactive fix): export .env.production into shell
     # so deploy-prod.sh's ALTER ROLE step (line 71-81) reads KOLMATRIX_APP_PASSWORD.
     set -a
     source .env.production
     set +a
     ./scripts/deploy-prod.sh
   ```

2. **`.github/workflows/deploy-staging.yml` script 块改：** 同模式加 `set -a; source .env.staging; set +a` 在 `bash infrastructure/deploy-staging.sh` 之前

3. **核对 `infrastructure/deploy-staging.sh` 是否有对应 ALTER ROLE 段：** 如无 — Generator 评估是否同 commit 加 ALTER ROLE 到 staging deploy script，参 deploy-prod.sh:71-81 复制实装

**Acceptance：**
- [ ] deploy-prod.yml script 块含 `set -a; source .env.production; set +a` 在 `./scripts/deploy-prod.sh` 之前
- [ ] deploy-staging.yml script 块含 `set -a; source .env.staging; set +a` 在 `bash infrastructure/deploy-staging.sh` 之前
- [ ] infrastructure/deploy-staging.sh ALTER ROLE 段存在（如不存在则同 commit 加，参 deploy-prod.sh:71-81）
- [ ] 本 feature 不需新单测（CI yml 改动）；smoke：SSH prod 上跑 `set -a; source /opt/kolmatrix/.env.production; set +a; echo "$KOLMATRIX_APP_PASSWORD"` 验证 export（Generator manual + handoff 列出证据）
- [ ] BL-034 F001 spec drift 在 generator_handoff 列出 retroactive 范围 + 提示 Reviewer 在 BL-024 signoff §Soft-watch 加 S? 或 §Framework Learnings 提案 v0.9.13 候选「spec acceptance 改 deploy-script 时同 commit 必须改对应 yml」
- [ ] `npm run lint + tsc + test` 全绿（CI yml 改不破任何代码）

**与 v0.9.12 §deploy-patterns.md §5 互动：** v0.9.12 §5 已沉淀「new auth-gated endpoint 配套 deploy script」，本 feature 是同类沉淀的下一步：「deploy script 期望 .env vars 时 yml 桥接必须配套」。建议 Generator 在 generator_handoff 提案 v0.9.13 候选（不入 features.json，仅 framework/proposed-learnings.md 草稿）让 Planner 在 BL-024 done 阶段决议。

---

## 3. 变更文件清单（高层）

```
src/app/[locale]/(app)/roi/RoiHeader.tsx                            F002 EDIT
src/app/[locale]/(app)/roi/page.tsx                                 F002 EDIT (searchParams.range)
src/lib/roi/insights.ts                                             F002 EDIT (range param)

src/app/[locale]/(app)/weekly-report/WeeklyReportHeader.tsx         F003 EDIT
src/app/[locale]/(app)/weekly-report/page.tsx                       F003 EDIT
src/lib/weekly-report/generate.ts                                   F003 EDIT (Last Month 28-day window)

src/app/[locale]/(app)/database/page.tsx                            F001 EDIT (3 buttons unlock)
src/app/[locale]/(app)/database/AddKolDialog.tsx                    F001-3 NEW
src/app/[locale]/(app)/database/ImportCsvDialog.tsx                 F001-2 NEW
src/app/[locale]/(app)/database/actions.ts                          F001-3 NEW (or extend if exists)
src/app/api/database/export-csv/route.ts                            F001-1 NEW
src/app/api/database/import-csv/route.ts                            F001-2 NEW

src/app/[locale]/(app)/outreach/OutreachTabs.tsx                    F004 + F005 EDIT
src/app/[locale]/(app)/outreach/tracking/page.tsx                   F004 NEW
src/app/[locale]/(app)/outreach/tracking/TrackingTable.tsx          F004 NEW
src/app/[locale]/(app)/outreach/suppression/page.tsx                F005 NEW
src/app/[locale]/(app)/outreach/suppression/SuppressionTable.tsx    F005 NEW

i18n locales (en/zh/ja/ko/es).json                                  F001 + F002 + F003 + F004 + F005 EDIT (~15 keys)

tests/integration/{database-export-csv,database-import-csv,roi-range,weekly-report-range,tracking-list,suppression-list}.test.ts  6 NEW
src/app/[locale]/(app)/database/__tests__/{AddKolDialog,actions}.test.tsx                                                          F001 NEW
src/app/[locale]/(app)/outreach/__tests__/OutreachTabs.test.tsx     F004+F005 EDIT (tab unlock 验证)

design-draft/visual-baseline/                                       F002 + F003 + F004 + F005 visual baseline 重生
```

---

## 4. 关键设计决策

### D1 (F001-1) — Export CSV 复用 BIx F001 范式
`/api/crm/export-csv` 已立 csvCell formula-injection 防护 + Content-Disposition 模式，本 feature 全套复用。row-count cap default 5000，URL `?limit=N` override（v0.9.11 §6 silent updateMany 模式延伸 — 显式 cap 而非 silent OOM）。

### D2 (F001-3) — Add KOL form 含 rate-limit（v0.9.11 dogfood）
`addKol` server action 是 mutation 类，按 v0.9.11 §rate-limit 矩阵复用 BL-035 F003 `rateLimitBatchSend` 模式或新建 `rateLimitMutation`（20/min/userId）。

### D3 (F002) — /roi range URL 参数 default 30d
保持当前默认 30d 不变（避免破坏现有用户书签）；URL ?range= 新增可选。

### D4 (F003) — Last Month 28-day 而非 calendar-month
28-day 窗口便于实装（4 × 7 day），与 lastWeek 单位一致；calendar-month 需考虑闰年 / 时区漂移，复杂度高 + 用户可选 7d/30d 替代。

### D5 (F004) — Tracking tab 仅 list view，不做实时推送
EmailLog 已 BL-035 F006 webhook 写回，前端 server-rendered 拉取最新数据足够（refresh 触发）；后续 BL-040+ 可加 SSE / WebSocket。

### D6 (F005) — Suppression 数据源仅 audit_log，不加 schema 字段
本 feature 不动 schema（避免 migration 风险）；audit_log where action='kol.email_cleared_by_bounce' 是充分的 hard-bounce 来源。手动退订 UI 推 BL-040+（需要 Kol.suppressedAt 字段）。

### D7 — Send Queue (D-1) 推 BL-040+ 与 BullMQ 实装合批
CQ-H3 audit 列「BullMQ 完全未实装」是 infra 大改（package.json 加 bullmq + ioredis worker），与 mini-batch 量级不符；BL-040+ 单独成批处理。

### D8 — Templates / Knowledge-base Import / BulkActionBar Delete deferred
Templates tab 依赖 Templates library 后端（与 BL-025 Asset 表解耦但 UI 流复杂）；KB Import CSV 真客户反馈触发；BulkActionBar Delete 是 destructive 需 B6 完整批次（audit log + 回滚 + 二次确认 UX）。

---

## 5. v0.9.11 + v0.9.12 框架新规 dogfood 应用

| 新规 | 应用位置 |
|---|---|
| v0.9.11 §rate-limit 默认值矩阵 | F001-3 addKol mutation 接 rateLimitBatchSend 或新 rateLimitMutation（20/min/userId） |
| v0.9.11 §database-patterns.md §6 silent updateMany | F001-1 Export CSV row cap default 5000（避免 silent OOM） |
| v0.9.11 §ai-action-contract.md §4 max_tokens + XML tag | 无 AI 调用，不直接应用 |
| v0.9.11 evaluator §16 .nvmrc Node 20 | Reviewer L1 启动 nvm use 20 验证 |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | F001-2 Import CSV zod schema 与 KolSyncAdapter 字段对齐时如发现 spec 偏差 → Generator 主动停 + 短格式裁决 |
| v0.9.12 §database-patterns.md §8.1 cross-cutting helper | 无 RLS migration 改动，不直接应用 |
| v0.9.12 §deploy-patterns.md §5 auth-gated endpoint | 无 default-deny endpoint 改动，不直接应用 |
| v0.9.12 §evaluator.md §17 lint warnings 矩阵 | Reviewer reverifying 时按矩阵处理（unused-import → Soft-watch） |

---

## 6. Definition of Done

### 6.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | prod redeploy 后浏览器 walk 5 处：/zh/database 头 3 按钮可点 + Export CSV 真下载 + Import CSV 弹窗 + Add KOL form / /zh/roi 4 个 range 按钮可切换 / /zh/weekly-report 2 个 range 可切换 + Last Month 数据正确 / /zh/outreach/tracking 列表加载 + status filter 工作 / /zh/outreach/suppression 列表加载（hard-bounce KOL 显示） | BL-024 done 后 prod redeploy |
| 2 | （可选）真触发 Resend hard-bounce 邮件 → 验证 /outreach/suppression 显示 + Kol.email 清空 | 与 BL-035 F006 prod 真测合并（user 手工待办继承） |

### 6.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含新增 ≥15 测试 case）+ CI 全绿 + visual baseline 重生通过
- **L2：** staging git_sha 对齐 + 5 处浏览器 spot check + Tracking 列表数据真实（BL-035 F006 EmailLog 写入路径验证）

### 6.3 Soft-watch（不阻塞 done）

- F004 Tracking 实时推送（SSE / WebSocket）推 BL-040+
- F005 Suppression 手动退订 UI 推 BL-040+（需 schema 加 Kol.suppressedAt 字段）
- D-1 /outreach Send Queue 推 BL-040+ 与 BullMQ 实装合批
- E /knowledge-base Import CSV 真客户反馈触发
- F /database BulkActionBar Delete 推 B6 destructive 完整批次

---

## 7. 推荐实装顺序（Generator 接手参考）

```
1. F002 /roi range toggle           （建立时间范围 toggle 范式 — 复用 BIx F001，~3-4h）
2. F003 /weekly-report range toggle （复用 F002 范式 + Last Month 28-day 聚合，~2h）
3. F001-1 /database Export CSV      （复用 /api/crm/export-csv 范式，~2-3h）
4. F001-2 /database Import CSV      （新模块 + zod + upsert，~3h）
5. F001-3 /database Add KOL form    （新模块 + addKol server action + rate-limit，~2h）
6. F004 /outreach/tracking          （新页面 + EmailLog list view，~0.5 day）
7. F005 /outreach/suppression       （新页面 + audit_log list view，~0.5 day）

总计：~2.5 day building + 0.5 day verifying
```

> **Spec lock：** Planner johnsong @ 2026-05-05 22:45。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段发现良性偏差按 §11 building 中段变种处理。

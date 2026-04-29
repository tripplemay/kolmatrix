---
name: BIx-mvp-polish-pass
description: MVP 上线前最后 polish - /crm 3 disabled controls 真做 + 5 项 misc 文案/小修 + 11 页 edge states critical paths
status: decisions-locked, awaits MVP-internal-demo-prep done
created_by: johnsong (Planner)
created_at: 2026-04-30
decisions_locked_at: 2026-04-30
estimated_effort: ~2-2.5 day Generator + 0.5 day Reviewer
features_count: 3
prerequisites:
  - MVP-internal-demo-prep done（含 P0 polish 4 项 F006/F007）
trigger: MVP-internal-demo-prep done 后立即启动
---

# BIx-mvp-polish-pass — MVP 上线前最后 polish

## 1. 背景与目标

### 1.1 来源

`docs/product/MVP-polish-audit-2026-04-30.md` §"P1 — 独立 micro-batch / 团队 demo 后期补"。

用户 2026-04-30 决议：
- 取消 P1-5 mobile responsive（团队不会通过移动端使用产品）
- 接受 P0 4 项并入 MVP-internal-demo-prep（F006/F007）
- P1 必做 6 项 + critical paths edge states 合并到本批次

### 1.2 目标

清掉团队第一眼可见的 ghost controls（6 个 disabled 按钮），消除"半成品观感"；并修关键 edge states（loading / empty / error）让团队体验稳定。

### 1.3 非目标

- ❌ Mobile 响应式适配（团队不用 mobile）
- ❌ ja/ko/es 翻译人审（产品工作非 dev → BL-014 backlog）
- ❌ Visual regression 跨平台（infra → BL-015 backlog）
- ❌ jsPDF / puppeteer 真 PDF（团队不抱怨可不做 → BL-016 backlog）
- ❌ /shared/weekly-report token 过期 + 撤销（团队内部 demo 不会真分享给外部）
- ❌ 11 页 mobile 适配 / 全量 edge states 系统性 spot check（仅 critical paths）

## 2. 范围（3 features）

### F001 — /crm Header 3 个 disabled 控件清理

**Executor：** generator
**估时：** ~1 day

**实现：**

1. **时间 toggle（thisQuarter / Last 90d / allTime）真做**
   - 当前：仅 "Last 90d" 可点，其他两个 disabled
   - 改造：3 个 button 全可点，按 created_at 范围 filter 4 个 CRM 组件：
     - `CrmKpiStrip`：collabKpi 按时间窗 aggregate
     - `CrmPipelineBars`：stageDistribution 按时间窗
     - `CrmFunnel`：funnelMetrics 按时间窗
     - `CrmRecentChanges`：audit_log 按时间窗
   - URL 参数：`?range=thisQuarter|last90d|allTime`，default `last90d`
   - `runCrmOverview(tenantId, { range })` 接受 range 参数

2. **Export CSV 按钮真做**
   - 当前：disabled with tooltip
   - 改造：Server Action 生成 CRM 数据 CSV（KOL 列表 + 阶段 + kolCampaign + 金额）
   - 用 `Content-Disposition: attachment; filename="crm-{tenant}-{YYYYMMDD}.csv"` 下载

3. **+Manual log 按钮删除（不真做，PRD §11.4 已说手动接入 webhook = B4-extended）**
   - 直接从 CrmHeader 移除该按钮
   - 删除 i18n key `crm.header.manualLog*`

**Acceptance：**
- /crm 时间 toggle 3 个全可点击，切换刷新 4 个组件数据
- /crm Export CSV 点击下载真实 CSV 文件
- /crm +Manual log 按钮不再显示
- tests/integration/crm-time-range.test.ts 验证 3 range × 4 组件
- tests/integration/crm-export-csv.test.ts 验证 CSV 内容
- staging git_sha 与本 commit 一致

### F002 — Misc 5 项 polish（campaigns Owner filter / database Email btn / PDF 文案 / mock_sent fail-fast）

**Executor：** generator
**估时：** ~2h

**实现：**

1. **/campaigns Owner filter 真做（P1-3）**
   - 当前：disabled
   - 改造：filter 取自 `Campaign.ownerUserId`，显示当前 tenant 内 user 列表
   - SQL where + URL 参数 `?owner=<userId>`
   - 当 tenant 仅 1 用户时 hide filter（避免冗余）

2. **/database BulkActionBar Email 按钮改跳转（P1-4）**
   - 当前：disabled，注释说 "point users at /outreach instead"
   - 改造：onClick → `router.push('/outreach?kolIds=' + selectedKolIds.join(','))`
   - /outreach 页接收 `?kolIds=...` query 自动预选

3. **/weekly-report PDF 帮助文案（P1-8a）**
   - 当前：Download PDF 实际是 `window.print()` 但用户不知道
   - 改造：button title="Save as PDF in the print dialog"；click 后 toast："Choose 'Save as PDF' in the print dialog that opens"

4. **邮件 mock_sent fail-fast（P1-9）**
   - 当前：`src/lib/email/resend.ts` 无 RESEND_API_KEY 时 silent mock_sent
   - 改造：production 环境（NODE_ENV=production）下无 key 时 `throw new Error('RESEND_API_KEY missing in production')`
   - dev 仍允许 mock_sent（local dev 不一定有 key）

5. **/campaigns/AiSuggestionsCard "Coming with B2" badge 已在 MVP-internal-demo-prep F007 处理**（不重复）

**Acceptance：**
- /campaigns Owner filter 真过滤（tenant 单用户时 hide）
- /database BulkActionBar Email 跳转 /outreach 带预选
- /weekly-report Download PDF 显示友好 print 对话框引导
- 邮件无 key + production env → 立即 throw（不 silent mock）
- existing tests 不破坏
- staging git_sha 与本 commit 一致

### F003 — 11 页 critical paths edge states spot check + 必修

**Executor：** generator
**估时：** ~半天 (~4h)

**实现：**

针对 11 页 critical paths（不全量 spot check），检查并修：

| 页面 | Critical empty state | Critical error state |
|---|---|---|
| `/dashboard` | 新 tenant（0 KOL / 0 Campaign）→ 不崩 | EmailLog query 失败 → friendly fallback |
| `/discovery` | 0 KOL match filter → 友好 empty + 引导清 filter | aigcgateway Smart Match 失败 → toast |
| `/database` | 0 saved KOL → 友好 empty + 引导 /discovery | API 500 → error boundary |
| `/kols/[id]` | invalid id → 404 friendly | YouTube API 失败 → fallback to cached |
| `/knowledge-base` | 0 Product → 引导创建 | aigcgateway 生成失败 → retry button |
| `/campaigns` | 0 Campaign → 友好 empty + New Campaign CTA | API 失败 → error boundary |
| `/campaigns/[id]` | 0 KOL in campaign → 引导 Add KOL | revenue 录入失败 → form error |
| `/outreach` | 0 sendable KOL → 引导 /campaigns/[id] 添加 | Resend 失败 → error toast |
| `/crm` | 0 audit_log → 友好 empty | runCrmOverview 失败 → error |
| `/roi` | 0 closed campaign → 友好 empty | API 500 → error boundary |
| `/weekly-report` | 0 历史 → 引导 Generate | 生成失败 → retry CTA |

**重点修：** loading skeleton 仅明显空白 ≥ 1.5s 的页加（默认 Next.js suspense 已处理大多数）；error boundary 全 11 页加 `error.tsx` 兜底。

**Acceptance：**
- 11 页有 `error.tsx` 兜底（display friendly error + reload CTA）
- 11 页关键 empty state 有 friendly 引导（不出现纯白屏 / Lorem ipsum）
- tests/integration/edge-states-coverage.test.ts 验证 11 页 error boundary 存在
- 手工 spot check：dev 模式停 PG → 11 页全部 graceful（非崩溃）
- staging git_sha 与本 commit 一致

## 3. 关键设计决策（已 lock）

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 范围 | 仅 P1 必做 6 项 + critical paths edge states | 移除 mobile（团队不用）+ 移 i18n/visual baseline 等到 backlog |
| /crm Manual log 按钮 | 删除（非 disable） | PRD §11.4 已锁 Manual log = B4-extended |
| /campaigns Import 按钮 | 已在 MVP-internal-demo-prep F007 删除 | 不重复 |
| /campaigns AiSuggestionsCard | 已在 MVP-internal-demo-prep F007 修文案 | 不重复 |
| Owner filter（仅 1 用户时）| 隐藏 filter | 避免冗余 UI |
| edge states 范围 | 仅 critical paths（11 页 × 1-2 关键 state）| 全量 spot check 工时翻倍，团队 demo 不需要 |
| mobile responsive | **完全移除** | 用户 2026-04-30 明确 "团队不会通过移动端使用产品" |

## 4. 依赖关系

```
MVP-internal-demo-prep done → BIx-mvp-polish-pass building
                                       ↓
                                F001 + F002 + F003 (Generator 串行)
                                       ↓
                                Reviewer L1+L2 verifying
                                       ↓
                                done → 团队 demo 启用 ⭐
```

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| /crm 时间 toggle 改 4 个组件可能影响 visual baseline | 中 | F001 含 baseline 更新；先 staging 验证 |
| Export CSV 真做时数据量大可能超时 | 低 | F001 限 max 10K 行 / 加 streaming |
| Owner filter SQL 性能（小 tenant 不影响）| 低 | 单 tenant 用户 ≤ 5 时无索引压力 |
| edge states 11 页 critical paths 工时超预估 | 中 | 缓冲 1h；如某页复杂超预算 → 推到 backlog |
| 邮件 fail-fast 改动可能让 dev 跑测试失败 | 低 | F002 限 production env；dev 仍 silent mock |

## 6. 验收方式

### L1 自动化
- F001 crm-time-range + crm-export-csv integration tests
- F002 owner-filter + bulk-email-jump integration tests
- F003 edge-states-coverage 11 页 error.tsx 存在性检查
- typecheck / lint / 现有套件不退化

### L2 staging
- /crm 3 时间 toggle 切换 + Export CSV 下载
- /campaigns Owner filter 真过滤
- /database BulkActionBar Email 跳转 /outreach 带 ?kolIds=...
- 11 页 error.tsx + empty state spot check（dev 停 PG → 全 graceful）

### L3 prod 烟测
- 同 MVP-internal-demo-prep F005 checklist 但补 BIx 涉及功能（time toggle / Export CSV / Owner filter）

## 7. 引用文档

- `docs/product/MVP-polish-audit-2026-04-30.md`（本批次起源 + 完整 P1 清单）
- `docs/specs/MVP-internal-demo-prep-spec.md`（前置批次，F006/F007 已含 P0 4 项）
- `docs/product/KOLMatrix-MVP-PRD.md` §11.4（CRM 简化版决策）+ §12（Out of Scope）
- `framework/harness/ui-fidelity-guardrail.md`（ghost controls 容许带 tooltip 的 guardrail）

## 8. 启动检查清单（Generator 开工前）

- [ ] MVP-internal-demo-prep done + signoff
- [ ] 用户触发 prod redeploy（含 F006/F007）
- [ ] prod /api/health 200 + redis.status="not_used"（F007 落地证据）
- [ ] /campaigns 页面无 "Coming with B2" badge（F007 落地证据）

## 9. 估时

| 环节 | 预估 | 执行者 |
|---|---|---|
| F001 /crm 3 disabled 控件清理（time toggle real / Export CSV impl / Manual log delete）| ~1 day | Generator |
| F002 Misc 5 项 polish（Owner filter + Email btn + PDF 文案 + mock_sent + AiSuggestions 已删）| ~2h | Generator |
| F003 11 页 critical paths edge states + 必修 | ~半天 (~4h) | Generator |
| 缓冲 | ~3h | — |
| **总计** | **~2-2.5 day Generator + 0.5 day Reviewer** | — |

## 10. 用户决策（2026-04-30 lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | Mobile responsive 是否做 | ❌ 不做（团队不用 mobile）|
| 2 | P0 4 项归属 | ✅ 并入 MVP-internal-demo-prep F006/F007 |
| 3 | P1 范围 | ✅ 必做 6 项 + critical edge states，其他入 backlog |
| 4 | 时机 | ✅ MVP-internal-demo-prep done 后立即启动 |
| 5 | 整体方案 | ✅ 单一 BIx-mvp-polish-pass micro-batch（~2-2.5 day）|

---

**Spec 状态：** decisions-locked, awaits MVP-internal-demo-prep done

**与其他批次关系：**
- 依赖 MVP-internal-demo-prep done（F006/F007 已含 P0）
- 不与 B8-ai-extensions 冲突（B8 邀请后第 2 周做，本批次 done 后才发邀请 / 启动团队 demo）
- 不与 B4-extended-email-system 冲突（B4-extended 含 webhook + manual log）

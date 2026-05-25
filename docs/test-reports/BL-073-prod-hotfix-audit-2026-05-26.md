# BL-073 Prod Hotfix — Phase A0 Audit + A1 Lock

> **执行：** 2026-05-26 北京 / Planner Kimi
> **范围：** 4 prod issues 用户描述 + Planner 实地 grep + SSH prod SQL audit + lock 修复方向
> **状态：** ✅ Phase A0 + A1 完成 → 待 building（F001 起点）
> **类型：** Prod hotfix（铁律 #9）— src/ 业务码修复 + CI/test 防御升级 + filter UX 防御

---

## §1 4 Prod Issues 汇总

| # | 症状 | 根因 | 文件数 | 严重度 |
|---|---|---|---|---|
| 1 | /campaigns/[id] 8 个 Material Symbols icon 字面文字（`forward_to_inbox` / `refresh` / `article` / `attach_money` / `error_outline` / `hourglass_empty` / `mark_email_unread` / `verified_user`）| **multi-line span 内裸字符串** pattern；BL-072-F005 Pattern 6 + F007 test 全只覆盖 `"quoted"` 不覆盖 bare on own line | 多文件 + 1 manifest + 1 script + 1 test | P1 |
| 2 | /brief form 区域居中两边大量留白 | `BriefPageClient.tsx:120` 嵌套 `max-w-3xl` 二级约束；BL-072-F001 spec acceptance 漏检 client component 内嵌套 max-w | 1 file | P2 |
| 4A | /match emptyState 显示 "match.emptyState.body" 字面文字 | `match.emptyState.body` 5 locale 全 MISSING；BL-072-F007 i18n test 只 grep raw English 不验 page.tsx 调用 key 在 messages 是否存在 | 5 messages/*.json + 1 test | P1 |

**注：** issue #3（IA 缺活动入口）+ issue #4B（KOL data coverage gap）分别归 BL-074-ia-v2 + BL-075-kol-data-coverage 独立批次。

## §2 总根因模式（共性反思）

5 个共性：

1. **BL-072 防御 v1 未穷举所有 JSX pattern**：仅覆盖 `{cond ? "icon-a" : "icon-b"}` quoted ternary，漏 multi-line span 内 bare `>icon<\n` 跨行 — F005 Pattern 6 + F007 test 都需 v2 升级
2. **BL-072 spec acceptance 漏"嵌套二级约束 grep 全仓"**：F001 视觉宽度对齐类 acceptance 必须含 `grep -rn "max-w-" <route>/ --include='*.tsx'` 全 review，避免 client component 内嵌套 max-w 破坏外层意图
3. **i18n test 维度漏检**：BL-072-F007 `i18n-page-side-consumption.test.ts` 只 grep raw English literals，**不验 page.tsx 调用 `t(key)` 时该 key 在 messages JSON 实际存在** — `match.emptyState.body` 是经典反例
4. **prod log 已存在多次 MISSING_MESSAGE error** 但未阻塞 deploy + 未走告警链 — next-intl 默认 production fallback 返 key 字面 + log 但不 throw
5. **`backlog.json` 早识别 BL-062 KOL data coverage gap 但一直没起 batch** — country/language 字段 NULL 在 filter UI 暴露成业务断点

## §3 SSH Prod Audit 实测过程（关键证据）

### 3.1 KOL 表数据完整性

```
prod kol 表（active + gaming + non-suspicious + non-demo-seed）:
- total: 1385
- platform 分布: TikTok 818 / YouTube 389 / Instagram 178
- country_code: 1385 全 NULL/空 ❌
- language: 1385 全 NULL/空 ❌
- categories: Gaming 1382 + Esports 3
- valueScore: 默认排序正常
```

### 3.2 后端链路完全 OK

```
Test 1: withTenant(tenantId, ...) — kol count = 1385 ✓
Test 2: app.tenant_id set 正确为 2b1dcaa2-... ✓
Test 3: runMatchSearch(tenantId, parseFilters({})) — items=20, total=1385, hasMore=true ✓
```

→ Sub-bug B "search 全空" 真根因 = **country/language filter 命中 NULL 列**，非 backend bug。归 BL-075。

### 3.3 prod git_sha 验证

```
prod /opt/kolmatrix HEAD = 1a3fdcf (main HEAD, BL-072 done 最新)
PM2 uptime: 1887s ≈ 31 min (5/25 17:39 UTC 后 reload, deploy run 26412587622)
messages/zh.json match.emptyState keys = ['title', 'tipHeading', 'tipBody'] — 无 'body' ❌
```

### 3.4 prod error log 中 MISSING_MESSAGE 记录

```
2026-05-25 17:18:57 ~ 18:02:24 UTC 多次出现:
  Error: MISSING_MESSAGE: match.emptyState.body (zh)
  Error: MISSING_MESSAGE: weeklyReport.title (zh)
```

`weeklyReport.title` 也是漏 key 信号 — 应同步纳入 issue #4A 修复范围扫描。

## §4 A1 Lock 决策（用户 5/26 ack）

| 决策 | Lock |
|---|---|
| **批次分割** | A: 3 独立批次（BL-073 prod hotfix + BL-074 IA v2 + BL-075 data coverage）|
| **BL-073 scope** | 含防御升级（Pattern 7 / i18n key existence test）+ filter UX 防御（country/language disable）|
| **i18n empty 文案** | 区分两态：默认空 vs filter 命中空 |
| **subset script Pattern 7** | 加 bare string in multi-line span grep（false-positive 排除清单与 Pattern 6 同步增量）|
| **F007 test 升级** | i18n-page-side-consumption 加 key existence 检测；material-symbols-coverage 加 bare detection；STRICT_MODE 升级（advisory→strict 渐进）|

## §5 BL-073 Features 预案

| # | Feature | 估时 | executor |
|---|---|---|---|
| F001 | Material Symbols 8 漏补 manifest + 重生 woff2 + 同步路径 label | 0.5h | generator |
| F002 | subset script Pattern 7 (bare string in multi-line span) + false-positive 排除清单升级 | 1.5h | generator |
| F003 | BriefPageClient.tsx:120 删 max-w-3xl + 实测 staging 宽度对齐 + grep 全仓嵌套 max-w 防御 | 0.5h | generator |
| F004 | i18n `match.emptyState.body` 补 5 locale + 删孤儿 `tipHeading`/`tipBody` + 区分默认空/filter 空文案 + 同步扫 `weeklyReport.title` 等其他 MISSING | 1.5h | generator |
| F005 | i18n-page-side-consumption test v2 — 加 page.tsx 调 `t(key)` 实际 exist in messages 检测 | 1.5h | generator |
| F006 | filter UX 防御 — country / language filter 当数据层全 NULL 时 UI disable + 提示 (no data)；server side runMatchSearch 加 early-return 优化 | 2.5h | generator |
| F007 | material-symbols-coverage test 扩展 bare detection + STRICT_MODE flip 给 Material Symbols 维度 | 1h | generator |
| F008 | Reviewer L1+L2 staging 实测 + signoff doc | 3h | codex |

**总：** ~12h ≈ 1.5 day Generator + 0.5 day Reviewer

## §6 沉淀候选（done 阶段或 v0.9.24 batch）

5 条沉淀候选（与 BL-072 4 条候选合并入 v0.9.24 batch）：

1. **subset script Pattern 进化路径** v1 (quoted) → v2 (quoted + bare in multi-line span)；穷举 JSX pattern 模板
2. **spec acceptance "嵌套二级约束 grep 全仓"模板** — 视觉/i18n/CSS 类 acceptance 必加全仓 grep 防御嵌套
3. **i18n test v2 模板** — 不只 grep raw English，还验 page.tsx 调用 key 实际 exist
4. **prod error log 接告警** — MISSING_MESSAGE 多次出现但未触发告警，建议加 log-based alert
5. **STRICT_MODE 渐进升级路径** — advisory → strict flip 模板（先开特定维度 strict，逐步扩展）

## §7 BL-074 + BL-075 排队 backlog

- **BL-074-ia-v2**: 加 5 一级 nav "活动"，ADR-015 修订，sidebar path-rewrite 改，i18n nav.campaigns 5 locale，/campaigns 行内"Match KOL"快捷，~2-3 day。详 backlog.json BL-074 entry。
- **BL-075-kol-data-coverage**: apify-kol fork country/language 源头同步 OR 本地 kol-sync-daily.ts enrichment job (推断 from bio + video language)，~1-2 day。实际是 BL-062 backlog 起 batch。详 backlog.json BL-075 entry。

## §8 下一步

BL-073 done 后启 BL-074 / BL-075。建议顺序：

```
BL-073 (1.5 day) → BL-074 (2-3 day) → BL-075 (1-2 day)
~5-7 day 后 4 prod issues 全闭环 + IA v2 上线 + data coverage 修
```

或并行（需多 Generator agent 同时）：BL-074 (IA v2 / src/ + i18n) + BL-075 (kol-sync-daily.ts / scripts) 不冲突域，可同时跑。

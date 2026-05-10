# BL-063 isSaved 字段拆除 + 全量池切换 Spec

> **创建：** 2026-05-10 北京 / Planner johnsong
> **批次类型：** 普通批次（全部 executor:generator）
> **优先级：** P0（Phase 1 第一批，所有后续 BL-064+ 依赖）
> **预估工时：** ~3-5 day Generator + 1 day Reviewer
> **依赖：** ADR-013（已 lock）+ Phase 0 三文档（已 ack）
> **决策来源：** ADR-013-ai-native-product-pivot §Decision 第 2 条 / roadmap §3 BL-063

---

## §1 背景

ADR-013 lock 后，Phase 1 首批做 schema 层面的 isSaved 字段拆除。这是后续所有 AI native 重构（BL-064 顶层 IA / BL-065 Match 页 / BL-066 Campaign 详情页 AI 推荐主面板）的前提：**没有 isSaved 概念，campaign 加 KOL 才能从全量池来。**

### 触发事件链

1. 5/10 用户报告 `/campaigns/[id]` "添加 KOL" 按钮 disabled
2. Planner 调查根因：`runAvailableKolsForCampaign` (`src/lib/campaigns/detail.ts:209`) `WHERE isSaved=true AND deletedAt IS NULL`
3. prod SQL 实测：active_saved=0 / all_saved=4（全 yt 残留）
4. 表层 UX bug 暴露产品架构层问题（KOL 三态心智冗余）→ ADR-013 决议
5. 本批次 = ADR-013 Phase 1 落地的物质基础

### 当前 isSaved 字段使用面（实地审计）

`is_saved` 字段在 9+ 处 query 中使用作 filter，BL-060 时给所有这些点加固了 `deletedAt: null` 配套。本批次要把整个 isSaved 维度拆除：

| 文件 | 行号 | 当前用法 | 处理 |
|---|---|---|---|
| `src/lib/campaigns/detail.ts` | L209 `runAvailableKolsForCampaign` | `WHERE isSaved=true AND deletedAt IS NULL` | 改 `WHERE deletedAt IS NULL`（F001 quick-fix）|
| `src/app/[locale]/(app)/database/stats.ts` | L26 + L27-32 + L33-37 | 3 处 `isSaved=true` 过滤（QuickStats 用）| /database 整页删除（BL-064），本批次先去 isSaved filter |
| `src/lib/campaigns/list-kpis.ts` | L98 `valueScoreAgg` | `where: { isSaved: true, deletedAt: null }` | 移除 isSaved；保留 deletedAt: null |
| `src/lib/crm/overview.ts` | L209 `tx.kol.findMany` | KOL ids lookup with isSaved=true | 移除 isSaved |
| `src/lib/kol/filters.ts`（如有）| 待 grep | KOL list 默认 filter | 移除 |
| `src/app/[locale]/(app)/database/AddKolDialog.tsx` actions | `addKolAction` 创建 KOL `isSaved: true` | 移除字段写入 |
| `prisma/schema.prisma` | `Kol` 模型 | `isSaved Boolean` 字段定义 | F002 migration 移除 |
| 其它 grep 命中处 | - | - | 全清 |

---

## §2 业务目标

- 删除 `is_saved` 字段（schema + 9+ query + UI 写入）
- 现 prod 4 个 isSaved=true 残留数据安全迁移（已软删，迁移即删字段不影响业务）
- BL-064（顶层 IA 重做）启动前 schema 已 clean
- 内部团队 dogfood 流畅（F001 quick-fix 立即解 "添加 KOL 按钮 disabled" 问题）
- 不破坏现 e2e suite 功能（F004 测试更新覆盖）
- 不破坏 prod 业务连续性（F005 staging dry-run + F006 ops gated rollout）

---

## §3 范围（6 features）

### F001 quick-fix：detail.ts 去 isSaved filter（unblock 内部 dogfood）

**executor:** generator
**估时:** ~30min Generator + 0.2h Reviewer
**优先级:** P0（团队当下 dogfood 阻塞）

**Acceptance：**
- `src/lib/campaigns/detail.ts:209` `runAvailableKolsForCampaign` query 改：
  ```ts
  // before:
  where: { isSaved: true, deletedAt: null }
  // after:
  where: { deletedAt: null }
  ```
- `src/app/[locale]/(app)/campaigns/[id]/AddKolDialog.tsx` 加 disabled tooltip 文案"全量 KOL 池，AI native 完整版即将上线"+ 5 语言 i18n
- L1: lint 0 / tsc 0 / unit + integration test PASS（含 BL-061 既有 6 case）
- staging deploy + /api/health git_sha 一致
- 现 e2e database-fidelity.spec 中 "Bulk Action Bar / header CTAs" 等 cases 不受影响（F001 仅改 detail.ts 一行 + tooltip 文案）
- staging 实测：进 /campaigns/[id] 任一 campaign，"添加 KOL" 按钮 enabled（除非 campaign.status=completed）

### F002 schema migration: 删除 is_saved 字段

**executor:** generator
**估时:** ~3-5h Generator + 0.5h Reviewer

**Acceptance：**
- `prisma/schema.prisma` `Kol` 模型移除 `isSaved Boolean` 字段
- `prisma/migrations/202605XX_remove_is_saved_from_kol/migration.sql` 新建：
  ```sql
  -- 1. 数据备份（用于 ops 回滚）
  CREATE TEMP TABLE _bl063_is_saved_backup AS
    SELECT id, is_saved FROM kol WHERE is_saved=true;
  -- 2. 删除字段
  ALTER TABLE kol DROP COLUMN is_saved;
  ```
- migration ROLLBACK 注释：手动 ALTER TABLE ADD COLUMN is_saved + restore from backup
- `npx prisma migrate dev` staging 跑通
- prisma client 重新生成（Generator commit 含 prisma 自动生成的更新）

### F003 移除 9+ 处 query 的 isSaved filter

**executor:** generator
**估时:** ~5-7h Generator + 0.5h Reviewer

**Acceptance：**
- 全仓 grep `isSaved\|is_saved` 全清（除非在 BL-063 commit message / docs 引用）
- 9 处实测改造：
  - `src/lib/campaigns/detail.ts:209` `runAvailableKolsForCampaign`（F001 已改）
  - `src/lib/campaigns/list-kpis.ts:98` `valueScoreAgg`
  - `src/lib/crm/overview.ts:209` `tx.kol.findMany`
  - `src/app/[locale]/(app)/database/stats.ts` 3 处（L26/L27-32/L33-37）— 整文件待 BL-064 删除，本批次先去 filter
  - `src/lib/kol/filters.ts`（如 grep 命中）
  - `src/app/[locale]/(app)/database/actions.ts:106` `addKolAction` 移除 `isSaved: true` 字段写入
  - 其它 grep 命中处
- TypeScript 编译通过（删字段后所有引用必须清）
- L1 lint 0 / tsc 0

### F004 测试更新：移除 isSaved-related cases + 加全量池逻辑测试

**executor:** generator
**估时:** ~3-5h Generator + 0.5h Reviewer

**Acceptance：**
- 删除/调整以下测试中的 isSaved 相关 case：
  - `tests/integration/dashboard-kpi.test.ts`（BL-060 加的 3 case 含 isSaved 维度，重写为不依赖 isSaved）
  - `tests/integration/database-stats.test.ts`（BL-060 加的 2 case，整文件可能因 /database 待删而先标 deprecated）
  - `tests/integration/kpi-snapshot.test.ts`（BL-060 加的 1 case）
  - `src/app/[locale]/(app)/database/__tests__/addKolAction.test.ts`（移除 isSaved 期望）
- 加 ≥3 新 case 验证全量池逻辑：
  - `runAvailableKolsForCampaign` 返回所有非软删 KOL（独立 isSaved 状态）
  - `addKolAction` 创建 KOL 不再设 isSaved
  - schema 验证：is_saved 列不存在
- e2e suite：`database-fidelity.spec.ts` 因依赖 /database 整体删除（BL-064），本批次仅适配 isSaved 移除（如有 case 验证 isSaved=true 显示，删除）
- L1 全套 PASS

### F005 staging dry-run + 数据 audit

**executor:** generator
**估时:** ~2-3h Generator + 0.5h Reviewer

**Acceptance：**
- staging 跑 F002 migration（`npx prisma migrate deploy` on staging）
- staging SQL audit：
  ```sql
  -- 验证字段已删
  SELECT column_name FROM information_schema.columns
    WHERE table_name='kol' AND column_name='is_saved';
  -- 期望返回 0 行
  ```
- staging 跑 BL-061 F003 SQL 验证 engagement_rate 比例不退化（应仍 6.7%）
- staging 全量 e2e suite PASS（含 marketer-dashboard / database-fidelity / login-cinematic）
- staging /campaigns/[id] 实地访问，"添加 KOL" 按钮 enabled + 进入 dialog 显完整 KOL 池
- staging 数据 backup 验证：能从 _bl063_is_saved_backup 恢复（如需要）

### F006 prod migration ops（用户手动触发）

**executor:** generator
**估时:** ~1-2h Generator（含监控）+ 0.5h Reviewer
**前置：** F005 全 PASS + 用户 ack ops 时间窗

**Acceptance：**
- prod 数据 backup（pg_dump kolmatrix 或 ALTER TABLE 之前 SELECT）
- prod redeploy（GitHub Actions UI dispatch HEAD = main）— 由用户手动触发
- prod /api/health 返回 git_sha = main HEAD
- 自动 migration 跑通（deploy script 含 `npx prisma migrate deploy`）
- 24h 后 prod SQL audit：
  - `is_saved` 列不存在 ✓
  - `kol` 表行数无非预期变化 ✓
  - engagement_rate non_null_pct 不退化 ✓
- prod /campaigns/[id] 实地访问按钮 enabled + dialog 含全量池
- 写 `docs/test-reports/BL-063-signoff-2026-05-XX.md` 最终结论

---

## §4 风险

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F002 migration 在 prod 卡住（DROP COLUMN 锁表）| 低 | 高 | F005 staging 验证 + ops 时间窗选业务低峰 + backup 表保留 |
| F003 9+ 处 grep 漏掉某处 isSaved 引用 | 中 | 中 | TypeScript 编译会 surface（删字段后所有引用错）+ 全仓 grep 校验 |
| 现 prod 4 个 isSaved=true 残留数据迁移异常 | 低 | 低 | 这 4 个全是已软删 yt KOL，DROP 字段无业务影响（数据本身留作历史）|
| /database 测试因 isSaved 移除 fail | 中 | 低 | F004 删除/调整相关 case；/database 整页将在 BL-064 删除 |
| F006 prod redeploy 引入回归 | 中 | 高 | F005 staging 全量验证 + 用户 ack ops 时间窗 + 24h 监控 + rollback 方案（migration ROLLBACK + 重 redeploy 旧 sha）|

---

## §5 不变量（执行期间不得违反）

- **不动 ADR-013 Decision 6 条决议**（4 路由 IA / AI 主导 / B3 + C3 / 5/13 取消）— 本批次仅做 schema 拆除，不做 UI / IA 改动
- **不动 BL-061 已上线的 4 sed/awk hot-fix**（apify-kol-service 一致性）
- **不动 KOLMatrix mapper engagement_rate 公式**（fork §3.3 数学等价）
- **F006 prod migration 必须用户 ack 时间窗**（不得 auto-trigger）
- **F002 migration 必须含 ROLLBACK 注释 + 数据 backup 表**（生产事故兜底）

---

## §6 关联文档

- ADR-013-ai-native-product-pivot（决策源）
- docs/product/ai-native-vision.md（产品愿景，本批次为 §1 物质基础）
- docs/product/ai-native-roadmap.md §3 BL-063（本批次定位）
- BL-060 spec §3 9 处 isSaved+deletedAt 加固（本批次拆除范围）
- BL-061 BL-058 P0 sub-feature 关闭（本批次 prod migration 后 BL-058 整体归档）

---

## §7 后续 backlog 影响

本批次完成后下一批：
- **BL-064 顶层 IA 改造（7 → 4 路由）** — 直接依赖 BL-063 done（schema clean 后才做 IA）
- BL-065 Match 页（Phase 2 第一批）
- BL-066 Campaign 详情页 AI 推荐主面板（Phase 2 第二批）+ BL-048 valueScore 优化并行

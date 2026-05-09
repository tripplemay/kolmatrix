# BL-060 soft-delete-ui-filter-hotfix Spec

> **类型**: hotfix 批次（紧急 P0 — 5/13 上线前必修）
> **触发**: 用户 5/9 12:30 北京 实地观察「BL-059 切单源后仪表盘仍显示所有 KOL 数量，KOL 数据库页面仍能看到旧源 KOL 数量」
> **根因**: 多处 KOL query 直接调用 `tx.kol.count` / `findMany` / `aggregate` 但未显式加 `deletedAt: null` filter；BL-059 F003 soft delete 2584 youtube-api-daily KOL 后被暴露，UI 数据严重失真
> **关联前批次**: BL-059 F003（2584 youtube-api-daily soft delete）+ BL-051a（soft delete + audit_log 模式）
> **预估工时**: ~1.5h Generator + 0.5h Reviewer + 0.5h Planner ops = 总 ~2.5h
> **上线时间**: 5/9 当晚 done + prod redeploy（5/13 上线 buffer 4 天充裕）

---

## §1 背景与范围

### 1.1 用户报告（引用）

> "我们现在讨论其他的功能，KOL数据切换到单源之后，在仪表盘面板显示的还是所有KOL的数量，在KOL数据库页面能看到已保存的旧源的KOL数量"

### 1.2 prod 实测偏差（5/9 12:30 北京）

| 指标 | UI 当前显示 | 应有正确值 | 偏差 | 来源文件 |
|---|---|---|---|---|
| `/dashboard` kolCount | **2889** | **305** | +2584 leak（整 BL-059 F003 集合泄漏） | `src/app/[locale]/(app)/dashboard/data.ts:65` |
| `/dashboard` avgValueScore 分母 | 2889 | 305 | 平均分严重偏低 | `data.ts:72` |
| `/dashboard` topKols 候选池 | 含 2584 deleted | 仅 305 active | top-5 几乎全已删 | `data.ts:82` |
| `/database` QuickStats total | **4** | **0** | +4 leak（4 个 isSaved=true 的旧 yt KOL） | `database/stats.ts:26` |
| `/database` QuickStats activeCollabs | 0 | 0 | 巧合无偏差，但仍缺 filter | `stats.ts:27` |
| `/database` QuickStats avg/sum | 偏 | — | 含 4 个 leak | `stats.ts:33` |
| BL-050 trend cron 写入 | 含 +2584 leak | 应正确 | 每日累积污染趋势线 | `src/lib/dashboard/kpi-snapshot.ts:52,56` |

### 1.3 不在范围

- **次要查询的 P1 一致性**（campaigns/list-kpis.ts L98 / campaigns/detail.ts L209 / crm/overview.ts L209）：BL-059 F003 实际不影响（这些 query 通过 `kolCampaigns` 关联，系统种子 KOL 没有 campaign 关系），但**仍纳入本批次**作一致性补丁，避免未来类似事故
- **outreach/suppression/page.tsx:78**：故意不 filter（要看历史退订记录），**不修**
- **走 buildKolWhere 的 query**（discovery/search.ts:96 / database/search.ts:89 / database/export-csv:104）：filters.ts:413-415 已含 `deletedAt: null` filter，**已正确**
- **by-id 单条查询**（kols/[id]/、outreach/、crm/update.ts）：按 id 拉单条，UI 上下文已知，**不需修**

### 1.4 修复策略

**就地添加 filter，不引入抽象**。每处 query 加 `deletedAt: null` 到既有 where 子句，单行变更。理由：
- 每处语义略不同（`isGaming` / `isSaved` / `kolCampaigns.some` 等），强行抽象会增加复杂度
- buildKolWhere 是 discovery filter helper，加进 dashboard/database stats 会 leak 不相关参数
- hotfix 性质应最小变更，便于 Reviewer 评估

---

## §2 features 拆分（5 个 generator features）

### F001 dashboard/data.ts query filter（P0 user-visible）

**修改范围（3 处 query）**:
- `data.ts:65` `tx.kol.count` 加 `deletedAt: null`
- `data.ts:72-75` `tx.kol.aggregate` 加 `deletedAt: null`
- `data.ts:82-86` `tx.kol.findMany` 加 `deletedAt: null`

**单元测试**: 在 `__tests__/dashboard-data.test.ts`（如不存在则创建）增 case：
- 3 个 active KOL + 2 个 soft deleted + 1 个 isGaming=false → kolCount=3
- avgValueScore 仅算 active
- topKols 候选池仅 active

**验收**:
- L1 PASS
- prod SQL: `SELECT COUNT(*) FROM kol WHERE is_gaming=true AND deleted_at IS NULL` = 305 与 dashboard kolCount 一致

### F002 database/stats.ts query filter（P0 user-visible）

**修改范围（3 处 query）**:
- `stats.ts:26` total `tx.kol.count` 加 `deletedAt: null`
- `stats.ts:27-32` activeCollabs `tx.kol.count` 加 `deletedAt: null`
- `stats.ts:33-37` aggregate 加 `deletedAt: null`

注意 L95-103 `loadCoverageGapSummary` 已含 `deletedAt: null`（不需改动）。

**单元测试**: 在 `__tests__/database-stats.test.ts`（如不存在则创建）增 case：
- isSaved=true 但 deletedAt IS NOT NULL 的 KOL 不计入 total
- 同样不计入 aggregate（avgValueScore / followerReach）

**验收**:
- L1 PASS
- prod SQL: `SELECT COUNT(*) FROM kol WHERE is_saved=true AND deleted_at IS NULL` = 0 与 /database QuickStats total 一致

### F003 dashboard/kpi-snapshot.ts query filter（P0 trend cron）

**修改范围（2 处 query）**:
- `kpi-snapshot.ts:52` `tx.kol.count` 加 `deletedAt: null`
- `kpi-snapshot.ts:56-58` `tx.kol.aggregate` 加 `deletedAt: null`

**单元测试**: 在 `src/lib/dashboard/__tests__/kpi-snapshot.test.ts` 既有测试增 case：
- soft deleted KOL 不计入 snapshot.kolCount
- 同样不计入 avgValueScore aggregate

**验收**:
- L1 PASS
- 5/9 当晚 prod redeploy 后下次 daily cron（默认 02:00 UTC = 北京 10:00）写入的 kpi_daily_snapshot 行 kolCount = 305（或当时 active 数）

**SQL ops（一并做）**: 清理 BL-050 历史污染数据：

```sql
DELETE FROM kpi_daily_snapshot
WHERE snapshot_date >= '2026-05-08'  -- BL-059 F003 soft delete 当日及之后
  AND kol_count > (SELECT COUNT(*) FROM kol WHERE deleted_at IS NULL AND is_gaming = true);
```

> **注**: 实际只有 5/8 + 5/9 两行可能受污染，删除后下次 cron 重写。spec §6 验收时确认。

### F004 P1 一致性补丁（campaigns + crm 三处）

**修改范围（3 处 query）**:
- `src/lib/campaigns/list-kpis.ts:98` `tx.kol.aggregate` 加 `deletedAt: null`
- `src/lib/campaigns/detail.ts:209` `tx.kol.findMany` 加 `deletedAt: null`
- `src/lib/crm/overview.ts:209` `tx.kol.findMany` 加 `deletedAt: null`

**单元测试**: 既有测试 + 增 1 case 验证 soft deleted KOL 不计入。

**验收**: L1 PASS（BL-059 F003 实际无影响，仅一致性）

### F005 SQL ops 清理 4 个 is_saved leak + L1 + staging smoke

**SQL ops**:
```sql
-- 清理 BL-059 F003 soft delete 时遗留的 is_saved=true 数据
UPDATE kol
SET is_saved = false, updated_at = NOW()
WHERE is_saved = true AND deleted_at IS NOT NULL;
-- 期望: 4 rows updated（prod 实测）
```

**审计 log**: 走 audit_log 表记录批量更新（参考 BL-059 F003 模式）：
```sql
INSERT INTO audit_log (tenant_id, actor_user_id, action, resource_type, resource_id, payload, created_at)
SELECT
  tenant_id,
  NULL,                              -- 系统操作
  'kol.bulk_unset_is_saved',
  'kol',
  id::text,
  jsonb_build_object('reason', 'BL-060-F005 cleanup is_saved leak after BL-059 F003 soft delete', 'previous_is_saved', true),
  NOW()
FROM kol
WHERE is_saved = true AND deleted_at IS NOT NULL;
```

**L1 全套**:
- `npm run lint` 0 errors
- `npx tsc --noEmit` 0 errors
- `npm test` 全 PASS

**Staging smoke**:
- staging deploy 走 deploy-staging.sh
- /api/health healthy
- /en/dashboard kolCount 与 SQL `COUNT(*) WHERE is_gaming=true AND deleted_at IS NULL` 一致
- /en/database QuickStats total 与 SQL `COUNT(*) WHERE is_saved=true AND deleted_at IS NULL` 一致
- prod SQL ops（F005）在 staging schema 演练通过后，prod redeploy 后用户手动跑

---

## §3 验收 DoD

完成所有 features 后必须满足：

| # | 检查 | 期望 | 验证方式 |
|---|---|---|---|
| 1 | F001-F004 7 处 query 全含 `deletedAt: null` | 全 ✓ | grep 全仓 query + manual review |
| 2 | L1 PASS | lint 0 / tsc 0 / npm test 全 PASS | npm run lint && npx tsc --noEmit && npm test |
| 3 | staging /dashboard kolCount = SQL 真实 active is_gaming 数 | ✓ | curl + SQL diff |
| 4 | staging /database QuickStats total = SQL 真实 active is_saved 数 | ✓ | curl + SQL diff |
| 5 | F005 SQL ops 在 prod 跑成功，4 行 is_saved=false update + 4 行 audit_log insert | ✓ | prod psql 验证 |
| 6 | F003 cron 在 5/10 02:00 UTC 跑后 kpi_daily_snapshot 新行 kolCount 正确 | ✓ | 5/10 北京 10:00 验证 |
| 7 | Reviewer signoff PASS | docs/test-reports/BL-060-...-signoff.md | Codex 验收 |

---

## §4 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F005 SQL ops 误更新非预期行 | 低 | 数据丢失 | WHERE 子句严格 `is_saved=true AND deleted_at IS NOT NULL`，不动 active KOL；BEGIN/COMMIT 事务回滚保护 |
| 未来新增 KOL query 仍忘加 filter | 中 | 同类 leak 重现 | 长期可考虑 Prisma middleware（auto-inject `deletedAt: null`），但本批次不做（避免引入新 abstraction） |
| F003 历史 kpi_daily_snapshot 删除影响图表 | 低 | 5/8-5/9 趋势点缺失 | 用户接受（污染数据不如缺失）；下次 cron 自动补 |

---

## §5 上线时间线

```
5/9 12:30 北京 — 用户报告 + Planner 调研 + 起 spec ✓
5/9 13:00      — Generator 接力 building（5 features ~1.5h）
5/9 14:30      — staging deploy + smoke
5/9 15:00      — Reviewer (Codex) 验收 ~0.5h
5/9 16:00      — DONE + prod redeploy
5/10 10:00 北京 — 验证 cron 写入 kpi_daily_snapshot 正确
5/13           — 上线对外（buffer 4 天，UI 数据已准确）
```

---

## §6 不变量（决议 lock）

- **不引入 buildKolWhere 之外的 helper**（避免 abstract creep；hotfix 局部修）
- **不动 outreach/suppression**（故意要看历史退订记录）
- **不动 by-id 单条查询**（kols/[id]/、outreach/、crm/update.ts — 单条按 id 拉，无 leak 风险）
- **F004 一致性补丁** 与 P0 三处一同提交（避免未来类似事故；BL-059 F003 实际无影响）
- **F005 SQL ops 在 staging 演练通过后 prod 跑**（用户手动触发，符合 BL-051a soft delete 模式）

---

## §7 关联文档

- `docs/specs/BL-059-youtube-deprecate-and-engagement-derive-spec.md` — 触发本批次的 F003 soft delete
- `docs/specs/BL-051a-...-spec.md` — soft delete + audit_log 模式参照
- `src/lib/kol/filters.ts:413-415` — buildKolWhere 正确范本（含 deletedAt: null）
- BL-058 backlog — fork totalLikes 缺失（与本批次无关，并行推进）

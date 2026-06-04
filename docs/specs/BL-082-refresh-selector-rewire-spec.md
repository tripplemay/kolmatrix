# BL-082 refresh-selector 重接 (Dir A) Spec

> **Sprint：** BL-082-refresh-selector-rewire
> **Type：** Data pipeline 重接（BL-059 单源重构遗留的 refresh phase 重新接线）
> **预估工时：** ~10h Generator + 1.5h Reviewer
> **关联：** BL-081 F004 audit `docs/audits/BL-081-refresh-selector-audit.md` (含 O1-O3 验证) / `scripts/kol-sync-daily.ts:199` / `src/lib/kol-sync/refresh-selector.ts` / `src/lib/kol-sync/dispatcher.ts:107`
> **状态：** A0 audit done (BL-081 F004) / A1 4 子决策 lock 6/04 → 待 building
> **依赖：** BL-081 done (已满足 @ bl081-done tag)，无功能依赖

---

## §1 背景与触发

### 1.1 触发

BL-081 F004 audit 确认 `refresh=0` 是 BL-059 单源重构时移除 refresh phase 的遗留产物，非 bug 但是治理债：
- `refreshCount: 0` 是 `scripts/kol-sync-daily.ts:199` 的 hard-coded literal
- `runDaily()` 完全不调用任何 refresh path
- `fetchTieredRefreshIds` 在 production 有 0 caller (孤儿死代码)
- 但基础设施完整：`KolSyncDispatcher.runRefresh()` (`dispatcher.ts:107`) + `ApifyKolSyncAdapter.refresh()` (`adapters/apify-kol.ts:199`) 均存在 + 已测

### 1.2 根因 + O3 验证

| 维度 | 实证 |
|---|---|
| **fork endpoint 工作** | 6/04 SSH prod 用 real channel handle `UC22GlzN_jFaGLhiO-8ZM7Gw` → `GET /kol/youtube/<handle>` 返 **HTTP 200** + 完整 2848-byte KOL object（platformUserId/displayName/bio/avatarUrl 等） |
| **externalId 格式确认** | `parseRefreshId` 期望 `<platform>:<platformUserId>` 格式，YT 平台 platformUserId = channel handle (UC...)，匹配 KOL.handle 字段 |
| **404 = endpoint exists, id missing** | fake "test123" 和 fork DB row id "20289" 都 404，但 real handle 200 → confirms endpoint 存在 |
| **影响紧迫性** | BL-081 O2 staleness 显示 `<7d:2371 / never:12`，全靠 `discover()` 顺带保鲜。data-quality 长期事项，非 outage |

### 1.3 A1 子决策 lock (6/04)

| 决策 | Lock |
|---|---|
| **Tiered selector** | 保留 BIx-F004-P3 `fetchTieredRefreshIds` (tier-based cadence, value/freshness 加权) — 0 代码改动只接线 |
| **MAX_TOTAL_REFRESH** | 调 200/天 → **500/天** (prod 2371 active KOL → ~5 天轮刷一遍，quota cost +$5/月可接受) |
| **调用顺序** | Sequential: `discover → import → refresh → import` (避免 tx 冲突，refresh 拿到 discover 后的最新状态) |
| **404 策略** | Skip + log，沿用 `adapter.refresh()` 现有 404 handling (`apify-kol.ts:213`)，audit_log 加 `kol.refresh_404_skip` event |

### 1.4 角色分配

`role_assignments = null` (默认映射: Generator + Codex Reviewer)

### 1.5 全平台 re-scope (6/04 — Generator pre-impl 发现 + 用户决定 B)

**触发：** F001 开工前 Generator 实测 prod fork endpoint，发现 A1 「只接线」前提对 TT/IG 不成立：

| 平台 | KOL 数 | `/kol/<platform>/<platformUserId>` | platformUserId 在 KOLMatrix？ |
|---|---|---|---|
| YouTube | 722 | `UC...` → **200** | ✅ 凑巧 = `KOL.handle` |
| TikTok | 1479 | 数字 `6766325527592272902` → **200** | ❌ handle=username; mapper 丢弃 platformUserId |
| Instagram | 179 | 数字 `80506142364` → **200** | ❌ 同上 |

- `fetchTieredRefreshIds` 原返 `external_id`（数字 fork 行 id，0/2383 含 `:`）→ `parseRefreshId` 全 null → refresh 全 404。必须改用 `<platform>:<platformUserId>`。
- fork **三平台都支持** refresh，但 KOLMatrix 只对 YT 存了 platformUserId（=handle）。TT/IG（70% 池子）的 platformUserId 被 mapper 丢弃。
- O3 原 pre-flight 只测了 1 个 YT handle，没暴露此 gap。

**用户决定（B）：** 扩 BL-082 到全平台 + 授权 Generator 直接改 spec/features。新增 platformUserId 存储前置块（schema + mapper + 回填），features 由 6 条扩为 **7 条**：

| F | 范围 |
|---|---|
| **F001** | platformUserId 存储: `platform_user_id` 列 + migration + mapper 持久化 + import upsert |
| **F002** | 存量回填 `platform_user_id`（遍历 fork discover 按 external_id 匹配） |
| **F003** | runDaily 接 refresh phase（`<platform>:<platformUserId>` ids）+ refreshCount 真实计数 + MAX 500 |
| **F004** | 单测扩充 + daily-sync e2e mock |
| **F005** | audit_log `kol.refresh_404_skip` |
| **F006** | Staging 部署 + 回填 + 24h 监控 |
| **F007** | Codex Reviewer L1+L2 + signoff |

依赖顺序：F001(schema/mapper) → F002(回填) → F003(接线) → F004(测试) → F005(404log) → F006(staging) → F007(codex)。§2.1 IN-SCOPE + §3 phase 表以本 §1.5 为准（原文保留作历史）。

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- **F001** `scripts/kol-sync-daily.ts` `runDaily()` 加 refresh phase: discover→import 后 loop apify-kol platforms → `fetchTieredRefreshIds(prisma, {tenantId, platform})` → `dispatcher.runRefresh(ids)` → import refreshed rows
- **F002** `scripts/kol-sync-daily.ts:199` `refreshCount: 0` hard-code 删除，改真实计数；`MAX_TOTAL_REFRESH=200 → 500` (`src/lib/kol-sync/refresh-selector.ts`)
- **F003** 单测扩充: refresh-selector.ts + daily-sync e2e mock 覆盖 refresh phase
- **F004** audit_log: 新 action `kol.refresh_404_skip` payload `{externalId, platform, reason}`，方便后续 tombstone 治理
- **F005** Staging deploy + 24h 监控 (refreshCount 非 0 / lastSyncedAt 分布变化 / 无 daily-sync errors regression)
- **F006** Codex Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE

- KOL tombstone / soft-delete 机制 (404 不写 `status=inactive`)，仅 audit_log 记
- refresh-selector tier 算法重新设计 (沿用 BIx-F004-P3，仅调阈值 200→500)
- BL-081 country/retry-storm 任何代码 (已 done，正交)
- fork apify-kol-service 端任何代码改动 (跨团队)
- 删除 `refresh-selector.ts` 死代码 (Dir A 重新激活它)

### 2.3 不变量

1. **不破坏现有 daily-sync 主路径**: discover/import 行为 0 变化，refresh 只新增 phase
2. **404 不阻塞 batch**: 单个 404 跳过 + 下个 id 继续，整 batch 失败率与 BL-076 import.ts try/catch 一致
3. **refresh 与 BL-081 attempted_at gate 兼容**: refresh-import 写入路径触发 enrichment-stage 时同 BL-081 F003 行为（country present 即标记 attempted_at, 不重扫）
4. **MAX_TOTAL_REFRESH 500 后 daily quota 不破**: fork 端 `GET /kol/<platform>/<userId>` 单次约 1 quota unit，500/天 ≤ 15000/月 quota，远低于现有 budget
5. **0 业务路径破坏**: discovery / match / database / weekly-report 等下游对 KOL 字段读取语义不变

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | BL-081 F004 audit + O1-O3 验证 | ✅ done |
| **A1** | 4 子决策 lock | ✅ done |
| **B** | F001 `runDaily()` 接入 refresh phase | 2.5h | Generator |
| **C** | F002 `refreshCount` 真实计数 + `MAX_TOTAL_REFRESH=500` | 1h | Generator |
| **D** | F003 单测扩充 + e2e mock | 2h | Generator |
| **E** | F004 audit_log `kol.refresh_404_skip` event | 1h | Generator |
| **F** | F005 staging deploy + 24h 监控 | 2h | Generator |
| **G** | F006 Reviewer L1+L2 + signoff | 1.5h | Codex |

**Critical path：** B → C → D → E → F → G (顺序依赖 — refresh phase 接入是其他 features 的前置)

---

## §4 验收门槛 (5 dimensions)

### 4.1 功能正确性

- F001 `runDaily()` log 显式有 refresh stage start/end events
- F001 refresh phase 在 import 之后调用 (sequential)
- F002 `refreshCount` 非 0 (取决于 prod KOL 数量 + tier cadence)
- F003 单测扩充 ≥5 case：(1) refresh-selector tier sort 正确 (2) `MAX_TOTAL_REFRESH=500` cap 生效 (3) daily-sync e2e mock 验证 refresh phase 被调 (4) 404 skip 不抛 (5) refresh→import 写入正确字段
- F004 audit_log `kol.refresh_404_skip` 抽样：404 事件被记录且不阻塞主流程

### 4.2 量化提升

- Staging F005 跑 24h 后 daily-sync log `refreshCount` 期望 100-500 (取决于 staging KOL 数量)
- Prod 部署后 next-7d 监控 `lastSyncedAt >30d` 行数应趋近 0 (BL-081 O2 当前已 0，预期保持)
- Prod refresh 404 比例 ≤5% (验证 fork endpoint 健康)

### 4.3 成本影响

- 当前：refresh phase 不存在，0 quota cost
- 重接后：500 calls/天 × ~1 quota unit = 500 quota units/天 ≈ 15K/月 ≈ +$5/月
- 远低于现有月度 budget ($100)

### 4.4 数据完整性

- refresh 写入路径不引入 numeric overflow (BL-076 import.ts try/catch 保护)
- refresh 写入触发 BL-081 attempted_at gate 时不重打 LLM (country 存在即 stamp)
- 现有 KOL 行 `external_id` 字段不变 (refresh 只 update follower/engagement 等业务字段)

### 4.5 framework / 文档

- `framework_reviewed` 由 F006 done 收尾决定（无 propose 内容则 true）
- `docs/dev/kol-sync-runbook.md` 加 §"daily refresh phase" 段说明
- 不需 ADR (BIx-F004-P3 设计已存在，本批次仅接线)

---

## §5 风险与已知边界

| 风险 | 缓解 |
|---|---|
| **MAX_TOTAL_REFRESH 500 quota 突破 fork 上游限制** | F005 staging 跑 24h 监控 fork 端日志；如 fork 上游 throttle 立即降回 200 |
| **refresh 404 比例过高指示 fork 数据 drift** | F004 audit_log + F005 prod 24h 监控；404>5% 立 hotfix 调查 fork |
| **refresh 写入与 discover 写入交叉污染** | Sequential 调用 + Prisma upsert 自带原子性，BL-076 import.ts try/catch 保护 |
| **refresh-selector tier 算法可能在新 KOL pool 上失效** | F003 单测 + Generator 实地 grep prod KOL 验 tier 分布；如失衡退到 lastSyncedAt-asc fallback (out-of-scope，留独立 batch) |
| **prod KOL pool 增长后 500/天 不够** | KPI 监控 `lastSyncedAt >30d` 行数，>0 时调高阈值（独立 batch） |

---

## §6 完成定义 (DoD)

- [ ] F001-F005 全 PASS (features.json acceptance)
- [ ] F006 Reviewer signoff `docs/test-reports/BL-082-signoff-2026-06-XX.md` 含 L1/L2 实测
- [ ] Staging 跑 24h 后实测 refreshCount ≥100 + 0 daily-sync errors
- [ ] Prod 部署后 next-7d 监控 refreshCount 稳定 + 404 比例 ≤5%
- [ ] commit message 含 `feat(BL-082-F00X):` 标签对应 features.json
- [ ] `docs/dev/kol-sync-runbook.md` 更新

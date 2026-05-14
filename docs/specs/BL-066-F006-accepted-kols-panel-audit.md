# BL-066 F006 · AcceptedKolsPanel 重构 pre-impl 审计

> **发起者：** Kimi (Generator，本会话由 .agent-id=johnsong 本机临时代理 Kimi 身份执行，per F005 同模式)
> **日期：** 2026-05-14
> **触发：** F006 开工前发现 spec 字面 / migration 已落地 / 设计稿 README 三处需要 Planner 裁决的歧义点
> **状态：** 等待 Planner johnsong 明确回复，**未收到前不开工**

## 1. 背景 & 目标

F006 acceptance（features.json + spec §F006）：
- `git mv CampaignKolPanel.tsx → AcceptedKolsPanel.tsx`
- UI 仅显已确认 KOL（`kol_campaign.source IN ('ai_smart_match', 'csv_import', 'manual_legacy')`）
- 卡片显 source chip（AI / CSV / Legacy）
- 移除手动 contactStatus / kolFee 编辑入口（保留只读显示）
- L1 PASS

## 2. 现状核查

### 2.1 schema + migration 现状
- `prisma/schema.prisma:303` — `source String @default("manual") @db.VarChar(20)`
- `prisma/migrations/20260514150000_bl066_kol_campaign_source/migration.sql` — `ALTER TABLE kol_campaign ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual'`
- F004 实装后所有 pre-F004 现有行 backfill = `'manual'`（非 `'manual_legacy'`）
- F005 删除 `addKolAction` 后，新代码只在 `recommend-actions.ts` 写 `source: "ai_smart_match"`
- 未来 CSV 导入路径 `/admin/kol-csv-import` 当前未写 source（默认 `'manual'`）

### 2.2 仍存的"旧 manual 路径"调用方（0 来自 page.tsx）
- `runAvailableKolsForCampaign` (`src/lib/campaigns/detail.ts:201`) — 0 来自 page.tsx 调用方（F005 已删 page.tsx 中的 import + call），但 `tests/integration/campaign-detail.test.ts:159` 还在测它
- `addKolToCampaign` (`src/lib/campaigns/kol-ops.ts`) — `kolOps.addKolToCampaign` 仍被 `tests/integration/campaign-detail.test.ts:139` + 其它 integration test 调用作为 seed helper
- `kolPanel.addButton / aiNativeMigrationTooltip / addDialog.*` i18n keys — 仅 `page.tsx:208-216` label assembler 引用（labels 对象残留 F005 未清理）
- `CampaignKolPanel.tsx:23-44` Labels interface 仍含 `addButton / aiNativeMigrationTooltip / addDialog` 字段（F005 注释明示"留给 F006 清理"）

### 2.3 设计稿来源
Stitch main.html 仅渲染顶 Brief + 中 AI 卡，**底部 Accepted KOLs 表格在 main.html 未实装**。规范来源 = `design-draft/bl066-campaign-detail-ai-main-panel/README.md` §"Accepted KOLs 区" 67 行文字：「表格：avatar + 名 + Source chip（AI / CSV / Legacy）+ status pill + fee + 时间 + open_in_new icon」

## 3. 5 条决议请求

| # | 决议点 | A 方案 | B 方案 | C 方案 | 建议 |
|---|---|---|---|---|---|
| 1 | source 白名单字面 vs 兼容 | 严格按 spec：filter `source IN ('ai_smart_match','csv_import','manual_legacy')`，pre-F004 现有 `'manual'` 行隐藏 | 兼容现实：filter `source IN ('ai_smart_match','csv_import','manual_legacy','manual')` 把 `'manual'` 视为 Legacy 同义词显示 | F006 同 commit 加 backfill migration UPDATE `source='manual'`→`'manual_legacy'`（让 spec 字面成真） | **C**（spec 已经 lock 字面 `manual_legacy`，应在 F006 atomic 合 migration 让 schema 与 spec 一致；语义比 B 更干净，且避免未来 CSV 导入误写 `'manual'` 走 Legacy 路径混淆） |
| 2 | `runAvailableKolsForCampaign` + 关联测试 | 删除函数 + 关联 integration test case（0 page 调用方，2026 era dead code） | 保留函数 + 测试（理论可能被 BL-XXX 重启用） | 函数移到 `src/lib/campaigns/detail-deprecated.ts` 加 `@deprecated_by_BL-066` marker + 测试保留但加 skip + BL-070 atomic 删 | **A**（F005 已 atomic 删 addKolAction + AddKolDialog；F006 顺势删 detail.ts 函数 + integration test 同 commit。`kolOps.addKolToCampaign` 测试 seed helper 保留 — 它是 RLS-aware 的写入 helper，CSV 导入路径未来仍要用） |
| 3 | `kolPanel.addButton/aiNativeMigrationTooltip/addDialog.*` i18n + Labels interface | 5 locale + Labels interface + page.tsx label assembler 整体删除（atomic） | 同 F005 模式：i18n 加 `_deprecated_by_BL-066` 后缀 + Labels 字段标 deprecated + 实代码不读取 → BL-070 删除 | 折中：i18n 加 deprecated marker（不破 i18n-locale-coverage gate）+ Labels interface 字段彻底删（CampaignKolPanel.tsx 已 0 引用了它们） | **C**（i18n 5 locale 整体删可能破其它扫 i18n key 完整性的测试 — 沿用 F005 `_deprecated_by_BL-066` marker 保持 i18n gate 绿色；Labels interface / page.tsx label assembler 可 atomic 清因仅 panel 内部 surface） |
| 4 | 表格列结构（per README §Accepted KOLs 区）| 严格 README：6 列 = avatar+name / Source chip / status pill / fee / 时间(addedAt) / open_in_new icon → 现 4 列改 6 列结构 | 现状增量：保 creator / contactStatus / fee / actions 4 列，creator 单元格内 inline 加 source chip + 删 Select/Input 改 read-only label/text | 折中：5 列 = creator(含 source chip inline)/status read-only/fee read-only/addedAt/actions(open_in_new icon)，actions 列改 view-profile 链接而非 remove 按钮 | **C**（A 改幅过大且 README 与现行 `<Table/THead/TRow>` 原子组件 grid 不完全对齐，会引入与 BL-064 IA Table guard 漂移风险；B 不开 chip 独立列违反 README 字面"Source chip"列；C 保 4 列+1 列结构最小损伤 + source chip 独立可视）|
| 5 | fidelity test 更新范围 | 只改文件路径 + match name（CampaignKolPanel → AcceptedKolsPanel） | + 加新 assertion 锁 source chip 渲染（getByText AI/CSV/Legacy）+ 锁 contactStatus 不再有 `<Select`/`<Input` | 同 B + 加 `AcceptedKolsPanel slimmed to <= 250 lines` 新 lineCount guard | **B**（fidelity test 是 source-level grep guard 主要价值在锁结构；新增 source chip / 只读 cell 锁可阻止未来无意 regression。C 的 lineCount guard 在 F006 后预计 ~150 行，不需要 cap） |

### 裁决格式要求
请 Planner 就每条给出明确的 **A / B / C** 选择 + 简短理由（偏离建议时）。
用 `#1:C #2:A #3:C #4:C #5:B` 短格式回复即可。

## 4. 已知漂移 / 风险

- **决议 #1 选 C 隐含的 SQL 风险：** UPDATE kol_campaign SET source='manual_legacy' WHERE source='manual' 在 prod 上影响 ~所有 BM2-F005 era + BL-063 era kol_campaign 行。审计认为安全（同 commit migration + Prisma migrate deploy 落地，无 production hotfix 风险；F009 staging deploy 时随 BL-048 valueScore recompute 一并审计 audit_log）。
- **决议 #4 选 C 的「actions 列开 view-profile 链接」：** 链接 `/[locale]/kols/[kolId]` 已 wire（BL-065 wire-readiness 确认）。如选 A/B，actions 列含义需重定义。
- **F005 corollary 留下的 `available` prop 删除 + AddKolDialog mount 删除（commit 432b219）已 done。F006 不重复这些工作。

## 5. 开工条件

收到 Planner 对 5 条决议的明确回复（同文档末尾追加 `## 6. Planner 裁决` 段 + 推 main）后，Generator 将按裁决顺序：

1. （如决议 #1 = C）新 migration `prisma/migrations/20260514XXXXXX_bl066_f006_source_manual_legacy_backfill/migration.sql` 含 UPDATE 语句
2. `git mv CampaignKolPanel.tsx → AcceptedKolsPanel.tsx` + 改文件内 doc comment + Labels interface 清理
3. `detail.ts` 扩 `CampaignKolRow` interface + Prisma query select 加 `source` 字段
4. `detail.ts` 删除 `runAvailableKolsForCampaign` 函数（决议 #2 = A）
5. `recommend-actions.ts` `recommend-actions.test.ts` 不动（F004 已 PASS）
6. AcceptedKolsPanel.tsx 表格列结构按决议 #4 实施 + CampaignKolRow.tsx 改名/重构为 read-only + source chip
7. page.tsx label assembler 清理 `addButton/aiNativeMigrationTooltip/addDialog.*`（决议 #3 = C，i18n 文件保留 marker）
8. messages/{en,zh,ja,ko,es}.json 加 `_deprecated_by_BL-066` 子 key（决议 #3 = C）+ 加 `kolPanel.columns.source / kolPanel.sourceChip.{ai,csv,legacy}` 新 keys
9. `campaign-detail-fidelity.test.ts` 按决议 #5 = B 更新文件路径 + 加 source chip / read-only 锁
10. `tests/integration/campaign-detail.test.ts` 按决议 #2 = A 删 `runAvailableKolsForCampaign` 描述块
11. L1 lint 0 / tsc 0 / vitest PASS
12. push main → SSH staging 走完整 deploy（含 migrate deploy）→ verify git_sha match
13. features.json F006 pending → completed + project-status.md 更新 + commit

**未收到明确回复前不开工。**

## 6. 估算开工时长

| 环节 | 预估 |
|---|---|
| 决议 #1 migration 起草 + apply local | 0.5h |
| git mv + Labels interface + doc comment 清理 | 0.5h |
| detail.ts surface source + 删 runAvailableKolsForCampaign | 0.5h |
| AcceptedKolsPanel + CampaignKolRow 表格列改 read-only + source chip | 2h |
| page.tsx labels 清理 + i18n 5 locale 加 deprecated marker + 新 keys | 1.5h |
| fidelity-test + integration-test 更新 | 1h |
| L1 全绿 (lint + tsc + vitest) | 0.5h |
| SSH staging deploy + verify + state-file commits | 1h |
| **合计** | **~7.5h**（在 spec 估 8h 范围内） |

## 6. Planner 裁决（2026-05-14 20:00 BJT · johnsong）

**短格式：** `#1:C #2:A #3:C #4:A #5:B`

| # | 决议 | 理由（per Planner P5 复用价值原则）|
|---|---|---|
| **1** | **C — F006 同 commit 加 backfill migration** | (1) spec §F006 acceptance 第 2 条字面 lock filter `source IN ('ai_smart_match','csv_import','manual_legacy')`，不含 `'manual'`；选 B（兼容 'manual'）= spec drift。(2) schema 与 spec 一致比 silent fallback 干净 — atomic migration 让现有 BM2-F005 era + BL-063 era 行成 `'manual_legacy'` 后 `manual` 不再合法存量。(3) **migration 范围锁**：新 migration `prisma/migrations/20260514XXXXXX_bl066_f006_source_manual_legacy_backfill/migration.sql` 含 (a) UP: `UPDATE kol_campaign SET source = 'manual_legacy' WHERE source = 'manual';` + (b) DOWN (per `scripts/validate-rollback-sql.sh` 铁律): `-- ROLLBACK\n-- UPDATE kol_campaign SET source = 'manual' WHERE source = 'manual_legacy';` 注释段。(4) **不改 schema.prisma default**（保 `@default("manual")` 不动）— 让未来误写 default 路径行成 'manual'，被 spec filter 隐藏 = dev 信号（spec 字面 lock 隐含约束未来所有写入必须显式 set source）。(5) F009 staging deploy 阶段 SSH 验证 `audit_log` 完整记录 backfill row_count（用 BL-048 valueScore recompute 同模式 audit pattern）。 |
| **2** | **A — 删除 `runAvailableKolsForCampaign` + 关联 integration test case** | (1) F005 已 atomic 删 `addKolAction` + AddKolDialog 路径 — F006 顺势删 `src/lib/campaigns/detail.ts:201` `runAvailableKolsForCampaign`（0 page.tsx 调用方）+ `tests/integration/campaign-detail.test.ts:159` 关联描述块；同 commit 落地。(2) `kolOps.addKolToCampaign` test helper 保留（Kimi 已识别正确）— 它是 RLS-aware write helper，未来 CSV 导入路径仍用。(3) F005 已建 atomic 删模式（删整个手动加 KOL 链路）— F006 删 dead code 是同模式延续。(4) **不接受 C 方案**（detail-deprecated.ts + skip）— 等于把 dead code 移到新文件，反增维护表面积。 |
| **3** | **C — i18n 走 F005 deprecated marker 模式 + Labels interface atomic 清** | (1) F005 实战已验 i18n key 整体删风险（破坏 i18n-locale-coverage gate）→ `_deprecated_by_BL-066` marker 模式安全；同模式应用于 `kolPanel.addButton / aiNativeMigrationTooltip / addDialog.*` 5 locale。(2) Labels interface 字段是 CampaignKolPanel.tsx 内部 surface，已 0 引用（per audit §2.2 第 3 条）— atomic 删无风险。(3) page.tsx label assembler 段（per audit §2.2 第 3 条 line 208-216）属内部 surface，atomic 清。(4) **不接受 A 方案**（整体删 i18n）— 破现 gate 风险大于收益。 |
| **4** | **A — 严格按 README 6 列结构** | (1) **核 Table 原子组件实测**：`src/components/ui/Table.tsx` line 1-40 是纯 `<table>` wrapper（forwardRef + className 透传），列数完全由 THead/TRow/TCell 自由组合决定，**无 column 数约束**。Kimi 审计 §3 #4 「与现行 Table grid 不完全对齐」担心**与实物不符**。(2) `design-draft/bl066-campaign-detail-ai-main-panel/README.md` 是 F001 canonical 设计稿来源，§"Accepted KOLs 区"明示 6 列结构 = `avatar+name / Source chip / status pill / fee / addedAt / open_in_new icon`；BL-066 #B 决策 "AI / CSV / Legacy 区分明确" 语义要求 source chip 独立列（不能 inline 到 creator cell 信息密度过高）。(3) C 方案 5 列「creator(含 source chip inline)」违反 BL-066 #B 决策语义。(4) **Generator 实测如果 Table 实际有 column 数 hard cap 再来加 audit**（v0.9.21 planner.md 铁律 1 矩阵 v0.9.14 行已立"audit 起草前 grep 实物状态"原则；Kimi 本审计漏 grep Table.tsx 源码字面就推断 hard cap 是反面案例，未来 Generator 起 audit 前先实测对应实物结构）。 |
| **5** | **B — fidelity test 加 source chip + read-only 锁** | (1) Kimi 推荐 B 已合理：path rename + source chip 渲染锁（`getByText AI/CSV/Legacy`）+ contactStatus / kolFee read-only 锁（无 `<Select` / `<Input`）— 锁 F006 核心 invariant 防止未来 PR 误改回交互态。(2) A 太弱（只改 path 无新 assertion，无法捕捉 source chip / read-only 回归）。(3) C 的 lineCount guard 过度（F006 后 ~150 行无 cap 必要 — 与现 BL-065 fidelity test 模式一致）。 |

### 同步修订的文件清单

- `docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md` §F006 acceptance — embed #1 migration 范围 + #4 6 列结构锁
- `features.json` F006 acceptance — embed 5 决议细节
- 本审计文档 §6 Planner 裁决段追加；§3 决议请求表保留供历史 reference

### Generator 实战经验沉淀（追加到 proposed-learnings 后置）

**Kimi 在 F006 audit §3 #4 漂移：** 审计字面假设「与现行 Table grid 不完全对齐」未先 grep `src/components/ui/Table.tsx` 实物。Planner 实测 Table 是 fully flexible wrapper 无约束 → A 方案安全。 **沉淀候选**：planner.md 铁律 1 矩阵 v0.9.21 行（i18n template route migration）后追加 v0.9.22 行 — 「Generator pre-impl audit 起草前实测对应 atomic 组件 surface 字面」。BL-066 done-phase Planner 再 batch 收集到 proposed-learnings 一并归。

### Generator 可直接开工

收到此裁决后 Kimi 按 audit §5 1-13 步骤直接开工，**不必再确认任何 #1-#5 决议**。F006 提交时直接走 staging deploy + commit + push + CI 自检。F009 staging deploy 时验证 backfill audit_log row_count。

---

## 7. 相关文档

- `docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md` §F006
- `features.json` 条目 F006
- `prisma/migrations/20260514150000_bl066_kol_campaign_source/migration.sql`（F004 落地）
- `design-draft/bl066-campaign-detail-ai-main-panel/README.md` §"Accepted KOLs 区"
- `src/app/[locale]/(app)/campaigns/[id]/CampaignKolPanel.tsx` + `CampaignKolRow.tsx`
- `src/lib/campaigns/detail.ts`
- `framework/harness/pre-impl-adjudication.md` §4.6 §4.7（本审计遵循之）

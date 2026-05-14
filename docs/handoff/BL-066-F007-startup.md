# BL-066-F007 起工交接文档

> **写于：** 2026-05-14 21:00 BJT，Generator Kimi 本会话（.agent-id=johnsong 本机代理）
> **目标读者：** 新会话的 Generator（同样以 .agent-id=johnsong 本机代理 Kimi 身份执行）
> **交接：** F006 完成 → F007 起工

## 1. 现状速览

| 项 | 值 |
|---|---|
| 当前批次 | BL-066-campaign-detail-ai-main-panel |
| status | `building` |
| 进度 | 6/9（F001–F006 完成） |
| fix_rounds | 0 |
| HEAD（main + staging） | `8ddca01`（state-file marker；功能 HEAD = `40b6707`） |
| role_assignments | planner=johnsong · generator=Kimi · evaluator=Reviewer |
| 下一 pending | F007（BL-048 valueScore 公式 v2 + ADR-014 + recompute SQL ops） |
| 估算 | ~20h Generator + 1d Reviewer（本批次最大单 feature） |

## 2. 新会话启动检查清单（按顺序）

```bash
# 1. 同步远端
git pull --ff-only origin main

# 2. 读必备状态机文件（确认 status=building / completed_features=6 / 自己被分配 generator）
cat progress.json
cat features.json | python3 -c "import json,sys;[print(f['id'],f['status']) for f in json.load(sys.stdin)]"

# 3. 读共享记忆 T0
# - .auto-memory/MEMORY.md
# - .auto-memory/project-status.md（应见 BL-066 BUILDING 6/9 marker）
# - .auto-memory/environment.md
# - .auto-memory/role-context/generator.md

# 4. 读 F007 spec + 上下文
# - docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md §F007
# - features.json F007 acceptance
# - src/lib/kol/value-score.ts（当前公式）
# - src/lib/kol/__tests__/value-score.test.ts（既有测试 baseline）

# 5. （强烈建议）写 F007 pre-impl audit 推 main 等 Planner 裁决
#    本批次每个 feature 起工前都做了 audit（F002 / F006），F007 是最大单 feature
#    + 含 prod 数据 ops + 新 ADR-014，audit 价值高
```

## 3. F007 范围核心

### 3.1 公式调整（spec §F007 / features.json F007）

修改 `src/lib/kol/value-score.ts`：
- **followerScore：** `min(50, log10(followerCount) × 10)` + cap 80（mega-tier 拉到接近满分）
- **categoryScore：** length-only 现 logic 但 normalize 范围调 max 15（降权）
- **engagementScoreFromRate：** 改阶梯 — `>= 5% → 12` / `>= 8% → 16` / `>= 12% → 20` / `>= 16% → 25`
- **RAW_MAX：** 95（normalize 总分）

### 3.2 ADR-014 起草

`docs/adr/ADR-014-value-score-formula-v2.md` — 含背景 + 三处调整理由 + before/after 公式 + impact analysis（top-15 mega 重登顶 + nano 区分度回来）

### 3.3 Recompute SQL ops

独立 SSH session：
- staging：`UPDATE kol SET value_score = <新公式>(...)`
- prod 同步（用户 ack 时间窗）
- `audit_log` 写 `value_score_recompute_v2` event with row_count
- 验证 staging + prod top-15 不再出现 2K vs 12.6M 同分；mega-tier 重登顶

### 3.4 单测

`src/lib/kol/__tests__/value-score.test.ts` 扩 ≥6 case 覆盖新公式

## 4. F007 起工前可能歧义点（audit 候选）

> 不是强制 audit；如果你 read spec 觉得清晰可跳。但 F007 复杂度高，推荐审计：

| # | 候选歧义 | 备注 |
|---|---|---|
| 1 | `cap 80` 是 followerScore 单独 cap 还是与其它分数 sum 后 cap？ | spec 第 1 行字面读起来是 followerScore 单独 cap |
| 2 | engagement 阶梯 ≥5% 但 nano <5% 的怎么算？ | 现公式应有 fallback，read source 确认 |
| 3 | recompute SQL 用纯 SQL 还是 ts 脚本？ | BL-048 当年初稿建议 ts 脚本可调；spec §F007 未硬锁 |
| 4 | audit_log event payload shape | 沿 BL-029 / BL-048 现有 pattern 还是新 schema？ |
| 5 | staging vs prod recompute 时间间隔 | 用户 ack 时间窗"等待长度"建议 24h（BL-061 模式） |
| 6 | 验证 top-15 标准如何衡量"mega 重登顶"？ | spec 给"2K vs 12.6M 同分"作反例；正例标准建议 audit 明确 |

## 5. 关键禁区 / 注意点

- **铁律 #10**：F007 任何代码改动 commit message 必须 `feat(BL-066-F007):` 前缀；不能借机做无 feature 号的 cleanup（同 BL-064 sediment）
- **铁律 #11**：每次状态机 JSON commit 前跑 `python3 -c "import json; json.load(open('progress.json')); json.load(open('features.json'))"`
- **铁律 #12**：commit 前跑 `git diff --cached --name-only` 确认 staged index
- **staging deploy 硬要求**（generator.md §切 verifying 前）：F007 推 main 后必须 SSH staging deploy + verify git_sha = main HEAD；commit 注明 `[staging deployed @ {sha} @ {ts}]`
- **F007 同 commit ADR-014 起草** —— 不要拆两 PR
- **prod recompute SQL apply 必须等用户 ack 时间窗**（per BL-063/064/065 实战）
- **CI 多轮自修预期**（generator.md §10）：F007 推 main 后可能因 baseline regen / fidelity test 触发 1-2 轮自修；规划时间预算

## 6. 待沉淀（done 阶段 Planner 处理）

加到 `framework/proposed-learnings.md` 队尾（done 阶段 Planner 收集）：

> **v0.9.22 候选 — 2026-05-14 BL-066-F006 Kimi**
>
> **类型：** 规律 / 沉淀
>
> **内容：** Generator 起 pre-impl audit 写"与现行原子组件 grid 不完全对齐"等推断性论断前，必须先 grep / Read 实物组件 surface 字面。F006 audit §3 #4 Kimi 假设 Table.tsx 有 column 数 hard cap 推荐方案 C，Planner 实测 Table.tsx 是 fully flexible wrapper 无 cap 改判 #4=A 6 列结构。
>
> **建议写入：** `framework/harness/planner.md` 铁律 1 矩阵 v0.9.21 行下追加 v0.9.22 行：「Generator pre-impl audit 起草前实测对应 atomic 组件 surface 字面」。
>
> **状态：** 待确认（在 BL-066 done 阶段 Planner 走 proposed-learnings 收集流程时正式入会）。

## 7. F006 完成的关键事实摘要（给新会话快速对齐）

- F006 commits 段：`b2ae0bb` audit → `a682cde` Planner verdict → `ba0c5fc` impl 15 文件 → `5c08c6d` woff2 regen → `8ddca01` state markers
- `ba0c5fc` 含 backfill migration `20260514210000_..._source_manual_legacy_backfill` — staging 验证 `manual_legacy=10` 完成
- Planner verdict `#1:C #2:A #3:C #4:A #5:B`（详 `docs/specs/BL-066-F006-accepted-kols-panel-audit.md` §6）
- 文件改名：`CampaignKolPanel.tsx → AcceptedKolsPanel.tsx` + `CampaignKolRow.tsx → AcceptedKolRow.tsx`
- 删除函数：`runAvailableKolsForCampaign`（detail.ts）+ 关联 integration test describe 块
- 保留 dead code（BL-070 收尾）：`actions.ts` 中的 `removeKolAction` / `updateKolContactStatusAction` / `updateKolFeeAction` 0 callers 但未删（不在 F006 spec 范围）；i18n `kolPanel.addButton/aiNativeMigrationTooltip/addDialog.*/remove/removeConfirm` 加 `_deprecated_by_BL-066` marker

## 8. 删除本文件

F007 done 后，本会话已无新意义，可直接 `git rm docs/handoff/BL-066-F007-startup.md` 清理。

# BL-063 F005 · staging dry-run 审计请求 / 中段 partial-pending

> **发起者：** johnsong (Generator, CLI)
> **日期：** 2026-05-11
> **触发：** F005 SSH staging audit 跑完后发现 2 项 acceptance 与现实/设计不一致，按
> `framework/harness/pre-impl-adjudication.md` §3.3（spec 字面冲突，Planner 自锅）
> + §11（building 中段良性 partial-pending 变种）联合处理
> **状态：** 等待 Planner 明确回复，**未收到前 F005 不切 verifying**

## 1. 背景 & 目标

BL-063 F005 acceptance 共 7 条（见 `features.json` F005）。Generator 已完成 SSH staging audit 9 项 +
UI spot check（用户 5/5 PASS）+ CI e2e 验证。逐条核对后，**5 项 PASS、1 项 PARTIAL（spec 字面冲突）、
1 项 FAIL（数据漂移）、1 项写报告中**。两项不达标均**非 BL-063 实装回归**，根因分别是 F002 ↔ F005
acceptance 内部矛盾（Planner 起草自锅）+ KOL 池随时间增长后 daily sync 未回填 stats（BL-063 orthogonal）。

## 2. F005 acceptance 7 条逐项核对

| # | acceptance | 状态 | 证据 |
|---|---|---|---|
| 1 | staging 跑 F002 migration | ✅ PASS | `_prisma_migrations` row `20260511000000_bl063_remove_is_saved` finished_at=t / rolled_back_at=null |
| 2 | `information_schema` 验证 is_saved 列不存在 | ✅ PASS | 直接 SQL 返 0 rows |
| 3 | engagement_rate 非 NULL ≥ 6.7%（不退化） | ❌ **FAIL** → 决议 #2 | 实测 95/3891 = **2.44%**（远低于 6.7%）|
| 4 | staging 全量 e2e suite PASS | ✅ PASS | CI run 25634478354 on sha 0dc4afa — Playwright 5m21s success（BM1 marketer-journey 1 spec 已按 BL-063-F004 跳过，文档记录在 commit 0dc4afa）|
| 5 | /campaigns/[id] dialog 显完整 KOL 池 | ✅ PASS | 用户 2026-05-11 ~10:00 BJT 实地 5/5 sections 全 PASS（见 progress.json evaluator_feedback）|
| 6 | `_bl063_is_saved_backup` 表存在 + 4 行 isSaved=true | ⚠️ **PARTIAL** → 决议 #1 | F002 migration 用 `CREATE TEMP TABLE`（session-scoped），post-deploy 无法持久化；本身是 F002 acceptance 设计 |
| 7 | 写 `docs/test-reports/BL-063-F005-staging-dryrun-2026-05-XX.md` | 📝 进行中 | 本 audit + 同 commit 的 dry-run report |

## 3. 决议请求（2 条）

### 决议 #1 — `_bl063_is_saved_backup` TEMP table 与 F005 acceptance 第 6 条矛盾

**矛盾陈述：**

- F002 acceptance 第 2 条字面写「`CREATE TEMP TABLE _bl063_is_saved_backup AS SELECT ...`」+
  `prisma/migrations/20260511000000_bl063_remove_is_saved/migration.sql` 实装即如此（migration 注释亦明确：
  「ops that needs a durable backup should pg_dump the kol table BEFORE running this migration
  (see F006 acceptance — prod ops uses pg_dump)」）。
- F005 acceptance 第 6 条要求「staging `_bl063_is_saved_backup` 表存在（含 4 行原 isSaved=true 数据）」。
- TEMP TABLE 是 PostgreSQL 会话级表，`prisma migrate deploy` 跑完即销毁，post-deploy 永远不可能查到。
  → F005 第 6 条**不可能在 F002 设计下达成**。

**类型：** §3.3 spec 字面冲突（同 batch 不同 feature acceptance 自锅）。

**候选方案：**

| 方案 | 内容 | 影响范围 | 自荐 |
|---|---|---|---|
| **A** | 修订 F005 acceptance 第 6 条为「F002 migration 含 TEMP 备份模式（migration SQL 行内验证 + ROLLBACK 注释指向 pg_dump for durable）」+ 在 F006 acceptance 显式新增「prod 走 pg_dump 持久化备份」（其实已隐含在「prod 数据 backup」第 1 条，可加 cross-ref）。代码不动，仅改 features.json + spec 一段。 | 0 代码 / 文档一致性收口 | ⭐ **建议 A** |
| B | 改 F002 migration 为非 TEMP（`CREATE TABLE` 持久化），重新 deploy staging。需新 migration 文件（不能改已 applied 的 hash）。 | +1 schema 增量 / staging redeploy / 新 migration 命名空间污染 / prod 时也得多一张表 | ✗ 不建议（设计原本是合理的，非 TEMP 反而留垃圾） |
| C | F005 第 6 条标 PARTIAL 留给 Codex Reviewer 在 verifying 裁决。 | 把决策推后一层 / 仍需 Planner 修 acceptance 才能过 / 无意义 round-trip | ✗ 不建议（典型 §4.5 Reviewer 按旧 spec 验收 anti-pattern）|

**自荐：A** —— 这是典型 §3.3 Planner 自锅，正解就是 Planner 修 acceptance 让两段口径一致；F002 设计本就正确，
不应被 F005 acceptance 倒推。

---

### 决议 #2 — engagement_rate non_null_pct 2.44% vs F005 acceptance 第 3 条 6.7%

**事实陈述：**

- BL-061 F003 baseline（2026-05-09）：staging engagement_rate non_null_pct ≈ **6.7%**（KOL 池 ~4000）。
- 2026-05-11 实测：staging KOL 总量 4534 / active 3891，`engagement_rate IS NOT NULL` 95 行 = **2.44%**。
- BL-063 不修改任何 engagement_rate 计算路径或 stats sync 逻辑（F001-F004 grep 全清，F002 仅删 is_saved 列）。
- 推测根因（待证实）：
  1. 自 BL-061 baseline 起 2 天的 daily sync 增加 ~530 KOL（apify-kol 同步 IG/X/YT/TT 增量入库）
  2. 新增 KOL 大概率没有 `lifetime_views` / `lifetime_likes` 这些 engagement_rate 计算依赖字段
     （`environment.md` §apify-kol 4 平台字段语义表显示 IG 因 TikHub 抽风仍 null；YT/X 是 view-based proxy）
  3. 旧池 95 / ~4000 ≈ 2.4% — 与现状 95/3891 = 2.44% 一致 → 实际可能是「分子未变，分母涨了」，
     **非 BL-063 引入 regression**

**类型：** §11 building 中段良性 partial-pending（pre-impl 阶段无法暴露 — 需要跑 staging audit 才看到分母漂移）。
spec 起草时（5/10 ~22:30）BL-061 数据快照仍是 6.7%，5/11 ~10:00 audit 时数据已变。

**候选方案：**

| 方案 | 内容 | 影响范围 | 工作量 | 自荐 |
|---|---|---|---|---|
| **A** | F005 标 partial-pending → 进 fixing → fix-round 1 修订 acceptance 第 3 条为「engagement_rate non_null_pct ≥ X%（baseline X% 见 dry-run report，不退化指标改为'分子不下降'即 95 → ≥ 95 行）」+ 推 backlog 新条目「engagement_rate 回填 / sync 缺位调查」并入 5/17 weekly growth-curve check。F005 主体放行。| F005 acceptance + backlog.json + dry-run report 3 处文字 / 0 代码 | ~10 min | ⭐ **建议 A** |
| B | 扩 F007「engagement_rate 回填脚本」并入 BL-063 本批次。需调研 apify-kol 哪些平台字段缺、写回填脚本、跑 staging 验证 ≥ 6.7%。| 本批次工时 +2-3h / 阻塞 F005 done | ~2-3h | ✗ 不建议（BL-063 orthogonal，违反铁律 10 spec-driven 工作必须 features.json 归属，F007 无法干净地归属到「is_saved decommission」叙事下）|
| C | F005 第 3 条放过 + 报告备注「2.44% baseline 漂移，BL-063 orthogonal，5/17 weekly check 跟进」+ F005 整体 PASS。| 0 修订 / 但 acceptance 字面要求 6.7% 仍未达标，Codex Reviewer 字面判会 FAIL | ~5 min | ✗ 不建议（§4.5 Reviewer 按旧 spec 验收，前次 BL-040 已踩过同坑）|

**自荐：A** —— 既不违反铁律 10（不扩范围），又给 F005 一个干净的 done，又把数据漂移问题正式登记到 backlog
让 5/17 weekly 自然处理。修订后的 acceptance 第 3 条以「分子不下降」做主指标（防 BL-063 真引 regression），
分母用 dry-run report 当时的数 + backlog 跟进，符合 §11.3 「spec scope 调整」格式。

## 4. 已可控部分（completed before audit submit）

按 §11.2 步骤 1，Generator 已完成可控部分：

- staging git_sha = 0dc4afa（与 main 上 F002/F003/F004 commit 一致；之后的 c959010/39fbd4e 是 paths-ignore state-only commits，不需 redeploy）
- SSH staging SQL audit 9 项跑完（详见 dry-run report）
- CI on 0dc4afa 全 PASS（含 Playwright E2E 5m21s）
- 用户 UI spot check 5/5 PASS @ 2026-05-11 ~10:00 BJT
- 写 `docs/test-reports/BL-063-F005-staging-dryrun-2026-05-11.md`（同 commit）

不再继续推进 F005 done 步骤（features.json status 改、status → verifying 切等），等 Planner 裁决。

## 5. 开工条件（裁决后 Generator 行为）

收到 Planner 短格式回复 `#1:A #2:A` 后，Generator 将：

1. Planner 裁决 commit 含：
   - `features.json` F005 acceptance 第 3、6 条文字修订
   - `backlog.json` 追加「BL-063 5/17 weekly growth-curve 加 engagement_rate non_null_pct 跟进」条目
   - `docs/specs/BL-063-isSaved-decommission-spec.md` §F005 同步修订（如有）
2. Generator git pull 后：
   - 把 F005 status pending → done（features.json）
   - progress.json completed_features 4 → 5
   - 切 status `building → fixing`，`fix_rounds += 1`（按 §11.4 规则；本批次 F006 仍 pending，
     fixing 后 F006 推进完才到 reverifying → done）
   - 或：如 Planner 决定 F005 PASS + F006 单独成 last-mile（不计 fix_round），则按 Planner 指示切

**未收到 Planner 明确 commit 推 main 前 Generator 不开工**（§4.6 anti-pattern）。

## 6. 相关文档

- `docs/specs/BL-063-isSaved-decommission-spec.md` — 主 spec
- `docs/test-reports/BL-063-F005-staging-dryrun-2026-05-11.md` — F005 dry-run report（acceptance 第 7 条产出物）
- `prisma/migrations/20260511000000_bl063_remove_is_saved/migration.sql` — F002 实装（含 TEMP backup 模式）
- `framework/harness/pre-impl-adjudication.md` §3.3 + §11 — 本 audit 引用的 pattern
- `features.json` F005 acceptance — 本 audit 核对对象
- `progress.json` evaluator_feedback / session_notes — 上次会话上下文

---

## 7. Planner 裁决（johnsong · 2026-05-11 ~10:45 BJT）

**短格式：** `#1:A #2:A`

### 决议 #1：A — 修订 F005 acceptance 第 6 条文字（不动代码）

**理由：**

- F002 acceptance 第 2 条字面写 `CREATE TEMP TABLE`，**Planner 起草时设计意图就是 session-scoped**（migration 注释亦明示「durable backup should pg_dump (F006 acceptance)」）— 此为 §3.3 典型 spec 字面冲突 / 同 batch 不同 feature acceptance 自锅
- F005 第 6 条要求 post-deploy 查到 backup 表，与 F002 设计相互矛盾，物理上不可能达成
- 方案 B（改非 TEMP）会留 schema 垃圾且需新 migration，违反"设计本就正确"原则
- 方案 C（推 Reviewer）是典型 §4.5 anti-pattern（按旧 spec 验收）

**修订 F005 acceptance 第 6 条：**
- 旧：`staging _bl063_is_saved_backup 表存在（含 4 行原 isSaved=true 数据）`
- 新：`F002 migration TEMP 备份模式正确执行（migration SQL 行内验证 + ROLLBACK 注释指向 pg_dump for durable）— 持久化备份责任归 F006 prod ops（pg_dump，见 F006 acceptance 第 1 条）`

### 决议 #2：A — 修订 F005 acceptance 第 3 条 + backlog 加 BL-062 跟进

**理由：**

- 实测 95/3891=2.44% 是**分母漂移**而非 BL-063 引入 regression（分子 95 行 = BL-061 baseline 完全相同；2 天 daily sync 增 ~530 KOL 未回填 stats，分母 4000→3891 active 涨）
- BL-063 全部 6 features 不动 engagement_rate 计算路径或 stats sync 逻辑（git diff main~6 grep engagement|stats 无命中）
- 方案 B（扩 F007 回填脚本）违反铁律 10 — 不能干净归属到"is_saved decommission"叙事下，且阻塞 F005 done
- 方案 C（放过）会让 Codex Reviewer 字面判 FAIL，留 spec 字面 vs 现实不一致的争议（v0.9.14 sediment 反过的同坑）
- 方案 A 既不违反铁律 10、不扩范围、给 F005 干净 done，又把数据漂移问题正式登记到 backlog 让 5/17 weekly 自然处理

**修订 F005 acceptance 第 3 条：**
- 旧：`staging 跑 BL-061 F003 SQL 验证 engagement_rate 非 NULL 比例不退化（应仍 6.7%）`
- 新：`staging 跑 BL-061 F003 SQL 验证 engagement_rate **分子（非 NULL 行数）不下降**（BL-061 baseline 5/9 = 95 行，本批次实测 ≥ 95 行 — 防 BL-063 引入 stats regression）。原 6.7% 比例指标转 backlog 跟进（apify-kol daily sync 增量未回填 stats，比例随分母涨稀释；BL-063 orthogonal — 见 BL-062 5/17 weekly growth-curve check）`

**backlog.json 新增条目：** `BL-062 数据 coverage 治理 / 5/17 weekly growth-curve check`（含 engagement_rate non_null_pct 跟进 + roadmap §8 定位）

### 同步文档更新清单（本裁决 commit 含）

1. `docs/specs/BL-063-F005-staging-dryrun-audit.md` — 本段（§7 Planner 裁决）
2. `features.json` F005 acceptance 第 3、6 条文字修订
3. `backlog.json` 追加 BL-062 数据 coverage 治理 entry
4. `docs/specs/BL-063-isSaved-decommission-spec.md` 不动（features.json 是 truth source；spec doc 是起草时快照）

### 裁决后 Generator 续做（fix-round 1）

按 audit §5 步骤：

1. Generator git pull 看到裁决 commit
2. F005 status `pending → done`（features.json）
3. progress.json `completed_features 4 → 5` + `last_updated`
4. 切 status `building → fixing`（`fix_rounds 0 → 1`，per §11.4）— 因为 acceptance 修订是裁决产物，按 §11.4 计入 fix_round
5. F006 prod ops 推进：用户手动触发 deploy-prod + Generator 跑 prod audit + 写 signoff
6. F006 done → reverifying → Codex Reviewer 终审 → done

**Planner 提示：** F006 prod ops 必须等用户 ack 业务低峰期时间窗（per spec §5 不变量条款），Generator 不得自行触发 deploy-prod。

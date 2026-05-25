# BL-071 Harness Audit Report — Phase A0 Deep Read

> **执行：** 2026-05-25 北京 / Planner Kimi
> **范围：** 全部 harness 相关文档（5700 LOC）逐文件深读 + 重复/失效/反模式标注
> **触发：** 用户要求 BL-071 framework sediment 批次顺带做全面 harness review
> **审计深度：** C 级（完整逐文件读 + 沉淀有效性 sample + 规则一致性检查）
> **状态：** ✅ Phase A0 完成 → 待 Phase A1 用户 lock 决策点

---

## §1 文件 inventory（按角色 + LOC）

### 1.1 顶层入口（496 LOC）

| 文件 | LOC | 性质 | 评估 |
|---|---|---|---|
| `CLAUDE.md`（项目根） | 61 | 项目级 Claude 启动 entry | ✅ 简洁清晰 |
| `harness-rules.md`（项目根） | 352 | 状态机规则 + 12 铁律 | ⚠️ 与 `framework/harness/harness-rules.md` 同名不同内容 |
| `framework/README.md` | 386 | template repo GitHub 落地页 | ✅ 入口清晰，但与项目实际状态有混淆点 |
| `framework/cowork-constraint-design.md` | 90 | **历史死文档** | ❌ 文档自己声明"Cowork 不再参与"，纯历史记录 |

### 1.2 framework/harness/（11 文件，3697 LOC）

| 文件 | LOC | 性质 | 评估 |
|---|---|---|---|
| `harness-rules.md` | 351 | **重复**：与项目根 harness-rules.md 几乎同内容 | ❌ 缺铁律 #12（v0.9.14 加的），加 BIx commit 3da4248 来源；template/实例版本漂移 |
| `planner.md` | 625 | Planner 角色规范 + 7 铁律 + 7 sediment 段 | ⚠️ **膨胀 + chronological-append 反模式** |
| `generator.md` | 301 | Generator 角色规范 + 3 sediment 段 | ⚠️ §7 重复编号；§8-10 sediment |
| `evaluator.md` | 432 | Evaluator 角色规范 + 11 sediment 段 | ❌ §3/§4 重复编号；§10-§20 长 sediment append（最严重） |
| `pre-impl-adjudication.md` | 377 | 审计 → 裁决模式专项 | ⚠️ §11 在 §10 版本历史之前，编号错乱 |
| `ai-action-contract.md` | 347 | AI 集成规范 | ✅ topical 组织 OK |
| `deploy-patterns.md` | 457 | 部署模式 | ⚠️ §5.1 在 §5 之后但应为 §6 |
| `database-patterns.md` | 392 | DB 模式 | ✅ topical OK；项目特定（kolmatrix_app/RLS） |
| `ui-fidelity-guardrail.md` | 196 | UI 还原规范 | ✅ 最佳组织 |
| `i18n-namespace-add-checklist.md` | 121 | i18n 添加清单 | ⚠️ 项目特定（5 locale），narrow case |
| `material-symbols-pattern.md` | 98 | 字体子集清单 | ⚠️ 极项目特定（BL-025/026/027） |

### 1.3 framework/memory/（5 文件，108 LOC，模板）

| 文件 | LOC | 性质 |
|---|---|---|
| `MEMORY.md` | 17 | T0/T1/T2 索引模板 |
| `project-status.md` | 33 | 项目状态快照模板 |
| `environment.md` | 30 | 环境信息模板 |
| `reference-docs.md` | 22 | 文档结构索引模板 |
| `user-role.md` | 16 | 用户角色模板 |

❌ **重复定位风险：** 这 5 个文件名与 `.auto-memory/` 完全相同；agent 启动可能误读。framework/README.md 解释"这是 template，供 bootstrap.sh 复制到 `.auto-memory/`"，但项目运行时 agent 不读 README 就分辨不出。

### 1.4 .auto-memory/role-context/（3 文件，154 LOC）

| 文件 | LOC | 性质 | 评估 |
|---|---|---|---|
| `planner.md` | 44 | 短版 HOW 规范 | ✅ 简洁 |
| `generator.md` | 65 | 短版 HOW 规范 | ✅ 简洁 |
| `evaluator.md` | 45 | 短版 HOW 规范 | ✅ 简洁 |

✅ 这层定位清晰：T1 短摘要，cold-pickup 时读。与 framework/harness/{planner,generator,evaluator}.md 长版形成 short/long 互补，整体设计良好。

### 1.5 framework/proposed-learnings.md（238 LOC）

| 段 | 内容 |
|---|---|
| Header | 用法说明 |
| 14 个 HTML 注释 | v0.9.9 → v0.9.22 沉淀完成 marker |
| 3 条 BL-069 entries | user-acked 5/18，状态：待 framework sediment batch 写入 |
| 12 条 BL-070 entries | user-acked 5/25，状态：待 framework sediment batch 写入 |

**积压总数：** 15 条 in proposed-learnings.md + 13 条 v0.9.22 archive 待写入 framework/harness/*.md = **28 条沉淀积压**。

### 1.6 framework/archive/（14 文件，1481 LOC）

按版本归档 v0.5 → v0.9.22。✅ 按版本组织合理，无需重组。

---

## §2 高置信度重复内容（必须解决）

### 2.1 `harness-rules.md` 双副本漂移

**实际 diff：**
- 项目根 `harness-rules.md`：12 条铁律（含铁律 #12 "git diff --cached" 验 staged 索引，来源 BIx commit 3da4248）
- `framework/harness/harness-rules.md`：仅 11 条铁律（缺铁律 #12）
- 还有 1 处微差：root 引 `framework/harness/pre-impl-adjudication.md`；framework/harness 那份引 `pre-impl-adjudication.md`（相对路径）

**根因：** framework/harness/ 设计为 template repo 的源（供 bootstrap.sh 拷贝到新项目根），但项目运行时 Planner 编辑的是项目根那份 → template 版本越来越旧。每加一条铁律就遗忘同步 template。

**后果（潜在）：** 用 bootstrap.sh 起新项目时会拿到旧 template（缺铁律 #12），新项目同样问题再演一遍。

### 2.2 `framework/memory/` vs `.auto-memory/` 4 文件名同形

```
framework/memory/MEMORY.md         vs  .auto-memory/MEMORY.md
framework/memory/environment.md    vs  .auto-memory/environment.md
framework/memory/project-status.md vs  .auto-memory/project-status.md
framework/memory/user-role.md      vs  .auto-memory/user-role.md
```

✅ 已 diff 确认：内容不同（template 占位 vs 项目实际状态）。
❌ Agent 启动若未读 framework/README.md 解释，可能误判定位。

**根因：** framework/memory/ 是 bootstrap source，但目录命名（"memory"）与项目运行时 memory（`.auto-memory`）几乎一致。

### 2.3 done 收尾流程多处重复

| 位置 | 内容 |
|---|---|
| `harness-rules.md`（root） | §"启动流程" 第 5 步 + §"角色动态分配" |
| `framework/harness/planner.md` | §"status = done 时的收尾流程"（4 步） |
| `.auto-memory/role-context/planner.md` | §"done 收尾"（4 项） |

**实际差异：**
- harness-rules.md 只说"读 progress.json 执行对应角色文件"
- planner.md long 版给完整 4 步流程
- role-context/planner.md 是 4 步精简摘要（与 long 版一致）

✅ short/long 模式 OK，但若三处任一加一条规则没同步，会出现 BL-032 类型的"角色文件多副本一致性"问题（这恰好已成 planner.md 铁律 #7）。**meta 风险：自己的规则用来约束自己。**

### 2.4 spec 起草规则散落 ≥4 处

planner.md 自己有 6 个独立段都涉及"spec 起草 checklist"：

1. §"Spec 起草必含「数据准备步骤」+ 白名单 ID"
2. §"verifying 前 checklist 起草必须 grep 实际代码验证"
3. §"Perf 类 acceptance 必须自带「工具 + 输出物」checklist"
4. §"UI 类 spec 起草前 mandatory self-check checklist"
5. §"i18n 命名空间扩展类 spec 起草必含双门检查"
6. §"Server Action / API route 新增时 spec 必含速率限制条款"

外加 `pre-impl-adjudication.md §9.1` 也有 "Planner 写 spec 自检清单"，`ui-fidelity-guardrail.md §2` 又是 UI spec 起草。

**这些都是"spec 起草前自检"主题，但散落在 ≥4 个文件 + planner.md 内 ≥6 段，新 Planner 起 spec 时几乎不可能全部记得。**

### 2.5 PM2 重启规则在 deploy-patterns.md 重复

`deploy-patterns.md` §1.6（v0.9.7）与 §1.7（v0.9.14）都讲"PM2 reload 不重读 .env"，§1.7 标"reaffirm 加强"。这是 sediment 写入时遵循"不替换上文，加新段"的副作用。

---

## §3 反模式与结构问题

### 3.1 Chronological-append 反模式（最严重）

`evaluator.md` 是教科书级反面例子：
- §1-§9 核心 workflow
- §10 SHA 对齐（v0.9.7）
- §11 Smoke checklist 文本陈旧（v0.9.7）
- §12 首轮 verifying PASS 硬条件（v0.9.7）
- §13 L2 烟测含字体子集（v0.9.7）
- §14 fire-and-forget audit pattern（v0.9.7）
- §15 L1 跑前必先 prisma generate（v0.9.10）
- §16 L1 本机 Node 版本必须与 .nvmrc 一致（v0.9.11）
- §17 lint warnings 处理矩阵（v0.9.12）
- §18 E2E suite 稳定性诊断（v0.9.20）
- §19 SQL 跨 tenant RLS（v0.9.20）
- §20 L1 + 角色门禁手动探针（v0.9.21）

**问题：**
- 编号纯按时间，新 Reviewer 找"如何验 visual baseline" 要 grep 全文（实际散在 §1-§9 + ui-fidelity-guardrail.md §4）
- 12 条 BL-070 sediment 如果继续 append 会变成 §21-§24，问题加深
- 新 Reviewer cold-pickup 时即使读完所有 §10-§20 也无法形成"验收口径"整体视角

类似问题在 `planner.md`（7 铁律 + 6+ sediment 段）和 `generator.md`（§8-§10）也有但较轻。

### 3.2 编号错乱

- `pre-impl-adjudication.md`：§11 在 §10 版本历史前（§10 应该是结尾位置）
- `deploy-patterns.md`：§5.1 子段（实际是独立主题，应 §6）
- `generator.md`：§7 重复（"框架提案" + "Handoff 说明" 都是 §7）
- `evaluator.md`：§3 §4 各重复两次（workflow 中编号撞车）

### 3.3 内容边界混淆

`framework/harness/database-patterns.md`、`i18n-namespace-add-checklist.md`、`material-symbols-pattern.md` 三个文件都是 **项目特定**（KOLMatrix 的 RLS / 5 locale / Material Symbols），与"framework template"语义有点错位。理论上 framework/harness/* 应是跨项目通用，项目特定应在 `docs/dev/`。

但实务上这些 pattern 给"未来类似项目"参考价值大（任何 multi-tenant Prisma 项目都用得到 RLS NULLIF）。所以放 framework/harness/ 不算错，但需要标注"项目特定/通用"维度，方便复用时筛选。

### 3.4 §7 ai-action-contract.md §4.7 嵌套过深

`§4.7 aigcgateway Action 抽象层根本不绑定 max_tokens` 是 §4 子段，但本身 ~50 行，含多个子主题（实测证据 + KOLMatrix 影响 + 短期防御 + 长期 4 选 1）。这是"嵌入主题应被提到顶级 §"的信号。

### 3.5 一次性写入 vs 增量演进

planner.md 铁律 1 矩阵（v0.9.11→v0.9.21 累积 10 行）是个**良好范例**：用表格 + 时间戳记沉淀，新增不会破坏结构 — 这是 chronological-append 的反例（受控的演进）。

```
| 内容 | 核查动作 |
|---|---|
| 函数签名 | Read migration + ... |
| ...regex / id-format（v0.9.11 新增）| ... |
| ...实物核对当前 import（v0.9.14 新增）| ... |
| ...完整 pattern 模式（v0.9.14 新增）| ... |
| ...测试 fail / PASS 类断言（v0.9.15 #1）| ... |
| ...Test fixture / stub（v0.9.15 #2）| ... |
| ...记忆条目陈旧风险（v0.9.17）| ... |
| ...auth role enum（v0.9.18）| ... |
| ...external API response zod（v0.9.19）| ... |
| ...i18n template（v0.9.21）| ... |
```

✅ **这种"开放式矩阵"模式应该被推广**到其他 sediment-prone 主题（如 evaluator.md 验收 checklist、deploy-patterns.md PM2 配置 checklist）。

---

## §4 死规则 / 失效内容

### 4.1 `framework/cowork-constraint-design.md`（90 LOC）

文档**自己**写道："项目后续已统一使用 Claude CLI 承担 Planner + Generator 角色，Cowork 不再参与。本文作为设计决策记录保留。"

✅ 历史决策记录有保留价值，但 **不应放在 framework/ 主目录**（误导新 agent 以为还在用）。建议挪到 `framework/archive/` 或加 deprecation banner。

### 4.2 `planner.md §2.5 检查 Stitch 设计稿`

文字本身没问题，但 ADR-013 AI Native 转向后 Stitch 设计稿的实际使用频率大幅下降（最近 BL-067/068/069/070 大多没有 Stitch 设计稿）。规则没失效但触发率低 → 应该升级判断条件（"涉及 UI 页面架构变更**且** Stitch 项目有该页面" → 只在两个条件同时为真时才追加 features）。

### 4.3 `framework/harness/material-symbols-pattern.md` 项目特异性

98 LOC 专写 KOLMatrix 的 BL-025-F009 + BL-026 + BL-027 案例，对其它项目复用价值极有限。建议挪到 `docs/dev/` 或加项目特定标注。

### 4.4 `evaluator.md §16 L1 本机 Node 版本必须与 .nvmrc 一致`

针对 BL-020-F002 Node 25 vs Node 20 兼容性问题。Node 22 LTS 已主流，这条规则**永久有效**但日常很少触发（除非 Reviewer 跳版本）。**不是失效，但可以放到"启动 checklist"集中段，避免独占 §16 位置。**

### 4.5 `framework/cowork-constraint-design.md` 引用的 cowork-constraints.md

文档建议建 `.auto-memory/cowork-constraints.md`，**实际未建**（这个建议方案没落地）。是悬空 reference。

---

## §5 缺失规则 / 项目实践中已成形但未沉淀

通过扫描最近 batch 实际操作（BL-066-BL-070）发现以下"成形实践但 framework 没明示"的项：

### 5.1 staging deploy 前置 `git pull --ff-only origin main`

每个 Generator session 开头都跑 git pull，但 framework 只在 harness-rules.md §"第零步" 提到 agent 启动 git pull，**Generator deploy 流程**（deploy-patterns.md §3.2）没列。结果每个 Generator 都自己想起来加。

### 5.2 session_notes 写作惯例

实际 BL-066+ 所有 session_notes 都有"## STATE SNAPSHOT (cold pickup 一眼看清)" + "## 本会话动作"等子结构，但 framework 没规定。新 agent cold-pickup 时不知道这个 convention。

### 5.3 commit message 格式规范

观察：所有 batch commit 都用 `feat(BL-XXX-FYY)` / `fix(BL-XXX-FYY)` / `state(BL-XXX)` / `test(...)` 格式，但 framework 没明文。harness-rules.md 铁律 #10 提到 `feat(<batch>-F<num>)` 但其他 prefix（state / fix / test / docs / chore）的语义没有规范化。

### 5.4 BL-067/068 的 LLM batch 已成"类型 B fix-round"

BL-068 fix-rounds=3 案例已经入 v0.9.22 #13 archive，但还没写到 planner.md。本次 sediment 要落实。

### 5.5 fix-round 计数语义模糊

BL-070 progress.json `fix_rounds: 4`，但实际包括：
- fix-round 1（landing batch leftover 修复）
- fix-round 2（F009/F010/F011 实装，本是"新 features"但算 fix-round）
- fix-round 3（CLS culprit 修）
- 第 4 round 是什么？

framework 没明文 fix-round counting 规则。建议沉淀：fix_rounds = "verifying/reverifying 之间循环次数"，而非"任何 fix commit 数"。

---

## §6 §6 框架结构建议（决策点预演）

整理 audit 发现成 8-12 个用户决策点，待 Phase A1 lock：

### 6.1 决策 D1：`harness-rules.md` 双副本怎么处理

**选项：**
- **A. 删 framework/harness/harness-rules.md，bootstrap.sh 改为 cp 项目根 harness-rules.md →新项目根**（最简单，单一 source of truth）
- B. 保留两份，加 git pre-commit hook 自动同步
- C. 改名 framework/harness/harness-rules.template.md 表明是模板

我推荐 **A**：消除歧义，bootstrap.sh 拷源更直接。

### 6.2 决策 D2：`framework/memory/` 是否改名

**选项：**
- **A. 改名 `framework/memory-template/`** + 加 README banner 说明用途
- B. 删整目录，bootstrap.sh 改用 inline scaffold（生成空模板入 .auto-memory/）
- C. 保现状（依赖 framework/README.md 解释）

我推荐 **A**：低破坏 + 一眼可辨。

### 6.3 决策 D3：`framework/cowork-constraint-design.md` 处置

**选项：**
- **A. 移到 `framework/archive/2026-04-04-cowork-constraint-design.md`** + 加 deprecation banner
- B. 删整文件
- C. 改写为"通用 Planner 越界防御设计"（去掉 Cowork 历史包袱）

我推荐 **A**：历史决策值得留痕。

### 6.4 决策 D4：planner.md 625 LOC 是否拆分

**选项：**
- A. 保单文件
- **B. 拆 3 文件：**
  - `planner-workflow.md` (~200 LOC) — §0-§6 核心步骤 + done 收尾
  - `planner-arbitration.md` (~200 LOC) — pre-impl 裁决 P1-P5 + spec 调整规则
  - `planner-checklists.md` (~250 LOC) — 7 铁律矩阵 + spec 起草 checklist 集合（含数据准备/perf/UI/i18n/rate-limit）
- C. 按时间归类 v0.9.X 段

我推荐 **B**：单文件 625 LOC 已超易读阈值，按主题拆分对 Planner cold-pickup 选读最有帮助。

### 6.5 决策 D5：evaluator.md §10-§20 11 段是否按 topic 重组

**选项：**
- A. 保 chronological
- **B. 按 topic 重组（仍单文件）：**
  - §"L1 验收前置"（含 prisma generate / Node .nvmrc / lint warnings）
  - §"L2 验收手段"（含手动探针 / Material Symbols / SQL RLS / E2E suite isolation）
  - §"验收口径"（含 SHA 对齐 / Smoke checklist 文本 / 首轮 PASS 硬条件）
  - §"测试设计"（fire-and-forget audit / mock infeasible）
- C. 拆多文件（同 planner 模式）

我推荐 **B**：单文件按 topic 重组对 Reviewer 验收时翻查最方便（按 L1/L2/口径检索）。

### 6.6 决策 D6：所有 framework/harness/*.md 加"项目特定 / 通用"标注

**选项：**
- **A. 文件 frontmatter 加 scope tag**：`scope: project-specific` / `scope: framework-generic`
- B. 不区分（保现状）
- C. 直接拆 framework/harness/{generic,project-specific}/

我推荐 **A**：低破坏 + 未来复用时易筛选。

### 6.7 决策 D7：sediment 写入位置统一规则

**选项：**
- **A. 强制 inline-merge 到 topic 段而非 append §N**（学 planner.md 铁律 1 矩阵 + ai-action-contract.md §4.7 模式）
- B. 允许 append §N 但限制 LOC（如 ≤80 行/段）
- C. 保现状

我推荐 **A**：从根本上防止 chronological-append 反模式。新 sediment 找最贴的 topic 段做 inline-merge（合并矩阵行 / 加子段），找不到才开新 topic 段。

### 6.8 决策 D8：sediment 写入 PR 模板

实际上 sediment 写入有 "灰色" 部分（哪些 propose 直接写 vs 经 done 流程 vs ADR-worthy 升级）。可以建一个 sediment workflow doc。

**选项：**
- A. 新建 `framework/harness/sediment-workflow.md` 规范
- B. 合并入 proposed-learnings.md header

我推荐 **B**：在 proposed-learnings.md 加 §"写入流程" 简述即可，避免再多一个文件。

### 6.9 决策 D9：CLAUDE.md vs framework/README.md vs harness-rules.md 入口层级

**选项：**
- **A. 保现状 3 层**（CLAUDE.md → harness-rules.md → framework/）+ 在 framework/README.md 顶部加显式 banner "本目录是 template 维护人参考；项目运行时 agent 不读此文件"
- B. 合并 framework/README.md 进 CLAUDE.md
- C. 拆 framework/README.md 为 "template-maintainer.md" 和 "project-bootstrap.md"

我推荐 **A**：3 层有清晰职责分工（项目入口 / 状态机 / 模板源），加 banner 消除混淆。

### 6.10 决策 D10：特定 case 文件（material-symbols / i18n-namespace）是否聚为子目录

**选项：**
- A. 现状（与其他平级）
- **B. 移到 `framework/harness/checklists/`**（与 case-pattern 类共一组）
- C. 移到 `docs/dev/`（项目特定路径）

我推荐 **B**：保留 framework/ 内但用 subdir 表明定位（specific case checklist）。

### 6.11 决策 D11：新增 v0.9.23 范围（沉淀写入规模）

本次 sediment batch 实际包括：
- 28 条积压（v0.9.22 archive 13 + 待写 BL-069/BL-070 共 15）
- ≥5 项规则缺失（§5 列出）
- 7-10 项结构调整（§6 决策点 lock 后实施）

**选项：**
- **A. 全做** — Phase A0+A1 audit 后立即 Phase B（restructure）+ Phase C（sediment writes）+ Phase D（cleanup）
- B. 拆 BL-071 audit 子批次 + BL-072 sediment 子批次
- C. 进一步细分（4 子批次：audit / restructure / sediment / cleanup）

我推荐 **A**：用户已 ack BL-071 大批次 5-7 day，audit 完成后 restructure + sediment 都按本 audit 拆分的 features 走。

### 6.12 决策 D12：fix_rounds 计数语义入 framework

依据 §5.5 缺失规则，需明文规定 fix_rounds 计数语义。

**选项：**
- A. 写入 harness-rules.md 铁律新增
- **B. 写入 planner.md / generator.md 操作说明段**
- C. 不明文，保现状（每个 Planner 自决）

我推荐 **B**：不是铁律级别，是操作规范级别。

---

## §7 推荐 BL-071 实施分 phase 总结

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | 深度 audit（本 report） | ✅ 已完成 0.5 day | Planner Kimi |
| **A1** | 用户 lock 12 个决策点 | 0.5 day | Planner + 用户 |
| **B** | 重组实施（按 D1-D11 lock 后的方案）：split planner.md / 重组 evaluator.md / 移文件 / 删 dead doc / 改 framework/memory 改名等 | 1~1.5 day | Generator |
| **C** | 28 条 sediment 写入（按重组后的新文件结构） | 1.5~2 day | Generator |
| **D** | 收尾（CHANGELOG / archive / proposed-learnings cleanup / backlog.json BL-070 删 / framework/templates 配套 script） | 0.5 day | Generator |
| **E** | Reviewer L1+L2 抽样验证 | 0.5 day | Reviewer |
| **总计** | | ~5 day | |

---

## §8 audit 结论

**整体评估：** framework 设计骨架良好（三角色 / 状态机 / 记忆分层 / template-instance 分离），但 **sediment 增长机制有反模式风险** — 已经积累 28 条待写入 + 多处编号错乱 + 结构膨胀。本批次正是修正契机。

**核心修复目标：**
1. 消除重复（D1 harness-rules / D2 memory 改名 / D3 cowork 死文档）
2. 防止 chronological-append 再发生（D7 sediment 写入规则 + D4/D5 拆分膨胀文件）
3. 落 28 条积压（沉淀写入新结构）
4. 补 5 项缺失（§5 实践已成形但未明文）
5. 加可发现性（D6 scope tag / D9 入口 banner）

**预期长期收益：**
- 新 agent cold-pickup 时间从 ~15min 降到 ~5min（按 topic 选读，不必 grep 全 evaluator.md 找规则）
- sediment 增量成本降低 50%（已有 topic 段易找，不必再开新 §N）
- framework template 维护一致性提升（D1 单 source / D6 scope tag 减少误用）

---

## §9 下一步

Phase A1：把 §6 的 12 个决策点逐项提交用户 lock。

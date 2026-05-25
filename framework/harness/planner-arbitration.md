---
scope: framework-generic
last-updated: 2026-05-25
---

# Planner 裁决与越界界定

> 本文件是 `framework/harness/planner.md` 拆分的 3 部分之一，专责**裁决规则**。
> 启动流程见 [planner-workflow.md](planner-workflow.md)；spec 起草 checklist 见 [planner-checklists.md](planner-checklists.md)。

---

## Pre-Implementation Audit 裁决（2026-04-19 采纳）

来源：KOLMatrix B0 sprint。Generator 在 F005/F010/F007/F006 开工前共提交 4 份 pre-impl 审计 × 25 决策点，Planner 全部裁决后开工，**0 次 building 阶段返工**。

### 规则 P1：收到 pre-impl 审计请求必须优先裁决

Generator 发现规格歧义时按照 `framework/harness/pre-impl-adjudication.md` 格式提交审计文档到 `docs/specs/{batch}-{feature}-*.md`，并在 push commit 中明示 "等 Planner 裁决"。**Planner 看到后必须暂停其他工作优先回复**，延迟会阻塞 sprint。

### 规则 P2：裁决必须完整 + 修订相关文件

裁决时必须：

1. 在同一份审计文档末尾追加 `## N. Planner 裁决` 段
2. 用短格式 `#1:A #2:B ...` 给出每条决议
3. 表格列出每条决定的**具体理由**（可被后续 Planner 复用）
4. 列出"同步修订的文件清单"（spec / features.json / test-cases / README 等）
5. 在 commit message 中声明 Generator 可直接开工，不必再确认

### 规则 P3：修 acceptance 必须扫全文消除矛盾

Planner 修订任何 feature 的 acceptance 段时，**必须用 grep 扫描该 spec 文件内所有相关关键词段落**（实现段 / 验收段 / 引用处），确认无旧口径残留。

**反例（KOLMatrix B0 F007）：** Planner 修订 §F007 Acceptance 段到新口径，忘了同步 §F007 实现段。导致 Reviewer 按旧段判 PARTIAL，Generator 按新段实现 PASS，需要额外一轮仲裁。**错在 Planner。**

### 规则 P4：涉及验收口径的裁决必须同步更新 test-cases

裁决修订 acceptance（特别是验收手段的变化，如从"单文件 grep"到"import 图静态分析"），**必须同步更新 `docs/test-cases/` 对应用例的步骤**，否则 Reviewer 按旧用例验收会误判 fail。

### 规则 P5：裁决理由必须具备复用价值

不接受 "因为 Generator 建议" 之类循环论证。理由应引用：
- 设计系统规范（designMd）
- 多源比对多数派
- 已有 spec 铁律
- 可预见的后续维护成本

这样下一个 Planner 读到裁决才能理解并延续判断原则。

完整 pattern 详见 `framework/harness/pre-impl-adjudication.md`。

### 规则 P5.2：acceptance 边界 vs 全套测试基线（v0.9.16 新增）

来源：BL-052 verifying P5 裁决（2026-05-08）。Reviewer 5/7 partial 报告 grade C / Not ready，失败点 `tests/integration/pre-commit-hook.test.ts` 全套并发抖动（外部网络依赖 Google Fonts woff2 拉取），单文件隔离跑 PASS。Planner johnsong 5/8 00:10 裁决：失败文件来自 BL-027-F004 + BL-025-F009，与 BL-052 范围正交，独立 BL-054 治理；不计入 BL-052 评分。Reviewer 复验仅 BL-052 引入代码 → grade B+ / Ready @ commit `722fc66`。

**核心规律：** Reviewer 报告"全套 `npm run test:integration` 红"时，Planner 裁决前必须先做"**正交性判断**" — acceptance 边界是 spec § acceptance 列表逐项，**不含**"全套测试普遍绿"隐式门槛。

**正交性判断流程（必跑）：**

```bash
# 1. 追溯失败测试文件的引入批次
git log --all --oneline -- <失败测试文件路径>
# 2. 取本批次 commit 集做交集
git log --oneline <building-start>..HEAD -- <失败测试文件路径>
# 3. 步骤 2 输出空 = 范围正交 → 不计入本批次评分
```

**裁决落实模板（4 项同 commit）：**

1. **追加 §Planner 裁决段** 到 `docs/test-reports/<batch>-verifying-YYYY-MM-DD.md`（含 git log 实物追溯证据 + 范围正交结论 + 复验范围重定义）
2. **新建独立 backlog 条目** `BL-XXX-<problem-name>` 治理失败点（priority + 推荐方向 + 工时估算）
3. **更新 `.auto-memory/project-status.md`** 反映新 backlog 立项 + 本批次评分豁免
4. **commit message 明示** "Planner P5.2 裁决：<失败点> 与本批次正交，新建 BL-XXX 治理"

**反面（不适用此规律时）：**

- 拖延 done → 上线时间线收紧（BL-052 案例：buffer 5+ 天可能瞬变 < 1 天）
- Generator 被迫给"不属于本批次的 flaky"写 fix → 跨批次污染 commit history（违反铁律 #10 commit-tag 一致性）
- 隐式假门槛"测试不全绿就是不能 done"与 spec 明文 acceptance 不一致 → 评分系统失活
- Reviewer 反复 fail 评分让"修不好就是不能 done"成为不可见门槛，掩盖真实 framework reliability 缺陷

**适用场景边界：**

| 情形 | 是否适用 P5.2 |
|---|---|
| 失败测试文件来自历史批次 + 本批次零修改 | ✅ 适用（范围正交，建独立 backlog） |
| 失败测试文件本批次新增 / 修改 | ❌ 不适用（属于本批次范围，必须 fix） |
| 失败由本批次代码改动引发的 regression | ❌ 不适用（即使测试文件来自历史，行为变更归本批次） |
| 失败属于 setupFiles / 全局 mock / fixture 通用基础设施 + 影响所有批次 | ✅ 适用（应建独立 framework 治理批次，参 v0.9.15 #2） |

**实物范例（BL-052 5/8 00:10）：** `tests/integration/pre-commit-hook.test.ts` 引入自 BL-027-F004（commit `2c8af8a`），依赖脚本 `scripts/regenerate-material-symbols-subset.sh` 引入自 BL-025-F009 / BIx-mvp-polish-pass。BL-052 13 commits（`c4afd5a..3ba3fe2`）零修改这两文件 → 范围正交 → 建 BL-054-flaky-network-test-isolate（medium，~2-4h Generator + 0.5h Reviewer）→ Reviewer 复验仅 BL-052 引入代码 → grade B+ / Ready @ commit `722fc66`（5/8 01:07）。

### 规则 P5.3：verifying gate 失败时优先 trace 真因而非直接 ack fix（v0.9.22 #13）

**与 P5 / P5.2 关系：** P5 强调"裁决理由复用"，P5.2 强调"范围正交"，P5.3 强调"故障类型分类"。三者形成 verifying gate 失败时的完整裁决方法论。

**核心规则：** Reviewer 报 verifying 失败时（特别 LLM-related batch），Planner 必须先做"**故障类型分类**" — 是 implementation-gap 还是 LLM-behavior？

| 故障类型 | 特征 | Planner 裁决 |
|---|---|---|
| **A. implementation-gap**（如 redirect 302 vs 301 / 缺 chaos flag）| Generator 实装与 spec 字面有差距 | 直接 ack Generator 修代码，预估 1 fix-round 通过 |
| **B. LLM-behavior**（如 prompt 输出 dup / 凑足 N）| LLM 实际输出与 prompt 预期不一致 | **必先要求 trace 真因**（MCP `get_log_detail` 抓 5-10 failed call）+ 推估 2-3 fix-round 通过 |

**反例（BL-068 fix-round 2 浪费）：** Reviewer 报"prompt 解析失败"时 Planner 没 trace 真因即直接 ack Generator 调 prompt（凭 "LLM 应该幻觉新 ID" 假设）→ prompt v2 收敛 drift 但 B6 仍不通过 → fix-round 3 才 MCP trace 抓出 dup-not-hallucination 真因 → 浪费 fix-round 2 + 用户体验延迟 1 天。

**verifying gate 设计盲点：** Reviewer 的 gate criterion 通常只看 success rate（如 80% PASS），不看 failure mode。Planner 必须主动要求 Reviewer trace 失败 mode（特别 LLM-batch）。

**应用清单（Planner 收到 Reviewer verifying 失败报告时）：**
- [ ] 故障是否 LLM-behavior 类？（输出 shape / format / 数量 / 重复 等）
- [ ] 如是，要求 Reviewer 立即 trace 5-10 failed call（MCP get_log_detail）
- [ ] 看真实输出 vs 预期 → 找 pattern（dup / drift / missing）
- [ ] 然后才 ack Generator 修 prompt + server fallback（dedupe-then-validate / 自检 §）

**配套 Generator 端：** LLM fix-round 必先 MCP trace 抓真因（详见 `framework/harness/generator.md §12.3`）。

来源：BL-068 fix-round 2 浪费实战 + v0.9.22 #13（用户 2026-05-17 ack）。

---

## Code Review 报告事实性断言按"线索"处理

**符号/类型/约束/枚举/常量**类断言**必须双路交叉验证**：

1. `grep` / `Read` 找到所有 INSERT/CREATE/UPDATE/写入点 → 源码约定
2. `ssh prod-db` 采样现网数据 → 实际数据
3. 两路一致后再写入 spec

**规格中引用 Code Review 发现时必须标注**：
- `[已核实 source:文件:行 + prod-data]` — 可直接使用
- `[待核实]` — 不得作为 acceptance 阻断条件，Generator 开工前必须澄清

### 结果

- 规格质量从"转述 Review 报告"提升到"与现网代码/数据一致"
- Generator 开工前规格偏差检查成为常态（节省 fix round）
- 重复上次错误将承担召回责任（hotfix / 新修正批次）

---

## 跨角色 ops 必须用户书面授权 + session_notes 记账（v0.9.9 — BL-031 沉淀）

Reviewer / Generator 任一方在批次中执行**不属于本角色域的写操作**（如 Reviewer 跑 SQL ops / Generator 写 signoff / Planner 改产品代码）时，**必须满足 3 项**：

1. **用户书面授权：** 对话中明确"破例授权 X 代办 Y"或同等措辞，不能依据隐式默认
2. **session_notes 记账：** 当事 agent 在 progress.json `session_notes` 自己条目中明文记录"用户授权 X 在 Y 阶段代办 Z 操作"+ 时间戳 + 操作摘要
3. **角色身份不变：** 越界 ops 仅本批次本步骤生效，不视为角色切换；当事 agent 仍按原角色后续操作

**反面：** 越界 ops 后忘记 session_notes 记账 → 后续 Planner / 接手 agent 误以为有 process bug，浪费排查时间。

**来源：** BL-031 verifying 阶段 staging 1 行 orphan asset 待镜像 email_template，用户「C1b 破例授权代办 Planner ops」让 Reviewer (CLI as Codex) 跑 SQL 镜像。Reviewer session_notes 记账规范 → Planner done 阶段读到无歧义。同期 BL-031 用户授权 CLI agent 临时担任 Reviewer 角色（项目方向 B 限制 Codex 仅当 evaluator）也属此模式。

---

## 角色文件多副本一致性（v0.9.9 — BL-032 沉淀）

项目同时存在多份 Generator/Evaluator/Planner 角色定义文件时（如项目根 `./generator.md` + `.auto-memory/role-context/generator.md` + `framework/harness/generator.md` 三份），**Planner 修订任一角色文件时必须 grep 全部副本同 commit 一致更新**。否则 Generator 严格按字面执行会撞硬冲突卡死。

```bash
# 修订 Generator 角色前必跑
find . -name 'generator.md' -not -path '*/node_modules/*' -not -path '*/.git/*'
# 三份同步措辞，差异仅限"项目特定"vs"框架通用"维度
```

**反面：** BL-032 building 启动 Generator johnsong 识别 `./generator.md` line 10「不写任何测试」与 `.auto-memory/role-context/generator.md`「测试代码由 Generator 提供脚本/调用」直接冲突 → 停工等仲裁，多 1 轮往返。Planner 仲裁后两份同时矩阵化。

**来源：** BL-032 角色冲突 + 历史角色文件演进不同步多次（v0.9.6 时已有 evaluator.md 三份不同步事故）。

---

## Generator 越界界定

Planner 在 building / fixing / done 阶段发现 Generator 行为时，按以下边界判断是否越界：

| 行为 | 是否越界 | 处置 |
|---|---|---|
| 改 features.json 自己 feature 的 status: completed | ✅ 允许 | 这是 Generator 正常 step 5 |
| 改 features.json 其他 feature 的 acceptance 文字 | ❌ 越界 | 提请 Planner 修订 spec（Planner P3 规则） |
| 修复 Reviewer 反馈的 PARTIAL feature | ✅ 允许 | fixing 模式正常职责 |
| 在 fixing 阶段顺手修不在 evaluator_feedback 中的其他 bug | ❌ 越界 | 入 backlog 留独立批次（commit message 拆 commit 标 `fix(<batch>-FXXX):`） |
| 写测试代码（与实现同 commit）| ✅ 允许 | Generator 测试边界矩阵第 1+5 行 |
| 写 docs/test-cases/ 测试用例文档 | ❌ 越界 | Evaluator 职责，Generator 不碰 |
| 写 docs/test-reports/ signoff | ❌ 越界 | Evaluator 职责，Generator 不碰 |
| 执行 staging deploy（building→verifying 前置 deploy） | ✅ 允许 | Generator 切阶段前置义务（除非 docs-only 批次豁免） |
| 改 framework/ 文件（非追加 proposed-learnings.md） | ❌ 越界 | 仅 Planner 在 done 阶段处理 sediment |
| 改 harness-rules.md 铁律 | ❌ 越界 | 任何铁律变更必须 Planner + 用户 ack |

**铁律 #10 commit-tag 一致性触发：** `feat(<batch>-F<num>)` 标签必须能对应 features.json 实际条目。Generator 在 F003 commit 内顺手改 F004 文件 = 越界，需 revert + 重做。

**仲裁路径：** Planner 发现 Generator 越界 → 在 evaluator_feedback / planner-arbitration commit message 中明示越界范围 → 要求 Generator revert 越界部分 → 不计入本批次质量评分（属流程问题不属代码质量）。

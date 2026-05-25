---
scope: framework-generic
last-updated: 2026-05-25
---

# Planner 工作流（启动 / 阶段流转 / done 收尾）

> 本文件是 `framework/harness/planner.md` 拆分的 3 部分之一，专责**流程性指令**。
> 裁决规则见 [planner-arbitration.md](planner-arbitration.md)；spec 起草 checklist 见 [planner-checklists.md](planner-checklists.md)。

## 你的唯一任务
把用户的需求拆解为具体、可逐条实现、可验证的功能列表，并准备好开发所需的规格文档。

## 执行步骤

### 0. 读取需求池 + 用户反馈
启动新批次前，依次读取：

**0a. 用户反馈（`docs/test-reports/user_report/`）**
- 检查该目录是否有新增或未处理的反馈报告
- 有 → 向用户展示报告摘要和关键问题，询问是否纳入本批次
- 用户反馈是需求的重要来源，尤其是 P0/P1 级别的 DX 问题应优先考虑

**0b. 需求池（`backlog.json`）**
- 如果有待处理条目，向用户展示列表，询问本批次要包含哪些
- 用户选取后，将选中条目并入本批次的 features.json
- 选中的条目从 backlog.json 中移除（未选的保留）
- 如果 backlog 为空且无用户反馈，直接询问用户新需求

### 1. 深入理解需求
向用户提出以下问题（如果 progress.json 中已有 user_goal 则跳过）：
- 这个功能要解决什么问题？
- 主要用户是谁，他们会做什么操作？
- 有没有你特别想要或特别不要的功能？

### 2. 编写规格文档（按批次类型判断）

**新功能批次（硬性要求）：** 必须在 `docs/specs/` 下创建规格文档后才能进入 building 阶段。
文件名：`[批次名称]-spec.md`，内容包含：
- 背景与目标
- 功能范围
- 关键设计决策
- 接口/数据模型说明（如有）

**Bug 修复批次（软性）：** spec 可省略，features.json 的 acceptance 标准即为 Generator 的实现依据。
如省略，`docs.spec` 填 `null`。

### 2.5 检查 Stitch 设计稿（UI 页面变更时必须）

如果本批次涉及 **UI 页面的架构变更**（数据模型重构、页面新增/合并/拆分），必须：
1. 检查 Stitch 项目中是否有对应页面的设计稿
2. 有 → 追加一条 "更新 Stitch 设计稿" 的功能条目到 features.json
3. 无 → 评估是否需要新建设计稿（新页面建议先设计再编码）

**不做此检查会导致设计稿与代码架构脱节，后续需要额外的重构轮修复。**

**功能改造批次的设计稿一致性要求：** 即使批次不是 UI 重构，只要修改了 `design-draft/` 目录下有原型的页面（如清理假数据、补全交互），其 acceptance 必须包含以下条目之一：
- 「变更后页面布局与设计稿一致」（改动未影响布局结构时）
- 「设计稿已同步更新以反映本次变更」（改动涉及布局变更时，需追加更新设计稿的功能条目）

缺少此条目 = 验收时无法检查视觉一致性，可能导致设计稿与代码脱节。

### 3. 生成功能列表
将需求展开为 5-30 条具体功能，写入 features.json。

**每条功能必须声明 `executor` 字段：**
- `"generator"`（默认）：代码实现类，由 Claude CLI 在 building 阶段完成
- `"codex"`：执行/评估类，由 Codex 在 verifying 阶段完成

executor:codex 的典型场景：压力测试执行、code review、安全审计、E2E 测试运行、性能分析报告。

```json
{
  "features": [
    {
      "id": "F001",
      "title": "编写压测脚本 scripts/stress-test.ts",
      "priority": "high",
      "executor": "generator",
      "status": "pending",
      "acceptance": "脚本存在，支持 BASE_URL，可正常执行"
    },
    {
      "id": "F002",
      "title": "执行压测并输出报告",
      "priority": "high",
      "executor": "codex",
      "status": "pending",
      "acceptance": "报告文件已生成，包含所有场景数据和结论"
    }
  ]
}
```

### 4. 按优先级排序
- high：核心功能，没有它项目无法使用
- medium：重要但非必须的功能
- low：锦上添花的功能，最后实现

### 5. 角色分配（多 agent 环境）

如果项目根目录存在 `.agents-registry` 文件，读取可用 agent 列表，在写入 progress.json 前向用户展示并询问：

```
可用 agent：
  CLI: Kimi, Johnsong
  Codex: Reviewer

本批次角色分配：
  Generator → ?（默认：当前 agent）
  Evaluator → ?（默认：Reviewer）
```

1. 用户指定后写入 `role_assignments`
2. 用户说"默认"或不指定 → 不写入 `role_assignments`，按默认映射

**校验规则（写入前必须检查）：**
- generator 和 evaluator 不能是同一个 agent-id
- 当前阶段（方向 B）：Codex 类 agent 只能被分配为 evaluator
- 指定的 agent 名必须在 `.agents-registry` 中存在

`.agents-registry` 文件不存在 → 跳过此步骤，按默认映射。

### 6. 判断批次类型并更新 progress.json

检查 features.json 中所有功能的 executor 字段：

**存在任意一条 `executor:generator`（普通批次 / 混合批次）：**
```json
{
  "status": "building",
  "user_goal": "用一句话描述用户目标",
  "total_features": 20,
  "completed_features": 0,
  "fix_rounds": 0,
  "current_sprint": null,
  "last_updated": "当前时间",
  "role_assignments": null,
  "docs": {
    "spec": "specs/[批次名称]-spec.md",
    "test_cases": null,
    "signoff": null,
    "framework_reviewed": false
  },
  "evaluator_feedback": null
}
```

**全部为 `executor:codex`（Codex-only 批次，跳过 building）：**
```json
{
  "status": "verifying",
  ...（其他字段相同）
}
```

## 完成标准（planning → building / verifying）
- `docs/specs/` 下规格文档已创建（新功能批次硬性要求，Bug 修复可省略）
- features.json 已创建，每条功能均有 `executor` 字段
- progress.json 已更新为 `building` 或 `verifying`（取决于批次类型）

---

## 阶段转换 + fix_rounds 计数语义（D12，BL-071 lock）

**fix_rounds 的定义：** `verifying → fixing → reverifying` 的循环次数，**不是**任意 fix commit 数。

**语义边界（按状态机入口计数）：**

| 状态机事件 | fix_rounds 动作 |
|---|---|
| `verifying`（首轮）查出问题 → 切 `fixing` | 不计（仍是 first attempt） |
| `fixing` 完成 → 切 `reverifying` | **fix_rounds += 1** |
| `reverifying` 查出问题 → 切回 `fixing` | 不计（已计在上一轮 reverifying 入口） |
| `reverifying` 全 PASS → 切 `done` | 不计（终态） |
| building 阶段 Generator 自测发现 bug → 同 commit 修 | 不计（building 内部 self-fix 不算 fix-round） |
| Generator 在 fixing 阶段为同一 PARTIAL feature push 多次 commit | 不计为多轮（同一 reverifying 入口前的多 commit 合计为 1 fix_round） |

**反例（BL-070 BL-071 lock 前历史不一致）：** BL-070 fix_rounds=4 真实含义是「4 次 reverifying 入口」，但 commit 历史含 4 reverifying + 1 verifying 的 6+ fix commit；如果按 commit 数统计会得 6，按 reverifying 入口统计得 4。**fix_rounds=4 才是正确计数**。

**为什么不按 commit 数：**
- commit 数与 reviewer 工作量不成正比（同一轮内 5 commit 还是 1 commit，reviewer 都重新跑一遍 L1+L2）
- 大型 PARTIAL 修复可能拆 N commit 但只走 1 次 reverifying，按 commit 数会高估
- 小型 commit 高估倾向让 Planner 在 done 阶段误判批次质量

**latent bug exposure 标注（v0.9.21 BL-065 沉淀）：**
fix_rounds 不直接反映本批次质量。大体量 page consolidation / IA refactor / route migration 类批次会暴露上游 latent bug（路由从未渲染 → 真实渲染暴露 latent FORMATTING_ERROR / cross-tenant query / dead import 等）。这类 fix-round 应在 signoff 中标注「latent bug exposed by F00X route migration」与本批次新引入 bug 区分。未来按二维统计：(introduced, latent) 而不仅 fix_rounds 单维。

---

## status = "done" 时的收尾流程

当 Codex 将 progress.json 置为 `done` 后，Claude CLI 接手执行以下步骤（**必须按顺序**）：

### 1. 校验并整合 project-status.md
读取 `.auto-memory/project-status.md`，检查 Generator 和 Evaluator 在过程中写入的内容是否准确完整：
- 当前批次状态是否反映 done
- 遗留问题是否有新增或解决
- 如有不一致，**覆盖写**为最终一致的版本（≤30 行）

**注意：** 不再从头重写，Generator/Evaluator 已在过程中各自更新。Planner 只做最终校验和整合。

### 2. 处理 proposed-learnings（如有）
读取 `framework/proposed-learnings.md`，逐条提交用户确认，确认后**按 inline-merge 规则**写入对应 framework 文件（详见 `framework/proposed-learnings.md` 顶部 §「写入流程」）。

### 3. 清除 role_assignments
如果 progress.json 中存在 `role_assignments`，将其设为 `null`。角色分配仅对当前批次有效，下一批次重新分配。

### 4. 询问下一批次
记忆更新完成后，告知用户本批次已归档，询问是否开始下一批次。

---

## 会话结束时更新共享记忆（每次会话通用）

每次会话结束前（包括上下文不足 20% 被迫结束时），执行：

**5a. 更新 project-status.md（如有变更）：** 检查本会话是否产生项目状态变化（批次完成、阶段推进、遗留问题变更等）。有变更 → **覆盖写** `.auto-memory/project-status.md`（保持 ≤30 行），commit 并 push。无变更 → 跳过。

**5b. 写入 session_notes：** 在 progress.json 的 `session_notes` 字段中**覆盖写**自己的条目，记录本会话的关键上下文（踩过的坑、未完成的思路、下次续接需要知道的信息）。

> 写作惯例细则将在 BL-071 F008 sediment 写入阶段补全。

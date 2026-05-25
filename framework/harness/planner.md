---
scope: framework-generic
last-updated: 2026-05-25
---

# Planner 角色指令（索引页）

> **本文件是入口索引**。v0.9.23 起 Planner 角色规则已拆分为 3 个 topic 文件，本页保留 `planner.md` 文件名仅为向后兼容（CHANGELOG / archive / harness-rules.md 状态映射继续指向本文件）。
> 实际加载顺序：先读本页 → 按场景跳转对应子文件。

## 子文件索引

| 子文件 | 一句话职责 | 何时读 |
|---|---|---|
| [planner-workflow.md](planner-workflow.md) | 启动流程 / 阶段流转 / done 收尾 / fix_rounds 计数语义 / 会话结束 5a+5b | 进入 `new` / `planning` / `done` 阶段时；判断 fix_rounds 时；会话结束写记忆时 |
| [planner-arbitration.md](planner-arbitration.md) | Pre-impl 裁决 P1-P5 / Code Review 线索 vs 真相 / 跨角色 ops / 角色文件一致性 / Generator 越界界定 | 收到 Generator 的 pre-impl 审计请求时；判断 Generator 行为是否越界时；Reviewer 反馈"全套测试红"做正交性判断时 |
| [planner-checklists.md](planner-checklists.md) | 7 铁律矩阵（含 v0.9.11-v0.9.21 全部 spec 起草核查规则）+ 数据准备 / perf / UI / i18n / 上线前 audit / Server Action 速率限制 全部 spec 起草 checklist 集合 | 起草 spec 时；spec lock 前自检时 |

## 文件名向后兼容说明

- 历史 archive / CHANGELOG / 旧 commit message / 旧 spec 内的 `planner.md` 引用一律视为指向本索引页
- 活规则（spec / readme / role-context / 其他 framework 文件）的 cross-reference 已在 BL-071 F003 全部按内容定位到新 3 子文件
- 新写 spec / planner 内部交叉引用时优先用具体子文件路径（planner-workflow.md / planner-arbitration.md / planner-checklists.md），不再用笼统 `planner.md`

## 拆分背景

本文件原为 Planner 角色规则的单文件汇总（625 LOC，混合 3 类内容：流程性指令 / 裁决规则 / spec 起草 checklist），超出易读阈值。BL-071-F003（D4 lock）按 topic 拆分为 3 子文件，本文件转为索引页（≤30 LOC）保留入口，子文件路径明示。

LOC 分布：planner-workflow.md ~217 / planner-arbitration.md ~160 / planner-checklists.md ~321 / 索引页本身 ~30 = 合计 ~728 LOC（含 cross-ref / banner / 索引段，比原 625 LOC 略增源于 D12 fix_rounds 新段 + Generator 越界界定新表）。

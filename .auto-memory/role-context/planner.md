---
name: role-context-planner
description: Planner 角色行为规范 — 需求处理、框架维护、收尾流程（不存计划和进度）
type: feedback
---

## 需求处理

- 新批次启动前必读：`docs/test-reports/user_report/`（用户反馈）+ `backlog.json`（需求池）
- 用户反馈中的 P0/P1 级 DX 问题应优先纳入下一批次
- 涉及 UI 页面架构变更时，检查设计稿是否已同步，未同步则追加更新设计稿的功能条目
- 功能改造批次的 acceptance 必须包含设计稿一致性检查项（除非明确为「布局变更」）

## 角色分配

- 项目根存在 `.agents-registry` 时，展示可用 agent 列表，询问用户分配
- 校验：generator ≠ evaluator；Codex 类 agent 只能担任 evaluator
- 用户说"默认"或不指定 → 不写 `role_assignments`，按默认映射

## done 收尾

1. **校验** project-status.md 是否准确完整（不重写，整合不一致处即可）
2. 处理 `framework/proposed-learnings.md`，逐条提交用户确认
3. 清除 progress.json 中的 `role_assignments`
4. 询问下一批次

## 框架维护

- 即时提出：影响当前决策的规则变更，对话中提出 → 用户确认 → 立即写入
- 后台队列：不紧急的，追加到 `framework/proposed-learnings.md`
- **不得未经用户确认直接修改 `framework/` 文件**（proposed-learnings.md 除外）

## IA refactor 类批次 redirect 清单（2026-05-13 BL-064 沉淀，v0.9.21）

spec 起草时对每条预期 redirect 标注 destination route 的 wire-readiness：
- ✅ destination 已 wire 该 content → spec 列入 redirect
- ⏸️ destination 仅 embed-old 占位 → kept deep-link 优先，推迟到后续批次 wire 后再启 redirect
- ⚠️ destination 部分 wire（如 form 已 wire 但 list 未 wire）→ 按 sub-path 拆分

redirect scope 缩减不计质量。完整：`framework/harness/generator.md §9`。

## fix-rounds 数解读（2026-05-13 BL-065 沉淀，v0.9.21）

大体量 page consolidation / route migration 类批次 fix-round 可能来自 **latent bug exposed by route migration**（如老路由 302 掩盖 6 个月的 next-intl FORMATTING_ERROR，新路由真实渲染暴露）。这类 fix-round 应在 signoff 中标注「latent bug exposed by F00X route migration」与本批次新引入 bug 区分；done-phase 评分不应统一按 fix_rounds 单维。完整：`framework/harness/planner-workflow.md §"阶段转换 + fix_rounds 计数语义"`（BL-071 F003 拆分后位置）。

## Planner 子文件入口（BL-071 F003 D4 lock）

`framework/harness/planner.md` 已拆为索引页 + 3 子文件：
- `planner-workflow.md` — 启动流程 / 阶段流转 / done 收尾 / fix_rounds 计数 / 会话结束 5a+5b
- `planner-arbitration.md` — Pre-impl 裁决 P1-P5 / 跨角色 ops / 角色文件一致性 / Generator 越界界定
- `planner-checklists.md` — 7 铁律矩阵 + spec 起草 checklist 集合（数据准备 / perf / UI / i18n / 上线前 audit / Server Action rate-limit）

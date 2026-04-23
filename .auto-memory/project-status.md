---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=fixing（Evaluator 2026-04-23 第2轮复验）
  - 已通过：F001（AccessRequest DB+migration）/ F002（/login 同源重定向修复）/ F003（request-access flow）
  - 待修复：F004 仍缺视觉基线产物（验收要求 `/en/login` + `/en/request-access` baseline）
  - 当前仓库 visual baseline 仅 `tests/screenshots/baseline/dashboard.png`

## 角色分配（BAux1）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- BAux1 完成签收后进入 B1 KOL Database

## 已完成批次
- BI3-domain-and-tls ✅
- BI2-deployment-automation ✅
- BI1-test-infrastructure ✅
- B0-foundation ✅

## 环境提醒
- 生产 DB：`kolmatrix`
- staging DB：`kolmatrix_staging`

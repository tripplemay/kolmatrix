---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=fixing（Evaluator 2026-04-23 第1轮复验）
  - 已通过：F001（AccessRequest DB+integration）/ F003（request-access 页面恢复 200）
  - 待修复：F002（`/login` 仍 307 到 `http://localhost:3000/en/login`）
  - 待修复：F004（coverage+integration 全绿，但 e2e 在 3099 流程下仍 webServer 冲突/ready 超时）

## 角色分配（BAux1）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- BAux1 修复并签收后进入 B1 KOL Database

## 已完成批次
- BI3-domain-and-tls ✅
- BI2-deployment-automation ✅
- BI1-test-infrastructure ✅
- B0-foundation ✅

## 环境提醒
- 生产 DB：`kolmatrix`
- staging DB：`kolmatrix_staging`

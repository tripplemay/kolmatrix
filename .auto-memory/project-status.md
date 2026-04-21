---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=fixing（Evaluator 2026-04-21 首轮复验未通过）
  - F001-F004 已全部回退 pending，等待 Generator 修复后进入 reverifying
  - 关键失败：
    - `/en/request-access` = 500（`resend` 依赖缺失）
    - integration `admin.accessRequest` 为 undefined（access_request 用例 3/3 fail）
    - `/login` 错误 307 到 `http://localhost:3000/en/login`
    - `playwright.config.ts` 固定 `3000` 与 Codex `3099` 测试流程冲突

## 角色分配（BAux1）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- BAux1 修复完成并签收后进入 B1 KOL Database

## 已完成批次
- BI3-domain-and-tls ✅
- BI2-deployment-automation ✅
- BI1-test-infrastructure ✅
- B0-foundation ✅

## 环境提醒
- 生产 DB：`kolmatrix`
- staging DB：`kolmatrix_staging`

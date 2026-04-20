---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI2-deployment-automation** ✅ 已完成签收（status=done, 8/8 PASS）
  - 关键闭环：F002 zero-downtime（本地/公网 60× probe + reload 全 200）
  - 关键闭环：F006 rollback 三分支全覆盖，exit 2 drill 通过（受控 stub + trap 恢复）
  - 关键闭环：F008 runbook 手动 fallback 全流程在 VPS 实操成功
  - Signoff：`docs/test-reports/BI2-deployment-automation-signoff-2026-04-20.md`
- **BI1-test-infrastructure** ✅ 已完成签收
- **B0-foundation** ✅ 已完成签收

## 角色分配（BI2）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- BI3 域名 TLS + Staging → B1 KOL Database → B2+

## 关键环境提醒
- 生产数据库命名固定：`kolmatrix`
- 仍待用户补全：`AIGCGATEWAY_API_KEY`（B2 前）、`RESEND_API_KEY`（B4 前）

## 已知非阻塞项
- Next 16 `middleware.ts` → `proxy.ts` 迁移待后续批次
- 多语言 ja/ko/es 文案待翻译

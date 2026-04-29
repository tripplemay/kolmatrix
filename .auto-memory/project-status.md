---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前状态
- 无活跃批次。最近完成：**B4-email-template-library**（done，2026-04-29 签收）
- 6/6 features completed，fix_rounds=0
- 签收：`docs/test-reports/B4-email-template-library-signoff-2026-04-29.md`
- Evaluator staging 验证通过（git_sha=31ab6c0）

## 等待
- 用户指定下一批次方向

## Backlog 剩余（3 条 / 全部 deferred 或 low）
- **BL-003** /en 裸路径 404（deferred；正常用户走 / → /en/dashboard 不受影响）
- **BL-011** /api/kols/[id] 路由统一（low / Post-MVP refactor）
- **BL-012** KOL crawler API sync worker（deferred；M5 ~2026-06-25 联调，B6 已留接入插槽）

## MVP 路线
- MVP 上线目标：2026-05-14（PRD §1）
- 主功能链已落地（KOL Discovery / Database / Campaign / CRM / ROI / Outreach / 周报 / Email Template Library）
- 后续可选：邀请发送批次 / Post-MVP polish / KOL 爬虫团队接入

## 关键决策（详见 docs/adr/）
- ADR-001 Option α infra-first / ADR-002 技术栈最新版 / ADR-003 像素级还原 ±2px/ΔE<2
- ADR-007 多租户 RLS 策略 / ADR-009 aigcgateway 集成 / ADR-010 kolquest.com 品牌域

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

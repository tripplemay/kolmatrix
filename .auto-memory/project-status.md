---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---

## 当前批次
- **MVP-internal-demo-prep** — `fixing`（2026-05-01 Reviewer reverify）
- `fix_rounds`: 1
## Reviewer 结果
- L1 本地验证 PASS：`knowledge-base/__tests__/actions.test.ts`、`outreach/__tests__/customize-action.test.ts`、`dashboard/email-performance.test.ts`、`dashboard/recent-activity.test.ts`、`tests/integration/seed-demo-products.test.ts`、`tests/integration/outreach-customize-errors.test.ts`
- L2 prod smoke: Dashboard / Discovery / KOL detail / Knowledge Base / CRM / ROI / weekly report / locales mostly PASS
- 关键阻塞：prod `/api/health` `git_sha=4a3249b`，但当前 `HEAD=e388082`
- 关键阻塞：Outreach C-10 仍无法端到端完成，prod seed 里「有邮箱的 campaign」与「有 product 的 campaign」未同时满足
## 当前缺陷
- 1 个 High：prod 版本未对齐当前 `HEAD`
- 1 个 High：Outreach seed 组合不足，无法完成 AI customize + send smoke
## 待办
- Generator 处理 prod redeploy / seed 对齐
- Reviewer 复验 C-10 与最终 signoff

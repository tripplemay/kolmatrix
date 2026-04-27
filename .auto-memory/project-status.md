---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-visual-fidelity-hotfix** — status=fixing（2026-04-27 Reviewer 首轮验收）
- 进度：7 features 中 3 completed，4 退回 pending（F002/F003/F004/F005）
- 报告：`docs/test-reports/MVP-visual-fidelity-hotfix-verifying-2026-04-27.md`

## 已验证通过
- L1：typecheck/lint、unit(2/4)、integration(2/11) 全 PASS
- L2 staging：preflight healthy（git_sha=5dbcb07），E2E 7 PASS
- F001/F007 静态条款：render-stitch-previews 18/18、baseline 13 张含 en-kols-detail、kols-detail visual case 存在

## 当前阻断（需 Generator 修复）
- F002：缺 `tests/e2e/discovery-fidelity.spec.ts`
- F003：缺 `tests/e2e/database-fidelity.spec.ts`
- F004：acceptance 要 `tests/integration/campaigns-list-filter.test.ts`，实际为 `campaigns-list-filter-combo.test.ts`
- F005：acceptance 要 `tests/integration/campaign-detail-rsc-boundary.test.ts`，实际为 `tests/unit/campaign-detail-rsc-boundary.test.ts`

## 遗留关注
- visual-regression 在 darwin 按平台策略 skip（Linux canonical）

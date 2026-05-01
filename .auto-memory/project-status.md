---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---

# Project Status — KOLMatrix

**Last Updated:** 2026-05-01 (johnsong fix-round 1)
**Sprint:** MVP-internal-demo-prep | **Status:** reverifying | **fix_rounds:** 1

## Reviewer 报告分类（verifying-2026-05-01）
- **类型 1（报告自身漏洞）:** A-03 git_sha 期望值 stale，复验时现场填
- **类型 2（checklist 陈旧）:** C-03 /database 三卡名与代码不一致（AI Intelligence/Coverage Gap/Engagement vs 报告期望的 Market Intel/Campaign Timing/Budget Benchmark）
- **类型 3（真 bug，本轮已修）:** C-05.1+C-05.2（Knowledge Base 6 vs 5 + 缺 Generate AI 按钮）/ C-10（Outreach AI customize campaign_no_product）
- **类型 4（偶发）:** C-13 Weekly report stuck — 复验重试

## Deploy Status (2026-05-01 fix-round 1)
✅ Staging deploy 4a3249b: healthy / productsRemoved=15 / campaignsLinkedToProducts=3
✅ Prod deploy 4a3249b: healthy / redis=not_used
✅ Prod seed: products=5 / productsRemoved=1（Reviewer 第 6 个 leftover 清掉）/ campaigns 全关联

## Ready for Reviewer Reverify
- prod git_sha = 4a3249b（本地 HEAD 一致）
- F005 checklist: docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md
- 复验报告建议路径: docs/test-reports/MVP-internal-demo-prep-reverifying-2026-05-01.md

## CI Infrastructure (新增本会话)
- `.github/workflows/seed-prod.yml`（昨日加）
- src/lib/dashboard/__tests__/* 单元测试（覆盖率 79.42% → ≥80%）
- src/app/[locale]/(app)/outreach/__tests__/* 单元测试

## Backlog
9 entries: BL-003/011/012/014/015/016/017/018/019 + BL-020/021/022 (all Post-MVP)

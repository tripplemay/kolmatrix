---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔁 BL-082-refresh-selector-rewire REVERIFYING (6/7, fix_rounds=1)
- Generator F001-F006 完成；staging 旁证强（deploy 9ffee8d + platform_user_id 回填 1859 + refreshCount 253，全平台 requested==refreshed，404=0%）
- fix-round 1：Codex F007 首轮 L1 FAIL（kol-sync-daily.test.ts 2 refresh-phase case 红，refreshCount=0）
- 实根因=测试夹具 date-dependent flaky（非 tenant null）：pickTieredRefreshIds 按 `dayOfYear%3` 分桶，单候选行仅 1/3 天入当日桶 → 6/04 过 6/05 红
- 已修：makeRefreshPrisma 返 6 行同 platformUserId → 当日桶恒非空，date-independent；0 产品代码改动。Node20 npm test 1423 passed / tsc=0
- Reviewer 报告：`docs/test-reports/BL-082-verifying-2026-06-05.md`；待 Codex 复验
## ✅ BL-081-kol-country-data-fix DONE (signoff @ 2026-06-04)
- signoff: `docs/test-reports/BL-081-signoff-2026-06-04.md`
- prod country LLM 已降到 `83/day`, retry-storm backlog = `0`
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd)
- Resume trigger: 用户通知 `public/landing/illustrations/` ≥6/8 PNG 就绪
## 用户手工待办
1. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
2. BL-080 素材就绪后恢复 landing illustration 批次

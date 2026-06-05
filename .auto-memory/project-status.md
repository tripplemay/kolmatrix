---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-082-refresh-selector-rewire DONE (signoff @ 2026-06-05 11:12 CST)
- signoff: `docs/test-reports/BL-082-signoff-2026-06-05.md`
- Reviewer 终签：Node20 下 L1 全绿（`npm test` 1423/1423，`kol-sync-daily` refresh-phase 12/12，`tsc`/`prisma`/rollback validate PASS；`lint` 仅 3 个既有 unused warnings）
- staging 证据成立：deploy `9ffee8d` + platform_user_id 回填 1859 + refreshCount `253`（YT91/TT127/IG35）+ requested==refreshed 全平台 + `404=0%`
- prod 证据成立：deploy `0d353bd` (= main) + platform_user_id 非空 YT716 / TT1477 / IG178 + 手动 daily-sync refreshCount `251`（YT90/TT127/IG34）+ `failedAdapters=0` + `refresh_404_skip=0` + `import_failed=0`
- 旁证：近 15min `last_synced_at` 更新 2371 行，refresh→import 链路在 prod 已生效
- 经验记录：refresh-selector 测试夹具必须避免 date-dependent 单样本分桶，否则会出现 1/3 天复现的 flaky
## ✅ BL-081-kol-country-data-fix DONE (signoff @ 2026-06-04)
- signoff: `docs/test-reports/BL-081-signoff-2026-06-04.md`
- prod country LLM 已降到 `83/day`, retry-storm backlog = `0`
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd)
- Resume trigger: 用户通知 `public/landing/illustrations/` ≥6/8 PNG 就绪
## 用户手工待办
1. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
2. BL-080 素材就绪后恢复 landing illustration 批次

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔁 BL-082-refresh-selector-rewire REVERIFYING (6/7, fix_rounds=1)
- Generator F001-F006 完成；staging 旁证强（deploy 9ffee8d + platform_user_id 回填 1859 + refreshCount 253，全平台 requested==refreshed，404=0%）
- fix-round 1 已被 Reviewer 复验通过：`kol-sync-daily.test.ts` 上轮红掉的 2 个 refresh-phase case 已转绿；Node20 全量 L1 也已恢复全绿（npm test 1423/1423）
- staging 复验通过：health healthy + Playwright `/match` 两条 smoke PASS
- prod 已部署 0d353bd（= main）+ platform_user_id 回填完成（Generator 6/05 跑 backfill：stamped 2371，YT=UC% 716/716 / TT·IG 数字全对，filled 2371/2383）
- 剩余：等下次 daily cron（08:30 BJ）跑 refresh phase → Codex 复验 prod refreshCount>0/全平台/404率≤5% → signoff（或手动跑 prod daily-sync 取即时证据）
- Reviewer 报告：`docs/test-reports/BL-082-verifying-2026-06-05.md` + `docs/test-reports/BL-082-reverifying-2026-06-05.md`
## ✅ BL-081-kol-country-data-fix DONE (signoff @ 2026-06-04)
- signoff: `docs/test-reports/BL-081-signoff-2026-06-04.md`
- prod country LLM 已降到 `83/day`, retry-storm backlog = `0`
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd)
- Resume trigger: 用户通知 `public/landing/illustrations/` ≥6/8 PNG 就绪
## 用户手工待办
1. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
2. BL-080 素材就绪后恢复 landing illustration 批次

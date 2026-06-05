---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-083-yt-business-email-mapper DONE (7/7, fix_rounds=1, signoff 6/05)
- F001-F007 全 PASS. prod emails 填充率 0.8%→30.3% (219/722 YT KOL), all business-unlock
- fix_rounds=1: F001 sanitizeForkEmails 直测 6 case (colocated __tests__, Reviewer grep tests/ 误判)
- staging backfill 219 rows / prod backfill 219 rows (idempotent), legacy email 18 unchanged
- signoff: `docs/test-reports/BL-083-signoff-2026-06-05.md`
## ✅ BL-082-refresh-selector-rewire DONE (7/7, fix_rounds=1, tag bl082-done @ 133bbe0)
- prod refreshCount=251 failedAdapters=0 / staging 253/0%404
## ✅ BL-081-kol-country-data-fix DONE (6/6, tag bl081-done @ 7bfeacb)
- prod LLM 83/天, 成本 $0.075/天
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd) — 等用户跑 AI gen PNG
## ✅ BL-079 / BL-078 / BL-077 / BL-076 / BL-075 / BL-074 / BL-073 / BL-072 / BL-071 / BL-070 / BL-069-059 / BL-055-049 / 043+044 全 DONE
## 用户手工待办
1. TikHub 新 token 重发 (旧 token 仍 working)
2. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog
- BL-080 (paused, 等用户 PNG)
- Phase 5: 个性化学习 / Brief 模板库 / comparative query
- BL-054 flaky network test isolate / BL-048 valueScore 区分度

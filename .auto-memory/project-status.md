---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-083-yt-business-email-mapper VERIFYING (6/7 generator done, fix_rounds=0) — 交 Codex F007 L1+L2+signoff
- F001 mapper 接 emails / F002 schema (emails JSONB + 复用 email_source) / F003 import upsert / F004 UI detail+/match filter / F005 outreach 优先级 / F006 backfill ✅ 全 done
- staging deployed @ eb584dd (=main HEAD); CI green (E2E baseline en-kols-detail.png 经 update-visual-baselines workflow regen 修复)
- staging + **PROD 均已部署 @ 96ca150** (用户 6/05 授权 prod deploy run 26995519849); backfill apply staging 219 + **prod 219 行** (幂等)
- **prod 量化达标**: active YT 722, emails fill 0.8%→**30.3%** (219 行 business-unlock), legacy email 18 行未动
- L1: tsc=0 / lint 0err / 1463 tests; Codex 待 L2 staging UI 实测 + prod 只读核验 + signoff
- 关联 docs/specs/BL-083-yt-business-email-mapper-spec.md, generator_handoff 详见 progress.json
## ✅ BL-082-refresh-selector-rewire DONE (7/7, fix_rounds=1, tag bl082-done @ 133bbe0)
- prod refreshCount=251 (YT90/TT127/IG34) failedAdapters=0 404率=0% / staging refreshCount=253/0%404
- signoff: `docs/test-reports/BL-082-signoff-2026-06-05.md` (Reviewer 11:12 CST)
- fix_rounds=1: F007 verifying FAIL = date-dependent test 夹具 flaky (pickTieredRefreshIds dayOfYear%3 桶 + 单候选行 1/3 概率落空) → Generator 修 makeRefreshPrisma 返 6 行 → reverifying PASS
## ✅ BL-081-kol-country-data-fix DONE (6/6, tag bl081-done @ 7bfeacb)
- prod LLM 83/天 (acceptance <200), 成本 $0.075/天 (降幅 83% from $0.44 baseline)
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd) — 等用户跑 AI gen PNG
- 归档 docs/archive/paused-batches/BL-080-{progress,features}.json + RESUME.md
## ✅ BL-079 / BL-078 / BL-077 / BL-076 / BL-075 / BL-074 / BL-073 / BL-072 / BL-071 / BL-070 / BL-069-059 / BL-055-049 / 043+044 全 DONE
## 用户手工待办
1. TikHub 新 token 重发 (上次给 invalid, 旧 token 仍 working 不紧急)
2. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog
- BL-080 (paused, 等用户 PNG)
- refresh-selector 已 BL-082 完成 (无需独立批次)
- Phase 5: 个性化学习 / Brief 模板库 / comparative query
- BL-054 flaky network test isolate / BL-048 valueScore 区分度

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-084-ai-match-panel VERIFYING (8/9 gen done, fix_rounds=0) — /match?campaignId=X AI 推荐三列工作台
- F001-F008 全实现+单测 done @ a2fd5ba. L1 全绿: lint 0err/tsc=0/vitest 1505 pass/build 96/96. F009 Codex L1+L2+signoff 待接
- staging deployed @ a2fd5ba (health 200, rerank action cmq0hrq25016kbnpe2oru2qb0 env 已注入, BL-084 migration 已 apply)
- L2 入口: staging.kol.guangai.ai/match?campaignId=<真实> 默认 AI 三列; toggle 切全池. Accept/Skip/Swap/Undo/Why/drag
- 数据模型 ADR-016 (kol_campaign suggestion_status 4 态, suggested 不落库) 已起草. docs/dev/match-runbook.md 已建. 月 cost <$1
- ⚠️ staging build 需 NODE_OPTIONS=--max-old-space-size=4096 防 SIGABRT OOM (已记 environment.md)
- 关联 docs/specs/BL-084-ai-match-panel-spec.md
## ✅ BL-083-yt-business-email-mapper DONE (7/7, fix_rounds=1, tag bl083-done @ b735aad)
- prod kol_emails 0.8%→30.3% (219 business-unlock), legacy 18 不变
- signoff: `docs/test-reports/BL-083-signoff-2026-06-05.md`
- fix_rounds=1 教训: Reviewer grep tests/ miss colocated __tests__ (Framework Learnings 已记)
## ✅ BL-082 DONE (7/7, fix_rounds=1, tag bl082-done @ 133bbe0) — refresh phase 重接 / prod 251 ids 0%404
## ✅ BL-081 DONE (6/6, tag bl081-done @ 7bfeacb) — country mapper bug + retry storm, prod LLM 83/天
## ⏸️ BL-080 PAUSED (1/6 @ ad14bdd) — 等用户跑 AI gen PNG
## ✅ BL-079 / BL-078 / BL-077 / BL-076 / BL-075 / BL-074 / BL-073 / BL-072 / BL-071 / BL-070 / BL-069-059 / BL-055-049 / 043+044 全 DONE
## 用户手工待办
1. TikHub 新 token 重发 (旧 token 仍 working)
2. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog
- BL-080 (paused) / Phase 5 个性化学习 / BL-054 flaky test / BL-048 valueScore 区分度

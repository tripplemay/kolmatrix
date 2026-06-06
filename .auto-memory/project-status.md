---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-084-ai-match-panel FIXING (8/9 gen done, fix_rounds=0) — /match?campaignId=X AI 推荐三列工作台
- F001-F008 全实现；Reviewer L1 PASS：prisma validate / tsc / vitest 1505 / BL-084 toggle e2e / local migration+index checks
- Reviewer 已修测试域 2 项：`tests/e2e/match-flow.spec.ts` duplicate-testid strict-mode 误报；`tests/e2e/visual-regression.spec.ts` `?campaignId` baseline 固定到 `view=full-pool`
- staging L2 PASS：2 个真实 campaign 默认 AI 入口；Accept+Undo；Skip 持久排除；Swap+Re-add；Toggle 切全池
- staging L2 FAIL：Why dialog 仅显示“详细解释暂时不可用，请稍后重试”；refresh 后出现“AI 重排暂不可用 — 按相似度排序显示。”
- prod readonly FAIL：`/opt/kolmatrix` HEAD=`96ca150`，但 `DATABASE_URL=kolmatrix` 上未应用 `20260605160000_bl_084_add_kol_campaign_suggestion_status`；`kol_campaign` 缺 `suggestion_status/suggested_at/decided_at`
- ADR-016 已起草；signoff 未写；当前等待 Generator 修复 explainability/staging env 与 prod migration 落地
- 关联 `docs/specs/BL-084-ai-match-panel-spec.md` + `docs/test-reports/BL-084-verifying-2026-06-06.md`
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

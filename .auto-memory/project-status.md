---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-084-ai-match-panel REVERIFYING (fix_rounds=1 @ 7d9cb9f) — /match?campaignId=X AI 推荐三列工作台
- fix-round 1 唯一代码修复：`DetailedExplanationDialog` 客户端超时 5s→32s（commit 7d9cb9f）。根因 gateway 日志实证：EXPLAIN_DETAILED 5locale×5段~4500token 实测 15-21s，客户端 5s 先于服务端响应触发"详细解释暂时不可用"错误态；match 面板无预热→缓存未命中 100% 必现。同修 BL-067 campaigns 页潜伏 bug。L1 全绿 tsc=0/lint=0/25 单测
- FAIL2 prod migration = 纯部署动作（deploy-prod.sh 第 6 步自动 `prisma migrate deploy`）；FAIL1b refresh rerank cosine 降级 = F002 spec 优雅降级（LLM 偶发非完美 30-排列），用户选保持现状 → backlog BL-085-obs
- ✅ **两端部署已落地（Generator 代部署 2026-06-06 ~10:40 BJT）**：staging deploy-staging run 27050108647 success+health200；prod deploy-prod run 27050228802 success+health200 HEAD=`1343ad9`。prod env 注入 rerank（已备份），prod 已有 EXPLAIN_DETAILED+SHORT env
- ✅ **prod migration 核验全 PASS（Generator 超级用户只读预核验）**：`_prisma_migrations` bl_084 finished=t / 4 列齐 / `kol_campaign_suggestion_status_idx` 存在 / legacy backfill 30 行全 accepted + decided_at 回填 0 残留 NULL / audit `backfilled_rows=30`。**FAIL2 解决**
- 复验前提已满足，Reviewer 可启：复验重点 = staging Why 弹窗显 5 段（首开 skeleton ~20s，再开 <200ms 缓存）+ Accept/Skip/Swap 闭环回归
- 洞察：environment.md "EXPLAIN_DETAILED/MATCH_RERANK 待 SSH 落入" 多为过时备注——日志/prod grep 证明已配（Planner 应更正 §AIGCGATEWAY 段）
- ADR-016 已起草；signoff 未写；proposed-learnings 已记客户端超时 vs LLM 实测延迟教训
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

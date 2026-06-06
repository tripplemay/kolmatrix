---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-086-kol-acquisition-accel BUILDING (2/6) — 提升新 KOL 入库速率（积累模式）
- ✅ F003 done: `scripts/bl086-manual-seed-harvest.ts` (读 prod 取 2535 UC id 排除 overlap → 包 `/channel/` URL → 分批 POST `/admin/seeds` manual_seed; 幂等+限速+checkpoint 可重入+dry-run). **坑**: youtube manual_seed 对非 URL 拼 `@handle`, 裸 UC id 必失败→必包 `https://www.youtube.com/channel/{UC}`. L1 tsc/lint/11单测绿 + prod dry-run total=2535/26批. 真实 feed 待充值/协调
- 🔶 F001 patch 交付 (`docs/upstream-patches/BL-086-F001-tier-accumulation-cadence.{patch,md}`): guang-tech/apify **禁 fork** + 本账号仅 **READ** → 无法开 PR, 改 git-apply patch. 本地 apify service 套件 14文件/100测试全绿. **待爬虫团队 apply/merge + sync /opt rebuild**
- ⚠️ **CI 红 = 预存 BL-084-F007 视觉 baseline 失配** (`visual-regression.spec.ts:347 match ?campaignId`, F007 改默认 AI 面板致 baseline stale); BL-084-F006 那次 CI 同样失败 = 非 BL-086 引入; 我所有代码门全绿. 测试域归 Evaluator(铁律#4/#6) → 建议 regenerate baseline (update-visual-baselines workflow)
- 剩余: F002(schedules config) / F004(告警+成本,路径B) / F005(IG排查,路径B) — 多依赖爬虫团队 merge 节奏
- 背景: 抓取慢 = refresh:discovery 配比失衡 + **TikHub 凭据问题(2026-06-06 重查修正)**. 双段验收(充值前=部署就绪/负载降; 充值后=真实速率). 文档 spec + 诊断 `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md`(§3.2 已修正) + ADR-017
- 🔴 **根因修正(2026-06-06 重查)**: 不是"忘充值". 爬虫 `.env` 有效 token 属账户 `71***@qq.com`, 实测 balance=$0.0005/free_credit=0(空); 用户记忆里的 token `yi5kiE/…rBCQ==` 多开头一个 `y` = 401 无效(有效的是 `i5kiE/…`). **待用户确认其充值账户邮箱是否=71@qq.com / 提供充值账户正确 API key**. 安全: 有效 token 在 402 调试中片段泄露, 修复后建议 TikHub 后台轮换
## ✅ BL-084-ai-match-panel DONE (9/9, fix_rounds=1, signoff @ d10351c) — /match AI 推荐三列工作台; prod 两端部署+migration核验 PASS
## ✅ BL-083 DONE (tag bl083-done @ b735aad) / BL-082 / BL-081 / BL-080⏸️PAUSED(1/6 等AI gen PNG) / BL-079-043 全 DONE
## 用户手工待办
1. **P0: TikHub 凭据/账户修正(等用户)** — 确认充值账户邮箱(是否=71@qq.com)/给充值账户正确 API key; 拿到后 Planner 先验证账户+余额再换 `.env` 重启. (注: 71@qq.com 实测空; 用户记忆 token 多个 `y` 无效)
2. 路径B需爬虫团队 merge 上游 PR — 建议提前知会
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog (BL-088 质量门放宽/软删清理 · BL-089 爬虫策略配置页deferred · BL-058 fork数据 · BL-054 flaky · BL-048 valueScore)

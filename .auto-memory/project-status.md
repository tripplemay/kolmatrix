---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-086-kol-acquisition-accel BUILDING (5/6 gen done, F006=codex) — 提升新 KOL 入库速率（积累模式）
- 全部 5 个 generator feature 完成. 3 个 apify PR 待 team merge: #3(F001 tier) #4(F005 节流) #5(F004 余额). #4/#5 同改 tikhub-client.ts get() 后 merge 者需 trivial rebase. 充值后 F006 双段验收(部署就绪 + 真实速率)
- ✅ F002 done(applied): `scripts/bl086-f002-discovery-seeds.ts` via /admin/schedules, prod schedules 30→48 (砍8空转+4高产TT limit→300+18手游种子 free fire/mobile legends/pubg mobile/garena/minecraft/roblox×TT+YT). 快照 `docs/upstream-patches/BL-086-F002-schedules-snapshot-pre.json` 可回滚
- 🔶 F001 done(PR): guang-tech/apify#3 (用户授write权限后开), 本地apify套件14文件/100测试绿, **待team merge+sync /opt rebuild**
- ✅ F003 done(脚本): manual-seed-harvest, prod dry-run 2535/26批. **真实feed待充值**(SDK证实充值前投喂被worker消耗成succeeded-0=白做)
- ✅ F004 done: kolmatrix告警(classifyDailyRun balance-ALERT + inserted=0 WARN) + **PR guang-tech/apify#5**(余额暴露 getAccountInfo→/admin/stats tikhubBalanceUsd, SDK getEnvelope 取非标准 user_data envelope, SDK46+service100测试). 成本记账→backlog BL-090(TikHub 无每请求成本)
- ✅ F005 done: **PR guang-tech/apify#4**(IG hashtag 429 根因=per-author 密集突发触发账户级限流, fork DB 实证 68 jobs; 修=TikHubClient minIntervalMs 全局节流 default 350ms, SDK44+service100测试)
- ✅ **CI 全绿(run 27065137715)**: 代码门 + E2E 全 success. BL-084-F007 测试债彻底清: 视觉baseline重生成(8ff396f) + `match-flow:733` refine bar 断言移到 view=full-pool(046cbfa, 用户授权直接修). 此前 visual 失败掩盖 chromium 未跑
- ✅ F003 done: `scripts/bl086-manual-seed-harvest.ts` (读 prod 取 2535 UC id 排除 overlap → 包 `/channel/` URL → 分批 POST `/admin/seeds` manual_seed; 幂等+限速+checkpoint 可重入+dry-run). **坑**: youtube manual_seed 对非 URL 拼 `@handle`, 裸 UC id 必失败→必包 `https://www.youtube.com/channel/{UC}`. L1 tsc/lint/11单测绿 + prod dry-run total=2535/26批. 真实 feed 待充值/协调
- 🔶 F001 **PR 已开 https://github.com/guang-tech/apify/pull/3** (用户授 write 权限后从同仓分支开). 本地 apify service 套件 14文件/100测试全绿. **待爬虫团队 review+merge → sync /opt rebuild**. patch 备份留 `docs/upstream-patches/`
- ✅ **CI 视觉 baseline 已修** (BL-084-F007 遗留): update-visual-baselines workflow 重生成 commit `8ff396f` 只改 `en-match-with-campaign.png` 一张; bot commit 不自触发 CI, 下次代码 commit 触发即转绿(高置信). 代码门一直全绿
- 剩余: F002(schedules config) / F004(告警+成本,路径B) / F005(IG排查,路径B) — 多依赖爬虫团队 merge 节奏
- 背景: 抓取慢 = refresh:discovery 配比失衡 + **TikHub 凭据问题(2026-06-06 重查修正)**. 双段验收(充值前=部署就绪/负载降; 充值后=真实速率). 文档 spec + 诊断 `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md`(§3.2 已修正) + ADR-017
- ✅ **根因确认(2026-06-06, 用户+爬虫团队核实)**: 就是**没充值**. 爬虫 `.env` token **有效**, 账户 `71***@qq.com` **正确**(实测当时 balance=$0.0005 空), 用户正往该账户充值. (注: 用户先前手贴的 `yi5kiE/…` 多开头一个 `y` 系记忆笔误=401, 与部署值无关). 充值后 Planner 复查余额>0 → 爬虫自动/重启恢复. 安全: token 曾在 402 响应片段泄露, 建议事后 TikHub 后台轮换
## ✅ BL-084-ai-match-panel DONE (9/9, fix_rounds=1, signoff @ d10351c) — /match AI 推荐三列工作台; prod 两端部署+migration核验 PASS
## ✅ BL-083 DONE (tag bl083-done @ b735aad) / BL-082 / BL-081 / BL-080⏸️PAUSED(1/6 等AI gen PNG) / BL-079-043 全 DONE
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`(进行中)** — token+账户已确认正确, 纯粹没钱. 用户充值后通知 → Planner 复查 `get_user_info` 余额>0 → 重启容器清欠账恢复 + F003 真实投喂 2535 id
2. 路径B需爬虫团队 merge 上游 PR — 建议提前知会
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog (BL-088 质量门放宽/软删清理 · BL-089 爬虫策略配置页deferred · BL-058 fork数据 · BL-054 flaky · BL-048 valueScore)

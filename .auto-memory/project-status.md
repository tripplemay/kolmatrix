---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-091-yt-email-unlock-fix VERIFYING (交 Codex F004) — 修活 Apify YT 邮箱解锁
- 背景: 链路代码完整但**从没跑过**(records=0); 两 bug + backfill + (实跑追加)F005 poll 超时调优
- **PR #6(BugA)/#7(BugB)/#8(F003)/#9(F005)全 merge → master 4d102f1**(用户授权)。/opt rebuild 已完成(无 OOM, avail 5.4G), worker 起新日志 "poll timeout 300000ms", /health ok, ports 3004 OK → **Bug A/B + F005 已 prod 生效**
- **F003 backfill drain 完成(最终)**: records 342 → succeeded 339 / failed 1 / no_email 1 / queued 1, **成功率 99.1%**。**YT 邮箱覆盖 184→523(+339 真实邮箱解锁)**。120s 期 62% vs 300s 期 99% → F005 决定性。成本~$49
- ⏳ 剩余: **转 verifying 交 Codex F004**。**F001 runtime 触发验证 blocked**(需 refresh 命中 hasBusinessEmail 跃迁, 但 TikHub 余额耗尽 refresh 不跑 → 待充值/BL-092; 单测已覆盖逻辑, 建议 F004 defer 该项 runtime)
- 归档 docs/upstream-patches/BL-091-F001..F003.md(F005 并入)。kolmatrix 侧零运行时改动→staging 豁免
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — 抓取加速; 三服务部署核实(kolmatrix prod/staging @d58dabe 含F004 / 爬虫@8f9320a / 全200)
## ✅ 历史 DONE: BL-084(9/9) / BL-083 / BL-082 / BL-081 / BL-080⏸️(1/6) / BL-079-043
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`**(完成中) — 充值后通知 → 复查余额>0 → 重启容器 + 跑 BL-092(投喂2535+真实速率验证). 安全: 部署中 token 曾 402 泄露片段, 建议事后轮换
2. ~~/opt rebuild~~ ✅ 已完成(2026-06-07, 无 OOM, Bug A/B + F005 生效)
3. ~~F003 backfill 实跑~~ ✅ 已跑+rebuild后300s重跑(覆盖+107, 235 drain 中)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + 调优(等 TikHub 充值)。**+yt-email pollTimeoutMs 调优**: BL-091 实跑发现 worker 默认 120s 超时是 YT 邮箱 yield 主限制(终态只有 succeeded/timeout, no_email≈0), 提到 240-300s 或 env 可配 + 重跑 failed
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 fork / BL-054 / BL-048

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-091-yt-email-unlock-fix BUILDING (代码 3/4 完成, 仍 building 待 gate) — 修活 Apify YT 邮箱解锁
- 背景: 链路代码完整但**从没跑过**(yt_email_check_records=0); 现有 YT 邮箱大头实为 TikHub 内联。两 bug + 344 backfill
- F001 Bug A=**PR #6**(refresh-scrape false/null→true 跃迁触发, 单测6) / F002 Bug B=**PR #7**(markRunning 改 UPSERT, 单测4+集成5 真实PG绿) / F003=**PR #8**+脚本(单测7+真实PG幂等验证) → guang-tech/apify base 8f9320a。service 套件 15f/107t 绿
- F003 设计: upsertQueued 先建 queued 行 → 即使 Bug B 未部署当前 worker 也留记录 → **可独立先跑不等 #6/#7 merge**
- ⏳ **3 个前置全是 gate**(未转 verifying): (1) #6/#7 待爬虫团队 merge + /opt rebuild(OOM 风险); (2) F003 实跑约 $41 写 prod, 待用户授权(建议 --report→dry-run→--limit=10→全量)。kolmatrix 侧零运行时改动→staging 豁免
- 归档 docs/upstream-patches/BL-091-F001..F003.md。spec `docs/specs/BL-091-yt-email-unlock-fix-spec.md`
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — 抓取加速; 三服务部署核实(kolmatrix prod/staging @d58dabe 含F004 / 爬虫@8f9320a / 全200)
## ✅ 历史 DONE: BL-084(9/9) / BL-083 / BL-082 / BL-081 / BL-080⏸️(1/6) / BL-079-043
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`**(完成中) — 充值后通知 → 复查余额>0 → 重启容器 + 跑 BL-092(投喂2535+真实速率验证). 安全: 部署中 token 曾 402 泄露片段, 建议事后轮换
2. **催爬虫团队 merge BL-091 PR #6(Bug A)/#7(Bug B)/#8(backfill 脚本)** → 后 /opt rebuild(OOM 谨慎)
3. **授权 F003 backfill 实跑**(约 $41, 写 prod apify_kol + Apify actor; 可不等 #6/#7)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F004/F005 调优(等 TikHub 充值, 与 BL-091 独立)
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 fork / BL-054 / BL-048

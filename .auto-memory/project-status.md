---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-091-yt-email-unlock-fix BUILDING (0/4) — 修活 Apify YouTube 商务邮箱解锁链路
- 背景: 该链路代码完整但**从没跑过**(yt_email_check_records=0); 现有 YT 邮箱大头实为 TikHub 内联, Apify 这条死的。两 bug + 344 backfill
- F001 Bug A: 触发器只在 discovery 路径, hasBusinessEmail 由 refresh 写入→两者不相交→从没触发(爬虫/路径B, 需对齐设计: false→true 触发一次+去重, 非 refresh 每次)
- F002 Bug B: yt_email_check_records 双写失效→去重坏→重复烧 Apify(爬虫/路径B)
- F003 344 backfill: TikHub 标 hasBusinessEmail=true 但没给地址的 youtube, Apify 补缺口。**我方 ops 走 Apify(SCALE已付费)不依赖 TikHub 充值**, 已小批验证 kol6/9 解锁, 可先跑
- F004 Codex 验收。spec `docs/specs/BL-091-yt-email-unlock-fix-spec.md` + 诊断 §3.4
- ⚠️ /opt rebuild 有 OOM 风险(BL-086 遗留, 内存未根治); F001/F002 走 PR 需爬虫团队 merge
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — 抓取加速; 三服务部署核实(kolmatrix prod/staging @d58dabe 含F004 / 爬虫@8f9320a / 全200)
## ✅ 历史 DONE: BL-084(9/9) / BL-083 / BL-082 / BL-081 / BL-080⏸️(1/6) / BL-079-043
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`**(完成中) — 充值后通知 → 复查余额>0 → 重启容器 + 跑 BL-092(投喂2535+真实速率验证). 安全: 部署中 token 曾 402 泄露片段, 建议事后轮换
2. 催爬虫团队 merge BL-091 F001/F002 PR(开出后)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F004/F005 调优(等 TikHub 充值, 与 BL-091 独立)
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 fork / BL-054 / BL-048

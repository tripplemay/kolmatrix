---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-096-crawler-monitor-page BUILDING (generator code 完成, 待 merge/deploy gate) — 爬虫只读监控页
- 动机: 两次静默故障靠人肉发现 → 常驻可观测页
- ✅ **F001 code done = PR #11**(guang-tech/apify, 路径 B): /admin/stats 扩展观测字段(drain/ingestRate/composition/ytEmail/igToday/refreshBacklog/costToday)。computeAdminStats 抽离, 单测2, service122绿, prod 查询有效
- ✅ **F002 code done(commit 0bb7e35 已推 CI)**: /[locale]/admin/crawler-monitor 瘦客户端只读页(client+健康灯+recharts入库速率+构成/YT/drain/refresh/双余额卡+优雅降级)+ i18n 5locale×29keys + 单测13。L1 tsc0/lint0/glyph绿
- ⏳ **gate(待用户指示)**: (1) merge #11 + apify fork-sync rebuild(OOM); (2) **kolmatrix .env 补 APIFY_KOL_ADMIN_API_KEY**(ops, 取 fork ADMIN_API_KEY)+ kolmatrix deploy; (3) F003 codex L2 需上述就绪。F002 对旧 /admin/stats 优雅降级
- 归档 docs/upstream-patches/BL-096-F001-admin-stats-observability.md
## ✅ BL-092 DONE (3/3) — TikHub 充值后收口: refresh -85% + 2535投喂(+420 drain中) + BugA runtime触发(188) + 成本记账 ✅
- ⚠️ IG 仍 0 产出 → backlog BL-095(F005 节流未解决)

## ✅ BL-094(4/4) / BL-093(3/3) / BL-091(5/5) / BL-086(6/6) — 全部 DONE
- BL-086-F006 full: refresh -85% confirmed live + harvest 100% + cost accounting ✅
- BL-091-F001: BugA runtime trigger confirmed (188 new records) ✅

## 状态: 无进行中批次(BL-086/091/092/093/094 全 DONE)
- ✅ BL-088 已决(2026-06-08): 两项都不做(质量门不放宽 ~36条低性价比 + 2584 不硬删)。closed
## 用户手工待办
1. aigcgateway VM .git remote PAT(gho_*)轮换(安全)
## Backlog
- **BL-095**(中): IG hashtag 发现 0 产出深度排查(BL-086 F005 350ms 节流未解决, 288ref+4hash 全 0)
- BL-090-cost / BL-089 配置页 / BL-058 fork / BL-048 valueScore / BL-011 等(详见 backlog.json)

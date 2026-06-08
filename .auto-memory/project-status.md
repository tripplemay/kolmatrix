---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-096-crawler-monitor-page BUILDING (0/3) — 爬虫抓取只读监控页(platform-admin)
- 动机: 两次静默故障(TikHub余额/aigcgateway额度)靠人肉发现 → 持续可观测页面
- F001 爬虫 /admin/stats 扩展观测指标(drain/速率/邮箱/IG/refresh/成本/余额, 路径 B). F002 KOLMatrix /admin/crawler-monitor 瘦客户端渲染+健康灯. F003 Codex
- 架构 ADR-017 瘦客户端(数据归爬虫+KOLMatrix只调API). 与 BL-089 配置页区分(只读). F002 依赖 F001 部署→可先按契约开发优雅降级
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

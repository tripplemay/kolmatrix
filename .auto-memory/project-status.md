---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-097-crawler-monitor-nav-entry VERIFYING (1/2) — 给监控页加网站入口
- ✅ F001(generator,Kimi) done: UserAvatarMenu admin段加 /admin/crawler-monitor <Link> + i18n userMenu.adminCrawlerMonitor 5locale. ⚠️图标用 insights(spec建议的monitoring/monitor_heart 不在woff2 subset, fontkit验证后复用已覆盖图标避免network regen). L1全绿(UserAvatarMenu8+i18n8+glyph7, tsc0, lint clean). 纯UI+test未部署
- ✅ 已部署 staging+prod @04e5414(staging 4m54s/prod 4m23s, 无OOM). prod login 5locale 200, /admin/crawler-monitor 307(admin gate). ⏳ F002 Codex: L1复核 + L2登录后验入口可见可达 + signoff
## ✅ BL-096 DONE (3/3, fix_rounds=1, signoff @ docs/test-reports/BL-096-signoff-2026-06-08.md) — 监控页 /admin/crawler-monitor 上线
- F001 /admin/stats 扩展(PR#11→392f154)实测: manual_seed inserted **2534**(BL-092 harvest 全 drain!)/ ytEmail queued1553 / refreshBacklog5711 / cost3.58 / balance240.85. F002 瘦客户端页+健康灯+recharts 部署@ccd80d5
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

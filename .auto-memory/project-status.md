---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-092-post-charge-execution DONE (3/3, signoff @ eb6e41a) — TikHub 充值后收口
- F001 /opt rebuild 8d7cff8(无OOM) / F002 2535投喂 420/100% / F003 verified-live
- **verified-live**: apify_cost $0.566, balance $243.80, BugA 188q/12h, refresh -85%, KOLs +420
- ⚠️ IG still 0 output (288ref+4hash 全0) — F005 350ms 部署但 IG actor may need further investigation
- F002 drain 仍在进行(27/26 jobs, 420 inserted so far), full 96% hit rate TBD

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

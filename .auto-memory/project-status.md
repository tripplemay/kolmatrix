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

## 用戶手工待辦
1. **BL-088 决策**: 据 BL-094-F003 报告选质量门方案 + 是否硬删 2584
2. aigcgateway PAT 轮换

## Backlog
- IG 产出排查(BL-092 S1) / BL-090-cost / BL-089 / BL-088 实装 / BL-058

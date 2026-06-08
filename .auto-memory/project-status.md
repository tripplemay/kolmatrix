---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-094-high-value-polish DONE (4/4, signoff @ 4dcebac) — fix_rounds=0
- F001: CI flaky 完治(网络测试隔离+glyph guard), 集成 62f/372t+网络 1f/2t 全绿
- F002: apify_cost_usd PR #10 merged, /opt rebuild deferred(BL-092)
- F003: Codex prod DB 只读量化 → 806(推荐平台差异化+email加权~36条) + 2584(推荐归档CSV硬删)
- **BL-088 决策待办**: 用户据 F003 报告决定质量门放宽 + 软删清理方案 → follow-up batch

## ✅ BL-093(max_tokens hotfix, 3/3) / BL-091(YT邮箱, 5/5) / BL-086(tier+alert, 6/6)
- 🔴 TikHub 充值未到账(71@qq.com). Deferred→BL-092

## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`** — 充值后→Planner 复查→重启容器+跑 BL-092
2. **BL-088 决策**: 据 F003 报告选质量门方案(A/B/C)+ 是否硬删 2584
3. aigcgateway PAT 轮换

## Backlog
- **BL-092**(高): 充值后 F003 投喂 2535 + 真实速率验证 + F001/F002 L2 补验
- BL-090-cost / BL-089 / BL-088 实装(待决策) / BL-058

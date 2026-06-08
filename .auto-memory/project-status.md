---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-092-post-charge-execution BUILDING (0/3) — TikHub 充值后执行 + 真实速率验证
- ✅ **TikHub 已充值**(2026-06-08, 71@qq.com balance=$244.71, 端点 200, 爬虫 11:01 已恢复 scrape 66)
- F001 /opt rebuild 4d102f1→master 8d7cff8(部署 BL-094 成本记账; ⚠️ NODE_OPTIONS=4096 防 OOM)
- F002 投喂 2535 旧源 youtube id(scripts/bl086-manual-seed-harvest non-dry-run, 命中 96%, 充值后真实入库)
- F003 codex verified-live: BL-086 refresh 负载降(944→~123)+ 新增回升 / BL-091 BugA runtime 触发 / BL-094 apify_cost_usd 非0 / 告警不误报; 部分指标需数日稳定→首轮验趋势即可
## ✅ BL-094 DONE (4/4) — CI flaky 完治 + 成本记账 merged(#10, rebuild→F001)+ BL-088 量化(806 仅~36条值得 / 2584 可硬删)
## ✅ BL-093(max_tokens 3/3) / BL-091(YT邮箱 5/5, +339) / BL-086(tier+alert 6/6)
## 用户手工待办 / 决策
1. aigcgateway VM .git remote PAT(gho_*)轮换(安全)
- ✅ BL-088 已决(2026-06-08 用户): 两项都不做 — 质量门不放宽(806 仅~36条值得, 低性价比)+ 2584 不硬删(保持软删)。closed
## Backlog
- BL-090-cost / BL-089 配置页 / BL-058 fork / BL-048 valueScore / BL-011 / BL-014 等(详见 backlog.json)

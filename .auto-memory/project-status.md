---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-092-post-charge-execution VERIFYING (generator 2/2 done, 交 Codex F003) — 充值后执行
- ✅ TikHub 充值 $244.71, 端点恢复(72/72 scrape 2h 绿)
- ✅ **F001 done**: /opt/apify-kol-service fork-sync 4d102f1→master 8d7cff8 + rebuild(无 OOM, mem floor~5G), 部署 BL-091(yt-email)+ BL-094 F002(成本记账)。health ok, worker 'poll timeout 300000ms'+40 schedules, **apify_cost_usd 写非0**(refresh 17171=0.022 / manual_seed=0.020)→ BL-094 F002 L2 顺带活验
- ✅ **F002 done**: 投喂全部 2535 youtube UC id(dry-run验→smoke20→全量2515, 26 jobIds 0失败)。live manual_seed 处理中。⏳ 全量 drain 异步数小时 → 入库量/96%命中率 由 F003 量化。idempotent checkpoint
- ⏳ **F003 codex verified-live**(首轮验趋势, 部分指标数日稳定): BL-086 负载降 / 新增回升 / BL-091 BugA runtime / BL-094 cost非0 / 告警不误报 / F002 harvest 入库。⚠️ cost 价格估算 ENDPOINT_PRICES 待真实账单校准
## ✅ BL-094 DONE (4/4) — CI flaky 完治 + 成本记账 merged(#10, rebuild→F001)+ BL-088 量化(806 仅~36条值得 / 2584 可硬删)
## ✅ BL-093(max_tokens 3/3) / BL-091(YT邮箱 5/5, +339) / BL-086(tier+alert 6/6)
## 用户手工待办 / 决策
1. aigcgateway VM .git remote PAT(gho_*)轮换(安全)
- ✅ BL-088 已决(2026-06-08 用户): 两项都不做 — 质量门不放宽(806 仅~36条值得, 低性价比)+ 2584 不硬删(保持软删)。closed
## Backlog
- BL-090-cost / BL-089 配置页 / BL-058 fork / BL-048 valueScore / BL-011 / BL-014 等(详见 backlog.json)

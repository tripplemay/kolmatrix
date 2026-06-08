---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-096-crawler-monitor-page VERIFYING (generator 2/2 done+deployed, 交 Codex F003) — 爬虫只读监控页
- ✅ **F001 deployed**: PR #11 merge→392f154 + apify fork-sync rebuild(无OOM)。/admin/stats 实测真实数据: manual_seed inserted **2534**(BL-092 harvest 落地!)/ hashtag 0(BL-095)/ ytEmail queued1553 / refreshBacklog 5711 / cost今日3.58 / balance240.85
- ✅ **F002 deployed**: commit 0bb7e35 + staging+prod 部署@ccd80d5。瘦客户端只读页+健康灯+recharts+i18n 5locale×29keys+单测13。kolmatrix .env 补 APIFY_KOL_ADMIN_API_KEY(pm2_env 确认)。route 307→login(admin gate 生效)
- ⏳ **F003 codex L2**: admin 登录 /admin/crawler-monitor 验页渲染真实数据+健康灯+gate
- ⚠️坑沉淀: pm2 env_file 加载的 var 不在 /proc/PID/environ, 查 pm2 jlist 的 pm2_env 才准
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

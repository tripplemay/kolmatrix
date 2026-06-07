---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-091-yt-email-unlock-fix DONE (5/5, signoff @ 0db24be) — fix_rounds=0
- F001 Bug A 触发器 fix(PR #6) / F002 Bug B UPSERT(PR #7) / F003 344 backfill(99.1%, +339 邮箱, PR #8) / F005 poll timeout 300s(PR #9, 62%→99% yield) / F004 Codex signoff
- 4 PR merged + /opt 部署 @ 4d102f1. YT 邮箱: 184→523(+339=99.4% 覆盖率). 成本~$49
- F001 runtime 触发实测 defer→BL-092(TikHub 余额耗尽 refresh 不跑). F003 残留 1 failed+1 queued straggler 可回收

## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — tier 积累档+schedules+balance alert+IG fix
- 🔴 TikHub 充值未到账(71@qq.com balance=$0.0005). Deferred: 真实速率验证+F003投喂→BL-092
- ⚠️ OOM 风险: prod deploy build OOM 曾拖垮整机, 内存未根治前勿重试 prod 部署

## ✅ 历史: BL-084/BL-083/BL-082/BL-081/BL-080⏸️(1/6)/BL-079-043

## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`** — 充值后→Planner 复查余额→重启容器+跑 BL-092
2. 催爬虫团队: BL-091 若需后续 review/merge

## Backlog
- **BL-092**(高): 充值后 F003 投喂 2535 + 真实速率验证 + F004/F005 调优 + F001 runtime 验证
- BL-090-cost / BL-089 配置页 / BL-088 质量门

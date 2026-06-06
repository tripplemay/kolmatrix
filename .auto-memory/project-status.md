---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-086-kol-acquisition-accel DONE (6/6, signoff @ 8e99b8a) — fix_rounds=0 首轮 PASS
- F001 tier 积累档(hot14d/warm30d/cold30d, PR #3) / F002 schedules 30→48 / F003 manual-seed dry-run 2535 / F004 余额暴露+静默空转告警(PR #5 + kolmatrix classifyDailyRun) / F005 IG 429 节流 350ms(PR #4) / F006 Codex L1+L2 signoff
- 3 PR 已 merge + /opt sync @ 8f9320a. Signoff: `docs/test-reports/BL-086-signoff-2026-06-07.md`
- 🔴 **TikHub 充值未到账**(71@qq.com balance=$0.0005, 用户完成中). 真实速率验证 + F003 真实投喂 2535 → deferred **BL-092**(充值后)
- ⚠️ OOM 风险: prod deploy build OOM 拖垮整机已恢复, 内存超额未根治前勿重试 prod 部署. 防复发选项待定
- ops 缺口: /opt 无凭据 pull guang-tech/apify, 长期应配 deploy key

## ✅ 历史 DONE: BL-084(9/9) / BL-083 / BL-082 / BL-081 / BL-080⏸️(1/6 等AI gen) / BL-079-043

## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`** — 充值后通知 Planner → 复查余额>0 → 重启容器 + 跑 BL-092
2. 催爬虫团队: BL-091(YT 邮箱 bug)若立项需其 review/merge

## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F004/F005 调优
- **BL-091**(中): YT 邮箱 BugA+BugB + 344 backfill
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 fork

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-093-aigc-max-tokens-hotfix DONE (3/3, signoff @ 4e87231) — fix_rounds=0
- F001 调查根因+per-action max_tokens 表 / F002 B2跨两仓实装(DEFAULT=8192, EXPLAIN_DETAILED=16000) / F003 Codex signoff
- 部署: kolmatrix 807cfc3(staging+prod) + aigcgateway e9d963e, 均 healthy, build 无 OOM(NODE_OPTIONS=4096)
- 治本防复发: 余额门槛从 ~$46 降到 ~$12(~4x 安全边际). 故障已靠上游 provider 充值解
- ⚠️ aigcgateway VM .git remote 嵌 PAT(gho_*), 建议轮换

## ✅ BL-091-yt-email-unlock-fix DONE (5/5, signoff @ 0db24be)
- YT 邮箱 184→523(+339=99.4%), records 339s/1f/1n/1q, F001 runtime defer→BL-092
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — tier+schedules+alert+IG fix
- 🔴 TikHub 充值未到账. Deferred→BL-092

## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`** — 充值后→Planner 复查→重启容器+跑 BL-092
2. aigcgateway PAT 轮换
3. 催爬虫团队: BL-091 后续

## Backlog
- **BL-092**(高): 充值后 F003 投喂 2535 + 真实速率验证 + F001 runtime 验证
- BL-090-cost / BL-089 / BL-088 / BL-058

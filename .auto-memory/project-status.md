---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-094-high-value-polish BUILDING (0/4) — 三高价值项打包(不等充值)
- F001 BL-054: flaky 网络测试隔离(pre-commit-hook woff2 → 独立串行 job)+ material-symbols 字节 guard 改 glyph 覆盖断言(kolmatrix CI)
- F002 BL-090-cost: apify_cost_usd 成本记账(端点价格表/usage-delta, 路径 B 爬虫)
- F003 BL-088: **只读量化**(806 回收价值 按平台×粉丝×邮箱 + 2584 硬删风险)→ 决策报告; ⚠️ 放宽/硬删实装待用户据报告决定(806 低质量换质, 价值存疑)
- F004 Codex 验收。起步 generator: F001 纯 kolmatrix 最快(不依赖充值/爬虫 merge); F002 路径 B 需爬虫团队 merge
## ✅ BL-093 DONE (3/3, signoff @ 4e87231) — aigcgateway max_tokens 治本(余额门槛 ~$46→~$12); 故障已靠上游充值解除
## ✅ BL-091 DONE (5/5) — YT 邮箱 184→523(+339, 99.4%); F001 runtime defer→BL-092
## ✅ BL-086 DONE (6/6) — 抓取加速; Deferred 真实速率→BL-092
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`** — 充值后→Planner 复查→重启容器+跑 BL-092(投喂2535+真实速率)
2. aigcgateway VM .git remote 嵌 PAT(gho_*)轮换(安全)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F001 runtime 验证
- BL-088(放宽/硬删实装, 待 BL-094 F003 报告) / BL-089 配置页 / BL-058 fork / BL-048 / BL-011 等

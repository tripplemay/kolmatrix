---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-094-high-value-polish VERIFYING (generator 2/2 done, 交 Codex F003/F004) — 三高价值项打包
- ✅ **F001 BL-054 done(推 d359f8b)**: 脚本加 DISCOVER_ONLY + coverage 改 fontkit ligature 字形覆盖(网络无关+免疫字节漂移, 抓修假阳性 children); pre-commit 2 真fetch拆 *.network.test.ts + 独立 network config(串行retry2)+ ci.yml 独立 job; docs §5.4。纯测试/CI 无 src 运行时改动→无需 deploy
- ✅ **F002 BL-090-cost merged → master 8d7cff8**(PR #10, 用户授权): sdk cost.ts 端点估算价格表 + AsyncLocalStorage 按 job 归集 + tikhub-client 成功计费 + scrape-worker 写 apifyCostUsd。sdk54+service120绿。⚠️ 价格估算 ENDPOINT_PRICES 唯一校准点
- ⏳ **codex 可验收(NOW)**: F001 L1+L2(测试隔离/网络 job) / F002 L1(master 测试绿) / F003 BL-088 只读量化。**defer 到 TikHub 充值**: F002 fork-sync /opt rebuild + F004 L2(apify_cost_usd 非0, 余额耗尽无成功scrape→无可观测; 同 BL-091)
- 归档 docs/upstream-patches/BL-094-F002-apify-cost-accounting.md
## ✅ BL-093 DONE (3/3, signoff @ 4e87231) — aigcgateway max_tokens 治本(余额门槛 ~$46→~$12); 故障已靠上游充值解除
## ✅ BL-091 DONE (5/5) — YT 邮箱 184→523(+339, 99.4%); F001 runtime defer→BL-092
## ✅ BL-086 DONE (6/6) — 抓取加速; Deferred 真实速率→BL-092
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`** — 充值后→Planner 复查→重启容器+跑 BL-092(投喂2535+真实速率)
2. aigcgateway VM .git remote 嵌 PAT(gho_*)轮换(安全)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F001 runtime 验证
- BL-088(放宽/硬删实装, 待 BL-094 F003 报告) / BL-089 配置页 / BL-058 fork / BL-048 / BL-011 等

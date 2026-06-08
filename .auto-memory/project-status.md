---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-093-aigc-max-tokens-hotfix VERIFYING (2/3, 两仓已部署, 交 Codex F003) — F001+F002 done+deployed
- ✅ 故障 2026-06-08 已恢复(用户充上游 provider 额度)。本批做治本: 防 max_tokens 过度预留复发
- ✅ **F001 调查反转 spec**: /actions/run 不接受 max_tokens override(路由+runner 从不带); 64000=上游按模型cap默认预留; 但 prepareRequest spread 透传→请求带 max_tokens 即转发。根因在 gateway。用户选 **B2**
- ✅ **F002 B2 跨两仓实装**: **aigcgateway**(e9d963e 已推): /actions/run 接受 max_tokens→runner 透传上游(向后兼容)。**kolmatrix**(5b0f202 已推): runAigcAction 加 maxTokens+默认8192(覆盖全8调用点), EXPLAIN_DETAILED 16000。各单测2; L1 tsc0/lint0err/相关测试绿
- ✅ **三处全部署(2026-06-08, Generator 带 OOM 监控)**: aigcgateway @e9d963e(ff, NODE_OPTIONS build 无 OOM, smoke max_tokens=-5→400/16000→404/无→404) + kolmatrix staging+prod @807cfc3(deploy-staging.yml/deploy-prod.yml workflow, build mem floor ~1.87G 无 OOM, health healthy db+redis ok)。**max_tokens 透传全链路上线**
- ⏳ **切 verifying 交 Codex F003**: L1(两仓 tsc/lint/test) + L2(prod 实测 EXPLAIN_DETAILED 不再预检拒 + gateway 日志 max_tokens 受控非64000 + 输出 5locale×5段不截断 before/after)。signoff docs/test-reports/BL-093-signoff-*.md
- ⚠️ 安全: aigcgateway VM /opt/aigc-gateway/.git remote URL 嵌 GitHub PAT(gho_), 建议轮换 token + 改 SSH/credential helper
- ⚠️ **scope 已扩到含 aigcgateway**(原 spec 只设想 kolmatrix)。BL-042 并入。spec §F001 有完整调查
## ✅ BL-091 DONE (5/5, signoff @ 0db24be) — YT 邮箱解锁修复, 184→523(+339, 99.4%)
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — 抓取加速; 部署 prod/staging@d58dabe + 爬虫@8f9320a
## ✅ 历史: BL-084/BL-083/BL-082/BL-081/BL-080⏸️(1/6)/BL-079-043
## 用户手工待办
1. ✅ aigcgateway 上游已充值, AI 故障已解除(2026-06-08)。BL-093 转防复发(非紧急)
2. **P0: TikHub 充值 `71@qq.com`** — 充值后→复查余额→重启容器+跑 BL-092(投喂2535+真实速率)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F004/F005 调优 + F001 runtime 验证
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 / BL-054

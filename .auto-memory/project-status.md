---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-043 deploy-staging.yml + .env.staging Bridge 闭合 — BUILDING（spec lock @ 20:15；切 building @ 20:30；3 features ~2.5h Generator + 0.5h Reviewer）
- 3 features F001-F003 全 generator pending：F001 deploy-{staging,prod}.sh fail-fast on KOLMATRIX_APP_PASSWORD unset（防 silent skip 漂移）/ F002 environment.md 密码 sync 协议 5 处一致 / F003 smoke test standard+fail-fast 双路径
- 80%+ 已闭合（BL-024-F006/F007 retroactive）：deploy-staging.sh peer auth ✓ / yml source .env.staging ✓ / .env.staging 已含 ✓ / staging healthy ✓
- spec：docs/specs/BL-043-deploy-staging-yml-bridge-spec.md（D1-D4 + §5 v0.9.x dogfood + §6 7 步实装）
- v0.9.14 §planner.md 铁律 1 dogfood — Planner 起 spec 前 grep 实物发现 80%+ 已闭合，缩窄范围
## ✅ BL-044 — DONE 19:10 PASS 4/4（2h40min 交付）+ Prod walk 12/12 PASS @ Codex（v0.9.15 跳过：proposed-learnings 空）
- signoff: docs/test-reports/BL-044-discovery-ai-semantic-search-signoff-2026-05-06.md
- prod walk: docs/test-reports/prod-browser-walk-2026-05-06.md（chip 22 KOL / 自由文本 14 KOL / 互斥 / Add+Import+Export inject safe）
## ✅ Prod 13 项验证 PASS @ 19:30（read-only DB+endpoint+logs；BL-040 NOT NULL / Pokemon Go 4 套 / svix / PII 0 hits / cost-cap / NULLIF / CSP / RLS / 4 路由 200）
## 🐛 孤儿 campaign 4425e07e（5/6 19:55）— BL-046 入 backlog high
- "王者荣耀世界 5 月推广计划 A" status=completed product_id=NULL；6 设计 gap；用户 1=D 短期不修 + 2=A 5/13 前做
## 🚧 5/13 上线对外规划（6 决议 lock；5 mini-batch + X1 合并）
- 5/6~7 现在：**BL-043 building**（用户决议「BL-044 done 后立即启动」）
- 5/9 周六：BIx F004 触发（Top 100 engagement batch）→ BL-023 unblock
- 5/10 周日：BL-023 + F007 BL-045（X1）6-7h
- 5/11 周一：CSP+NULLIF 1 周观察期满 + BL-021 Suspense critical 5（~2h）
- 5/12 周二：BL-017 token 过期+撤销 + BL-046 product soft delete（各 ~1 day）
- 5/13 周三 ⭐ 上线对外
## 关键决议
- 5/6 20:30：BL-044 done → BL-043 直接启动（A 选项）；v0.9.15 跳过沉淀
- 5/6 19:55：BL-046 治本 1=D + 2=A
- 5/6 19:50：5 决议 X1 + 2:BL-023后立即 + 4:A + 5:A
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（high 4：BL-017/021/023/046；low 6；deferred 7）— BL-043 已切 building 离开 backlog

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

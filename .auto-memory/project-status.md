---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-052 dashboard-trend-edge-polish — DONE（B+/Ready / staging @ 3ba3fe2 / prod redeploy 5/8 01:13）
- Part A BL-050 KPI 真趋势化（F001-F005）+ Part B BL-018（F006-F011）落地 / 1084 单测 PASS / signoff @ docs/test-reports/BL-052-signoff-2026-05-08.md
- 遗留：F011 /database empty 留 BL-053；F003 cron 行 ops 待用户 SSH 落
## ✅ 已 done 累积：BL-051a 5/7 / BL-049 5/7 / BL-021+BL-023 5/7 / BL-043+BL-044 5/6 / 孤儿 campaign 4425e07e ops 清理 5/7
## 🟡 BL-012-apify-kol-integration BUILDING（5/8 启动 / 用户决议 1B/2A/3B/4A/5B）
- 决议：爬虫团队付费 + 复用 KOLMatrix VM + 5/13 含 Stage 1 only + 首充 $50 demo + 合并单批次
- audit @ docs/reviews/apify-fork-audit-2026-05-08.md（5/7 fork 实物 Apify→TikHub 全迁移 + 4 平台 IG+TT+YT+X / 占位 crawler-team.ts.todo 与实物 API 不一致需新写 apify-kol.ts）
- spec @ docs/specs/BL-012-apify-kol-integration-spec.md / Stage 1 ops（5/8-5/9 Planner+用户）+ Stage 2 features.json 7 generator features（5/14+ building）
- 工时：Stage 1 ~半天 ops + Stage 2 ~5-6h Generator + 0.5h Reviewer
## 🆕 BL-053-edge-states-refactor 暂不立项 / 🆕 BL-054-flaky-network-test-isolate 立项 medium ~2-4h
## 🚀 5/13 上线对外 X1+ 极速时间线（buffer 5+ 天）
- 5/8 ✅ prod redeploy 完成 / Dependabot 首次 run / BL-012 building 启动 + Stage 1 ops 协调中
- 5/13 ⭐ 上线对外（含 BL-049+BL-051a+BL-052；apify-kol service 后台跑但 KOLMatrix 端 adapter 未接）
- 5/14-5/15 BL-012 Stage 2 building → verifying → done → prod redeploy 含 BL-012 完整
## 用户手工待办
1. F003 cron 行 ops（kol-sync:daily && kpi-snapshot:daily）SSH 落 /etc/cron.d prod+staging（runbook kpi-snapshot-runbook.md）
2. 5/8 Dependabot 5 group PR 决议合并/延后
3. BL-012 Stage 1：协调爬虫团队提供 TIKHUB_TOKEN + 首充 $50 paid balance + KOLMatrix VM SSH 部署 apify-kol-service docker-compose up
4. backlog low：deploy-{prod,staging}.sh 加自动 sed GIT_SHA
## 关键决议（已 lock）
- 5/8 BL-012：1B/2A/3B/4A/5B（爬虫团队付费 / 复用 VM / 5/13 含 Stage 1 only / $50 demo / 合并单批次）
- 5/8 P5 裁决：acceptance 边界 ≠ 全套测试普遍绿（v0.9.16 沉淀 @ commit fc8bac4）
- 5/7 BL-052 = BL-050 + BL-018 合并 / P1 inline empty 保留 BL-053 迁移
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 17 条（BL-012 已迁入 features.json）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

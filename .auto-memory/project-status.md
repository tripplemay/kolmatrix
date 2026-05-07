---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-052 dashboard-trend-edge-polish — DONE（Planner P5 裁决后 Reviewer signoff PASS / staging @ 3ba3fe2 / prod redeploy 完成 5/8 01:13）
- Part A BL-050 KPI 真趋势化（F001-F005）+ Part B BL-018（F006-F011）落地，1084 单测 PASS / targeted integration PASS / staging 健康
- Planner 5/8 P5 裁决：`pre-commit-hook.test.ts` flaky 路径属 BL-027-F004 + BL-025-F009 范围外，不计入 BL-052 评分
- signoff @ docs/test-reports/BL-052-signoff-2026-05-08.md
- 遗留：F011 /database empty BL-053 一并迁移；F003 cron 行 ops 待用户 SSH 落 prod+staging
## ✅ BL-051a Lifecycle Management — DONE 5/7 16:55（11/11 / signoff PASS / prod @ 9a6f62d）
## ✅ BL-049 5/7 14:35 / BL-021+BL-023 5/7 / BL-043 5/6 / BL-044 5/6 全 DONE
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理 5/7 13:40 / BL-051a F011 防新孤儿 ✅
## 🆕 BL-053-edge-states-refactor 暂不立项（4 既有 EmptyState 变体迁移 + /database empty + 5 P1 inline empty 统一；BL-052 done 后评估）
## 🆕 BL-054-flaky-network-test-isolate 立项 medium（5/8 Planner P5 裁决创立；推荐方向 A 隔离 + serial；~2-4h Generator + 0.5h Reviewer）
## 🆕 BL-012 apify 接入待决议（爬虫团队 5/7 提前交付 https://github.com/guang-tech/apify；fork audit 推荐方案 A 分平台分源 IG/TT 给 apify YouTube 给 B6；4 阻塞项待用户决议：TikHub 付费 / 部署位置 / 批次调度 / 5/13 是否含；Stage 1 部署 ~半天 + Stage 2 adapter ~5-6h Generator）
## 🚀 5/13 上线对外 X1+ 极速时间线（5+ day buffer 极宽裕）
- 5/8 01:13 ✅ prod redeploy 完成（含 BL-049+BL-051a+BL-052），health PASS（DB 22ms / Redis 4ms / uptime 347s）
- 5/8 Dependabot 首次 run（5 group PR）/ 5/8~12 buffer + 用户业务测继承
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. CSP/NULLIF 4 day prod 0 block 事件 ✓ 已实质验证
2. 5/8 Dependabot run 后看 PR 列表（5 group），决议合并/延后
3. F003 cron 行 ops（npm run kol-sync:daily && npm run kpi-snapshot:daily）SSH 落 /etc/cron.d prod+staging（runbook docs/dev/kpi-snapshot-runbook.md）
4. BL-012 4 阻塞项决议（参 Planner 5/7 末汇报）
5. backlog low：deploy-{prod,staging}.sh 加自动 sed GIT_SHA
## 关键决议（已 lock）
- 5/8 00:10：BL-052 P5 裁决 — acceptance 边界 ≠ 全套 test:integration 普遍绿；外部网络依赖 flaky 入独立批次（BL-054）
- 5/7 17:00：BL-052 = BL-050 + BL-018 合并；BL-018 全量 11 页 × 4 状态
- 5/7 20:10：Generator 自加 RLS 到 kpi_daily_snapshot；P1 inline empty (outreach/crm/roi) 保留 BL-053 迁移
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator
- Backlog 18 条（medium 1：BL-054 / low 5：BL-048/011/014/015/027 / closed 5：BL-017/018/046/047/050 / deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

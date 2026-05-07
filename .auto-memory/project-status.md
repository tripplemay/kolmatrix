---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-052 dashboard-trend-edge-polish — VERIFYING（11/11 building done 5/7 20:10 / staging @ 3ba3fe2）
- Part A BL-050 KPI 真趋势化（F001-F005）落地：kpi_daily_snapshot 表 + RLS / kpi-trends.ts + kpi-snapshot.ts + 15 单测 / kpi-snapshot:daily cron + ops runbook + 3 IT / KpiRow 删 4 mock + StatCard.tooltip + DashboardPage Promise.all / 5 locale trendAccumulating
- Part B BL-018 落地（F006-F011）：公共 EmptyState + 3 单测 / useNetworkStatus + NetworkStatusBanner 注入 (app)/layout 一次性补 11 页 T 维度 + 6 单测 / 5 root loading.tsx (knowledge-base/campaigns/crm/outreach/database) / /assets error.tsx / /knowledge-base empty CTA + 5 locale i18n / P1 inline empty 5 处审视后保留 (BL-053 一并迁移)
- 本机验证：1084 单测 PASS / lint 0 error / tsc 0 error / staging deployed @ 3ba3fe2 健康 (DB+Redis ok)
- 遗留：默认 `npm run test:integration` 在 `pre-commit-hook.test.ts` 的 icon + woff2 路径上出现 flaky failure（isolated rerun PASS）；F011 /database empty 视觉 baseline 锁定旧 inline，BL-053 一并迁移；F003 cron 行 ops 待用户 SSH 落 prod+staging
## ✅ BL-051a Lifecycle Management — DONE 5/7 16:55（11/11 / 3.7x 加速 / staging @ f2d2c1a / Reviewer signoff PASS）
- Part A weekly-report token (F001-F005) + Part B product soft delete (F006-F011) + 中段 audit_log.resource_id widening (UUID→VARCHAR(64))
- signoff @ docs/test-reports/BL-051a-lifecycle-management-signoff-2026-05-07.md
## ✅ BL-049 — DONE 5/7 14:35（first-round PASS / v0.9.15 sediment）
## ✅ BL-021 5/7 / BL-023 5/7 / BL-043 5/6 / BL-044 5/6 全 DONE
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理 5/7 13:40 / BL-051a F011 防新孤儿 ✅
## 🆕 BL-053-edge-states-refactor 暂不立项（4 既有 EmptyState 变体迁移 + /database empty + 5 P1 inline empty 统一；BL-052 done 后评估）
## 🚀 5/13 上线对外 X1+ 极速时间线（5+ day buffer 极宽裕）
- 5/7 20:10 **BL-052 verifying 启动**（Reviewer 签收预估 0.5h × 5x）
- 5/8 周一 done + prod redeploy 含 BL-049+BL-051a+BL-052 全部上线前功能 + Dependabot 首次 run
- 5/8~12 buffer 5+ day + 用户业务测继承
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. CSP/NULLIF 5/4-5/8 实测 4 day prod 0 block 事件 ✓ 已通过实质验证
2. 5/8 周一 Dependabot run 后看 PR 列表（5 group），决议合并/延后
3. backlog low：deploy-staging.sh + deploy-prod.sh 加自动 sed GIT_SHA（BL-049+BL-051a 两次手工 sed）
4. F003 cron 行 ops（npm run kol-sync:daily && npm run kpi-snapshot:daily）由用户 SSH 落 /etc/cron.d prod + staging（runbook docs/dev/kpi-snapshot-runbook.md）
## 关键决议（已 lock）
- 5/7 17:00：BL-052 = BL-050 + BL-018 合并；BL-018 全量 11 页 × 4 状态；cron 复用 D3 / fallback "—" + tooltip D4 / Part A 先 D5
- 5/7 20:10 Generator 自加 RLS 到 kpi_daily_snapshot（spec §3.1 漏列；与 audit_log/event_log 等 NULLIF 模板对齐）
- 5/7 20:10 P1 inline empty (outreach/crm/roi) 视觉小尺寸保留，BL-053 一并迁移
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（low 5：BL-048/011/014/015/027；closed 5：BL-017/018/046/047/050；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

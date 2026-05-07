---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🆕 BL-052 dashboard-trend-edge-polish — BUILDING（11 features F001-F011 启动 5/7 17:30）
- Part A BL-050 KPI 真趋势化（F001-F005）：kpi_daily_snapshot 表 + computeTrend/Sparkline lib + scripts/kpi-snapshot-daily.ts (D3 cron 复用 kol-sync-daily 串行) + KpiRow.tsx 删 4 处 hardcoded mock + StatCard tooltip prop + DashboardPage Promise.all 接通 + i18n trendAccumulating 5 locale (D4 fallback "—" + tooltip)
- Part B BL-018 11 页 × 4 状态全量补（F006-F011）：公共 EmptyState 新建 / useNetworkStatus + NetworkStatusBanner 注入 layout 一次性补 11 页 T 维度 / 缺失 root loading.tsx × 5 (knowledge-base/campaigns/crm/outreach/database) / /assets error.tsx 唯一缺 / /knowledge-base empty state CTA / P1 inline empty 5 处抽公共
- Audit fork 实物 grep 结果：✅ 20/44 (45%) / ⚠️ 6 / ❌ 17 / N/A 1；0 toast / 0 AbortController / 0 navigator.onLine 关键基建缺
- spec：docs/specs/BL-052-dashboard-trend-edge-polish-spec.md (~530 行)；预估 ~1 day Generator + 0.5h Reviewer，5x 加速 ~2-3h
## ✅ BL-051a Lifecycle Management — DONE 5/7 16:55（11/11 / 3.7x 加速 / staging @ f2d2c1a / Reviewer signoff PASS）
- Part A weekly-report token (F001-F005) + Part B product soft delete (F006-F011) + 中段 audit_log.resource_id widening (UUID→VARCHAR(64))
- signoff @ docs/test-reports/BL-051a-lifecycle-management-signoff-2026-05-07.md
## ✅ BL-049 — DONE 5/7 14:35（first-round PASS / v0.9.15 sediment）
## ✅ BL-021 5/7 / BL-023 5/7 / BL-043 5/6 / BL-044 5/6 全 DONE
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理 5/7 13:40 / BL-051a F011 防新孤儿 ✅
## 🆕 BL-053-edge-states-refactor 暂不立项（4 既有 EmptyState 变体迁移 + /dashboard ActivityFeed empty 等 P2 项；BL-052 done 后再评估）
## 🚀 5/13 上线对外 X1+ 极速时间线（5+ day buffer 极宽裕）
- 5/7 17:30 **BL-052 building 启动** → ~21:00 done（5x 加速 ~3h）
- 5/8 周一 done + prod redeploy 含 BL-049+BL-051a+BL-052 全部上线前功能 + Dependabot 首次 run
- 5/8~12 buffer 5+ day + 用户业务测继承
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. CSP/NULLIF 5/4-5/8 实测 4 day prod 0 block 事件 ✓ 已通过实质验证
2. 5/8 周一 Dependabot run 后看 PR 列表（5 group），决议合并/延后
3. backlog low：deploy-staging.sh + deploy-prod.sh 加自动 sed GIT_SHA（BL-049+BL-051a 两次手工 sed）
4. F003 cron 行 ops（kol-sync-daily && kpi-snapshot-daily 串行）由 Generator 起 PR 后用户 SSH 落 prod + staging
## 关键决议（已 lock）
- 5/7 17:00：BL-052 = BL-050 + BL-018 合并；BL-018 全量 11 页 × 4 状态范围；cron 复用 D3 / fallback "—" + tooltip D4 / Part A 先 D5
- 5/7 14:50~16:55：BL-051a F008 中段裁决 audit_log.resource_id widening
- 5/7 14:40：X1+ 极速 — BL-049 提前 1.5h done → 立即切 BL-051a → 5/7 ~21:00 全部 done
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（low 5：BL-048/011/014/015/027；closed 5：BL-017/018/046/047/050；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

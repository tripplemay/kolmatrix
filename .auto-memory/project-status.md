---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟣 BL-055-prod-mock-purge-hotfix VERIFYING（5/8 10:45 Reviewer 复验中）
- 7 features F001-F007 PASS：mount-flag / async badge / 删 mock section / Material Symbols 增 4 删 5 / Neural Velocity → tagline i18n / unreadNotifications=0 / visual regression test cases
- L1: lint 0 errors / tsc 0 / unit targeted BL-055 PASS / IT material-symbols-coverage 7/7
- 5 张 BL-055 visual baselines 已入 git（24 PNG tracked total）；但 visual-baselines-shape.test.ts 仍锁定旧 19 PNG 集合，npm run test FAIL
- Reviewer 10:45 复验：staging dashboard/outreach/knowledge-base 直接核对 PASS；signoff 仍 blocked
- spec @ docs/specs/BL-055-prod-mock-purge-hotfix-spec.md
## 🟡 BL-012-apify-kol-integration v2 修订 / 暂停等 BL-055 / 13 features 9h G + 2.5h R
- 5/8 02:30 用户重新讨论 → 稳妥分阶段：Stage 1.5 admin preview 页 + 4 维度决策门 → Stage 2 真接入；决议 1A/2A/3A/4B/5B + 1B/2A/3B/4A/5B
- spec v2 @ docs/specs/BL-012-apify-kol-integration-spec.md / 13 features 备份 docs/specs/BL-012-features-pre-hotfix.json
- 5/13 含 Stage 1+1.5（admin preview 页可访问，主流程未接 apify 数据）；Stage 2 决策门通过后启动（5/13 后弹性时段）
## ✅ BL-052 DONE 5/8 01:13 prod (signoff @ docs/test-reports/BL-052-signoff-2026-05-08.md) / BL-051a 5/7 / BL-049 5/7 / BL-021+BL-023 5/7 / BL-043+BL-044 5/6
## 🆕 BL-053 暂不立项 / BL-054-flaky-test-isolate medium ~2-4h / BL-056-notifications-真化 low ~2-3 day post-MVP @ commit 54e6648
## 🚀 5/13 上线对外（buffer 5+ 天）
- 5/8 10:30 BL-055 verifying → Reviewer signoff → prod redeploy 用户手动 trigger → 切回 BL-012 building
- 5/13 ⭐ 上线对外（含 BL-049+051a+052+055；apify-kol service 后台跑数据 KOLMatrix 端 adapter 未接）
- 5/9-5/10 BL-012 Stage 1.5 building (admin preview 页 ~3.5h G) → 5/10-12 用户决策门审视 → Stage 2 启动弹性
## 用户手工待办
1. F003 cron 行 ops（kol-sync:daily && kpi-snapshot:daily）SSH 落 prod+staging（runbook kpi-snapshot-runbook.md）
2. 5/8 Dependabot 5 group PR 决议合并/延后
3. BL-012 Stage 1：协调爬虫团队 TIKHUB_TOKEN + 首充 $50 + VM SSH 部署 apify-kol-service docker-compose up
4. BL-055 'Update visual baselines' workflow 触发（GitHub Actions UI）—— sidebar 文案影响所有 authenticated PNG baseline
5. BL-055 Reviewer signoff PASS → prod redeploy 触发（GitHub Actions UI）
## 关键决议（已 lock）
- 5/8 02:00 BL-055 hotfix 6 项决议 lock + 插队启动；BL-056 notifications 真化加 backlog
- 5/8 BL-012：1B/2A/3B/4A/5B（爬虫团队付费/复用 VM/5/13 Stage 1 only/$50 demo/合并）
- 5/8 P5 裁决：acceptance 边界 ≠ 全套测试普遍绿（v0.9.16 沉淀 @ fc8bac4）
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 18 条（BL-012 在 features.json，BL-056 加入）
<!-- 写入规则：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT -->

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔥 BL-055-prod-mock-purge-hotfix BUILDING（5/8 02:30 插队启动 / 7 features ~3.5h G + 1h R）
- 用户 5/8 prod 反馈 6 hotfix 合并：(1) banner 闪现 wifi_off (2) templates badge=10 (3) knowledge-base mock activity (4) AI 洞察 lightbulb 字面字符串多页同源 (5) Neural Velocity mock 5 处 (6) 铃铛假黄点
- spec @ docs/specs/BL-055-prod-mock-purge-hotfix-spec.md / BL-012 features 已备份 docs/specs/BL-012-features-pre-hotfix.json，done 后 Planner 收尾恢复
## 🟡 BL-012-apify-kol-integration BUILDING（5/8 暂停切 BL-055 / Stage 1 ops 用户协作中）
- 决议 1B/2A/3B/4A/5B：爬虫团队付费 + 复用 VM + 5/13 含 Stage 1 only + $50 demo + 合并单批次
- audit @ docs/reviews/apify-fork-audit-2026-05-08.md / spec @ docs/specs/BL-012-apify-kol-integration-spec.md
- Stage 1 (5/8-5/9 用户协调爬虫团队 + 部署 apify-kol-service) + Stage 2 (5/14+ Generator ~5-6h)
## ✅ BL-052 DONE 5/8 01:13 prod (signoff @ docs/test-reports/BL-052-signoff-2026-05-08.md) / BL-051a 5/7 / BL-049 5/7 / BL-021+BL-023 5/7 / BL-043+BL-044 5/6
## 🆕 BL-053 暂不立项 / BL-054-flaky-test-isolate medium ~2-4h / BL-056-notifications-真化 low ~2-3 day post-MVP @ commit 54e6648
## 🚀 5/13 上线对外（buffer 5+ 天）
- 5/8 02:30 prod redeploy ✅ + BL-055 hotfix 启动（~5h end-to-end）→ 切回 BL-012 building
- 5/13 ⭐ 上线对外（含 BL-049+051a+052+055；apify-kol service 后台跑数据 KOLMatrix 端 adapter 未接）
- 5/14-5/15 BL-012 Stage 2 done → prod redeploy 含 BL-012 完整
## 用户手工待办
1. F003 cron 行 ops（kol-sync:daily && kpi-snapshot:daily）SSH 落 prod+staging（runbook kpi-snapshot-runbook.md）
2. 5/8 Dependabot 5 group PR 决议合并/延后
3. BL-012 Stage 1：协调爬虫团队 TIKHUB_TOKEN + 首充 $50 + VM SSH 部署 apify-kol-service docker-compose up
4. BL-055 F005 Generator 开工前 5sec ack 5 locale tagline 翻译候选（spec §10）
## 关键决议（已 lock）
- 5/8 02:00 BL-055 hotfix 6 项决议 lock + 插队启动；BL-056 notifications 真化加 backlog
- 5/8 BL-012：1B/2A/3B/4A/5B（爬虫团队付费/复用 VM/5/13 Stage 1 only/$50 demo/合并）
- 5/8 P5 裁决：acceptance 边界 ≠ 全套测试普遍绿（v0.9.16 沉淀 @ fc8bac4）
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 18 条（BL-012 在 features.json，BL-056 加入）
<!-- 写入规则：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT -->

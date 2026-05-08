---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-012-apify-kol-integration v2 BUILDING（5/8 11:30 收尾恢复 / 13 features ~9h G + 2.5h R）
- 决议 1B/2A/3B/4A/5B + 5.1A/5.2A/5.3A/5.4B/5.5B；spec v2 @ docs/specs/BL-012-apify-kol-integration-spec.md
- 稳妥分阶段：Stage 1 部署 → Stage 1.5 admin preview 页 read-only + 4 维度决策门 → Stage 2 真接入
- 数据流隔离铁律 §2.2：Stage 1.5 preview 不 import kol-sync/* / 不调 prisma.kol.*
## ✅ BL-055 DONE 5/8 11:02（A-/Ready，6 hotfix 闭合，prod redeploy 待用户触发）
## ✅ BL-052 DONE 5/8 prod / BL-051a 5/7 / BL-049 5/7 / BL-021+BL-023 5/7 / BL-043+BL-044 5/6
## 🆕 BL-053 暂不立项 / BL-054-flaky-test-isolate medium / BL-056-notifications low post-MVP
## 🚀 5/13 上线对外（buffer 5 天）
- 5/8-5/9 BL-012 Stage 1 ops + 5/9-5/10 Stage 1.5 building + 5/10-12 用户决策门
- 5/13 ⭐ 上线（含 BL-049+051a+052+055 + BL-012 Stage 1+1.5 admin preview）→ 5/13 后 Stage 2 弹性启动
## 用户手工待办
1. BL-055 prod redeploy 触发（GitHub Actions UI dispatch）
2. BL-012 Stage 1：协调爬虫团队 TIKHUB_TOKEN + 首充 $50 + VM SSH 部署 apify-kol-service
3. F003 cron 行 ops（kol-sync:daily && kpi-snapshot:daily）SSH 落 prod+staging（BL-052 遗留）
4. 5/8 Dependabot 5 group PR 决议 / BL-012 Stage 1 完成后告知 Planner 启动 Stage 1.5 Generator
## 关键决议（已 lock）
- 5/8 11:30 BL-055 done 收尾 + BL-012 v2 恢复 + v0.9.17 沉淀 @ c276c90（记忆条目陈旧风险铁律）
- 5/8 02:30 BL-012 v2：admin preview + 4 维度决策门 + 数据流隔离铁律
- 5/8 02:00 BL-055 hotfix 6 项 + BL-056 backlog / 5/8 P5 裁决 v0.9.16 sediment
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 18 条（BL-012 在 features.json）

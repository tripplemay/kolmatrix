---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-012-apify-kol-integration v4 BUILDING Stage 2（5/8 19:30 用户绕过 §4.5.4 决策门启动 / 14 features 7 done）
- 综合 signoff PASS @ 4712066（fix-round 1 + F006a + fix-round 2 全闭合）；fork 数据 1/4 passed
- v4 决议 4B：绕过决策门启动 Stage 2 入主流程，metadata.source='apify-kol' 隔离作后续清理 option，主流程 UI 不加默认过滤
- F007-F013 范围：apify-kol.ts adapter + 字段映射 + 集成测试 + dispatcher + 删 crawler-team.ts.todo + 文档 + L1；~5-6h G + 1.5h R
- v0.9.18 + v0.9.19 同沉淀 framework（auth role enum + zod schema 实物 sample）；BL-058 跟踪 4 维度迭代
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 🚀 5/13 上线对外（buffer 5 天充裕）
- 5/8 19:30 Stage 2 building 启动 → 5/9 Stage 2 done + verifying + signoff → 5/9-10 prod redeploy
- 5/13 ⭐ 上线（含 BL-049+051a+052+055 + BL-012 完整 v4 含 apify-kol 数据进主流程）
## 用户手工待办
1. 启动 Generator 接力 BL-012 Stage 2 building（F007-F013）
2. 反馈爬虫团队 4 个 fork bug（lockfile / ports 硬编码 / X 平台未实装 / docs union shape 未明示）
3. revoke classic PAT（used for fork clone，用完即弃）
4. F003 cron 行 ops（kpi-snapshot:daily / kol-sync:daily SSH 落 prod+staging，BL-052 遗留）
5. fork 数据 4 维度迭代关注（BL-058 长期跟踪）
## 关键决议（已 lock）
- 5/8 19:30 BL-012 v4: 4B 绕过决策门启动 Stage 2；3A BL-058 backlog；1A+2A v0.9.18/v0.9.19 沉淀
- 5/8 16:30 BL-012 v3: F006a sidebar UserAvatarMenu admin section（不违反 canonical 8-item）
- 5/8 02:30 BL-012 v2: Stage 1.5 admin preview + 决策门；audit 揭 5/7 fork TikHub 全迁移
- 5/8 P5.2 v0.9.16 sediment: acceptance 边界 ≠ 全套测试普遍绿
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条（BL-012 在 features.json，BL-058 加入）

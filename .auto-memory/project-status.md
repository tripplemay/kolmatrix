---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-012-apify-kol-integration v5 VERIFYING（5/9 00:35 Stage 2 Generator 交付完成 + staging deployed @ 9cffcd1）
- features 14/14 completed（F001-F006 + F006a 历史已 PASS；F007-F013 本批次 + staging health git_sha=9cffcd1 ✓ + DB/Redis ok）
- F007-F013 概要：apify-kol adapter (KolSyncAdapter 实装 + 4 错误分类 Auth/RateLimit/Transient + Retry-After 解析) + mapApifyKolItemToRawKolData + IT 5 case + dispatcher per-source 集成 + quality.ts apify-kol 双低过滤 + 占位删除 + runbook/env 文档
- L1：lint 0 errors / tsc 0 errors / unit 1014 PASS / IT 15 PASS（kol-sync-quality.test.ts Testcontainers Docker registry TLS flake，与 BL-012 无关）
- v4 4B 决议绕过决策门 + metadata.source='apify-kol' 隔离 + BL-058 长期跟踪 4 维度自然累积
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 🚀 5/13 上线对外（buffer 4 天充裕）
- 5/9 Stage 2 verifying → 等 Reviewer (Codex) 接力 signoff → 5/9-10 prod redeploy → 5/13 ⭐ 上线
## 用户手工待办
1. Reviewer (Codex) 接力 verifying 出 signoff（覆盖 docs/test-reports/BL-012-apify-kol-integration-signoff-2026-05-08.md 加 Stage 2 段）
2. BL-012 综合 done 后 prod redeploy 含 Stage 2（5/9-10 buffer 内）
3. 反馈爬虫团队 5 个 fork bug（lockfile / ports 硬编码 / X 平台 service 端未接通 / docs union shape / admin route X enum）
4. ✅ §4.7 30 schedules 已创建（5/8 21:30）/ ⏳ 5/15 后我 SSH 跑 §4.8 seed_expansion
5. revoke classic PAT + fork 数据 4 维度迭代关注（BL-058）
## 关键决议（已 lock）
- 5/8 19:30 BL-012 v4: 4B 绕过决策门启动 Stage 2；3A BL-058 backlog；1A+2A v0.9.18/v0.9.19 沉淀
- 5/8 21:30 §4.7 cron 30 schedules 已 SSH 创建（5/9 02:00 UTC 第一次 cron 触发）
- 5/8 16:30 BL-012 v3: F006a sidebar UserAvatarMenu admin section（不违反 canonical 8-item）
- 5/8 02:30 BL-012 v2: Stage 1.5 admin preview + 决策门；audit 揭 5/7 fork TikHub 全迁移
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条（BL-012 在 features.json 14/14 done，BL-058 待启动）

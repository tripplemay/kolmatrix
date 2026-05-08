---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-012-apify-kol-integration v5 BUILDING Stage 2（5/8 21:00 spec 修订 — Stage 1 §4.4 集成偏差修补）
- 综合 signoff PASS @ 4712066；v4 决议 4B 绕过决策门启动 Stage 2；fork 数据 1/4 passed
- v5 修订：用户提示 ai-usage.md 完整审视后发现 v2 §4.4 偏差（仅一次性 jobs 不持续累积）→ 加 §4.7 cron hashtag schedules (30 个 IG/TT/YT 各 10) + §4.8 seed_expansion (1 周后 IG only)
- Planner ops 待办：SSH 创建 30 schedules（用户决议 A 不立即跑，留 ops 后续）
- F007-F013 仍按 IG/TT/YT 实装 / X 平台 fork service 端未接通（仅 SDK 层）→ BL-058 跟踪
- v0.9.18 + v0.9.19 已沉淀 framework；本次 v5 是 v0.9.19 自我应用反例（5/8 02:30 audit 仅看前 120 行）
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 🚀 5/13 上线对外（buffer 5 天充裕）
- 5/8 19:30 Stage 2 building 启动 → 5/9 Stage 2 done + verifying + signoff → 5/9-10 prod redeploy
- 5/13 ⭐ 上线（含 BL-049+051a+052+055 + BL-012 完整 v4 含 apify-kol 数据进主流程）
## 用户手工待办
1. 启动 Generator 接力 BL-012 Stage 2 building（F007-F013）
2. 反馈爬虫团队 5 个 fork bug（lockfile / ports 硬编码 / X 平台 service 端未接通 / docs union shape 未明示 / admin route X enum 缺）
3. Planner ops 何时跑 §4.7 §4.8 SSH 创建 schedules + 1 周后 seed_expansion（你 ack 时机后我 SSH ops）
4. revoke classic PAT + F003 cron ops + fork 数据 4 维度迭代关注（BL-058）
## 关键决议（已 lock）
- 5/8 19:30 BL-012 v4: 4B 绕过决策门启动 Stage 2；3A BL-058 backlog；1A+2A v0.9.18/v0.9.19 沉淀
- 5/8 16:30 BL-012 v3: F006a sidebar UserAvatarMenu admin section（不违反 canonical 8-item）
- 5/8 02:30 BL-012 v2: Stage 1.5 admin preview + 决策门；audit 揭 5/7 fork TikHub 全迁移
- 5/8 P5.2 v0.9.16 sediment: acceptance 边界 ≠ 全套测试普遍绿
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条（BL-012 在 features.json，BL-058 加入）

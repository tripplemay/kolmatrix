---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚦 BL-034 后端深度安全 / 数据隔离 — REVERIFYING (8/8 done @ 07a6db4 + staging deployed @ 2026-05-05 11:46)
- ✅ F001-F008 done；fix-round 1 cost-cap MVP 交付 @ bb11ed1（cost-cap.ts + customize 接入 + 7 unit case）
- ✅ deploy-staging.sh graceful-degrade fix-up @ 07a6db4：HEALTH_DETAIL_TOKEN 未配置时跳过 git_sha 严格检查（防 user 落地 token 前 staging 持续红）
- ✅ staging 部署 25356664074 SUCCESS @ 07a6db4；health 200 + db/redis ok + 无 git_sha leak（F007 token gate 起作用）
- 测试：894 unit PASS（+36 新）；集成 audit-log-rls / event-log-rls / kol-embed-deleted-at / db-platform-admin-nullif 全 PASS
- CI 状态：等 main HEAD 07a6db4 CI 复测；切 reverifying 等 Reviewer 复验
## ✅ Framework v0.9.11 — DONE 2026-05-05 ~01:00（BL-020 + backend-audit 沉淀，5 条 learnings 全 Accept）
- 归档：framework/archive/proposed-learnings-archive-v0.9.11.md
## ✅ BL-020 前端安全整改 — DONE 2026-05-05 ~01:00（first-round PASS @ ca5515b，fix_rounds=0）
## ✅ BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~04
## 用户手工待办（按优先级）
1. **Pokemon Go 邮件模板 v1 prod 浏览器验证**（2026-05-05 ops 后）：刷新 /zh/knowledge-base 看 Pokemon Go 卡 chip 应显 '4 email templates'
2. **BL-020 prod redeploy**：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true → GH Actions Deploy
3. **BL-020 F006 CSP 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy
4. **BL-034 done 后 5 项 user 手工待办**（spec §6.1）：SSH prod/staging 写 KOLMATRIX_APP_PASSWORD（F001）+ HEALTH_DETAIL_TOKEN（F007）+ AI_DAILY_COST_USD_PER_TENANT_MAX（F005）+ F008 1 周 staging 观察 + F003 audit_log RLS prod 验
5. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-034 D1-D8 + F005 fix-round 1 cost-cap MVP 已交付（bb11ed1）；推 BL-035 F013：7 处 actions/run max_tokens + 第 4 处 wrap topic-cloud + actions/run 路径 system prompt untrusted clause + embedding/client.ts max_tokens 复核
- v0.9.11 + BL-020 D1-D8 + Q1-Q3 + #1:A — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 20 条（BL-035 13 features 含 F012 mock 沉底 + 新增 F013 aigcgateway actions/run 协调；BL-024 / BL-040 / BL-041 等）
- 时间线：05-05~07 BL-034 (现 fix-round 1) → 05-08~10 BL-035 (含 F013) → 05-11 BL-024 → 05-12 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

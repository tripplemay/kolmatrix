---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-034 后端深度安全 / 数据隔离 — BUILDING (7/8 done @ b8268b1，F005 partial pending — 2026-05-05 ~10:30)
- ✅ F001 dbbfbb3 DB 角色密码 migration 解耦 / ✅ F002 0ba6118 seed prod throw + SEED_ADMIN_PASSWORD env / ✅ F003 a23d24d+317cf1c audit_log+event_log RLS + logAudit/logEvent withTenant + ai-suggestions findMany +tenantId（fix 修 kol-profile race + crm/overview RLS read）/ ✅ F004 d095ffd embedAllKols Prisma.sql + assertUuid + deleted_at + partial index / ⚠️ F005 PARTIAL 3466898 xml-escape util + 3/4 wrap site (customize/email/video) + max_tokens(2 chat-completions) + AI_DAILY_COST env 占位；未做 cost cap module + 第 4 wrap (topic-cloud actions/run) + 7 处 actions/run max_tokens (服务端配置不可客户端覆盖) / ✅ F006 4190932 placeholder-guard 共享 + email/video gen attach (allowIfMustache opts 兼容旧) / ✅ F007 0db858f health GIT_SHA IIFE + HEALTH_DETAIL_TOKEN gate + deploy-staging.sh 同步 / ✅ F008 b20635c is_platform_admin NULLIF migration
- 测试：887 unit PASS（+29 新）；集成新增 audit-log-rls / event-log-rls / kol-embed-deleted-at / db-platform-admin-nullif 全 PASS
- CI 状态：F006/F004/F003 三轮触发红 + 已修；当前 main HEAD pending (rollback comment fix b8268b1)
- 决策点：Reviewer accept 7/8 进 verifying，F005 起 fix-round 1 完成 cost cap MVP (~45min) + 第 4 wrap 推 BL-035 (服务端协调) — 详见 progress.json generator_handoff
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
- BL-034 D1-D8 + F005 PARTIAL 决策（accept partial 进 verifying / fix-round 1 cost cap / 第 4 wrap 推 BL-035）待用户裁决
- v0.9.11 + BL-020 D1-D8 + Q1-Q3 + #1:A — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 20 条（BL-035 / BL-024 / BL-040 / BL-041 等）
- 时间线：05-05~07 BL-034 (现) → 05-08~10 BL-035 → 05-11 BL-024 → 05-12 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

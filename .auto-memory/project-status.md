---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-034 后端深度安全 / 数据隔离 — DONE 2026-05-05 ~12:00（reverifying PASS @ 07a6db4，fix_rounds=1）
- 8/8 PASS：F001 GUC migration + deploy-prod ALTER ROLE / F002 NODE_ENV throw + SEED_PASSWORD env / F003 audit_log+event_log RLS + logAudit/logEvent withTenant + ai-suggestions tenantId / F004 Prisma.sql + assertUuid + deleted_at + partial index / F005 cost-cap MVP（fix-round 1 @ bb11ed1）+ XML wrap 3 路径 + max_tokens 2 路径 / F006 placeholder-guard 共享 + email/video gen attach / F007 GIT_SHA IIFE + token gate / F008 NULLIF user_isolation
- L2：staging git_sha=07a6db4（main HEAD 225b7cf，diff 仅 paths-ignore 等价部署）/ health ok / db ok 29ms / **redis ok 5ms** / token gate default-deny 实测无 git_sha leak / CSP enforce 不破不动
- CI run 25356531391 @ 07a6db4 全 jobs success（Unit 894/894 + Integration 381/383, 2 skipped 无关）
- signoff: docs/test-reports/BL-034-backend-deep-security-and-data-isolation-signoff-2026-05-05.md（8 Soft-watch S1-S8 全有明文兜底）
## ✅ Framework v0.9.11 — DONE 2026-05-05 ~01:00（BL-020 + backend-audit 沉淀，5 条 learnings 全 Accept）
## ✅ BL-020 前端安全整改 — DONE 2026-05-05 ~01:00（first-round PASS @ ca5515b，fix_rounds=0）
## ✅ BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~04
## 用户手工待办（按优先级）
1. **BL-034 done 后 5 项 user 手工待办**（spec §6.1）：SSH prod/staging 写 KOLMATRIX_APP_PASSWORD（F001）+ HEALTH_DETAIL_TOKEN（F007）+ AI_DAILY_COST_USD_PER_TENANT_MAX（F005，prod=5.00 / staging=100）+ F008 1 周 staging 观察 + F003 audit_log RLS prod 验
2. **BL-034 + BL-020 prod redeploy**（合并）：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true（BL-020 F008）+ 上述 3 个 BL-034 env vars → GH Actions Deploy → 浏览器+endpoint 验证
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy
4. **F005 cost-cap event_log staging 实测**（S6）：触发一次 outreach customize 后 SSH `psql -c "SELECT * FROM event_log WHERE type='ai.usage' ORDER BY created_at DESC LIMIT 5"`
5. **Pokemon Go 邮件模板 v1 prod 浏览器验证**（2026-05-05 ops 后）：刷新 /zh/knowledge-base 看 Pokemon Go 卡 chip 应显 '4 email templates'
6. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-034 D1-D8 + Planner 14:00 方案 A（F005 fix-round 1 cost-cap MVP + F013 推 BL-035）
- v0.9.11 + BL-020 D1-D8 + Q1-Q3 + #1:A — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator；BL-034 reverifying 由 CLI 临时担任 evaluator 完成（harness §1.5 用户口头指派）
- Backlog 20 条（BL-035 13 features 含 F013 BL-034 F005 服务端协调收尾 + F012 mock KOL 沉底；BL-024 / BL-040 / BL-041）
- 时间线：05-05 BL-034 done → 05-05~07 BL-035 → 05-08~10 BL-024 → 05-11 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

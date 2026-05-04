---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-034 后端深度安全 / 数据隔离 — BUILDING（spec lock @ 2026-05-05 ~01:30）
- 8/8 全 generator pending：F001 DB 角色密码 migration / F002 seed prod 守卫 / F003 audit_log+event_log RLS（v0.9.11 §database-patterns.md §8 dogfood）+ logAudit withTenant / F004 embedAllKols Prisma.sql + assertUuid + deleted_at + partial index / F005 9 max_tokens + 4 XML tag wrap + per-tenant cost cap（v0.9.11 §ai-action-contract.md §4 dogfood）/ F006 placeholder-guard 共享 + 单条 Asset 重生路径挂 / F007 health execSync cache + HEALTH_DETAIL_TOKEN 守卫 / F008 is_platform_admin NULLIF migration（与 BL-020 F006 同模式 1 周 staging 观察）
- 来源：docs/reviews/backend-full-scan-2026-05-04.md §1 (5 CRIT) + §2 AUTH-H4/H6 + AI-H5 + DB-H4
- spec：docs/specs/BL-034-backend-deep-security-and-data-isolation-spec.md（D1-D8 决策 + §5 v0.9.11 dogfood 清单 + §6.1 5 项 user 手工待办）
- 预估 2-3 day building + 0.5 day verifying（audit §6 Sprint 0）
## ✅ Framework v0.9.11 — DONE 2026-05-05 ~01:00（BL-020 + backend-audit 沉淀，5 条 learnings 全 Accept）
- planner.md 铁律 1 检查矩阵新增 'regex / id-format / type-check' 行 + §rate-limit 条款；database-patterns.md §8 RLS template；ai-action-contract.md §4 max_tokens + XML tag；evaluator.md §16 Node 版本；signoff-report.md L2 RSC 注解；项目根 .nvmrc=20；environment.md staging Redis 行
- 归档：framework/archive/proposed-learnings-archive-v0.9.11.md
## ✅ BL-020 前端安全整改 — DONE 2026-05-05 ~01:00（first-round PASS @ ca5515b，fix_rounds=0）
- 8/8 PASS：F001 PRODUCT_ID_RE CUID / F002 safeAiActionLink / F003 dangerouslySetInnerHTML grep 0 / F004 set_config 参数化 / F005 ioredis + rate-limiter-flexible login / F006 CSP enforce / F007 Dashboard Campaigns 解禁 / F008 demo_seed env-var
- signoff: docs/test-reports/BL-020-frontend-security-hardening-and-trivial-ui-signoff-2026-05-05.md（5 Soft-watch S1-S5 全有明文兜底）
## ✅ BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~04
## 用户手工待办（按优先级）
1. **BL-020 prod redeploy**：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true（REDIS_URL 已有）→ GH Actions Deploy → 浏览器+endpoint 验证（spec §6.2 + S3）+ 5 错误密码触发 rate-limit toast 物理验（S1）
2. **BL-020 F006 CSP 1 周 staging 观察期**（S2）：观察期满后用户驱动 prod redeploy（spec §6.3）
3. **BL-034 done 后 5 项 user 手工待办**（spec §6.1）：SSH prod/staging 写 KOLMATRIX_APP_PASSWORD（F001）+ HEALTH_DETAIL_TOKEN（F007）+ AI_DAILY_COST_USD_PER_TENANT_MAX（F005）+ F008 1 周 staging 观察 + F003 audit_log RLS prod 验
4. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-034 D1-D8：deploy-prod.sh ALTER ROLE / seed throw / audit_log NULLIF + tenant_id IS NULL 双分支 / embedAllKols 不强制 RLS 保 admin 路径 / per-tenant cost cap MVP 简化 event_log 计数 / system prompt 英文统一 / 9 max_tokens + 4 XML wrap + cost cap 单 push 多 commit / F008 1 周 staging 观察
- v0.9.11 + BL-020 D1-D8 + Q1-Q3 + #1:A — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 20 条（BL-034 已并入 features.json，剩 BL-035 / BL-024 / BL-040 / BL-041 等）
- 时间线：05-05~07 BL-034 → 05-08~10 BL-035 → 05-11 BL-024 → 05-12 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

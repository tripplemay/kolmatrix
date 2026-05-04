---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-020 前端安全整改 6 项 + UI 修复 2 项 mini-batch — BUILDING 2026-05-04
- 触发：docs/reviews/prod-mvp-readiness-audit-2026-05-04.md §3 锁 8 项 prod 上线前必修；Planner Phase 1 核查 8 项全部仍未修，audit 无遗漏
- F005 偏差修正：audit 称"Redis 已有 .env 配可直接接入"，实测 package.json 0 Redis 依赖 + src 0 wiring + health 返 'not_used' → F005 含 Redis infra 全栈装 ioredis（Q3=A 决策锁，工时 1-2h → 3-5h）
- 8 features 全 generator：F001 CR-1 productId UUID / F002 CR-2 safeAiActionLink 白名单 / F003 CR-3 dangerouslySetInnerHTML 清理 / F004 H-S1 set_config 参数化（保留 assertUuid defense-in-depth）/ F005 H-S2 ioredis + rate-limiter-flexible + login 5/min/IP / F006 H-S3 CSP enforce 单 commit + 1 周 staging 观察 / F007 UI-1 Dashboard Campaigns 卡解禁 / F008 UI-2 HIDE_DEMO_SEED_KOLS env-var 过滤
- Q1-Q3 锁：CSP 单 commit / rate-limit 仅 login 起步 / Redis 全栈装包；D1-D8 详 spec
- spec docs/specs/BL-020-frontend-security-hardening-and-trivial-ui-spec.md
## ✅ BL-033 质量收尾合集 — DONE 2026-05-04（首轮 PASS @ e2c1832；prod backfill 1 行已跑 @ 8ef1b22；浏览器三验通过）
- v0.9.9 铁律 5 第二次按规矩跑数据迁移验证有效；BL-032 Soft-watch S1+S2 双关
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 / BL-025 / BL-026 — DONE 2026-05-03
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 / v0.9.10 — DONE
## 用户手工待办（按优先级）
1. **BL-020 done 后 prod redeploy**：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true → GH Actions Deploy → 浏览器+endpoint 验证（spec §6.2）
2. **BL-020 F006 CSP 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy（spec §6.3）
3. ~2026-05-09 BIx F004 staging YouTube sync 走查
4. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-020 D1-D8 + Q1-Q3：set_config 参数化 / safeAiActionLink 白名单 / ioredis + rate-limiter-flexible / CSP 单 commit / HIDE_DEMO_SEED_KOLS env-var
- BL-033/032/031/030/025-027 / v0.9.6-v0.9.10 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 19 条（含 BL-040 targetAudience required + BL-041 Dashboard PRD §4.1 三元素）+ BL-014 ja/ko/es 人工审核
- 时间线：05-04 BL-020 → 05-05 BL-024 (A/B/C 必做) → 05-06 BL-040+BL-041 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

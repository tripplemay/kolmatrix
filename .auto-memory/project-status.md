---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-020 前端安全整改 — VERIFYING 8/8 done @ 2026-05-05 00:50（staging deployed @ ca5515b）
- 8/8 features 全 done（commit chain 6d79da0..ca5515b push main）+ staging health 200 / db ok / redis ok @ 2026-05-04T16:42Z UTC（git_sha == main HEAD ✓）
- F001 ca5515b — PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i（CUID 形）按 Planner 裁决 #1:A 实现；4 调用方零改动 + actions.test.ts 12/12 PASS（既有 8 + 新 4）
- F002-F008 见 progress.json session_notes johnsong；25c6fb0 visual baseline 已重生 + 6e2c11c F005 health test fix 已落
- staging .env.staging F005 期已加 REDIS_URL=redis://localhost:6379/2（备份 .bak.bl020-f005）
- F006 CSP enforce 当前 staging 已运行：Reviewer L2 5min 主路径 walk DevTools Console 无 violation = PASS；1 周 prod 观察期入 Soft-watch
- spec docs/specs/BL-020-frontend-security-hardening-and-trivial-ui-spec.md / 实现详情见 progress.json session_notes johnsong / Reviewer 接 verifying
## ✅ BL-033 质量收尾合集 — DONE 2026-05-04（首轮 PASS @ e2c1832；prod backfill 已跑 @ 8ef1b22）
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 / BL-025 / BL-026 — DONE 2026-05-03
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 / v0.9.10 — DONE
## 用户手工待办（按优先级）
1. **BL-020 done 后 prod redeploy**：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true（REDIS_URL 已有）→ GH Actions Deploy → 浏览器+endpoint 验证（spec §6.2）
2. **BL-020 F006 CSP 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy（spec §6.3）
3. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-020 D1-D8 + Q1-Q3 + #1:A：set_config 参数化 / safeAiActionLink 白名单 / ioredis + rate-limiter-flexible / CSP 单 commit / HIDE_DEMO_SEED_KOLS env-var / PRODUCT_ID_RE 取 CUID 而非 UUID
- BL-033/032/031/030/025-027 / v0.9.6-v0.9.10 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 21 条（含 BL-034 后端深度安全 5 CRIT + BL-035 后端 11 HIGH；BL-040/041 PRD 偏差；BL-014 ja/ko/es 人工审核）
- 时间线：05-05 BL-020 verifying → done → 05-05~07 BL-034（后端 5 CRIT）→ 05-08~10 BL-035 → 05-11 BL-024 → 05-12 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

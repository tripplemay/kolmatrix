---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-020 前端安全整改 — DONE 2026-05-05 ~01:00（first-round PASS @ ca5515b，fix_rounds=0）
- 8/8 PASS：F001 PRODUCT_ID_RE CUID 校验 / F002 safeAiActionLink 白名单 / F003 dangerouslySetInnerHTML grep 0 / F004 set_config 参数化 / F005 ioredis + rate-limiter-flexible login 5pts/60s + 5min block / F006 CSP enforce / F007 Dashboard Campaigns 解禁 / F008 demo_seed env-var 过滤
- L2：staging git_sha=ca5515b（main HEAD 79c44ad，diff 仅 paths-ignore 状态机文件，等价部署）/ health ok / db ok 23ms / **redis ok 6ms** / CSP enforce header 实测无 -Report-Only
- CI run 25330969685 @ ca5515b 全 8 jobs success（Unit 122/122 + Integration 54/55，1 skipped 无关）
- signoff: docs/test-reports/BL-020-frontend-security-hardening-and-trivial-ui-signoff-2026-05-05.md（5 Soft-watch S1-S5 全有明文兜底）
## ✅ BL-033 质量收尾合集 — DONE 2026-05-04（首轮 PASS @ e2c1832；prod backfill 已跑 @ 8ef1b22）
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 / BL-025 / BL-026 — DONE 2026-05-03
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 / v0.9.10 — DONE
## 用户手工待办（按优先级）
1. **BL-020 prod redeploy**：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true（REDIS_URL 已有）→ GH Actions Deploy → 浏览器+endpoint 验证（spec §6.2 + S3）+ 浏览器 5 错误密码触发 rate-limit toast 物理验（S1）
2. **BL-020 F006 CSP 1 周 staging 观察期**（S2）：观察期满后用户驱动 prod redeploy（spec §6.3）
3. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-020 D1-D8 + Q1-Q3 + #1:A：set_config 参数化 / safeAiActionLink 白名单 / ioredis + rate-limiter-flexible / CSP 单 commit / HIDE_DEMO_SEED_KOLS env-var / PRODUCT_ID_RE 取 CUID 而非 UUID（v0.9.11 候选「Planner 铁律 1 强化检查项」入 proposed-learnings）
- BL-033/032/031/030/025-027 / v0.9.6-v0.9.10 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator；BL-020 verifying 由 CLI 临时担任 evaluator 完成（harness §1.5 用户口头指派）
- Backlog 21 条（含 BL-034 后端深度安全 5 CRIT + BL-035 后端 11 HIGH；BL-040/041 PRD 偏差；BL-014 ja/ko/es 人工审核）
- 时间线：05-05 BL-020 done → BL-034（后端 5 CRIT）→ 05-08~10 BL-035 → 05-11 BL-024 → 05-12 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-020 前端安全整改 — BUILDING 7/8 done @ 2026-05-04 23:55（F001 hold + staging deployed @ 3aa33cb）
- 已 done F002-F008（commit chain 6d79da0..3aa33cb push main）+ staging health 200 redis ok 2ms db ok 3ms @ 2026-05-04T15:54:29Z UTC
- F001 hold pending Planner 裁决：docs/specs/BL-020-F001-audit-cuid-vs-uuid.md commit f7d1aa0 — Product.id @default(cuid()) 不是 UUID，spec UUID_RE 直接套会破 4 调用方+5 既有 case；Generator 建议 A=CUID_RE
- 进 verifying 前置：1) Planner F001 短格式裁决 #1:A/B/C → Generator 实现 → 切 verifying  2) 用户手动触发 'Update visual baselines' GitHub workflow（F007 Dashboard Campaigns 卡解禁使 dashboard.png 1759→1756h 3px diff = visual-regression CI fail；非真 bug）
- staging .env.staging 此次新增 REDIS_URL=redis://localhost:6379/2（environment.md 表格记 staging db idx 2 但 .env 此前未配；备份 .env.staging.bak.bl020-f005）
- F006 CSP enforce 当前 staging 已运行：Reviewer L2 5min 主路径 walk DevTools Console 无 violation = PASS；1 周 prod 观察期入 Soft-watch
- spec docs/specs/BL-020-frontend-security-hardening-and-trivial-ui-spec.md / 8 features 实现详情见 progress.json session_notes johnsong
## ✅ BL-033 质量收尾合集 — DONE 2026-05-04（首轮 PASS @ e2c1832；prod backfill 已跑 @ 8ef1b22）
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 / BL-025 / BL-026 — DONE 2026-05-03
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 / v0.9.10 — DONE
## 用户手工待办（按优先级）
1. **BL-020 Planner 裁决 F001 audit**（~5min）：阅 docs/specs/BL-020-F001-audit-cuid-vs-uuid.md → 短格式 #1:A/B/C 写文档末尾 + 修订 spec/features.json
2. **BL-020 触发 Update visual baselines workflow**（GitHub Actions UI）：F007 layout 微变后 dashboard.png 重生 baseline；commit 自动落 main → CI 自动绿
3. **BL-020 done 后 prod redeploy**：SSH prod 加 .env.production HIDE_DEMO_SEED_KOLS=true（REDIS_URL 已有）→ GH Actions Deploy → 浏览器+endpoint 验证（spec §6.2）
4. **BL-020 F006 CSP 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy（spec §6.3）
5. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-020 D1-D8 + Q1-Q3：set_config 参数化 / safeAiActionLink 白名单 / ioredis + rate-limiter-flexible / CSP 单 commit / HIDE_DEMO_SEED_KOLS env-var
- BL-033/032/031/030/025-027 / v0.9.6-v0.9.10 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 21 条（含 BL-034 后端深度安全 5 CRIT + BL-035 后端 11 HIGH；BL-040/041 PRD 偏差；BL-014 ja/ko/es 人工审核）
- 时间线：05-04 BL-020（done F001 后即可）→ 05-05~07 BL-034（后端 5 CRIT）→ 05-08~10 BL-035 → 05-11 BL-024 → 05-12 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-033 质量收尾合集（Checkbox + KB pipeline + /assets i18n）— DONE 2026-05-04（首轮 PASS @ e2c1832；signoff docs/test-reports/BL-033-quality-followups-and-assets-i18n-signoff-2026-05-04.md）
- 4/4 PASS：F001 Checkbox keepMounted 删 / F002 SubstituteVariables.date 必填 + 5th mapping [DATE]→{{date}} + 3 调用站补传 / F003 AiPlaceholderViolationError per-segment validation / F004 5 messages 命名空间 + 3 components refactor + i18n 错误 toast
- BL-032 Soft-watch 双关：S1（[DATE] token）✅ + S2（server-side validation）✅
- L1：tsc 0 / lint 0 / 818 tests PASS / 118 files；L2：staging git_sha=e2c1832 + DB ok；CI 25322699297 全 8 jobs success
- 待用户手工：prod redeploy + F002 backfill 1 行（spec §5.1，幂等）+ 浏览器三验（unchecked checkbox 无 ✓ / /zh/assets 全中文 / Send Test 含日期）
- Soft-watch：S1（low）F002 prod backfill 待跑 / S2（low）ja/ko/es 机译质量入 BL-014 人审 / S3（medium）F003 prod 真 AI 触发后查 audit_log
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04（首轮 PASS @ cc1658d；prod backfill 25 行已跑）
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04（首轮 PASS @ c1405c7）
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 Asset Followup + Icon Hotfix — DONE 2026-05-03
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 — DONE
## 用户手工待办（按优先级）
1. **BL-033 prod 闭环**：GH Actions Deploy to Production → SSH 跑 `npx tsx scripts/convert-bracket-tokens-to-mustache.ts --execute` → 浏览器三验
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-033 D1-D4 + Q1-Q4：keepMounted 删 / date 必填 / BRACKET_RE 严格 / 5 语言全填 + 含 errors 错误 toast + 合并 + 不重生 baseline
- BL-032/BL-031/BL-030/BL-025/BL-026/BL-027 / v0.9.6-v0.9.9 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator；BL-033 verifying 用户口头指派 CLI 临时担任 evaluator（harness §1.5）
- Backlog 17 条 + BL-014 ja/ko/es 人工审核（BL-033 F004 机译产出后回归此 backlog 项）
- 时间线：05-04 BL-033 done → 05-04~05 redeploy + backfill → 05-05 BL-020 → 05-13 上线对外

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

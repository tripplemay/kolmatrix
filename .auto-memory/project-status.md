---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-033 质量收尾合集（Checkbox + KB pipeline + /assets i18n）— VERIFYING 2026-05-04 @ e2c1832
- 4/4 features building done @ e2c1832；staging deployed + health 200 git_sha=e2c1832 + DB ok；CI 25322699297 绿
- F001 Checkbox keepMounted 删 + 7/7 测试 PASS；F002 SubstituteVariables.date 必填 + 3 调用站补 + scripts/convert 5th 映射 [DATE]→{{date}} 关 BL-032 S1；F003 AiPlaceholderViolationError + per-segment validation + 3 case；F004 5 messages 命名空间 + AssetsClient/EditTab/UsedInTab refactor + localizeErrorCode 错误 toast i18n + ja/ko/es 标 _machineTranslated 待 BL-014
- 35 BL-033 + 32 assets action + 16 i18n CI 守门测试全绿；tsc + lint 0 errors（仅 1 既有 youtube.ts 警告）
- spec docs/specs/BL-033-quality-followups-and-assets-i18n-spec.md
- 4 commits：31d47cc(F001) / 8c7271e(F002+F003) / 8eed529(F004) / e2c1832(F004 CI 守门 fix — KOL/AI allowlist + ICU plural parity 包裹) 已推 main，CI 绿
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04（首轮 PASS @ cc1658d；prod backfill 25 行已跑）
- v0.9.9 铁律 5 第一次按规矩跑数据迁移验证有效（updateAsset mutation 路径，0 副作用漏洞）
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04（首轮 PASS @ c1405c7）
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 Asset Followup + Icon Hotfix — DONE 2026-05-03
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 — DONE
## 用户手工待办（按优先级）
1. **BL-033 Reviewer 验收**：Codex 接手 status=verifying；done 后 prod redeploy + F002 backfill + 浏览器三验
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 推迟独立批次
## 关键决议（已 lock）
- BL-033 D1-D4 + Q1-Q4：keepMounted 删 / date 必填 / BRACKET_RE 严格 / 5 语言全填 + 含 errors 错误 toast + 合并 + 不重生 baseline
- BL-032/BL-031/BL-030/BL-025/BL-026/BL-027 / v0.9.6-v0.9.9 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条 + BL-014 ja/ko/es 人工审核（BL-033 F004 机译产出后回归到此 backlog 项跟进）
- 时间线：05-04 BL-033 → 05-04~05 redeploy → 05-05 BL-020 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

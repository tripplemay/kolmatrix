---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-033 质量收尾合集（Checkbox + KB pipeline + /assets i18n）— BUILDING 2026-05-04
- 触发：BL-032 prod backfill done 后用户连报 2 prod 质量问题（Outreach KOL Checkbox unchecked 视觉永显示 ✓ / /zh/assets UI 仍英文）；并入 BL-032 Soft-watch S1+S2 4 features 一批解决
- 4 features 全 generator：F001 Checkbox 删 keepMounted（base-ui Indicator 配置错配）+ 2 测试 case 补 gap / F002 {{date}} token 加入 SubstituteVariables + KB prompt + 1 行 [DATE] backfill / F003 Server-side validation 兜底（v0.9.9 §3 落地）/ F004 /assets i18n 5 语言完整接入（含错误 toast）
- D1-D4 + Q1-Q4 锁定：删 keepMounted / date 必填字段 / BRACKET_RE 严格大写防误报 / 5 语言全填 ja/ko/es 机译标 BL-014 审核
- spec docs/specs/BL-033-quality-followups-and-assets-i18n-spec.md
## ✅ BL-032 KB AI prompt placeholder 标准化 — DONE 2026-05-04（首轮 PASS @ cc1658d；prod backfill 25 行已跑）
- v0.9.9 铁律 5 第一次按规矩跑数据迁移验证有效（updateAsset mutation 路径，0 副作用漏洞）
## ✅ BL-031 Composer locale + product filter — DONE 2026-05-04（首轮 PASS @ c1405c7）
## ✅ BL-030 KB → Asset 数据通路完整迁移 — DONE 2026-05-04
## ✅ BL-027 Asset Followup + Icon Hotfix — DONE 2026-05-03
## ✅ BL-025 / BL-026 — DONE 2026-05-03（ADR-011/012 lock）
## ✅ Framework v0.9.6 / v0.9.7 / v0.9.8 / v0.9.9 — DONE
## 用户手工待办（按优先级）
1. **BL-033 done — prod redeploy + F002 backfill + 浏览器三验**（详 spec §5 部署顺序）
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

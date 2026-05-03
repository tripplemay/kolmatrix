---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BL-027 BL-026 Followup + Asset Icon Hotfix + Framework v0.9.7** — building → verifying（2026-05-03 21:40）；7/7 features 完成，staging 已部署 @ 65a2b60
- F002 woff2 hotfix done / F003 F009 反向 CI case done / F004 pre-commit hook + 6-case test done / F005 PR template 2-of-N done / F006 S2/S3/S4 测试补 (5 e2e + 5 integration + 3 e2e + 2 unit + 2 integration) done / F007 environment.md S10+S11 done
- prod git_sha=a9c4ef8（含 icon bug，等本批次 Reviewer 签收 + done 后用户 redeploy 至 65a2b60+）
- staging git_sha=65a2b60 == main HEAD ✅
## ✅ BL-026 Asset UX Redesign — DONE 2026-05-03
- 6/6 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BL-026-asset-ux-redesign-signoff-2026-05-03.md；12 Soft-watch 中 S1/S5-S9 不阻塞，S2-S4/S10-S11 在 BL-027 收尾
## ✅ BL-025 素材中心 — DONE 2026-05-03
- 9/9 features PASS；ADR-011 统一 Asset 表 + EmailTemplate dual-write — 不动
## ✅ Framework v0.9.6 — DONE 2026-05-03（v0.9.7 在 BL-027 done 阶段 Planner 处理）
## 用户手工待办（按优先级）
1. **BL-027 done 后再 redeploy prod** — current a9c4ef8（含 icon bug），BL-027 done 后切新 commit 触发 deploy 修 icon + 4 layer guard 上线
2. ~2026-05-09 BIx F004 staging YouTube sync 走查 — SSH grep `/var/log/kolmatrix-kol-sync.log` 末 7 天 JSON
3. @next/bundle-analyzer + Lighthouse 实测脚手架 → 推迟到独立小批次
## 关键决议（已 lock）
- BL-025 ADR-011 统一 Asset 表 + EmailTemplate dual-write — 不动
- BL-026 ADR-012 Outreach-First 心智重排 — 不动
- BL-027（2026-05-03）：Generator 走完整流程（不 Planner shortcut）/ 最严格 framework 沉淀（4 layer：PR template + pre-commit hook + CI 反向 case + L2 spot check）/ 合并 BL-026-followup
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-027-i18n（重号警告：BL-027 暂用为本 hotfix 批次，i18n 候选改名 BL-029） / BL-028 low / 余 11 deferred
- 时间线：05-03 BL-025+v0.9.6+BL-026 ✅ + BL-027 启动 → 05-05 BL-027 done → 05-06 prod redeploy + BL-020 → 05-08~09 BL-024 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

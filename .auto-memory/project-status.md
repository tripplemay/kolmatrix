---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BL-026 Asset UX Redesign + Outreach-First 心智** — 启动 building（2026-05-03）；推翻 BL-025 §F004.B 部分（sidebar / 4 tabs / Create blank 假按钮），改三栏→双栏 + Right Drawer + Top Filter Dropdown / variant tree 折 Preview / Empty state system_seed 展示 / /outreach composer 加 search+product filter（轻）/ AssetCard + Sort + UsedIn names + Wizard cost 提示
- 6 features，F001（ADR-012 + spec 起草）已 Planner done，F002-F006 等 Generator；估 ~3-3.5 day
- prod git_sha=47827ad（BL-025 + followup 已上 prod，2026-05-03 ~05:00 UTC redeploy 完成；本批次需要再次 redeploy）
## ✅ BL-025 素材中心 / Asset Library — DONE 2026-05-03
- 9/9 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BL-025-asset-library-signoff-2026-05-03.md
- 后端层 + 数据 + Material Symbols 守门保留；UI 层心智偏离由 BL-026 重构
## ✅ Framework v0.9.6 — DONE 2026-05-03
- 8 条 proposed-learnings 全部按 Planner 预判落地（commit 83205d4）：vitest testTimeout / 铁律 #12 staged 索引 / prisma generate 显式 / perf 模板 / UI spec 自审 / L2 字体子集 / fire-and-forget audit / first-round PASS 判据
- BL-026 spec 起草已按 v0.9.6 [#5] §S1 4 段自审 checklist 跑过
## 用户手工待办
1. **BL-026 done 后再 redeploy prod** — current 47827ad（含 BL-025 全），BL-026 done 后切 c302eb4+ 新 commit 触发 deploy
2. ~2026-05-09 BIx F004 staging YouTube sync 走查 — SSH grep `/var/log/kolmatrix-kol-sync.log` 末 7 天 JSON
3. @next/bundle-analyzer + Lighthouse 实测脚手架 → 推迟到独立小批次
## 关键决议（已 lock）
- BL-025 架构方案 X（统一 Asset 表，ADR-011）+ EmailTemplate dual-write 兼容期 — 不动
- BL-026 推翻 §F004.B 部分（ADR-012）：心智 Outreach-First / drawer + top filter / 3 tabs / system_seed welcome
- BL-025-followup mini-batch 不开（被 BL-026 完全吸收）
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-026 high (开工中) / BL-027-i18n low（候选） / BL-028 low / 余 deferred
- 时间线：05-03 BL-025 ✅ + framework v0.9.6 ✅ → 05-03~06 BL-026 → 05-07 BL-020 → 05-08~09 BL-024 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BL-025 素材中心 / Asset Library** — building patch round（2026-05-03）；上轮 9 features commit+push+CI 全绿，但 F004/F005/F008 部分 acceptance 未达，用户决议先补遗 8 项再 verifying（features.json 中 F004/F005/F008 status: completed → in_progress；F001/F002/F003/F006/F007/F009 保持 completed）
- 补遗 8 项：wizard 单 Dialog → 3-step + 6 速选 chip / quick action wire / Regenerate popup / "..." More menu / Send to outreach + composer prefill / IntersectionObserver 触底加载 / archiveAction+duplicateAction+deleteAction server actions（duplicate 是新 mutation） / e2e tests assets-page + asset-send-to-outreach；估时 ~5-6h
- 后置（verifying 阶段做）：visual baseline 4 个新 + L2 浏览器并排 design-draft/variant-a-296k vs staging
- prod 当前 git_sha: 等用户 SSH redeploy hotfix 610c6d7（含 19 漏 icon 修复）
## ✅ BIx-mvp-polish-pass — DONE 2026-05-02
- 5/5 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BIx-mvp-polish-pass-signoff-2026-05-02.md
- L1（lint/tsc/test 678 pass/build 79 pages）+ L2（6 安全头/self-host MS/staging migration/dry-run sync）全 PASS
## 用户手工待办
1. **~2026-05-09 检查 BIx F004 staging YouTube sync**（用户 2026-05-02 决议不做自动化）— SSH staging grep `/var/log/kolmatrix-kol-sync.log` 末尾 7 天 JSON：任一日 inserted < 30 / quota ≠ [8500,9200] / errors 非空 / engagementBatchStats 失败率 > 10% → hotfix 或 reopen F004
2. 装 @next/bundle-analyzer + Lighthouse 实测脚手架（O3-O4 数字证据补齐）— 推迟到 BL-025 或独立小批次
## 关键决议（已 lock）
- BL-025 架构方案 X（统一 Asset 表，ADR-011）+ MVP 时间不硬，BL-025 优先（在 BL-020 之前）
- BL-025 视频脚本 A 选项；变体树 parentId 链；不做模板商城；generate 不限频但 audit log
- BL-025 patch round（2026-05-03 用户决议）：wizard 改 3-step + 6 chip / Stitch 不重新出图（design system primitive 组合即可）/ visual baseline + L2 deferred 到 verifying
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-026 deferred / BL-027 low / 余 10 条 low/deferred
- 时间线：05-02 BIx DONE ✅ → 05-02~03 BL-025 9 features → 05-03 patch round → ~05-04 verifying → ~05-08 BL-025 done → ~05-09 BL-020 → ~05-13 上线

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

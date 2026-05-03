---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BL-025 素材中心 / Asset Library** — verifying ⏳ 等 Reviewer L1+L2；patch round 完成 2026-05-03（johnsong），9 features 全 commit + 本地 lint/tsc/test 全过（mutations 20 + actions 11 + actions-mutations 14 + use-filter-state 7 + e2e 12 等）+ CI 在跑 c302eb4 + staging 部署完成 git_sha=c302eb4 对齐（Asset 表 + EmailTemplate dual-write migration 应用 / 11 行迁移成功 10 system_seed + 1 user_created）+ CI E2E boundary fix（filter-shape 拆出 use-filter-state，page.tsx server 不再 import 'use client' module）
- F004/F005/F008 patch 补齐：3-step wizard（Step1 product+type / Step2 textarea+6 速选 chip / Step3 spinner→preview+Discard/Regenerate/Save&Edit）+ AssetCard 4 quick actions wire + Detail panel "..." More menu（@base-ui/react/menu，email 6 项 / video 5 项 / archived→Restore）+ Regenerate popup + IntersectionObserver 触底分页（loadMoreAssetsAction）+ Send to Outreach toast banner + e2e tests + duplicateAsset mutation + 4 server actions（archive/duplicate/delete/discard）
- Hotfix: deploy-staging.sh + deploy-prod.sh 加显式 `npx prisma generate`（NODE_ENV=production 跳 postinstall 坑，BL-025-F001 schema 变更首次暴露；framework/proposed-learnings.md 已沉淀）
- prod git_sha: 仍等用户 SSH redeploy（含 BL-025 + hotfix bb637a1 19 漏 icon）
## ✅ BIx-mvp-polish-pass — DONE 2026-05-02
- 5/5 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BIx-mvp-polish-pass-signoff-2026-05-02.md
## 用户手工待办
1. **~2026-05-09 检查 BIx F004 staging YouTube sync**（用户 2026-05-02 决议不做自动化）— SSH staging grep `/var/log/kolmatrix-kol-sync.log` 末尾 7 天 JSON：任一日 inserted < 30 / quota ≠ [8500,9200] / errors 非空 / engagementBatchStats 失败率 > 10% → hotfix 或 reopen F004
2. 装 @next/bundle-analyzer + Lighthouse 实测脚手架 → 推迟到 BL-025 之后或独立小批次
## 关键决议（已 lock）
- BL-025 架构方案 X（统一 Asset 表，ADR-011）+ MVP 时间不硬，BL-025 优先（BL-020 之前）
- BL-025 视频脚本 A 选项；变体树 parentId 链；不做模板商城；generate 不限频但 audit log
- BL-025 patch round（2026-05-03 用户决议）：wizard 改 3-step + 6 chip / Stitch 不重新出图（design system primitive 组合即可）/ visual baseline + L2 deferred 到 verifying
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-026 deferred / BL-027 low / 余 10 条
- 时间线：05-02 BIx ✅ → 05-03 BL-025 patch ✅ → 05-03 BL-025 verifying → ~05-04 BL-025 done → 05-04 BL-020 → ~05-08 上线对外

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-025 素材中心 / Asset Library — DONE 2026-05-03
- 9/9 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BL-025-asset-library-signoff-2026-05-03.md
- 主分支 HEAD: c302eb4（+ ef6e634/cb chore state）；CI 8/8 jobs success；staging git_sha 对齐 c302eb4
- Asset 表 staging 实测 10 行 = email_template 10 行（dual-write parity）；RLS 启用 + policy `asset_tenant_isolation`
- 6 条 Soft-watch 不阻塞：S1 F003 测试位置 / S2 <1280px modal 后备 / S3 visual baseline 4 PNG + spec scaffold（Reviewer follow-up） / S4 F009 Pattern 6+7 / S5 wizard discard 多花 1 次 AI 调用 / S6 prod 仍 a3b0cd1 等用户 SSH redeploy
## ✅ BIx-mvp-polish-pass — DONE 2026-05-02
- 5/5 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BIx-mvp-polish-pass-signoff-2026-05-02.md
## 用户手工待办（按优先级）
1. **Prod redeploy（高，BL-025 上线前阻塞）** — GitHub Actions → "Deploy to Production" → Run workflow on main，把 c302eb4（BL-025 + hotfix bb637a1 19 漏 icon + deploy script prisma generate hotfix）一并上 prod
2. **~2026-05-09 检查 BIx F004 staging YouTube sync** — SSH grep `/var/log/kolmatrix-kol-sync.log` 末尾 7 天 JSON：任一日 inserted < 30 / quota ≠ [8500,9200] / errors 非空 / engagementBatchStats 失败率 > 10% → hotfix 或 reopen F004
3. 装 @next/bundle-analyzer + Lighthouse 实测脚手架 → 推迟到独立小批次
## 关键决议（已 lock）
- BL-025 架构方案 X（统一 Asset 表，ADR-011）+ EmailTemplate 1 sprint dual-write 兼容期（cleanup migration 独立批次）
- BL-025 视频脚本 A 选项；变体树 parentId 链；不做模板商城；generate 不限频但 audit log
- BL-025 patch round（2026-05-03 用户决议）：wizard 改 3-step + 6 chip / Stitch 不重新出图 / visual baseline + L2 deferred 到 verifying
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-026 deferred / BL-027 low / 余 10 条
- 时间线：05-02 BIx ✅ → 05-03 BL-025 ✅ → ~05-04 BL-020 启动 → ~05-08 上线对外（prod redeploy 后）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

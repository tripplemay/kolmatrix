---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BL-025 素材中心 / Asset Library** — 即将启动 building；前置 ✅ BIx done + ✅ ADR-011 + ✅ Stitch 稿入仓 + ✅ icon hotfix bb637a1 推；spec drafted-complete 含 §F004.A/B/C UI Fidelity 硬化 + F009 守门加固
- 9 features (~5.75-6 day Generator + 1 day Reviewer)；统一 Asset 表（方案 X 含 EmailTemplate dual-write migration）+ /assets 三栏页面（Filter/Grid/Detail）+ variant tree + AI generate/regenerate + composer 接通 + KB 集成 + Send to Outreach + F009 守门
- prod 当前 git_sha: 等用户 SSH redeploy hotfix 610c6d7（含 19 漏 icon 修复）
## ✅ BIx-mvp-polish-pass — DONE 2026-05-02
- 5/5 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BIx-mvp-polish-pass-signoff-2026-05-02.md
- L1（lint/tsc/test 678 pass/build 79 pages）+ L2（6 安全头/self-host MS/staging migration/dry-run sync）全 PASS
## Hotfix bb637a1（已推 main，等 prod redeploy）
- BIx F005-B Material Symbols subset 漏 19 icon（5 类 grep 范式：JSX prop / 三元 / 对象值 / 数组 / return + ?? fallback），prod 用户字符方框
- 已加 manifest + Pattern 4 + 重生 woff2（80 unique icons / 9216 bytes）；F009 守门加固加入 BL-025
## Done 阶段 TODO（Planner 接力）
1. 处理 framework/proposed-learnings.md 6 条（Reviewer 3 + Planner 3 — 本 commit 落地）
2. /schedule 7-day BIx F004 staging follow-up agent（soft-watch acceptance）
3. 装 @next/bundle-analyzer + Lighthouse 实测脚手架（O3-O4 数字证据补齐）—— 推迟到 BL-025 或独立小批次
## 关键决议（已 lock）
- BL-025 架构方案 X（统一 Asset 表，ADR-011）+ MVP 时间不硬，BL-025 优先做（在 BL-020 之前）
- BL-025 视频脚本 A 选项（仅查看/编辑/复制）；变体树 parentId 链；不做模板商城；generate 不限频但 audit log
- F004 KOL_SYNC_MIN_SUBSCRIBERS env var：prod 默认 1000 / staging 显式 10000
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-025 high (即将开工) / BL-026 deferred / BL-027 low / 余 10 条 low/deferred
- 时间线：05-02 BIx DONE ✅ → 05-02~03 BL-025 启动 → ~05-08 BL-025 done → ~05-09 BL-020 → ~05-10 BL-024 → ~05-13 上线对外客户

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

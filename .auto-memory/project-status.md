---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-012-apify-kol-integration v3 BUILDING（5/8 16:30 增量 F006a sidebar 入口 / 14 features 6 done / fix_rounds=1）
- Stage 1.5 signoff PASS @ f2f5dbb（tenant_admin 进 preview / marketer redirect / read-only / 数据流隔离 ✓）
- v3 增量：用户 5/8 16:30 请求 sidebar 入口 → 决议 1=E (UserAvatarMenu admin section) 2=A (BL-012 加 F006a，不切批次)
- canonical 8-item rule 限制：不能加 sidebar 顶层 nav 第 9 项；改 UserAvatarMenu 下拉 conditional admin section（仅 platform_admin/tenant_admin）
- F006a 范围：isAdminRole helper + UserAvatarMenu role prop + i18n 5 locale + manifest +1 + 4 单测 + staging 验证 / ~30min G + 10min R
- spec v3 @ docs/specs/BL-012-apify-kol-integration-spec.md (§4.5.6 新增) / Stage 2 (F007-F013) 仍等用户决策门
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low post-MVP
## 待办
1. BL-012 §4.6 数据累积后再评估 Stage 2
2. F003 cron 行 ops（若仍需）由后续批次处理
3. 用户如需，可触发 Stage 2 规划 / re-check

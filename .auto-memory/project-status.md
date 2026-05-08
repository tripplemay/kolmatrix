---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-012-apify-kol-integration DONE 5/8 15:50（Stage 1.5 signoff PASS，Stage 2 等用户决策门）
- Reviewer 复验结论：tenant_admin 现在可进入 `/[locale]/admin/apify-preview`，marketer 仍被重定向回 dashboard
- L1 / 定点集成 / staging smoke 均通过；preview 页保持 read-only
- 相关文件：
  - `src/app/[locale]/admin/apify-preview/page.tsx`
  - `src/app/[locale]/admin/apify-preview/__tests__/page.test.tsx`
  - `tests/integration/admin-apify-preview.test.ts`
- `docs.signoff` 已写入 `docs/test-reports/BL-012-apify-kol-integration-signoff-2026-05-08.md`
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low post-MVP
## 待办
1. BL-012 §4.6 数据累积后再评估 Stage 2
2. F003 cron 行 ops（若仍需）由后续批次处理
3. 用户如需，可触发 Stage 2 规划 / re-check

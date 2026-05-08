---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-012-apify-kol-integration DONE 5/8 19:23（fix-round 1 + F006a + fix-round 2 综合复验 PASS，Stage 2 等用户决策门）
- Stage 1.5 + F006a 全 done；fix-round 2 兼容 prod 真数据 `externalUrls` / `aggregatorLinks` 形状后，preview 真实可渲染
- L1 / 定点集成 / npm run test / prod preview smoke 均 PASS
- 相关文件：
  - `src/lib/admin/apify-preview-client.ts`
  - `src/lib/admin/__tests__/apify-preview-client.test.ts`
  - `src/components/layout/UserAvatarMenu.tsx`
  - `docs/test-reports/BL-012-apify-kol-integration-signoff-2026-05-08.md`
- `docs.signoff` 已写入 `docs/test-reports/BL-012-apify-kol-integration-signoff-2026-05-08.md`
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low post-MVP
## 待办
1. BL-012 §4.6 数据累积后再评估 Stage 2
2. F003 cron 行 ops（若仍需）由后续批次处理
3. 用户如需，可触发 Stage 2 规划 / re-check

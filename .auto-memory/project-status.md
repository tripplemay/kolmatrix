---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-012-apify-kol-integration DONE 5/9 00:43（Stage 2 staging 复验 PASS）
- features 14/14 completed（F001-F006 + F006a + F007-F013 全部 PASS）
- Stage 2 概要：`ApifyKolSyncAdapter` / `mapApifyKolItemToRawKolData` / `quality.ts` apify-kol 分支 / `scripts/kol-sync-daily.ts` 注入 / `tests/integration/apify-kol-adapter.test.ts` / `docs/dev/kol-sync-runbook.md`
- L1 / unit / integration / `npm run test` 159 files / 1131 tests PASS
- staging 证据：`https://staging.kol.guangai.ai/en/admin/apify-preview` 可加载真实数据，`tableRows = 50`，无 fetch-error banner；marketer 仍被重定向
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 待办
1. BL-012 §4.6 数据累积后再评估 Stage 2 后续自然增长
2. F003 cron 行 ops（若仍需）由后续批次处理
3. 用户如需，可触发后续观察 / re-check

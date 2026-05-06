---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-040 Q5 Product targetAudience 字段改 required — DONE 2026-05-06（Reviewer L2 staging PASS）
- staging `.env.staging` KOLMATRIX_APP_PASSWORD 已 sync prod 值 by Planner ops；PM2 delete+sourced start 解 env cache 问题，health 200 / db ok / redis ok / git_sha=37d4a8c
- Codex 已完成完整 L2 browser walk：创建 Product 空提交拒绝、有效提交持久化、编辑空值拒绝、编辑新值持久化、AI 生成 prompt 不再使用 `Not specified`
- L1 regression 维持全绿：`tests/integration/product-targetaudience-required.test.ts`、`tests/integration/product-flow.test.ts`、`src/lib/products/__tests__/generateAiAssets.test.ts`、`npm run lint`、`npm run typecheck`
- 签收文件：`docs/test-reports/BL-040-product-target-audience-required-signoff-2026-05-06.md`
- 软约束：`email-generator.ts` / `video-script-generator.ts` 仍有 `?? 'Not specified'`，但上游类型已收紧为 `string`，本批次不阻塞 done
- 下一批次候选：BL-043 staging gap 后续硬化 / BL-044 discovery AI semantic search

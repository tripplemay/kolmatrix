---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **HOTFIX-product-delete-cuid** — status=done（2026-04-29 20:04 BJ）
- 进度：2/2 completed，fix_rounds=0

## 新批次
- **B4-email-template-library** — status=building（2026-04-29 21:47 BJ）
- 目标：把 AI 生成的邮件模板保存并管理为可复用模板库，并在 `/outreach` 发送界面可选择
- 规格：`docs/specs/B4-email-template-library-spec.md`
- 特征：6 项，5 个 generator + 1 个 evaluator（测试/回归）

## 已验收内容
- `knowledge-base/actions.ts` 已移除 product update/delete 对 `productId` 的 UUID 限制，改为 trim 后非空字符串
- `tenantId` UUID 鉴权保持不变；未放宽租户边界
- 新增回归测试：`src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts`

## 本地验证
- `npm test -- 'src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts'` PASS（5/5）
- `npm run lint -- 'src/app/[locale]/(app)/knowledge-base/actions.ts' 'src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts'` PASS
- `npx tsc --noEmit` PASS

## Staging
- `https://staging.kol.guangai.ai/api/health` = healthy，`git_sha=2630871`，database=ok
- 真实知识库产品 `E2E Game 1777251227667` 已在 staging 完成编辑后删除验证

## 下游
- 旧批次已闭环；新批次进入 planning/building 交接

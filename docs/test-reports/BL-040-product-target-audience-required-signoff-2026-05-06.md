# BL-040 Q5 Product targetAudience Required Signoff 2026-05-06

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：PRD §13 `targetAudience` 必填偏差修复，收敛 `Product` 创建 / 编辑 / AI 生成链路中的空值路径
> Reviewer：Codex L1 + L2 实证完成，staging 已恢复可用，满足签收条件

## Summary

- Scope: `BL-040` 单功能批次，验证 `Product.targetAudience` 在数据库、Server Action、表单校验与 AI 生成 prompt 中均为必填且可持久化。
- Documents: [`docs/specs/BL-040-product-target-audience-required-spec.md`](/Users/yixingzhou/project/joyce/docs/specs/BL-040-product-target-audience-required-spec.md), [`docs/test-reports/BL-040-verifying-2026-05-06.md`](/Users/yixingzhou/project/joyce/docs/test-reports/BL-040-verifying-2026-05-06.md), [`progress.json`](/Users/yixingzhou/project/joyce/progress.json)
- Environment: 本地 `localhost:3099` + staging `https://staging.kol.guangai.ai`
- Result totals: PASS 5, FAIL 0, BLOCKED 0, NOT RUN 0

## Test Cases

- BL-040-TC-01 Empty create submit rejected - PASS
- BL-040-TC-02 Valid create persists `targetAudience` on staging - PASS
- BL-040-TC-03 Edit cannot clear `targetAudience`; valid replacement persists - PASS
- BL-040-TC-04 AI assets regeneration uses real `targetAudience`, no `Not specified` fallback in prompt - PASS
- BL-040-TC-05 L1 regression - PASS

## Execution Results

### BL-040-TC-01 Empty create submit rejected

Result: PASS
Evidence:
- Staging `/zh/knowledge-base` 创建产品弹窗空提交后，`targetAudience` 标红并显示 `请填写目标受众。`
- 本地 3099 smoke 与集成测试都覆盖了同一校验边界。
Observed Behavior:
- 前端阻止空值提交，未进入持久化路径。
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-040-TC-02 Valid create persists `targetAudience` on staging

Result: PASS
Evidence:
- Staging 新建 `BL040 Staging Test Game` 后，列表中显示 `18-25 mobile strategy gamers in SEA`
- 刷新后仍可见，说明持久化成功
Observed Behavior:
- 创建表单提交后跳转回产品列表，目标受众写入数据库并在 UI 中回显。
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-040-TC-03 Edit cannot clear `targetAudience`; valid replacement persists

Result: PASS
Evidence:
- 编辑同一 staging Product 时清空 `targetAudience` 再提交，页面再次提示 `请填写目标受众。`
- 改为 `18-25 mobile strategy gamers globally` 后提交成功，列表值同步更新
Observed Behavior:
- 编辑流与创建流共享同一必填约束，且更新后可见。
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-040-TC-04 AI assets regeneration uses real `targetAudience`

Result: PASS
Evidence:
- 创建后的产品卡显示 `3 套邮件模板` 和 `2 套视频脚本`
- 生成 prompt 走 `input.targetAudience`，没有 `Target audience: Not specified`
Observed Behavior:
- AI 生成链路使用真实受众输入，不再依赖默认兜底文本。
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-040-TC-05 L1 regression

Result: PASS
Evidence:
- `npm run test:integration -- tests/integration/product-targetaudience-required.test.ts tests/integration/product-flow.test.ts` -> `2/2` files, `11/11` tests PASS
- `npx vitest run src/lib/products/__tests__/generateAiAssets.test.ts` -> `1/1` file, `14/14` tests PASS
- `npm run lint` -> `0 errors / 3 warnings`
- `npm run typecheck` -> PASS
Observed Behavior:
- 变更未破坏相关集成、单测、静态检查。
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

## Defects

- None.

## Coverage Gaps

- `src/lib/assets/generators/email-generator.ts` 和 `src/lib/assets/generators/video-script-generator.ts` 仍保留 `?? 'Not specified'`，但本批次已将上游类型收紧为 `string`，当前不走运行时兜底，属于非阻塞软约束。

## Open Questions

- 是否需要在后续批次清理上述两个死代码兜底点。

## Final Decision

- Ready: Yes
- Readiness: Ready
- Final: `PASS`

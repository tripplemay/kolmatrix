# HOTFIX-product-delete-cuid Signoff 2026-04-29

> 状态：**Evaluator 验收通过**（由 `verifying` 置 `done`）
> 触发：知识库产品删除失败 hotfix 完成后，验证 `Product.cuid()` 生产数据的编辑/删除链路

## 变更背景

知识库页面的产品编辑/删除链路此前把 `productId` 当成 UUID 校验，和实际 `Product.id = cuid()` 的生产数据不匹配。本批修复将 `productId` 改为仅做 trim + 非空校验，同时保持 `tenantId` UUID 鉴权不变，并补回归测试。

## 变更功能清单

### F001：修复 knowledge-base 产品编辑/删除的 productId 校验与 Product.cuid() 主键不匹配问题

**Executor：** generator

**文件：**
- `src/app/[locale]/(app)/knowledge-base/actions.ts`

**改动：**
`updateProduct` / `deleteProduct` 不再把 `productId` 当 UUID 校验，改为 trim 后非空字符串后直接传给 Prisma；`tenantId` UUID 鉴权保持不变。

**验收标准：**
- 现有 `Product.id = cuid()` 的记录可正常编辑和删除
- `tenantId` 非 UUID 仍被拒绝

### F002：为 knowledge-base 产品编辑/删除补回归测试，覆盖 cuid 产品 ID 场景

**Executor：** generator

**文件：**
- `src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts`

**改动：**
新增 update/delete 正例和 tenant UUID / blank productId 负例测试。

**验收标准：**
- 本地测试稳定通过
- 覆盖 cuid productId pass-through 与 tenant UUID 保持拒绝

## 未变更范围

| 事项 | 说明 |
|---|---|
| Prisma schema | 未改动，`Product.id` 既有 cuid 语义保持不变 |
| 租户鉴权 | 未放宽，仍要求 `tenantId` 为 UUID |

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| knowledge-base 产品更新/删除 | cuid 生产数据可能被 UUID 校验挡住 | cuid 生产数据可正常编辑/删除 |

## 类型检查 / CI

```bash
npm test -- 'src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts'  # PASS (5/5)
npx eslint 'src/app/[locale]/(app)/knowledge-base/actions.ts' 'src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts'  # PASS
npx tsc --noEmit  # PASS
curl -sS https://staging.kol.guangai.ai/api/health  # healthy, git_sha=2630871
```

## Staging 验证

- 登录态 staging 页面：`https://staging.kol.guangai.ai/zh/knowledge-base`
- 目标记录：`E2E Game 1777251227667`
- 编辑验证：将名称改为 `E2E Game 1777251227667 QA` 后保存成功
- 删除验证：同一记录可从 UI 删除，页面列表中不再出现该条目

## 结论

- PASS: 2
- PARTIAL: 0
- FAIL: 0

本批次验收通过，签收同意进入 `done`。

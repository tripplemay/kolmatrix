---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **HOTFIX-product-delete-cuid** — status=building（2026-04-29 19:20 BJ）
- 进度：0/2 completed，fix_rounds=0

## 已确认根因
- 生产知识库“删除产品”失败不是权限或数据缺失
- `Product.id` 为 `cuid()`，但 `updateProduct/deleteProduct` 仍用 `UUID_RE` 校验 `productId`
- 结果：前端删除请求在进入 Prisma 前直接返回 `{ ok: false }`，弹出 `Could not delete product. Please retry.`

## 当前范围
- 仅修复 knowledge-base 产品 update/delete 的 ID 校验
- 同批补最小回归测试，覆盖 cuid productId 场景
- 不扩展到 UI 重构、文案优化或其他知识库功能

## 下游
- Generator 按 handoff 修复代码与测试
- Evaluator 后续需重点验收生产复现场景：知识库删除产品成功

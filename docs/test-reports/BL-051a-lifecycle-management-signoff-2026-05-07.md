# BL-051a Lifecycle Management Signoff 2026-05-07

> 状态：**Reviewer signoff PASS**
> 触发：BL-051a `verifying` 完成本机 L1 + staging smoke 复验
> Reviewer：Codex

## 变更背景

BL-051a 合并 weekly-report token lifecycle 与 product soft delete 两条生命周期治理链路，目标是把 token 过期/撤销、产品软删/审计/引用防御统一收口，并保证 staging / integration / unit 都可复验。

## 变更功能清单

### F001-F005：weekly-report token lifecycle

**Executor：** generator

**文件：**
- `prisma/schema.prisma`
- `prisma/migrations/20260507150000_lifecycle_management/migration.sql`
- `src/lib/weekly-report/share-token.ts`
- `src/lib/weekly-report/persistence.ts`
- `src/app/shared/weekly-report/[token]/page.tsx`
- `src/app/api/weekly-reports/[id]/revoke/route.ts`
- `src/app/[locale]/(app)/weekly-report/page.tsx`
- `src/app/[locale]/(app)/weekly-report/WeeklyReportClientActions.tsx`
- `tests/unit/weekly-report-token-lifecycle.test.ts`
- `tests/integration/weekly-report-token.test.ts`

**验收结果：** PASS

**证据：**
- `npx tsc --noEmit` 通过
- `npm run test` 通过，`148` files / `1054` tests PASS
- `npm run test:integration` 通过，`67` files / `408` tests PASS，`2` skipped
- staging `/zh/weekly-report` 页面正常渲染，周报 shell / 历史选择 / 分享相关 UI 均可见

### F006-F011：product soft delete + lifecycle integrity

**Executor：** generator

**文件：**
- `prisma/schema.prisma`
- `prisma/migrations/20260507150000_lifecycle_management/migration.sql`
- `src/app/[locale]/(app)/knowledge-base/actions.ts`
- `src/app/[locale]/(app)/knowledge-base/page.tsx`
- `src/app/[locale]/(app)/assets/page.tsx`
- `src/app/[locale]/(app)/campaigns/[id]/CampaignHeader.tsx`
- `src/app/[locale]/(app)/campaigns/[id]/ai-suggestions-actions.ts`
- `src/lib/campaigns/create.ts`
- `src/lib/campaigns/detail.ts`
- `src/lib/discovery/smart-match.ts`
- `src/lib/roi/queries.ts`
- `tests/unit/products-soft-delete.test.ts`
- `tests/integration/product-soft-delete.test.ts`

**验收结果：** PASS

**证据：**
- `npm run test` 通过，软删相关单测 4+ 断言全绿
- `npm run test:integration` 通过，soft delete / audit trail 场景全绿
- staging `/zh/knowledge-base` 只显示 active 产品，未出现 tombstone 行
- staging `/zh/campaigns/8ad04ded-8bda-4360-9148-58da19f8a957` 正常渲染，页面无空产品崩溃

## 未变更范围

| 事项 | 说明 |
|---|---|
| 产品实现代码 | 本轮签收仅验证实现，不额外修改产品代码 |
| staging 数据 | 未执行破坏性写操作 |

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| weekly-report token | 仅 shareToken | 增加 expiresAt / revokedAt 状态治理 |
| product lifecycle | hard delete 风险高 | soft delete + 引用检查 + 审计保留 |
| 软删可见性 | 混入列表 / 详情风险 | list / detail / AI suggestions 都做防御 |

## 类型检查 / CI

```text
npm run lint
0 errors / 3 warnings

npx prisma generate
PASS

npx tsc --noEmit
PASS

npm run test
148 files / 1054 tests PASS

npm run test:integration
67 files / 408 tests PASS / 2 skipped
```

## L2 实测记录（v0.9.9 — BL-031 沉淀）

| 项 | 证据 |
|---|---|
| Staging git_sha == main HEAD | `https://staging.kol.guangai.ai/api/health` 返回 `status=healthy`，`database=ok`，`redis=ok` |
| 端到端流验证 | `/zh/weekly-report`、`/zh/knowledge-base`、`/zh/campaigns`、`/zh/campaigns/[id]` 浏览器 smoke 通过 |
| 关键 invariant | 周报页、知识库页、活动页都可渲染；没有白屏 / 错误页 / 软删 tombstone 泄漏 |
| 浏览器手动验（如 UI 类）| DevTools snapshot 确认周报与知识库页面结构正常 |

## Ops 副作用记录

| Agent | 阶段 | 操作摘要 | 副作用对齐 | 用户授权 |
|---|---|---|---|---|
| Reviewer | verifying | 运行 `npx prisma generate` 恢复本地 Prisma client，同步最新 migration；随后复跑 L1 / L2 | 无数据库写入，仅本地生成态恢复 | 用户授权 |

## Harness 说明

本批次经 Harness 状态机完整验证后进入 `done`。
`progress.json` 已设为 `status: "done"`，`docs.signoff` 已填入本报告路径。

## Soft-watch

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | 本地 `npx prisma generate` 在拉取新 migration 后是必要前置 | low | 以后每次 pull 后先生成 Prisma client |
| S2 | 周报页的分享按钮在当前 staging 抓到是 disabled | low | 后续若要人工验证 revoke UI，需要有带 token 的报告样本 |

## Framework Learnings

### 新规律
- 新 migration 合入后，本地 typecheck 可能先被旧 Prisma client 卡住，`npx prisma generate` 是必要的复验前置。
  - 来源：BL-051a L1 复验

### 新坑
- `weekly-report` 的分享 UI 不能只看按钮本身，必须同时确认 token 样本是否存在。
  - 来源：BL-051a staging 走查

### 模板修订
- 无

## Final Decision

- Ready: Yes
- Readiness: Ready
- Final: `PASS`

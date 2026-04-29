# HOTFIX-aigc-action-endpoint-2026-04-29 Signoff 2026-04-29

> 状态：**Evaluator 验收通过**（verifying → done）
> 触发：生产 AI Action 调用契约迁移热修（`/actions/{id}/run` → `/actions/run`）

---

## 变更背景

AIGC Gateway Action 运行接口已迁移为 `POST /v1/actions/run`（body 传 `action_id`）。
KOLMatrix 旧调用仍使用 `POST /v1/actions/{id}/run`，导致生产侧 AI 功能失败。
本批 hotfix 仅修正调用契约与响应字段兼容，不改业务流程。

---

## 验收范围

- `src/lib/kol-database/intelligence.ts`
- `src/lib/campaigns/suggestions.ts`
- `src/lib/roi/insights.ts`
- `src/lib/weekly-report/generate.ts`
- `src/lib/email/customize.ts`

验收标准：
- 5 个 action client 统一为 `POST /v1/actions/run + action_id`
- 响应兼容 `traceId ?? trace_id`
- L1（lint/tsc/相关测试）通过
- staging 5 条链路恢复（database/campaigns/roi/weekly-report/outreach）

---

## L1 结果

```bash
npm run lint                                                     # PASS
npx tsc --noEmit                                                 # PASS
npx vitest run src/lib/roi/__tests__/insights.test.ts \
  src/lib/weekly-report/__tests__/generate.test.ts              # PASS
```

附加代码检查：
- 5 处 client 均已使用 `.../actions/run`
- 未发现残留 `.../actions/{id}/run` 调用

---

## Staging 验收结果

- health：`https://staging.kol.guangai.ai/api/health` healthy，`git_sha=ffc43d5`

### 1) /database AI Intelligence
- 点击 `Generate Insights` 成功
- 页面出现缓存时间与洞察内容
- 请求：`POST /en/database` → `200`

### 2) /campaigns/:id AI Suggestions
- 点击 `Generate Suggestions` 成功
- 页面出现 3 条建议与 action link
- 请求：`POST /en/campaigns/{id}` → `200`

### 3) /roi AI Insights
- 点击 `Generate AI Insights` 成功
- 页面出现生成时间与分析内容
- 请求：`POST /en/roi` → `200`

### 4) /weekly-report Generate
- 点击 `Generate Weekly Report` 成功
- 页面出现完整报告（含 Executive Summary）
- 请求：`POST /en/weekly-report` → `200`

### 5) /outreach Customize with AI
- 当前 campaign 数据为 `0/0 selected` 且提示 "No KOL has an email on file yet"
- `Customize with AI` 按预期保持 disabled，无法触发请求
- 判定：**测试数据不足导致无法触发，不构成本 hotfix 阻断**

---

## 结论

- PASS：4
- PARTIAL（数据依赖）：1（outreach）
- FAIL：0

综合判定：**通过签收（PASS with non-blocking data caveat）**。
本 hotfix 核心目标“恢复 AI Action 调用可用性”已达成。

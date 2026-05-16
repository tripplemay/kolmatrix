# BL-067-explainability-c3 Controlled Verification 2026-05-16

> 状态：**controlled checks PASS, signoff still pending**
> 触发：Reviewer 按 §4 / §6 / §8 继续补受控验证。

## 测试范围

- §4 Cost cap 满时的 silent fallback
- §6 401 / invalid API key chaos 注入
- §8 `scripts/bl067-cost-audit.ts` 24h 读数与口径检查

## 使用的源文档

- `docs/test-reports/BL-067-staging-spot-check.md`
- `docs/test-reports/BL-067-fixround1-2026-05-15.md`
- `src/app/[locale]/(app)/campaigns/[id]/explainability-actions.ts`
- `src/app/[locale]/(app)/campaigns/[id]/DetailedExplanationDialog.tsx`
- `src/lib/queue/explain-recommendations-worker.ts`
- `scripts/bl067-cost-audit.ts`
- `src/lib/ai/cost-cap.ts`

## 覆盖摘要

- §4 PASS: staging 进程 cap 从 100 临时降到 5 后，冷 campaign 的详细解释弹窗命中 `capExhaustedToast`，并落到 unavailable fallback；pre-warm 仍为 silent fallback
- §6 PASS: staging 进程 `AIGCGATEWAY_API_KEY` 临时改为 `invalid_key_test` 后，campaign 页面仍正常渲染，短解释保持 C2 fallback，详细弹窗显示 unavailable，且无生成类 audit 侧效应
- §8 PASS（脚本/口径）：`scripts/bl067-cost-audit.ts --hours=24` 在 staging 上可执行且读数为 0
- §8 pending（时间门槛）：真正的 24h soak 仍需时间窗口完成，不在本轮内硬宣告结束

## 结构化测试用例列表

| ID | 用例 | 结果 | 证据 |
|---|---|---|---|
| T4-1 | cap 满后 short prewarm silent fallback | PASS | 页面仍显示 C2 fallback，无 toast / 无生成审计 |
| T4-2 | cap 满后详细弹窗显示 cap toast | PASS | `explain-dialog-cap-toast` + `explain-dialog-fallback` 可见 |
| T6-1 | invalid API key 下页面不崩 | PASS | campaign detail 仍可渲染 |
| T6-2 | invalid API key 下短解释保持 C2 fallback | PASS | body 保持 `matched on cosine similarity` |
| T6-3 | invalid API key 下详细弹窗显示 unavailable | PASS | `explain-dialog-unavailable` 可见 |
| T8-1 | cost audit 脚本可运行并输出 24h 汇总 | PASS | total calls/tokens/cost = 0/0/0.0000 |

## 执行结果

### §4 Cap simulation

- staging 进程 `AI_DAILY_COST_USD_PER_TENANT_MAX` 临时下调到 `5`
- 注入 `event_log` 测试行：
  - marker `bl067-cap-20260516`
  - marker `bl067-cap-today-20260516`
- 冷 campaign `4cb82633-a061-41d5-9073-27c3a666d042` 的详细解释弹窗进入 cap 分支
- 观察到：
  - `Daily AI quota reached for this tenant. Showing a brief summary instead.`
  - `Detailed explanation is temporarily unavailable. Please try again later.`
- 清理：
  - 996 条注入 `event_log` 已删除
  - `audit_log` 未留下 `explain_detailed_cap_exhausted` 或生成类残留

### §6 Chaos injection

- staging 进程 `AIGCGATEWAY_API_KEY` 临时改为 `invalid_key_test`
- 页面仍可正常打开
- 短解释仍是 C2 fallback
- 详细弹窗显示 unavailable
- 相关生成类 audit 计数保持 0
- 恢复：
  - `AIGCGATEWAY_API_KEY` 已恢复为 `.env.staging` 中的正式值

### §8 Cost monitor

- 脚本命令：
  - `npx tsx scripts/bl067-cost-audit.ts --hours=24`
- 读数：
  - `calls = 0`
  - `tokens = 0`
  - `cost_usd = 0.0000`
- 结论：
  - 脚本与聚合口径可用
  - 真正的 24h soak 仍是时间门槛，不在本轮内完成

## 缺陷列表

- 无新增产品缺陷

## 待确认问题或规格缺口

- §8 的“24h monitor”是时间型门槛，必须等真实 24h 窗口结束后才能最终签收


# BL-068 Reverify Fix Round 2 2026-05-17

> 状态：**FAIL**
> 执行者：Codex Reviewer
> 环境：`https://staging.kol.guangai.ai`
> 批次：`BL-068-conversational-refine`
> 轮次：`fix-round 2`

## 测试范围

- staging 环境基线
- B6 原始失败 query 真实链路复验
- `scripts/bl068-cost-audit.ts --hours=24`
- 审计日志直查与 gate 判断

## 使用的源文档

- `docs/specs/BL-068-conversational-refine-spec.md`
- `progress.json`
- `.auto-memory/project-status.md`
- `docs/test-reports/BL-068-reverify-2026-05-17.md`

## 覆盖摘要

- PASS: staging 健康状态正常
- PASS: staging 代码 sha 仍为 `9c90f9b`，符合“fix-round 2 仅 action version 变更、无需 deploy”的 handoff 描述
- FAIL: B6 原始 query `fewer micro creators, more female audience in Japan` 在真实 UI 里仍返回 `Rerank result was invalid. Current pool unchanged.`
- FAIL: 最新审计显示 `expected_count=29`、`returned_count=30`，说明 v2 prompt 比上一轮收敛了一位，但仍未通过 strict permutation
- FAIL: 24h parse success rate 现在是 `20.00% (1/5)`，仍远低于 `>=80%` signoff gate

## 结构化测试用例

| ID | 用例 | 结果 | 证据 |
|---|---|---|---|
| T1 | staging 健康检查 | PASS | `curl https://staging.kol.guangai.ai/api/health` 返回 `healthy` |
| T2 | fix-round 2 无需 deploy 的环境前提成立 | PASS | staging repo sha 仍是 `9c90f9b91479a7acb306ac766568c78909fa3f73` |
| T3 | B6 原始 query 在 `/en/campaigns/[id]` 成功重排 | FAIL | UI 实际显示 `Rerank result was invalid. Current pool unchanged.` |
| T4 | B6 最新审计结果通过 permutation gate | FAIL | `ai_recommendation.refine_permutation_invalid`，`expected_count=29`、`returned_count=30`、`trace_id=trc_ew4fi0u4hihjdw07bu73xer3` |
| T5 | 24h parse success rate 达到 `>=80%` | FAIL | `npx tsx scripts/bl068-cost-audit.ts --hours=24` 输出 `20.00% — FAIL` |
| T6 | audit script 与 SQL 直查一致 | PASS | script=`1/5 applied`; SQL=`applied_calls=1 / total_calls=5` |

## L2 实测记录

| 项 | 证据 |
|---|---|
| Staging health | `{"status":"healthy","checks":{"database":{"status":"ok"},"redis":{"status":"ok"}}}` |
| Staging git sha | `9c90f9b91479a7acb306ac766568c78909fa3f73` |
| B6 request body | `currentPoolIds` 仍为完整 29 个 ids，说明不是 fix-round 1 的 visible-5 回退 |
| B6 response | network `reqid=49`：HTTP 200，body=`{ ok: true, data: { orderedKolIds: currentPoolIds, feedback: "", unparsable: true, capExhausted: false, errorKind: "permutation_invalid" } }` |
| B6 UI result | toast/status=`Rerank result was invalid. Current pool unchanged.` |
| Latest audit row | `action=ai_recommendation.refine_permutation_invalid`, `raw_query="fewer micro creators, more female audience in Japan"`, `expected_count=29`, `returned_count=30`, `trace_id=trc_ew4fi0u4hihjdw07bu73xer3` |
| Cost audit | `TOTAL calls: 5`, `refine_applied / total: 1 / 5`, `rate: 20.00% — FAIL` |
| SQL truth | `total_calls=5`, `applied_calls=1` |

## 缺陷列表

### B6 仍未修复：原始英文 query 依旧触发 permutation invalid

- 严重级别：High
- 复现步骤：
  1. 打开 `/en/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045`
  2. 输入 `fewer micro creators, more female audience in Japan`
  3. 点击 `Refine`
- 实际结果：
  - UI 显示 `Rerank result was invalid. Current pool unchanged.`
  - 审计记录 `expected_count=29`、`returned_count=30`
- 预期结果：
  - 该 query 应产生合法 permutation，并进入 `refine_applied`

### B5 仍未修复：24h parse success rate 继续不达标

- 严重级别：High
- 实际结果：
  - 最新 24h `refine_applied / total = 1 / 5`
  - parse success rate `20.00%`
- 预期结果：
  - `>= 80%`
- 说明：
  - B5 仍然是 B6 的级联结果；在 B6 失败继续累计 invalid 的情况下，gate 不可能通过

## 结论

- 本轮 `reverifying` 结论：**FAIL**
- fix-round 2 未达到预期，B6 只从 `29 -> 31` 收敛为 `29 -> 30`，但仍未过 strict permutation
- 当前不进入 signoff，也不继续跑 10+ dogfood，因为高优先级 blocker 已经复现
- 建议状态切换：`reverifying -> fixing`

## 修复建议

1. 继续检查 action v2 prompt 在真实 server action 路径上的输出，与 MCP `run_action` dry-run/单跑结果为何仍有偏差。
2. 把 `returned_count=30` 的完整模型输出抓出来，对比多出的那一个 ID 是重复、幻觉，还是格式清洗阶段引入。
3. 修复后再回 `reverifying`，先重跑 B6 原始 query，再看 24h parse gate。

# BL-093 aigcgateway max_tokens hotfix（生产故障)

> **Type：** Hotfix(prod 故障,走铁律 #9 流程:Planner 方案→用户确认→Generator 实装→Evaluator 验收)
> **触发：** 2026-06-07 用户报 prod "为什么推荐" 详细解释弹窗 "详细解释暂时不可用"。Planner 查 aigcgateway 实证根因
> **关联：** backlog BL-042(max_tokens 治理,本 hotfix 执行其核心,merge)· `docs/specs/BL-035-F013-actions-run-inventory.md`(7 Action 矩阵)· `framework/harness/ai-action-contract.md §4.7`

## §1 根因(已实证)

所有走 **claude-haiku-4.5** 的 aigcgateway Action 调用**默认 max_tokens=64000**(模型上限;Action 抽象层不暴露该字段,`get_action_detail` 确认配置无 max_tokens — BL-042 早预警)。上游按该上限**预检预留额度**:
- aigcgateway 余额 $39.56 现只够 "afford 55108 tokens" < 64000 → **请求预检直接拒**(0.3s,$0,0 token,status=error)。
- 实证 error 原文(trace trc_jl35g5s9...):`"This request requires more credits, or fewer max_tokens. You requested up to 64000 tokens, but can only afford 55108."`
- 实际输出仅 ~4500 token(历史 success 16-21s / ~$0.014),**64000 严重过度配置**。

**Blast radius:** 不止 Why 弹窗 —— 近期 error 横跨多 action(EXPLAIN_DETAILED + KOL bio 富化批量 01:32)。**凡 haiku-4.5 Action 全线失败**,系统性 AI 故障。

## §2 修复策略

**杠杆点:** `src/lib/aigc/run-action.ts`(`runAigcAction` 共享封装,~10 处调用)。给 wrapper 加 `maxTokens` 支持 + 合理默认值 → 一处改、全线覆盖,预留从 64000 降到合理值即可付得起。

**前置未知(F001 必须先验):** actions/run gateway 端点**是否接受 max_tokens override**?
- **若接受** → F002 = wrapper 加 `maxTokens` 参数 + sane 默认(如 8000~16000)+ 高输出 action(EXPLAIN_DETAILED 5locale×5段)单独设更高(如 16000,仍 << 64000)。最小改动。
- **若不接受**(BL-042 实测 Action 抽象层无此字段) → F002 = 把 actions/run 改 chat/completions 直调带 max_tokens(BL-042 P1),优先 prod-breaking 路径(EXPLAIN_DETAILED + enrichment),其余渐进。

**不截断保证:** max_tokens 设值须 ≥ 各 action 实际最大输出(EXPLAIN_DETAILED ~4500 → 设 ≥8000 安全)。F003 验证输出不被截断。

## §3 即时恢复(并行,用户侧,不在本批代码范围)

本 hotfix 需 dev+build+deploy,期间 AI 仍失败。**最快即时恢复 = 给 aigcgateway 充值**(+$15-20 → 余额 ~$55 afford >64000)。治标(余额再跌回 ~$46 复发),但能立刻恢复服务,与本 hotfix 并行。⚠️ 与 TikHub 是不同账户/服务。

## §F001 调查结论（2026-06-08 Generator，**反转 spec 假设**）

**源码实证（读 `~/project/aigcgateway` 源码 + MCP）：**

1. **`/actions/run` 路由不接受 max_tokens override。** `src/app/api/v1/actions/run/route.ts` body 只解析 `{action_id, variables, stream}`，`params` 只传 `{actionId, projectId, userId, variables, source}`。runner（`src/lib/action/runner.ts`）构造的上游请求是 `{model, messages, stream}` —— **从不带 max_tokens**。`applyConfigOverlay` 也不注入。→ **wrapper 传 max_tokens 会被静默丢弃**（spec Option A 不可行）。
2. **64000 来自上游 provider 默认**：gateway 不带 max_tokens 转发，上游 Anthropic 系按模型 max output cap（haiku-4.5 = 64000）预留额度 → 预检拒。
3. **但 `prepareRequest` 用 `{...request}` spread 透传 `rest`** → **只要请求里带了 max_tokens 就会转发到上游**。`/chat/completions` 路由确实接受并校验 max_tokens（`src/app/api/v1/chat/completions/route.ts`）。
4. **Action 无 per-action max_tokens 字段**（schema 的 `maxTokens` 只在 `Model`/`ModelAlias` 上，是模型容量元数据，runner 不读）。证实 spec「抽象层不暴露」。

**调用点清单（8 处，全部经单一 wrapper `runAigcAction`）：** explainability(EXPLAIN_DETAILED) / explain-recommendations-worker(EXPLAIN_SHORT) / brief(BRIEF_PARSE) / refine(REFINE) / match/llm-rerank(MATCH_RERANK) / kol-detail/topic-cloud(KOL_TOPIC) / kol/enrichment(KOL_COUNTRY) / email/customize.

**per-action 实际输出量（MCP list_logs 实测）→ max_tokens 取值：**

| action | 实际最大输出 | 建议 max_tokens |
|---|---|---|
| EXPLAIN_DETAILED | ~4929（8 次实测 4.4-4.9K） | **16000**（worst-case 5locale×5段 headroom） |
| 其余 7 个（EXPLAIN_SHORT/BRIEF_PARSE/REFINE/MATCH_RERANK/KOL_TOPIC/KOL_COUNTRY/customize） | ≤ ~800 | **默认 8192** |

均 ≪ 64000。

**修法决策（关键，需用户/Planner 定 scope）：** spec 的 Option A（wrapper override）**不可行**；Option B（chat/completions 直调）可行但重（放弃 Action prompt 抽象，prompt 要搬到 kolmatrix 维护）。**根因在 gateway**（转发时不设 sane max_tokens，放任上游按 64000 cap 预留）→ 最省且治本的修法是 **gateway 侧**：
- **B2（推荐）：** gateway `/actions/run` 路由 + runner 接受并透传 `max_tokens` → kolmatrix wrapper 加 `maxTokens` 参数按上表传 per-action 值。保留 Action 抽象，kolmatrix 改动最小。
- **B3（兜底）：** gateway runner 给请求设 sane 默认 max_tokens（如 `min(modelCap, 16000)`）→ 修复所有 gateway 消费方，kolmatrix 零改动。
- B2+B3 叠加最稳（per-action 精确 + 全局兜底）。
**⚠️ B2/B3 涉及修改 aigcgateway（独立项目/独立部署），超出 BL-093 当前「kolmatrix 杠杆点 run-action.ts」的 scope** → 报用户裁决。

## §4 Features

### F001 — 调查最省修法 + 调用点清单核对
- 实测 actions/run 端点是否接受 max_tokens override(dev/staging 发一次带 max_tokens 的 run,看是否生效 + 不被忽略)。
- 核对 `runAigcAction` 全部调用点(~10 处)+ 各 action 实际最大输出量(定 per-action max_tokens 取值)。
- 产出:修法决策(wrapper override vs chat/completions 直调)+ per-action max_tokens 表。

### F002 — 实装 max_tokens 上限
- 据 F001 决策:wrapper `runAigcAction` 加 `maxTokens`(默认 sane 值)+ 高输出 action 单独传值;或改 chat/completions 直调。
- 覆盖全部 actions/run 路径(防 whack-a-mole;BL-042 §7 矩阵全覆盖)。
- 单测:验证 max_tokens 被正确传递;不破坏既有 action 调用契约。
- L1 全绿(lint/tsc/test)。

### F003 — Codex L1+L2 + signoff
- L1:lint/tsc/test 绿。
- L2 prod/staging:部署后实测 EXPLAIN_DETAILED 调用**不再预检拒**(余额未变情况下成功返回,输出完整不截断)+ 抽样其他 action(enrichment/rerank)恢复 + aigcgateway 日志该 action 新调用 status=success。
- before/after:故障期 error(0.3s/$0)→ 修后 success(~16-21s/正常 token)。
- signoff `docs/test-reports/BL-093-signoff-2026-06-XX.md`。

## §5 风险

- ⚠️ **prod deploy OOM**(BL-086 遗留,内存未根治):F002/F003 部署须按恢复 runbook 谨慎。
- 修法依赖 gateway 是否接受 override(F001 先验);若需 chat/completions 直调,改动面较大(放弃 Action prompt 抽象,需同步维护 prompt 渲染)。
- max_tokens 设太低会截断输出 → 须 ≥ 实际最大输出 + headroom。

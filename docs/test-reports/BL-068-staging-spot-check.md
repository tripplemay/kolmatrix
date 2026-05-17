# BL-068 Staging Spot Check 2026-05-17

> 状态：**FAIL**
> 执行者：Codex Reviewer
> 环境：`https://staging.kol.guangai.ai`
> 批次：`BL-068-conversational-refine`

## 测试范围

- `/campaigns/[id]` RefineInputBar 挂载与真实 refine 行为
- `/match?campaignId=` 复用挂载
- `en / zh` locale 文案挂载
- staging 部署 sha 核对
- `scripts/bl068-cost-audit.ts --hours=24`
- audit_log 24h 直接 SQL 核对

## 使用的源文档

- `docs/specs/BL-068-conversational-refine-spec.md`
- `progress.json`
- `scripts/bl068-cost-audit.ts`
- `src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx`
- `src/app/[locale]/(app)/campaigns/[id]/RefineInputBar.tsx`

## 覆盖摘要

- PASS: `/en/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045` 能渲染 RefineInputBar
- PASS: `/zh/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045` 能渲染中文 RefineInputBar 文案
- PASS: `/en/match?campaignId=382f014c-a9f9-4fde-bcad-d5bb10ed2045` 能渲染复用的 RefineInputBar
- FAIL: staging 部署 sha 不是当前 `main` HEAD
- FAIL: 真实 refine 提交后 UI 5s 超时 toast，主路径不可用
- FAIL: refine request 仅发送可见 5 个 `currentPoolIds`，不符合 spec 的 top-30 现池重排
- FAIL: `scripts/bl068-cost-audit.ts` 在 staging 上输出 `0 calls`，与数据库真实数据冲突
- BLOCKED: parse success rate gate（≥80%）无法按脚本可信核验

## 结构化测试用例

| ID | 用例 | 结果 | 证据 |
|---|---|---|---|
| T1 | staging 健康检查 | PASS | `curl https://staging.kol.guangai.ai/api/health` 返回 `healthy`，DB/Redis `ok` |
| T2 | staging 部署 sha 与当前 `main` HEAD 一致 | FAIL | local/main=`1e5b2b7`；staging `/opt/kolmatrix-staging`=`fbd90013ff9632503a1a9db42f04ec87b9bbcc2c` |
| T3 | `/campaigns/[id]` 挂载 refine input | PASS | `textbox "Refine with AI: e.g., fewer micro creators, more female audience"` 可见 |
| T4 | `/match?campaignId=` 复用挂载 | PASS | `page 4` 上 `textbox "Refine with AI: ..."` 可见 |
| T5 | `zh` locale 文案挂载 | PASS | `textbox "用 AI 微调：例如减少 micro tier、多加女性受众"` 可见 |
| T6 | refine 成功/失败主路径 | FAIL | 两次真实提交后 UI 都出现 `Refine timed out. Please try again.` |
| T7 | refine 请求使用现有 top-30 池 | FAIL | network `reqid=61/62` 的 request body 仅含 5 个 `currentPoolIds` |
| T8 | 24h audit script 与真实 audit_log 一致 | FAIL | 脚本输出 `calls=0`；SQL 直查 24h `ai_recommendation.refine_unparsable=2` |

## L2 实测记录

| 项 | 证据 |
|---|---|
| Staging health | `{\"status\":\"healthy\",\"checks\":{\"database\":{\"status\":\"ok\"},\"redis\":{\"status\":\"ok\"}}}` |
| Staging git sha | SSH: `/opt/kolmatrix-staging` → `git rev-parse HEAD` = `fbd90013ff9632503a1a9db42f04ec87b9bbcc2c` |
| Campaign page mount | `/en/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045` 与 `/zh/...` 均能看到 refine input |
| Match page mount | `/en/match?campaignId=382f014c-a9f9-4fde-bcad-d5bb10ed2045` 能看到复用 input bar |
| Refine request #1 | query=`fewer micro creators, more female audience, prioritize English-speaking channels` |
| Refine request #1 response | network `reqid=61`：HTTP 200，server action 返回 `{ ok: true, data: { unparsable: true, capExhausted: false, errorKind: \"unparsable\" } }` |
| Refine request #1 UI result | 页面 toast 为 `Refine timed out. Please try again.`，未展示 server 返回的 unparsable feedback |
| Refine request payload shape | `reqid=61/62` 的 `currentPoolIds` 长度为 5，只包含当前可见卡片 |
| Audit script | staging SSH 运行 `npx tsx scripts/bl068-cost-audit.ts --hours=24` → `TOTAL calls: 0` |
| SQL truth | `SELECT action, COUNT(*) ... WHERE action LIKE 'ai_recommendation.refine_%' ...` → `ai_recommendation.refine_unparsable | 2` |

## 缺陷列表

### B1. Refine UI 5s timeout 覆盖了真实 server 返回，主链不可用

- 严重级别：High
- 复现步骤：
  1. 打开 `/en/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045`
  2. 输入 `fewer micro creators, more female audience, prioritize English-speaking channels`
  3. 点击 `Refine`
- 实际结果：
  - UI toast 显示 `Refine timed out. Please try again.`
  - 但 network `reqid=61` 返回 200，且 server action 已返回 `unparsable` 结果与 feedback
- 预期结果：
  - UI 应消费 server action 的真实返回，不应被 5s timeout fallback 吃掉
- 关联实现：
  - [RefineInputBar.tsx](/Users/yixingzhou/project/joyce/src/app/[locale]/(app)/campaigns/[id]/RefineInputBar.tsx:94)

### B2. Refine 只向后端发送可见 5 个 KOL，而不是 spec 要求的现有 top-30 池

- 严重级别：High
- 复现步骤：
  1. 打开 `/en/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045`
  2. 提交任意 refine query
  3. 查看 server action request body
- 实际结果：
  - `currentPoolIds` 只有当前 `visible` 5 个 id
  - server 返回的 unparsable feedback 也明确指出当前 pool 只有 5 个 KOL
- 预期结果：
  - 应发送完整现有 top-30 池，满足 BL-068 “重排现 top 30” 约束
- 关联实现：
  - [AiRecommendationPanel.tsx](/Users/yixingzhou/project/joyce/src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx:372)
  - [AiRecommendationPanel.tsx](/Users/yixingzhou/project/joyce/src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx:483)

### B3. `scripts/bl068-cost-audit.ts` 在 staging 上返回假阴性 `0 calls`

- 严重级别：Medium
- 复现步骤：
  1. staging 上触发 refine 两次
  2. SSH 运行 `npx tsx scripts/bl068-cost-audit.ts --hours=24`
  3. 再用 SQL 直接查 `audit_log`
- 实际结果：
  - 脚本输出 `TOTAL calls: 0`
  - SQL 直查 24h 有 `ai_recommendation.refine_unparsable | 2`
- 预期结果：
  - 脚本结果应与真实 audit_log 一致
- 关联实现：
  - [bl068-cost-audit.ts](/Users/yixingzhou/project/joyce/scripts/bl068-cost-audit.ts:83)

### B4. staging 验收环境未部署到当前 `main` HEAD

- 严重级别：Medium
- 实际结果：
  - local/main HEAD = `1e5b2b7`
  - staging deploy sha = `fbd90013ff9632503a1a9db42f04ec87b9bbcc2c`
- 预期结果：
  - F007 acceptance 要求 staging git sha 与当前候选 commit 一致

## 结论

- 本轮 `verifying` 结论：**FAIL**
- 不满足 signoff 条件，建议状态切换：`verifying -> fixing`
- 当前不应写入 `docs.signoff`

## 修复建议

1. 修 `RefineInputBar` 的 timeout 竞争逻辑，避免 5s fallback 覆盖刚返回的 server action 结果。
2. 改 `AiRecommendationPanel` / `MatchRefineBar`，向 `applyRefineAction` 传完整 top-30 池，而不是 `visible` 5 条。
3. 修 `scripts/bl068-cost-audit.ts` 的 Prisma 查询/过滤逻辑，确保与 SQL 直查一致。
4. 修复后重新部署 staging 到当前 `main` HEAD，再重跑 BL-068 L2。

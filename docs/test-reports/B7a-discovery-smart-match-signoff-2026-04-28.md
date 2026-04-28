# B7a-discovery-smart-match Signoff 2026-04-28

> 状态：**Evaluator 验收通过（reverifying）**
> 触发：fix-round 1 修复 Smart Match staging `503 embedding_failed` 后复验。

---

## 变更背景

B7a 目标是交付 Embedding 基础设施与 /discovery Smart Match 核心体验。首轮 verifying 发现 staging 登录态下 Smart Match 对多 product 系统性返回 503（`product vector unreadable after embed`）。本轮针对该阻断完成修复后执行复验。

---

## 变更功能清单

### F001：Embedding Pipeline + pgvector + KOL/Product Embed

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- L1：`npm run typecheck`、`npm run lint`、`npm run test:integration -- tests/integration/smart-match-api.test.ts`（6/6）通过。
- L2：`GET https://staging.kol.guangai.ai/api/health` 返回 healthy，`git_sha=948e3ef8cce0af9e6a214517ad2726a8a77b57ef`。
- 上轮失败样本（5 个 product）复测均 `POST /api/kols/smart-match` 返回 200，错误 `embedding_failed` 未再出现。

### F002：/discovery AI Smart Match 实装（embedding 版）

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- E2E（staging）：`tests/e2e/discovery-fidelity.spec.ts` 6/6 全通过（含 Smart Match 弹窗可打开）。
- 登录态手工脚本抽检：5 个 product 均返回 top-10 结果（`results=10`）。
- `Save All to Campaign` 可跳转到 `/en/campaigns/new?productId=...&smartMatchKolIds=...`。
- `/zh/discovery` Smart Match 弹窗可打开（zh 流程 smoke 通过）。

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| B7b/B8 功能 | 本批次仅验收 B7a F001/F002，不覆盖 B7b F003-F006 或 B8 F007-F008 |
| B6 day-5 接力条款 | 保持跨批次验证（~2026-05-03），不阻塞本批签收 |

---

## 类型检查 / CI

```bash
npm run typecheck                      # PASS
npm run lint                           # PASS
npm run test:integration -- tests/integration/smart-match-api.test.ts   # 6/6 PASS
E2E_BASE_URL=https://staging.kol.guangai.ai npx playwright test tests/e2e/discovery-fidelity.spec.ts --project=chromium --workers=1 --timeout=180000   # 6/6 PASS
```

---

## Stitch 还原度评估

- 原型参考：`design-draft/stitch-references/kol-discovery.html`
- 对比方法：staging 登录态 `/en/discovery` + `/zh/discovery` 交互复验（Smart Match CTA / dialog / search area / toggle / chips）
- 结论：🟢 本批次涉及的 Smart Match 交互元素与验收项一致。

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → fixing → reverifying → done）交付。
`progress.json` 已设为 `status: "done"`，`docs.signoff` 已填写本报告路径。

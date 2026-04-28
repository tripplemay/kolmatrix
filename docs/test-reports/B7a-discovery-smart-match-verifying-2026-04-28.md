# B7a-discovery-smart-match · Verifying Report (2026-04-28)

## Scope
- Sprint: `B7a-discovery-smart-match`
- Stage: `verifying`
- Evaluator: `Reviewer` (Codex)
- Environments:
  - L1 local (`localhost:3099` harness)
  - L2 staging (`https://staging.kol.guangai.ai`)

## L1 Results
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run test:unit -- tests/unit/smart-match-similarity.test.ts tests/unit/kol-sync-dispatcher.test.ts` ✅ (15/15)
- `npm run test:integration -- tests/integration/smart-match-api.test.ts` ✅ (5/5)

结论：L1 基础逻辑通过。

## L2 Results (Staging)

### 1) Health + Deployment
- `GET https://staging.kol.guangai.ai/api/health` => `healthy`
- `git_sha=218bf8078c966318f3a2c51da1035f320d5a7597`

### 2) Discovery UI smoke
- Playwright: `tests/e2e/discovery-fidelity.spec.ts` against staging
- Result: `6 passed`
- 包含：`AI Smart Match CTA opens the SmartMatchDialog` 通过（弹窗可打开）

### 3) Smart Match runtime check (authenticated)
通过登录态实测 `/en/discovery` Smart Match 运行链路（选 product -> Run）：

- 复现 1（单样本）：
  - API response: `503`
  - body: `{"error":"embedding_failed","detail":"product vector unreadable after embed (id=cmoghhvrd0000qrbn5xrcz0ou)"}`
  - UI error: `Our embedding service is temporarily unavailable. Please try again in a moment.`

- 复现 2（多样本抽检，前 5 个 product）：
  - 5/5 均返回 `503 embedding_failed`
  - 示例 product：
    - `E2E Game 1777251227667 · MOBA` -> 503
    - `E2E Game 1777247746660 · MOBA` -> 503
    - `E2E Game 1777211919737 · MOBA` -> 503

## Feature Verdict
- F001: **FAIL**（L2 下 Product embedding 读写链路异常，导致 `product vector unreadable after embed`）
- F002: **FAIL**（Smart Match 无法返回 top-10 结果，核心验收项不成立）

## Overall Verdict
- `verifying`: **FAIL**
- 状态建议：切换到 `fixing`，由 Generator 修复后进入 `reverifying`。

## Recommended Fix Direction
1. 排查 Product embedding 写入格式与读取解码路径（vector 维度/序列化/SQL cast）是否一致。
2. 在 staging DB 针对失败 product id 直接验证 `embedding` 列写入后可读性。
3. 为 `product embed -> readback` 增加集成测试，覆盖真实 Prisma/SQL 读回路径。
4. 修复后重跑：L1 + staging authenticated Smart Match（含 Save All 跳转）。

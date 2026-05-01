# MVP Internal Demo Prep - Prod L2 Signoff

> 状态：**PASS**
> 触发：`progress.json` 处于 `reverifying`，Reviewer 对 `MVP-internal-demo-prep` 执行最终 prod L2 签收。

## 测试范围

- prod 健康检查与路由基线
- `C-10` Outreach AI customize + send
- `C-13` Weekly Report download event
- `F-01` coverage
- `F-02` CI
- `F-03` Playwright E2E smoke

## 使用的源文档

- `docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`
- `docs/specs/MVP-internal-demo-prep-spec.md`
- `progress.json`
- `.auto-memory/project-status.md`

## 覆盖摘要

- prod health / login / protected route smoke：PASS
- `C-10` Outreach AI customize + send：PASS
- `C-13` Weekly Report download event：PASS
- `F-01` coverage：PASS
- `F-02` CI：PASS
- `F-03` Playwright E2E smoke：PASS

## 关键证据

- `git rev-parse --short HEAD` = `a541f8e`
- `git show --stat --oneline a541f8e` 仅包含：
  - `.auto-memory/project-status.md`
  - `progress.json`
- prod `/api/health` 返回 `status=healthy`
- prod `/api/health` 返回 `git_sha=6f33a55`
- `gh run list --branch main --limit 3` 最新两条部署流水均为 success，且 head SHA 为 `6f33a55`

## 执行结果

### Health / Route PASS

- `curl https://kol.guangai.ai/api/health`
  - HTTP 200
  - `status = healthy`
  - `git_sha = 6f33a55`
  - `checks.database.status = ok`
  - `checks.redis.status = not_used`
- `GET /en/login`
  - HTTP 200
- `GET /en/dashboard`
  - unauthenticated 时 307 → `/en/login`
- `GET /en/discovery`, `/en/database`, `/en/knowledge-base`, `/en/campaigns`, `/en/outreach`, `/en/crm`, `/en/roi`, `/en/weekly-report`
  - unauthenticated 时均 307 → `/en/login`

### C-10 PASS

- 登录：`marketer@kolmatrix.local / KOLM@2026!`
- 目标 campaign：`PUBG Mobile — Season 30 · PUBG Mobile (3 KOL)`
- 目标 template：`Initial Outreach (en)`
- 选中 KOL row 后，AI customize 返回可编辑预览：
  - subject 非空
  - body 非空
- 点击 `Accept AI` 后，发送结果为：
  - `1 sent`
  - `0 mocked`
  - `0 failed`
- 这条链路证明 `original_subject` / `original_body` 的 gateway contract 已修正，并且 prod 端到端已恢复

### C-13 PASS

- `/en/weekly-report` 已渲染 report preview
- `Download PDF` 点击后触发 `kolmatrix:weekly-report-download`
- 页面标题在下载动作后更新为 `WeeklyReport_Demo_Studio_20260427`
- `Share` / `Regenerate` 保持可用

### F-01 PASS

- `npm run test:coverage`
  - `97` test files
  - `625` tests passed
  - coverage:
    - statements `81.69%`
    - branches `73.66%`
    - functions `81.49%`
    - lines `83.22%`

### F-02 PASS

- `gh run list --branch main --limit 3`
  - latest production deploy workflow success
  - latest staging deploy workflow success
  - latest test workflow success

### F-03 PASS

- `env E2E_BASE_URL=https://kol.guangai.ai npx playwright test tests/e2e/journey-a.spec.ts tests/e2e/journey-b.spec.ts --project=chromium --workers=1 --timeout=180000`
  - `journey-a` PASS
  - `journey-b` PASS

## 结论

- 本轮 `reverifying` 结论：**PASS**
- 生产 runtime 已满足 `MVP-internal-demo-prep` 的 demo smoke 要求
- `a541f8e` 为状态机 / project-status 维护提交，不改变 prod runtime；当前 prod runtime SHA 仍是 `6f33a55`
- `progress.json.docs.signoff` 已写入本报告路径

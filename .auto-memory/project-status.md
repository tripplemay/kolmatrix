---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=reverifying（fix_rounds=2，2026-04-23 Generator johnsong 修复完成，CI 全绿）
  - round-1 盲点：只改 .env.example 模板，但 codex-setup.sh `if [ ! -f .env ]` 让 Evaluator 机器陈旧 .env 保留 NEXTAUTH_URL=localhost:3000
  - round-2 三层防护（commits cb39033 + a792dcc）：
    - `scripts/test/codex-setup.sh` +sanitize 已有 .env（grep + sed `@` 分隔符）+ exec 前 unset NEXTAUTH_URL/AUTH_URL
    - `scripts/test/codex-e2e.sh` (NEW) Playwright 包装：封装 E2E_PORT=3099、清 auth env + proxy
    - `tests/integration/env-hygiene.test.ts` (NEW) 11 断言守住配置不反弹
  - F001/F003 已 PASS；F002/F004 待 Evaluator 用新 `bash scripts/test/codex-e2e.sh` 复验

## 角色分配（BAux1）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- BAux1 签收后进入 B1 KOL Database

## 已完成批次
- BI3-domain-and-tls ✅
- BI2-deployment-automation ✅
- BI1-test-infrastructure ✅
- B0-foundation ✅

## 环境提醒
- 生产 DB：`kolmatrix`
- staging DB：`kolmatrix_staging`
- Evaluator 首次 pull 后必须跑 `scripts/test/codex-setup.sh`（2026-04-22 起含 npm ci；2026-04-23 起含 .env sanitize）
- Evaluator 跑 E2E 改用 `bash scripts/test/codex-e2e.sh`（不要裸 `npm run test:e2e`）

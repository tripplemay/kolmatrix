---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=reverifying（fix_rounds=3，2026-04-23 Generator johnsong F004 visual baseline 补齐，CI 全绿）
  - F001/F002/F003 已 PASS；F004 round3 修复点：
    - `tests/e2e/visual-regression.spec.ts` +Auth cinematic describe（2 tests 覆盖 /en/login 与 /en/request-access）
    - `tests/screenshots/baseline/en-login.png` (1280×720) + `en-request-access.png` (1280×826) 入库
    - 沿用 F009 机制：Linux-only skip / threshold 0.02 / maxDiffPixels 2000
  - CI run 24813973320（commit 6654f5e）：8 jobs 全绿，含 E2E（17 passed, 1 skipped）

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
- Visual baseline 由 Linux chromium 生成，CI/WSL/Codex 三平台共享

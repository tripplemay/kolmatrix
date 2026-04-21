---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=reverifying（fix_rounds=1，2026-04-22 Generator johnsong 修复完成）
  - 4 个 FAIL 全定位为环境/配置根因（非产品代码 bug），已修 5 个文件：
    - `scripts/test/codex-setup.sh` +npm ci → 同步 deps + regenerate @prisma/client（修 F001+F003）
    - `.env.example` 注释 NEXTAUTH_URL → 避免 next-auth reqWithEnvURL 改写 origin（修 F002 前半）
    - `playwright.config.ts` 读 env 动态端口 + reuseExistingServer:true（修 F002 后半）
    - `RequestAccessForm.test.tsx` 扁平 mock 去 importActual（修 F004 单测链）
    - `login-cinematic.spec.ts` 加 /login 同源 redirect 回归 E2E
  - 本机 tsc+lint+unit 99/99 全绿；integration+e2e 留 Evaluator 在 Codex Linux 跑

## 角色分配（BAux1）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- BAux1 reverifying 通过并签收后进入 B1 KOL Database

## 已完成批次
- BI3-domain-and-tls ✅
- BI2-deployment-automation ✅
- BI1-test-infrastructure ✅
- B0-foundation ✅

## 环境提醒
- 生产 DB：`kolmatrix`
- staging DB：`kolmatrix_staging`
- Evaluator 首次 pull 后必须跑 `scripts/test/codex-setup.sh`（2026-04-22 起含 npm ci）

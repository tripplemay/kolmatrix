# BIx-staging-automation Spec

## 1. Background
当前 staging 部署依赖手工 SSH 命令，存在三类摩擦：
1. 部署步骤重复且易漏（git pull / npm ci / build / migrate / reload / health 校验）。
2. `/api/health` 的 `git_sha` 在 staging 历史上出现过 `unknown`，影响验收可追踪性。
3. 部分脚本独立执行依赖手工 `source .env`，可移植性差。

本批次目标是做一次“低风险基础设施收口”，降低后续所有功能批次的部署和验收成本。

## 2. Scope
### In Scope
- F001: 新增 staging 一键部署脚本 `infrastructure/deploy-staging.sh`。
- F002: 修复 staging `/api/health` 的 `git_sha` 反射稳定性。
- F003: 统一关键 `scripts/*.ts` 的 dotenv 自动加载策略。

### Out of Scope
- 生产环境部署流程改造（仍由用户手动触发）。
- GitHub Actions 新增 staging 自动部署 workflow。
- 大规模脚本框架重构（仅修复“独立可运行”最小闭环）。

## 3. Features

## F001 — Staging 一键部署脚本
### Implementation
- 新增 `infrastructure/deploy-staging.sh`，覆盖以下步骤：
1. `git pull --ff-only origin main`
2. `npm ci --include=dev`
3. `npx prisma migrate deploy`
4. build（注入/生成 git sha 所需信息）
5. `pm2 reload`（staging app）
6. `curl /api/health` 并输出结构化结果
- 脚本要求：`set -euo pipefail`、关键步骤日志、失败即停、可重复执行。

### Acceptance
- 在 staging 机器连续执行两次脚本均成功。
- 第二次执行不产生破坏性副作用（幂等）。
- health 检查输出可直接用于验收记录。

## F002 — 修复 health git_sha 反射
### Implementation
- 检查 `src/app/api/health/route.ts` 与部署链路，定位 `git_sha=unknown` 根因。
- 修复策略要求“运行时可稳定获取当前部署 sha”，不依赖脆弱的临时 shell 前缀注入。
- 补最小回归验证（脚本断言或测试）确保 `git_sha` 非 unknown。

### Acceptance
- staging 重新部署后：`/api/health.git_sha` 与当前代码 HEAD 一致。
- 不出现 `unknown`。

## F003 — scripts dotenv 自动加载统一
### Implementation
- 对关键会被独立执行的 TS 脚本补齐 `import "dotenv/config";`。
- 优先覆盖已知问题脚本和当前常用运维脚本（含 BL-001 指向脚本）。
- 保持行为兼容，不改业务逻辑。

### Acceptance
- 目标脚本在不手工 `source .env` 情况下可运行到核心逻辑（或通过参数校验阶段）。
- 新增最小验证（unit/smoke 任一）证明修复有效。

## 4. Validation Plan
- L1:
1. `npm run lint`
2. `npx tsc --noEmit`
3. 新增/调整的测试或 smoke 验证
- L2 (staging):
1. 执行 `infrastructure/deploy-staging.sh`
2. 校验 `/api/health`：`status=healthy` 且 `git_sha` 匹配当前 HEAD
3. 抽查 1 个依赖 env 的脚本独立执行行为

## 5. Risks & Mitigations
- 风险：脚本中环境路径/pm2 app 名硬编码导致跨机不可用。
- 缓解：使用明确变量和前置检查（目录、命令存在性、env 文件存在性）。

- 风险：health sha 修复方式与现有部署链路冲突。
- 缓解：先确认 health handler 的读取来源，再定最小改动方案。

## 6. Exit Criteria
- F001/F002/F003 全部 completed。
- staging deploy + health sha 验证通过。
- 相关报告/记录可支持 Evaluator 验收。

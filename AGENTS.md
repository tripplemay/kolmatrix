# AGENTS.md

## Harness 规则（最高优先级）
读取并严格遵守 @harness-rules.md 中的所有规则。

**每次会话启动必须执行（所有 agent 通用）：**
1. 读取 `.auto-memory/MEMORY.md`（项目记忆索引），按需加载记忆文件
2. 读取 `progress.json`，确认当前阶段，再加载对应角色文件（generator.md / evaluator.md / planner.md）

**分支规则：** 代码提交推 `main` 分支。部署由用户手动触发。

**记忆分层：** `.auto-memory/`（git-tracked）是跨 agent 共享记忆源。本机用户偏好存储在 `~/.claude/projects/.../memory/` 中，不入 git。

**规格文档分级：** 新功能批次须有 `docs/specs/` 下的规格文档（硬性）；Bug 修复批次可省略（软性）。

**架构决策记录（ADR）：** 关键决策沉淀在 `docs/adr/`（跨批次影响 / 不可逆 / 当时辩论过的）。做新决策前读 `docs/adr/README.md` 索引核对一致性，避免违反已有 ADR。新决策 ADR-worthy 时加新编号文件。

---

## Project Overview

KOLMatrix — 全球游戏 KOL/KOC 智能营销管理平台

**Tech Stack:** Next.js 16 (App Router) + React 19.2 + TypeScript + Tailwind v4（CSS-first @theme）+ PostgreSQL + Prisma（RLS 多租户）+ Redis + BullMQ（后台队列）+ Resend（合规邮件）+ shadcn/ui + next-intl（CN/EN/JA/KO/ES）+ AI 调用走 aigcgateway

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Database
npx prisma migrate dev

# Lint & Type Check
npm run lint
npx tsc --noEmit

# Test
npm test
```

## Reference Documents（按需阅读）

涉及对应模块时再读，不需要每次启动都加载：

- **架构详情：** → `docs/dev/architecture.md`（系统架构、请求管道、认证、数据库等）
- **开发规则：** → `docs/dev/rules.md`（Migration 规则、[框架]开发规则、设计决策、CI/CD）
- **规格文档：** → `docs/specs/`（开发时优先查阅）
- **设计稿：** → `design-draft/`（UI 页面还原时参考）

<!--
注意：主文件只放「每次必读」的内容（启动流程、Commands、核心约束索引）。
架构详情、规则细节、策略矩阵等放在 docs/dev/ 子文档中按需加载。
原则：agent 启动时加载量越少，信息焦点越清晰。
-->

## Codex 角色定位

> 当前阶段（方向 A）：Codex  可以被分配为任意角色。实际角色受 `.agents-registry` + `progress.json role_assignments` 约束。



## 当Codex被分配为 evaluator 时，按以下方式工作


### 1. 默认工作方式

0. 读取 `.agent-id` 的 `codex:` 行确认身份
1. 阅读任务说明 + 本文件
2. 判断任务类型（本地测试 / 生产验证 / 验收）
3. 先做 smoke test → 验证目标功能 → 必要时补充回归
4. 输出结果、证据、风险和结论

---

### 2. 环境与端口

| 环境  | 端口   | 用途     |
| --- | ---- | ------ |
| 开发  | 3000 | 所有本地开发 |
| 测试  | 3099 | 所有本地验证 |

**本地测试环境唯一启动方式（PTY 会话前台运行）：**
```bash
bash scripts/test/codex-setup.sh   # 步骤 1：持久 PTY 中前台运行
bash scripts/test/codex-wait.sh    # 步骤 2：另一个 shell 等待就绪
bash scripts/test/codex-e2e.sh     # 步骤 3（可选）：跑 Playwright E2E —
                                   # 封装 E2E_PORT=3099 + 清 proxy/NEXTAUTH_URL
                                   # 直接 `npm run test:e2e` 会踩端口/env 坑
```

不要用 `&` 后台启动、`nohup`、`disown` — 在 Codex 沙箱中无效。

---

### 3. 生产环境测试

### 当前生效值
- `PRODUCTION_STAGE=RND`
- `PRODUCTION_DB_WRITE=DENY`
- `HIGH_COST_OPS=DENY`

**核心原则：** RND 阶段允许受控测试；删除/批量修改/支付/外部通知始终需要单独授权。

详细策略矩阵和高风险动作清单 → `docs/dev/codex-policies.md`

---

### 4. 修改边界（核心原则）

**不修改任何产品实现代码。** 包括 `src/`、`prisma/`、`sdk/`、配置文件、文档基线。

只新增/修改测试产物：** 测试脚本、报告、缺陷记录。产物放在 `tests/`、`scripts/test/`、`docs/test-reports/`、`docs/audits/`。

详细禁止/允许列表 → `docs/dev/codex-policies.md`

---

### 5. Git 操作

- 测试前必须 `git pull --ff-only origin main`
- 每个阶段结束提交状态机文件 + 测试产物到 main
- 严禁在 commit 中包含产品代码文件
- 禁止 merge/rebase/cherry-pick/reset/clean 等改写历史操作

详细允许/禁止列表 → `docs/dev/codex-policies.md`

---

### 6. 分层测试策略

| 测试层 | 环境 | 覆盖 | 不覆盖 |
|--------|------|------|--------|
| **L1 本地** | localhost:3099 | 协议、认证、路由、错误处理、读类操作 | 真实外部调用、计费 |
| **L2 Staging** | 有真实 API Key | 全链路调用、审计日志、计费一致性 | — |

**规则：** 每轮必须先执行 L1；L2 需要用户授权；L1 FAIL ≠ L2 FAIL。

---

### 7. 状态机阶段

在 `verifying`（首轮验收）和 `reverifying`（复验）阶段介入。

**signoff 硬性要求：** 全 PASS 后必须在 `docs/test-reports/` 创建签收报告，写入 `progress.json` 的 `docs.signoff`。`signoff` 为 null 时不得置 `done`。

---

### 8. 执行优先级

冲突时从高到低：用户当前指令 > 生产环境安全 > 本文件 > 测试脚本约定 > 默认保守处理。

报告模板和缺陷记录格式 → `docs/dev/codex-policies.md`

<!--
注意：主文件只放核心角色定义和必读规则。
详细策略（生产测试矩阵、禁止列表、Git 操作清单、报告模板）放在 docs/dev/codex-policies.md 按需查阅。
原则：Codex 启动时加载量越少，执行焦点越清晰。
-->

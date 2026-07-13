# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Harness 规则（最高优先级）
读取并严格遵守 @harness-rules.md 中的所有规则。

**每次会话启动必须执行：**
1. SessionStart hook 会自动注入当前状态机 status（`.claude/hooks/session-start.sh`）；据此进入对应角色入口
2. 读取 `.auto-memory/MEMORY.md`（项目记忆索引），按 T0/T1/T2 分层加载记忆
3. 阶段角色入口：`/plan`（new / planning / done）、`/build`（building / fixing）、`/verify`（verifying / reverifying，编排隔离 evaluator subagent）

**独立性铁则：** 验收必须在隔离上下文中进行（`.claude/agents/evaluator.md`），结论原样落盘。任何人不得评估自己的工作。

**分支规则：** 代码提交推 `main` 分支（触发 CI）。部署由用户手动触发。（若迁移后 push main 已改为自动部署，则改走 branch → PR，勿自动 push main。）

**自主模式（/autodrive）：** 机件已装但默认不开启；开启需人类建 `autonomy-policy.json` 并手动合入 deny-list，deploy/prod/spend 永留人类闸门。

**进度看板：** 阶段边界可 `/dashboard` 刷新图形化看板（Artifact 快照，URL 存 `progress.json.dashboard_url`）。

**记忆分层：** `.auto-memory/`（git-tracked）是跨会话共享记忆源。本机用户偏好存储在 `~/.claude/` 中，不入 git。

**规格文档分级：** 新功能批次须有 `docs/specs/` 下的规格文档（硬性）；Bug 修复批次可省略（软性）。

**架构决策记录（ADR）：** 关键决策沉淀在 `docs/adr/`（跨批次影响 / 不可逆 / 当时辩论过的）。做新决策前读 `docs/adr/README.md` 索引核对一致性，避免违反已有 ADR。新决策 ADR-worthy 时加新编号文件。

**编排：** 并行实现 / fan-out 验收 / 后台 CI / /loop 见 `orchestration-patterns.md`。

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

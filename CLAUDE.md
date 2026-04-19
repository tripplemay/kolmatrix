# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

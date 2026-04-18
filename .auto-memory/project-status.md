---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B0-foundation（建立 Next.js 工程地基）** — Planner 完成，status=building
- 9 个 features（全 executor:generator）已写入 `features.json`
- 等待 johnsong 拉取 main 后接手 building 阶段

## 角色分配（B0）
- Planner: Kimi（已完成）
- Generator: johnsong（待启动 building）
- Evaluator: Reviewer（building 完成后接手 verifying）

## 关键决策（B0 spec 已定）
- 包管理 npm / 认证 NextAuth v5 / 服务端数据 TanStack Query / 表单 react-hook-form+zod / 图表 recharts / 多租户 共享 DB + RLS
- 视觉基调 Neural Velocity（design-draft/design-system.md）+ canonical App Shell
- 数据库 7 核心表（design 见 docs/specs/B0-database-schema.md），首批 seed 用 Stitch mock 数据

## 引用文档
- `docs/specs/B0-foundation-spec.md` 主 spec / `docs/dev/architecture.md` 架构 / `docs/specs/B0-database-schema.md` schema / `docs/specs/B0-app-shell-component.md` 组件

## 后续批次（占位）
- B1: KOL Database 列表 + Campaigns 列表 + Sentry 监控
- B2: BullMQ workers + KOL crawler + AI 评分
- B3: Resend 邮件系统 + DNS

## 已知 gap（非阻塞）
- Stitch Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需用户手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

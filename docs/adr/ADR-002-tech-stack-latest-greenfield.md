# ADR-002: Tech Stack Latest Greenfield

## Status

**Accepted**

- 日期：2026-04-19
- 作者：Kimi（Planner） + johnsong（Generator 发现触发）
- 相关批次：B0-foundation（F001-F010 全部）

## Context

B0-foundation 初版 spec（`docs/specs/B0-foundation-spec.md` v1）基于 CLAUDE.md 写定：
- Next.js 15（App Router）
- Tailwind v3.4 LTS
- React 18

但 B0 启动后 johnsong 发现 2026-04 实际：
- `npx create-next-app@latest` 默认装 Next.js 16.2.4 + React 19.2
- shadcn/ui 已原生支持 Tailwind v4（CSS-first `@theme` 配置）
- Prisma 7 已发布（schema datasource url 移到 prisma.config.ts）

按 `pre-impl-adjudication` 流程，johnsong 提交规格偏差报告，列出 3 个选项：
- **A** 严守 spec：锁 Next 15 + Tailwind 3.4
- **B** 跟进最新：用当前 Next 16 + Tailwind 4 脚手架，回头改 spec
- **C** 折中：Next 15 保 SSR 稳定 + Tailwind 4

关键问题：**greenfield 零代码时是锁稳定版还是用最新生态**？

## Decision

**采用 Option B：跟进 2026-04 最新生态。**

版本基线：
- **Next.js 16**（App Router + RSC + Server Actions）
- **React 19.2**（Actions / useOptimistic / native form actions）
- **TypeScript 5+**（strict mode）
- **Tailwind v4**（CSS-first config via `@theme` in `globals.css`，不再用 `tailwind.config.ts`）
- **shadcn/ui 最新**（自动检测 Tailwind v4 并适配）
- **Prisma 7**（schema datasource 只留 provider，url 在 `prisma.config.ts`）
- **NextAuth v5 (beta.31+)**（Auth.js）

同步更新：
- `docs/specs/B0-foundation-spec.md` §1 / §3 / F001 / F002 / §6 风险 / §7 验收
- `CLAUDE.md` Tech Stack 头
- `docs/dev/architecture.md` §15 技术栈表

## Consequences

### 正面

- **零历史包袱：** greenfield 新项目没有 migration 成本
- **避免强制升级：** 锁旧版半年后被迫升，投入反而更高
- **React 19 生产力：** Server Actions 原生、useOptimistic 简化交互、form actions 减少样板代码
- **Tailwind v4 性能：** 编译更快、CSS-first config 更简洁
- **社区资源：** 新项目文档 / tutorials / AI 工具（如 v0 / Stitch）都假设最新版

### 负面

- **Tailwind v4 CSS-first 学习曲线：** 团队熟悉 v3 JS config，需学 `@theme` 块语法
- **Beta 风险：** NextAuth v5 仍是 beta（虽接近稳定），可能遇到 API 调整
- **文档滞后：** 部分第三方库的文档还停留在旧版
- **Prisma 7 迁移细节：** `datasource.url` 移到 config 文件，遇坑点需修复（B0 实际已踩过 driverAdapters 默认启用 + config 路径）

### 中性

- 代码严格执行 B0 F002 HEX 硬编码扫描（除 `globals.css` 零命中）
- Tailwind v4 不用 `tailwind.config.ts`，全部 token 在 `globals.css` `@theme` 块

## Alternatives Considered

### 方案 A（锁旧版，已拒绝）

保持 Next 15 + Tailwind 3.4 + React 18。

- **拒绝理由 1：** CLAUDE.md 写"Next.js 15"不是深思决策，是 bootstrap 时默认
- **拒绝理由 2：** johnsong 的 "shadcn v3 适配最稳" 假设已过时（2026-04 shadcn 原生支持 v4）
- **拒绝理由 3：** 违反 Planner 铁律 P5（裁决理由需具备复用价值）——"因为 CLAUDE.md 这么写"不是好理由

### 方案 C（折中，已拒绝）

Next 15（SSR 稳定）+ Tailwind 4（shadcn v4 已稳）。

- **拒绝理由 1：** 人为拆版本组合，维护复杂度增加
- **拒绝理由 2：** Next 16 SSR 稳定性已过测（主要变更是 middleware → proxy，不影响 SSR 路径）
- **拒绝理由 3：** greenfield 无理由混搭

## References

- **Commits：** `6951ef9`（B0 spec v3 升级）
- **触发 commit：** F001 脚手架阶段 johnsong 发现偏差
- **Specs：** `docs/specs/B0-foundation-spec.md` §3 关键设计决策
- **相关 ADR：** ADR-001（Option α 提供充足时间做升级）
- **外部：** [Next.js 16 release notes](https://nextjs.org/blog/next-16) / [Tailwind v4 docs](https://tailwindcss.com/docs/v4-beta)

## Notes

### 已知未来动作

- Next 16 已弃用 `middleware.ts`，建议迁 `proxy.ts` —— 留给后续批次处理（约 B2 左右）
- NextAuth v5 正式版（stable）发布后锁版本
- Prisma 7 driverAdapters 默认启用，未来升级 8 时注意 breaking changes

### 重新评估触发条件

- Next 16 或 Tailwind v4 发生 breaking change 影响现有代码
- NextAuth v5 beta 不稳定阻塞开发
- 用户明确要求降级（不太可能）

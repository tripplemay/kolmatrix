---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B0-foundation** — johnsong 实施中；F001-F004 完成 + E2E 验证；下一个 F005（App Shell 像素级还原）
- **V3 设计稿** — 已完成（7 张 P0 页面 Stitch HTML + 截图全就绪）

## 强制顺序（剩余）
- 下一个: **F005** → F010 → F007 → F006 → F008 → F009

## 本机环境（johnsong）
- `docker compose up -d` 跑 PG 5433 / Redis 6380（5432 被 nextpanel 占用；`docker-compose.override.yml` gitignored 做端口重映）
- `.env` 双 URL：`DATABASE_URL`（kolmatrix_app app 角色，RLS 生效）+ `DATABASE_ADMIN_URL`（kolmatrix superuser，给 migrations/seed）
- 登录：marketer@kolmatrix.local / KOLM@2026! → /dashboard 渲染 KOL count=12

## 角色分配（B0）
- Planner: Kimi（已完成）/ Generator: johnsong（实施中）/ Evaluator: Reviewer（待命）

## 关键决策
- 视觉基调 = Neural Velocity；canonical App Shell 写入设计系统 designMd
- 视觉验收 = 像素级还原（间距 ±2px / ΔE<2 / 字号 100%）
- F010 公共组件库 12 个 + Dashboard 强制复用，page.tsx ≤80 行
- 任何硬编码 HEX 验收 fail（除 globals.css）
- 技术栈 Next 16 + Tailwind 4 + React 19 + Prisma 7 + NextAuth v5
- Prisma 7: schema datasource 只留 provider；URL 在 prisma.config.ts（env<Env>('...')）
- 硬编码 HEX 扫描："'#[0-9a-fA-F]{6}'" 在 globals.css 之外 = 0

## 后续批次（待启动）
- V4/V5 设计稿补完；B1+ 业务批次在 B0 done 后启动

## 已知 gap（非阻塞）
- Next 16 `middleware.ts` 已弃用（应迁 `proxy.ts`），留给未来批次
- Stitch Variant B/C 项目需手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

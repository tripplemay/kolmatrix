---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI1-test-infrastructure** — planning 完成，status=building，等 johnsong 接手
- **B0-foundation** ✅ 已完成签收（10/10 + 12 PASS 0 FAIL，Round 3 reverify 通过）

## 角色分配（BI1，沿用 B0）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## BI1 10 features 执行顺序（强制）
F001 Vitest → F002 Testcontainers → F003 Playwright → F004 MSW → F005 Fixtures →
F006 B0 unit tests → F007 B0 RLS+Auth integration → F008 marketer E2E →
F009 视觉回归基线 → F010 CI 4 新 jobs

## 关键决策沉淀（B0 遗产，BI1 沿用）
- pre-impl 审计 → Planner 裁决模式（F005/F010/F007/F006 共 25 决策点 0 返工）
- 像素级还原标准 间距 ±2px / ΔE<2 / 字号 100%（BI1 F009 视觉回归基线）
- 色彩 token 边界政策（设计 token + Tailwind 预设色双轨）
- HEX 硬编码扫描铁律（除 globals.css）
- 技术栈 Next 16 + React 19 + Tailwind v4 + Prisma 7 + NextAuth v5

## 后续顺序（已锁定 Option α）
BI1 → BI2 部署自动化 → BI3 域名 TLS + Staging → B1 KOL Database → B2+

## 设计稿状态（7 张 P0 就绪）
Dashboard / KOL Discovery / KOL Detail / Campaigns 列表 / Campaign 详情 / KOL Database / Email Center
design-draft/stitch-references/ HTML + PNG 全部入库

## 已知 gap（非阻塞）
- Next 16 middleware.ts → proxy.ts 迁移留给后续批次
- ja/ko/es messages 未翻译待译员
- Stitch Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

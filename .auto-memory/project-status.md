---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B0-foundation** — Planner v2 完成，status=building，10 个 features（含新增 F010 公共组件库）
- 等待 johnsong 拉取 main 后接手 building 阶段

## 角色分配（B0）
- Planner: Kimi（已完成）/ Generator: johnsong / Evaluator: Reviewer

## 关键决策（B0 spec v2）
- 视觉验收 = **像素级还原**（间距 ±2px / 颜色 ΔE<2 / 字号 100%），基准 `design-draft/stitch-references/dashboard.png`
- F010 公共组件库（12 个）必须先抽好，Dashboard 强制复用，page.tsx ≤80 行
- 任何硬编码 HEX 验收直接 fail（除 globals.css / tailwind.config.ts）
- 强制执行顺序: F001→F002→F003→F004→F005→**F010→F007**→F006→F008→F009

## Stitch 设计稿
- Dashboard `8b4aa02a` / KOL Discovery `a1771401` / KOL Detail `31db0441`
- HTML + 截图已入库 `design-draft/stitch-references/`

## 后续批次（占位）
- B1: KOL Database 列表 + Campaigns 列表 + Sentry
- B2: BullMQ workers + KOL crawler + AI 评分
- B3: Resend 邮件系统 + DNS

## 已知 gap（非阻塞）
- Stitch Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B0-foundation** — johnsong 实施中（v3 spec, Next 16 + Tailwind 4 + React 19）
- **V3 设计稿** — 已完成（7 张 P0 页面 Stitch 设计稿全就绪）

## P0 页面设计稿清单（design-draft/stitch-references/）
- Dashboard / KOL Discovery / KOL Detail / Campaigns 列表 / Campaign 详情 / KOL Database / Email Center
- 全部用 canonical App Shell，HTML + 截图入库

## 角色分配（B0）
- Planner: Kimi（已完成）/ Generator: johnsong（实施中）/ Evaluator: Reviewer（待命）

## 关键决策
- 视觉基调 = Neural Velocity；canonical App Shell 写入设计系统 designMd
- 视觉验收 = 像素级还原（间距 ±2px / ΔE<2 / 字号 100%）
- F010 公共组件库 12 个 + Dashboard 强制复用，page.tsx ≤80 行
- 任何硬编码 HEX 验收 fail（除 globals.css）
- 强制顺序: F001→F002→F003→F004→F005→F010→F007→F006→F008→F009
- 自动生成 Stitch 会压缩内容（V3 改手动生成解决）

## 后续批次（待启动）
- V4 设计稿：产品知识库 + 客户协同筛选 + Email Tracking 详情
- V5 设计稿：登录/注册/设置/团队管理
- B1 业务批次：在 B0 完成后启动（KOL Discovery/Detail/Campaigns/KOL Database 业务实现）

## 已知 gap（非阻塞）
- Stitch Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

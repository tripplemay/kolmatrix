---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **批次 V1（基调）+ V2（KOL 发现/详情）** — ✅ 完成，已统一 canonical App Shell
- 屏幕 ID（最新）：Dashboard `8b4aa02a` / Discovery `a1771401` / Detail `b06528d2`
- Stitch 项目 `9338165817879839093` —— 旧 3 张已隐藏，新 3 张为基准

## 关键决策
- 视觉基调 = Neural Velocity（深色 navy + 电流青 + 玻璃拟态）
- Canonical App Shell（sidebar 8 项 + topbar 三段式）已写入设计系统 `designMd`，后续生成自动遵循
- 视觉规范完整文档：`design-draft/design-system.md`（§9 含 App Shell）+ `docs/specs/visual-baseline.md`

## 下一步计划（批次 V3 · 待用户确认）
- Campaign 详情页 + 邮件触达中心
- V4：产品知识库 + 客户协同筛选 + 登录/注册/设置
- 后续生成新页面时，prompt 顶部需注明"Apply canonical App Shell from designMd"

## 已知 gap（非阻塞）
- `edit_screens` 实际行为是"生成新 screen 而非编辑原有"——后续做 shell 对齐时需预期
- Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需 Stitch 网页端手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->

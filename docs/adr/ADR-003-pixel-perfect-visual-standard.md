# ADR-003: Pixel-Perfect Visual Standard

## Status

**Accepted**

- 日期：2026-04-18
- 作者：用户直接决策 + Kimi 落地
- 相关批次：B0-foundation（F005 App Shell / F007 Dashboard）, 影响所有 UI 批次

## Context

B0 初版 spec 视觉验收用词宽松：
- "视觉对照 Stitch 设计稿 8b4aa02a 接近"
- "≤10% 视觉差异可接受"

这是 Planner 留的保守安全垫，避免要求过严导致批次难收尾。

用户在 pre-impl 审计阶段明确反馈：
1. 希望公共组件抽取（不在每页单独手写）
2. 希望**代码级还原**（不接受 ≤10% 差异）

关键问题：**视觉验收的具体标准**。

## Decision

**采用像素级还原标准：**

| 维度 | 标准 |
|---|---|
| 间距 | ±2px 以内 |
| 颜色 | ΔE < 2（CIE76 色差模型） |
| 字号 | 100% 匹配 |
| 布局结构 | 100% 对齐（flex/grid/元素顺序/定位） |
| 圆角 / 阴影 / 渐变 | 与设计稿一致 |

**验收手段：**
- BI1 前：手工 Photoshop / pixelmatch CLI / Kaleidoscope 并排 diff（B0 §7 L2）
- BI1 后：Playwright `toHaveScreenshot(threshold: 0.02, maxDiffPixels: 1000)`

**验收基准：** `design-draft/stitch-references/dashboard.png`（及其他页面的对应 PNG）

**硬性强制：**
- 色彩值必须走 Tailwind token（`globals.css` `@theme` 块定义），禁止硬编码 HEX
- 硬编码 HEX 扫描：`grep -rE '#[0-9a-fA-F]{6}' src/ --include='*.ts*' --include='*.css' | grep -v globals.css` 命中数 = 0

**务实说明：** Stitch HTML 用 CDN Tailwind 与项目本地配置略有差异，100% 字节级一致不可能。验收标准是"**截屏并排对比无可见差异**"。

## Consequences

### 正面

- **视觉质量天花板明确：** 消除 Reviewer 判断空间（不再争论"多少算接近"）
- **强制组件化：** 禁硬编码 HEX 自然导出 Tailwind token 使用
- **专业感：** 用户 / 投资人看到产品时视觉品质与设计稿一致，无 "AI 编程感"
- **新批次无需再定义：** 后续所有 UI 批次直接引用此标准

### 负面

- **开发时间增加：** 对齐 Stitch 需反复调参（间距 / 圆角 / 字距）
- **Reviewer 工作量：** 需要 diff 工具 + 截图比对（BI1 前 1-2 小时/页）
- **小差异争议：** ΔE 刚好 2.1 算 pass 还是 fail？（本次用"判断优先 PASS，临界值留 Reviewer 决定"）

### 中性

- 要求 Stitch 设计稿**本身准确**（如 Stitch 有 bug 要登记漂移清单，不回修）
- 视觉回归基线 `tests/screenshots/baseline/` 需要定期更新（Stitch 设计稿变化时）

## Alternatives Considered

### 方案 A（保留 ≤10% 差异，已拒绝）

- **拒绝理由：** 用户明确反对"只要像就行"的态度，追求专业感

### 方案 B（像素级但口径宽松，已拒绝）

- 例：间距 ±5px、ΔE<5、字号 ±1px
- **拒绝理由：** 阈值放宽 2-3 倍，视觉感受明显退化

### 方案 C（完全像素一致 zero-diff，已拒绝）

- **拒绝理由：** Stitch CDN Tailwind 与项目本地 Tailwind 渲染有微差，100% 一致物理不可能

## References

- **Commits：** `c30fcea`（B0 v2 像素级还原 + F010 + §11.2）
- **Specs：** `docs/specs/B0-foundation-spec.md` §F005 / §F007 / §7 L2 / §7 acceptance
- **视觉基准：** `design-draft/stitch-references/*.png` 7 张
- **相关 ADR：** ADR-004（F010 强制复用）/ ADR-005（组件接入口径）

## Notes

### 重新评估触发条件

- 用户业务压力允许降低视觉标准（不太可能）
- Playwright `toHaveScreenshot` 在真实场景频繁误判（需调 threshold）
- Stitch 设计稿质量下降（需换设计工具）

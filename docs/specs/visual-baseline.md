# 视觉基调 Spec — Neural Velocity

> 类型：基线规格（Baseline Spec）
> 状态：✅ 已定稿（2026-04-18）
> 适用范围：KOLMatrix 全产品 UI

## 决策

经过 Stitch 三风格对比评审（Neural Velocity / Editorial Light / Gaming Neon），最终选定 **Neural Velocity** 作为 KOLMatrix 产品视觉基调。

## 对比过程

| Variant | Stitch 项目 ID | 风格 | 结果 |
|---|---|---|---|
| **A · Neural Velocity** | `9338165817879839093` | 深色 navy + 电流青 + 玻璃拟态 | **✅ 选定** |
| B · Editorial Light | `9900459935539855080` | 浅色 + indigo + Newsreader serif | 归档（Stitch 端待删除） |
| C · Gaming Neon | `7841901791452897882` | 黑底 + 霓虹粉/绿 + 电竞 HUD | 归档（Stitch 端待删除） |

## 选定理由

Neural Velocity 同时满足：
1. **编辑级专业感** —— 克制、高端，避免被误判为"游戏工具"
2. **AI 能量可视化** —— 电流青 + 玻璃拟态天然承载 AI 评分、洞察、匹配度等核心差异化能力
3. **数据密度容载力** —— 深色 navy 基底对 KOL/Campaign 大量数据更友好
4. **出海目标用户认同** —— 接近 Linear / Framer / Vercel 等全球高端 SaaS 审美

## 规范引用

视觉 token、组件规则、设计禁忌详见：
- **设计系统完整规范：** `design-draft/design-system.md`
- **Stitch 基准页面（Dashboard）：** https://stitch.withgoogle.com/projects/9338165817879839093

## 强制约束

- 新功能批次的所有 UI 页面 **必须** 遵守 `design-draft/design-system.md` 中的 9 条验收清单
- 前端实现时，色彩 token 统一声明在 Tailwind config 或 CSS Variables，禁止在组件内硬编码 HEX
- 所有 AI 相关元素（评分、洞察、推荐）必须带 primary `#00E5FF` 视觉标识（发光 / 玻璃拟态 / 渐变）
- 禁用：1px solid 边框分隔、纯黑/纯白大面积、硬阴影、标准 SaaS 灰白蓝配色

## 后续批次

视觉基调定稿后，按关键页面分批生成：
- **批次 V1（已完成）：** Dashboard 视觉基调定稿
- **批次 V2（已完成）：** KOL 发现引擎 + KOL 详情页
- **批次 V3（已完成）：** Campaigns 列表 + Campaign 详情 + KOL Database + Email Center
- **批次 V4（待启动）：** 产品知识库 + 客户协同筛选（客户视角简化）+ Email Tracking 详情
- **批次 V5（待启动）：** 登录 / 注册 / 设置 / 团队管理等辅助页

每个批次生成完毕后更新本文档的"Stitch 基准页面"附录。

## 附录：Stitch 资源清单

**主项目：** `projects/9338165817879839093`
**URL：** https://stitch.withgoogle.com/projects/9338165817879839093
**设计系统 Asset：** `assets/18406648320972948834`

### 已生成屏幕（Canonical App Shell 已对齐，7 张 P0 页面）

| 批次 | 页面 | 屏幕 ID | 状态 |
|---|---|---|---|
| V1 | Dashboard | `8b4aa02ae47c4da181239399c6ef4658` | ✅ |
| V2 | KOL Discovery | `a1771401c71140e49e20ebc559782dc3` | ✅ |
| V2 | KOL Detail | `31db0441f2c54852a0a326c82142ed64` | ✅（手动重生成） |
| V3 | Campaigns 列表 | `cdbe3c188fa14c1181d73148e8839ca0` | ✅（手动） |
| V3 | Campaign 详情 | `351a1ae59c7a4b7fa268b29acd49b759` | ✅（手动） |
| V3 | KOL Database | `c10b685955b74e4699992687fabc6647` | ✅（手动） |
| V3 | Email Center | `337c7721553644d580d892de0cd58524` | ✅（手动） |

> **手动 vs 自动生成：** 自动生成（MCP `generate_screen_from_text`）会压缩长 prompt 内容，导致章节缺失。从 V3 起改为用户手动在 Stitch 网页端粘贴 prompt 生成，内容完整度显著提升（HTML 行数 463-632，对比自动生成的 165-365）。

> **历史变更（2026-04-18）：** V1/V2 初版的 sidebar/topbar 三页不一致。已通过 `edit_screens` 重新生成为 canonical shell 版本（旧 3 张已隐藏/删除）。Canonical App Shell 完整规范已写入设计系统 `designMd`，后续生成自动应用。详见 `design-draft/design-system.md` §9。

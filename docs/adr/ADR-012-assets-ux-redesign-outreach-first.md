# ADR-012: BL-026 Assets UX Redesign — Outreach-First Mental Model

## Status

**Accepted**

- 日期：2026-05-03
- 作者：johnsong（Planner）+ 用户决策
- 相关批次：BL-026 Asset UX Redesign（直接依赖）/ BL-025（部分 §F004.B 决议被推翻）

## Context

BL-025 素材中心于 2026-05-03 首轮 verifying PASS 切 done。staging + prod 部署后用户走查实际体验，识别出 4 类心智偏离 + 1 个布局结构问题：

### 心智偏离

1. **设计阶段假设："/assets 是 asset 仓库"** —— 三栏 filter+grid+detail 的强结构，假设用户主任务是"管理素材库"
2. **实际用户主场景是"用 AI 邮件发出去"** —— 80% 高频任务是从产品 → 生成邮件 → 发给 KOL；"管理素材库"是边缘场景
3. **完成主任务需要 7-8 步**：`/knowledge-base → product → chip → /assets → 选 asset → 切 Edit tab → 改 → Save → 切回 Preview → 点 footer Send to Outreach → 跳 /outreach`
4. **/outreach composer 是真正的核心创作界面，但 BL-025 没强化它** —— 仅 F006 dual-write 让 composer 能查到 asset，没增强 search / filter 体验

### 布局结构问题

`[240px filter sidebar | flex-1 grid | 440px detail panel]` 的三栏强约束在 1280-1440px 屏幕（marketer 主流配置）下：
- grid 中部仅 ~720px 实际宽度
- xl:3 列分摊 ≈ 220px/卡片，信息严重拥挤
- detail panel 关闭后 440px 永久空白浪费
- mobile <1280px 直接 hidden（BL-025-followup S2 已认领）

### 次要问题（一并修）

- VersionsTab 占独立 tab 但实际是 flat list（spec 要求 Git-graph 未达），用户实际用 variant 频率 < 10%
- Empty state "Create blank" 假按钮（实际没 blank-create 路径）
- AssetCard 信息层次乱（product 名标题+副标题重复 / status dot 弱化 / AI badge 跟 type chip 同色）

### 不重新设计的部分

- Asset 统一表（ADR-011 决议）—— 表结构正确，零改动
- AI generator + audit log（F003）—— 后端层正确
- 3-step Wizard + 6 速选 chip（F004 patch round 已落地）—— UX 正确
- Material Symbols 守门（F009）—— 与本次重构无关

## Decision

推翻 BL-025 §F004.B 部分决议，重构 /assets UI 层 + 增强 /outreach composer，按"Outreach-First 心智"重组：

### 推翻的 §F004.B 项

| § | 原决议 | BL-026 推翻 |
|---|---|---|
| §F004.B 第 1-10 | Filter sidebar 11 元素全部不得简化 | 改 ActionBar 顶部 "Filter ▾" dropdown，sidebar 删除 |
| §F004.B 第 14 | Detail panel 4 tabs（Preview / Edit / Versions / Used in） | 改 3 tabs，variant tree 折到 Preview tab 顶部下拉 |
| §F004.B 第 18 中 "Create blank" | Empty state 双 CTA | 删除假按钮，改展示 5 套 system_seed 模板让用户直接浏览 |

### 新增的设计原则

1. **Outreach-First** — /outreach composer 是核心创作界面；/assets 是高级管理界面（批量归档、跨产品监控、删除）
2. **Right Drawer Pattern** — Detail panel 改 right slide-over drawer（~520px），关闭时 grid 永远占满
3. **Filter Top Dropdown** — Filter 改顶部按钮弹浮层，不再永久占 240px
4. **3 Tabs Detail** — Preview / Edit / Used in；variant 信息内嵌 Preview tab 顶部 "v2 of 5 ▾" dropdown
5. **System_seed Welcome** — 新 tenant empty state 不显示空白页，直接展示 5 套系统模板让用户浏览/复制

### 保留的设计

- Asset 统一表（ADR-011）+ EmailTemplate dual-write 兼容期 —— 不动
- AI generate / regenerate / variant tree 数据模型 —— 不动
- AssetCard hover quick actions 4 按钮 —— 不动
- 3-step Wizard + 6 chip + Discard / Regenerate / Save & Edit —— 不动
- Material Symbols subset 守门（F009）—— 不动

## Consequences

### 正面

- **核心任务步骤数**：7-8 步 → 3-4 步（/outreach composer 直选 asset → 改 → Send，不需要绕 /assets）
- **Grid 信息密度**：+50%+（@1440px 可见 8-12 个 asset 对比当前 6 个）
- **移动端体验**：drawer 自然全屏，自动吸收 BL-025-followup S2（< 1280px modal 后备）待办，无额外工作
- **代码复杂度**：AssetsClient.tsx 1585 行 → 估 ~1100-1200 行（删除 sidebar + VersionsTab + Compare 假按钮 + Create blank 路径）
- **/outreach 主流场景增强**：search + product filter 让 composer 内直接选模板，不需要切页面

### 负面

- **Visual baseline 重生 4 个**（grid drawer-closed / drawer-open / filter dropdown / mobile drawer 全屏）
- **Spec drafting 工作部分浪费**：BL-025 spec §F004.A/B/C 三段精细起草后两周即被推翻，是认知投资浪费
- **ADR-011 + ADR-012 引用关系增加阅读负担**：未来 reader 需要同读两份 ADR 才能完整理解 /assets 设计
- **/outreach 反向流（Send to outreach 按钮）视觉降级**（GhostButton 替 GradientButton）但保留 —— 老用户已习惯需告知

### 中性

- BL-025 后端层（F001-F003 + F006-F009）保持不变 —— 不需要回滚 schema / migration / generator
- spec §F004.B 第 11-13、15-17、19 项保留（grid card 5 metadata / hover quick actions / sticky bottom bar / 3-step wizard / 6 chip 等）
- 推翻部分明文记录在本 ADR，未来如有第三轮重构必须先读 ADR-011 + ADR-012 再起新决议

## Alternatives Considered

### 方案 A（已拒绝）：保持 BL-025 三栏不动

仅修复"BL-025-followup mini" 范围内的 deferred 项（visual baseline + S2 mobile modal），不动核心心智 + 布局。

**拒绝理由：** 用户实际走查报告"中间显示素材列表的核心区域非常窄，体验很差"——这不是细节问题，是结构问题，不动布局结构等于不修。

### 方案 B（已拒绝）：仅放大 grid 列数 (xl:3 → xl:4) 保留 sidebar

最小代价方案，不删 sidebar 仅改 grid 列数，detail panel 保留。

**拒绝理由：** 240px sidebar 信息使用率低（用户大多按 product + search 筛，status / source 多选 chip 实际用户基本不用）；保留 sidebar = 保留 240px 浪费 + 列数提升仅有限（xl:4 在 sidebar 在的情况下分摊还是 ~250px/卡片，远不如直接全宽 350+px/卡片）。

### 方案 C（已拒绝）：BL-025 全推翻重做

把 BL-025 全 9 features 全部归零，重新走 planning → building → verifying。

**拒绝理由：** BL-025 后端层（F001-F003 Asset 表 / generators / audit log / migration）+ Material Symbols 守门（F009）+ /knowledge-base chip 集成（F007）全部正确无需重做；仅 UI 层心智偏离。归零是过度反应，正确做法是叠加重构（BL-026）+ ADR 记录。

### 方案 D（已选择，见 Decision）：BL-026 叠加重构

保留 BL-025 后端 + 部分 UI 层；重构 sidebar / VersionsTab / Empty state / OutreachComposer search；写 ADR-012 记录推翻部分 §F004.B 决议。

## References

- **前置 ADR：** ADR-011（统一 Asset 表方案，表结构不变）
- **被推翻的 spec：** `docs/specs/BL-025-asset-library-spec.md` §F004.B 第 1-10、14、18（部分）
- **新 spec：** `docs/specs/BL-026-asset-ux-redesign-spec.md`
- **触发会话：** 2026-05-03 用户走查 prod 反馈"通过产品页面点击可以进去 / 但是现在素材库页面 UX 有需要优化的点"
- **Framework 提案：** v0.9.6 [#5] UI 类 spec 起草自检 checklist —— BL-025 spec §2.2/2.3/2.4 用户主动 challenge 才补全；本次 BL-026 spec 起草起按 checklist 自审

## Notes

### 重新审视的触发条件

如果未来出现以下信号，应重新评估本 ADR：
1. 用户走查发现 drawer pattern 在 ultra-wide screen (>1920px) 信息密度仍不足 → 考虑 modal 化或多 panel 同屏
2. variant tree 实际使用频率 > 30%（用户主动 fork 频繁）→ 考虑恢复独立 Versions tab
3. /outreach composer search + product filter（轻量 F005）实际使用率低 → 考虑升级"重"方案（全屏 modal 选 asset）

### 后续跟进项

- BL-026 done 后，BL-025-followup mini-batch（visual 3 PNG + S2 modal）可关闭归档，不需独立批次
- 通过 user feedback 监控用户报告的"找不到 asset"类问题是否消失（drawer + 顶部 dropdown filter 应解决主要 friction）

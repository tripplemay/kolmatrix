# B0 App Shell · Canonical 裁决请求

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-18
> **触发：** F005 实现前发现规格漂移，按 harness-rules "规格偏差开工前反馈" 条款提交
> **状态：** 等待 Planner 明确回复，**未收到前不开工**

---

## 1. 背景

F005 Shell 规格要求「像素级还原 Stitch HTML」，但实现者在跨页审计后发现 `design-draft/stitch-references/` 下 7 份本地 HTML 原型的 App Shell 互不一致。`progress.json` 记录 Kimi 曾"通过 edit_screens 回填 canonical"，但本地 HTML 快照仍是漂移版本。

在缺 canonical 仲裁的情况下实现 F005 会导致下一个 B1 页面视觉对不上又返工，因此在开工前请求 Planner 裁决。

跨页审计全量表（7 × 5 表格）可见会话记录；本文档只列需要决策的分歧点。

---

## 2. 11 条 Canonical 裁决请求

| # | 分歧点 | A 方案 | B 方案 | 多数派 | johnsong 建议默认 |
|---|---|---|---|---|---|
| 1 | Sidebar HTML tag | `<aside>` | `<nav>` | aside (5/7) | **A** |
| 2 | Sidebar 定位 | `fixed left-0 top-0` | `flex-shrink-0` | fixed (6/7) | **A** |
| 3 | Sidebar padding | `px-4 py-6` | `px-6 py-6` | px-6 (3/7) vs px-4 (2/7) | **B**（px-6 视觉更舒展） |
| 4 | Sidebar z-index | 50 | 40 | z-50 (5/7) | **A** |
| 5 | Nav 激活态 | `rounded-none border-l-2 border-cyan` 齐边 | `rounded-[10px]` + 绝对定位 2px span | rounded-none (6/7) | **A**（当前 F005 是 B，需改） |
| 6 | Create Campaign CTA | 保留（dashboard 有） | 移除（其他 6 页都没有） | 无 CTA (6/7) | **B**（Topbar 已有 New Campaign，Sidebar CTA 重复） |
| 7 | Topbar 定位 | `sticky top-0` | `fixed top-0 right-0` | sticky (6/7) | **A** |
| 8 | Search 形状 | `rounded-full` 药丸 | `rounded-lg` 矩形带 border | rounded-full (5/7) | **A** |
| 9 | ⌘K hint 显示 | 显示 `kbd` 标签 | 不显示 | 显示 (5/7) | **A** |
| 10 | Language 显示 | 文字 "EN" + `expand_more` chevron | 纯 `language` 图标 | 文字 "EN" (5/7) | **A** |
| 11 | 头像右侧 chevron | 有 `expand_more` | 无 | 有 (6/7) | **A** |

### 裁决格式要求

请 Planner 就每一条给出明确的 **A / B / 其他** 选择，以及简短理由（如果偏离多数派）。不需要重写本表，用 "#1:A #2:A #3:B #4:A..." 短格式回复即可。

---

## 3. 发现的 4 个 Stitch 原型 bug

本地 HTML 快照发现明确违反 canonical 的偏差，请 Planner 决定是否用 `edit_screens` MCP 回修 Stitch 源：

| # | 文件 | 问题 | 建议处理 |
|---|---|---|---|
| B1 | `kol-discovery.html` | Sidebar 只有 7 项，缺 `Products` | 回修 Stitch，补第 6 项 |
| B2 | `dashboard.html` | Sidebar 只有 7 项，缺 `Settings` | 回修 Stitch，补第 8 项 |
| B3 | `kol-detail.html` | 激活态用独特的"左竖线 `w-[2px]`"设计，破坏与其他 6 页一致性 | 回修 Stitch，改为 `border-l-2` 齐边方案（同裁决 #5） |
| B4 | `campaigns-list.html` | Sidebar footer 用 `unfold_more` 图标，其他 6 页用 `expand_more` | 回修 Stitch，改为 `expand_more` |

**实现策略**：无论是否回修 Stitch，F005/F010 代码都按 canonical 标准（8 项 nav / `expand_more` / `rounded-none`）实现，不复刻原型 bug。

---

## 4. User Chip 方向确认

F005 当前实现把 Sidebar 底部做成**大 chip**（头像 + name + role in 圆角盒，带 `expand_more`）。

跨页扫描：6/7 页是 User Chip 方向，仅 dashboard.html 是单个账号链接（`account_circle + Sarah Chen`）。

**建议**：保留 User Chip 方向，dashboard.html 是未同步的 Stitch 旧版。如 Planner 同意，请把 dashboard 也加入第 3 节回修清单（B5）。

---

## 5. 开工条件

收到 Planner 对**第 2 节 11 条 + 第 3 节 4 条 bug + 第 4 节 User Chip 方向**的明确回复后，johnsong 会：

1. 重构 F005 Shell（Sidebar / Topbar / 相关组件）
2. 规划 F010 组件映射表（12 个 common/ 组件 × HTML 参考源）
3. 走 HEX / tsc / lint / build 全绿闸门
4. push 到 main

**未收到明确回复前不开工。** 即便所有建议都是多数派，也不擅自 accept。

---

## 6. 相关文档

- `docs/specs/B0-app-shell-component.md` — 原 F005 规格（需据本文决议补丁）
- `docs/specs/B0-foundation-spec.md` §4 F005 — 像素级还原验收标准
- `docs/specs/visual-baseline.md` — Neural Velocity 视觉基调定稿
- `design-draft/design-system.md` §9 — Canonical App Shell 规范
- `design-draft/stitch-references/*.html` — 7 份本地原型快照（已发现 4 个 bug）
- `harness-rules.md` — "规格偏差开工前反馈" 条款

---

## 7. Planner 裁决（Kimi · 2026-04-18）

感谢严谨的 pre-impl 审计。裁决如下——johnsong 可按此立即开工 F005，无需等进一步确认。

### 7.1 §2 的 11 条 Canonical 决定

**短格式：** `#1:A #2:A #3:B #4:A #5:A #6:B #7:A #8:A #9:A #10:A #11:A`

全部采纳 johnsong 建议（与 Stitch 多数派 + designMd 一致）。详细理由：

| # | 决定 | 理由 |
|---|---|---|
| 1 | **A** `<aside>` | 语义正确（sidebar 是 complementary content）。内部可嵌 `<nav>` 包裹 nav list |
| 2 | **A** `fixed left-0 top-0` | SaaS dashboard 标配，sidebar 不随主内容滚动 |
| 3 | **B** `px-6 py-6`（24px padding） | designMd §9 明确 "Padding: 24px"；视觉舒展优先 |
| 4 | **A** z-50 | 未来可能叠弹窗/toast，sidebar/topbar 都走 z-50 保险 |
| 5 | **A** `rounded-none border-l-2 border-cyan` 齐边 | 6/7 多数派 + border-l-2 与 rounded 互斥（rounded 会把 border 切断）。放弃 designMd 原写的 `rounded-[10px]`，齐边方案更 canonical |
| 6 | **B** 移除 Create Campaign CTA | designMd §9 STRICT FORBIDDEN 明写"no Create Campaign in sidebar"。dashboard.html 里的是 Stitch 生成漂移，忽略 |
| 7 | **A** `sticky top-0` | 比 fixed 简单，随主内容滚动上下文 |
| 8 | **A** `rounded-full` 药丸 | designMd "Pill shape, height 40px"，明确 |
| 9 | **A** 显示 ⌘K hint | designMd "Right side small kbd chip showing 'Cmd+K'" |
| 10 | **A** "EN" 文字 + chevron | designMd "small chip Inter 500 13px '#bac9cc' showing 'EN' + tiny chevron" |
| 11 | **A** 头像 chevron 保留 | designMd "32px circular + small chevron beside, opens user menu on click" |

### 7.2 §3 的 4 个 Stitch 原型 bug

**决定：不回修 Stitch，标注为"已知 HTML 参考漂移"。**

理由：
1. `edit_screens` MCP 历史上压缩过 kol-detail.html 内容（B0 v2 事件），风险 > 收益
2. HTML refs 本就是"视觉参考"不是"真相来源"，canonical 真相在 designMd + 本文决议
3. 实现照 canonical 走（F005/F010 已按此策略），视觉回归 L2 对照时 Reviewer 用 canonical 描述比对，不咬字 Stitch 渲染

**补救：** 更新 `design-draft/stitch-references/README.md` 列出 4 bug + 告知 Reviewer "canonical 描述优先"。

| # | 文件 | 已知漂移 | 实现层面 |
|---|---|---|---|
| B1 | kol-discovery.html | 只 7 项（缺 Products） | 代码实现 8 项 |
| B2 | dashboard.html | 只 7 项（缺 Settings） | 代码实现 8 项 |
| B3 | kol-detail.html | 激活态独特 `w-[2px]` span | 代码用 #5 canonical 齐边 `border-l-2` |
| B4 | campaigns-list.html | footer `unfold_more` 图标 | 代码用 `expand_more` |

### 7.3 §4 User Chip 方向

**决定：User Chip 方向（avatar + name + role 圆角盒 + chevron），采纳 johnsong 建议。**

dashboard.html 单账号链接是 Stitch 旧版漂移，补到 §7.2 表格作为 B5：

| # | 文件 | 已知漂移 | 实现层面 |
|---|---|---|---|
| B5 | dashboard.html（footer） | 单账号链接（`account_circle + Sarah Chen`） | 代码按 User Chip 实现 |

### 7.4 同步文档更新

Planner 同时修订以下 spec：

1. `docs/specs/B0-app-shell-component.md`
   - §5 Nav Item 激活态改为 canonical #5（rounded-none + border-l-2 flush edge）
   - 删除任何 Create Campaign CTA 相关残留
   - padding 统一 `px-6 py-6`

2. `design-draft/stitch-references/README.md`
   - 加"⚠️ 已知 HTML 参考漂移"段，列出 B1-B5
   - 明确"canonical 描述优先"原则

本次裁决推送到 main 后，johnsong 可立即开工 F005，无需再询问。

**本裁决的范围：** 仅限 F005 App Shell。F010 公共组件库如再发现类似分歧，走同样的"pre-impl 审计 → 裁决"流程。

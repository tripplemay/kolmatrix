# Stitch 参考设计稿

> 这些文件是 Stitch AI 生成的 KOLMatrix 视觉参考，用于前端组件实现时的视觉对照。
> 不要把它们复制成生产代码，它们使用 CDN 版 Tailwind + 内联配置 + 静态 mock 数据。
>
> 目的：给开发者（johnsong）一个可在浏览器直接打开的视觉参考，避免每次都要登 Stitch 网页端。

## 文件清单（14 张页面）

| 文件 | 来源 Stitch screen | 对应业务 | 批次 |
|---|---|---|---|
| `dashboard.html` + `.png` | `8b4aa02ae47c4da181239399c6ef4658` | Dashboard 首页 | B0 (F005/F007) |
| `kol-discovery.html` + `.png` | `a1771401c71140e49e20ebc559782dc3` | KOL 发现引擎 | B1 |
| `kol-detail.html` + `.png` | `31db0441f2c54852a0a326c82142ed64` | KOL 详情/画像页 | B1 |
| `campaigns-list.html` + `.png` | `cdbe3c188fa14c1181d73148e8839ca0` | Campaigns 列表 | B1 |
| `campaign-detail.html` + `.png` | `351a1ae59c7a4b7fa268b29acd49b759` | Campaign 详情看板 | B1 |
| `kol-database.html` + `.png` | `c10b685955b74e4699992687fabc6647` | KOL 数据库管理 | B1 |
| `email-center.html` + `.png` | `337c7721553644d580d892de0cd58524` | 邮件触达中心 | B3 |
| `client-review.html` + `.png` | `00ea6b4cd4b342e8ad0cd04679b781e2` | 客户协同筛选（客户视角简化视图）| B3 |
| `email-tracking.html` + `.png` | `a654800b865d4680818750b003519e33` | Email Tracking 详情（邮件线程追踪）| B4 |
| `login.html` + `.png` | `601539f07eaf436f8a8fb151ee88384e` | 登录页（58/42 cinematic split，游戏氛围版）| B0 Auth |
| `signup.html` + `.png` | `7fa095c8ec33476995b97fe241af697a` | Request workspace access 注册页（58/42 war-room 配对）| B0/B9 |
| `email-template-editor.html` + `.png` | `e4515ced3d414b289979ba2a06a31e89` | 邮件模板编辑器（左编辑 62% / 右预览 38%）| B4 |
| `email-send-queue.html` + `.png` | `9e9b4789fe7f430683e4ac22fe1e9271` | 发送队列 + 频控配置 | B4 |
| `email-unsubscribe.html` + `.png` | `c4aed4b89ce24fb09a4df10bfe0a98bf` | 退订管理 + 公开退订页预览 | B4 合规 |

## 使用方式

```bash
# 本地直接浏览器打开（macOS）
open design-draft/stitch-references/dashboard.html

# 或起一个简单服务器（CDN 资源需联网）
cd design-draft/stitch-references && python3 -m http.server 8088
# 访问 http://localhost:8088/dashboard.html
```

## ⚠️ 注意事项

### 1. HTML 用 CDN Tailwind 而非项目编译版
打开 HTML 需要联网拉 CDN（Tailwind / Inter / Material Symbols）。生产代码请走项目本地 Tailwind v4 + next/font。

### 2. 颜色 token 已在项目 design-system.md 沉淀
不要从 HTML 里复制 HEX——优先用 `globals.css` `@theme` 块中的 Tailwind v4 token（B0 F002 任务会建立）。

### 3. 自动生成 vs 手动生成
- **B0 三页（Dashboard / Discovery / Detail）** 由 MCP 自动生成 + edit_screens 对齐 shell
- **V3 四页（Campaigns 列表 / Campaign 详情 / KOL Database / Email Center）** 用户手动在 Stitch 网页端粘贴 prompt 生成（自动生成有内容压缩问题）
- **V4 两页（Client Review / Email Tracking）** 用户手动生成（`00ea6b4c` 4226px / `a654800b` 4414px），内容完整
- **V5 五页（Login v2 / Signup v2 / Email Template Editor / Send Queue / Unsubscribe）** 用户手动生成，prompt 见 `V5-prompts.md`；登录/注册为 58/42 split 游戏氛围版（v1 居中卡作废），邮件 3 张为 App Shell 内页
- **kol-detail.html v3** 也是手动重生成版本（v1 完整 → v2 edit_screens 压缩到 165 行 → v3 手动恢复到 632 行）

### 3.1 V4 已知 MCP 冗余（待用户手动在 Stitch UI 隐藏/删除）
- 短版 Client Review：screen `219e3547...`（2516px，MCP 自动生成，内容压缩）
- 短版 Email Tracking：screen `46df7ce5...`（2048px，MCP 自动生成，内容压缩）
- 重复 Email Center：screen `d3f92c57...`（2048px，与 V3 的 `337c7721...` 重复）

### 4. App Shell 一致性
所有页面共享 canonical App Shell（sidebar 8 项 + topbar 三段式），由设计系统 `designMd` 强制注入。开发实现时，shell 抽取为 `<AppShellLayout>` 单一组件复用，不在每页重写。

## ⚠️ 已知 HTML 参考漂移（2026-04-18 审计发现）

johnsong 在 F005 pre-impl 审计中发现 7 份本地 HTML 互相不一致。**canonical 真相来源是 `design-draft/design-system.md` §9 + `docs/specs/B0-app-shell-component.md` + `docs/specs/B0-app-shell-canonical-review.md`**，不是单份 HTML 快照。

代码实现按 canonical，不复刻这些 HTML bugs。Reviewer 做视觉回归 L2 时：**canonical 描述优先于 HTML 字面渲染**。

| # | 文件 | 漂移内容 | 代码应实现 |
|---|---|---|---|
| B1 | `kol-discovery.html` | sidebar 只有 7 项（缺 Products） | 8 项完整 nav |
| B2 | `dashboard.html` | sidebar 只有 7 项（缺 Settings） | 8 项完整 nav |
| B3 | `kol-detail.html` | 激活态用独特 `w-[2px]` span 设计 | canonical `border-l-2` 齐边 |
| B4 | `campaigns-list.html` | footer 用 `unfold_more` 图标 | `expand_more` |
| B5 | `dashboard.html` | sidebar footer 用单账号链接 | User Chip（avatar + name + role + chevron） |
| B6 | `dashboard.html:249` | SVG `viewbox` 小写（React 会警告） | `viewBox` 驼峰 |
| B7 | `kol-discovery.html:188-191` | Filter 按钮缺 disabled 态 class | B1 范围，B1 实现 FilterButton 时补 |
| B8 | `campaigns-list.html:245-252` | Tab underline 用绝对定位但父 button 无 `relative` | 代码 `<button className="relative">` |
| B10 | `dashboard.html:457-460` | Email Perf 图表纯 polyline SVG 无坐标轴刻度/网格 | F007 实现用 recharts 补 Y 轴刻度 + 网格 |

**为什么不回修 Stitch：** `edit_screens` MCP 历史上压缩过内容（kol-detail v2 事件），风险 > 收益；HTML refs 本就是"视觉参考"不是"真相"。

## 视觉验收基准

- B0 F005（App Shell）+ F007（Dashboard）的视觉验收以 `dashboard.png` 为基准（像素级还原 ±2px / ΔE<2 / 字号 100%）
- **对齐原则：** 代码按 canonical 实现；遇 HTML ref 与 canonical 不符（上述 B1-B5）时，以 canonical 为准
- B1 后续业务页面以对应 .png 为基准
- Reviewer 阶段截屏对照验收

## Stitch 项目入口

如需在 Stitch 网页端再次查看或编辑：
https://stitch.withgoogle.com/projects/9338165817879839093

设计系统 designMd 已包含 canonical App Shell 完整规范，新生成页面会自动遵循。

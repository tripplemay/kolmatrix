# Stitch 参考设计稿

> 这些文件是 Stitch AI 生成的 KOLMatrix 视觉参考，用于前端组件实现时的视觉对照。
> 不要把它们复制成生产代码，它们使用 CDN 版 Tailwind + 内联配置 + 静态 mock 数据。
>
> 目的：给开发者（johnsong）一个可在浏览器直接打开的视觉参考，避免每次都要登 Stitch 网页端。

## 文件清单（7 张 P0 页面）

| 文件 | 来源 Stitch screen | 对应业务 | 批次 |
|---|---|---|---|
| `dashboard.html` + `.png` | `8b4aa02ae47c4da181239399c6ef4658` | Dashboard 首页 | B0 (F005/F007) |
| `kol-discovery.html` + `.png` | `a1771401c71140e49e20ebc559782dc3` | KOL 发现引擎 | B1 |
| `kol-detail.html` + `.png` | `31db0441f2c54852a0a326c82142ed64` | KOL 详情/画像页 | B1 |
| `campaigns-list.html` + `.png` | `cdbe3c188fa14c1181d73148e8839ca0` | Campaigns 列表 | B1 |
| `campaign-detail.html` + `.png` | `351a1ae59c7a4b7fa268b29acd49b759` | Campaign 详情看板 | B1 |
| `kol-database.html` + `.png` | `c10b685955b74e4699992687fabc6647` | KOL 数据库管理 | B1 |
| `email-center.html` + `.png` | `337c7721553644d580d892de0cd58524` | 邮件触达中心 | B3 |

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
- **kol-detail.html v3** 也是手动重生成版本（v1 完整 → v2 edit_screens 压缩到 165 行 → v3 手动恢复到 632 行）

### 4. App Shell 一致性
所有页面共享 canonical App Shell（sidebar 8 项 + topbar 三段式），由设计系统 `designMd` 强制注入。开发实现时，shell 抽取为 `<AppShellLayout>` 单一组件复用，不在每页重写。

## 视觉验收基准

- B0 F005（App Shell）+ F007（Dashboard）的视觉验收以 `dashboard.png` 为基准（像素级还原 ±2px / ΔE<2 / 字号 100%）
- B1 后续业务页面以对应 .png 为基准
- Reviewer 阶段截屏对照验收

## Stitch 项目入口

如需在 Stitch 网页端再次查看或编辑：
https://stitch.withgoogle.com/projects/9338165817879839093

设计系统 designMd 已包含 canonical App Shell 完整规范，新生成页面会自动遵循。

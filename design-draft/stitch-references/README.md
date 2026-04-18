# Stitch 参考设计稿

> 这些文件是 Stitch AI 生成的 KOLMatrix 视觉参考，用于前端组件实现时的视觉对照。
> 不要把它们复制成生产代码，它们使用 CDN 版 Tailwind + 内联配置 + 静态 mock 数据。
>
> 目的：给开发者（johnsong）一个可在浏览器直接打开的视觉参考，避免每次都要登 Stitch 网页端。

## 文件清单

| 文件 | 来源 Stitch screen | 对应业务 |
|---|---|---|
| `dashboard.html` + `dashboard.png` | `8b4aa02ae47c4da181239399c6ef4658` | Dashboard（B0 F007 实现基准）|
| `kol-discovery.html` + `kol-discovery.png` | `a1771401c71140e49e20ebc559782dc3` | KOL 发现页（B1 实现基准）|
| `kol-detail.html` + `kol-detail.png` | `31db0441f2c54852a0a326c82142ed64` | KOL 详情页（B1 实现基准）|

## 使用方式

```bash
# 本地直接浏览器打开（macOS）
open design-draft/stitch-references/dashboard.html

# 或者用 python 起一个简单服务器（需要 CDN 资源，必须有网）
cd design-draft/stitch-references && python3 -m http.server 8088
# 然后访问 http://localhost:8088/dashboard.html
```

## ⚠️ 注意事项

### 1. HTML 用 CDN Tailwind 而非项目编译版
打开 HTML 需要联网拉 CDN（Tailwind / Inter / Material Symbols）。生产代码请走项目本地 Tailwind + next/font。

### 2. 颜色 token 已在项目 design-system.md 沉淀
不要从 HTML 里复制 HEX——优先用 `tailwind.config.ts` 中的 token（B0 F002 任务会建立）。

### 3. KOL 详情页 历史
- 第一版（`c5eff504`，hidden）：完整 8 个 section
- 第二版（`b06528d2`，hidden）：edit_screens 时主内容被压缩
- 当前版（`31db0441`）：手动重新生成，恢复完整内容（632 行 HTML）— **以此为准**

## 视觉验收基准

B0 F005（App Shell）和 F007（Dashboard）的视觉验收以 `dashboard.png` 为基准，要求 ≤10% 视觉差异。Reviewer 阶段对照截屏验收。

## Stitch 项目入口

如果你需要在 Stitch 网页端再次查看或编辑：
https://stitch.withgoogle.com/projects/9338165817879839093

设计系统 designMd 已包含 canonical App Shell 完整规范，新生成页面会自动遵循。

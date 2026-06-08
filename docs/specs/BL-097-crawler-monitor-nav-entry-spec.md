# BL-097 监控页导航入口

> **Type：** 小 UI 功能(给 BL-096 监控页加网站入口)。spec 软性
> **来源：** 2026-06-08 用户 — `/admin/crawler-monitor` 目前只能手敲 URL,要在网站上有入口
> **关联：** BL-096(监控页本体)· `UserAvatarMenu.tsx`(已有 admin 段链 apify-preview)

## §1 背景

BL-096 监控页 `/admin/crawler-monitor` 已上线但**无 UI 入口**。`UserAvatarMenu.tsx` 已有 `isAdminRole` 门控的 admin 段(`adminTools`),内含 `/admin/apify-preview` 链接 —— 监控页入口放这里最自然(平台级、admin-only、与现有 admin 工具并列)。

## §2 Features

### F001 — UserAvatarMenu 加监控页入口(generator,kolmatrix)
- `src/components/layout/UserAvatarMenu.tsx` 的 admin 段(`showAdmin` block,line ~111-128)加一条 `<Link>` → `/${locale}/admin/crawler-monitor`,仿现有 apify-preview 链接(`role=menuitem`、onClick 关菜单、同 className、material icon 如 `monitoring`/`monitor_heart`、label `t("adminCrawlerMonitor")`)。
- i18n:`userAvatarMenu.adminCrawlerMonitor` 5 locale(zh/en/ja/ko/es)。
- 更新 `UserAvatarMenu.test.tsx`:加断言新链接 href = `/{locale}/admin/crawler-monitor` + admin-gated(非 admin 不显)。
- L1 全绿(lint/tsc/test + i18n 5 locale 一致)。

### F002 — Codex L1+L2 + signoff(codex)
- L1:lint 0err warn≤3 / tsc=0 / npm test(含 UserAvatarMenu 新断言)+ i18n 5 locale 一致。
- L2 部署后:admin 用户头像菜单见"爬虫监控"入口 → 点进可达 `/admin/crawler-monitor`;非 admin 不显该项(showAdmin gate)。
- signoff `docs/test-reports/BL-097-signoff-2026-06-XX.md`。

## §3 风险

- 极小;纯 kolmatrix UI + i18n。⚠️ 部署 staging+prod(手动触发)注意 OOM(NODE_OPTIONS=4096)。

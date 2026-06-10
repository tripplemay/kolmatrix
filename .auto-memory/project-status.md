---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-108-crawler-pause-switches BUILDING (0/5) — 爬虫暂停开关(监控页手动控制)
- 决策 ADR-019(两层开关: 主 scraping_enabled 全停所有抓取含manual_seed + 子 refresh_enabled 仅refresh, 主⊇子). spec docs/specs/BL-108-*. 插队波0(用户决BL-099后第一优先)
- 跨2repo: F001/F002 爬虫 guang-tech/apify upstream patch(用户 merge+部署) + F003/F004 kolmatrix UI + F005 Codex. 关键: gate入队源(无尖峰)/DB service_settings非env/读API不受影响/全停不保hot
- 下一步 Generator F001(爬虫 service_settings 表 + admin /admin/crawler-state API). ⚠️ L2 需爬虫+kolmatrix 都部署后实测
## ✅ BL-099 DONE (6/6, fix_rounds=1, signoff @ docs/test-reports/BL-099-signoff-2026-06-10.md) — ADR-011 收尾, Email Template 统一 Asset 单一真相源
- 决策 ADR-018(C: email_log 去FK+template_name 快照, drop email_template) 已落地
- ✅ F001-F005 done+deploy：staging `07e8b09` / prod `62c3114`；两环境 `email_template` 已 drop，旧 FK 已移除，prod user 模板零丢失维持 `16 published`
- ✅ Codex F006 signoff 完成(2026-06-10)：L1 绿(`tsc=0`, `lint 0e/3w`, `vitest 210 files/1563 pass`)；staging 复验关闭原 FAIL（新建模板即时出现在 composer）；AI customize + send 快照通过；prod 登录态 `/en/reach*` UI + DB/部署只读复核通过
- fix-round 1 根因/修复：TemplatePicker product filter 改 OR-generic 语义 + 产品命中项排前 + cap 20→100，回归测试 9 个，CI 绿

## ✅ BL-098 DONE (2/2, signoff 2026-06-09) — PROD 邮件AI定制'模板不存在' hotfix(Asset查询)
## ✅ BL-080 DONE (6/6, signoff @ docs/test-reports/BL-080-signoff-2026-06-09.md) — 落地页 AI 插画(8张)替video+动画
## ✅ BL-097 DONE (2/2) — 监控页导航入口(UserAvatarMenu admin段)
## ✅ BL-096 DONE (3/3, fix_rounds=1, signoff @ docs/test-reports/BL-096-signoff-2026-06-08.md) — 监控页 /admin/crawler-monitor 上线
## ✅ BL-092 / BL-094 / BL-093 / BL-091 / BL-086 — 全部 DONE

## 用户手工待办
1. aigcgateway VM .git remote PAT(gho_*)轮换(安全)

## Backlog — 路线图(波0 BL-108 已转 BUILDING 见顶部)
- 波1 快赢：BL-104 / BL-103 / BL-102 / BL-101
- 波2：BL-100 邮件发送异步化
- 波3：BL-105 campaign 编辑 UI 补回
- 波4：BL-107 / BL-106 链路收口
- 其余：BL-095 / BL-089 / BL-058 / BL-048 / BL-011 等详见 backlog.json

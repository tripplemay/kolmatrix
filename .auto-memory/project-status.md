---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-108-crawler-pause-switches VERIFYING (4/4 generator done, F005 Codex 待验) — 爬虫暂停开关
- 决策 ADR-019(两层开关: 主 scraping_enabled 全停含manual_seed + 子 refresh_enabled 仅refresh, 主⊇子, gate在入队源无尖峰). spec docs/specs/BL-108-*
- ✅ 爬虫侧 F001+F002: **PR#12 已 merge(squash @15c2ba3) + 已部署 /opt**(2026-06-10 用户授权) — service_settings 表+GET/PATCH /admin/crawler-state + 6 入队点 gate + ops脚本 gate + Dockerfile 部署债修复. 部署实证: clean build EXIT=0(无 awk 补丁), migration 0005 applied(默认行 both true), /admin/crawler-state 200, kolmatrix staging 配置的 key 直连可用, 40 schedules 同步, lastRefreshAt ISO. refreshBacklog total 8832/dueNow 2363
- ✅ kolmatrix 侧 F003+F004: proxy+装配+两 toggle+确认弹窗+audit+i18n 5 locale. CI 绿, **staging deployed @ 2c86347**
- 两轮对抗审查(15 agents)1 blocking+7 should-fix 全采纳; runbook 同步精简(awk 热补丁+frozen-lockfile sed 已闭环, 仅剩 3004:3003 端口 sed)
- ⏭️ **Codex F005 完全解锁**: L1 两仓 + L2 五项(翻主开关→入队停+manual_seed 409 / 子开关仅 refresh 停 / 状态显示 / 恢复无尖峰 / admin-only). 两端都已部署
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

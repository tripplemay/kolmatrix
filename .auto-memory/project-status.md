---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-110-splitbrain-quickwins-wave1 VERIFYING (4/5 generator done, 交 Codex F005) — split-brain 快赢止血(波1, 合并 BL-101/102/103/104)
- F001-F004 全实现+CI全绿+**staging 已部署@b952f7e(SHA对齐实证)**. F001 面包屑死链→/match / F002 /assets LISTABLE_ASSET_TYPES白名单防AI解释缓存脏卡+welcome / F003 accept读口径统一(isAcceptedKolRow: source白名单 AND suggestionStatus∈{accepted,NULL}, skip/swap不再显示已接受) / F004 Reply链4面板诚实空态(replyTrackingPending数据驱动, B4写repliedAt即复活). spec docs/specs/BL-110-*
- 下一步 Codex F005: L1(lint/tsc/test)+L2 staging走查4点+signoff. ⚠️ git_sha 验证带 ?token=HEALTH_DETAIL_TOKEN(detail-gated). 本批无 migration/env/seed. H6 Edit Brief死链留波3 BL-105
## ✅ BL-108-crawler-pause-switches DONE (5/5, fix-round 2 complete, signoff @ docs/test-reports/BL-108-signoff-2026-06-10.md) — 爬虫暂停开关
- ⚠️ **kolmatrix UI 仅 staging@706d806, 待 prod 部署**(让开关上 prod 监控页); 爬虫后端gate+API已上prod/opt(PR#12@15c2ba3). 2条水合proposed-learnings待ack
- 决策 ADR-019(两层开关: 主 scraping_enabled 全停含manual_seed + 子 refresh_enabled 仅refresh, 主⊇子, gate在入队源无尖峰). spec docs/specs/BL-108-*
- ✅ 爬虫侧 F001+F002: **PR#12 已 merge(squash @15c2ba3) + 已部署 /opt**(2026-06-10 用户授权) — service_settings 表+GET/PATCH /admin/crawler-state + 6 入队点 gate + ops脚本 gate + Dockerfile 部署债修复. 部署实证: clean build EXIT=0(无 awk 补丁), migration 0005 applied(默认行 both true), /admin/crawler-state 200, kolmatrix staging 配置的 key 直连可用, 40 schedules 同步, lastRefreshAt ISO. refreshBacklog total 8832/dueNow 2363
- ✅ kolmatrix 侧 F003+F004: proxy+装配+两 toggle+确认弹窗+audit+i18n 5 locale. CI 绿, **staging deployed @ 2c86347**
- 两轮对抗审查(15 agents)1 blocking+7 should-fix 全采纳; runbook 同步精简(awk 热补丁+frozen-lockfile sed 已闭环, 仅剩 3004:3003 端口 sed)
- ✅ Codex L1+L2+signoff complete: React #418 不再复现; 水合门闸生效(data-ready/初始化中); staging 标准 click 等待就绪后可弹确认并变更状态; main OFF manual_seed/scrape-jobs 409, refresh OFF hashtag 201, admin-only 302→/insight; L1 绿(npm run lint 0e/3w, tsc=0, npm test 1592/1592, targeted 10/10)
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

## Backlog — 路线图(波1 BL-110 已转 BUILDING 见顶部, 合并 BL-101~104)
- **BL-111**(高, BL-110后): 修爬虫暂停开关样式(CrawlerPauseControls.tsx:77 暂停态 bg-error浅粉#ffb4ab用错→bg-warning琥珀; BL-108视觉bug, ~1-2行). ⚠️ 应在BL-108 kolmatrix UI上prod前修
- 波2：BL-100 邮件发送异步化
- 波3：BL-105 campaign 编辑 UI 补回
- 波4：BL-107 / BL-106 链路收口
- 其余：BL-095 / BL-089 / BL-058 / BL-048 / BL-011 等详见 backlog.json

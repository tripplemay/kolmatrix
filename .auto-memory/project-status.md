---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔬 BL-100-email-async-bullmq VERIFYING (4/5 generator done, F005 Codex) — 邮件发送异步化 + 真 BullMQ 队列(波2)
- 审计 H1: sendBatchAction 同步await+60s race, 每封sleep6000→>10收件人必超时. 决策 ADR-020: BullMQ(同JobQueue接口)+worker进程内+发送异步(enqueue立即返batchId+进度轮询)+幂等(batchId+kolId)+Redis挂回退同步. spec docs/specs/BL-100-*
- F001 BullMQJobQueue+工厂(REDIS_URL→BullMQ/否则InMemory)+getBullConnection(maxRetriesPerRequest:null) / F002 email_log.batchId migration+幂等跳已发 / F003 send-email-batch handler+sendBatchAction异步(去60s race)+D5回退+getSendBatchStatus / F004 useSendBatch hook 进度轮询UX+i18n 5locale+cap 100. F005 Codex L1+L2+signoff
- ✅ staging deployed @ 6566c97(F002 migration applied, health git_sha 一致 healthy). L1 本地全绿(tsc=0/lint 0e3w/test 1653). 下一步 Codex verifying
- ⚠️ staging Redis 6.0.16 < BullMQ 推荐 6.2.0(core 功能可用, Codex L2 须实测 enqueue→consume 通); +bullmq 依赖; worker 进程内不加进程
## ✅ BL-111-crawler-toggle-style-fix DONE (F001 done, F002 Codex 用户授权免除, closure @ docs/test-reports/BL-111-closure-2026-06-11.md) — 爬虫开关样式修复
- CrawlerPauseControls.tsx 暂停态轨道+状态徽章 bg-error(#ffb4ab浅鲑粉)→bg-warning(#fec931琥珀); 运行态保留, 健康卡真错误态bg-error未动; +30行回归测试. staging@a6f7c08
- 关闭方式: 用户授权快track(trivial 2行视觉修, 免Codex评估), Planner代码review干净+独立跑12/12 PASS. ⚠️琥珀视觉观感 staging 用户自查(1行可调)
- ⚠️ 部署建议: 本批+BL-108 UI+BL-110 凑一次 prod 部署(main HEAD 一次带全, 让 BL-108 开关带修正样式上 prod)
## ✅ BL-110-splitbrain-quickwins-wave1 DONE (5/5, fix-round 1 PASS) — split-brain 快赢止血(波1, 合并 BL-101/102/103/104)
- Codex reverifying PASS：F001-F004 全部通过，signoff 写入 `docs/test-reports/BL-110-signoff-2026-06-11.md`
- 已证实 PASS：
  - F001 面包屑 `/kols/[id] -> /match`：local + staging + prod 登录态点击都不再 404
  - F002 `/assets` 白名单收口：local/staging/prod explanation cache rows都不再出现在 grid；local explanation-only tenant 正确进入 welcome
  - F003 accepted 读口径：local 构造数据与 staging 真 campaign `2d11dd71-1a98-4ee0-b15d-314dae9fcd3c` 都证明 skip 不再进入 accepted panel / count
  - F004 reply 链诚实空态：staging/prod 对有历史 repliedAt 的 tenant 不再显示 B4 pending note；local pending tenant 仍保留 honest empty state
- fix-round 1 根因已闭环：dashboard/quick stats/tracking 统一改为全时段 repliedAt 存在判定，不再受 14-day/当前页窗口误导
- 本批无 migration/env 变更。H6 Edit Brief 死链仍留波3 BL-105
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

## Backlog — 路线图(波2 BL-100 已转 BUILDING 见顶部)
- 波3：BL-105 campaign 编辑 UI 补回
- 波4：BL-107 / BL-106 链路收口
- 其余：BL-095 / BL-089 / BL-058 / BL-048 / BL-011 等详见 backlog.json

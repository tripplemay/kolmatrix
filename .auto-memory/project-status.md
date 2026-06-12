---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-107-link-closure-wave4 DONE (5/5, fix_rounds=0, signoff @ docs/test-reports/BL-107-signoff-2026-06-12.md) — 链路收口(波4)= **split-brain 路线图收官**
- M4软删过滤 / M8 ROI删硬编码 / M5 tsvector死码删 / M6删4孤儿路由(含relationship-status, 零fetch实证) / M7 ?ai=止血(保留引擎待BL-112) / BL-106 KPI cron装deploy-prod.sh step8b(自愈+抗VM reset). L1 1681 test绿. Codex L2 代码审查5/5 PASS(0 crit/high/med). staging@02ba1fe
- ⚠️ **BL-106 KPI cron 仅 prod 部署时实装**(staging 不跑 deploy-prod.sh): 脚本/装配 dry-run 验过, 但 **prod 部署后才生效** → 届时验 kpi_daily_snapshot count>0 + dashboard KPI 趋势脱"—"(需≥若干天数据)
- 🎉 **split-brain 修复路线图全完成**: 波0 BL-108 → 波1 BL-110 → 波2 BL-100 → 波3 BL-105 → 波4 BL-107. 审计(6高危+8中危)全remediate
## ✅ BL-105-campaign-edit-ui-restore DONE (4/4, fix_rounds=0, signoff @ docs/test-reports/BL-105-signoff-2026-06-12.md) — campaign 编辑 UI 补回(波3)
- 6孤儿action接UI: /edit页(字段/状态流转/营收, owner/admin gate)+AcceptedKolsPanel每行inline(status/fee/remove)+H6 Edit Brief 修404. 守 ADR-013 详情页只读. staging@969b4d5(无migration). Codex L2 E2E 12/12 PASS
- ✅ **authz 已决(用户 2026-06-12)**: campaign 编辑 = **租户级权限**(与全app RLS 模型一致, 无 per-user owner/admin 角色), 不补 server 端强制; UI owner/admin 门控为软限制保留. 安全上非真漏洞(租户即信任边界)
- 📋 proposed-learnings 积压 **4 条待 ack**: 2水合(BL-108) + BullMQ连接拓扑(BL-100) + 新route page须npm run build(BL-105)
## ✅ BL-100-email-async-bullmq DONE (5/5, fix-round 0 PASS) + 🚀 PROD 部署 — 邮件发送异步化 + 真 BullMQ 队列(波2)
- ✅ **PROD 已部署(用户 2026-06-11/12)+ Planner 只读核验**: prod health healthy(db/redis ok), email_log.batch_id 列已落 prod(F002 migration applied), kolmatrix 进程 online. BL-108/110/111/100 四批随 main HEAD 一并上 prod(积压清零)
- ⚠️ watch: prod Redis **6.0.16** < BullMQ 推荐 6.2.0(staging 同版本 L2 实测 13 人发送通, 可用; 若未来 BullMQ 用 6.2+ 特性需升级). prod 真实 >10 收件人发送建议用户日常使用中验一次
- Codex reverifying PASS：F001-F004 全部通过，signoff 写入 `docs/test-reports/BL-100-signoff-2026-06-11.md`
- L1：eslint 0e/3w，tsc=0，npm test 1653/1653 PASS
- L2 staging git_sha=6566c97：13 人发送立即返回并完成 13 sent / 0 mocked / 0 failed；pm2 reload 中途 job 未丢；Redis 停机时触发 D5 回退同步发送并落告警；prewarm 正常，`ai_recommendation_explanation_short` 计数 0→25
- staging health 10:39 BJT OK（db/redis 均 ok），Redis 已恢复
- 本批无 migration/env 之外的产品代码改动；H6 Edit Brief 留波3 BL-105
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
- ✅ **kolmatrix UI 已上 prod**(2026-06-11/12 随四批部署, 开关带 BL-111 琥珀样式在 prod 监控页可用); 爬虫后端gate+API已上prod/opt(PR#12@15c2ba3). 2条水合proposed-learnings待ack
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

## Backlog — 路线图(波4 BL-107 已转 BUILDING 见顶部 = split-brain 路线图收官)
- **BL-112**(中): 真 AI 语义搜索 /match ?ai=(接现成 runSemanticKolSearch 引擎到UI, 用户决M7单开批次; 波4已止血保留引擎)
- 其余：BL-095 / BL-089 / BL-058 / BL-048 / BL-011 等详见 backlog.json

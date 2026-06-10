---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-099-email-template-asset-unification VERIFYING (5/6 generator done, F006 Codex 待验) — ADR-011 迁移收尾, 统一 Asset 单一真相源
- 决策 ADR-018(C: email_log 去FK+template_name 快照, drop email_template) + 一次到位(用户 2026-06-09). spec docs/specs/BL-099-*.md
- ✅ F001-F004 done + **已部署 prod @ 5d83f68**(2026-06-10 Generator Kimi SSH deploy-prod.sh, healthcheck绿): F001写路径统一Asset(published止血) / F002迁移脚本 / F003 email_log快照列+解耦FK(migration 20260609130000已apply prod) / F004 analytics读快照去join
- ✅ **F002 prod --execute 已跑+验证零丢失**(2026-06-10): 17条user email_template全部已在Asset(16 published+1 draft匹配), 0新建. SQL实证每行has_asset=t. ⚠️LOSS是脚本只数published的误报. **DROP email_template零用户数据丢失确认**
- ✅ **F005(删双写+DROP email_template表) done+CI绿@7999041+已部署 staging@bff060d + prod@bf32047**(2026-06-10): 两环境 migrate deploy 跑通, email_template DROPPED(to_regclass null), prod 非系统published email asset=16 与drop前完全一致(零丢失再确认)+10 system_seed完好, prod pre-deploy备份 db-20260610-013749.sql.gz. 状态已切 **verifying**
- ⏭️ **F006 Codex 待验**: L1(lint/tsc/test) + L2 上线验证(工作区建模板→composer即现 / AI定制含system_seed / top快照名 / email_log.template_name / DB无email_template表+user零丢失) + signoff
- 坑沉淀: 本地vitest exclude tests/integration(testcontainers只CI跑); 本地DB migration历史漂移→migrate diff确认FK名手写migration; schema改动连带的integration断言失效(bm2-schema旧FK断言)只能CI抓
## ✅ BL-098 DONE (2/2, signoff 2026-06-09) — PROD 邮件AI定制'模板不存在' hotfix(Asset查询). ⚠️ **prod deploy 待手动触发**(BL-099 为其根治)
## ✅ BL-080 DONE (6/6, signoff @ docs/test-reports/BL-080-signoff-2026-06-09.md) — 落地页 AI 插画(8张)替video+动画; Lighthouse perf99/LCP870/CLS0; staging部署
- ⚠️ prod 部署待手动触发(让访客见新插画落地页); dead i18n key beforeAfter.{colTask/colBefore/colAfter/rows}(可并 BL-070)
## ✅ BL-097 DONE (2/2) — 监控页导航入口(UserAvatarMenu admin段, 部署@04e5414)
## ✅ BL-096 DONE (3/3, fix_rounds=1, signoff @ docs/test-reports/BL-096-signoff-2026-06-08.md) — 监控页 /admin/crawler-monitor 上线
- F001 /admin/stats 扩展(PR#11→392f154)实测: manual_seed inserted **2534**(BL-092 harvest 全 drain!)/ ytEmail queued1553 / refreshBacklog5711 / cost3.58 / balance240.85. F002 瘦客户端页+健康灯+recharts 部署@ccd80d5
## ✅ BL-092 DONE (3/3) — TikHub 充值后收口: refresh -85% + 2535投喂(+420 drain中) + BugA runtime触发(188) + 成本记账 ✅
- ⚠️ IG 仍 0 产出 → backlog BL-095(F005 节流未解决)

## ✅ BL-094(4/4) / BL-093(3/3) / BL-091(5/5) / BL-086(6/6) — 全部 DONE
- BL-086-F006 full: refresh -85% confirmed live + harvest 100% + cost accounting ✅
- BL-091-F001: BugA runtime trigger confirmed (188 new records) ✅

## 状态: 无进行中批次(BL-086/091/092/093/094 全 DONE)
- ✅ BL-088 已决(2026-06-08): 两项都不做(质量门不放宽 ~36条低性价比 + 2584 不硬删)。closed
## 用户手工待办
1. aigcgateway VM .git remote PAT(gho_*)轮换(安全)
## Backlog — 修复路线图(BL-099 done 后依次推进)
- 🔍 审计 docs/reviews/full-feature-chain-audit-2026-06-09.md + 路线图 docs/reviews/split-brain-remediation-roadmap-2026-06.md(用户 2026-06-09)
- **波0 插队 BL-108**(高): 爬虫暂停开关(监控页两层 toggle: 主全停所有抓取含manual_seed + 子仅refresh; ADR-019; 跨爬虫+kolmatrix两repo; 用户决BL-099后第一优先). spec docs/specs/BL-108-*
- **波1 快赢止血**: BL-104(/kols死链) + BL-103(/assets脏卡) + BL-102(kol_campaign accept口径) + BL-101止血(Reply空态)
- **波2 邮件发送异步化**: BL-100(真BullMQ+异步发送, >10收件人必超时) [+BL-101 inbound根治可选]
- **波3 campaign编辑UI补回**: BL-105(下层已齐, 接前端; 用户决:补回)
- **波4 链路收口**: BL-107(软删/tsvector/孤儿API/假AI搜索/ROI硬编码) + BL-106(KPI cron核实)
- **BL-095**(中): IG hashtag 0 产出深度排查 / BL-089 配置页 / BL-058 fork / BL-048 valueScore / BL-011 等(详见 backlog.json)

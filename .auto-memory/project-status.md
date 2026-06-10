---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-099-email-template-asset-unification REVERIFYING (fix_rounds=1) — ADR-011 迁移收尾, 统一 Asset 单一真相源
- 决策 ADR-018(C: email_log 去FK+template_name 快照, drop email_template) + 一次到位(用户 2026-06-09). spec docs/specs/BL-099-*.md
- ✅ F001-F005 done. F005 已部署 staging+prod, email_template DROPPED 两环境, prod 零用户数据丢失实证(16 user published 一致), prod 备份 db-20260610-013749.sql.gz
- 🔁 **F006 首轮 verifying 3 PASS/1 PARTIAL/1 FAIL**(Codex 2026-06-10): FAIL=composer 严格 product 谓词×campaign 默认筛选隐藏全部 productId=null 模板(新建模板 No matches); PARTIAL=prod 登录态 UI 缺已轮换凭据
- ✅ **fix-round 1 done @07e8b09**(Kimi 2026-06-10): reach/templateFilter.ts 纯模块 — OR-generic 语义+product 行分区在前(BL-031 DoD 口径)+picker cap 20→100(=COMPOSER_MAX_RESULTS). 回归测试 9个(旧谓词实证 4 fail). CI 绿+**staging deployed @07e8b09** SHA 对齐. 状态已切 **reverifying**
- ✅ **prod 已部署 @62c3114**(2026-06-10 用户授权, 备份 db-20260610-030321.sql.gz, health绿 SHA对齐) — 两环境均含修复. ⏭️ Codex 复验 acceptance ①; prod 登录态复验仍需用户给已轮换凭据
- 坑沉淀: BL-031 DoD 本要求 generic 在 product filter 下可见(严格谓词系 BL-026-F005 偏离); BL-031 spec §6 deploy-check 行127 是旧表述勿按其判 FAIL; staging health git_sha 需 X-Health-Token
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

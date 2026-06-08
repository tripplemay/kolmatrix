---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-098-email-customize-template-asset VERIFYING (1/2) — PROD 故障: 邮件 AI 定制'模板不存在'
- ✅ F001 done(Generator Kimi): 抽共享 `getEmailTemplateById`(src/lib/assets/queries.ts, 与 loadAssetsForComposer 同源查 Asset 表 type=email/published), reach/actions.ts:116 emailTemplate.findUnique→getEmailTemplateById. 回归测试3个+同步 customize-action.test.ts mock. L1全绿(lint/tsc/vitest 1545+build). staging deployed 对齐. 根因=ADR-011迁移遗留(仅line116)
- ⏭️ Codex F002: L1 + L2 部署后实测 Asset-only 模板'Clash Royale — Signing invitation' AI定制通+回归 + signoff. ⚠️ prod deploy 待用户手动触发修复 prod 故障
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
## Backlog
- **BL-099**(中): 邮件模板 ADR-011 迁移收尾(统一 Asset 真相源, 消 split-brain; BL-098 是 symptom). 审计 docs/reviews/email-template-feature-audit-2026-06-09.md: 10 system_seed Asset 无 email_template 镜像→AI定制全挂; 迁 analytics+孤儿工作区 reach/templates+处理 email_log FK+删双写
- **BL-095**(中): IG hashtag 发现 0 产出深度排查(BL-086 F005 350ms 节流未解决, 288ref+4hash 全 0)
- BL-090-cost / BL-089 配置页 / BL-058 fork / BL-048 valueScore / BL-011 等(详见 backlog.json)

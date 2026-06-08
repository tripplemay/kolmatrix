---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-080-landing-illustration-mockups VERIFYING (5/6) — 落地页 AI 插画替代真截图(挂起6/01→6/08恢复)
- ✅ F001-F005 全 done(Generator Kimi 2026-06-09). 用户 A1 lock 激进版: Hero 插画替换 video 背景, BeforeAfter 插画替换整个动画表格. 映射 library→feature-match/aiMatch→feature-brief/insight,reach,crm 同名/roi fallback/EmailCenter→email-center. fallback 守门 illustration-asset.ts. +3 illustrationAlt×5locale. woff2 去 outgoing_mail
- ✅ F004 next/image quality85/80+sizes+lazy+images.qualities. ✅ F005 Lighthouse 6门全过(/en perf99 LCP870 CLS0 TBT0 SEO92 a11y100; /zh /ja 同过)+ a11y 4项. baseline 用户决定保持现有4张(不扩80snap)
- ✅ CI 全绿. staging deployed(纯前端无schema/env变更). 坑: CI 跑全套 e2e+visual, 视觉改动 push 即红 → baseline 经 update-visual-baselines.yml 重拍(本批拍2次), bot token commit 不触发 CI 须手动 workflow_dispatch
- ⏭️ Codex F006: L1自动化5项 + L2 staging 视觉冲击力抽样 + signoff + 用户主观确认. ⚠️ e2e hero断言已由generator改(测试域复核); beforeAfter.{colTask/colBefore/colAfter/rows}成 dead i18n key
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
- **BL-095**(中): IG hashtag 发现 0 产出深度排查(BL-086 F005 350ms 节流未解决, 288ref+4hash 全 0)
- BL-090-cost / BL-089 配置页 / BL-058 fork / BL-048 valueScore / BL-011 等(详见 backlog.json)

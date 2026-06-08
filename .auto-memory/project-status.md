---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-080-landing-illustration-mockups BUILDING (1/6) — 落地页 AI 插画替代真截图(挂起6/01→6/08恢复)
- ✅ F002 插画就绪 8/8: 用户认可方向, **Planner 代生成**(aigc-gateway gemini-3-pro-image, 按 F001 8 prompts; 去hex+强无文字修泄漏, before-after 重做1次; gpt-image 太慢弃用). 真PNG放 `public/landing/illustrations/` 规范命名, 8/8 品牌一致(深navy+青+紫). 单张~0.85-1.36MB(略超1MB→F004处理)
- Generator 接: F002验收(brand/无大量text)→标done→F003集成(替换 HeroVideo/Features6/EmailCenterDemo/BeforeAfter 的 Image 引用+fallback+i18n alt)→F004 next/image+LCP(不regress BL-078 530ms)→F005 baseline重拍+a11y→F006 Codex. spec docs/specs/BL-080-*.md + prompts docs/specs/BL-080-illustration-prompts.md
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

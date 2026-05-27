<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-078-landing-visual-polish FIXING (4/6, fix_rounds=0) — perf/链路健康，但 contrast 真 fail
- Codex Reviewer 首轮 verifying FAIL，报告 `docs/test-reports/BL-078-verifying-2026-05-27.md`
- 匿名 landing staging Playwright 通过：root/locale/hero/video/CTA 链路 `7 passed`
- Chromium + WebKit + Firefox reduced-motion/5-locale matrix 通过：zh/en/ja/ko/es hero 可见、CTA href 正确、无横向溢出、reduced-motion 下 video paused
- Lighthouse `/zh` perf 通过：performance `0.98` / LCP `617ms` / CLS `0` / TBT `0ms`
- 真 blocker 是 contrast：Lighthouse accessibility 虽 `0.96`，但 `color-contrast` score=`0` 且命中 `13` 个元素，不止 decorative parallax；命中包括 BeforeAfter 文案、Features eyebrow `六大模块`、Demo 正文等非装饰文本
- 这直接违反 F005 `contrast: WCAG AA` 和 F006 `a11y keyboard nav + contrast 抽样`
- F005 已退回 pending；下一步由 Generator 提升文本对比度后再切 `reverifying`
## ✅ BL-077-v0.9.24-framework-sediment DONE (9/9, fix_rounds=0, tag bl077-done @ 0fc8abf) — v0.9.24 framework sediment batch 终签完成
- Codex Reviewer 终签 PASS：L1 通过 `npm run lint` = 0 errors / 3 baseline warnings、`npx tsc --noEmit` PASS、17 source IDs 全部 grep 到 framework/harness/*.md、`framework/proposed-learnings.md` 保留 v0.9.24 marker、archive v0.9.24 = 817 LOC、CHANGELOG v0.9.24 段存在
- signoff: `docs/test-reports/BL-077-signoff-2026-05-27.md`
## ✅ BL-076-apify-numeric-overflow DONE (5/5, fix_rounds=2) — numeric overflow hotfix 终签完成
- signoff: `docs/test-reports/BL-076-signoff-2026-05-27.md`
## ✅ BL-075-kol-data-coverage DONE (7/7, fix_rounds=1) / BL-074-ia-v2 DONE (6/6, fix_rounds=0, tag bl074-done @ 6bc881d) / BL-073-prod-hotfix DONE (8/8, fix_rounds=2, tag bl073-done @ 433047d) / BL-072-prod-hotfix DONE (8/8, fix_rounds=1, tag bl072-done @ bc24e09)
## ✅ BL-071 DONE (10/10, fix_rounds=1, tag bl071-done @ 99c43fc) — framework v0.9.23 闭环
## ✅ BL-070 DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 + 对外上线 ready
## ✅ BL-069/068/067/066/065/064/063/061-060-059/012/055-052-051a-049/021+023/043+044 全 DONE
## 关键决议（已 lock）
- 5/27 BL-078 plan v2 + D1-D3 全 lock (D1 现代极简 Linear+Plausible / D3 全栈现代化 view transitions + scroll-driven + IntersectionObserver fallback)
- 5/26 BL-072/073/074/075 done (4 P1 prod hotfix + 5 路由 IA + KOL data coverage)
- 5/26 prod deploy 至 c428797
## 用户手工待办
1. 5/17 weekly growth-curve check
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops:** 24h 后跑 ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh' + 邀 ≥5 marketer dogfood
4. prod 实测 5/27 BL-073/074/075 fix 用户体验
## 角色 / Backlog (BL-078 verifying 中)
- BL-078 done 后 prod deploy 让用户实测视觉精修效果
- StickyParallax opacity-40 + BeforeAfter opacity-50 inactive contrast (pre-existing decorative parallax, BL-078 之外) — 评估新批次跟进
- v0.9.25 framework sediment batch (BL-078 4 沉淀候选累积)
- Phase 5：个性化学习 / AI 偏好学到 / Brief 模板库 / comparative query / skip-replace 写 DB
- 真客户 onboarding：db:seed 验证 + tenant cleanup + 监控仪表板
- BL-054 (medium) flaky network test isolate / BL-048 (low) valueScore 公式区分度优化

<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-080-landing-illustration-mockups BUILDING (0/6, fix_rounds=0) — BL-078 视觉精修 v2 AI illustration 替代真截图
- A0+A1 完成 5/27: 4 子决策全 lock (极重度 / AI gen / 全量 8 张 / Generator prompt template)
- F001 Generator 出 8 detailed AI prompts (2h) → F002 用户跑 DALL-E/MJ/SD 生成 PNG (0.5-1 day critical path 外部) → F003 Generator 集成 4 components + fallback 守门 (3h) → F004 next/image 优化 (1.5h) → F005 baseline + Lighthouse + a11y (1.5h) → F006 Codex Reviewer (1.5h)
- 总 ~10h Generator + 0.5 day Reviewer + 用户 AI gen 0.5-1 day = 全闭环 1.5-2 day
- BL-078 不变量延续: 不动结构/文案/业务路径 + LCP/CLS perf 守门 + brand consistency (navy + cyan/purple)
- 关联: docs/specs/BL-080-landing-illustration-mockups-spec.md + BL-078 baseline (perf 0.99 a11y 1.0) 不 regress
## ✅ BL-079-v0.9.25-framework-sediment DONE (6/6, fix_rounds=0, tag bl079-done @ a964b70) — v0.9.25 framework sediment batch 终签完成 (第 4 个 one-shot pass)
- Reviewer verifying PASS: `docs/test-reports/BL-079-signoff-2026-05-28.md`
- L1 通过: lint `0 errors / 3 warnings`, tsc PASS, source ID grep `#1-#5` 全命中, archive `233 LOC`, CHANGELOG v0.9.25 `47 LOC`
- L2 抽样通过: evaluator §11.6 motion a11y 三件套 / generator §18 现代 CSS 渐进增强 / CHANGELOG↔archive 5 候选 1:1 对应 + `#1+#5` 合并标注一致
- `framework/proposed-learnings.md` 已清 5 条 BL-078 候选并保留 `v0.9.25` completion marker
- 0 chronological-append §N / 0 业务代码改动, 延续 BL-077 sediment 模式
## ✅ BL-078-landing-visual-polish DONE (6/6, fix_rounds=1, signoff @ fb34b09) — landing 视觉精修终签完成
- Reviewer reverifying PASS: `docs/test-reports/BL-078-signoff-2026-05-27.md`
- staging `/zh` Lighthouse Desktop logged-out 复核通过: perf `0.99` / a11y `1.0` / LCP `530ms` / CLS `0` / TBT `0ms` / `contrastCount=0`
- staging landing Playwright 通过: 匿名根路由/locale/hero/CTA/request-access 链路 `7 passed`
- Chromium/WebKit/Firefox + `prefers-reduced-motion=reduce` 下 `zh/en/ja/ko/es` spot check 通过, 无横向溢出, CTA href 保持正确
- keyboard nav / focus visible spot check 通过; fix-round 1 清掉上轮唯一 contrast blocker
## ✅ BL-077-v0.9.24-framework-sediment DONE (9/9, fix_rounds=0, tag bl077-done @ 0fc8abf) — v0.9.24 framework sediment batch 终签完成
- signoff: `docs/test-reports/BL-077-signoff-2026-05-27.md`
## ✅ BL-076-apify-numeric-overflow DONE (5/5, fix_rounds=2) — numeric overflow hotfix 终签完成
- signoff: `docs/test-reports/BL-076-signoff-2026-05-27.md`
## ✅ BL-075-kol-data-coverage DONE (7/7, fix_rounds=1) / BL-074-ia-v2 DONE (6/6, fix_rounds=0, tag bl074-done @ 6bc881d) / BL-073-prod-hotfix DONE (8/8, fix_rounds=2, tag bl073-done @ 433047d) / BL-072-prod-hotfix DONE (8/8, fix_rounds=1, tag bl072-done @ bc24e09)
## ✅ BL-071 DONE (10/10, fix_rounds=1, tag bl071-done @ 99c43fc) — framework v0.9.23 闭环
## ✅ BL-070 DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 + 对外上线 ready
## ✅ BL-069/068/067/066/065/064/063/061-060-059/012/055-052-051a-049/021+023/043+044 全 DONE
## 关键决议（已 lock）
- 5/27 BL-078 plan v2 + D1-D3 全 lock (D1 现代极简 Linear+Plausible / D3 全栈现代化 view transitions + scroll-driven + IntersectionObserver fallback)
- 5/27 BL-078 F005 fix-round 1 沉淀: opacity-based dimming 在 WCAG AA contrast 上 fragile (parent opacity × text alpha 双重 dimming kills contrast); 改用 color hierarchy 4 重 distinction (icon scale + color + cell color + progress fill) 替代 opacity-50 inactive dim
- 5/26 BL-072/073/074/075 done (4 P1 prod hotfix + 5 路由 IA + KOL data coverage)
- 5/26 prod deploy 至 c428797
## 用户手工待办
1. 5/17 weekly growth-curve check
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops:** 24h 后跑 ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh' + 邀 ≥5 marketer dogfood
4. prod 实测 5/27 BL-073/074/075 fix 用户体验
## 角色 / Backlog (BL-079 verifying 中, BL-080 排队)
- ★ **BL-080 landing illustration mockups (5/27 plan + 4 子决策全 lock)** — AI 生成 ~8 张 illustration 替代真截图, 用户跑 DALL-E/MJ/SD + Generator 提供 8 detailed prompt templates + 集成. ~10h Generator + 用户 0.5-1 day AI gen. 依赖 BL-079 done.
- Phase 5：个性化学习 / AI 偏好学到 / Brief 模板库 / comparative query / skip-replace 写 DB
- 真客户 onboarding：db:seed 验证 + tenant cleanup + 监控仪表板
- BL-054 (medium) flaky network test isolate / BL-048 (low) valueScore 公式区分度优化

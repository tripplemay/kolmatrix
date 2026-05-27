<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔎 BL-078-landing-visual-polish VERIFYING (5/6, fix_rounds=0) — Generator F001-F005 完成，Reviewer L1+L2 + signoff 待
- 6 commits 推 main: b24b736 F001 token + design-draft / fc30524 F002 Hero+TopNav + view transitions + mesh gradient + landing-cta-primary/secondary / 7f291e2 F003a PainPoints+Features + landing-card-light + icon-halo / 6493d29 F003b BeforeAfter+EmailCenterDemo / 1c8cdd0 F004 Trust+FAQ+FooterCTA+SectionTransition + FAQ smooth-height (interpolate-size 渐进增强) / 384531e F005-a11y-fix (ink-muted 70→78%, ink-subtle 52→60%)
- update-visual-baselines.yml 跑 2 次 (df5585b + 55c5180 fix-round)；staging deploy 3 次 → 当前 staging git_sha = 384531e (re-deploy 后)
- **Lighthouse Desktop logged-out staging /zh (384531e):** perf 0.94 ✓ / a11y 0.96 ✓ / LCP 1077ms ✓ / CLS 0 ✓ / TBT 0ms ✓ / SEO 0.58 ✗ (staging noindex+robots disallow+canonical 缺失, 全 staging-only intentional)
- a11y 0.96 ≥ 0.90 spec ✓；color-contrast=0 单项 13 elements: 主因 StickyParallax opacity-40 inactive callouts + BeforeAfter opacity-50 inactive rows (pre-existing 视觉机制 decorative parallax, out-of-scope per BL-078 仅视觉精修)；Reviewer 评估是否新批次跟进
- L1 PASS: lint 0 errors / 3 baseline warnings (不变) / tsc clean / npm test 189 files 1375 tests PASS
- 0 业务代码改动 / 11 components 数量/文件名/data-testid 全保留 / CTA href + i18n key 0 改 / E2E landing.spec.ts 链路覆盖 unchanged
- **Reviewer L2 待执行 (per F006):** Lighthouse 复跑 (5 locale spot check) / a11y 手动 verify (Tab keyboard nav + contrast 抽样 + aria) / 5 locale text overflow ja+ko 验关键 sections / Browser matrix Chrome 115+ + Safari 18+ + Firefox latest (view-transition + scroll-driven fallback 实测) / prefers-reduced-motion / 设计参照 Linear+Plausible 精神落地主观评判 / signoff doc docs/test-reports/BL-078-signoff-2026-05-XX.md
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

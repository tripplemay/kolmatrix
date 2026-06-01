---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-081-kol-country-data-fix PLANNING→building (0/6, fix_rounds=0) — KOL country mapper bug + silent retry storm 修复
- 6/01 Planner Kimi 5 维 audit 发现根因: (R1) `apify-kol.ts:438` mapper 硬编码 country=null 丢 fork location (YT 596/716=83% 真值) (R2) 注释过时 (R3) `enrichment-stage.ts:283` WHERE 无 attempted_at → LLM 返 null 不写 DB → silent retry storm (97% KOL 每日重扫, cap 截 500/天) (R4) refresh=0 7 天独立调查
- A1 lock: P0+refresh audit / i18n-iso-countries lib / TT+IG 继续 LLM + attempted_at 一次性
- 6 features: F001 mapper+normalize / F002 migration / F003 enrichment-stage / F004 refresh audit / F005 staging+prod backfill / F006 Codex
- 预期 aigcgateway 500/天 → <200/天, 省 $109/年; 治本 KOL 池 10K+ 不成本爆炸
- 关联 docs/specs/BL-081-kol-country-data-fix-spec.md
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6, fix_rounds=0, @ ad14bdd) — 用户决定先做 BL-081 / 等用户 F002 AI gen PNG
- 归档: docs/archive/paused-batches/BL-080-{progress,features}.json + RESUME.md
- Resume trigger: 用户通知 `public/landing/illustrations/` ≥6/8 PNG 就绪
## ✅ BL-079-v0.9.25-framework-sediment DONE (6/6, tag bl079-done @ a964b70)
## ✅ BL-078-landing-visual-polish DONE (6/6, fix_rounds=1, signoff @ fb34b09) — perf 0.99 / a11y 1.0 / LCP 530ms baseline (BL-080 不得 regress)
## ✅ BL-077/076/075/074/073/072/071/070/069/068/067/066/065/064/063/061-060-059/012/055-052-051a-049/021+023/043+044 全 DONE
## 关键决议（已 lock）
- 5/27 BL-078 plan v2 + D1-D3 全 lock (D1 现代极简 Linear+Plausible / D3 view transitions + scroll-driven)
- 5/27 BL-078 F005 沉淀: opacity dim 在 WCAG AA fragile → color hierarchy 4 重 distinction 替代
- 5/26 prod deploy 至 c428797
## 用户手工待办
1. 5/17 weekly growth-curve check
2. fork 上游待修: Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. BL-070 post-launch ops: 24h 后 ssh prod bash bl070-prod-audit.sh + 邀 ≥5 marketer dogfood
4. prod 实测 BL-073/074/075 fix; BL-081 done 后找爬虫团队对账 5/27+5/31 fork 0-discover
## Backlog
- BL-080 (paused, 等用户 F002) — landing illustration AI gen
- refresh-selector fix (BL-081 F004 audit 后立独立批次)
- Phase 5: 个性化学习 / Brief 模板库 / comparative query
- BL-054 flaky network test isolate / BL-048 valueScore 区分度

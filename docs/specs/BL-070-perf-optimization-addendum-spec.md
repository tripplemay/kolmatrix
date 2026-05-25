# BL-070 Perf Optimization Addendum — Spec（fix-round 2 / F008 #8 blocker）

> **起草：** 2026-05-25 北京 / Planner Kimi
> **状态：** Drafted（用户 2026-05-25 ack 方案 A — 全 3 feature 都做）
> **批次类型：** BL-070 批次内 fix-round 2（不开新 batch）— 全部 `executor: generator`
> **优先级：** P0（F008 §10 checklist #8 唯一 FAIL；对外上线 ready 硬阻塞）
> **预估工时：** 2~4 day Generator + 0.5 day Reviewer 复验
> **依赖：** BL-070 F001-F007 done ✅ + F008 partial（5/12 checklist FAIL #8 perf）
> **关联：** `docs/specs/BL-070-reach-insight-cleanup-spec.md`（母 spec）/ `docs/test-reports/BL-070-signoff-2026-05-19.md` §4 #8 / `docs/test-reports/BL-070-staging-spot-check.md` §8

---

## §1 背景

BL-070 F008 §10 12 项对外上线 checklist 复验，第 8 项 **Lighthouse performance ≥80** 在 4 个 IA 路由本地登录态实测全 FAIL：

| 路由 | 实测 perf score | 门槛 | 差 |
|---|---|---|---|
| /brief | 78 | ≥80 | -2 |
| /match | 75 | ≥80 | -5 |
| /reach | 75 | ≥80 | -5 |
| /insight | 75 | ≥80 | -5 |

a11y 已过（96/95/97/91 ≥90），其他 11 项 checklist 已 PASS 或 PENDING（dogfood / 24h audit），唯一硬阻塞为 perf。

### Audit 结论：3 类根因（Planner 2026-05-25 摸排）

| 类别 | 影响 metric | 现状 | 收益估算 |
|---|---|---|---|
| A. JS bundle 重 | TBT ↑ | 4 IA 路由 `next/dynamic` 0 使用；`/reach` 同步 import 38.9KB OutreachComposer + 8 兄弟；`/match` page.tsx 同步 import 13 client 组件；`/brief` `/insight` tab 切换不解开未活 tab 的 JS | +5~10 |
| B. Image 未优化 | LCP + CLS ↑ | 9 处 raw `<img>` 跳过 `next/image`（含 KOL avatar / recent replies / weekly-report brand / AI rec panel / CRM recent changes / kols/[id]）；无 explicit width/height | +2~5 |
| C. SSR 首屏阻塞 | LCP ↑ | `/match` 4 并发 DB call、`/reach` 6 并发；首屏阻塞至全部完成，stats/savedSearches/topTemplates 可 Suspense defer | +2~3 |

合粗估 +10~20 分 → 75 → 85~95 区间。

### 已到位（无需重做）

- `next.config.ts` `optimizePackageImports: ["recharts","@base-ui/react"]`
- `next.config.ts` `formats: ["image/avif","image/webp"]`
- `next.config.ts` `images.remotePatterns` 已 whitelist YouTube + Stitch CDN
- `serverExternalPackages` 已隔离 prisma/bcrypt/googleapis/resend

---

## §2 范围（3 features，全部 executor: generator）

### F009 — JS bundle 拆 chunk（TBT 攻关）

**Executor:** generator
**Priority:** high
**Estimated hours:** 12.0

**Acceptance：**

- `/reach` page.tsx：把 `OutreachComposer`（38.9KB 源）+ `SendingPerformanceChart`（recharts）+ `RecentRepliesCard` + `RecentlySentTable` + `TopTemplatesCard` 改为 `next/dynamic({ssr: false})` 懒载（保留 `OutreachQuickStats` 同步以保 LCP）。OutreachComposer 加 loading 占位高度匹配最终高度（防 CLS）
- `/match` page.tsx：按 `?view=` 分支懒载 `MatchKolTable` vs `MatchKolCard`（table view 不下载 card code，反之亦然）；`AddToCampaignDialog` `ConfirmDeleteDialog` `MatchRefineBar` `AiSuggestionsSidebar` 按需 `next/dynamic`（dialog 类组件懒载到点击触发；refine/sidebar 只在 `campaignId` 解析成功时挂载，符合 dynamic 语义）
- `/brief` page.tsx：按 `tab` 分支懒载 — `tab=campaign` 不导入 `ProductListPanel` 链路（含 `ProductCard` `ProductModal` `ProductsClient`）；`tab=products` 不导入 `BriefPageClient` 链路（含 `CampaignForm` `BriefAiInputBar`）。两 tab 各自首屏不应下载另一 tab 的 client JS
- `/insight` page.tsx：按 `tab` 分支懒载 — `tab=reports` / `tab=analytics` 不导入 `DashboardContent`；`tab=dashboard` 是默认 tab 可保同步以保 SSR LCP
- **量化 Acceptance（Lighthouse desktop, 本地登录态 marketer.json）**：4 路由 TBT < 200ms each；perf score ≥80 each；不引起 a11y 回归（仍 ≥90）
- 单测：现有 routes' unit / e2e 不破坏（所有 page-level 行为不变，仅 import 形式改）；新增 ≥1 case 验 tab 切换前后 client bundle 差异（用 `@next/bundle-analyzer` 或对比 webpack stats）
- L1 PASS（typecheck + lint + vitest 全集）
- staging git_sha 与本 commit 一致

---

### F010 — Image 优化（LCP + CLS 攻关）

**Executor:** generator
**Priority:** high
**Estimated hours:** 6.0

**Acceptance：**

- 替换 9 处 raw `<img>` → `next/image`（清单）：
  1. `src/app/[locale]/(app)/match/MatchKolCard.tsx:55` — KOL avatar
  2. `src/app/[locale]/(app)/match/MatchKolTable.tsx:164` — KOL avatar
  3. `src/app/[locale]/(app)/crm/CrmRecentChanges.tsx:91` — KOL avatar
  4. `src/app/[locale]/(app)/reach/RecentRepliesCard.tsx:64` — reply sender avatar
  5. `src/app/[locale]/(app)/reach/RecentlySentTable.tsx:94` — recipient avatar
  6. `src/app/[locale]/(app)/insight/weekly-report/WeeklyReportBrandHeader.tsx:72` — brand logo
  7. `src/app/[locale]/(app)/kols/[id]/page.tsx:166` — KOL avatar
  8. `src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx:772` — KOL avatar
  9. `src/app/shared/weekly-report/[token]/page.tsx:147` — brand logo（公开报告页，影响也算 IA 范围 weekly-report）
- 每处加 explicit `width`/`height` props 或 `fill` + `sizes`（KOL avatar 推荐 `width={40} height={40}` 或 `fill` + `sizes="40px"`）
- 移除 9 处对应 `// eslint-disable-next-line @next/next/no-img-element`
- 任何外部 CDN domain 若不在 `next.config.ts` `images.remotePatterns` 内，需补全 whitelist（当前 whitelist：i.ytimg.com / yt3.ggpht.com / yt3.googleusercontent.com / stitch.withgoogle.com — 若 BL-070 4 路由真实数据出现 TikTok/Twitch CDN，需新增 remotePattern 并注释来源）
- **量化 Acceptance（Lighthouse desktop, 本地登录态）**：4 路由 CLS < 0.05 each；LCP < 2.5s each；不引起视觉 baseline 回归（如有差异，跑 `update-visual-baselines.yml` 重 gen + 加 commit message 注明 "F010 next/image 视觉漂移 regen"）
- 单测：现有 KOL 卡片 unit/e2e 不破坏；视觉 baseline 通过（含 regen 路径）
- L1 PASS
- staging git_sha 与本 commit 一致

---

### F011 — SSR Suspense stream（LCP 攻关）

**Executor:** generator
**Priority:** medium
**Estimated hours:** 8.0

**Acceptance：**

- `/match` page.tsx：把 `runMatchSearch`（主表）保持顶层 await；`loadDatabaseStats`（KPI strip）+ `savedSearches`（侧栏）改为 `<Suspense fallback={<QuickStatsSkeleton/>}>` + `<Suspense fallback={<SavedSearchControlsSkeleton/>}>` 包裹的 async server component 子节点。`campaign` lookup 保留顶层 await（影响后续 sidebar mount 判断）
- `/reach` page.tsx：把 `loadOutreachComposerData`（composer 主体）+ `runEmailQuickStats`（顶部 KPI）保持顶层 await；`runSendingPerformance30d`（chart）+ `runTopTemplates` + `runRecentReplies` + `runRecentlySent` 改为 Suspense + skeleton
- 实装最小 skeleton 组件（共用 `<div className="glass-panel animate-pulse">`），高度匹配实际组件防 CLS
- `/brief` `/insight` 不变（SSR 数据流较轻，无明显收益）
- **量化 Acceptance（Lighthouse desktop, 本地登录态）**：4 路由 FCP < 1.5s each；LCP -300ms vs F008 baseline（实测前后对比，写入 signoff 报告）；TTFB 不退化
- 单测：现有 page-level e2e 不破坏（loading state 短暂出现可能影响 `expect(visible)` 时序 → 用 `waitFor` 包裹）
- L1 PASS
- staging git_sha 与本 commit 一致

---

## §3 验收口径（Reviewer L2 复验关键点）

### 3.1 Lighthouse 复测协议

- 工具：Chrome DevTools Lighthouse（latest，与 F008 首测同口径）
- 模式：Desktop + Logged-in（用 `playwright/.auth/marketer.json` 登录后开 DevTools）
- 节流：默认 Lighthouse Desktop preset（10ms/0ms throttling, slow 4G→fast 4G）
- 路由：`/en/{brief,match,reach,insight}` 4 路由 each
- 跑 3 次取中位数（Lighthouse 自身波动 ±3 分）
- 写入 `docs/test-reports/BL-070-perf-addendum-2026-05-XX.md` — 12 个 cell（4 路由 × 3 次跑）+ 中位数 perf score

### 3.2 量化门槛

| Metric | 门槛 | 来源 |
|---|---|---|
| perf score | ≥80（理想 ≥85） | spec §10 #8 |
| TBT | < 200ms | Lighthouse Desktop preset 推荐 |
| LCP | < 2.5s | Lighthouse Desktop preset 推荐 |
| CLS | < 0.05 | F010 acceptance |
| FCP | < 1.5s | F011 acceptance |
| a11y score | ≥90（不回归） | spec §10 #7 |

### 3.3 视觉 baseline

- F010 替换 `<img>` → `next/image` 可能漂移视觉 baseline（avif/webp 格式 + 优化路径）
- 若漂移，跑 `gh workflow run update-visual-baselines.yml` regen + bot commit baseline + ci.yml workflow_dispatch trigger CI 一次
- Reviewer 验：新 baseline 与 4 IA 路由 chrome 视觉一致（无控件位移/缺失）

---

## §4 关键决策点（Planner 2026-05-25 lock）

| # | 决策 | 用户 ack | 备注 |
|---|---|---|---|
| 1 | F009/F010/F011 全做（方案 A） | 2026-05-25 | 用户回 "A" |
| 2 | 不开新 batch，BL-070 fix-round 2 内承载 | Planner 默认 | F008 §10 #8 是本批次 acceptance 内的 FAIL，属本批次 fix 范围 |
| 3 | F009 是单点最大杠杆，优先级 high | Planner 默认 | TBT 是 perf score 权重最高 |
| 4 | F010 配合 `images.remotePatterns` 当前 whitelist 足够（YT + Stitch） | Planner 默认 | 实际数据中 TikTok/Twitch CDN 暂未出现；如出现需补 whitelist |
| 5 | F011 留 Suspense skeleton 实装为后备杠杆 | Planner 默认 | 若 F009 + F010 后 perf 已过 80 实测，F011 可不必紧 push；但用户 ack 全做，按 high acceptance |
| 6 | dogfood 与 24h audit checklist 在 F009-F011 全过后继续 | Planner 默认 | F009-F011 完成 → Reviewer L2 复验 → 用户重新触发 prod deploy → §9 dogfood + #10 24h audit → 终签 |

---

## §5 不变量（Generator 落地必查）

1. **不改业务逻辑** — 仅动 import 形式 + Image 包装 + Suspense 包装。任何 page-level e2e 行为不变（含 router/path 不变 / data flow 不变 / form behavior 不变 / a11y label 不变）
2. **不破坏现有 e2e** — 全 e2e suite 必须仍过；如 Suspense 引入 loading state 时序问题，加 `waitFor` 而非改 acceptance 期望
3. **不破坏视觉 baseline** — F010 如必然漂移走 regen 路径，commit message 注明根因
4. **不引入新 cost** — F009/F010/F011 都不调 AI / 不动 DB query；预期 0 incremental aigcgateway cost
5. **next/dynamic ssr:false 谨慎用** — 仅对真客户端独占组件（dialog/composer/chart），server component 不可包；如组件本身已 'use client' 且无 SSR 需求才用 `ssr: false`
6. **next/image 必有 width/height 或 fill+sizes** — 缺失会触发 CLS 或 build warning，硬性
7. **5 locale 不动** — 本批次纯 perf，不动 i18n keys
8. **commit-tag 与 features.json 对齐** — `feat(BL-070-F009): ...` / `feat(BL-070-F010): ...` / `feat(BL-070-F011): ...`（per harness 铁律 #10）
9. **JSON 写入后必校验** — features.json / progress.json 修改后 `python3 -c "import json; json.load(open('<file>'))"` 校验（per harness 铁律 #11）
10. **staged 索引校验** — commit 前 `git diff --cached --name-only` 确认（per harness 铁律 #12）

---

## §6 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| F009 拆 chunk 后 client navigation 中转 page 闪烁（hydration mismatch） | 中 | 用 `next/dynamic loading` 选项 + skeleton 与最终高度一致；e2e 验 mount sanity |
| F010 next/image 在 KOL CDN 上失败（403 / hot-link 拒绝） | 低 | YT 已 whitelist 充分；若失败，回退 `<img>` + 标 TODO+CDN bypass cookie 模式（参考 ADR-009 备选） |
| F011 Suspense fallback 在 marketer 视感上显得"加载更久" | 中 | skeleton 设计与最终高度+边距一致；用 cn shimmer 类 polish |
| Lighthouse 测试本身波动大（±3 分） | 高 | 3 次跑取中位数；同时记录 TBT/LCP/CLS metric 而非只看 score |
| 视觉 baseline 28 张大幅漂移 | 中 | 跑 update-visual-baselines.yml 重 gen + Reviewer 视觉 sanity 验 |
| F009 拆 chunk 后初次 paint 反而慢（chunk 加载延迟 > eager bundle 收益） | 低 | 建议 `loading: () => <Skeleton/>` + 监 LCP 是否退化；若退化，缩小 dynamic 范围 |

---

## §7 cost 估算

| 项 | 数 |
|---|---|
| aigcgateway 调用 | 0 incremental（F009/F010/F011 全为前端优化，不调 AI） |
| staging deploy | 1~3 次（每 feature 完成 push 一次或合并 push） |
| prod deploy | 1 次（F009-F011 全过后用户 ack 再触发） |
| Reviewer L2 复验工时 | ~0.5 day |
| Lighthouse 复测耗时 | ~30 min（4 路由 × 3 跑 + 写报告） |

---

## §8 下一步（state machine 转换）

1. `progress.json` `status: reverifying → fixing`，`fix_rounds: 1 → 2`，`total_features: 8 → 11`
2. `features.json` 追加 F009 / F010 / F011
3. commit + push（触发 CI 但 status 字段不破坏 build）
4. Generator 接手 fix-round 2，按 F009 → F010 → F011 顺序实装（次序可调，但 F009 是最大杠杆建议先做）
5. 完成全 3 feature 后 Generator 切 `status: fixing → reverifying`
6. Reviewer L2 复验 Lighthouse 指标 + 续 F008 §9 dogfood + #10 24h audit
7. 全 PASS → `status: reverifying → done` → BL-070 done = Phase 4 完整 done = 对外上线 ready

---

## §9 备注

- 本 spec 是 BL-070 母 spec 的 addendum，不替代；母 spec `docs/specs/BL-070-reach-insight-cleanup-spec.md` §3 8 features 不变，本 addendum 仅追加 F009/F010/F011 三条
- F008 §10 checklist 表格在 `docs/test-reports/BL-070-signoff-2026-05-19.md` §4 — F009-F011 完成后该 #8 cell 应翻 PASS
- v0.9.23 候选沉淀（Planner BL-070 done 阶段处理）已累积，本 addendum 引入新经验也将入 v0.9.23（如 next/dynamic 在 ssr:false 模式踩坑，或 next/image migration 套路化）

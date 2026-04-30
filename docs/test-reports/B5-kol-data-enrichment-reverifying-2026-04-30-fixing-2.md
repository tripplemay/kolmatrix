# B5-kol-data-enrichment Reverifying Report 2026-04-30 (fixing-2)

> 状态：**Evaluator 复验未通过**
> 触发：`progress.json` 当前阶段 `reverifying`，Reviewer 对 fixing-2 后的 B5 执行 L1 + L2 复验。

## 测试范围

- B5 fixing-2 后的 L1 本地复验
- B5 L2 staging 手工走查与 Playwright 探针
- 核对 staging 部署版本、登录后主路由、Discovery 高级筛选、KOL 详情页与多语言 key

## 使用的源文档

- `docs/specs/B5-kol-data-enrichment-spec.md`
- `docs/test-cases/B5-kol-data-enrichment-cases.md`
- `progress.json`
- `.auto-memory/environment.md`

## 覆盖摘要

- L1：PASS
- L2 主路由：PASS
- L2 Discovery 高级筛选：PASS
- L2 i18n spot check：PASS
- L2 KOL 详情页完整内容验收：FAIL

## 执行结果

### L1 PASS

- `npm run typecheck`
  - PASS
- `npm run test:unit -- tests/unit/b5-kol-detail-no-audience-tab.test.ts tests/unit/b5-no-double-write-metadata.test.ts`
  - 2 files / 5 tests PASS
- `npm run test:integration -- tests/integration/b5-discovery-filter-combinations.test.ts tests/integration/b5-topic-cloud.test.ts tests/integration/kol-discovery.test.ts tests/integration/import-kol-from-youtube.test.ts`
  - 4 files / 26 tests PASS
- `npm run lint -- 'src/app/[locale]/(app)/kols/[id]/TopicCloudCanvas.tsx' 'src/types/visx-wordcloud.d.ts' <B5 reviewer tests>`
  - PASS

### L2 PASS

- `curl -sS https://staging.kol.guangai.ai/api/health`
  - 返回 `git_sha: "cfd9c1e"`
  - 数据库检查 `ok`
- 登录 `marketer@kolmatrix.local / KOLM@2026!`
  - 成功进入 `/en/dashboard`
  - Dashboard KPI 可见
- 登录后主路由走查
  - `/en/dashboard` PASS
  - `/en/discovery` PASS
  - `/en/database` PASS
- Discovery 高级筛选
  - 默认折叠
  - 提交 `channelAge=veteran&uploadFrequency=active&regionGroup=asia` 后 URL 参数正确
  - Active filters 文案正确显示三项新维度
- i18n spot check
  - `zh`: `高级筛选` 可见
  - `ja`: `高度なフィルター` 可见
  - `ko`: `고급 필터` 可见
  - `es`: `FILTROS AVANZADOS` 可见

### L2 FAIL

- 抽样 5 个 YouTube KOL 详情页：
  - `e5fefed7-a115-4927-8957-b11eeb795ed3`
  - `c5cc40c5-4c1d-4052-816a-86bf54fbc4d0`
  - `a1194520-ce66-481a-8e38-5302dd14eb34`
  - `9ba6255c-af0b-458c-a33e-1a421236800f`
  - `96583bc7-943d-4b35-901d-7610c87fcd11`
- 5/5 结果一致：
  - `data-testid="kol-banner"` 不存在
  - `data-testid^="kol-recent-video-"` 数量 = `0`
  - `data-testid="kol-topic-cloud-canvas"` 不存在
  - `data-testid="kol-topic-cloud-empty"` 存在，文案为 `Topics being analyzed — check back after the next refresh.`
- 详情页其余结构已存在：
  - hero 存在
  - tabs 仅 `Overview / Collaboration history / Contact log / AI value analysis`
  - 未发现 audience tab

## 缺陷列表

### [High] KOL 详情页未呈现 B5 要求的核心新增内容

- 复现步骤：
  1. 登录 staging
  2. 打开 `/en/discovery`
  3. 取前 5 个 `data-kol-platform="youtube"` 的 KOL，逐个进入 `/en/kols/{id}`
- 观察到的行为：
  - 5/5 详情页均没有 banner section
  - 5/5 均没有 recent video tiles
  - 5/5 topic cloud 都只落 empty state，没有词云 canvas
- 影响：
  - B5 DoD 要求 staging KOL 详情页含 banner / 最近 6 视频 / 词云
  - 当前只能证明页面结构和空态存在，不能证明核心内容交付完成

### [Medium] staging `git_sha` 落后当前 `HEAD`，但差异仅为状态文件提交

- 证据：
  - 本地 `HEAD`: `43c292d`
  - staging health: `git_sha = cfd9c1e`
  - `git diff --name-only cfd9c1e..43c292d` 仅含 `progress.json`
- 影响：
  - 这次不是运行时代码差异，不是本轮 FAIL 主因
  - 但仍建议后续说明中明确 staging 对齐的是最后一个产品运行提交，而不是状态机提交

## 待确认问题

- 需要 Generator 确认：
  - `bannerUrl` 是否没有被 enrich 脚本写入 staging 数据
  - recent videos 为什么在 5 个 YouTube KOL 上都没有返回可展示项
  - topic cloud empty state 是否只是 recent videos 全空导致的级联结果

## 结论

- 本轮 `reverifying` 结论：**FAIL**
- 建议状态流转：`reverifying -> fixing`
- Generator 需要先处理：
  1. 修复 staging KOL 详情页 banner 缺失
  2. 修复 recent videos 全空
  3. 让至少一个稳定的 YouTube KOL 在详情页真实呈现 banner + recent videos + topic cloud
  4. 然后再回到 `reverifying`

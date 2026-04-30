# B5-kol-data-enrichment Reverifying Report 2026-04-30 (fixing-3)

> 状态：**Evaluator 复验未通过**
> 触发：`progress.json` 当前阶段 `reverifying`，Reviewer 对 fixing-3 后的 B5 执行 L1 + L2 复验。

## 测试范围

- B5 fixing-3 后的 L1 本地复验
- B5 L2 staging 手工走查与 Playwright 探针
- 核对 staging 健康、登录后主路由、Discovery 高级筛选、KOL 详情页与 topic cloud

## 使用的源文档

- `docs/specs/B5-kol-data-enrichment-spec.md`
- `docs/test-cases/B5-kol-data-enrichment-cases.md`
- `progress.json`
- `.auto-memory/environment.md`

## 覆盖摘要

- L1：PASS
- L2 登录 / dashboard / discovery / database：PASS
- L2 Discovery 高级筛选：PASS
- L2 详情页 banner / recent videos / audience tab：PASS
- L2 topic cloud canvas：FAIL

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
  - `database.status = ok`
- 登录 `marketer@kolmatrix.local / KOLM@2026!`
  - 成功进入 `/en/dashboard`
- 主路由走查
  - `/en/dashboard` PASS
  - `/en/discovery` PASS
  - `/en/database` PASS
- Discovery 高级筛选
  - 默认折叠
  - `channelAge=veteran&uploadFrequency=active&regionGroup=asia` 提交后 URL 参数正确
  - Active filters 文案正确显示三项新维度
- i18n spot check
  - `zh`: `高级筛选` 可见
  - `ja`: `高度なフィルター` 可见
  - `ko`: `고급 필터` 可见
  - `es`: `FILTROS AVANZADOS` 可见
- 白名单详情页抽样
  - `d74d2e5b-5a96-4ee1-9a91-6418c5345f35`
  - `acd99226-d92d-4afe-af40-7473d3abe2f7`
  - `e968589c-940a-4f22-be32-aba3c57c7cea`
  - `cf3f0330-a1e5-4eb8-b74c-d8760a48b9eb`
  - `61f005cb-1a78-438c-8566-4fefa1e10f7a`
- 5/5 详情页一致通过：
  - `data-testid="kol-banner"` 存在
  - `data-testid="kol-recent-videos"` 存在
  - `data-testid^="kol-recent-video-"` 数量 = `6`
  - `data-testid="kol-topic-cloud"` 存在
  - `data-testid="kol-topic-cloud-empty"` 存在
  - `data-testid="kol-topic-cloud-canvas"` 不存在
  - `audience` tab 未渲染
- 复访同一白名单 KOL 两次结果一致
  - `topic-cloud` 始终是 empty state
  - 没有出现 canvas

## 缺陷列表

### [High] topic cloud 仍未落地为可视化 canvas

- 复现步骤：
  1. 登录 staging
  2. 打开任一白名单 YouTube KOL 详情页
  3. 等待 recent videos 和 topic cloud 加载完成
  4. 重复进入同一详情页
- 观察到的行为：
  - `kol-banner` 存在
  - `kol-recent-videos` 存在且有 6 个缩略图
  - `kol-topic-cloud` 存在，但只显示 `Topics being analyzed — check back after the next refresh.`
  - `kol-topic-cloud-canvas` 始终不存在
- 影响：
  - B5 DoD 要求 staging KOL 详情页含完整版词云
  - 当前只证明了 topic cloud 容器和空态，未证明词云内容本身落地

## 待确认问题

- 需要 Generator 确认：
  - `loadTopicCloud()` 在 staging 上为何持续返回 empty state
  - `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` 是否仍未在 staging 生效
  - topic cloud 是否因为缓存 / action error / 关键请求体问题被短路

## 结论

- 本轮 `reverifying` 结论：**FAIL**
- 建议状态流转：`reverifying -> fixing`
- Generator 需要先处理：
  1. 让 topic cloud 真正产出 canvas，而不是长期 empty state
  2. 确认 staging 上 action / cache / env 三者的实际路径
  3. 然后再回到 `reverifying`

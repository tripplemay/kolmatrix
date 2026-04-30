# B5-kol-data-enrichment Reverifying Report 2026-05-01 (fixing-5)

> 状态：**Evaluator 复验未通过**
> 触发：`progress.json` 当前阶段 `reverifying` 后执行 L1 + L2 复验，结果回写为 `fixing`。

## 测试范围

- B5 fixing-5 后的 L1 本地复验
- B5 L2 staging 健康、登录、主路由、Discovery 高级筛选、白名单 KOL 详情页走查
- 核对 staging KOL 详情页是否稳定渲染 `banner / recent videos / topic cloud canvas / audience tab hiding`

## 使用的源文档

- `docs/specs/B5-kol-data-enrichment-spec.md`
- `docs/test-cases/B5-kol-data-enrichment-cases.md`
- `progress.json`
- `.auto-memory/project-status.md`
- `.auto-memory/environment.md`

## 覆盖摘要

- L1：PASS
- L2 健康 / 登录 / dashboard / discovery / database：PASS
- L2 Discovery 高级筛选：PASS
- L2 白名单详情页 banner / recent videos / no audience tab：PASS
- L2 topic cloud：PARTIAL PASS，4/5 样本出现 canvas，但 1/5 仍回落 empty state
- staging git_sha 与当前本地 HEAD 不一致：PASS 发现版本偏差，但这不是唯一阻塞点

## 执行结果

### L1 PASS

- `npm run typecheck`
  - PASS
- `npm run test:unit -- tests/unit/b5-kol-detail-no-audience-tab.test.ts tests/unit/b5-no-double-write-metadata.test.ts`
  - 2 files / 5 tests PASS
- `npm run test:integration -- tests/integration/b5-discovery-filter-combinations.test.ts tests/integration/b5-topic-cloud.test.ts tests/integration/kol-discovery.test.ts tests/integration/import-kol-from-youtube.test.ts`
  - 4 files / 26 tests PASS
- `npx eslint 'src/app/[locale]/(app)/kols/[id]/TopicCloudCanvas.tsx' 'src/types/visx-wordcloud.d.ts' 'tests/unit/b5-kol-detail-no-audience-tab.test.ts' 'tests/unit/b5-no-double-write-metadata.test.ts' 'tests/integration/b5-discovery-filter-combinations.test.ts' 'tests/integration/b5-topic-cloud.test.ts'`
  - PASS

### L2 PASS / PARTIAL

- `curl -sS https://staging.kol.guangai.ai/api/health`
  - `status: healthy`
  - `git_sha: 4d1057c`
  - `database.status = ok`
- 登录 staging
  - `marketer@kolmatrix.local / KOLM@2026!`
  - 成功进入 `/en/dashboard`
- 主路由走查
  - `/en/dashboard` PASS
  - `/en/discovery` PASS
  - `/en/database` PASS
- Discovery 高级筛选
  - 页面可用
  - 主流程未见阻塞
- 白名单详情页抽样
  - `d74d2e5b-5a96-4ee1-9a91-6418c5345f35`
  - `acd99226-d92d-4afe-af40-7473d3abe2f7`
  - `e968589c-940a-4f22-be32-aba3c57c7cea`
  - `cf3f0330-a1e5-4eb8-b74c-d8760a48b9eb`
  - `61f005cb-1a78-438c-8566-4fefa1e10f7a`
- 5/5 结果：
  - `kol-banner = 1`
  - `kol-recent-videos = 1`
  - `kol-recent-video-* = 6`
  - `kol-topic-cloud = 1`
  - `audience` tab 未渲染
  - 其中 4/5 样本 `kol-topic-cloud-canvas = 1`
  - 其中 1/5 样本仍 `kol-topic-cloud-empty = 1` 且 `kol-topic-cloud-canvas = 0`
- 复访该空态样本
  - 仍然只显示 `Topics being analyzed — check back after the next refresh.`
  - 说明这个空态不是偶发闪烁，而是可复现的稳定回退

## 缺陷列表

### [High] topic cloud 仍不稳定达成 DoD

- 复现步骤：
  1. 登录 staging
  2. 打开白名单 YouTube KOL 详情页
  3. 抽样多个白名单样本
  4. 其中至少 1 个样本仍只显示 empty state
- 观察到的行为：
  - 4/5 样本已经能渲染 `kol-topic-cloud-canvas`
  - 1/5 样本仍然只有 `kol-topic-cloud-empty`
  - 该样本复访后依旧不出 canvas
- 影响：
  - B5 DoD 要求 staging 详情页含完整词云
  - 当前结果只能算部分达成，不能签收

### [Medium] staging 版本与本地 HEAD 不一致

- 复现信息：
  - staging health 返回 `git_sha: 4d1057c`
  - 本地 `HEAD` 为 `883f620`
- 影响：
  - 不是本轮唯一失败点
  - 但会降低 staging 结论的可追溯性，需要 Generator / Planner 对齐部署口径

## 待确认问题

- 需要 Generator 解释：
  - 为什么同一批白名单里只有 1 个样本稳定落回 empty state
  - 词云空态是数据缺失、缓存命中，还是 action / persistence 路径分化
  - staging 的部署版本是否应与当前验收 commit 进一步对齐

## 结论

- 本轮 `reverifying` 结论：**FAIL**
- 建议状态流转：`reverifying -> fixing`
- Generator 下一步应先稳定 topic cloud 在白名单样本上的渲染结果，再进入下一轮复验

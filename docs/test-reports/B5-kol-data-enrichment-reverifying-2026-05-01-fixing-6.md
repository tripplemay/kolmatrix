# B5-kol-data-enrichment Reverifying Report 2026-05-01 (fixing-6)

> 状态：**Evaluator 复验未通过**
> 触发：`progress.json` 当前阶段 `reverifying`，Reviewer 对 fixing-6 后的 B5 执行 L1 + L2 复验。

## 测试范围

- B5 fixing-6 后的 L1 本地复验
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
- L2 白名单详情页 banner / recent videos / topic cloud / no audience tab：PASS
- L2 topic cloud canvas：5/5 PASS
- staging git_sha 与当前本地 HEAD 不一致：FAIL，阻塞签收

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

### L2 PASS

- `curl -sS https://staging.kol.guangai.ai/api/health`
  - 返回 `status: healthy`
  - 返回 `git_sha: "ee45543"`
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
- 5/5 结果一致：
  - `kol-banner = 1`
  - `kol-recent-videos = 1`
  - `kol-recent-video-* = 6`
  - `kol-topic-cloud = 1`
  - `kol-topic-cloud-empty = 0`
  - `kol-topic-cloud-canvas = 1`
  - `audience` tab 未渲染
- 复访其中一个样本后结果保持一致
  - 没有回落到 empty state
  - canvas 持续存在

## 缺陷列表

### [Medium] staging 版本与当前 HEAD 不一致

- 复现信息：
  - staging health 返回 `git_sha: ee45543`
  - 本地 `HEAD` 为 `e493ab4`
- 影响：
  - 功能结果已经通过
  - 但不满足“staging KOL 详情页含全部新元素且与当前提交对齐”的签收口径
  - 这会让本轮无法直接写入 signoff

## 待确认问题

- 需要 Generator / Planner 确认：
  - 是否要把 staging redeploy 到当前 `HEAD`
  - 版本对齐后是否进入最终 signoff 提交流程

## 结论

- 本轮 `reverifying` 的功能结论：**PASS**
- 本轮 `reverifying` 的签收结论：**FAIL**，原因仅为 staging 版本未对齐当前 `HEAD`
- 建议状态流转：`reverifying -> fixing`
- Generator 下一步应先完成 staging redeploy 对齐，再进入下一轮最终签收

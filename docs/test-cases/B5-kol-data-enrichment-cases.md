# B5-kol-data-enrichment Test Cases

Summary

- Scope: B5 `verifying` 阶段的 Reviewer 验收用例，覆盖本地 L1 守门测试与后续 L2 staging 手工走查。
- Documents: `docs/specs/B5-kol-data-enrichment-spec.md`, `features.json`, `progress.json`, `.auto-memory/role-context/evaluator.md`
- Environment: L1 = 本地 Vitest / Testcontainers；L2 = `https://staging.kol.guangai.ai`
- Result totals: 待执行

Test Cases

- `B5-L1-001` KOL 详情页 tabs 不渲染 audience placeholder
  - Priority: High
  - Requirement Source: F004 #5, F005 守门 tests
  - Preconditions: 本地源码为当前 `origin/main`
  - Steps:
    1. 读取 `src/app/[locale]/(app)/kols/[id]/KolTabsNav.tsx`
    2. 校验 `KolTabKey` 仅含 `overview/collabs/contacts/ai`
    3. 校验 `TABS` 不含 `audience`
  - Expected Result: audience tab 未进入类型定义和渲染列表

- `B5-L1-002` Discovery `channelAge` 与旧筛选维度组合查询
  - Priority: High
  - Requirement Source: F003, F005 守门 tests
  - Preconditions: Testcontainers DB 可启动
  - Steps:
    1. 构造 veteran / non-veteran KOL 数据
    2. 叠加 `categories` 与 `engagementMin`
    3. 执行 `runDiscoverySearch`
  - Expected Result: 仅返回同时满足新旧筛选条件的行

- `B5-L1-003` Discovery `uploadFrequency` 与旧筛选维度组合查询
  - Priority: High
  - Requirement Source: F003, F005 守门 tests
  - Preconditions: Testcontainers DB 可启动
  - Steps:
    1. 构造 active / semi-active / low-follower KOL 数据
    2. 叠加 `followersMin/followersMax`
    3. 执行 `runDiscoverySearch`
  - Expected Result: 仅返回满足 active + follower range 的行

- `B5-L1-004` Discovery `regionGroup` 与旧筛选维度组合查询
  - Priority: High
  - Requirement Source: F003, F005 守门 tests
  - Preconditions: Testcontainers DB 可启动
  - Steps:
    1. 构造 JP / KR / US KOL 数据
    2. 叠加 `regions` 与 `languages`
    3. 执行 `runDiscoverySearch`
  - Expected Result: `regionGroup=asia` 与旧条件按 AND 生效

- `B5-L1-005` YouTube 四个 promoted 字段不再双写到 `metadata.youtube`
  - Priority: High
  - Requirement Source: F002 A2, F005 守门 tests
  - Preconditions: 本地源码为当前 `origin/main`
  - Steps:
    1. 调 `mapToKolRow`
    2. 调 `mapToUpsertPayload`
    3. 调 `mapToEnrichmentUpdate`
  - Expected Result: `channelCreatedAt/videoCount/totalViewCount/bannerUrl` 只出现在 dedicated columns，不出现在 `metadata.youtube`

- `B5-L1-006` 词云 fresh-cache 命中不调 aigcgateway
  - Priority: High
  - Requirement Source: F006 acceptance, F005 守门 tests
  - Preconditions: Testcontainers DB 可启动
  - Steps:
    1. 预置 fresh `metadata.topicCloud`
    2. 调 `loadTopicCloud`
    3. 断言未发生 `fetch`
  - Expected Result: 直接返回缓存关键词

- `B5-L1-007` 词云 cache miss + aigcgateway mock success 持久化回写
  - Priority: High
  - Requirement Source: F006 acceptance
  - Preconditions: Testcontainers DB 可启动
  - Steps:
    1. 构造无缓存 KOL
    2. mock aigcgateway success
    3. 调 `loadTopicCloud` 并回读 DB
  - Expected Result: 返回关键词并写入 `metadata.topicCloud`

- `B5-L1-008` 词云失败与 Action 未配置回退
  - Priority: High
  - Requirement Source: F006 acceptance
  - Preconditions: Testcontainers DB 可启动
  - Steps:
    1. 预置 stale `metadata.topicCloud`
    2. 分别模拟 aigcgateway failure / missing actionId
    3. 调 `loadTopicCloud`
  - Expected Result: 返回 stale cache，不抛错，不清空已有缓存

- `B5-L2-001` Staging KOL 详情页完整走查
  - Priority: Critical
  - Requirement Source: F004, F006
  - Preconditions: 用户授权 L2；staging `git_sha` 与 `main` 一致
  - Steps:
    1. 登录 staging
    2. 打开一个 youtube KOL 详情页
    3. 检查 banner / channelAge / videoCount / engagementRate / recent videos / topic cloud
  - Expected Result: 所有新元素存在；无 audience tab；topic cloud 可见或走 friendly empty state

- `B5-L2-002` Staging Discovery 高级筛选走查
  - Priority: Critical
  - Requirement Source: F003, F005
  - Preconditions: 用户授权 L2；staging `git_sha` 与 `main` 一致
  - Steps:
    1. 打开 `/discovery`
    2. 展开 Advanced filters
    3. 组合 `channelAge/uploadFrequency/regionGroup` 与旧筛选条件
  - Expected Result: 筛选可交互、结果收敛正确、刷新后折叠状态符合 cookie 预期

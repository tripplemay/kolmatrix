# BI1 — 测试基建落地 批次规格

> 类型：Infrastructure Sprint（基建批次 1）
> 状态：草稿（待 B0 完成 + 用户确认后启动）
> Planner: Kimi · Generator: TBD · Evaluator: Reviewer
> 起草日期：2026-04-18

## 1. 背景与目标

B0 完成后项目跑得起来，但**没有任何自动化测试**。Reviewer 在 verifying 阶段只能手动 spot check，效率低、覆盖窄、不可重复。CLAUDE.md `rules/testing.md` 强制 80%+ 覆盖率，B1 业务批次 acceptance 也写明 "全部走自动化测试" —— 这一切的前置是**测试基建落地**。

本批次（BI1）目标：**搭好 4 套测试栈（unit / integration / e2e / visual regression），写完 B0 代码的首批测试覆盖到 80%+，并把测试集成进 CI**。完成后，后续每个业务批次只需要"加 features 时同时加 tests"，不再有基建摩擦。

**Definition of Done：**
- `npm run test:unit` / `npm run test:integration` / `npm run test:e2e` 三个 script 都能跑
- B0 核心代码（lib/db withTenant、auth、RLS、App Shell 组件）覆盖率 ≥ 80%
- CI workflow 加 4 个新 jobs（unit / integration / e2e / coverage upload）
- 视觉回归基准就位（Dashboard 截图与 Stitch ref 对照通过）
- Codex 在 verifying 阶段可直接跑全套测试

**Out of Scope：**
- ❌ 测试覆盖 B1 业务代码（B1 自带 F010 测试任务）
- ❌ 性能/压测（远期 BIx）
- ❌ 安全扫描（远期 BIx，可能引入 Trivy/Snyk）
- ❌ Sentry / 日志聚合（BI4）

## 2. 范围

### In Scope
- Vitest + @vitest/coverage-v8 安装配置
- Testcontainers（PostgreSQL）helper 实现
- Playwright 浏览器 + config + 截图 diff
- MSW（Mock Service Worker）拦截外部 HTTP
- @faker-js/faker fixtures
- `tests/` 目录结构建立
- 首批测试用例（B0 代码覆盖）
- CI workflow 集成 4 个 jobs
- 视觉回归基准（Dashboard）
- `package.json` test scripts
- `.gitignore` 加测试产物路径

### Out of Scope
- B1 业务代码测试（B1 内部 F010）
- E2E 覆盖所有用户流（只覆盖关键登录 + Dashboard）
- 跨浏览器（仅 Chromium，Firefox/WebKit 远期）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| Test runner | Vitest 1.x | Vite-native，速度快，与 Next 兼容好 |
| 集成测试 DB | Testcontainers + 临时 PG 容器 | 隔离、干净、并行安全；不污染 dev DB |
| E2E framework | Playwright 1.50+ | 视觉 diff 内建，trace viewer 强大 |
| HTTP mock | MSW 2.x | 拦截在 fetch 层，最贴近真实，可在浏览器和 Node 同时用 |
| Fixtures | @faker-js/faker + factory 函数 | 比 fixtures 文件灵活，可 override |
| 覆盖率工具 | @vitest/coverage-v8 | 不依赖 Babel，纯 V8 引擎 |
| 视觉回归阈值 | 像素 diff < 2% 总像素 + maxDiffPixels 1000 | 与 B0 spec §F005 像素级还原标准一致 |
| 视觉基准来源 | `design-draft/stitch-references/*.png` | 直接复用现有设计稿截图，无需手动建基准 |
| Coverage 上传 | Codecov（开源免费） | 标准、PR 自动评论 |
| 测试 DB 名 | 每个测试用 Testcontainers 唯一名 | 自动隔离，无并发冲突 |

## 4. 功能列表（10 项，全 executor:generator）

### F001 — Vitest 安装 + 配置 + 首个 unit test 跑通
**实现：**
- `npm install -D vitest @vitest/coverage-v8 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- `vitest.config.ts`：环境 `jsdom`、setupFiles、coverage thresholds（80%）、include/exclude patterns
- `tests/setup.ts`：全局 setup（@testing-library/jest-dom matchers）
- `package.json` 加 scripts：`test`、`test:unit`、`test:watch`、`test:coverage`、`test:ui`
- 占位 unit test：`src/lib/__tests__/utils.test.ts`（test cn() 函数）

**Acceptance：**
- `npm run test:unit` 跑通占位 test
- `npm run test:coverage` 输出 coverage 报告到 `coverage/`
- `npm run test:ui` 起 Vitest UI（http://localhost:51204）
- vitest.config.ts 强制 coverage threshold 80% lines / 80% functions / 80% statements

### F002 — Testcontainers PG helper + 首个 integration test
**实现：**
- `npm install -D testcontainers @testcontainers/postgresql`
- `tests/helpers/db.ts`：
  - `setupTestDb()` — 启动临时 PG 容器，跑 `prisma migrate deploy`
  - `teardownTestDb()` — 关闭容器
  - `withTestTenant(fn)` — 创建临时 tenant，包装 `withTenant` 调用
  - `cleanDb()` — 清空所有表（保留 schema）
- `tests/integration/db-setup.test.ts`：占位测试，验证容器启动 + migrate + 简单 CRUD
- 注意：每个 describe 用 beforeAll/afterAll 共享同一容器（启动慢，~10s）

**Acceptance：**
- `npm run test:integration` 启动 PG 容器、跑 migrate、跑测试、关闭容器
- 占位 test 验证 `prisma.tenant.create()` 成功
- 多个测试并行不冲突（用唯一 DB 名）

### F003 — Playwright 安装 + 浏览器 + 配置 + 首个 E2E
**实现：**
- `npm install -D @playwright/test`
- `npx playwright install --with-deps chromium`（Linux CI 也兼容）
- `playwright.config.ts`：
  - `testDir: './tests/e2e'`
  - `use: { baseURL: 'http://localhost:3000', screenshot: 'only-on-failure', trace: 'retain-on-failure', viewport: { width: 1440, height: 900 } }`
  - 启动前自动 `webServer: { command: 'npm run dev', port: 3000 }`
- `package.json` 加 scripts：`test:e2e`、`test:e2e:ui`、`test:e2e:debug`
- 占位 E2E：`tests/e2e/landing.spec.ts`：访问 `/` 看到 KOLMatrix 文字

**Acceptance：**
- `npm run test:e2e` 启动 dev server + 跑测试 + 关闭
- 失败时自动存截图到 `playwright-report/`
- `npx playwright show-report` 能看 HTML 报告
- chromium 浏览器一次性安装到位

### F004 — MSW 配置 + aigcgateway / Resend mock 框架
**实现：**
- `npm install -D msw`
- `tests/mocks/handlers.ts`：HTTP handlers 集合
  - aigcgateway 的 POST `/v1/evaluate` 默认返回 mock score
  - Resend 的 POST `/emails` 默认返回 mock message ID
- `tests/mocks/server.ts`：Node 端 setupServer
- `tests/mocks/browser.ts`：浏览器端 setupWorker（E2E 用）
- 在 `tests/setup.ts` 中 `beforeAll(() => server.listen())` / `afterEach(() => server.resetHandlers())` / `afterAll(() => server.close())`
- `tests/__example/msw-usage.test.ts`：示例测试展示如何 override handler 模拟错误响应

**Acceptance：**
- 示例测试：`fetch('https://aigcgateway.example/v1/evaluate', ...)` 返回 mock score 87
- override handler 可模拟 500 错误
- 不影响其他网络请求（unhandled requests 默认 warn 不 error）

### F005 — Test fixtures（factory 函数）
**实现：**
- `npm install -D @faker-js/faker`
- `tests/fixtures/tenant.ts`：`makeTenant(overrides)` 返回完整 Tenant 对象
- `tests/fixtures/user.ts`：`makeUser(overrides)` 含 hashed_password 默认值
- `tests/fixtures/kol.ts`：`makeKol(overrides)` 含 audience JSONB 字段默认值
- `tests/fixtures/campaign.ts`：`makeCampaign(overrides)` 含 markets / status
- `tests/fixtures/index.ts`：barrel export
- 每个工厂可接受 overrides 覆盖任何字段
- 文件头注释说明字段语义

**Acceptance：**
- `makeKol({ countryCode: 'JP' })` 返回 KOL 对象，countryCode='JP'，其他字段随机但合法
- 工厂生成的对象可直接 `prisma.kol.create({ data: makeKol() })` 入库
- 不会因 random data 触发 DB 约束（如 follower_count >= 0）

### F006 — B0 代码 unit tests（lib + components 覆盖）
**实现：**
- `src/lib/__tests__/db.test.ts`：测 `withTenant` 包装行为（用 mocked Prisma）
- `src/lib/__tests__/utils.test.ts`：测 `cn`、各种 utils
- `src/components/layout/__tests__/Sidebar.test.tsx`：渲染测试（@testing-library/react），断言 8 个 nav items / active state 切换
- `src/components/layout/__tests__/Topbar.test.tsx`：渲染测试，断言 search input + bell + avatar
- `src/components/common/__tests__/*.test.tsx`：F010 12 个公共组件每个一个 unit test（断言基础渲染 + 关键 props）
- 状态测试：组件 hover、focus、active 状态可通过 user-event 触发

**Acceptance：**
- `npm run test:unit -- src/lib` 覆盖率 ≥ 80%
- `npm run test:unit -- src/components` 覆盖率 ≥ 80%
- 12 个 common 组件每个至少 2 个 test case

### F007 — RLS + Auth integration tests
**实现：**
- `tests/integration/rls-isolation.test.ts`：
  - 创建 tenant A + tenant B 各 1 个 KOL
  - 用 `withTenant(tenantA.id)` 查询，确认只见 A 的 KOL
  - 不带上下文的 raw 查询返回 0 行
  - 6 张多租户表全部覆盖（user/kol/campaign/kol_campaign/email_template/email_log）
- `tests/integration/auth-flow.test.ts`：
  - CredentialsProvider 登录成功 → JWT 包含 tenantId/role
  - 错误密码返回 401
  - JWT 解码恢复 session 信息
- `tests/integration/middleware.test.ts`：
  - 未登录访问 `/dashboard` 重定向到 `/login`
  - 登录后访问 `/dashboard` 通过

**Acceptance：**
- 全部测试通过
- RLS 测试明确覆盖每张多租户表
- Auth 测试模拟成功 + 失败 + 跨 tenant 三种路径

### F008 — Marketer 登录 + Dashboard E2E flow
**实现：**
- `tests/e2e/marketer-dashboard.spec.ts`：
  - beforeAll: 启动 dev server + seed 数据（hook 进 webServer）
  - test 1: 访问 `/login` → 输入凭证 → 跳 `/dashboard`
  - test 2: dashboard 看到 "Welcome back, Sarah" + "12,847" 总 KOL 数
  - test 3: 切换语言 EN → ZH，nav 文案变化
  - test 4: 点 sidebar nav 跳路由（如 KOL Database 链接 → `/kols`）
- 失败时自动截图 + trace

**Acceptance：**
- 全部 E2E 用例通过
- 失败有截图 + trace（手动 inspect 可看）
- 跨语言断言通过

### F009 — 视觉回归基线 + Dashboard 截图对比
**实现：**
- `tests/e2e/visual-regression.spec.ts`：
  - test: 访问 `/dashboard`，`await expect(page).toHaveScreenshot('dashboard.png', { threshold: 0.02, maxDiffPixels: 1000 })`
- 首次跑：`npx playwright test --update-snapshots` 创建 baseline
- baseline 存于 `tests/screenshots/baseline/`
- 与 `design-draft/stitch-references/dashboard.png` 比对（前者是项目实现的实际渲染，后者是 Stitch 设计稿；二者本就有差异，但应 < 5%）

**Acceptance：**
- baseline 创建成功并 commit 入库
- 后续跑测试：dashboard 截图与 baseline diff < 2%
- 故意改 Dashboard CSS 触发 diff，测试失败 + 生成 diff 图

### F010 — CI workflow 集成（4 jobs）
**实现：**
- 修改 `.github/workflows/ci.yml`：在原有 lint + tsc + build 基础上加：
  - `unit-tests` job（依赖 lint）：`npm run test:unit -- --coverage` + 上传 coverage 到 Codecov
  - `integration-tests` job（依赖 lint，加 PG service container + Redis service container）：`npm run test:integration`
  - `e2e-tests` job（依赖 build）：`npx playwright install chromium` + `npm run test:e2e` + 失败上传 playwright-report artifact
- `tests/screenshots/baseline/` 入库（git tracked，确保 CI 与本地基线一致）
- `tests/screenshots/actual/` 和 `diff/` 加入 `.gitignore`
- `playwright-report/` 加入 `.gitignore`
- 注册 CODECOV_TOKEN secret（用户操作）

**Acceptance：**
- PR 触发 CI 时 4 个 jobs 全绿
- coverage 报告显示在 PR 评论（Codecov）
- 故意 break 一个 test，CI fail
- E2E 失败时 playwright-report 可下载查看

## 5. 依赖关系

```
F001 (Vitest) → F006 (unit tests using Vitest)
F002 (Testcontainers) → F007 (integration tests using PG container)
F003 (Playwright) → F008 (E2E) + F009 (visual regression)
F004 (MSW) → F006/F007 (tests use mocks)
F005 (Fixtures) → F006/F007 (tests construct data)
F006/F007/F008/F009 → F010 (CI integration runs all)
```

**强制执行顺序：** F001 → F002 → F003 → F004 → F005 → F006 → F007 → F008 → F009 → F010

> F001-F005 是基建（工具就位），F006-F009 是首批测试（用基建写真测试），F010 是 CI 集成（让基建 + 测试自动跑）。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| Testcontainers 启动慢 (~10s/容器) | 用 `beforeAll` 共享容器；并行测试数限制为 4 |
| Playwright 浏览器在 CI 安装慢 | 缓存 `~/.cache/ms-playwright/`；只装 chromium |
| 覆盖率 80% 阈值过严达不到 | F006 优先覆盖 lib/，组件用 happy path；如真不到 80% 可暂降到 70% 并写 issue 跟进 |
| MSW 与 Next 15 fetch 兼容问题 | 锁 MSW 2.4+；遇阻退化为 vi.mock |
| 视觉回归 baseline 与 Stitch 设计稿差异 | F009 baseline 是"项目实现"截图，与 Stitch 设计稿比是另一个验收（B0 spec L2）；本 batch 只关心 baseline 自身稳定 |
| Codecov 配置复杂 | 失败可降级为 console 输出 coverage（不阻塞 PR） |

## 7. 验收方式（Evaluator 阶段）

由 Reviewer (Codex) 执行：

### L1 — 自动化检查
- 4 个 npm scripts 全跑通：`test:unit`、`test:integration`、`test:e2e`、`test:coverage`
- 覆盖率 ≥ 80%（lines / functions / statements）
- CI workflow 在 PR 中 4 个 jobs 全绿

### L2 — 手工验证
- Reviewer 在本地干净环境跑 `npm test` 全绿（< 5 分钟）
- Reviewer 故意改一行 src code 引入 bug，测试明确失败
- Reviewer 故意改 Dashboard CSS（如改 padding），视觉回归测试明确失败 + diff 图清晰

### L3 — 文档
- `tests/README.md` 说明：如何跑、如何添加新 test、如何更新 baseline
- 各类测试目录有 `.tests` 入口说明（README）

## 8. 引用文档

- `docs/dev/testing.md` — 测试策略总览（本批次落地实施）
- `docs/dev/architecture.md` — 系统架构（影响测试边界）
- `docs/specs/B0-foundation-spec.md` — B0 实现（被本批次覆盖测试）
- `docs/specs/B0-app-shell-component.md` — App Shell 组件（被 F006 覆盖）
- `docs/specs/B0-database-schema.md` — DB schema（被 F007 RLS 测试覆盖）
- `evaluator.md` — Codex 工作流（本批次产物服务于 Codex）

## 9. 启动检查清单（B0 完成 + 用户确认后核对）

- [ ] B0 status=done，全部 features 验收通过
- [ ] B0 evaluator signoff 报告存在
- [ ] design-draft/stitch-references/dashboard.png 是最新版（影响 F009 视觉对照）
- [ ] B0 实际代码结构（src/lib/db.ts / src/auth.ts / 组件路径）与本 spec 引用一致（如有差异修订本 spec）
- [ ] CODECOV_TOKEN 已在 GitHub repo secrets 配置（如启用 codecov）
- [ ] 用户确认 BI1 范围（如不要 codecov 可剥离 F010 子项）
- [ ] role_assignments 决定（默认 generator=johnsong / evaluator=Reviewer）

## 10. 完成后效果

BI1 后，**Codex 在每个业务批次 verifying 阶段**：
```bash
git pull
npm install                  # 自动同步新依赖
npm test                      # 跑 unit + integration + e2e + coverage
npx playwright test           # 视觉回归
# 看测试结果 → 写 signoff 报告 → 推 main
```

后续 B1+ 业务批次的 acceptance 中"测试"部分变得**廉价可执行**：
- F010 KOL Database 测试套件 = 写测试 + npm test 全绿即可
- 不再需要每个批次重新搭测试基建

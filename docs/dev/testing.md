# KOLMatrix 测试策略与 Codex 工作流

> 版本：v1.0 · 日期：2026-04-18
> 当前状态：B0 阶段无测试代码（spec 留 hook，BI1 批次落地）
> 本文档为规划与执行参考；测试代码归 Codex 所有，Generator 不写测试

## 1. 测试金字塔

```
                  ╱  E2E Tests  ╲          ← Playwright，关键用户流
                ╱  (5-10 cases)  ╲
              ╱─────────────────────╲
            ╱  Integration Tests     ╲     ← Testcontainers PG，API + RLS
          ╱     (40-60 cases)         ╲
        ╱───────────────────────────────╲
      ╱       Unit Tests                  ╲   ← Vitest，工具函数 / 组件 / 状态机
    ╱        (200+ cases)                  ╲
  ╱___________________________________________╲
```

**覆盖率目标：** 80%+（CLAUDE.md/rules/testing 强制）

| 层 | 占比 | 工具 | 谁写 | 在哪运行 |
|---|---|---|---|---|
| Unit | ~70% | Vitest | Codex | 本地 + CI |
| Integration | ~25% | Vitest + Testcontainers | Codex | 本地 + CI |
| E2E | ~5% | Playwright | Codex | 本地 + CI（headless）+ Staging |

## 2. 工具选型

| 工具 | 版本 | 用途 |
|---|---|---|
| **Vitest** | 1.x | Unit + integration runner（Vite-native，速度快，与 Next 兼容） |
| **@vitest/coverage-v8** | latest | 覆盖率统计（v8 引擎，不卡 Babel） |
| **Testcontainers** | latest | 集成测试动态起 PostgreSQL 容器（隔离 + 干净状态） |
| **Playwright** | 1.50+ | E2E 测试 + 视觉回归（截图 diff） |
| **MSW** (Mock Service Worker) | 2.x | Mock 外部 HTTP API（aigcgateway / Resend / YouTube） |
| **@faker-js/faker** | latest | 测试数据 fixtures（random user/kol/campaign） |

**安装命令（BI1 任务）：**
```bash
npm install -D vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  jsdom \
  testcontainers \
  @playwright/test \
  msw \
  @faker-js/faker
```

## 3. 目录结构

```
tests/
├── unit/                          # 与 src/ 镜像（也可放到 src/foo/__tests__/）
│   └── ...
├── integration/                   # API + RLS + DB
│   ├── kol-api.test.ts
│   ├── auth-flow.test.ts
│   ├── rls-isolation.test.ts
│   └── ...
├── e2e/                           # 用户流
│   ├── marketer-dashboard.spec.ts
│   ├── kol-database-crud.spec.ts
│   └── ...
├── fixtures/                      # 测试数据工厂
│   ├── user.ts                    # makeUser()
│   ├── kol.ts                     # makeKol()
│   ├── campaign.ts
│   └── ...
├── helpers/
│   ├── db.ts                      # withTestDb() helper, Testcontainers 起 PG
│   ├── auth.ts                    # signInAs(role) helper
│   └── ...
└── screenshots/                   # Playwright 截图（gitignored，仅本地/CI）
    ├── baseline/                  # 视觉回归基准（从 design-draft/stitch-references/ 同步）
    ├── actual/                    # 当次跑出来的
    └── diff/                      # 差异图（pixelmatch）
```

`src/**/__tests__/foo.test.ts` 也行（Vitest 自动发现两种位置）。

## 4. 测试分类与示例

### 4.1 Unit Test 范例（状态机）

```typescript
// src/features/kol/__tests__/state-machine.test.ts
import { describe, it, expect } from 'vitest';
import { canTransition, validTransitions } from '../state-machine';

describe('KOL state machine', () => {
  it('allows pending → active', () => {
    expect(canTransition('pending', 'active')).toBe(true);
  });
  
  it('forbids blacklisted → active', () => {
    expect(canTransition('blacklisted', 'active')).toBe(false);
  });
  
  it.each([
    ['pending', ['active', 'archived', 'blacklisted']],
    ['active', ['working', 'archived', 'blacklisted']],
    ['blacklisted', []],
  ])('valid transitions from %s', (from, expected) => {
    expect(validTransitions(from)).toEqual(expect.arrayContaining(expected));
  });
});
```

### 4.2 Integration Test 范例（RLS 隔离）

```typescript
// tests/integration/rls-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { withTestDb } from '../helpers/db';
import { withTenant } from '@/lib/db';

describe('RLS isolation', () => {
  let db: TestDb;
  
  beforeAll(async () => { db = await withTestDb(); });
  afterAll(async () => { await db.cleanup(); });
  
  it('marketer A cannot see marketer B kols', async () => {
    const tenantA = await db.createTenant();
    const tenantB = await db.createTenant();
    await db.createKol({ tenantId: tenantA.id, displayName: 'A1' });
    await db.createKol({ tenantId: tenantB.id, displayName: 'B1' });
    
    const aKols = await withTenant(tenantA.id, () => db.prisma.kol.findMany());
    expect(aKols).toHaveLength(1);
    expect(aKols[0].displayName).toBe('A1');
  });
  
  it('raw query without tenant context returns 0 rows', async () => {
    // 不调用 withTenant 直接查
    const all = await db.prisma.kol.findMany();
    expect(all).toHaveLength(0);
  });
});
```

### 4.3 E2E Test 范例（用户流）

```typescript
// tests/e2e/marketer-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('marketer can log in and see dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'marketer@kolmatrix.local');
  await page.fill('[name=password]', 'KOLM@2026!');
  await page.click('button[type=submit]');
  
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('Welcome back, Sarah')).toBeVisible();
  await expect(page.getByText('12,847')).toBeVisible(); // Total KOLs from seed
});

test('visual regression: dashboard matches Stitch design', async ({ page }) => {
  await page.goto('/login');
  // ... auth ...
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png', {
    threshold: 0.02,    // 2% pixel diff allowed
    maxDiffPixels: 1000,
  });
});
```

## 5. Mock 策略（外部依赖）

### 5.1 aigcgateway（AI 调用）

```typescript
// tests/setup/mocks/aigcgateway.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const aigcGatewayMock = setupServer(
  http.post('https://aigcgateway.example/v1/evaluate', async () => {
    return HttpResponse.json({
      score: 87,
      breakdown: { brand_safety: 92, audience_quality: 85, ... },
      tags: ['FPS', 'EN-T1'],
    });
  })
);
```

### 5.2 Resend（邮件发送）

测试中替换为 stub：

```typescript
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'mock-msg-id', from: '...' })
    }
  }))
}));
```

### 5.3 YouTube/TikTok（B6 后）

同 aigcgateway，用 MSW 拦截 HTTP 请求。

## 6. 测试数据策略

### 6.1 `prisma/seed.ts` vs `tests/fixtures/`

| | prisma/seed.ts | tests/fixtures/ |
|---|---|---|
| 用途 | 开发时本地 DB 可视化 | 测试代码内动态构造 |
| 数据量 | 12 KOLs / 3 campaigns（固定，与 Stitch mock 对齐） | 按测试用例需要构造 |
| 何时跑 | `npx prisma db seed`（手动） | 每个 integration test 自动 |
| 隔离 | 不隔离（污染 dev DB） | 每个 test 用 Testcontainers 起新 PG |

### 6.2 Fixture Factory 范例

```typescript
// tests/fixtures/kol.ts
import { faker } from '@faker-js/faker';

export function makeKol(overrides: Partial<Kol> = {}): Kol {
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    displayName: faker.internet.userName(),
    handle: '@' + faker.internet.userName().toLowerCase(),
    platform: faker.helpers.arrayElement(['youtube', 'tiktok']),
    countryCode: 'US',
    followerCount: faker.number.int({ min: 1000, max: 10_000_000 }),
    aiScore: faker.number.int({ min: 60, max: 100 }),
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}
```

测试中用：

```typescript
const kol = makeKol({ status: 'pending', countryCode: 'JP' });
await db.kol.create({ data: kol });
```

## 7. CI 集成

### 7.1 BI1 后的 ci.yml jobs

```yaml
jobs:
  lint-and-typecheck:    # 已有
    ...
  
  build:
    needs: lint-and-typecheck
    ...
  
  unit-tests:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
  
  integration-tests:
    needs: lint-and-typecheck
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: kolmatrix_test
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run test:integration
  
  e2e-tests:
    needs: build
    runs-on: ubuntu-latest
    services: [postgres, redis]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx prisma migrate deploy
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### 7.2 Playwright 视觉回归基准

`design-draft/stitch-references/*.png` 是 Stitch 生成的设计稿截图。
Playwright 跑 `toHaveScreenshot()` 时第一次会创建 baseline，后续每次 diff。

**视觉差异标准（与 B0 spec §F005/F007 一致）：**
- 间距 ±2px / 颜色 ΔE<2 / 字号 100%
- 用 `threshold: 0.02` + `maxDiffPixels: 1000` 控制

## 8. Codex (Evaluator) 工作流

> 详见 `evaluator.md`（已存在）。本节补充实操层面。

### 8.1 Codex 在哪里跑测试

**默认：与 Generator 同一台开发机本地。** Codex 是 CLI agent（不是远程服务），通过 SSH/SDK 进入用户机器，与 Generator 共享：
- 同一个 git 仓库
- 同一个 docker-compose（PG + Redis）
- 同一个 `.env.local`

可选：Codex 可在另一台机器（`.agent-id` 不同），通过远端共享 git 协同。

### 8.2 Codex 一次完整 verifying 流程

```
1. git pull origin main
2. 读 .auto-memory/MEMORY.md + project-status.md + environment.md
3. 读 progress.json，确认 status=verifying
4. 读 docs/specs/{batch}-spec.md，理解 acceptance
5. 读 features.json，看哪些 status=completed 待验收
6. （可选）读 generator_handoff，看 Generator 留下的脚本/工具
7. 编写测试用例（如缺）→ docs/test-cases/{batch}-cases.md
8. 编写 / 跑测试代码：
   - npm run test:unit
   - npm run test:integration
   - npm run test:e2e
9. 视觉回归（如适用）：
   - npm run dev（启动应用）
   - npx playwright test --update-snapshots（首次）/ npx playwright test（后续）
10. 手动 spot check 关键流（marketer 登录走一遍）
11. 写报告：docs/test-reports/{batch}-signoff.md
12. 更新 progress.json：
    - 全 PASS → status=done + completed_features=total
    - 有 FAIL/PARTIAL → status=fixing + 写 evaluator_feedback
13. git commit + push
```

### 8.3 Codex 测试报告模板

```markdown
# {batch} Signoff Report

> Reviewer · {timestamp} · git SHA {sha}

## 验收概览

| 状态 | 数量 |
|---|---|
| PASS | X |
| PARTIAL | Y |
| FAIL | Z |

## 逐 feature 验收

### F001 — {title}
- **Status:** PASS / PARTIAL / FAIL
- **Acceptance check:** ...
- **Test evidence:** unit `tests/unit/foo.test.ts:30` 全绿；integration `tests/integration/foo.test.ts` 全绿
- **Issues:** （如有）

### F002 — ...

## 视觉回归

- `dashboard` 截图与基准对比：差异 0.7%（< 2% 阈值）✅
- `kol-database` 截图与基准对比：差异 1.4% ⚠️ 接近阈值，差异主要在...

## 阻塞问题

（如有 FAIL，列具体问题 + 复现步骤 + 建议修复方向）

## 推荐流转

- 全 PASS → status=done
- 有 FAIL → status=fixing，evaluator_feedback 见上述 issues
```

### 8.4 Codex 与 Generator 的协作约定

- Codex **不修改业务代码** —— 发现 bug 写 evaluator_feedback，由 Generator 在 fixing 阶段修
- Codex **可以修改测试代码** —— 测试域完整归 Codex 所有
- Codex **可以修改 docs/test-cases/ 和 docs/test-reports/** —— 测试产物
- Codex **不修改 docs/specs/** —— 规格归 Planner 所有

## 9. 测试环境约定（给 Codex 的实操指南）

### 9.1 重置到干净 DB

```bash
# 完全推倒重来
docker compose down -v
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

### 9.2 跑 E2E 不影响 dev DB

```bash
# 用 .env.test 指定独立 DB
cp .env.local .env.test
# 编辑 DATABASE_URL → kolmatrix_test
DATABASE_URL=postgresql://...kolmatrix_test \
  npx playwright test
```

### 9.3 视觉回归首次基线

```bash
# 第一次跑创建基线
npx playwright test --update-snapshots
git add tests/screenshots/baseline/
git commit -m "test: add visual regression baselines"
```

### 9.4 失败截图保存

Playwright 失败时自动存 `playwright-report/`，包含截图 + trace。Codex 可在 signoff 报告中引用具体路径。

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| Testcontainers 启动慢拖慢 CI | 用 `--maxWorkers=2` 并行 + cache docker images |
| 视觉回归基准频繁变（Stitch 设计稿改动） | Stitch 重生成后必须更新 `tests/screenshots/baseline/`，PR 中说明原因 |
| Mock 与真实 API 漂移 | BI1 后定期跑 contract tests against staging aigcgateway |
| 80% 覆盖率虚高（unit 多 integration 少） | Reviewer 验收看 coverage 报告，integration / e2e 占比 < 25% 视为不达标 |
| Codex 与 Generator 同机器 git 冲突 | Codex push 前 rebase；commit message 前缀 `[reviewer]` 区分 |

## 11. 引用文档

- `evaluator.md` — Codex 角色完整指令
- `docs/dev/architecture.md` — 系统架构（影响测试范围）
- `docs/dev/infrastructure.md` — 基建（CI/CD 集成测试运行点）
- `docs/specs/roadmap.md` — BI1 测试基建批次
- `harness-rules.md` — 测试产物路径约定（docs/test-cases/ + docs/test-reports/）

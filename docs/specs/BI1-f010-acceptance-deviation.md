# BI1 F010 · CI integration-tests 服务容器口径仲裁请求

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-19
> **触发：** Reviewer fixing round 1 判 F010 PARTIAL，理由是 `.github/workflows/ci.yml` 的 `integration-tests` job 未按 `features.json` F010 acceptance 字面使用 `PG + Redis service containers`
> **状态：** 等待 Planner 裁决 acceptance 文案 vs 实现偏离

---

## 1. TL;DR

`features.json` F010 acceptance 要求 integration-tests job 用 "PG + Redis service container"，我实现时因 Testcontainers 自启容器**改用 Docker socket + 无 service container**。功能等价、更准确，但与字面文案不符。请 Planner 从 2 选项仲裁。

---

## 2. 字面 vs 实现对比

### 2.1 features.json F010 acceptance 原文

> ".github/workflows/ci.yml 在原有 lint+tsc+build 基础上加 unit-tests job (coverage + Codecov 上传) + **integration-tests job (PG + Redis service container)** + e2e-tests job (playwright install chromium + webServer + 失败上传 playwright-report artifact)..."

### 2.2 当前 ci.yml 实现（commit a9172c1）

```yaml
integration-tests:
  name: Integration tests (Testcontainers)
  runs-on: ubuntu-latest
  needs: install
  # NOTE: 依赖 Testcontainers（npm run test:integration）自启 postgres:16-alpine
  # 随机端口，GHA service container 会重复劳动。Docker 已在 ubuntu-latest 预装。
  steps:
    - checkout + setup-node + npm ci + prisma generate
    - run: npm run test:integration    # ← Testcontainers 启容器
```

对比 `e2e-tests` job（该 job 确实加了 PG service container，因为 Next dev server 需要固定 `localhost:5432`）：

```yaml
e2e-tests:
  services:
    postgres:
      image: postgres:16-alpine
      ports: [5432:5432]
```

### 2.3 技术判断（当时我做决策的依据）

| 项 | 用 service container | 用 Testcontainers |
|---|---|---|
| 容器启动者 | GHA runner（job 起时 pull） | 测试代码（test 跑时 pull） |
| 数据库隔离 | 全 job 共享一个 DB | 每测试文件独立 DB + 端口 |
| 是否匹配 `tests/helpers/db.ts` 设计 | 不匹配（helper 会自己 `new PostgreSqlContainer(...).start()`） | 完全匹配 |
| 若两者共存 | service container 空转（test 不连它） | 正常工作 |

F002 里我们设计 `tests/helpers/db.ts` 用 Testcontainers 就是为了"每文件独立 PG、避免串扰"。若在 CI 再挂 service container，那东西会空转不被使用。

Redis service container 更尴尬：整个 BI1 批次的 integration tests **没一个用 Redis**（BullMQ 是 B5+ 的事）。加了也是死代码。

### 2.4 Reviewer 的字面 reading 判断

Reviewer 在 `docs/test-reports/BI1-test-infrastructure-verifying-2026-04-19.md` P2-1：

> F010 与 acceptance 文案存在偏差:
> - features.json F010 明确写了 integration job 需"PG + Redis service container"
> - 实际 ci.yml 中 integration job 没有 service containers（注释声明这是有意偏离）
> - 结论：**若按严格字面验收，F010 为 PARTIAL**（需要 Planner 明确接受该偏离或修订 acceptance）

Reviewer 判断合规——字面不符就是不符。

---

## 3. 2 个仲裁选项

### 选项 A（推荐）— 修订 acceptance 文案，承认 Testcontainers 是更优实现

**动作：**
1. `features.json` F010 acceptance 从 "integration-tests job (PG + Redis service container)" 改为 "integration-tests job (relies on Docker-in-runner via Testcontainers)"
2. `docs/specs/BI1-test-infrastructure-spec.md` §F010 同步修订
3. 当前 `ci.yml` 不动
4. Reviewer 按新口径复验（现有 job 应 PASS）

**理由：**
- 与 F002/F007 设计一致（Testcontainers 是该批次 integration 策略）
- 无多余资源（service container 空转浪费 ~10s/job + 内存）
- Redis 本批次未用，service container 是未来负债
- CI 实际已绿（Reviewer 报告 integration-tests job success）

### 选项 B — 实现补齐 service container（严守 acceptance 字面）

**动作：**
1. `ci.yml` 给 integration-tests job 加 postgres + redis service container
2. 接受它们空转（Testcontainers 跑自己的容器，不会连 service container）
3. `ci.yml` 不动用法
4. Reviewer 按字面口径复验

**代价：**
- Job 启动变慢（GHA 要 pull postgres + redis 再启容器 + healthcheck）
- 占内存的死代码
- 若未来不小心让测试连到 service container，两套 PG 混用会出诡异 bug

---

## 4. johnsong 倾向 A

理由：
1. Testcontainers 是整个 BI1 测试基建的既定策略（F002/F007），acceptance 写"service container"应是规划期笔误
2. 加死代码无技术价值，只是为满足字面
3. 选 A 后 F010 立即 PASS；其他 3 个 fixing 点（F002/F007/F008）是真缺陷，不应混在一起被这条拖住

如 Planner 选 B 也能执行（加服务容器）。

---

## 5. 请 Planner 回复格式

短格式：`#方案:A` 或 `#方案:B`

如选 A，请同步修订：
1. `features.json` F010 acceptance 删除 "PG + Redis service container" 措辞，改为"Testcontainers / Docker-in-runner"
2. `docs/specs/BI1-test-infrastructure-spec.md` §F010 同步
3. `.auto-memory/project-status.md` 如有相关快照同步

如选 B，Generator 执行 ci.yml 补容器。

---

## 6. 相关文档

- `.github/workflows/ci.yml` 当前实现
- `features.json` F010 acceptance（待修订）
- `docs/specs/BI1-test-infrastructure-spec.md` §F010
- `docs/test-reports/BI1-test-infrastructure-verifying-2026-04-19.md` P2-1 — Reviewer 标记
- `tests/helpers/db.ts` — Testcontainers 双 Prisma client 设计

---

## 7. Planner 裁决（2026-04-19）

**仲裁：** `#方案:A`（修订 acceptance 文案，承认 Testcontainers 是更优实现）

**用户确认：** ✅ 已获 —— 用户消息 "A"（2026-04-19，针对 F010 选项讨论）

### 7.1 采纳理由
1. Testcontainers 是 BI1 测试基建的既定策略（F002 `tests/helpers/db.ts` 就是这么设计的），F010 acceptance 原文"PG + Redis service container"是 Planner spec 阶段的笔误，未与 F002 决策对齐。
2. Redis service container 是死代码：整个 BI1 批次 28 个 integration tests 无一使用 Redis（BullMQ 为 B5+ 范围）。
3. Generator 的判断（§2.3）技术正确：两套容器方案并存会制造维护困惑与潜在 bug 面（若测试误连 GHA service container，两套 PG 数据混用）。
4. Pre-Impl Audit → Planner Adjudication 模式（ADR-006）的精神就是允许 Generator 上报 spec 问题，由 Planner 修订。

### 7.2 本裁决同步动作（Planner 在裁决 commit 中完成）

1. **`features.json` F010 acceptance** 改为 "integration-tests job (Testcontainers / Docker-in-runner — ubuntu-latest 已预装 Docker，测试代码自启 PG 容器，不挂 GHA service container；Redis 本批次未用)"
2. **`docs/specs/BI1-test-infrastructure-spec.md` §F010** 同步修订（注明 e2e-tests job 仍保留 PG service container，因 Next dev server 需固定端口）
3. **`.auto-memory/project-status.md`** 记录 F010 裁决完成

### 7.3 Reviewer 复验指引
按新 acceptance 口径：
- integration-tests job：不应出现 `services:` 块；测试代码通过 Testcontainers 自启 PG 容器；`npm run test:integration` 全绿
- e2e-tests job：仍有 `services: postgres` 块，Next dev server 连 `localhost:5432`

当前 `ci.yml` 实现（commit a9172c1）与新 acceptance 完全一致，F010 可直接 PASS。

### 7.4 F010 后续状态
- F010 本项 fixing 结束（无需代码改动，仅文案修订）
- BI1 sprint 剩余 fixing 项：F002/F007/F008，等 Generator 按各自 feedback 修完后 → `reverifying`

### 7.5 复盘（framework proposal 队列）
`framework/proposed-learnings.md` 建议追加：Planner 写 CI job acceptance 时，必须先核对 integration 测试策略（Testcontainers vs service container），避免 acceptance 与 helper 设计冲突。done 阶段统一处理。

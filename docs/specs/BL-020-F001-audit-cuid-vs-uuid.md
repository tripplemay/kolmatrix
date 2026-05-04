# BL-020 F001 · productId 校验类型审计请求（CUID vs UUID）

> **发起者：** johnsong (Generator, cli)
> **日期：** 2026-05-04
> **触发：** F001 CR-1 开工前审计，按 pre-impl 审计 → Planner 裁决工作范式
> **状态：** 等待 Planner 明确回复，**未收到前不开工**（F001 单点 hold；F002-F008 继续推进）

## 1. 背景 & 目标

spec §F001 / features.json F001 acceptance 要求：

> `normalizeProductId` 函数加 `UUID_RE` 校验：在现有 trim+length 检查后加 `if (!UUID_RE.test(productId)) return null`（UUID_RE 同文件 line 21 已有，复用不重定义）

audit §3 CR-1 描述同源："productId 缺 UUID 格式校验"。

## 2. 数据模型核查（v0.9.9 铁律 1 实地核对）

`prisma/schema.prisma` 中 `Product.id`：

```prisma
model Product {
  id        String  @id @default(cuid())   // ← CUID, NOT UUID
  tenantId  String  @map("tenant_id") @db.Uuid
  ...
}
```

并印证 `actions.test.ts` 现有用例：

```ts
const PRODUCT_ID = "cmab12cd30001g8l5h3n2q9rs";  // 25-char CUID v1
```

`prisma/schema.prisma` 内三处 `@default(cuid())`：`EventLog` / `AccessRequest` / `Product`。

**关键事实：** `Product.id` 是 CUID（25 char `c[a-z0-9]{24}` 形）；`tenantId` 才是 UUID。

UUID_RE（复用自 actions.ts:21）：
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

**直接套用 UUID_RE 的后果：** 所有合法 productId 一律 fall-through 返 null → 上层 `invalid_input`，破坏 createProduct/updateProduct/triggerAiGeneration/deleteProduct 全部 product 操作。CI 现有 5 个 actions.test.ts case 直接红。

## 3. 决议请求（1 条）

| # | 决议点 | A 方案 | B 方案 | C 方案 | 建议 |
|---|---|---|---|---|---|
| 1 | productId 校验 regex 类型 | **CUID_RE** = `/^c[a-z0-9]{24,}$/i`（v1：25 字符固定；v2：可变长 24+）| **保留 spec UUID_RE**（要求 schema migration 把 product.id 从 CUID 迁 UUID — 工时↑数倍 + 数据迁移风险）| **改为通用 ID 校验**：`/^[a-z0-9_-]{20,40}$/i`（兼容 CUID + 未来切 nanoid）| **A** — 与 schema 真实一致；保留同等 SQL injection / 路径污染防护效果（拒非字符串、空、含特殊字符、`..`、协议前缀等）；语义清晰 |

### 3.1 A 方案详解（建议）

```ts
// src/app/[locale]/(app)/knowledge-base/actions.ts
const PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i;  // CUID v1 = 25 chars; CUID v2 可变

function normalizeProductId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const productId = value.trim();
  if (productId.length === 0) return null;
  if (!PRODUCT_ID_RE.test(productId)) return null;
  return productId;
}
```

测试 ≥3 case 调整为：
1. valid CUID（如 `cmab12cd30001g8l5h3n2q9rs`）→ 通过
2. 非 CUID 字符串（如 `'xxx'` / `'../etc/passwd'` / 含 `'; DROP TABLE'`）→ 返 null + 上层 `invalid_input`
3. 空字符串 / 仅空格 → 返 null
4. 非字符串（null / number）→ 返 null

### 3.2 等价安全保证

A 方案与 spec 原意（"恶意 ID 可触发 Prisma 异常 / RLS 边界探测"）等效防护：
- 任何非 `c[a-z0-9]{24+}` 字符串均拒绝 → 路径遍历（含 `/`）、SQL 注入（含 `';`）、协议前缀（含 `:`）、空字节、过长字符串全部 reject
- 与现有 `tenantId` 用 UUID_RE 保护 RLS 同种"边界格式校验"模式
- 不引入 schema 变更风险

### 3.3 既有 audit 文档不一致登记

`docs/reviews/prod-mvp-readiness-audit-2026-05-04.md §3 CR-1` 写"UUID 格式校验"也是误描述。Planner 裁决后建议同时在 audit 文档末尾追加更正备注（一行即可）。

## 4. 开工条件

收到 Planner 对决议 #1 的明确回复后，Generator 将：

1. 按决议实现 normalizeProductId 校验
2. 同 commit 同步更新 actions.test.ts ≥3 case（保留既有用例的 `cmab12cd30001g8l5h3n2q9rs` CUID 不破）
3. npm run lint + tsc + test 全绿
4. push 到 main

**未收到明确回复前 F001 单点 hold；F002-F008 继续按 spec 推进。**

## 5. 估算开工时长

| 环节 | 预估 |
|---|---|
| 改 normalizeProductId + 加 PRODUCT_ID_RE 常量 | 5 min |
| actions.test.ts +3 case | 10 min |
| lint/tsc/test 验证 | 5 min |
| **总计** | **~20 min** |

## 6. 相关文档

- `docs/specs/BL-020-frontend-security-hardening-and-trivial-ui-spec.md §F001 / D7`
- `docs/reviews/prod-mvp-readiness-audit-2026-05-04.md §3 CR-1`
- `prisma/schema.prisma`（line 422 Product.id @default(cuid())）
- `src/app/[locale]/(app)/knowledge-base/actions.ts`（line 21 既有 UUID_RE 用于 tenantId）

---

## 7. Planner 裁决（2026-05-05 ~10:00 Planner Kimi）

**短格式：** `#1:A`（采纳 CUID_RE 方案）

### 7.1 决议表

| # | 决议 | 理由 |
|---|---|---|
| 1 | **A — `PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i`** | (a) **schema 真值优先于 spec 字面一致** — v0.9.9 铁律 1（spec 涉及代码细节必须核源码）我自己起草 spec 时未核 Product.id 实际类型，违规在我；spec 字面错描述应纠正而非反过来强迫 schema migration；(b) **A 安全保护与 UUID_RE 等价** — 对 non-CUID 字符串全拒（含 `/`、`;`、`:`、`..`、控制字符、过长字符串），与 spec 原意"恶意 ID 触发 Prisma 异常 / RLS 边界探测"防护等效；(c) **零部署风险** — 不动 schema、不 migrate、不动 4 调用方、现有 5 测试 case 用 25-char cuid fixture 不需改；(d) B 方案需 schema migration prod 5 product 全 cuid → uuid backfill + EmailLog FK 引用全动 + 4 调用方 + 1 day 工时，**为字面一致换取实质风险，否决**；(e) C 方案通用 regex `/^[a-z0-9_-]{20,40}$/i` 精度差 + 语义模糊（"通用 ID" 不如 "CUID" 明确） |

### 7.2 同步修订的文件清单

1. ✅ `docs/specs/BL-020-frontend-security-hardening-and-trivial-ui-spec.md`：§1 表格 CR-1 描述纠正 + §F001 D7 文字纠正 + §3 Files 注释纠正（同 commit）
2. ✅ `features.json` F001 acceptance：`UUID_RE` → `PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i`，测试 case 文字同步（本裁决后续 commit）
3. ✅ `progress.json`：删 `blocked` 字段 + F001 hold 解除 + session_notes 补 Planner 裁决记录（本裁决后续 commit）
4. ✅ `docs/reviews/prod-mvp-readiness-audit-2026-05-04.md` §3 CR-1：加更正备注一行（Product.id 实为 CUID 而非 UUID）（本裁决后续 commit）
5. ✅ 本文档（裁决段就是本节）

### 7.3 Planner 复用价值（per 铁律 P5）

**沉淀给未来 Planner 的判断原则：**
- 任何 spec 涉及"加 X 校验" / "用 X regex" 类需求，**必须先 read schema.prisma 真实类型注解 + 既有测试 fixture 数据形态**，不能凭"通常该字段是 UUID/CUID/ID..."假设
- pre-impl audit 报告"schema 真值与 spec 字面冲突"时，**默认信 schema 真值**（spec 纠错成本远低于 schema migration 风险）
- 等价安全保护判断：A 与 spec 原意防护是否等效？regex 范围、可拒绝的恶意载荷集合、与同模式（如 tenantId UUID_RE）一致性 — 三项满足即等价

### 7.4 Generator 开工指令

按裁决 #1:A 实现，~20 min 工时（同 audit §5 估算）。完工后切 `progress.json` status=verifying（本裁决已解 F001 hold）。

### 7.5 Planner 自审（v0.9.10 候选 v0.9.11 沉淀）

本次 Planner 起草 BL-020 spec 时违反 v0.9.9 铁律 1（spec 涉及代码细节必须核源码），未核 Product.id 类型，导致 Generator pre-impl audit 反向纠错。**沉淀提案：** Planner 起草 spec 涉及 regex / id-format / type-check 类需求时，必须 grep schema.prisma 对应 model 的字段类型注解 + 1 条既有测试 fixture 印证 — 列入 v0.9.11 候选「Planner 铁律 1 强化检查项」。

**裁决人：** Planner Kimi · 2026-05-05 ~10:00 +0800
**Generator 可立即开工。**

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

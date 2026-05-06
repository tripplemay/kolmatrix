# BL-040 Q5 Product targetAudience 字段改 required — Spec

> **状态：** Planner draft → 待 Generator 开工
> **触发：** `docs/reviews/prod-mvp-readiness-audit-2026-05-04.md §5 D1` + `docs/product/MVP-gap-audit-2026-04-30.md P0 §3.3`（PRD §13 Q5 用户答「强制要求 targetAudience」但 MVP 实装为 nullable）
> **作者：** Planner johnsong @ 2026-05-06 09:00
> **依赖：** BL-024 done @ eacbbbb / 历史批次 MVP-internal-demo-prep-F002 已实装前端 UX required（4fd778b 之前的早期 commit）/ BL-035 F005 ownership preflight done
> **预估：** ~1.5h building + 0.5h verifying
> **批次类型：** 普通批次（1 feature 全 `executor:generator`）→ status 流转 `new → planning → building → verifying → done`

---

## 1. 背景与目标

PRD §13 Q5 用户答「强制要求 targetAudience」。MVP 实装时**仅前端 UX 完成**了 required 标记（MVP-internal-demo-prep-F002 早期批次实装 textarea required + 红 *）+ Zod schema 必填校验（src/lib/products/schema.ts:22 `z.string().trim().min(1)`），**但 DB 层 + TS type signature + AI prompt fallback 仍按 nullable 假设**。

audit 列出风险面：
- `prisma/schema.prisma:459 String?` — DB 列允许 NULL
- `src/lib/products/generateAiAssets.ts:175 ?? "Not specified"` — AI prompt 在 targetAudience NULL 时退化为 "Not specified" → 输出泛化邮件
- `actions.ts:89/187 ?? null` — DB 写入仍传 null（zod 已保证非空，传 null 永远不会发生但仍存防御 fallback）
- 5 处 TS type signature `targetAudience: string | null` — 类型不严谨

**用户 2026-05-06 实地核查发现 BL-041 audit 过期（dashboard 3 元素早在 4fd778b @ 2026-05-01 已实装），因此 BL-040+BL-041 合批降级为 BL-040 单独 mini-batch。**

**Definition of Done：**
- 1 feature PASS by Reviewer L1+L2
- prod 5 行 Product targetAudience 数据不破（migration backfill 防御 + 5 行已自然填好，无回退风险）
- AI 素材生成质量提升（删除 "Not specified" fallback，prompt 必传具体受众）
- v0.9.13 §5.1 dogfood：本 feature 不涉及 deploy-script 改，不适用
- v0.9.12 §11 building 中段变种 dogfood：如 grep 漏 type signature caller 触发 partial-pending

---

## 2. 功能清单（1 feature 全 generator）

### F001 · Q5 Product targetAudience 字段改 required（DB + 全栈类型清理）

**Executor:** generator
**Priority:** medium
**预估工时:** 1.5h building + 0.5h verifying

**Audit 引用：**
- DB 层：`prisma/schema.prisma:459` String? + `prisma/migrations/20260424100000_bm1_schema/migration.sql:32` target_audience TEXT （无 NOT NULL）
- TS type 层（5 处）：generateAiAssets.ts:39 / email-generator.ts:30 / video-script-generator.ts:25 / knowledge-base/types.ts:25 / embedding/text.ts:33
- Fallback 层（2 处后端 + 1 处 AI prompt）：actions.ts:89/187 `?? null` + generateAiAssets.ts:175 `?? "Not specified"`
- UI 层（已 required）：ProductModal.tsx:212-219 + schema.ts:22 z.required — **本 feature 不动**（已完成）

**已完成（不在范围内的部分）：**
- ✅ Zod 必填校验（schema.ts:22 `z.string().trim().min(1, "targetAudienceRequired")`）
- ✅ 前端 ProductModal.tsx required HTML 属性 + 红 * 标记
- ✅ e2e 测试 fixtures 全填 targetAudience（bm1-flow / product-flow / embedding-pipeline / seed-demo-products）
- ✅ 5 个 prod Product 全已自然填好 targetAudience（128-151 chars 高质量内容）

### 改动清单（同 commit 全栈一致）

#### 1. Prisma migration `20260507000000_target_audience_required`（DB 层）

```sql
-- BL-040 F001: enforce targetAudience NOT NULL at DB level.
-- Prod 5 rows already filled; staging/local backfill defends against
-- legacy NULL rows from bm1_schema migration era.
-- ROLLBACK: ALTER TABLE product ALTER COLUMN target_audience DROP NOT NULL;

UPDATE product
   SET target_audience = '<未填写，请补充>'
 WHERE target_audience IS NULL OR target_audience = '';

ALTER TABLE product ALTER COLUMN target_audience SET NOT NULL;
```

**注：** rollback 注释（v0.9.10 §rollback-sql 沉淀）+ backfill 防御（虽 prod 已填，staging/local 防御）+ ALTER COLUMN SET NOT NULL（small table，毫秒级）。

#### 2. `prisma/schema.prisma:459` 去问号

```diff
-  targetAudience      String?   @map("target_audience") @db.Text
+  targetAudience      String    @map("target_audience") @db.Text
```

#### 3. 5 处 TS type signature `string | null` → `string`

| 文件:行 | 当前 type | 改后 |
|---|---|---|
| `src/lib/products/generateAiAssets.ts:39` | `targetAudience: string \| null;` | `targetAudience: string;` |
| `src/lib/assets/generators/email-generator.ts:30` | `targetAudience: string \| null;` | `targetAudience: string;` |
| `src/lib/assets/generators/video-script-generator.ts:25` | `targetAudience: string \| null;` | `targetAudience: string;` |
| `src/app/[locale]/(app)/knowledge-base/types.ts:25` | `targetAudience: string \| null;` | `targetAudience: string;` |
| `src/lib/embedding/text.ts:33` | `targetAudience: string \| null \| undefined;` | `targetAudience: string;` （保留 `clean()` 内部空字符串处理）|

#### 4. `actions.ts:89,187` 删 fallback `?? null`（zod 已保证非空）

```diff
-  targetAudience: data.targetAudience ?? null,
+  targetAudience: data.targetAudience,
```

应用 2 处（line 89 createProduct + line 187 updateProduct）。

#### 5. `generateAiAssets.ts:175` 删 AI prompt fallback `?? "Not specified"`

```diff
-    `Target audience: ${input.targetAudience ?? "Not specified"}\n` +
+    `Target audience: ${input.targetAudience}\n` +
```

#### 6. UI 防御 fallback 保留（不动）

| 文件 | 当前 | 决策 |
|---|---|---|
| `ProductModal.tsx:217` | `defaultValue={product?.targetAudience ?? ""}` | **保留** — `product` 在 create 模式是 `undefined`（不是 null），`?? ""` 是合法 textarea defaultValue 防御 |
| `ProductCard.tsx:124` | `{product.targetAudience ?? product.uniqueSellingPoints}` | **保留** — defense-in-depth，旧数据展示防御（虽 type 改 string 后 TS 报 "Expression always truthy"，但 ?? 仍工作；可改为简化 `{product.targetAudience}`，但保留更稳） |

### Acceptance

- [ ] 新 migration `20260507000000_target_audience_required` 文件存在 + 含 ROLLBACK 注释 + BACKFILL + SET NOT NULL
- [ ] 本机 `npx prisma migrate dev` PASS（local DB 5 行 backfill 后 NOT NULL 生效）
- [ ] `prisma/schema.prisma:459` 改为 `String` 不带问号
- [ ] 5 处 TS type signature 改为 `string`（grep `targetAudience: string \| null` 应仅 0 hits — 仅 schema.ts 中的 zod 类型保留）
- [ ] `actions.ts:89,187` 不再含 `data.targetAudience ?? null`
- [ ] `generateAiAssets.ts:175` 不再含 `?? "Not specified"`
- [ ] UI 层 ProductModal + ProductCard 的 ?? fallback 保留（defense-in-depth）
- [ ] 既有测试同步：`schema.test.ts` / `actions.test.ts` / `bm1-schema.test.ts` / `product-flow.test.ts` / `embedding-pipeline.test.ts` / `seed-demo-products.test.ts` / `bm1-flow.spec.ts` 全 PASS（已都填 targetAudience，无影响）
- [ ] 新增 `tests/integration/product-targetaudience-required.test.ts` ≥2 case：(a) DB 直接 INSERT NULL 被拒（NOT NULL constraint）；(b) Zod schema 拒空字符串 trimmed
- [ ] `npm run lint + tsc + test` 全绿（重点 tsc — 5 处 type 改后下游 caller 全自动 typecheck 验证）
- [ ] CI 全绿

---

## 3. 变更文件清单（高层）

```
prisma/migrations/20260507000000_target_audience_required/migration.sql  F001 NEW
prisma/schema.prisma                                                      F001 EDIT (Product.targetAudience String? → String)

src/lib/products/generateAiAssets.ts                                      F001 EDIT (line 39 type + line 175 fallback)
src/lib/assets/generators/email-generator.ts                              F001 EDIT (line 30 type)
src/lib/assets/generators/video-script-generator.ts                       F001 EDIT (line 25 type)
src/lib/embedding/text.ts                                                 F001 EDIT (line 33 type)

src/app/[locale]/(app)/knowledge-base/actions.ts                          F001 EDIT (line 89 + 187 fallback)
src/app/[locale]/(app)/knowledge-base/types.ts                            F001 EDIT (line 25 type)

tests/integration/product-targetaudience-required.test.ts                 F001 NEW (≥2 case)
```

**总改动：** ~10 行（不含 migration / 测试），1 个 migration，1 个新测试文件。

---

## 4. 关键设计决策

### D1 — Migration 含 BACKFILL 防御（虽 prod 已填）
prod 5 行实测已填好（128-151 chars 高质量），但 staging/local 可能有未填 NULL 行（bm1_schema migration era 留下）。BACKFILL `'<未填写，请补充>'` 占位字符串作 defense — 即使 staging 有遗留 NULL，migration 也能自动补 + 提示用户回填（占位字符串 visual cue）。

### D2 — UI 层保留 ?? "" defense-in-depth
ProductModal 创建模式 `product` 是 `undefined`（非 null），`?? ""` 是合法 textarea defaultValue。删除会破创建路径。同样 ProductCard 旧数据展示保留 ?? fallback。

### D3 — embedding/text.ts type 收紧到 `string`，保留 clean() 内部 empty 处理
`embedding/text.ts:33` 当前 type 是 `string | null | undefined`，`clean(input.targetAudience)` 处理 NULL → 空字符串。改 type 为 `string` 后，clean 仍处理 empty string（保护 backfill 占位字符 `<未填写...>` 的特殊处理）。Embedding 路径行为保持。

### D4 — 单 feature 全包，不拆 backend/frontend
5 处 type signature 改 + 1 个 migration 必须**同 commit** 推：
- 改 schema.prisma → tsc 失败（type 不一致）
- 改 type signature 没改 schema.prisma → 5 处下游全报 type mismatch

不拆分能强制 Generator 同 commit 完成（逐处改 + tsc 守门）。

### D5 — generateAiAssets.ts:175 删 fallback 是核心业务价值
audit P0 触发原因。删除后：
- 旧 NULL 路径不复存在（type 收紧 + DB NOT NULL 双保险）
- AI prompt 必传具体 audience → LLM 输出针对性邮件 → 模板使用率提升

---

## 5. v0.9.11 + v0.9.12 + v0.9.13 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.11 §rate-limit | 不涉及（无新 endpoint）|
| v0.9.11 §database-patterns §8 RLS | 不新增表，不适用 |
| v0.9.11 §ai-action-contract §4 max_tokens | 已 done（chat completions 路径 BL-034 F005 已设）|
| v0.9.11 铁律 1 regex/id-format | 不涉及（无 regex 改）|
| v0.9.11 evaluator §16 Node 版本 | Reviewer L1 启动 nvm use 20 |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | **可能触发**：如 Generator grep 漏某下游 caller 的 type signature 导致 tsc fail，主动停 + 短格式裁决 |
| v0.9.12 §database-patterns §8.1 cross-cutting helper | 不涉及（无 RLS migration）|
| v0.9.12 §deploy-patterns §5 auth-gated endpoint | 不涉及（无 endpoint 改）|
| v0.9.12 §evaluator §17 lint warnings 矩阵 | Reviewer reverifying 时按矩阵处理 |
| v0.9.13 §deploy-patterns §5.1 spec deploy-script vs yml | 不涉及（无 deploy-script 改）|
| v0.9.13 §ai-action-contract §4.7 mcp 自动化可达性 | 不涉及（chat completions 路径已 done） |

---

## 6. Definition of Done

### 6.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | prod redeploy 后浏览器走查 `/zh/knowledge-base`：尝试创建 Product 不填 targetAudience → 应被前端 + 后端双校验拒（前端红 * + 后端 zod fieldErrors） | BL-040 done 后 prod redeploy |
| 2 | 实测真触发 KB AI 生成（点 Product 卡 "Generate" → 5 套邮件模板）→ 验证 prompt 不含 "Not specified" 文字（grep aigcgateway log 或抽样邮件文本） | 与 #1 合并 |

### 6.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含新增 ≥2 测试 case）+ CI 全绿
- **L2：** staging git_sha 对齐 + Product 创建/编辑 form 校验 + AI 素材生成 prompt 验证

### 6.3 Soft-watch（不阻塞 done）

无（本 feature 改动小 + 现网数据已自然合规 + 5 处 type 严谨化降低未来回归风险）。

---

## 7. 实装顺序（Generator 接手参考）

```
1. 新建 prisma migration（BACKFILL + SET NOT NULL + ROLLBACK 注释）
2. 改 prisma/schema.prisma:459（去 ?）
3. 跑 npx prisma migrate dev — local DB 应用 + Prisma client regenerate
4. 改 5 处 TS type signature（generateAiAssets / email-generator / video-script-generator / knowledge-base/types / embedding/text）
5. 改 actions.ts:89,187 删 ?? null
6. 改 generateAiAssets.ts:175 删 ?? "Not specified"
7. 新增 tests/integration/product-targetaudience-required.test.ts ≥2 case
8. npm run lint + tsc + test 全绿验证
9. push commit
```

> **Spec lock：** Planner johnsong @ 2026-05-06 09:00。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段发现良性偏差（如 grep 漏 type caller）按 §11 building 中段变种处理。

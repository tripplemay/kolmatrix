# BL-051a Lifecycle Management — Spec（X2 合并 BL-017 token + BL-046 product soft delete / 11 features）

> **状态：** Planner 起草 @ 2026-05-07 14:10（BL-049 building 期间并行；5/12 启动）
> **作者：** Planner johnsong
> **触发：** 用户 5/7 14:00 决议 X2 合并 — BL-017 weekly-report token lifecycle + BL-046 product soft delete 合 1 mini-batch（同 lifecycle 主题），BL-050 dashboard KPI 独立批次
> **预估：** ~2 day Generator + 1h Reviewer + 0.5h Planner
> **批次类型：** 普通批次（11 features 全 `executor:generator`）

---

## 1. 背景与目标

### 1.1 主题一致性（X2 合并理由）

**Lifecycle Management** 主题：「数据从创建 → 使用 → 过期/删除全过程的治理」
- weekly-report token：creation → expiration → revocation → access denial
- product：creation → soft delete → audit trail → cascade impact

合 1 mini-batch 优势：
- Reviewer L2 用同一心智模型走查 token expiry + product soft delete + audit_log 永久保留
- Schema migration 合并（weekly_report.expires_at/revoked_at + product.deleted_at 同文件）
- 节省 ~30 min batch switch overhead + 1 次 verifying

### 1.2 接客户前必须

**接外部客户前 baseline data hygiene：**
- weekly-report 公开链接 token 永不过期 = 安全风险（任何泄漏永久有效）
- product hard delete 默默拉链 campaign/asset/kol_campaign FK = 数据完整性丢失（孤儿 campaign 4425e07e 5/7 已 ops 清理 @ bc69a65；本批次防新孤儿）

### 1.3 Definition of Done

- 11 features 全 PASS by Reviewer L1+L2
- weekly-report token 过期 7 天默认 + revoke API + 撤销立即失效
- product soft delete + 删除前关联检查 + audit_log 永久 trail
- 全栈 list/find queries 过滤 deleted_at IS NULL
- UI 防御 product=NULL 显示「（产品已删除）」
- 单测 ≥7 + 集成测试 ≥3 全 PASS
- staging deploy + Reviewer L2 联合背书

---

## 2. 功能清单（11 features 全 generator）

### Part A：BL-017 — weekly-report token lifecycle (F001-F005)

#### F001 · weekly_report schema migration（expires_at + revoked_at + creator metadata）

**Executor:** generator | **Priority:** high | **预估:** 30 min

**改动：**
- `prisma/schema.prisma` weekly_report model 加 3 列：
  ```prisma
  expiresAt   DateTime? @map("expires_at") @db.Timestamptz
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz
  // creatorUserId 可能已有；如无则加 String @db.Uuid
  ```
- migration 文件 `2026XXXXXXXX_lifecycle_management.sql`（与 F006 同文件）含 ROLLBACK SQL 注释

**Acceptance：**
- [ ] schema.prisma 加 expiresAt + revokedAt
- [ ] migration 文件含 ALTER TABLE ADD COLUMN + ROLLBACK 注释
- [ ] `npx prisma migrate dev` 本机应用 PASS

#### F002 · src/lib/weekly-report/share-token.ts validateToken 加过期/已撤销检查

**Executor:** generator | **Priority:** high | **预估:** 30 min

**改动：** validateToken 函数增加 expiration / revocation 检查；返回 `{ valid: boolean, reason?: 'expired' | 'revoked' | 'invalid' }`

**Acceptance：**
- [ ] validateToken 检查 expires_at < NOW() → invalid (reason='expired')
- [ ] validateToken 检查 revoked_at IS NOT NULL → invalid (reason='revoked')
- [ ] 单测 ≥3 case (expired / revoked / valid)

#### F003 · /shared/weekly-report/[token] page UI 显示 3 状态

**Executor:** generator | **Priority:** high | **预估:** 30 min

**改动：** `src/app/[locale]/(public)/shared/weekly-report/[token]/page.tsx`
- 正常 token → 显示 weekly-report 内容
- expired token → 显示「此分享链接已过期」（含创建时间 + 过期时间）
- revoked token → 显示「此分享链接已被撤销」（含撤销时间）

**Acceptance：**
- [ ] 3 状态分别 UI render（i18n keys 5 locale 同步）
- [ ] 过期/撤销页面不暴露 weekly-report 内容（防止信息泄漏）

#### F004 · /api/weekly-reports/[id]/revoke route — revoke API

**Executor:** generator | **Priority:** medium | **预估:** 30 min

**改动：** 新 route `src/app/api/weekly-reports/[id]/revoke/route.ts`
- POST 设 revoked_at = NOW()
- 仅 owner（creator_user_id 匹配）+ tenant 内可调用
- audit_log 记录 action='weekly_report.revoked'

**Acceptance：**
- [ ] POST endpoint 仅 owner + tenant 可调用
- [ ] revoked_at 落库 + audit_log 写入
- [ ] 401/403 处理（非 owner / 跨 tenant）

#### F005 · weekly-report UI 显示 expiration metadata + revoke button + 单测 ≥3

**Executor:** generator | **Priority:** medium | **预估:** 1h

**改动：**
- weekly-report 创建后页面/列表显示「Expires: YYYY-MM-DD HH:mm」+ 「Created by」+ revoke button
- revoke button 调 F004 API
- 单测 ≥3 case（验证 button render / API 调用 / state 更新）

**Acceptance：**
- [ ] UI metadata 显示 expiration + creator
- [ ] revoke button 调 F004 API + 列表 state 更新
- [ ] 单测 ≥3 全 PASS

---

### Part B：BL-046 — product soft delete + lifecycle integrity (F006-F011)

#### F006 · product schema migration（deleted_at + partial index）

**Executor:** generator | **Priority:** high | **预估:** 30 min

**改动：**
- `prisma/schema.prisma` Product model 加 `deletedAt DateTime? @map("deleted_at") @db.Timestamptz`
- migration 文件（与 F001 同文件）：
  ```sql
  ALTER TABLE product ADD COLUMN deleted_at TIMESTAMPTZ;
  CREATE INDEX product_tenant_active_idx ON product (tenant_id) WHERE deleted_at IS NULL;
  -- ROLLBACK:
  -- DROP INDEX product_tenant_active_idx;
  -- ALTER TABLE product DROP COLUMN deleted_at;
  ```

**Acceptance：**
- [ ] schema.prisma 加 deletedAt
- [ ] migration ALTER + partial index + ROLLBACK 注释
- [ ] `npx prisma migrate dev` PASS

#### F007 · 全栈 list/find queries 加 WHERE deleted_at IS NULL

**Executor:** generator | **Priority:** high | **预估:** 1.5h

**改动：** 5+ 路由扫描加 filter：
- `src/app/[locale]/(app)/knowledge-base/page.tsx` 列表 query
- `src/app/[locale]/(app)/knowledge-base/ProductsClient.tsx`
- `src/app/[locale]/(app)/knowledge-base/ProductModal.tsx` (单个 product 查时如果是 deleted 应处理)
- `src/app/[locale]/(app)/assets/...` composer 加载 product list
- `src/app/[locale]/(app)/outreach/...` composer 加载 product list
- `src/lib/discovery/smart-match.ts` 找 product
- `src/lib/embedding/kol-embed.ts` 用 product
- `src/app/[locale]/(app)/campaigns/...` campaign 创建时 product picker

**Acceptance：**
- [ ] grep `prisma.product.find` + `tx.product.find` 全 hits 验证已加 deleted_at IS NULL filter
- [ ] grep 漏的路径在 commit message 列出（覆盖检查清单）

#### F008 · deleteProduct 改 soft delete + 关联检查 + audit_log

**Executor:** generator | **Priority:** high | **预估:** 1h

**改动：** `src/app/[locale]/(app)/knowledge-base/actions.ts deleteProduct()`：
- 改为 `UPDATE product SET deleted_at = NOW() WHERE id = ...`（软删；不 DELETE）
- 删除前检查 campaign/asset/kol_campaign 关联：
  - 如有引用 → 返回 `{ ok: false, error: 'has_references', count: { campaign, asset, kol_campaign } }`（用户决策弹窗 cascade soft 或取消）
  - 用户确认 cascade → 同时软删关联（campaign 不删；asset.deleted_at 设；kol_campaign 不动 — 设计确认）
- 写 audit_log：
  ```typescript
  await logAudit({
    action: 'product.deleted',
    resource_type: 'product',
    resource_id: productId,
    payload: { product_name, cascade_count: { campaign, asset, kol_campaign }, soft_delete: true }
  });
  ```

**Acceptance：**
- [ ] deleteProduct 改 UPDATE deleted_at = NOW()（不 DELETE）
- [ ] 删除前检查 campaign + asset + kol_campaign 关联
- [ ] 有引用时返回 has_references error + count
- [ ] audit_log 记录 product.deleted 含 cascade_count
- [ ] 单测 ≥3 case (无关联 / 有关联 / cascade)

#### F009 · UI 防御 — /knowledge-base 列表 + /campaigns/[id] product=NULL 处理

**Executor:** generator | **Priority:** medium | **预估:** 30 min

**改动：**
- `/knowledge-base` 列表已通过 F007 自动过滤软删
- `/campaigns/[id]` 详情页对 product=NULL 显示「（产品已删除）」灰显 + tooltip「此活动关联的产品已被删除，可在知识库恢复或归档」
- ProductCard / ProductModal 类似处理

**Acceptance：**
- [ ] /campaigns/[id] product=NULL 显示「（产品已删除）」灰显
- [ ] tooltip 含恢复 hint
- [ ] /knowledge-base 列表 0 软删行（F007 自动过滤）

#### F010 · 单测 ≥4 + 集成测试 ≥2

**Executor:** generator | **Priority:** high | **预估:** 1h

**改动：** 测试覆盖：
- 单测 ≥4：deleteProduct 软删 / list 过滤 / detail 防御 / audit_log 写入
- 集成 ≥2：tests/integration/product-soft-delete.test.ts (full flow soft delete + cascade check + audit_log)

**Acceptance：**
- [ ] tests/unit/products-soft-delete.test.ts ≥4 case PASS
- [ ] tests/integration/product-soft-delete.test.ts ≥2 case PASS
- [ ] L1 全套 npm test 全绿

#### F011 · audit_log 永久保留 + 防新孤儿验证

**Executor:** generator | **Priority:** medium | **预估:** 15 min

**改动：** 集成测试验证：
- 触发 deleteProduct → audit_log 行数 +1（不会被 cascade 删）
- soft delete 后 product 物理仍在 DB；FK SET NULL 不再触发（关联保留）
- 反例：用 raw SQL 模拟 BL-046 之前 hard delete → 应永远不可能（deleteProduct 已改 soft）

**Acceptance：**
- [ ] 集成测试验证 audit_log permanence
- [ ] 验证 soft delete 后 campaign/asset/kol_campaign 关联保留
- [ ] commit message 注明「孤儿 campaign 4425e07e 5/7 已 ops 清理 @ bc69a65；本批次防新孤儿」

---

## 3. 变更文件清单

```
prisma/schema.prisma                                           F001+F006 EDIT (weekly_report 3 列 + product 1 列)
prisma/migrations/2026XXXXXXXX_lifecycle_management/migration.sql  F001+F006 NEW (ALTER + index + ROLLBACK)

src/lib/weekly-report/share-token.ts                          F002 EDIT (validateToken 加过期/撤销检查)
src/app/[locale]/(public)/shared/weekly-report/[token]/page.tsx  F003 EDIT (3 状态 UI)
src/app/api/weekly-reports/[id]/revoke/route.ts                F004 NEW (revoke API)
src/features/weekly-report/...                                 F005 EDIT (UI metadata + revoke button)
i18n locales (en/zh/ja/ko/es).json                             F003+F005 EDIT (~6 keys: expired/revoked/expires/createdBy/revoke)

src/lib/products/* (list/find queries)                         F007 EDIT (5+ 文件加 WHERE deleted_at IS NULL filter)
src/app/[locale]/(app)/knowledge-base/actions.ts               F008 EDIT (deleteProduct 改 soft + 关联检查 + audit_log)
src/app/[locale]/(app)/campaigns/[id]/...                      F009 EDIT (product=NULL UI 防御)
src/app/[locale]/(app)/knowledge-base/ProductCard.tsx + ProductModal.tsx  F009 EDIT (类似防御)
i18n locales 5 file                                             F009 EDIT (~3 keys: productDeleted/productDeletedTooltip)

tests/unit/weekly-report-token-lifecycle.test.ts               F005 NEW (≥3 case)
tests/unit/products-soft-delete.test.ts                        F010 NEW (≥4 case)
tests/integration/weekly-report-token.test.ts                  F005 NEW (≥1 case)
tests/integration/product-soft-delete.test.ts                  F010+F011 NEW (≥2 case)
```

---

## 4. 关键设计决策

### D1 · Schema migration 合并（不拆 2 文件）
- weekly_report + product 同 migration 文件 `2026XXXXXXXX_lifecycle_management.sql` 部署一次
- ROLLBACK 顺序倒置（先 product index → product col → weekly_report cols）
- 优点：1 次 prisma generate；CI 1 次 migrate smoke

### D2 · Product soft delete 不级联（保留 campaign / asset 关联）
- F008 cascade 仅指 asset.deleted_at（如有）；campaign 保留（business 决策：删 product 不应自动删 campaign，让 marketer 手动决定）
- kol_campaign 不动（关联 KOL 仍有效）

### D3 · 删除前关联检查弹窗（不直接拒绝）
- F008 返回 has_references error + count，UI 弹「此产品有 N 个关联（X campaign / Y asset），确认删除？」
- 用户确认 → 软删 product + 关联 asset
- 取消 → 不删

### D4 · weekly-report token 默认过期 7 天
- F001 schema 不强制；F005 UI 创建时默认设 expires_at = NOW() + 7 day
- 用户可自定义（UI 下拉 1d/7d/30d/never）— 'never' 设 expires_at = NULL（不过期）

### D5 · audit_log 永久保留（无 FK cascade）
- audit_log 表结构已确认无 FK to product / weekly_report（5/7 ops 时实地核查）
- 软删 product 后 audit_log 仍能查到 resource_id=product_id 历史

### D6 · 5/12 实施顺序（合并优先 part B 再 part A，按依赖）
- F006 schema migration（产品 + weekly-report 同 migration）
- F007 全栈 list filter（最广改动 + 影响多路由）
- F008 deleteProduct 改 soft + 关联检查
- F009 UI 防御
- F002 share-token validation
- F003 page UI
- F004 revoke API
- F005 创建/列表 UI
- F010+F011 测试

### D7 · 不入 ADR-014（待 BL-051a done 后评估）
- 如更多表（campaign / KOL）扩展 soft delete 出现需求，启 ADR-014 "Soft delete 范式 + Lifecycle 管理"
- 本批次仅 product 一个 soft delete，不必沉淀 ADR

---

## 5. v0.9.x 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.14 §planner.md 铁律 1 完整 pattern grep | F007 grep `prisma.product.find` + `tx.product.find` 全栈漏配检查 — 类似 BL-040 retroactive 漏 grep ?? 'Not specified' 反例 |
| v0.9.15 #1 跨 pool 复现（待 5/7 BL-049 沉淀完成） | F010 集成测试 forks pool + threads pool 都跑 |
| v0.9.15 #2 测试 stub environment-agnostic | F010 fixture 用 Map-backed / 不依赖 jsdom 默认 |
| v0.9.13 §5.1 spec deploy-script 同 commit | 不涉及 deploy-script |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | 可能触发：F007 grep 漏路径时主动停 + 短格式裁决 |

---

## 6. 实装顺序（Generator 接手参考）

```
1. F001 + F006 schema migration（合并文件）
2. F007 全栈 list filter（最广改动）
3. F008 deleteProduct 改 soft + 关联检查 + audit_log
4. F009 UI 防御（/campaigns/[id] product=NULL + ProductCard/Modal）
5. F002 share-token validation
6. F003 /shared/weekly-report/[token] page 3 状态
7. F004 /api/weekly-reports/[id]/revoke
8. F005 weekly-report UI metadata + revoke button
9. F010 单测 ≥4 (products) + ≥3 (weekly-report)
10. F011 集成测试 ≥3 (含 audit_log permanence)
11. lint + tsc + test 守门
12. push commit (建议 2-3 commits 分 part A + part B + 测试)
```

---

## 7. Definition of Done

### 7.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | prod redeploy 后浏览器走查（仅 sample 1-2 path）：(a) /knowledge-base 删 product 弹关联确认 (b) /shared/weekly-report/<expired_token> 显示「已过期」 | BL-051a done 后 prod redeploy |

### 7.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含新 ≥7 单测 + ≥3 集成）+ CI 全绿
- **L2 staging：** (a) /knowledge-base 删 product 触发关联检查弹窗 + 软删生效 (b) /campaigns/[id] product=NULL 显示防御 (c) /shared/weekly-report/[expired_token] 3 状态显示 (d) /api/weekly-reports/<id>/revoke 调用成功 + 软删生效

### 7.3 Soft-watch（不阻塞 done）

- prod 上线后第 1 周 audit_log 'product.deleted' 行计数（验证 deleteProduct 真改 soft）
- prod weekly-report token expiry 实战触发（用户首次设 7 day 过期）
- ADR-014 视未来 soft delete 扩展评估

---

> **Spec lock：** Planner johnsong @ 2026-05-07 14:10。Generator 5/12 接手前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段良性偏差按 §11 处理。
> **关联：**
>   - 原 BL-017 closed-merged-into-BL-051a (audit trail in backlog.json)
>   - 原 BL-046 closed-merged-into-BL-051a (audit trail in backlog.json)
>   - BL-050 dashboard KPI 真趋势化 5/12 BL-051a done 后独立批次 (~30-60 min)
>   - 孤儿 campaign 4425e07e 5/7 已 ops 清理 (commit bc69a65)；本批次 F011 防新孤儿

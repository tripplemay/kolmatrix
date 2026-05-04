# BL-031 — Composer locale 过滤 + product 自动过滤 + Backfill RLS hotfix

> 状态：**待 Generator 实现**（progress.json status=building）
> 触发：BL-030 部署+backfill 完成后用户在 prod 反馈 "邮件中心选 PUBG Mobile — Season 30 活动，模板列表只能选系统模板，看不到产品自己的模板"。Planner Phase 1 调研发现 2 真 bug + 1 UX 软坑 + 1 BL-030 backfill 脚本残留 bug，合并 1 mini-batch 修。

---

## 1. 背景

BL-030 完整迁移 KB→Asset 后，Planner 用 SQL 直跑 backfill 25 行（绕过 createAsset 的 dual-write）。**Bug B 镜像残缺已 Planner 在 BL-031 启动前 SQL ops 修补**（15 条 email_template 镜像入表，FK 已安全）。本批次专注 3 项 Generator 改动 + 1 项 framework 沉淀。

### 1.1 残留问题

| ID | 描述 | 来源 | 修法 |
|---|---|---|---|
| **A** | `loadAssetsForComposer` locale 过滤误及 user/ai_generated（应仅作用于 system_seed）| F001 hardcoded locale='en' + composer 严格按 UI locale 过滤 | F001 改 query 逻辑 |
| **C** | composer 不按选中 campaign 自动 productFilter，用户须手动下拉 | OutreachComposer.tsx:968 productFilter 默认 null | F002 改组件初值 |
| **D** | BL-030-F003 backfill 脚本 `withPlatformAdmin` 不解 product 表 RLS（product_isolation 只认 app.tenant_id）→ scanProducts 永返 0 | scanProducts 误用 RLS 旁路 + spec/Generator 都未核 pg_policy 实物 | F003 改 scanProducts per-tenant 扫 + 新建 database-patterns.md 沉淀 RLS 旁路矩阵 |

### 1.2 Definition of Done

- [ ] 3 features 全 PASS + Reviewer L1+L2 签收
- [ ] Staging 浏览器：/zh/outreach 选 PUBG Mobile — Season 30 → 模板下拉自动收窄到 PUBG Mobile 3 个 email + system_seed_zh 5 个；用户切 product filter 到全部 → 看到所有 5 产品 ai_generated 共 15 条 + 5 zh system_seed
- [ ] backfill 脚本本地 mock 跑：3+ tenant fixture，scanProducts 返回所有跨 tenant 产品（per-tenant 扫累加），实跑写入 Asset 行符合 spec §3
- [ ] framework/harness/database-patterns.md 新建，含 "RLS 旁路矩阵"（产品/asset/audit_log 只认 tenant_id；user 表含 platform_admin 旁路；migration 时 superuser 兜底）
- [ ] prod redeploy 后用户 /zh/outreach 三验通过

---

## 2. 关键设计决策（Planner 已锁，Generator 不得变更）

### D1 — locale 过滤的 source 切分逻辑

**决策：** `loadAssetsForComposer` locale 过滤仅作用于 `source = system_seed` 行；`user_created` / `ai_generated` / `imported` 行不受 UI locale 限制全显示。

**理由：**
- system_seed 的多语种是产品方提供的对应翻译（5×en + 5×zh），按 UI 给用户对应版本是正确本地化
- user/ai_generated 是用户自己创意/AI 生成内容，AI 写啥就啥（KB 提示词目前锁英文），中文 marketer 也应能看到自己的英文模板，不能因 UI 切语言隐藏
- Locale fallback (templates.ts:77-80) 现已处理 system_seed 在 zh 时无对应行 → fallback en；user 行无 fallback 是设计漏洞（本 D1 关闭）

**Prisma where 形式（F001 实装）：**
```ts
const where: Prisma.AssetWhereInput = { type, status: "published" };
if (locale) {
  where.OR = [
    { source: { not: "system_seed" } },                                  // user-owned: locale-agnostic
    { content: { path: ["locale"], equals: locale } },                   // system_seed: locale-filtered
  ];
}
// search / productId 过滤照旧 AND 与上述 OR 组合
```

### D2 — productFilter 默认值 = selectedCampaign.productId

**决策：** OutreachComposer `productFilter` 初值改为 `selectedCampaign?.productId ?? null`，且 `selectedCampaignId` 切换时同步更新（useEffect 或 derived）。

**理由：**
- 用户从 campaign 选择切到 composer 的心智 = "看这个活动的模板" → productId 已隐含
- 不锁死，用户可手动改回 "全部产品" 看跨产品库
- 如 selectedCampaign 无 productId（边角 campaign 未关联 product）则 fallback null（全显示）

### D3 — backfill 脚本 scanProducts 改 per-tenant 扫

**决策：** `scripts/migrate-product-aiassets-to-asset.ts` 内 `scanProducts` 不再用 `withPlatformAdmin`；改为：

1. 用 raw SQL 直查 `tenant` 表的所有 `tenant_id`（product 表 RLS 也阻 cross-tenant scan，故先经 tenant 表枚举）
2. 对每个 tenant：`withTenant(tenantId)` 内查 `product` WHERE aiAssets ready + has emailTemplates/videoScripts → 累加 ProductScanRow 列表
3. 返回累加结果给 backfillProduct 循环

**为什么不改 RLS policy：** product 表 RLS 加 platform_admin 旁路是 schema migration，影响 prod 现网；scanProducts 自己 per-tenant 扫不动 schema 是低风险路径。

### D4 — 新建 framework/harness/database-patterns.md

**决策：** 新建文件，首章节 "RLS 旁路矩阵"，沉淀本次坑：

| 表 | RLS policy 旁路条件 | 适用场景 |
|---|---|---|
| `user` | `app.tenant_id` = uuid OR `app.is_platform_admin` = true | auth credentials 流（先知 email 后知 tenant）|
| `product` / `asset` / `audit_log` / `campaign` 等 | 仅 `app.tenant_id` = uuid | 业务读写都要先 withTenant |
| 数据迁移 / cross-tenant ops | 绕 RLS 用 sudo postgres superuser psql 直跑 | backfill / migration 脚本 |

后续 batch 涉及"扫所有 tenant"操作时必读本矩阵。

---

## 3. Files & 实装范围

**修改：**
- `src/lib/assets/queries.ts`（F001 — D1 改 where 条件）
- `src/lib/assets/__tests__/queries.test.ts`（F001 — 测试加：zh locale 时 ai_generated en 行也返回；en locale 时 zh system_seed 不返回；纯 productId / search 过滤不受影响）
- `src/app/[locale]/(app)/outreach/OutreachComposer.tsx`（F002 — productFilter 初值 + selectedCampaign 切换同步）
- `src/app/[locale]/(app)/outreach/__tests__/OutreachComposer*.test.tsx`（F002 — 测试加：mount 后 productFilter === selectedCampaign.productId / 切 campaign 后 productFilter 跟着切 / null campaign 不崩 / 用户手动改后不被覆盖）
- `scripts/migrate-product-aiassets-to-asset.ts`（F003 — scanProducts 重写）
- `scripts/__tests__/migrate-product-aiassets-to-asset.test.ts`（F003 — 测试 fixture 改 2+ tenant 验 per-tenant 累加 + 既有 4 case 不变）

**新增：**
- `framework/harness/database-patterns.md`（F003 — D4 RLS 旁路矩阵）

---

## 4. Out of scope

- `generateAiAssets` 改写支持多语种生成（KB 提示词当前锁英文，跨语种需重做 prompt + system_seed 镜像策略 — 留长期 batch）
- 拆 dual-write email_template（计划 1 sprint 后清理批次同步处理）
- `loadOutreachTemplates` fallback 简化（current zh→en for system_seed only）— D1 关闭后此 fallback 仍有用（zh tenant 无 zh system_seed 时仍 fallback），不动
- Composer "保存为新模板" 按钮 / 模板编辑器 UX 改造

---

## 5. 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F001 Prisma OR + nested content path 语法不熟 | low | medium | 测试 4 case 必跑覆盖 zh/en × system_seed/user 矩阵 |
| F002 productFilter 自动切换 vs 用户手动改 race | medium | low | useState + useEffect 标志位区分 "user has touched filter" |
| F003 scanProducts per-tenant 扫慢（如 tenant 多）| low | low | tenant 表当前 1 行；测试 mock 加 multi-tenant fixture 验正确性 |
| D4 database-patterns.md 与现 schema.prisma RLS 注释重复 | low | none | 不重复 schema 内容，只列旁路矩阵 + ops 决策树 |
| Bug A 修后老 prod email 数据漏 dual-write 仍会显形 | none | none | Planner 已 SQL 镜像 15 条入 email_template，不会撞 FK |

---

## 6. 部署顺序（用户操作）

1. BL-031 done + Reviewer 签收
2. GitHub Actions → Deploy to Production → main
3. 浏览器 prod 三验：
   - /zh/outreach 选 PUBG Mobile — Season 30 → 模板列表自动到 PUBG Mobile 3 条 email
   - 切 product filter → 看到全部 ai_generated 15 条 + 5 zh system_seed
   - 选一个 PUBG Mobile email → Send Test → Resend 200（template_id FK 已 BL-031 启动前 SQL 修）
4. 报回，Planner done 收尾

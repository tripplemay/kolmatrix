# BL-030 — KB → Asset 表数据通路完整迁移（hotfix + 长期修）

> 状态：**待 Generator 实现**（progress.json status=building）
> 触发：用户 prod 反馈"KB 页面为 Clash Royale 生成素材成功，但 /assets 库看不到"。Prod DB 验证：5 产品 × (3 emails + 2 videos) = 35 条素材流落在 `Product.aiAssets` JSON，`Asset` 表 0 行 ai_generated。
> ADR-011 §Context 13-19 行原话：本就是 BL-025 要修的 0% 接通问题，scope 当时只覆盖 /assets Wizard 路径，KB 页面 `generateAiAssets` 旧 JSON 写入路径未迁移。

---

## 1. 背景与目标

### 1.1 现状（prod sha a9c4ef8）

| 数据通路 | 写 | 读 |
|---|---|---|
| `/assets` Wizard 生成 | ✅ 写 `Asset` 表（`generateAssetAction`，BL-025-F003） | ✅ `/assets` 库读 Asset 表；`/outreach` composer 读 Asset 表（BL-025-F006） |
| KB 页面 Generate（创建产品 / 编辑产品 / Generate AI Assets 按钮 3 路） | ❌ 只写 `Product.aiAssets` JSON 字段（旧 BM1-F003 路径，未迁移） | ❌ 仅 KB 页面 ProductCard chip + ProductModal 面板自己读，不接 Asset 表 |

**用户体验症状：** KB 生成成功页面 ✓ → /assets 库无新条目 → composer 选 Clash Royale 也无对应模板 → 用户认为生成失败。

### 1.2 目标（方案 B 完整迁移，对齐 ADR-011）

1. **唯一数据源：** KB 生成完成后，3 emails + 2 videos 入 `Asset` 表（`source=ai_generated`, `status=published`）
2. **缩水 `Product.aiAssets` JSON：** 仅保留生成状态追踪（pending / ready / failed），不再含 `emailTemplates` / `videoScripts` 内容
3. **UI 切换数据源：** KB 页面 ProductCard chip + ProductModal 面板改读 Asset 表（withTenant + queries）
4. **Backfill 现有数据：** 一次性脚本把 prod 5 产品的 35 条 JSON 内容转为 Asset 行，迁移完清 JSON content
5. **Audit log 完整：** 每条 createAsset 后调 `logAudit({action: "asset.generated"})`，与 /assets Wizard 一致

### 1.3 Definition of Done

- [ ] 所有 5 features acceptance 全 PASS
- [ ] Reviewer L1+L2 签收
- [ ] Staging 部署后 KB 创建新产品 + Generate → /assets 库立即可见 5 条新 Asset（3 email + 2 video_script）
- [ ] Staging 跑 backfill 脚本 dry-run + 实跑 → 35 条 Asset 创建成功 + Product.aiAssets content 清空 + idempotent 重跑无副作用
- [ ] Prod redeploy 后用户 SSH 跑 backfill 脚本 → 5 产品 × 5 = 25+10 = 35 条 Asset 入库
- [ ] composer 选 Clash Royale → 3 个 email 模板可见可选

---

## 2. 关键设计决策（D1-D5，2026-05-04 用户全 A 锁定，Generator 不得变更）

| ID | 决策 | 选定方案 | 理由 |
|---|---|---|---|
| D1 | KB 生成的 `Asset.status` | **`published`** | 用户在 KB 点 Generate 心智 = "立即可用"，composer 只读 published；与 /assets Wizard 的 draft 不同（Wizard 是用户创意产出，需 review） |
| D2 | `Asset.name` 命名 | **语义化（按提示词三类邮件 / 两类视频）** | 见 §3.1 命名表；通用 v1 编号丢失 KB 生成的固有语义（initial outreach / follow-up / signing invitation 等） |
| D3 | `Product.aiAssets` JSON 字段处置 | **缩水保留为 status 追踪器** | 字段保留，仅含 `{status, requestedAt\|generatedAt\|failedAt, error?}`；`emailTemplates`/`videoScripts` 字段在生成时不写入；backfill 把已有内容转 Asset 后清掉。无 schema migration，回滚成本低 |
| D4 | Backfill 执行方式 | **独立脚本 + dry-run + idempotent + 用户 SSH 手跑** | 5 产品 35 条数据量小、一次性；回滚易（Asset.metadata.backfilledFrom 标记可批删） |
| D5 | 顺带修 audit log | **新版 generateAiAssets 每条 createAsset 后 logAudit asset.generated** | 与 /assets Wizard 对齐；老 `void logEvent product.ai_generate_requested` 静默失败问题（独立 bug）不在本批次修 |

---

## 3. 实现细节

### 3.1 Asset 命名表（D2 锁定）

**KB 提示词（`src/lib/products/generateAiAssets.ts:94-97`）明确生成顺序：**

| Asset.type | 索引 | Asset.name 格式 | 来源 |
|---|---|---|---|
| `email` | 0 | `{productName} — Initial outreach` | "initial KOL outreach" |
| `email` | 1 | `{productName} — Follow-up` | "follow-up" |
| `email` | 2 | `{productName} — Signing invitation` | "signing invitation" |
| `video_script` | 0 | `{productName} — YouTube 60s` | "60-second YouTube promo" |
| `video_script` | 1 | `{productName} — TikTok 15s` | "15-second TikTok short" |

**示例（Clash Royale）：**
- `Clash Royale — Initial outreach`
- `Clash Royale — Follow-up`
- `Clash Royale — Signing invitation`
- `Clash Royale — YouTube 60s`
- `Clash Royale — TikTok 15s`

### 3.2 Asset.content 形态（与 Wizard 一致 — `src/lib/assets/schemas.ts`）

```ts
// email
{ subject: string, body: string, locale?: string, variables?: Record<string,string> }
// video_script
{ title: string, script: string, durationHint?: string }
```

KB 生成的 JSON 已是 `{subject, body}` / `{title, script}` 形态 → 直接 pass through，无 schema 转换。

### 3.3 Asset.metadata 形态

KB 生成（新流程 + backfill 一致）：
```ts
{
  source: "kb_generation",                  // 区分来自 KB 路径 vs Wizard
  productId: <productId>,
  templateRole: "initial_outreach"|"follow_up"|"signing_invitation"|"youtube_60s"|"tiktok_15s",
  generatedAt: ISO string,
  traceId: <aigcgateway choice id>,
  // backfill 专属（仅 backfill 脚本写入）：
  backfilledFrom: { productId, sourceField: "aiAssets.emailTemplates"|"aiAssets.videoScripts", index: number }
}
```

`backfilledFrom` 字段用于 backfill 幂等性判断 + 回滚。

### 3.4 缩水后 `Product.aiAssets` 形态（D3 锁定）

```ts
// pending
{ status: "pending", requestedAt: ISO }
// ready
{ status: "ready", generatedAt: ISO }   // 注意：不再有 emailTemplates / videoScripts 字段
// failed
{ status: "failed", error: string, failedAt: ISO }
```

**TypeScript 类型 `ProductAiAssets`（`src/lib/products/generateAiAssets.ts:32-46`）需更新：删 `ProductAiAssetContent` 部分。**

### 3.5 KB UI 数据源切换（F002）

**新查询函数（写在 `src/lib/assets/queries.ts`）：**

```ts
export interface ProductAssetCounts {
  emailCount: number;
  videoCount: number;
}

export async function loadProductAssetCounts(
  tx: Prisma.TransactionClient,
  productIds: string[]
): Promise<Map<string, ProductAssetCounts>> {
  // 单次 groupBy 查询返回所有 productId 的计数
  // RLS 已通过 withTenant 上下文生效
}
```

**`page.tsx` 调用：** 与现有 `tx.product.findMany` 同 Promise.all，把 counts 注入 product DTO。

**`ProductCard.tsx`：** `emailCount`/`videoCount` 改从 `product.assetCounts` 读，删除 `aiAssets.emailTemplates.length` 引用（line 63-64）。

**`ProductModal.tsx` "AI Assets Generated" 面板（line 246-280）：** 新增 server action `loadProductAssets(productId)` 返回该 product 下所有 Asset 列表，渲染条目（name + status badge + 跳转 /assets/{id}）。`aiReady` 判断改为 `aiAssets?.status === "ready"`（仅 status 字段，不读 content）。

### 3.6 Backfill 脚本（F003）

**位置：** `scripts/migrate-product-aiassets-to-asset.ts`

**调用方式：**
```bash
# Dry-run（默认，仅打印将创建的 Asset 数量 + 不实际写入）
npx tsx scripts/migrate-product-aiassets-to-asset.ts

# 实跑
npx tsx scripts/migrate-product-aiassets-to-asset.ts --execute
```

**算法：**
1. `withPlatformAdmin`（绕 RLS 扫全 tenant）查询所有 `product WHERE aiAssets->>'status' = 'ready' AND (aiAssets ? 'emailTemplates' OR aiAssets ? 'videoScripts')`
2. 对每个 product：
   - 对每个 emailTemplate (i in 0..N-1)：检查 `Asset WHERE source='ai_generated' AND product_id=X AND metadata->'backfilledFrom'->>'index' = i AND metadata->'backfilledFrom'->>'sourceField' = 'aiAssets.emailTemplates'` 是否存在 → 存在跳过（idempotent），不存在 createAsset
   - 同上处理 videoTemplates
3. 全部 createAsset 完成后，`tx.product.update` 把 `aiAssets` 缩水为 `{status: "ready", generatedAt: <原 generatedAt>}`
4. 输出统计：扫描产品数 / 已存在跳过 / 新创建 / 失败

**关键：** 必须用 `withTenant(product.tenantId, ...)` 包裹每个产品的 createAsset，否则 RLS 阻止写入。

### 3.7 重写后 `generateAiAssets`（F001）

**主要变化（伪代码）：**

```ts
export async function generateAiAssets(input, opts) {
  // 调 aigcgateway 生成 JSON（同现状）
  const parsed = parseAndValidate(raw);

  // 改：写 Asset 表 + 缩水 Product.aiAssets
  await withTenant(input.tenantId, async (tx) => {
    // 5 次 createAsset（按 §3.1 命名表 + §3.3 metadata）
    const createdAssets: AssetDetail[] = [];
    for (const [i, email] of parsed.emailTemplates.entries()) {
      const detail = await createAsset(tx, input.tenantId, {
        type: "email",
        name: deriveName(input.name, "email", i),
        content: email,
        source: "ai_generated",
        status: "published",       // D1
        productId: input.productId,
        createdBy: null,           // KB 生成无明确 user actor（fire-and-forget）
        metadata: { source: "kb_generation", productId, templateRole: ROLES.email[i], generatedAt, traceId },
      });
      createdAssets.push(detail);
    }
    // 同上处理 videoScripts
    for (const [i, video] of parsed.videoScripts.entries()) { ... }

    // 缩水 Product.aiAssets（D3）
    await tx.product.update({
      where: { id: input.productId },
      data: { aiAssets: { status: "ready", generatedAt: new Date().toISOString() } },
    });

    return createdAssets;
  }).then(async (createdAssets) => {
    // D5：每条 logAudit（在 withTenant 外，与 generateAssetAction 一致 — `src/app/[locale]/(app)/assets/actions.ts:281-298`）
    for (const asset of createdAssets) {
      await logAudit({
        actorId: SYSTEM_ACTOR_ID,            // KB fire-and-forget 无 user actor，使用 system 标识
        action: "asset.generated",
        targetType: "asset",
        targetId: asset.id,
        tenantId: input.tenantId,
        after: { assetId: asset.id, productId: input.productId, type: asset.type, source: "kb_generation" },
      });
    }
  });
}
```

**`SYSTEM_ACTOR_ID`：** logAudit `actorId` 必填（`src/lib/audit/log.ts:21`）。KB 生成是 fire-and-forget，调用方传入了 userId 但 `generateAiAssets` 当前签名未接 — **Generator 决定**：(a) 改 `GenerateAiAssetsInput` 加 `actorUserId: string` 字段，由 actions.ts 传入；或 (b) 用固定 SYSTEM uuid。**推荐 (a)** — 更准确还原 actor。

### 3.8 调用方传 actorUserId（F001 同步改）

`src/app/[locale]/(app)/knowledge-base/actions.ts` 三处 `void generateAiAssets({...})` 调用（line 99 / 177 / 235）需补传 `actorUserId: userId`。`generateImmediately` 流程在 createProduct/updateProduct 已读出 `userId`。`triggerAiGeneration` 同样可用。

---

## 4. Out of scope

- **完全删除 `Product.aiAssets` 字段（D3 B 方案）：** 留待后续清理批次（观察 1 sprint 无回归后再做 schema migration）
- **`logEvent` 静默失败修复（独立坑 — D5 提及）：** audit_log 5 条 KB 生成无审计，是 `void logEvent(...)` fire-and-forget + 可能的 promise 拒绝吞掉。本批次只修 `generateAiAssets` 内部调 logAudit，不改 logEvent
- **KB 页面 i18n 串审查：** ProductCard/Modal 已有 `t("emailTemplates", { count })` 等串，文案不动
- **/outreach composer 直接显示 KB 生成模板的 productId 关联：** 已通过 BL-025-F006 `loadAssetsForComposer(productId)` 自然支持
- **Wizard 路径与 KB 路径的 Asset 区分 UI：** Asset.metadata.source 区分 `kb_generation` vs Wizard 的无 source 字段，但 UI 不显示这个差异（用户只关心 product + name + 内容）

---

## 5. 文件清单

**新增：**
- `scripts/migrate-product-aiassets-to-asset.ts`（F003）
- `scripts/__tests__/migrate-product-aiassets-to-asset.test.ts`（F004）

**修改：**
- `src/lib/products/generateAiAssets.ts`（F001 — 主改写）
- `src/lib/products/__tests__/generateAiAssets.test.ts`（F004 — 单测改写，断 createAsset + logAudit 调用）
- `src/app/[locale]/(app)/knowledge-base/actions.ts`（F001 同步 — 三处补传 actorUserId）
- `src/app/[locale]/(app)/knowledge-base/page.tsx`（F002 — Promise.all 加 loadProductAssetCounts）
- `src/app/[locale]/(app)/knowledge-base/types.ts`（F002 — Product DTO 加 assetCounts 字段；ProductAiAssets 类型缩水）
- `src/app/[locale]/(app)/knowledge-base/ProductCard.tsx`（F002 — 改读 product.assetCounts）
- `src/app/[locale]/(app)/knowledge-base/ProductModal.tsx`（F002 — "AI Assets Generated" 面板改读 Asset 表）
- `src/app/[locale]/(app)/knowledge-base/__tests__/ProductCard.test.tsx`（F004 — 测试改 fixture）
- `src/lib/assets/queries.ts`（F002 — 新增 `loadProductAssetCounts`）
- `src/lib/assets/__tests__/queries.test.ts`（F004 — 加 loadProductAssetCounts 用例）

---

## 6. 风险与回滚

### 6.1 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Backfill 跑出 35 条 Asset 但 metadata.backfilledFrom 写错 → 重跑双倍 | low | medium | dry-run 必跑 + 单测 idempotent + Reviewer L2 必查重跑结果 |
| 新 generateAiAssets 调 createAsset 失败回滚但 Product.aiAssets 已变 | medium | low | createAsset + product.update 在同一 withTenant tx，原子提交；失败 status 改 'failed' |
| Wizard 流仍写 Asset，KB 流也写 → 同一 product 重复 Asset（用户 KB 生成 + Wizard 也生成同 product） | high | low | 这是预期行为：用户可手动从 KB 生成基础 5 条 + Wizard 加自定义条；UI 会显示总数。不算 bug |
| `loadProductAssetCounts` 性能（N+1）若 KB 列表 200 个 product | low | low | 用 Prisma `groupBy` 单次查询 |
| 现有 prod 5 product 的 aiAssets.generatedAt 缺失 → 缩水后字段不全 | low | low | backfill 脚本兜底 `generatedAt = product.updatedAt` |

### 6.2 回滚

如发现严重 bug：

1. **代码回滚：** `git revert` BL-030 commits → redeploy。`Product.aiAssets` 字段未删，旧 UI 路径自动恢复
2. **数据回滚：** `DELETE FROM asset WHERE source='ai_generated' AND metadata->'backfilledFrom' IS NOT NULL` 删 backfill 创建的所有 Asset；`Product.aiAssets` content 字段已清空，需从备份恢复（user 提前 `pg_dump` product 表）

**Generator 部署前必须在 spec 中加一行：** "Backfill 跑前 user 必先 `pg_dump -t product -t asset > /tmp/bl-030-backup.sql`"

---

## 7. 测试策略（F004）

### 7.1 单元测试
- `generateAiAssets.test.ts` 改写：mock aigcgateway response，断言 5 次 createAsset + 1 次 product.update + 5 次 logAudit
- `loadProductAssetCounts` 新增：fixture 3 product / 不同 type 分布，断 Map<productId, counts>

### 7.2 集成测试（testcontainers）
- 完整流：mock fetch → generateAiAssets → 查 Asset 表 5 行 + Product.aiAssets shape 匹配
- Backfill dry-run：fixture 1 product + 5 JSON items → 不写 DB + 输出 stats
- Backfill 实跑：同上 → 写 DB → 重跑 → 计数不变（idempotent）

### 7.3 KB UI 测试
- ProductCard.test.tsx：fixture product 含 assetCounts → chip 渲染数字
- 不再 fixture aiAssets.emailTemplates 内容

### 7.4 手动 E2E（Reviewer L2，staging）
- 创建新 product + Generate Immediately → 等 5-10s → 刷新 KB → chip 显示 3+2
- 切 /assets → 见 5 条新 Asset（productName 前缀 + 语义后缀）
- 切 /outreach composer → 选该 product → 3 个 email 模板可选

---

## 8. 发布顺序

**1. Generator 完成 building → push → CI green**
**2. Reviewer L1+L2 → done**
**3. 用户操作（按顺序）：**
   - SSH prod: `pg_dump -t product -t asset > /tmp/bl-030-backup.sql`
   - GitHub Actions → Deploy to Production → main（同时上 BL-027 icon hotfix + BL-030 此修复）
   - SSH prod: `cd /opt/kolmatrix && npx tsx scripts/migrate-product-aiassets-to-asset.ts`（dry-run 先看）
   - SSH prod: `npx tsx scripts/migrate-product-aiassets-to-asset.ts --execute`
   - 浏览器验：/knowledge-base 5 product chip 显示 3+2 / /assets 35 新 Asset / composer 选 Clash Royale 见 3 email

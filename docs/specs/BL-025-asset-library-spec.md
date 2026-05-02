---
name: BL-025-asset-library
description: 素材中心 / Asset Library — 统一 Asset 表（方案 X，含 EmailTemplate migration）+ /assets 页面（filter/grid/detail panel）+ variant tree + AI generate/regenerate + /outreach composer 接通
status: drafted（UI 实现段落待 Stitch 设计稿后补完）, awaits BIx-mvp-polish-pass done + signoff PASS
created_by: johnsong (Planner)
created_at: 2026-05-02
estimated_effort: ~5 day Generator + 1 day Reviewer
features_count: 8
prerequisites:
  - BIx-mvp-polish-pass done + Reviewer signoff PASS
  - prod redeploy BIx 完成（含 F004 sync infra 稳定运行 ≥ 2 day 不挂）
  - ADR-011 Accepted（统一 Asset 表选型已锁定）
  - Stitch 设计稿出 1-2 张 desktop 高保真（用户并行操作）
trigger: BIx 验收 done + Stitch 设计稿就绪 + 用户决议启动
---

# BL-025 — 素材中心 / Asset Library

## 1. 背景与目标

### 1.1 来源

- Planner 2026-05-02 全 prod (6f33a55) 链路审计：用户录入产品 → AI 生成 → 0% 接通到使用端
  - 邮件模板：`Product.aiAssets` JSON → /outreach composer 选不到（loadOutreachTemplates 只查 EmailTemplate）
  - 视频脚本：完全无入口（无表 / 无路由 / 无 UI）
  - ProductCard chip 只显示计数，点击无反应
  - 用户无法编辑 / 复制 / 生成 variant / 跨产品复用
- 用户 2026-05-02 决议：起 BL-025 mini-batch 在 MVP 上线前完整实现统一素材中心（不做 trivial 选项 A 半成品方案）
- 架构选型：[ADR-011](../adr/ADR-011-unified-asset-table-vs-typed-tables.md) — 方案 X 统一 Asset 表

### 1.2 目标

让 marketer 在一个统一页面 `/assets` 看到、编辑、生成、投放所有产品的素材。打通 BM1 spec §F003 "一键生成 3 套邮件 + 2 套视频" 的整条链路（生成 → 看 → 改 → 用）。

**Definition of Done：**
- Asset 表上线 + EmailTemplate 数据迁移完成（dual-write 兼容期 1 sprint）
- `/assets` 页面三栏（Filter sidebar / Grid / Detail panel）可用
- 8 个 features 全 PASS + Reviewer L1+L2 签收
- `/outreach` composer 改为查 Asset (type=email)，自动看到 AI 生成 + 用户编辑的所有邮件资产
- Variant tree 工作（regenerate 不覆盖原版，parentId 链可回溯）
- ProductCard chip 可点击 → 跳 `/assets?productId=xxx`
- 视频脚本 Plain text + Markdown 编辑 + 复制到剪贴板 + 导出 Markdown
- Audit log 记录 generate / regenerate（traceId + model + tokens + steeringPrompt）
- staging + prod redeploy 跑通 + L2 烟测 30+ 条 checklist 全 PASS

### 1.3 非目标

- ❌ 视频脚本投放（B 选项给 KOL 看 / C 选项邮件附件）—— 留 BL-026 backlog
- ❌ Asset templates 共享商城 / 跨租户社区 —— 用户 2026-05-02 否决
- ❌ 富文本邮件编辑器 —— 先用 plain text + Markdown，富文本属另一个独立 ~3 day 工作（→ BL-027 候选）
- ❌ 多语言 variant 自动翻译 —— 用户手动改
- ❌ A/B test 模板效果分析 —— 属 BL-021 / Analytics 范围
- ❌ Asset 间关联（如 video referenced by email）—— V1.1 加
- ❌ Step 4 删 EmailTemplate 表 —— 留独立 cleanup migration ~1-2 周后做
- ❌ 跨 tenant asset 同步 / migration 工具 —— 接外部客户后再评估

### 1.4 范围对照（8 features）

| # | Feature | 工时 | 依赖 |
|---|---|---|---|
| F001 | Asset 表 schema + migration（含 EmailTemplate 迁移 + RLS） | ~1 day | — |
| F002 | src/lib/assets/* 后端核心（CRUD + Zod schema + RLS-aware queries） | ~0.5 day | F001 |
| F003 | AI generate / regenerate / variant tree（aigcgateway + audit log） | ~1 day | F002 |
| F004 | `/assets` 页面 — Filter sidebar + Grid + Detail panel（依 Stitch 稿实装） | ~1.5 day | F002, Stitch 稿 |
| F005 | `/assets` Edit + Save + Versions tab + Used in tab | ~0.5 day | F004 |
| F006 | /outreach composer 接通（loadAssetsForComposer 替 loadOutreachTemplates，dual-write 兼容期） | ~0.5 day | F002 |
| F007 | /knowledge-base 集成（ProductCard chip 可点跳 /assets?productId=xxx + ProductModal 显示生成进度/结果预览） | ~0.25 day | F004 |
| F008 | Send to /outreach（email asset 一键注入 composer，prefilled state） | ~0.25 day | F006, F004 |

**总估时：** ~5.5 day Generator + 1 day Reviewer

---

## 2. Features

### F001 — Asset 表 schema + migration

**Executor：** generator
**估时：** ~1 day

**Schema（详细 Prisma model 见 ADR-011）：**
- 新建 `Asset` model + 3 个 enum (AssetType / AssetSource / AssetStatus)
- RLS policy `asset_tenant_isolation`：tenantId IS NULL（system_seed 全 tenant 可见）OR tenantId = current_setting
- 索引：`(tenantId, type, status)` / `(tenantId, productId)` / `(parentId)`

**EmailTemplate → Asset migration（独立 SQL migration 文件）：**
1. 新建 Asset 表 + RLS（不删 EmailTemplate）
2. data migration script：
   ```sql
   INSERT INTO asset (id, tenant_id, type, name, content, source, status, metadata, created_at, updated_at)
   SELECT
     gen_random_uuid(),
     tenant_id,
     'email'::asset_type,
     name,
     jsonb_build_object(
       'subject', subject,
       'body', body,
       'locale', locale,
       'variables', COALESCE(variables, '[]'::jsonb)
     ),
     CASE
       WHEN tenant_id IS NULL THEN 'system_seed'::asset_source
       WHEN type = 'system' THEN 'system_seed'::asset_source
       ELSE 'user_created'::asset_source
     END,
     'published'::asset_status,
     jsonb_build_object('migrated_from_email_template_id', id::text, 'migrated_at', now()),
     created_at,
     updated_at
   FROM email_template;
   ```
3. ROLLBACK SQL 文件保留（migration 失败可 DROP TABLE asset CASCADE）
4. dual-write 兼容期：本批次内 Asset 表为 source-of-truth；EmailTemplate 通过 trigger 或应用层 sync 保持只读副本（送 queue / 其它 reader 仍可走旧路径）

**Acceptance：**
- prisma migration `<timestamp>_add_asset_table` + `<timestamp>_migrate_email_template_to_asset`
- 跑 migration 后 `SELECT count(*) FROM asset WHERE type = 'email'` = `SELECT count(*) FROM email_template`
- system_seed 5 套模板（en + zh = 10 行）正确迁移，tenantId IS NULL
- 用户/AI 模板正确按 tenant_id 迁移
- RLS 测试：tenant A 看不到 tenant B 的 asset；tenant A 能看到 system_seed
- 守门 test：`tests/integration/asset-rls.test.ts` 验证 4 case（system_seed visible / cross-tenant invisible / own visible / null tenant queries）

---

### F002 — src/lib/assets/* 后端核心

**Executor：** generator
**估时：** ~0.5 day

**新建文件：**
- `src/lib/assets/schemas.ts`（Zod content schema 集中，详 ADR-011 §Implementation Notes 2）
- `src/lib/assets/queries.ts`（RLS-aware findMany / findOne / countByProduct）
- `src/lib/assets/mutations.ts`（createAsset / updateAsset / archiveAsset / deleteAsset）
- `src/lib/assets/types.ts`（AssetCard / AssetDetail / AssetFilter etc DTO）

**核心 API：**
```ts
loadAssetsForListing(tenantId, filter: { productId?, types?, status?, source?, search? }, pagination)
loadAssetDetail(tenantId, assetId)
loadAssetsForComposer(tenantId, type='email', locale?) // 替代 loadOutreachTemplates
createAsset(tenantId, input: { productId?, type, name, content, source })
updateAsset(tenantId, assetId, patch: { name?, content?, status? })
archiveAsset(tenantId, assetId)
loadVariantTree(tenantId, rootAssetId) // recursive parent traversal
loadUsedIn(tenantId, assetId) // grep across email_log + future campaign_email_link
```

**Acceptance：**
- 全部 query / mutation 走 `withTenant(tenantId, tx => ...)` （RLS）
- Zod schema 在 createAsset / updateAsset 校验 content shape（type=email → EmailContentSchema, etc）
- 守门 test：`src/lib/assets/__tests__/queries.test.ts` + `mutations.test.ts` 各 ≥ 8 case
- coverage ≥ 80% lines（与 BIx 一致）

---

### F003 — AI generate / regenerate / variant tree

**Executor：** generator
**估时：** ~1 day

**复用现有：** `src/lib/products/generateAiAssets.ts` 调 aigcgateway 的逻辑（claude-haiku-4.5 + JSON 响应 + Zod 验证）—— 抽到 `src/lib/assets/generators/`：
- `email-generator.ts`：input { product, steeringPrompt?, locale } → output EmailContent
- `video-script-generator.ts`：input { product, steeringPrompt? } → output VideoScriptContent
- 共用 `src/lib/assets/generators/aigcgateway-client.ts`（统一 timeout / retry / quota log）

**新建 server action：** `src/app/[locale]/(app)/assets/actions.ts`
```ts
async function generateAssetAction(input: {
  productId: string;
  type: AssetType;
  steeringPrompt?: string;
  parentAssetId?: string; // regenerate 时传，新 asset.parentId = parentAssetId
}): Promise<{ ok: boolean; assetId?: string; error?: string }>
```

**Variant tree 行为：**
- 首次 generate（parentAssetId 未传）：新建 root Asset，parentId = null
- Regenerate（parentAssetId 传）：新建 child Asset，parentId = parentAssetId，name 自动加后缀 "v(n+1)"
- /assets Detail panel Versions tab 渲染树：query `loadVariantTree` recursive 返回所有同 root 子孙

**Audit log：**
```ts
auditLog.create({
  action: 'asset.generated' | 'asset.regenerated',
  payload: { assetId, productId, type, traceId, model, tokensUsed, steeringPrompt }
});
```

**Acceptance：**
- generateAssetAction 端到端 PASS（mock aigcgateway → 写入 Asset → audit log）
- Regenerate variant：parentId 链正确 + name 自增 "v2" / "v3"
- 守门 test：`tests/integration/asset-generate-flow.test.ts` 含 6 case（首次生成 / regenerate / steering prompt / locale 切换 / failure path / audit log 写入）
- aigcgateway 余额扣减合理（每 generate ~0.001-0.005 USD，依 model 和 token 量）

---

### F004 — `/assets` 页面 三栏布局

**Executor：** generator
**估时：** ~1.5 day

**🚧 待 Stitch 设计稿出图后补完此段细节。当前先列骨架：**

**路由：** `src/app/[locale]/(app)/assets/page.tsx`（Server Component）

**布局：** 三栏 grid（240px / flex-1 / 440px），响应式 ≥ 1280px 三栏，< 1280px detail panel 改 modal 弹出

**子组件（先占位，Stitch 稿出来后实装细节）：**
- `AssetsFilterSidebar.tsx`（Product combobox / Type chip / Status chip / Source chip / Search）
- `AssetsGrid.tsx`（卡片网格 + sort + view toggle + "+ New Asset" CTA）
- `AssetCard.tsx`（type icon + status dot + name + product label + preview + variant 数 + used-in 数）
- `AssetsDetailPanel.tsx`（Tabs: Preview / Edit / Versions / Used in + More menu）
- `NewAssetModal.tsx`（Step 1 Product+Type → Step 2 steeringPrompt → Step 3 preview/save）
- `RegenerateVariantPopup.tsx`（detail panel "..." menu 触发，可选 steering prompt）

**Filter URL state：** 通过 `?productId=&types=email,video&status=draft&search=` 同步 URL，支持深链与刷新保留

**Empty state：** "No assets yet" 插画 + 双 CTA（"Generate from product" / "Create blank"）

**Acceptance（Stitch 稿出来后补具体设计稿对照）：**
- 三栏布局响应式（≥ 1280px 三栏；< 1280px detail 改 modal）
- Filter URL state 同步 + 深链 PASS
- Grid 渲染 ≤ 100 资产无明显卡顿（pagination cursor，PAGE_SIZE = 24）
- Empty state 友好引导
- 守门 test：`tests/e2e/assets-page.spec.ts` 含 8 case（filter URL state / grid render / detail panel switch / new asset modal / regenerate flow / empty state / mobile responsive guarded skip / a11y）
- visual baseline 重生（新页面）

---

### F005 — Edit + Save + Versions tab + Used in tab

**Executor：** generator
**估时：** ~0.5 day

**Edit Tab UI：**
- Email type：subject 输入框 + body textarea + 变量 chip 工具条（{{kol.name}} / {{product.name}} / {{campaign.name}} 可点击插入光标位置）+ Markdown 提示
- Video type：title 输入框 + script Markdown 编辑器（用 @uiw/react-md-editor 或简易 textarea + preview tab）

**Save 行为：**
- "Save"（覆盖当前 asset）：updateAsset 改 content + status='draft' → 'published' 切换可由 status chip 触发
- "Save as new version"（生成 user_created variant）：createAsset 复制内容 + parentId = currentAssetId + source='user_created'
- 变更未保存离开 detail panel 时弹 confirm

**Versions Tab：**
- 树状视图 mini Git-graph 风格
- 每节点显示：source icon（AI / User）+ 作者 avatar + 时间 + diff 摘要 "+12 / -3 chars"
- Action：Restore this version（创建新 user_created variant 内容 = 选中版本）/ Compare with current（diff modal，差量 highlight）

**Used in Tab：**
- 列出该 asset 被引用的位置：
  - Email logs (email_log.template_id = asset.id)
  - 未来：Campaign emails、Outreach campaigns 等
- 空态："Not used yet"

**Acceptance：**
- Edit Email：subject + body + 变量 chip 插入正确（光标位置）
- Save / Save as new version：分别 updateAsset / createAsset 行为正确
- Versions tree：递归回溯 root → leaves，UI 渲染顺序按 createdAt
- Used in：聚合 email_log 引用计数正确
- 守门 test：`tests/integration/asset-edit-versions.test.ts` 含 6 case

---

### F006 — /outreach composer 接通

**Executor：** generator
**估时：** ~0.5 day

**改造 `src/lib/email/templates.ts`：**
```ts
// before:
export async function loadOutreachTemplates(tenantId, locale) {
  // query email_template
}

// after:
export async function loadOutreachTemplates(tenantId, locale) {
  return loadAssetsForComposer(tenantId, 'email', locale);
}
```

**新建 `src/lib/assets/queries.ts:loadAssetsForComposer`：**
```ts
async function loadAssetsForComposer(tenantId, type, locale?) {
  return withTenant(tenantId, tx => tx.asset.findMany({
    where: {
      OR: [
        { tenantId, type, status: 'published' },
        { tenantId: null, type, status: 'published' }, // system_seed
      ],
      ...(locale ? { content: { path: ['locale'], equals: locale } } : {}),
    },
    select: { id: true, name: true, content: true, source: true, productId: true },
    orderBy: [
      { source: 'asc' }, // system_seed 优先
      { updatedAt: 'desc' },
    ],
    take: 100,
  }));
}
```

**Composer UI 微调：**
- 模板下拉里给每条加 source 标签（"AI" / "User" / "System"）+ 可选 product label
- 不改 dropdown 主交互（保现有 5 套系统模板使用习惯）

**Dual-write 兼容期：**
- 本批次完成后，EmailTemplate 表通过应用层 sync 保持镜像（每次 createAsset/updateAsset/archiveAsset 都同步写 EmailTemplate）
- 1 sprint 后（~2 周）独立 cleanup migration 删 EmailTemplate 表 + sync 代码（不在本批次范围）

**Acceptance：**
- /outreach composer 模板下拉看到 system_seed + AI 生成 + 用户手创全部
- 选中后插入 subject + body 行为不变
- send-queue / Resend 集成现有 EmailTemplate.id reference 仍工作（dual-write 期）
- 守门 test：`tests/integration/composer-load-templates.test.ts` 验证 union 查询 + locale filter + tenant 隔离

---

### F007 — /knowledge-base 集成

**Executor：** generator
**估时：** ~0.25 day

**ProductCard 改造：**
- emailCount / videoCount chip 改为可点 `<Link href="/assets?productId={product.id}&types=email">`（视频同理）
- chip hover 状态：透明度变化 + cursor-pointer + tooltip "View {N} {type}"
- aiAssets=null 时：chip 改为 "⏳ Generate AI assets"，点击触发 triggerAiGeneration（保留现有 server action）
- aiAssets.status='pending' 时：spin icon + "Generating..."
- aiAssets.status='failed' 时：错误图标 + "Retry" 按钮

**ProductModal 微调：**
- 编辑产品时，aiAssets.status='ready' 状态显示一段：「AI Assets Generated · 3 emails + 2 videos · [View in /assets] [Regenerate]」
- 按钮跳 /assets?productId={product.id} 或调 regenerate variant

**Acceptance：**
- ProductCard 4 状态（null / pending / ready / failed）UI 一致
- 跳转 /assets 时 productId filter 自动应用
- 守门 test：`src/app/[locale]/(app)/knowledge-base/__tests__/ProductCard.test.tsx` 加 case 验证 4 状态 + 跳转
- visual baseline 重生

---

### F008 — Send to /outreach（email asset 一键注入 composer）

**Executor：** generator
**估时：** ~0.25 day

**Detail panel "Send to outreach" 按钮（仅 type=email 显示）：**
- 点击 → `router.push('/outreach?prefilledAssetId={asset.id}')`

**OutreachComposer 接收 prefilled query：**
- 加载时检查 query param `prefilledAssetId`
- 命中则 pre-select dropdown 到该 asset + auto-fill subject + body
- 加 toast "Loaded template from /assets"

**Acceptance：**
- /assets detail panel "Send to outreach" 按钮 email asset 显示，video asset 不显示
- 跳转后 composer 自动填充 subject + body
- 守门 test：`tests/e2e/asset-send-to-outreach.spec.ts` 端到端

---

## 3. 依赖与执行顺序

### 3.1 前置依赖

1. **BIx-mvp-polish-pass done + Reviewer signoff PASS**（当前 BIx 在 verifying，不阻塞 BL-025 起 spec，但启动开工要等 done）
2. **prod redeploy BIx 完成 + 稳定 ≥ 2 day**（确保 F004 sync infra 不挂；BL-025 改 schema 不能与 BIx F004 migration drift 撞车）
3. **ADR-011 Accepted** ✅（本会话 commit）
4. **Stitch 设计稿出图**（用户并行操作；BL-025 F004 开工前必到位）

### 3.2 推荐执行顺序

按"独立性 → 影响面"排序，避免相互干扰：

1. **F001** — schema + migration（独立 SQL，不动应用代码；最先做）
2. **F002** — 后端核心 lib（依 F001 schema；测 Zod + RLS）
3. **F003** — AI generate / variant tree（依 F002 mutation API；可与 F004 并行）
4. **F004** — `/assets` 页面三栏（依 F002 + Stitch 稿；最大块工作）
5. **F005** — Edit + Versions + Used in（依 F004 detail panel skeleton）
6. **F006** — /outreach composer 接通（依 F002 query；与 F004 并行）
7. **F007** — /knowledge-base 集成（依 F004 路由；最后做）
8. **F008** — Send to /outreach（依 F006 + F004；最后做）

### 3.3 阻断点与裁决

- **migration dual-write 是否够稳**：开工前 Generator POC dual-write 模式（trigger vs 应用层 sync），写到 generator_handoff
- **Stitch 稿三栏交互细节**（Filter URL state shape / detail panel transition / variant tree visual）：用户出图后 Planner + Generator 一起对齐
- **变量 token 工具条扩展性**：MVP 先 hardcode 5 个 token（kol.name / kol.handle / product.name / campaign.name / today_date）；未来动态从 outreach.variables 读

---

## 4. 验收标准（Reviewer L1 + L2）

### 4.1 L1 自动化

- [ ] `npm run lint` 0 error
- [ ] `npx tsc --noEmit` 0 error
- [ ] `npm test` 全 PASS（680+ tests with new cases）
- [ ] coverage gate ≥ 80% lines / functions / statements
- [ ] `npm run build` 成功
- [ ] prisma migration 跑过 staging 0 error

### 4.2 L2 staging 走查（30+ 条 checklist）

**F001 schema + migration（5）：**
- [ ] `SELECT count(*) FROM asset WHERE type='email'` = `SELECT count(*) FROM email_template` 迁移后
- [ ] system_seed 5 套模板 tenantId IS NULL 正确
- [ ] 用户/AI 模板按 tenant_id 正确迁移
- [ ] RLS：tenant A 登录看不到 tenant B 资产
- [ ] system_seed 跨 tenant 可见

**F002-F003 后端 + 生成（5）：**
- [ ] generateAssetAction 端到端：录新产品 → /assets 看到 5 资产（3 email + 2 video）
- [ ] Regenerate variant：parentId 链 v1 → v2 → v3
- [ ] Audit log `asset.generated` / `asset.regenerated` 写入
- [ ] aigcgateway 余额扣减
- [ ] Failure path：aigcgateway 503 时 status='failed' + UI 显示 retry

**F004 /assets 页面（10）：**
- [ ] 三栏布局响应式 ≥ 1280px / < 1280px detail 改 modal
- [ ] Filter Product / Type / Status / Source / Search 全工作
- [ ] URL ?productId= 深链生效
- [ ] Grid 卡片渲染含 type icon / status dot / variant 数 / used-in 数
- [ ] "+ New Asset" modal Step 1/2/3 流程
- [ ] Detail panel Tabs 切换平滑
- [ ] Empty state "Generate from product" + "Create blank"
- [ ] Sort 切换（Recent / Name / Used most / Type）
- [ ] View toggle Grid / List
- [ ] visual baseline 通过

**F005 Edit + Versions（5）：**
- [ ] Email subject + body + 变量 chip 插入正确光标位置
- [ ] Video Markdown 编辑 + preview
- [ ] Save / Save as new version 行为不同
- [ ] Versions tree 渲染 v1→v2→v3
- [ ] Restore version / Compare with current

**F006 composer 接通（3）：**
- [ ] /outreach composer 下拉看到 AI + User + System asset
- [ ] 选中 AI 资产插入 subject + body 正确
- [ ] EmailTemplate dual-write 同步（send queue 不破）

**F007-F008 集成（5）：**
- [ ] ProductCard 4 状态 UI 一致
- [ ] chip 点击跳 /assets?productId=xxx 自动 filter
- [ ] ProductModal "AI Assets Generated" section
- [ ] /assets detail panel "Send to outreach" 按钮 email asset 显示
- [ ] 跳转 composer 自动填充

### 4.3 prod redeploy 后烟测

同 staging 30+ 条 checklist 重跑 prod。

---

## 5. 风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| EmailTemplate migration 数据丢失 | 低 | 高 | dual-write 兼容期 + count 验证 + ROLLBACK SQL |
| dual-write 应用层 sync 漏 case | 中 | 中 | server action 单点写入 + 集成 test 覆盖 |
| variant tree 无限递归（恶意 parentId 自引用） | 低 | 中 | createAsset 校验 parentId ≠ self + max depth 10 |
| /outreach composer dropdown 加载慢（大量 asset） | 中 | 中 | take=100 + 后续加 search filter；或 lazy load |
| Stitch 设计稿与 design system 不一致 | 中 | 中 | Planner + Generator 收稿后 review 1 轮，调整使用 glass-panel / Material Symbols 一致性 |
| AI generate 配额超限 | 低 | 低 | aigcgateway 余额监控 + audit log 量统计 |

**回滚预案：**
- F001 migration 失败 → 跑 ROLLBACK SQL + dropTable asset
- F006 composer 切 Asset 后 send queue 异常 → 切回 EmailTemplate query（feature flag `USE_ASSET_FOR_COMPOSER`）
- F003 generate 失败率高 → 暂停 generateAssetAction（feature flag `ASSET_GENERATE_ENABLED=false`）

---

## 6. 时间线

| 日期 | 里程碑 |
|---|---|
| 2026-05-02 | spec drafted（本文档骨架） + ADR-011 Accepted |
| 2026-05-02~03 | 用户 Stitch 出图（并行） |
| 2026-05-04 | spec §4 UI 实现细节段落补完（依 Stitch 稿） |
| ~2026-05-05 | BIx done + signoff（Reviewer L2 通过 + 7-day soft watch 启动） |
| ~2026-05-06 | BL-025 启动 |
| ~2026-05-11 | BL-025 done + Reviewer signoff |
| ~2026-05-12 | BL-020 安全 mini-batch 启动 |
| ~2026-05-13 | BL-020 done |
| ~2026-05-14 | BL-024 ghost-controls 启动 |
| ~2026-05-17 | BL-024 done → **上线对外客户准备就绪** |
| ~2026-05-25 | EmailTemplate 表删 cleanup migration（独立 ~1h） |

---

## 7. 后续 backlog 触发

完成后更新 backlog.json：
- BL-025 移除（done）
- BL-020 启动（无变化）
- BL-024 启动（B4 ghost-controls 实装）
- 新增候选条目：
  - BL-026：视频脚本投放路径（B/C 选项 — 邮件附件 / 给 KOL 看，待真客户场景触发）
  - BL-027：富文本邮件编辑器（如团队/客户反馈 plain text 不够）
  - BL-028：Asset templates 共享商城 / 跨租户社区（PMF 后评估）

---

## 8. 决策记录

| 决策 | 时间 | 来源 |
|---|---|---|
| 起 BL-025 在 MVP 上线前完整实现素材中心 | 2026-05-02 | 用户决议 |
| 架构选方案 X — 统一 Asset 表 + EmailTemplate migration | 2026-05-02 | 用户决议 + ADR-011 |
| Variant tree 支持（regenerate 不覆盖原版） | 2026-05-02 | 用户决议 |
| 视频脚本仅查看/编辑/复制（A 选项），B/C 留 BL-026 | 2026-05-02 | 用户决议 |
| 不做 Asset templates 商城 | 2026-05-02 | 用户决议 |
| Generate 不限频率但 audit log 留底 | 2026-05-02 | 用户决议 |
| MVP 时间不硬，BL-025 在 BIx done 后立做 | 2026-05-02 | 用户决议 |
| 富文本编辑器留 BL-027 | 2026-05-02 | 用户决议（plain text + Markdown 起步） |

## 9. 参考文档

- [ADR-011 Unified Asset Table vs Typed Tables](../adr/ADR-011-unified-asset-table-vs-typed-tables.md) —— 架构决策
- `src/lib/products/generateAiAssets.ts` —— 现有 AI 生成逻辑（F003 复用）
- `src/lib/email/templates.ts:loadOutreachTemplates` —— F006 改造目标
- `prisma/schema.prisma:EmailTemplate` —— F001 migration 源
- `src/app/[locale]/(app)/knowledge-base/ProductCard.tsx` —— F007 改造目标
- `framework/harness/deploy-patterns.md` —— prod redeploy 完整链 checklist
- BM1 spec §F003 "一键生成 3 套邮件 + 2 套视频" —— 历史背景
- backlog.json BL-025 —— 本批次 backlog 条目

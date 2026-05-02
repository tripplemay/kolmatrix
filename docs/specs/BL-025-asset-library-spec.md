---
name: BL-025-asset-library
description: 素材中心 / Asset Library — 统一 Asset 表（方案 X，含 EmailTemplate migration）+ /assets 页面（filter/grid/detail panel）+ variant tree + AI generate/regenerate + /outreach composer 接通
status: drafted-complete（含 Stitch 设计稿对照 §F004 UI 实装）, awaits BIx-mvp-polish-pass done + signoff PASS
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
- /assets 页面与 design-draft/BL-025-asset-library/variant-a-296k 视觉一致性 PASS（颜色 / 圆角 / 阴影 / 玻璃拟态对照）
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

**设计源：** `design-draft/BL-025-asset-library/variant-a-296k/code.html` + `screen.png`（full state 主参考） + `variant-a-260k/screen.png`（empty state CTA 模式参考；其它创意发挥不采纳，详见末尾"Stitch 偏差对照"）。

**路由：** `src/app/[locale]/(app)/assets/page.tsx`（Server Component）+ `'use client'` 子组件（Filter / Grid / Detail Panel 都需 client interactivity）

#### 三栏布局结构

```tsx
// src/app/[locale]/(app)/assets/page.tsx
<AppShellLayout> {/* 复用 BIx F005 拆出的 island；左 sidebar 240px + topbar 64px */}
  <main className="flex flex-1 overflow-hidden">
    <AssetsFilterSidebar />              {/* 240px fixed */}
    <AssetsMainColumn>                    {/* flex-1 */}
      <AssetsActionBar />                 {/* breadcrumb + sort + view toggle + "+ New Asset" */}
      <AssetsGrid />                      {/* 卡片网格或空态 */}
    </AssetsMainColumn>
    <AssetsDetailPanel />                {/* 440px，selected 时展开；< 1280px 改 modal */}
  </main>
</AppShellLayout>
```

**响应式断点：**
- `≥ 1280px`：三栏并列 `[240px][flex-1][440px]`
- `< 1280px`：detail panel 改 fullscreen modal 弹出（与 BIx F005 mobile 模式一致；用 `dialog` element + Tailwind `lg:hidden` / `lg:block` 切换）

#### AssetsFilterSidebar.tsx (左栏 240px)

**容器：**
- `bg-[#060e20]` 背景（与全局 sidebar 一致但内嵌在 main 区域，所以 padding 24px + rounded-[16px] 包裹）
- 顶部 "Filters" h2 + "Clear all" 文字按钮（点击重置全部 filter，URL → /assets）
- vertical flex gap 24px

**Product Combobox：**
- 复用现有 design system 的 `<Combobox>`（如无则用 base-ui `<Combobox.Root>`）
- 搜索 + 下拉，options：`{ value: productId, label: productName }` + 特殊项 `"all" / "unassigned"`
- 选中后下方副文本显示 "12 assets in this product"（count from `loadAssetsForListing` total）

**Type 多选 chip：**
```tsx
<ChipGroup multiselect>
  <Chip value="email" icon="mail">Email</Chip>
  <Chip value="video_script" icon="movie">Video</Chip>
  <Chip disabled icon="add">More coming</Chip>  {/* ghost chip 提示扩展性 */}
</ChipGroup>
```
- 选中态：`bg-[#00E5FF] text-[#001f24] font-semibold`
- 未选：`bg-[#171f33] text-[#bac9cc] border border-[#3b494c]`
- ghost：`opacity-40 cursor-not-allowed`

**Status 单选 chip 组：** All / Draft / Published / Archived（同 chip 样式，单选）

**Source 多选 chip：** AI Generated / User Created / Imported（多选）

**Search 输入：**
- pill shape `bg-[#2d3449] rounded-full h-10 px-4`
- 左 search icon + placeholder "Search by name or content..."
- 防抖 300ms 后更新 URL `?search=`

#### AssetsActionBar.tsx (顶部栏)

```tsx
<div className="flex items-center justify-between px-6 py-4 gap-4">
  {/* LEFT — breadcrumb of active filters */}
  <div className="flex items-center gap-2 flex-wrap">
    {filterChips.map(c => (
      <button onClick={() => removeFilter(c)} className="bg-[#171f33] rounded-full px-3 py-1 text-xs text-[#bac9cc] hover:text-[#00E5FF] flex items-center gap-1">
        {c.label} <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    ))}
  </div>

  {/* MIDDLE — sort dropdown */}
  <Select defaultValue="recent">
    <Option value="recent">Recent</Option>
    <Option value="name">Name</Option>
    <Option value="used_most">Used most</Option>
    <Option value="type">Type</Option>
  </Select>

  {/* RIGHT — view toggle + new asset CTA */}
  <div className="flex items-center gap-2">
    <ToggleGroup value={view} onChange={setView}>
      <ToggleItem value="grid"><material-symbols>grid_view</material-symbols></ToggleItem>
      <ToggleItem value="list"><material-symbols>view_list</material-symbols></ToggleItem>
    </ToggleGroup>
    <button className="bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] text-[#001f24] rounded-[10px] px-4 py-2 text-sm font-bold">
      <span className="material-symbols-outlined">add</span> New Asset
    </button>
  </div>
</div>
```

#### AssetsGrid.tsx + AssetCard.tsx

**Grid 容器：** `grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 p-6`

**AssetCard 组件结构：**
```tsx
<button onClick={() => selectAsset(asset.id)}
        className={cn(
          "rounded-[16px] p-5 text-left flex flex-col gap-3 transition-all",
          "bg-[#161A20] border border-[rgba(186,201,204,0.08)]",
          "hover:bg-[#1d242e] hover:border-[rgba(0,229,255,0.3)]",
          isSelected && "ring-2 ring-[#00E5FF] bg-[#1d242e]"
        )}>
  {/* Header: type icon + status dot + AI badge */}
  <div className="flex items-center justify-between">
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold",
      asset.type === 'email' ? "bg-[rgba(0,229,255,0.15)] text-[#00E5FF]" : "bg-[rgba(157,80,255,0.15)] text-[#9D50FF]"
    )}>
      <material-symbols>{asset.type === 'email' ? 'mail' : 'movie'}</material-symbols>
      {asset.type === 'email' ? 'Email' : 'Script'}
    </span>
    {asset.source === 'ai_generated' && (
      <span className="text-[10px] font-bold tracking-[0.1em] text-[#00E5FF] bg-gradient-to-br from-[rgba(0,229,255,0.2)] to-[rgba(195,245,255,0.1)] px-1.5 py-0.5 rounded">AI</span>
    )}
  </div>

  {/* Title (2 line clamp) + product + relative time */}
  <h3 className="text-white font-semibold text-sm line-clamp-2">{asset.name}</h3>
  <p className="text-[#bac9cc] text-xs">
    {asset.productName} · {relativeTime(asset.updatedAt)}
  </p>

  {/* Content preview (3 line clamp) */}
  <p className="text-[#6B7280] text-xs line-clamp-3 font-mono">
    {asset.contentPreview}
  </p>

  {/* Footer metadata */}
  <div className="flex items-center justify-between text-[11px] text-[#6B7280] pt-3 border-t border-[rgba(186,201,204,0.08)]">
    <span>v{asset.versionIndex} of {asset.totalVariants}</span>
    <span>used {asset.usedInCount}×</span>
    <StatusDot status={asset.status} />  {/* 绿/黄/灰圆点 */}
  </div>
</button>
```

**Hover quick actions（浮层）：** 卡片右上角 hover 时浮出 4 个圆形按钮 `Edit / Duplicate / Archive / Delete`（每个 32px 圆形 `bg-[#2d3449]/80 backdrop-blur-md hover:bg-[#00E5FF]/20`）

**空态（asset 总数 0）：**
```tsx
<EmptyState>
  <div className="flex flex-col items-center gap-4 py-20">
    {/* 玻璃拟态文件夹 icon + 渐变发光 */}
    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#00daf3]/30 to-[#9D50FF]/20 backdrop-blur-md flex items-center justify-center shadow-[0_0_60px_rgba(0,229,255,0.2)]">
      <material-symbols className="text-5xl text-white">folder_open</material-symbols>
    </div>
    <h2 className="text-2xl font-bold text-white">No assets yet</h2>
    <p className="text-[#bac9cc] text-center max-w-md">
      Your creative vault is currently empty. Start by generating AI-native marketing assets from your products or create a blank container.
    </p>
    <div className="flex gap-3 mt-4">
      <button className="bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] text-[#001f24] rounded-[10px] px-5 py-3 font-bold flex items-center gap-2">
        <material-symbols>auto_awesome</material-symbols> Generate from product
      </button>
      <button className="bg-[#171f33] text-white rounded-[10px] px-5 py-3 font-semibold flex items-center gap-2 border border-[#3b494c]">
        <material-symbols>add</material-symbols> Create blank
      </button>
    </div>
  </div>
</EmptyState>
```

#### AssetsDetailPanel.tsx (右栏 440px)

**容器：** `bg-[#0e1424] border-l border-[rgba(186,201,204,0.08)] flex flex-col h-full`

**Header（固定顶部，64px）：**
- Close × 按钮（左）
- type icon + asset name（可点击编辑，转成 inline input）
- 右上角 "..." More menu → dropdown:
  - Regenerate variant（with optional steering prompt popup）
  - Export Markdown
  - Copy to clipboard
  - Send to /outreach（仅 email type 显示）
  - Archive
  - Delete

**Tabs 行（4 个）：**
```tsx
<div className="flex border-b border-[rgba(186,201,204,0.08)] px-6">
  {['Preview', 'Edit', 'Versions', 'Used in'].map(tab => (
    <button className={cn(
      "pb-3 pt-4 px-4 text-sm font-medium transition-colors",
      activeTab === tab
        ? "text-[#00E5FF] font-semibold border-b-2 border-[#00E5FF]"
        : "text-[#bac9cc] hover:text-white"
    )}>{tab}</button>
  ))}
</div>
```

**Preview Tab 内容：**
- Email：`<h2>` 渲 subject + `<div>` 渲 body（变量 token `{{kol.name}}` 用 `<span class="bg-[#00E5FF]/10 text-[#00E5FF] px-1 rounded">` 高亮）
- Video：title + script Markdown 渲染（用 `react-markdown` + 项目 syntax highlighter）

**Edit / Versions / Used in Tab：** 详见 F005

**底部 sticky action bar：**
```tsx
<div className="sticky bottom-0 bg-[#0e1424]/95 backdrop-blur-md border-t border-[rgba(186,201,204,0.08)] p-4 flex gap-2">
  <button className="flex-1 bg-[#171f33] text-white rounded-[10px] py-2.5 font-medium">
    <material-symbols>refresh</material-symbols> Regenerate
  </button>
  {asset.type === 'email' && (
    <button className="flex-1 bg-gradient-to-br from-[#00daf3] to-[#c3f5ff] text-[#001f24] rounded-[10px] py-2.5 font-bold">
      <material-symbols>send</material-symbols> Send to Outreach
    </button>
  )}
</div>
```

#### NewAssetModal.tsx (3-step wizard)

**Step 1 — Product + Type：**
- Product Combobox（默认从 URL `?productId=` 预填）
- Type chip 单选（email / video_script）
- "Continue" 按钮

**Step 2 — Steering prompt（可选）：**
- textarea "Optional: steer the AI generation"
- 速选 chip 组：`emphasize affordability` / `for Gen Z audience` / `formal tone` / `casual tone` / `urgency` / `social proof`
- "Generate" 按钮（青色渐变）

**Step 3 — Preview + Save：**
- 加载动画（spinner + "Generating with claude-haiku-4.5...")
- 完成后预览生成内容（subject + body 或 title + script）
- 底部："Save & Edit" / "Regenerate" / "Discard"

#### RegenerateVariantPopup.tsx

Detail panel "..." menu → "Regenerate variant" 触发：
- 小 popup（width 320px）含可选 steering prompt + "Regenerate" 按钮
- 生成后新 asset.parentId = currentAssetId, name 自增 "v(n+1)"
- 自动切到新版本展示

#### Filter URL state 实现

```ts
// src/app/[locale]/(app)/assets/use-filter-state.ts (client hook)
export function useAssetFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: AssetFilters = useMemo(() => ({
    productId: searchParams.get('productId') ?? undefined,
    types: searchParams.get('types')?.split(',') as AssetType[] | undefined,
    status: searchParams.get('status') as AssetStatus | undefined,
    sources: searchParams.get('sources')?.split(',') as AssetSource[] | undefined,
    search: searchParams.get('search') ?? undefined,
    sort: (searchParams.get('sort') ?? 'recent') as 'recent' | 'name' | 'used_most' | 'type',
    view: (searchParams.get('view') ?? 'grid') as 'grid' | 'list',
  }), [searchParams]);

  const update = (patch: Partial<AssetFilters>) => {
    const sp = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) sp.delete(k);
      else sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
    });
    router.push(`/assets?${sp.toString()}`, { scroll: false });
  };

  return { filters, update, clearAll: () => router.push('/assets') };
}
```

#### Pagination

- PAGE_SIZE = 24
- cursor-based（用现有 `createCursorPaginator` from `src/lib/pagination/`）
- 触底加载（IntersectionObserver 在 grid 末尾）

#### Stitch 设计稿偏差对照（**不采纳**）

| Stitch 加的 | 我们的 spec | 处理 |
|---|---|---|
| 空态 sidebar 加 "Asset Types: Images / Videos / Documents / 3D Models" 列表 | ADR-011 enum 仅 `email` + `video_script` + 未来扩展 | **删除该 section**，empty state 只展示主区 CTA |
| 空态 sidebar 加 "Campaign Tags" filter | spec 只 5 个 filter | **删除**，未来如需要再 BL 评估 |
| 空态 sidebar 出现 2 个 "Products" 项 | App Shell 8 项 nav 是 canonical（[design-draft/design-system.md] 锁定）| **按 App Shell 严格实装**，无重复 |
| Type chip "Video" | spec 内部 enum = `video_script`，UI label = "Video" | 内部 `video_script` / UI label `Video`（i18n key） |

#### Acceptance（具体）

- [ ] 三栏布局 ≥ 1280px 并列 / < 1280px detail 改 modal
- [ ] Filter URL state 5 个 param 全双向同步（深链 + 刷新 + 浏览器后退）
- [ ] AssetCard hover quick actions 浮出（Edit / Duplicate / Archive / Delete）
- [ ] AssetCard selected 时 cyan ring + bg 加深
- [ ] AssetCard 含 type chip + AI 徽章（仅 ai_generated）+ version index `vN of M` + used count
- [ ] Sort dropdown 4 选项工作（Recent / Name / Used most / Type）
- [ ] View toggle Grid ↔ List 切换 + URL 同步
- [ ] "+ New Asset" 3-step wizard（Product+Type → Steering prompt → Preview & Save）
- [ ] Detail panel 4 tabs 切换平滑
- [ ] Detail panel "..." More menu 6 项（email / 5 项 video）
- [ ] Send to Outreach 按钮仅 email asset 显示
- [ ] Empty state（asset count = 0）"Generate from product" + "Create blank" 双 CTA
- [ ] Pagination cursor + IntersectionObserver 触底加载
- [ ] 与 design-draft/BL-025-asset-library/variant-a-296k/code.html 视觉一致性 PASS（关键颜色 / 圆角 / 阴影对照）
- [ ] visual baseline 重生
- [ ] 守门 test：`tests/e2e/assets-page.spec.ts` 含 8 case（filter URL state / grid render / detail panel switch / new asset wizard / regenerate flow / empty state / mobile detail-as-modal / a11y）

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
- `design-draft/BL-025-asset-library/variant-a-296k/` —— Stitch 设计稿（full state 主参考；code.html / screen.png / DESIGN.md）
- `design-draft/BL-025-asset-library/variant-a-260k/` —— Stitch 设计稿（empty state CTA 模式参考）
- `src/lib/products/generateAiAssets.ts` —— 现有 AI 生成逻辑（F003 复用）
- `src/lib/email/templates.ts:loadOutreachTemplates` —— F006 改造目标
- `prisma/schema.prisma:EmailTemplate` —— F001 migration 源
- `src/app/[locale]/(app)/knowledge-base/ProductCard.tsx` —— F007 改造目标
- `framework/harness/deploy-patterns.md` —— prod redeploy 完整链 checklist
- BM1 spec §F003 "一键生成 3 套邮件 + 2 套视频" —— 历史背景
- backlog.json BL-025 —— 本批次 backlog 条目

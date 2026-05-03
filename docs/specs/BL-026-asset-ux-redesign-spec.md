# BL-026 — Asset UX Redesign + Outreach-First Mental Model

**批次类型：** Generator-only（6 features 全部 executor:generator）
**估时：** ~3-3.5 day（Generator ~3 + Reviewer ~0.5）
**前置：**
- ✅ BL-025 done（2026-05-03 signoff PASS）
- ✅ ADR-012 Accepted（推翻 §F004.B 部分）
- ✅ 用户决议（2026-05-03）：F005 轻量增强 / variant tree 折 Preview / system_seed 展示 / scope 甲（完整重构）
**Definition of Done：** 6 features 全 PASS + Reviewer L1+L2 签收 + visual baseline 4 个新入库 + staging+prod redeploy + L2 走查 30+ checklist 全 PASS。

---

## 心智重排（来自 ADR-012）

| 维度 | BL-025 心智 | BL-026 新心智 |
|---|---|---|
| /outreach 角色 | 邮件发送界面 | **核心创作 + 发送界面** |
| /assets 角色 | 独立素材仓库（核心） | **高级管理界面（边缘）** |
| 完成"用 AI 邮件发出去" | 7-8 步 | **3-4 步（在 /outreach 直选）** |
| /assets 主功能 | 三栏 filter+grid+detail | **顶部 ActionBar + Grid + Right Drawer** |
| Variant tree | 独立 tab | **Preview tab 顶部下拉** |

---

## §S1 UI Fidelity Guardrail（按 v0.9.6 [#5] self-check 自审）

按 `framework/harness/ui-fidelity-guardrail.md` §2 4 段强制自审：

### S1.1 原型路径

**本批次无新 Stitch 设计稿**（重构现有页面，不需要新出图）。视觉参照来源：
- **设计 token**：`design-draft/design-system.md`（既有 design system 全套色板/间距/圆角/字号）
- **drawer 模式参考**：项目内 `src/components/ui/Dialog.tsx` + Linear/Notion/Airtable slide-over drawer 通用模式
- **filter dropdown 参考**：项目内 `src/components/ui/Select.tsx` + 现有 ChipButton + Combobox（已就位）

### S1.2 必用公共组件清单

`@/components/common/` 必用：GlassPanel / GradientButton / SecondaryButton / GhostButton / ChipButton / SectionHeader / TagChip / StatusBadge / AssetCard / AssetTabs / StatusDot
`@/components/ui/` 必用：Combobox / Dialog（含 DialogPortal/Backdrop/Panel）/ Input / Select / Menu

**新组件（必须抽到 src/components/common/）：**
- **NONE**（本批次复用现有，不新增公共组件）

**5 禁止行为**（违反 = Reviewer 拒收）：
- 手写 button + className 替代 GradientButton/SecondaryButton/GhostButton/ChipButton
- raw `<dialog>` 替代 Dialog primitive
- inline 玻璃拟态 `bg-white/5 backdrop-blur` 类 className 替代 GlassPanel
- inline 颜色 `bg-[#xxx]` / `rounded-[Npx]` 替代 design token
- AssetCard 内联实现替代 `@/components/common/AssetCard`

### S1.3 删除元素清单（推翻 BL-025 §F004.B 部分）

| § BL-025 ref | 元素 | 处理 |
|---|---|---|
| §F004.B 第 1 | "Filters" SectionHeader | **删除**（移到 dropdown 内） |
| §F004.B 第 2 | "Clear all" GhostButton | **移到 dropdown footer** |
| §F004.B 第 3 | Search Input（sidebar 内） | **移到 dropdown 第一行** |
| §F004.B 第 4 | Product Combobox（sidebar 内） | **移到 dropdown 第二行** |
| §F004.B 第 5 | Type ChipButton 多选 + "More coming" | **移到 dropdown** |
| §F004.B 第 6 | Status radio 4 选项 | **移到 dropdown，"Archived" 默认折叠** |
| §F004.B 第 7 | Source ChipButton 4 选项 | **移到 dropdown** |
| §F004.B 第 14（部分） | Detail panel 4 tabs 中的 "Versions" tab | **删除**（折到 Preview tab 顶部下拉） |
| §F004.B 第 18（部分） | Empty state "Create blank" SecondaryButton | **删除**（假按钮，无 blank-create 路径） |
| §F005 内 | "Compare with current — coming with F005 polish" disabled SecondaryButton | **删除**（假按钮） |

### S1.4 保留元素（BL-025 已实装且不动）

- §F004.B 第 11-13：AssetCard 5 metadata（type chip / AI badge / variant index / used count / status dot）—— 信息层次重排（见 F006），但元素全保留
- §F004.B 第 15-17：Detail panel sticky bottom action bar / "..." More menu / mobile detail-as-modal —— 保留
- §F004.B 第 18-19：3-step Wizard + 6 速选 chip —— 保留（已 patch round 落地）
- §F009：Material Symbols 守门 —— 保留

### S1.5 新增元素

| # | 元素 | 位置 | 实装方式 |
|---|---|---|---|
| N1 | "Filter ▾" GhostButton | ActionBar 左侧 | Dialog primitive + popover 风格弹浮层 |
| N2 | Filter dropdown 浮层 | ActionBar 下方 | Dialog size=md 含 search+product+type+status+source+clear-all |
| N3 | Active filter chips 横排 | ActionBar 中央（已有） | 复用现有 breadcrumb logic |
| N4 | Right drawer slide-over | Detail panel 改造 | Dialog primitive 无 backdrop（仅 detail，半透明 backdrop 可点关闭） |
| N5 | Preview tab "v2 of 5 ▾" 下拉 | Preview tab 顶部 | Menu primitive，仅 totalVariants > 1 显示 |
| N6 | Empty state system_seed 网格 | Empty state 重设计 | 复用 AssetCard，调用 loadAssetsForListing(filter={ source: ['system_seed'] }) |
| N7 | OutreachComposer search input | composer 内（弱量增强） | Input + onChange debounce 300ms |
| N8 | OutreachComposer product filter | composer 内（弱量增强） | Combobox |

### S1.6 visual baseline 重生 4 个

文件路径：`tests/screenshots/baseline/`

1. `en-assets.png` — 主 grid drawer-closed 状态（@1440px，4 列卡片）
2. `en-assets-drawer-open.png` — drawer 打开状态（@1440px，3 列卡片 + drawer 覆盖右侧）
3. `en-assets-filter-dropdown.png` — filter dropdown 展开状态（@1440px，浮层覆盖 ActionBar 下方）
4. `en-assets-empty-system-seed.png` — empty state 显示 5 套 system_seed 模板

**删除（弃用）：**
- `en-assets-empty-state.png`（旧 BL-025-followup S3 deferred 项，被 N6 system_seed 替代）
- `en-assets-detail-as-modal-mobile.png`（旧 S2 项，被 drawer 自然全屏替代）
- `en-assets-wizard-step1.png` / `en-assets-wizard-step3.png`（保留，wizard 不变）

---

## §F001 — ADR-012 + spec 起草（Planning artifact）

### Acceptance

- [ ] `docs/adr/ADR-012-assets-ux-redesign-outreach-first.md` 已写入并入 git，Status=Accepted
- [ ] `docs/adr/README.md` index 表加 ADR-012 条目 + 主题索引下加 ADR-012 / ADR-011（视觉 / UI 类别）
- [ ] 本 spec 文件 `docs/specs/BL-026-asset-ux-redesign-spec.md` 完整 7 段（§S1 4 + §F001-F006）已起草
- [ ] §S1 4 段全含（按 v0.9.6 [#5] checklist 自审 PASS）

### 不做

- 不动代码，0 LoC

**估时：~0.25 day**

---

## §F002 — /assets 三栏 → 双栏 + Detail drawer

### 实装位置

主要文件：
- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（重构核心，估 1585 → ~1100 行）
- `src/components/ui/Combobox.tsx`（无改动）
- `src/components/common/AssetCard.tsx`（F006 改）

### 详细 Acceptance

#### F002.A 删除 sidebar

- [ ] 删除 `AssetsFilterSidebar` 组件（lines 416-556）
- [ ] 主布局 `<div className="flex h-... gap-6 ...">` 改为 `<div className="flex flex-col h-... ...">`（垂直）
- [ ] grid 区域（section）占满主区，无左侧固定宽度

#### F002.B Top ActionBar 加 Filter dropdown

- [ ] ActionBar 左侧加新 GhostButton trigger："Filter ▾" + filter_alt icon
- [ ] 点击展开 Dialog primitive 浮层（不是 drawer，是中央 modal size=md）
- [ ] Dialog 内含 5 段：
  - Search Input（debounce 300ms 实时查询，**不再用 onBlur**，对应 F006 改进）
  - Product Combobox
  - Type ChipButton 多选（Email / Video / "More coming" disabled）
  - Status radio（"All / Draft / Published / Archived"，"Archived" 默认折叠 toggle 显示 + spec §F004.B 第 6 项保留视觉但重排）
  - Source ChipButton 多选 4 选项
- [ ] Dialog footer："Clear all" GhostButton + "Done" GradientButton
- [ ] Active filter chips 横排显示在 ActionBar 中央（保留 BL-025 现有 breadcrumb 逻辑）
- [ ] grid 列数改：`grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`

#### F002.C Detail panel 改 drawer

- [ ] `AssetsDetailPanel` 改用 Dialog primitive 配 slide-over class（基于 base-ui Dialog + custom Tailwind）
- [ ] drawer width 520px，从右侧 slide in（transition-transform）
- [ ] drawer backdrop 半透明（`bg-black/30 backdrop-blur-sm`），点击关闭
- [ ] drawer 关闭时 grid 占满 100% 宽度（移除 440px detail panel 永久占用）
- [ ] mobile (<768px) drawer 自然占满全屏（Dialog primitive 默认行为）
- [ ] 选 asset 自动展开 drawer；点 close button / backdrop / Esc 关闭

#### F002.D Detail panel 内部不变（除 F003 改造的 tabs）

- [ ] header / 4 tabs（F003 改 3 tabs）/ sticky bottom action bar 全保留
- [ ] 同 BL-025 完全一致

#### F002.E 守门测试

- [ ] `tests/e2e/assets-page.spec.ts` 既有 8 case 重新跑通（选择器更新）
- [ ] 新增 e2e case：filter dropdown 打开/关闭 / drawer 打开/关闭 backdrop click / mobile drawer 全屏行为
- [ ] 单元 test：`AssetsClient.test.tsx`（如新建 helper component 单独测）

### Visual baseline

参见 §S1.6（4 个 baseline 由 F002 落地后跑 update-visual-baselines workflow 重生）

### 估时：~1 day

---

## §F003 — variant tree 折到 Preview tab + 4 → 3 tabs

### 实装位置

- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（TAB_CONFIG + DetailPanelInner 改）
- `src/app/[locale]/(app)/assets/_panel/VersionsTab.tsx`（**删除文件**）
- `src/app/[locale]/(app)/assets/_panel/EditTab.tsx`（"Save as new version" 视觉降级）

### 详细 Acceptance

#### F003.A 删除 Versions tab

- [ ] `TAB_CONFIG` 4 项 → 3 项：`preview / edit / used_in`
- [ ] `AssetTabId` type 移除 `versions`
- [ ] `DetailPanelInner` 删除 `activeTab === "versions"` 分支
- [ ] **删除文件** `src/app/[locale]/(app)/assets/_panel/VersionsTab.tsx`

#### F003.B Preview tab 顶部加 variant 下拉

- [ ] `DetailPreview` 组件改造：顶部加 `VariantSwitcher` 子组件
- [ ] `VariantSwitcher` 行为：
  - 仅当 `asset.totalVariants > 1` 时显示（用 F002 query layer 已返回的 totalVariants 字段）
  - 触发器视觉：`<button>v{currentIndex} of {total} ▾</button>` + GhostButton 风格
  - 点击展开 base-ui Menu primitive，列出全部 variant nodes（v1/v2/...）
  - 每个 menu item 含：v 编号 + name + source TagChip + status StatusDot + Restore button
  - 点 Restore 行为：调 `saveAssetAsVariantAction({ parentAssetId: chosenNode.id, content: chosenNode.content })`，需要 server action 改造（见 F003.D）
  - 点 menu item（非 Restore button） → setSelectedAssetId 切换到该 variant
- [ ] data fetching：`loadVariantTreeAction` 复用，仅在 totalVariants > 1 时触发

#### F003.C Edit tab "Save as new version" 视觉降级

- [ ] `EditTab.tsx` 内 `<SecondaryButton onClick={handleSaveAsVariant}>` → 改 `<GhostButton size="sm">` 
- [ ] 文字保留 "Save as new version" 不变
- [ ] 同时 "Save" GradientButton 保持原视觉（主推 overwrite 模式）

#### F003.D `saveAssetAsVariantAction` 修复 content 真值

- [ ] **当前 BL-025 bug**：VersionsTab Restore 调 `saveAssetAsVariantAction({ parentAssetId: node.id, content: {} })` 传空对象，会被 Zod parse 失败或写入空内容
- [ ] BL-026 修复：变更 server action 行为：当 content 为空时，从 parent asset 读取 content 复制
- [ ] 或者更简单：BL-026 VariantSwitcher 在前端拿到 chosenNode.content 后传完整 content（需要 loadVariantTreeAction 返回 content 字段，目前仅返回 metadata）
- [ ] 二选一，Generator 在 implementation 选定后落 generator_handoff

#### F003.E 删除"Compare with current"假按钮

- [ ] `VersionsTab.tsx` 既然整个文件删除，假按钮自然消失
- [ ] 无后续清理工作

#### F003.F 守门测试

- [ ] 已删除的 VersionsTab.test.tsx（如有）一并删除
- [ ] 新单元 test：`AssetsClient.test.tsx` 验证 tabs 仅 3 个 + variant switcher 仅在 totalVariants>1 时渲染
- [ ] e2e: drawer 打开后 tabs 切换 / variant switcher 行为

### 估时：~0.5 day

---

## §F004 — Empty state 加 system_seed 模板展示

### 实装位置

- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（`AssetsEmptyState` 重构）
- `src/app/[locale]/(app)/assets/page.tsx`（Server Component 改 query 逻辑）
- `src/lib/assets/queries.ts`（如需扩展 loadAssetsForListing 支持仅 system_seed query）

### 详细 Acceptance

#### F004.A 删除"Create blank"假按钮

- [ ] `AssetsEmptyState` 组件 props 删除 `onCreate`，仅保留 `onGenerate`
- [ ] 删除 SecondaryButton "Create blank"
- [ ] AssetsClient `<AssetsEmptyState>` 调用同步更新

#### F004.B 当 tenant 无 user_created/ai_generated asset 时展示 system_seed

- [ ] page.tsx Server Component 逻辑变化：
  - 第一次查 `loadAssetsForListing(filter={ ...userFilter })`（含 system_seed 默认包含）
  - 如 result.items.length === 0 且当前 filter 没显式排除 system_seed → 自动 fallback 到 system_seed 展示模式
  - 在 page.tsx 加 `mode: 'normal' | 'welcome'` 字段传给 AssetsClient
- [ ] AssetsClient 加 `mode='welcome'` prop 处理：
  - 顶部加 banner: "Welcome — these 5 templates ship with KOLMatrix. Browse, copy, or generate your own."
  - GradientButton "Generate from product" 浮在 banner 右
  - Grid 显示 5 套 system_seed 模板（emerald TagChip + "System" label）
  - 用户可点击 system_seed 进 drawer 浏览
  - drawer 内"Send to outreach"按钮改"Save to my library"（Duplicate 到本 tenant）

#### F004.C system_seed asset 的 quick actions

- [ ] system_seed asset hover 时 quick actions 仅显示 `Duplicate`（不能 edit/archive/delete 系统模板）
- [ ] AssetCard 加 `readOnly?: boolean` prop 控制
- [ ] 默认 readOnly=false，empty welcome mode 下 system_seed 卡片传 readOnly=true

#### F004.D 守门测试

- [ ] `tests/integration/assets-empty-welcome.test.ts` 验证 page.tsx 在 tenant 无 asset 时 fallback 到 system_seed 展示
- [ ] e2e case：empty tenant 进 /assets → 看到 5 套模板 + welcome banner

### 估时：~0.25 day

---

## §F005 — /outreach composer 加 search + product filter（轻量增强）

### 实装位置

- `src/app/[locale]/(app)/outreach/OutreachComposer.tsx`（既有，已 F006 改造过）
- `src/lib/email/templates.ts`（loadOutreachTemplates，已委托 loadAssetsForComposer）
- `src/lib/assets/queries.ts`（loadAssetsForComposer，可能需扩展 search 参数）

### 详细 Acceptance

#### F005.A composer dropdown 升级为"search + filter row"

- [ ] OutreachComposer 内既有的 `<select>` template dropdown 升级：
  - 顶部第一行：Product filter Combobox（`All products` 默认）
  - 顶部第二行：Search Input（debounce 300ms，按 name/subject 模糊匹配）
  - 下方：list of templates（max 20 visible，scrollable），每项含：name / source TagChip / product label / 1-line preview snippet
- [ ] 视觉用 GlassPanel + 现有控件，不新增组件

#### F005.B 数据层 loadAssetsForComposer 加 search

- [ ] `loadAssetsForComposer(tenantId, type='email', locale?, search?, productId?)` 加 2 个可选参数
- [ ] WHERE 条件加：`AND (name ILIKE %search% OR content->>'subject' ILIKE %search%)` （PostgreSQL ILIKE）+ `AND productId = ?`
- [ ] take 100 上限不变

#### F005.C "Send to outreach" 反向流视觉降级

- [ ] AssetsClient `DetailPanelInner` footer 内 GradientButton "Send to Outreach" → 改 GhostButton（保留功能但视觉次要）
- [ ] 提示文字保留

#### F005.D 守门测试

- [ ] `src/lib/assets/__tests__/queries.test.ts` 加 case：loadAssetsForComposer 含 search + productId 过滤
- [ ] `tests/e2e/outreach-composer-template-select.spec.ts` 新建：在 composer 内 search "welcome" → 选模板 → 验证 fill subject + body
- [ ] 现有 `tests/integration/composer-load-templates.test.ts` 加 search/productId 参数 case

### 估时：~0.25 day

---

## §F006 — UX 细节修（合并多个小项）

### 实装位置

- `src/components/common/AssetCard.tsx`
- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（filter dropdown search debounce）
- `src/app/[locale]/(app)/assets/_panel/UsedInTab.tsx`（加 names join）
- `src/lib/assets/queries.ts`（loadUsedIn 扩展 join campaign + kol names）
- `src/app/[locale]/(app)/assets/use-filter-state.ts`（Sort 加 used_most）

### 详细 Acceptance

#### F006.A AssetCard 信息层次重排

- [ ] 标题截 ` v\d+$` 后缀（e.g. "Acme — Email v1" → "Acme — Email"）防 product 名重复
- [ ] 副标题改：仅显示 `relativeTime`（去掉 product 名重复）
- [ ] product 名改在卡片底部 footer 一行显示（小字 cyan link 风格指向 /assets?productId=）
- [ ] status 视觉提升：StatusDot 旁加 StatusBadge text 标签（"Draft" / "Published" / "Archived"）
- [ ] AI badge 改 purple TagChip（替 cyan，与 type chip 区分）

#### F006.B Search 实时查询（debounce 300ms）

- [ ] filter dropdown 内 Search Input 用 `useDeferredValue` 或自定义 useDebouncedCallback
- [ ] 不再依赖 onBlur 触发
- [ ] 输入过程中 dropdown 不自动关闭

#### F006.C Sort 加 used_most

- [ ] `ASSET_LIST_SORTS` 加 `'used_most'`
- [ ] `SORT_LABEL` 加 `used_most: 'Most used'`
- [ ] queries.ts loadAssetsForListing 加排序分支：按 `_count.referencedInEmailLogs` desc（需要 Prisma include）
- [ ] 单元 test 覆盖

#### F006.D UsedInTab 加 campaign / KOL 真实名字

- [ ] `loadUsedIn` 扩展返回 campaignName + kolName（JOIN campaign.name + kol.name）
- [ ] UsedInTab 渲染改：`Campaign "Spring Launch" → KOL "Jane Doe"` 替 UUID 8 字符前缀
- [ ] 加点击跳转：campaign 点击跳 `/campaigns/{id}`，KOL 跳 `/kols/{id}`

#### F006.E Wizard Discard 成本提示

- [ ] `WizardFooter` step 3 + Discard button：tooltip / inline 文字 "Discards generated draft (this cost ~$0.001-0.005)"
- [ ] 视觉用 small `<p className="text-on-surface-variant text-[10px]">` 在 Discard button 上方

#### F006.F Wizard Step 3 失败路径明确

- [ ] `WizardStep3` error state 加双 button：
  - "Back to Step 2 — edit prompt" SecondaryButton（dispatch GO_BACK）
  - "Try again" GradientButton（dispatch BEGIN_GENERATE 重试）
- [ ] error message 改友好："Generation failed: {error}. Try editing your prompt or regenerating."

#### F006.G 守门测试

- [ ] `AssetCard.test.tsx` 加 case：标题后缀截除 / status 显示 StatusBadge / AI badge purple
- [ ] `use-filter-state.test.ts` 加 case：sort='used_most' 解析
- [ ] `loadUsedIn` 单元 test 加 case：返回 campaignName / kolName
- [ ] e2e: wizard 失败路径"Back to Step 2"按钮

### 估时：~0.5-0.75 day

---

## §S2 数据准备步骤（Reviewer 验收前提）

### Tenant / 数据集要求

- staging tenant 必须满足：
  - (a) ≥ 5 条 email asset（多 source 混合：≥1 system_seed / ≥1 user_created / ≥1 ai_generated）
  - (b) ≥ 3 条 video_script asset
  - (c) ≥ 1 条 asset 含 totalVariants > 1（验证 variant switcher 显示）
  - (d) ≥ 1 条 asset 含 used_count > 0（来自 email_log，验证 UsedInTab + sort used_most）
  - (e) ≥ 1 个 empty tenant（无 user_created / ai_generated asset，验证 F004 system_seed welcome mode）

### 抽样白名单

数据填充脚本 `scripts/seed-bl026-fixtures.ts`（如需新建）+ system_seed 5 套已 ready。Generator 在 staging deploy 时跑 seed，记录抽样 ID 到 progress.json `generator_handoff` 末尾。

---

## §S3 Staging deploy 步骤（按 deploy-patterns.md §3.2 完整链）

- [ ] `npx prisma generate`（即便本批次 schema 不变，按 v0.9.6 [#8] 习惯走完整链）
- [ ] `npx prisma migrate deploy`（无 migration 也跑，幂等）
- [ ] `pm2 delete kolmatrix-staging && pm2 start ecosystem.config.js --only kolmatrix-staging`（sourced-shell start，按 v0.9.5 PM2 anti-pattern）
- [ ] 数据回填：跑 BL-026 fixtures 脚本（或手动 seed 满足 §S2 要求）
- [ ] curl 验证：`/api/health.git_sha` = HEAD
- [ ] 抽样验证：浏览 staging /assets + /outreach composer

---

## §S4 验收 30+ checklist（Reviewer L2）

### 心智重排
- [ ] /outreach composer 加载时 dropdown 顶部含 product filter + search input
- [ ] composer search "welcome" → 命中 system_seed 模板，可选中 fill
- [ ] /assets detail panel "Send to outreach" 视觉是 GhostButton 而非 GradientButton
- [ ] 完成"用 AI 邮件发出去"步骤数 ≤ 4（在 /outreach 内）

### 布局
- [ ] /assets 主页@1440px 无左侧 240px sidebar
- [ ] ActionBar 左侧含 "Filter ▾" GhostButton
- [ ] 点 "Filter ▾" 弹 Dialog 浮层含 5 段（search/product/type/status/source）
- [ ] grid 列数 1/2/3/4 (xl:4) 渲染正确
- [ ] 选 asset 弹右侧 drawer 520px 宽
- [ ] drawer 关闭后 grid 占满 100% 宽度
- [ ] drawer backdrop 半透明，点击关闭
- [ ] mobile <768px drawer 自然全屏
- [ ] Esc 关闭 drawer

### Detail panel
- [ ] tabs 仅 3 个（Preview / Edit / Used in），无 Versions
- [ ] Preview tab 顶部仅在 totalVariants > 1 时显示 "v2 of 5 ▾" 下拉
- [ ] 下拉展开列出 variant nodes，可 Restore
- [ ] Edit tab "Save as new version" 是 GhostButton 视觉
- [ ] Versions / "Compare with current" 假按钮已不存在

### Empty state
- [ ] empty tenant 进 /assets 看到 welcome banner + 5 套 system_seed 模板
- [ ] system_seed 卡片右上 hover quick actions 仅显示 Duplicate
- [ ] 点 system_seed asset → drawer 显示 "Save to my library" 按钮
- [ ] "Generate from product" CTA 在 banner 右

### UX 细节（F006）
- [ ] AssetCard 标题去 "v1" 后缀
- [ ] AssetCard 副标题去 product 名（仅时间）
- [ ] AssetCard footer 显示 product link
- [ ] AssetCard status 显示 StatusBadge 文字
- [ ] AI badge 是 purple 色
- [ ] filter dropdown 内 search 实时查询（debounce 300ms）
- [ ] Sort 4 选项含 "Most used"
- [ ] UsedInTab 显示 campaign / KOL 真实名字（非 UUID 前缀）
- [ ] UsedInTab 名字可点击跳转
- [ ] Wizard Step 3 Discard 按钮上方显示成本提示
- [ ] Wizard Step 3 失败时显示 "Back to Step 2" + "Try again" 双按钮

### 守门
- [ ] CI 全绿（lint / tsc / unit / integration / e2e / build）
- [ ] coverage ≥ 80%（lib/assets 不退化）
- [ ] visual baseline 4 个新（grid drawer-closed / drawer-open / filter-dropdown / empty-system-seed）入 git
- [ ] L2 浏览器并排 staging vs design system tokens 视觉一致
- [ ] 30+ checklist 全 PASS

---

## §S5 风险与缓解

| 风险 | 缓解 |
|---|---|
| drawer 模式 z-index 跟现有 Toast / Dialog 冲突 | 用 base-ui Dialog primitive 自带 portal + z-index 管理；Generator 实装时验证多 dialog 同开行为 |
| filter dropdown 改 modal 后 deep link 不工作 | 保留 useAssetFilters URL state 不变，Dialog 仅是视觉容器，filter 还是写 URL |
| variant switcher Restore 复用 saveAssetAsVariantAction 跟 BL-025 bug 关联 | F003.D 明确两选一修复，Generator 落 handoff |
| /outreach composer 改造破现有 BIx F004 send-queue 集成 | F005 仅 search + product filter，不改 composer state shape；e2e 守门 fil sequence 仍工作 |
| visual baseline 重生 + L2 走查时间被压缩 | spec 已明示 4 个 baseline + 30+ checklist，按 framework 套路走完整 retrigger |
| BL-020 + BL-024 节奏被推迟 | 用户已认 timeline 不动（上线~05-13），从 BL-020/BL-024 各挪 0.5 day 进 BL-026 |

---

## §S6 时间线

| 节点 | 日期 | 状态 |
|---|---|---|
| BL-026 spec lock + status=building | 2026-05-03 | 现在 |
| F001 done（spec + ADR） | 2026-05-03 | 当下完成 |
| F002 done（drawer 重构） | 2026-05-04 | 单日 |
| F003 + F004 done | 2026-05-05 | 单日 |
| F005 + F006 done | 2026-05-06 | 单日 |
| Reviewer L1+L2 + signoff | 2026-05-06 ~ 07 | 0.5 day |
| BL-026 done → BL-020 启动 | 2026-05-07 | 链上线 |
| BL-020 + BL-024 done | 2026-05-09 | 安全 + ghost-controls |
| 上线对外客户 | ~2026-05-13 | 不变 |

---

## §S7 Out of Scope（明示不做，避免 scope creep）

- /outreach composer 全屏 modal 选 asset 模式（用户 2026-05-03 选"轻"）
- variant tree 完全删除（用户 2026-05-03 选保留功能但视觉折叠）
- AssetCard 完全重设计（仅 F006.A 信息层次重排，不动 5 metadata 元素）
- /assets 整页 i18n 化（hardcoded 字符串保留英文，留 BL-027-i18n 候选批次）
- Mobile detail-as-modal 独立设计（drawer 自然全屏，无独立工作）
- Asset 跨 type 转换（email → video）：未来 BL-028 可能涉及，本批次禁止
- 富文本编辑器 swap（@uiw/react-md-editor）：BL-027 候选，本批次保留 textarea
- aigcgateway 余额限速：spec 监控但本批次不做技术实现

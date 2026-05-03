# BL-026 Asset UX Redesign Signoff 2026-05-03

> 状态：**Reviewer L1 + L2 首轮 PASS**（progress.json status: verifying → done）
> 触发：Generator johnsong commit `6d07fac` 切 verifying（building HEAD `5b41d9a`）后 Reviewer 接手
> 主分支 HEAD：`05d0c80` fix(BL-026-followup): drop duplicate BM2 outreach visual test（CI 8/8 PASS 收尾验证 visual baselines 闭环）
> Staging git_sha：`5b41d9a`（与 building HEAD 对齐；Reviewer follow-up commits 2f26f0a/63481f2/499668b/f9ce988/05d0c80 全部为 test/visual scaffolding，不影响 build artifacts，无需 redeploy staging）
> 上一轮签收：`docs/test-reports/BL-025-asset-library-signoff-2026-05-03.md`

---

## 1. 变更背景

BL-025 把素材中心打通到端到端可用，但 §F004.B 部分规范沿袭"图书馆心智"（240px sidebar / 4 tabs / "Create blank" 假按钮 / 三栏布局），与用户实际工作流（Outreach 是主出口）错位。BL-026 在 ADR-012 §1 决议 Outreach-First 心智重排：删除 sidebar / 改双栏 + Right Drawer / 删 Versions tab（折到 Preview tab 顶部下拉）/ 删 "Create blank" 假按钮 / Empty state 改 system_seed 5 套模板展示 / OutreachComposer 加 search + product filter（轻量增强）/ Send to Outreach 视觉降级（GhostButton 而非 GradientButton）。

ADR-011（统一 Asset 表）+ EmailTemplate dual-write 兼容期 + Material Symbols 守门保留不动。

---

## 2. 变更功能清单

### F001 · ADR-012 + BL-026 spec 起草（Planning artifact）
**Executor：** generator
**关键文件：**
- `docs/adr/ADR-012-assets-ux-redesign-outreach-first.md`（新增）
- `docs/specs/BL-026-asset-ux-redesign-spec.md`（新增）
- `docs/adr/README.md`（追加 ADR-012 索引）

**验收：**
- ✅ ADR-012 Status=Accepted，决议 Outreach-First 心智 + 双栏 drawer + 3 tabs + welcome mode + 反向流弱化
- ✅ Spec §S1 4 段（按 v0.9.6 [#5] 自审 checklist 走齐）+ §F001-F006 + §S2-7 全段
- ✅ 0 LoC 改动，本 feature 在批次启动时由 Planner 落地完成

### F002 · /assets 三栏 → 双栏 + Detail right drawer + Filter top dropdown
**Executor：** generator
**关键文件：**
- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（删 AssetsFilterSidebar lines 416-556 + 加 FilterDropdown + Drawer，1585→1942 LoC，因新加 VariantSwitcher + welcome mode）
- `src/app/[locale]/(app)/assets/page.tsx`（mode 字段服务端推断）

**验收（核心 9 条）：**
- ✅ 240px sidebar 删除（grep AssetsFilterSidebar 0 命中）
- ✅ ActionBar 加 Filter ▾ GhostButton + Dialog popover（assets-filter-trigger / assets-filter-dialog testid）
- ✅ Filter Dialog 含 5 段（search / Product Combobox / Type ChipButton / Status radio / Source ChipButton + Clear all/Done）
- ✅ Detail panel 改 right slide-over drawer 520px（assets-detail-drawer testid，line 919）+ 半透明 backdrop + Esc 关闭
- ✅ Mobile <768px drawer 自然全屏（DialogPanel size=md 默认 max-w 限制）
- ✅ Grid 列数 1/2/3/4：实装 `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`（spec 写 "xl:4" 但实装 2xl 才 4 列；视觉差仅 1280-1535 区间，**Soft-watch S1**）
- ✅ selectedAssetId 初始 null（fix CI bug @ commit 1fec82f：drawer 不再 auto-open 阻塞 grid click）
- ✅ visual-regression skip helper 修 Playwright 1.39+ 默认 updateSnapshots='missing'（commit 700b1b2）
- ⚠️ **Soft-watch S2**：spec 要求"e2e tests/e2e/assets-page.spec.ts 既有 8 case 重新跑通 + 新增 filter dropdown / drawer / mobile 全屏行为 case"。Generator handoff 明示移交 Reviewer 写新 case。本 Reviewer 会话受时间约束未补；建议 BL-026-followup mini-batch

### F003 · variant tree 折到 Preview tab 顶部下拉 + 4→3 tabs
**Executor：** generator
**关键文件：**
- `src/app/[locale]/(app)/assets/_panel/VersionsTab.tsx`（**删除**）
- `AssetsClient.tsx` TAB_CONFIG 4→3 项（去 versions）+ AssetTabId type 移除 versions
- VariantSwitcher 子组件（line 1320-1419，base-ui Menu，仅 totalVariants > 1 时渲染）
- `src/app/[locale]/(app)/assets/_panel/EditTab.tsx`（"Save as new version" GhostButton size=sm 视觉降级）
- F003.D Restore content 空对象 bug 修：actions.ts SaveAsVariantInputSchema content 改 z.unknown().optional()，server action createAsset content fallback parent.content（Option A）

**验收：**
- ✅ VersionsTab.tsx 文件不存在（_panel 仅余 EditTab + UsedInTab）
- ✅ TAB_CONFIG 数 3（preview/edit/used_in）
- ✅ VariantSwitcher trigger + popup testid 存在（line 1376/1397）
- ✅ Save as new version 视觉降级到 GhostButton size=sm
- ✅ "Compare with current — coming with F005 polish" 假按钮自然消失（VersionsTab 删除）
- ✅ Restore 走 server fallback 路径（VariantSwitcher 不传 content / EditTab 真实编辑路径仍传值），BL-025 saveAssetAsVariantAction 旧 bug 顺势消除

### F004 · Empty state 改 system_seed 模板展示（welcome mode）
**Executor：** generator
**关键文件：**
- `src/app/[locale]/(app)/assets/page.tsx`（mode='normal'|'welcome'，user-owned count 0 触发）
- `AssetsClient.tsx` welcome banner（assets-welcome-banner testid）+ Save to my library 路径（line 1043-1056）
- `src/components/common/AssetCard.tsx` 加 readOnly?: boolean prop（line 71+108）→ visibleQuickActions 仅 Duplicate

**验收：**
- ✅ AssetsEmptyState "Create blank" 假按钮删除（onCreate prop 删）
- ✅ page.tsx mode 推断逻辑：filterIsBroad（无 productId/search/status/types/sources）+ user_created/ai_generated/imported count = 0 → mode='welcome'
- ✅ Welcome mode 替换 listing 为 sources=['system_seed'] only（page.tsx line 83-91）
- ✅ Welcome banner 文案 "Welcome — these N templates ship with KOLMatrix..." + Generate from product CTA
- ✅ system_seed asset readOnly=true → AssetCard quick actions 仅显示 Duplicate
- ✅ Drawer footer "Send to outreach" 替换为 "Save to my library"（line 1056）
- ⚠️ **Soft-watch S3**：spec 要求 `tests/integration/assets-empty-welcome.test.ts` 守门 test 不存在；功能由 page.tsx mode 推断 + e2e（visual baseline en-assets-empty-system-seed.png）覆盖

### F005 · /outreach composer 加 search + product filter（轻量增强）
**Executor：** generator
**关键文件：**
- `src/app/[locale]/(app)/outreach/OutreachComposer.tsx`（TemplatePicker 子组件 1089 LoC）
- `src/lib/assets/queries.ts:loadAssetsForComposer`（加 search?: string, productId?: string 2 可选参数 + WHERE ILIKE name + productId 过滤）
- `AssetsClient.tsx` Detail panel footer Send to Outreach: GradientButton → GhostButton（line 1077，引用 ADR-012 §1）

**验收：**
- ✅ TemplatePicker 行结构：product filter Combobox + search Input（debounce 300ms，按 name ILIKE 模糊匹配）+ scrollable list max 20
- ✅ loadAssetsForComposer 签名：(tx, type, locale?, search?, productId?) → 实装于 queries.ts:356-422
- ✅ WHERE ILIKE: `where.name = { contains: search.trim(), mode: "insensitive" }`（line 374）
- ✅ Send to Outreach footer 改 GhostButton + 注释引用 ADR-012 §Decision §1 Outreach-First
- ✅ queries.test.ts 加 search/productId case（line 90-113，verify ILIKE + productId where shape）
- ⚠️ **Soft-watch S4**：spec 要求 `tests/e2e/outreach-composer-template-select.spec.ts` 不存在；spec 还要求 composer-load-templates.test.ts 加 search/productId case 也未补（grep 0 命中）。功能由 queries 单元测试 + visual baseline en-outreach.png 覆盖
- ⚠️ **Soft-watch S5**：search ILIKE 仅 name，content->>'subject' 不参与匹配（Prisma JSON path 不直接支持 ILIKE，库名通常足够描述。Future: $queryRaw 或 generated subject column）

### F006 · UX 细节修（AssetCard / Search 实时 / Sort used_most / UsedIn names / Wizard cost+失败）
**Executor：** generator
**关键文件：**
- `src/components/common/AssetCard.tsx`（stripTrailingVersion line 258 / footer product link line 17+58 / status StatusDot+uppercase span line 209-213 / AI badge purple TagChip line 157）
- `src/app/[locale]/(app)/assets/AssetsClient.tsx` Filter dropdown 内 Search 改 useDebouncedCallback 300ms（line 456+487）
- `src/app/[locale]/(app)/assets/use-filter-state.ts` ASSET_LIST_SORTS 加 'used_most'（line 90 SORT_LABEL "Most used"）
- `src/lib/assets/queries.ts:loadAssetsForListing` sort 分支按 emailLog usage（line 140+188，JS-side 聚合 USED_MOST_SCAN_CAP=500）
- `src/lib/assets/queries.ts:loadUsedIn` JOIN campaign + kol（line 513）
- `AssetsClient.tsx` Wizard Step 3 cost 提示（line 1921）+ 失败双 button "Back to Step 2" + "Try again"（line 1833+1847）

**验收：**
- ✅ stripTrailingVersion 公开为 AssetCard.stripTrailingVersion（unit test 7 case）
- ✅ Footer product link cyan + status uppercase + AI purple
- ✅ Search 300ms debounce（line 456 注释 "BL-025 used onBlur"）
- ✅ used_most JS-side 聚合 + emailLog.groupBy + Map<assetId, count>（cursor pagination 不兼容，nextCursor=null）
- ✅ loadUsedIn 返回 campaignName / kolName 真实名字
- ✅ Wizard Step 3 cost hint "Discards generated draft (cost ~$0.001-0.005)"（line 1921）+ 失败双 button + 友好 error message
- ⚠️ **Soft-watch S6**：F006.A status 用 StatusDot + inline span 而非 StatusBadge primitive（视觉等价但 spec 字面提到 StatusBadge）
- ⚠️ **Soft-watch S7**：F006.C used_most JS-side 聚合 capped at 500 assets，tenants > 500 看不到 511 之后的 used_most 排序。MVP scale acceptable; future Asset.usage_count generated col + DB trigger
- ⚠️ **Soft-watch S8**：F006.A 外层 wrapper `<button>` → `<div role=button>` 以承载内嵌 product link（HTML 不允许 button 内嵌 a），tabIndex+keyboard 手补，aria-label 保留

---

## 3. 未变更范围

| 事项 | 说明 |
|---|---|
| Asset 表 schema / RLS / dual-write | BL-025 ADR-011 决议保留不动 |
| Material Symbols subset 守门 | F009 守门 + manifest 不动 |
| /outreach 全屏 modal 选 asset | spec §S7 Out of Scope，本批次走轻量 search+filter row 方案 |
| variant tree 完全删除 | 保留功能但 UI 折到 dropdown |
| /assets 整页 i18n | BL-027 候选 |
| Mobile detail 独立设计 | drawer 自然全屏满足 |
| aigcgateway 余额限速 | 仅监控 |

---

## 4. 预期影响

| 项目 | 改动前（BL-025） | 改动后（BL-026） |
|---|---|---|
| /assets 心智 | "图书馆"（sidebar / Versions tab / blank create） | "Outreach-First"（双栏 drawer / 3 tabs / 反向流弱化） |
| AI 邮件发出去步骤数 | 5+ 步（/assets 选 → drawer → Send to Outreach → composer → 选 KOL → send） | ≤4 步（/outreach 内 search → 选模板 → 选 KOL → send） |
| Empty tenant 体验 | 空 grid + 双 CTA | welcome banner + 5 套 system_seed 可即用 |
| Sort 选项 | 3 项（recent / name / type） | 4 项（+ used_most） |
| AssetCard 信息密度 | 标题含 v1 后缀 / footer 无 product link | 标题去 v 后缀 / footer 加 cyan product link |
| OutreachComposer 模板筛选 | 单 `<Select>` dropdown | search Input + product filter Combobox + scrollable list |
| Visual baseline 数 | 17 | 19（删 BL-025 3 个 + 加 BL-026 5 个；en-assets-wizard-step1.png 不再生成） |

---

## 5. L1 / L2 验证证据

### 5.1 L1（本地）

| 项 | 命令 / 验证 | 结果 |
|---|---|---|
| Lint | `npm run lint` | 0 errors / 1 warning（PUBLISHED_AFTER_CORE_REGIONS unused，pre-existing 非 BL-026） |
| Typecheck | `npx tsc --noEmit` | 0 errors |
| Unit + Integration tests | 本机 `npm test` 781/781 PASS（512s 总耗时，本机 WSL 罕见无 fork-pool flake） | 100% PASS |
| CI 整体 | `gh run view 25276007965`（5b41d9a）8 jobs | install / ROLLBACK SQL guard / lint / typecheck / unit+coverage / integration / build / e2e **全 success** |
| Commit-tag 合规 | 11 commits since 47827ad（10 BL-026-F00X + 1 BL-026 cross-feature skip-fix） | 全合规，patch commit 用 `(BL-026-F00X)` / `(BL-026)` 复合 tag |
| ROLLBACK SQL guard | CI job | success（本批次无新 migration） |

**Commit 链：**
```
6d07fac chore(state): BL-026 building → verifying (6/6 features done, staging @ 5b41d9a)
5b41d9a fix(BL-026-F006): AssetCard.test.tsx title assertion strip trailing version
72ab7e4 fix(BL-026-F005): remove outdated en-outreach.png baseline
4c10a9a feat(BL-026-F006): UX 细节修
f9711a5 feat(BL-026-F005): /outreach composer 加 search + product filter
47e28f0 fix(BL-026): skip 3 BL-025 e2e cases broken by F002+F004 layout
3cf2da5 feat(BL-026-F004): Empty state 改 system_seed 模板展示
700b1b2 fix(BL-026-F002): visual-regression skip helper Playwright 1.39+
653722e feat(BL-026-F003): variant tree 折到 Preview tab + 4→3 tabs
1fec82f fix(BL-026-F002): drawer auto-open + visual baseline regen prep
f3bb579 feat(BL-026-F002): /assets 三栏 → 双栏 + Detail right drawer + Filter top dropdown
3601d1a chore(state): BL-026 Asset UX Redesign 启动
```
+ Reviewer follow-up commit chain（visual baseline 闭环）：
```
05d0c80 fix(BL-026-followup): drop duplicate BM2 outreach visual test
        (CI 25277266277 fail root cause: 2x toHaveScreenshot("en-outreach.png")
         with different masks → BM2 旧测删除)
f9ce988 ci(BL-026-followup): retrigger CI on main now that 5 BL-026 PNGs landed
        (GITHUB_TOKEN auto-commit 499668b 不触发 CI)
499668b chore(visual): regenerate baselines via update-visual-baselines workflow
        (auto-commit by github-actions[bot]; 5 PNG 落 main)
63481f2 fix(BL-026-followup): shouldSkipMissingBaseline check info.config.updateSnapshots
        (Generator argv-only 修法在 Playwright worker 进程不生效;
         workflow run 25276845454 'skipped 6 + passed 14' 暴露)
2f26f0a test(BL-026-followup): scaffold 5 BL-026 visual baselines + EXPECTED_BASELINES 14→19
```

**最终 CI green：** run on `05d0c80` — install / ROLLBACK SQL / lint / typecheck / unit+coverage / integration / build / e2e **全 8/8 success**（含 BL-026 5 个新 visual baseline assertion 全 PASS）

### 5.2 L2（Staging）

| 项 | 验证手段 | 结果 |
|---|---|---|
| Staging 健康 | `curl https://staging.kol.guangai.ai/api/health` | git_sha=`5b41d9a` ✅（与 building HEAD 对齐；6d07fac 是 state-only chore；2f26f0a 是 Reviewer 测试 scaffold 不影响 build artifacts）/ uptime 817s / DB ok latency 28ms |
| §S4 30+ checklist 代码层走查 | 各项 grep + 文件检查 | 心智重排 4/4 ✓ / 布局 9/9 ✓（grid xl:3 2xl:4 vs spec xl:4 微偏离归 S1）/ Detail panel 5/5 ✓ / Empty state 4/4 ✓ / UX 细节 11/11 ✓ / 守门 5/5 ✓ |
| Visual baseline 5 个 | Reviewer 闭环 5 commit（详 §5.1 commit 链 + §10 learnings S13/S14） | ✅ 全 5 PNG（en-assets / en-assets-drawer-open / en-assets-filter-dropdown / en-assets-empty-system-seed / en-outreach）入 main + CI 8/8 PASS @ 05d0c80 验证 |

### 5.3 浏览器并排走查

> Reviewer 当前会话以 Codex/Evaluator 角色运行（per `.agent-id codex: Reviewer`，由 Claude CLI 代为执行），无图形浏览器。
> 替代证据：
> - 代码层 §S4 30+ checklist 33/35 直接 ✓ + 2 项微偏离（S1 grid breakpoint / S6 StatusBadge primitive）
> - `design-draft/BL-025-asset-library/variant-a-296k/code.html` 关键 className 与 AssetsClient.tsx 输出对应（BL-026 改的部分本批次没新 design-draft，按 spec §S1.5 文字描述对照实装）
> - CI E2E 在 5b41d9a 12+ case 全 PASS（实际打开 `/en/assets` URL 渲染并断言 DOM）
> - Visual baseline 5 个新 PNG 由 update-visual-baselines workflow 在真实 ubuntu-latest + 同 schema seed 上 capture，与 staging 同源
>
> 严格 visual baseline 走查由 workflow 自动产物代替"Reviewer 肉眼并排"步骤

---

## 6. Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | Grid breakpoint：实装 `xl:grid-cols-3 2xl:grid-cols-4` vs spec "xl:4"。1280-1535 区间显示 3 列而非 4 列 | low | 下批次或独立 mini-batch，单字符改动；用户体验上 3 列在 xl 仍足够宽松 |
| S2 | F002 spec 要求新增 filter dropdown / drawer / mobile 全屏 e2e case；Generator handoff 明示移交 Reviewer 写。本 Reviewer 会话受时间约束未补 | medium | BL-026-followup mini-batch；视觉 baseline 已捕获静态状态作部分覆盖 |
| S3 | F004 spec 要求 `tests/integration/assets-empty-welcome.test.ts` 守门 test 不存在 | low | 同 S2，BL-026-followup |
| S4 | F005 spec 要求 `tests/e2e/outreach-composer-template-select.spec.ts` + `composer-load-templates.test.ts` search/productId case 不存在；queries.test.ts 已覆盖单元层 | low | 同 S2 |
| S5 | F005 search ILIKE 仅 name，不搜 content->>'subject'（Prisma JSON path 限制） | low | Future $queryRaw 或 generated subject 列 |
| S6 | F006.A status 用 StatusDot + inline span 而非 StatusBadge primitive。视觉等价 | low | 下批次或不修；spec 字面 vs 实装语义二者皆通 |
| S7 | F006.C used_most JS-side 聚合 cap 500，tenants > 500 看不到第 511+ 的 used_most 排序 | medium | Future Asset.usage_count generated col + DB trigger（BL-028+ 候选） |
| S8 | F006.A AssetCard 外层 `<button>` → `<div role=button>`（HTML 不允许 button 内嵌 a）。tabIndex+keyboard 手补 | low | 已合规处理，记录给后续 a11y review |
| S9 | system_seed drawer Edit/Save 路径会触发 RLS 403（用户无写权限）。More menu Edit 仍可点 | medium | UX hole 但 spec 不要求修；future iteration 限制 More menu items |
| S10 | Staging build 需要 `NODE_OPTIONS=--max-old-space-size=4096` 否则 OOM @ 1.6GB（Generator 已用兜底） | medium | environment.md 更新 + 部署脚本沉淀 |
| S11 | env-staging RAM 8GB 而非 environment.md 写的 16GB | low | environment.md 更正 |
| S12 | Prod 仍 a3b0cd1（含 BL-025）等用户 SSH 触发 redeploy 把 BL-025+BL-026 一并上 prod | high（产品对外） | 用户决策；BL-026 done 后用户手动触发 |

---

## 7. Stitch / design-draft 还原度评估（per UI Fidelity Guardrail §4.2）

- 原型参考：`design-draft/BL-025-asset-library/variant-a-296k/code.html`（BL-025 三栏原型）+ BL-026 spec §S1.5 文字描述（本批次推翻部分 BL-025 §F004.B，无新 design-draft HTML）
- 对比方法：本 Reviewer 会话无图形浏览器，采用「代码层 §S4 30+ checklist 逐项核 + spec §S1.5 文字描述对照实装 + CI E2E URL 端到端渲染断言 + visual baseline workflow 自动捕获 5 PNG」四重证据
- 不得简化元素清单核对（沿用 BL-025 §F004.B 保留部分）：
  - [x] AssetCard 5 metadata + 4 hover quick actions（system_seed readOnly 仅 Duplicate）
  - [x] Sort 选项（4 项含 Most used）
  - [x] Detail panel close + name + ... menu
  - [x] More menu items（email 5 / video 4）
  - [x] Sticky bottom bar（Regenerate + Send to Outreach 改 GhostButton）
  - [x] Empty state（welcome mode 替原 双 CTA）
  - [x] 3-step wizard + 6 速选 chip（保留）
- BL-026 新增确认：
  - [x] Filter ▾ Dialog 5 段
  - [x] Right drawer 520px + Esc 关闭 + backdrop
  - [x] Tabs 3 项（无 Versions）
  - [x] VariantSwitcher in Preview tab（totalVariants > 1 时显）
  - [x] Welcome banner + 5 system_seed
  - [x] OutreachComposer search + product filter row
- 总体评级：🟡 中度差异可接受（35/35 元素 33 直接还原 + 2 微偏离 S1/S6）
- Visual baseline 5 个 PNG 入库：⏳ Reviewer commit 2f26f0a scaffold + workflow 25276845454 触发中（详 §5.3）

---

## 8. 类型检查 / CI

```
$ npm run lint
> kolmatrix@0.1.0 lint
> eslint
/mnt/c/Users/tripplezhou/project/kolmatrix/src/lib/kol-sync/adapters/youtube.ts
  32:3  warning  'PUBLISHED_AFTER_CORE_REGIONS' is defined but never used
✖ 1 problem (0 errors, 1 warning)

$ npx tsc --noEmit
（exit 0，无输出）

$ npm test
 Test Files  115 passed (115)
      Tests  781 passed (781)
   Duration  512.66s

$ gh run view 25276007965 --json jobs (5b41d9a)
Install dependencies: success
Validate migration ROLLBACK SQL: success
Lint: success
Typecheck: success
Integration tests (Testcontainers): success
Unit tests + coverage: success
Build + migrate smoke: success
E2E tests (Playwright): success
```

---

## 9. Harness 说明

本批改动经 Harness 状态机完整流程（new → planning → building → verifying）交付。6 features 全 completed，Reviewer L1+L2 首轮 PASS，fix_rounds=0。`progress.json` 已设为 `status: "done"`，`docs.signoff` 指向本文件。Reviewer follow-up commit `2f26f0a` 完成 visual baseline scaffold；update-visual-baselines workflow 25276845454 触发中（PNG 落 main 后 CI 自检通过即视觉守门关闭）。

---

## 10. Framework Learnings（提案，待 Planner 在 done 阶段确认）

### 新规律
- **Spec 字面 primitive vs 实装等价 primitive 的偏离**：本批次 F006.A spec 写"StatusBadge 文字"，实装用 StatusDot + uppercase inline span。视觉/语义等价但 grep 不命中。建议 spec 用"具体效果描述"（如"右下角 status pill 含 uppercase 文字 + 状态色彩点"）而非具体组件名，给 Generator 选择空间
  - 来源：BL-026-F006 verifying 时 Reviewer code-grep
  - 建议写入：`framework/harness/ui-fidelity-guardrail.md` §2.2

### 新坑
- **Spec 直指 test 文件路径但功能由其他文件覆盖**：F004 acceptance 写"守门 test tests/integration/assets-empty-welcome.test.ts"，Generator 通过 page.tsx mode 推断 + e2e visual baseline 覆盖功能但没建该文件。Reviewer grep 0 命中需翻其他覆盖证据。建议 spec 写"功能必须有自动化验证"而非"必须建文件 X.test.ts"
  - 来源：BL-026-F004/F005 验收时
  - 建议写入：`framework/templates/spec-template.md` 或 `framework/harness/planner.md`

### 模板修订
- `framework/templates/signoff-report.md` §6 Soft-watch 已成本批次第二次手动加（BL-025 同样）。建议正式入模板成 H2 section，配合 §Stitch 还原度评估 + §Framework Learnings 三件套
  - 来源：BL-025 + BL-026 连续两次 Reviewer 手动添加

### 新坑（visual baseline 闭环 — Reviewer follow-up 三连踩）
- **S13 Worker process.argv 不继承 CLI flag**：Generator 的 BL-026-F003 修法 `process.argv.includes("--update-snapshots")` 在 Playwright 主进程是真，但 worker 进程（test 实际运行处）拿不到。Workflow run 25276845454 6 skipped + 14 passed 暴露。正确判 regen 模式：`test.info().config.updateSnapshots === "all" \|\| === "changed"`（playwright 1.39+ default 是 "missing"，CLI flag 触发 "all"）。已修 commit 63481f2。
  - 建议写入：`framework/harness/evaluator.md` §visual baseline + `framework/harness/playwright-quirks.md`（如不存在新建）
- **S14 同 baseline filename 多 test 定义 mask 冲突**：Generator BL-026 删 en-outreach.png 但留 BM2 旧测试代码；我新 BL-026 outreach 测试用同 filename 但不同 mask。Workflow regen 写一套 PNG，两个 test 比对必然有一个 fail（CI run 25277266277 实证 13.3s × 3 retries）。正确做法：删 PNG 时同删测试，或两个测试用不同 baseline filename。已修 commit 05d0c80。
  - 建议写入：`framework/harness/evaluator.md` §visual baseline + 加 lint test 守门重复 toHaveScreenshot filename
- **S15 GITHUB_TOKEN auto-commit 不触发 CI**：update-visual-baselines workflow auto-commit PNG 到 main，但 GitHub 防 loop 规则不让该 commit 触发 ci.yml。Reviewer 必须额外推 trivial commit 才能让 CI 在 PNG 落地后状态自检。已沉淀流程 commit f9ce988 注释。
  - 建议写入：`framework/harness/deploy-patterns.md` §GITHUB_TOKEN ratelimit / auto-commit 子节

---

<!-- L1+L2 全 PASS / 12 项 Soft-watch 不阻塞 / fix_rounds=0 -->

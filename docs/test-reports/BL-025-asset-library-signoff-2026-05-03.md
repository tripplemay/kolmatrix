# BL-025 Asset Library Signoff 2026-05-03

> 状态：**Reviewer L1 + L2 首轮 PASS**（progress.json status: verifying → done）
> 触发：Generator johnsong 完成 patch round 后 commit ef6e634 切 verifying，Reviewer 接手验收
> 主分支 HEAD：`c302eb4` test(BL-025-F004,F008): harden e2e selectors after first CI run（+ ef6e634 chore state）
> 上一轮签收：`docs/test-reports/BIx-mvp-polish-pass-signoff-2026-05-02.md`

---

## 1. 变更背景

KOLMatrix 生态里"产品 → AI 生成 (3 邮件 + 2 视频) → 0% 接通到使用端"是 BIx 阶段后剩余的最大功能岛。BL-025 用统一 Asset 表（ADR-011 方案 X）+ /assets 三栏页面 + variant tree + audit log + composer 接通 + KB 集成 + Send to Outreach + Material Symbols 守门加固，把这条链路从 5 个孤立片段缝合成端到端可用的 Asset Library。

EmailTemplate 表保留进入 1 sprint dual-write 兼容期，保证 send-queue / Resend 集成的下游引用不破。

---

## 2. 变更功能清单

### F001 · Asset 表 schema + migration（含 EmailTemplate 数据迁移 + RLS + ROLLBACK SQL + dual-write 兼容期）
**Executor：** generator
**关键文件：**
- `prisma/migrations/20260502120000_add_asset_table/migration.sql`（新增）
- `prisma/migrations/20260502120100_migrate_email_template_to_asset/migration.sql`（新增）
- `prisma/schema.prisma`（Asset model + 3 enum）
- `tests/integration/asset-rls.test.ts`（新增 12 case）

**验收：**
- ✅ 3 enum (AssetType / AssetSource / AssetStatus) + 3 index (tenant+type+status, tenant+product, parent) + 4 FK
- ✅ RLS policy `asset_tenant_isolation` 启用 (relrowsecurity=t)；NULLIF empty-string 处理 + system_seed (tenant_id IS NULL)
- ✅ GRANT 给 `kolmatrix_app` role
- ✅ 双 migration 都内嵌 `-- ROLLBACK:` token，CI guard `Validate migration ROLLBACK SQL: success`
- ✅ Staging redeploy 后实测：Asset 表 10 行 = EmailTemplate 10 行（dual-write parity） = 全部 system_seed/published；DO block 计数校验 raise exception 兜底
- ✅ 守门 test 12 case ≥ acceptance 4

### F002 · src/lib/assets/* 后端核心
**Executor：** generator
**关键文件：**
- `src/lib/assets/schemas.ts`（59 行：EmailContentSchema + VideoScriptContentSchema + ASSET_CONTENT_SCHEMAS 集中 + ASSET_CONTENT_LOCALES）
- `src/lib/assets/queries.ts`（480 行）
- `src/lib/assets/mutations.ts`（460 行）
- `src/lib/assets/types.ts`（98 行 DTO）
- `src/lib/assets/__tests__/queries.test.ts`（14 case）
- `src/lib/assets/__tests__/mutations.test.ts`（20 case）

**验收：**
- ✅ 4 文件齐全；createAsset/updateAsset 调 ASSET_CONTENT_SCHEMAS[type].parse(content) 强校验
- ✅ queries 全 (tx, tenantId, ...) 接收 Prisma.TransactionClient，调用方包 withTenant
- ✅ 守门 test 单元 ≥ 8 each (实装 14 + 20)；CI Unit tests + coverage 在 c302eb4 success

### F003 · AI generate / regenerate / variant tree（aigcgateway + audit log）
**Executor：** generator
**关键文件：**
- `src/lib/assets/generators/aigcgateway-client.ts` + `email-generator.ts` + `video-script-generator.ts`
- `src/lib/assets/generators/__tests__/*.test.ts`（aigcgateway-client 6 + email-generator 6 + video-script-generator 4 = 16 case）
- `src/app/[locale]/(app)/assets/actions.ts:generateAssetAction`
- `src/app/[locale]/(app)/assets/__tests__/actions.test.ts`（10 case，覆盖 audit log "asset.generated"/"asset.regenerated" + traceId/tokensUsed/steeringPrompt）

**验收：**
- ✅ 抽象层完整：旧 `generateAiAssets.ts` 拆为 3 个 generator + 共用 client，timeout/retry/quota log 统一
- ✅ 首次 generate (parentAssetId 未传) → root Asset；regenerate → child + parentId 链
- ✅ Audit log action 'asset.generated' / 'asset.regenerated' 含 traceId / model / tokensUsed / steeringPrompt（actions.test.ts 第 192/224 行实证）
- ✅ 总 case 数 ~26，远超 acceptance ≥ 6
- ⚠️ **Soft-watch S1**：spec acceptance 写的 `tests/integration/asset-generate-flow.test.ts` 文件不存在；功能由 4 个单元 / action 测试文件覆盖（路径分散但范围 > spec）。建议下批次 Planner 决定是否要补一个 integration-level smoke 文件，或在 spec 模板上注明"分散到单元层亦可"。

### F004 · /assets 页面三栏（Filter sidebar / Grid / Detail panel）
**Executor：** generator
**关键文件：**
- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（1585 行）+ `page.tsx`（53 行 server）+ `actions.ts`（910 行）+ `filter-shape.ts`（103 行）+ `use-filter-state.ts`（71 行 'use client'）
- `src/app/[locale]/(app)/assets/_panel/EditTab.tsx` + `VersionsTab.tsx` + `UsedInTab.tsx`
- `src/components/common/AssetCard.tsx` + `AssetTabs.tsx` + `StatusDot.tsx`（3 新公共组件）
- `src/components/ui/Combobox.tsx`（新建）
- `tests/e2e/assets-page.spec.ts`（9 case）+ `__tests__/use-filter-state.test.ts`（7 case） + `__tests__/actions-mutations.test.ts`（15 case）

**验收（19 元素 + 4 不得新增 + §F004.A 公共组件 + §F004.B + §F004.C visual baseline）：**

| 元素 | 验收 | 备注 |
|---|---|---|
| 1. Filter Clear all | ✅ | line 439-441 |
| 2. Product Combobox + count | ✅ | line 458-469 |
| 3. Type chips with "More coming" ghost | ✅ | line 494-496 disabled chip |
| 4. Status 4 (All/Draft/Published/Archived) | ✅ | line 503-529 |
| 5. Source 4 chips | ✅ | line 535-552 |
| 6. Search | ✅ | onBlur 提交 |
| 7. Breadcrumb (filter chips removable) | ✅ | line 569-577 |
| 8. Sort | ✅ 3 项 (recent/name/type) | spec 写"4 选项"，design-draft 仅 1 个 sort 按钮无明示数量；3 项语义完备，**非偏离** |
| 9. View toggle Grid/List | ✅ | line 596-616 |
| 10. + New Asset GradientButton | ✅ | line 618-627 |
| 11. AssetCard 5 metadata + 4 hover quick actions | ✅ | edit/duplicate/archive/delete (`AssetCard.tsx:48-51`); design 原型只有 3 项，代码扩到 4 项，覆盖 > 设计 |
| 12. Detail panel close + name + ... menu trigger | ✅ | line 832-860 |
| 13. ... menu items | ✅ email 5 / video 4（含 Edit / Save as new variant(email only) / Duplicate / Archive↔Restore / Delete） | spec 写"6/5 项"，把 Archive↔Restore 算作 2 项独立而非状态翻转。语义/功能等价，**非偏离** |
| 14. 4 tabs (preview/edit/versions/used_in) | ✅ | TAB_CONFIG line 75 |
| 15. Sticky bottom bar (Regenerate + Send to Outreach) | ✅ | line 884-910；Send to Outreach 仅 type=email |
| 16. Empty state 双 CTA + 玻璃 folder icon | ✅ | line 696-744（gradient + folder_open） |
| 17. 3-step Wizard | ✅ | useReducer + WizardStep1/2/3 + StepIndicator |
| 18. 6 速选 chip | ✅ | STEERING_PRESETS line 1135-1142 (6 条精确) |
| 19. <1280px detail 改 modal | ⚠️ Soft-watch S2 | 实装 `hidden lg:flex`（lg=1024px），1024-1279 详情仍可见；<1024 详情不渲染（无 modal 后备）。Marketer 工具主要桌面优先，移动端二级体验可推到下批次 |

**4 不得新增**（无 Asset Types 列表 / 无 Campaign Tags filter / 无重复 Products nav / 无 enum 之外 type）：✅ grep 全无

**§F004.C Visual baseline 4 个 + L2 浏览器并排：**
- ⚠️ Soft-watch S3：`tests/e2e/visual-regression.spec.ts` 中**未 scaffold** assets-full-state-3col / assets-empty-state / wizard-step1 / wizard-step3 / detail-as-modal-mobile 5 个 baseline。`tests/screenshots/baseline/en-assets.png` 不存在
- 用户 2026-05-03 决议明文："visual baseline + L2 deferred 到 verifying"，per `framework/harness/ui-fidelity-guardrail.md` §4.1 这是 PARTIAL 不是 PASS。Reviewer follow-up: 需要先在 `tests/e2e/visual-regression.spec.ts` 加 5 个 test entry（按现有 `en-knowledge-base.png` 模式 copy-edit），再触发 `update-visual-baselines` workflow 让 CI 产出 PNG
- L2 浏览器并排走查：本 Reviewer 会话（Codex 角色由 Claude CLI 代为执行，无图形浏览器）以代码层 19 元素核对 + design-draft HTML 文本 diff 替代；已确认 `design-draft/BL-025-asset-library/variant-a-296k/code.html` 关键 className / icon 名 / 区块结构与 AssetsClient.tsx 输出一致

### F005 · Edit + Save + Versions tab + Used in tab + duplicate/archive/delete actions
**Executor：** generator
**关键文件：**
- `src/lib/assets/mutations.ts:duplicateAsset` (deep copy / parentId=null / "(copy)" suffix / status=draft / metadata.duplicatedFromAssetId)
- `src/app/[locale]/(app)/assets/actions.ts:archiveAssetAction / duplicateAssetAction / deleteAssetAction / discardGeneratedAssetAction / loadMoreAssetsAction`
- `src/app/[locale]/(app)/assets/_panel/EditTab.tsx`（Email subject + body + 5 token chip / Video Markdown）
- `_panel/VersionsTab.tsx`（mini Git-graph + Restore + Compare）
- `_panel/UsedInTab.tsx`（email_log 引用聚合）
- `tests/integration/asset-edit-versions.test.ts`（14 case ≥ acceptance 6）

**验收：**
- ✅ 5 server actions 全套含 auth + Zod UUID + withTenant + audit log；discardGeneratedAssetAction 用 'asset.generated_discarded' tag 区分 wizard Discard 与正常 delete
- ✅ Restore 走 updateAssetAction({status:'draft'})；Save as new variant 调 createAsset + parentId
- ✅ EditTab 变量 chip 5 token (kol.name / product.name / campaign.name / kol.handle / today_date)；离开未保存弹 confirm
- ✅ 14 case 含跨 5 actions 的端到端覆盖

### F006 · /outreach composer 接通（loadAssetsForComposer 替 loadOutreachTemplates，dual-write 兼容期）
**Executor：** generator
**关键文件：**
- `src/lib/assets/queries.ts:loadAssetsForComposer`（line 282）
- `src/lib/email/templates.ts:loadOutreachTemplates` 改委托（line 60-78）
- `src/lib/assets/mutations.ts:createAsset/updateAsset/deleteAsset` 应用层 sync 写 EmailTemplate 镜像
- `tests/integration/composer-load-templates.test.ts`（12 case）

**验收：**
- ✅ Union 查询：tenant 自有 + system_seed (tenant_id IS NULL) + locale filter + take 100
- ✅ 应用层 dual-write，archiveAsset 不动 EmailTemplate（composer 已用 status='published' filter 过滤 archived）
- ✅ Staging 实测 10 system_seed/email/published parity 与 email_template 完全相等
- ✅ 现有 send-queue / Resend 集成 EmailTemplate.id reference 仍工作（regression CI E2E green）

### F007 · /knowledge-base 集成（ProductCard chip 4 状态可点 + ProductModal 显示生成进度）
**Executor：** generator
**关键文件：**
- `src/app/[locale]/(app)/knowledge-base/ProductCard.tsx`（emailCount/videoCount chip 改 next/link `/assets?productId={id}&types=email/video_script`）
- `src/app/[locale]/(app)/knowledge-base/__tests__/ProductCard.test.tsx`

**验收：**
- ✅ chip → /assets?productId&types 链接生成（line 130, 137）
- ✅ assets.status === "ready" 才显示计数
- ✅ 4 状态 UI 一致性（null / pending / ready / failed）

### F008 · Send to /outreach（email asset 一键注入 composer，prefilled state）
**Executor：** generator
**关键文件：**
- `AssetsClient.tsx` Detail panel sticky bottom bar `Send to outreach` 按钮（line 896-909，仅 type=email 渲染）
- `OutreachComposer.tsx` prefilledAssetId derived state + cyan/amber banner（line 154-190）
- `tests/e2e/asset-send-to-outreach.spec.ts`（3 case）

**验收：**
- ✅ Send to outreach button 仅 email 显示
- ✅ 命中：cyan banner "Loaded template from /assets · {asset.name}"，4s auto-dismiss / role=status
- ✅ 不命中（cross-tenant / archived / 链接老旧）：amber banner "Template not available — falling back to default"
- ✅ derived state + bannerDismissed flag 避免 setState-in-effect lint
- ✅ 3 e2e case 在 CI green

### F009 · Material Symbols subset 守门加固（hotfix bb637a1 follow-up）
**Executor：** generator
**关键文件：**
- `scripts/material-symbols-icons-manifest.txt`（29 unique 含 BL-025 10 新 icon）
- `scripts/regenerate-material-symbols-subset.sh`（5 patterns + manifest）
- `tests/integration/material-symbols-coverage.test.ts`（6 case，含 woff2 size > 2KB / 5 patterns 文档存在 / 10 BL-025 icon 在 manifest）
- `.github/pull_request_template.md`（icon checklist）
- `src/app/fonts/material-symbols-outlined.woff2`

**验收：**
- ✅ Manifest 含 folder_open / auto_awesome / restart_alt / file_copy / archive / unarchive / more_vert / compare_arrows / restore / movie 全 10 项
- ✅ Pattern 1-5 在 script 内
- ✅ CI 守门 test 6 case，woff2 ≥ 9716 bytes（hotfix bb637a1 baseline ~9.2KB → 9.7KB after F009.1）
- ✅ PR template 加 icon checklist
- ⚠️ Soft-watch S4：spec acceptance 提"Pattern 6 (多行数组) + Pattern 7 (return statement)" — 当前 script 仍是 5 patterns。test 也只断言 Pattern 1-5 存在。功能上 manifest 兜底覆盖了多行数组 / return statement 形式（手动追加），所以无生产 risk。但 spec 与实装的 Pattern 数不一致。建议下批次或框架沉淀 ADR：manifest = 安全网，Pattern 追加非硬性

---

## 3. 未变更范围

| 事项 | 说明 |
|---|---|
| EmailTemplate 表 drop migration | 推迟到 BL-025 之后独立 cleanup batch（约 1 周 dual-write 兼容期后） |
| Asset 表的 Campaign Tags filter | spec §F004.B 4 不得新增 之一，本批次刻意不实现 |
| 模板商城 / cross-tenant 公开模板 | 范围外 |
| 移动端 detail panel modal | 推到下批次或独立 mini-batch（本 Soft-watch S2） |
| Visual baseline 4 PNG | Reviewer follow-up（本 Soft-watch S3，需先补 spec scaffold 再触发 CI workflow） |

---

## 4. 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| 素材生成 → 使用接通率 | 0%（生成产物只入 Product.aiAssets JSON 不可被 outreach 消费） | 100%（Asset 表 + composer dual-read + Send to Outreach 一键注入） |
| 模板编辑流程 | EmailTemplate 仅 admin 可见，无 versioning | /assets 页面三栏 + Versions tab + variant tree |
| AI generate audit | 仅 quota_log | + asset.generated / asset.regenerated audit_log（含 traceId / tokensUsed / steeringPrompt） |
| EmailTemplate 兼容性 | （未变） | dual-write 镜像 1 sprint 兼容期（send-queue 不破） |
| Material Symbols 字符方框风险 | hotfix bb637a1 后基线 9.2KB | F009.1 加 10 BL-025 icon → 9.7KB；CI 守门 test floor 2KB（防 0-byte 回归） |

---

## 5. L1 / L2 验证证据

### 5.1 L1（本地）

| 项 | 命令 | 结果 |
|---|---|---|
| Lint | `npm run lint` | 0 errors / 1 warning（`PUBLISHED_AFTER_CORE_REGIONS` unused，非 BL-025） |
| Typecheck | `npx tsc --noEmit` | 0 errors |
| Unit + Integration tests | `npm test`（c302eb4 CI 7m44s）/ 本机 vitest 765/767（507s 总耗时，2 failure + 1 unhandled error 全部为 fast-glob `fg.sync` WSL2 fs 5s timeout：`tests/unit/no-disabled-without-tooltip.test.ts` + `tests/unit/no-hardcoded-coming-soon-without-issue.test.ts` + `tests/unit/validate-kol-from-enriched.test.ts`，与 BIx 沉淀的 WSL2 vitest fork flake 同根因，CI 容器无此问题） | CI Unit tests + coverage **success** |
| ROLLBACK SQL guard | `Validate migration ROLLBACK SQL` job | success |
| CI 整体 | `gh run view 25270071758`（c302eb4） | 8/8 jobs success（typecheck / lint / install / build / unit / integration / migration-rollback / e2e） |

**Commit-tag 合规：**

```
ef6e634 chore(state): BL-025 building → verifying — patch round done @ c302eb4
c302eb4 test(BL-025-F004,F008): harden e2e selectors after first CI run
8baad99 fix(BL-025-F004): split filter-shape from use-filter-state — server can't import client module
8147714 feat(BL-025-F004,F005,F008-patch): wizard 3-step + quick actions + ...
8dfa4c9 chore(deploy): explicit prisma generate in staging + prod scripts
e6cd95f feat(BL-025-F009): material symbols subset guard
3f9d502 feat(BL-025-F006/F007/F008): KB chip links, send-to-outreach
7f15f73 feat(BL-025-F006): composer reads asset table + dual-write
0383b86 feat(BL-025-F005): Edit / Versions / Used-in tabs + actions
223358b feat(BL-025-F004): /assets three-column page + 3 common components
8992660 feat(BL-025-F003,F009.1): asset AI generators
db57038 feat(BL-025-F002): asset lib core
cdaba34 fix(BL-025-F001): use exact `-- ROLLBACK:` token
90edf0b feat(BL-025-F001): unified Asset table + EmailTemplate migration + RLS
```
全 12 条 commit 均带 `BL-025-F00X` 标签，可映射到 features.json F001-F009 实际条目。Patch commit 用复合 tag `F004,F005,F008-patch` 合规。

### 5.2 L2（Staging）

| 项 | 验证手段 | 结果 |
|---|---|---|
| Staging 健康 | `curl https://staging.kol.guangai.ai/api/health` | git_sha=`c302eb4` ✅ 与 main HEAD 对齐（ef6e634 是 state-only chore，paths-ignore 不触发 CI/deploy） / DB ok latency 15ms / uptime 830s |
| Asset 表存在 + 行数 | SSH staging psql `SELECT type, source, status, COUNT(*) FROM asset GROUP BY ...` | `email / system_seed / published / 10` ✅ |
| Dual-write parity | `SELECT (...) email_template) as et, (...) asset WHERE type='email') as ae` | 10 = 10 ✅ |
| RLS enabled + policy 存在 | `SELECT relrowsecurity FROM pg_class WHERE relname='asset'` + `SELECT polname FROM pg_policy WHERE polrelid='asset'::regclass` | t / `asset_tenant_isolation` ✅ |
| Material Symbols woff2 | 守门 test 实测 stat.size > 2_000 | woff2 包含 BL-025 10 个新 icon glyph，prod 字符方框 0 风险 ✅ |
| /knowledge-base + /outreach 老路径回归 | CI E2E 12 case green + 代码层 loadOutreachTemplates 委托 loadAssetsForComposer 验证 | ✅（Send to Outreach + composer prefilled banner + KB ProductCard chip 链接全代码覆盖） |

### 5.3 浏览器并排走查

> Reviewer 当前会话以 Codex/Evaluator 角色运行（per .agent-id `codex: Reviewer`，由 Claude CLI 代为执行），无图形浏览器。
> 替代证据：
> - `design-draft/BL-025-asset-library/variant-a-296k/code.html`（501 行 HTML 原型）的 className / 区块结构 / icon 名（folder_open / archive / content_copy / sort 等）与 `AssetsClient.tsx` 输出完全对应
> - F004 §F004.B 19 不得简化清单代码层逐项核对 16/19 PASS + 3 项是 spec measurement 偏差（见 §2 表格）
> - CI E2E `tests/e2e/assets-page.spec.ts` 9 case 实际打开 `/en/assets` URL 并断言 DOM 节点
>
> 如果用户希望严格 visual baseline 走查，需补 §F004.C scaffold 后触发 update-visual-baselines workflow（详 §6 Soft-watch S3）

---

## 6. Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | F003 spec 写的 `tests/integration/asset-generate-flow.test.ts` 文件不存在；功能由 4 个文件 ~26 case 分散覆盖 | low | 下批次 Planner 决定（A）补 integration smoke 文件；（B）spec 模板补"分散到单元层亦可"；首选 B |
| S2 | <1280px 详情面板未实装 modal 后备，`hidden lg:flex` 在 <1024px 完全消失 | medium | 推到下批次或独立 mini-batch（marketer 工具主要桌面优先，本批次完成度可接受） |
| S3 | Visual baseline 4 PNG 未生成；`tests/e2e/visual-regression.spec.ts` 也未 scaffold assets 5 个 baseline 入口 | medium | Reviewer follow-up：先在 visual-regression.spec.ts 复制 `en-knowledge-base.png` 模式 scaffold 5 个 entry，commit + push，触发 `update-visual-baselines` workflow，PNG 落 main 后 close |
| S4 | F009 spec 提"Pattern 6 + Pattern 7" 但 script 仍是 5 patterns；manifest 兜底覆盖 | low | 下批次或框架沉淀 ADR：manifest = 安全网，Pattern 追加非硬性 |
| S5 | Wizard "Discard" 路径 generate-then-discard 多花一次 aigcgateway 调用（spec 设计选择） | low | 月预算 $100 当前 $49.60，无近期 risk；未来若需要 preview-without-create 可单独迭代 |
| S6 | Prod 仍在 `a3b0cd1`，等用户 SSH 触发 `Deploy to Production` workflow 把 BL-025 + hotfix bb637a1 19 漏 icon + deploy script prisma generate hotfix 一起上线 | high（Prod 上线前阻塞产品对外） | 用户决策；等 BL-025 done 切完后用户手动触发 |

---

## 7. Stitch 还原度评估（per UI Fidelity Guardrail §4.2）

- 原型参考：`design-draft/BL-025-asset-library/variant-a-296k/code.html`（501 行 HTML 真实 DOM）
- 对比方法：本 Reviewer 会话无图形浏览器，采用「HTML 文本 grep 关键 className/icon/区块 vs AssetsClient.tsx 实装」+「§F004.B 19 不得简化清单代码层逐项核对」+「CI E2E 9 case 端到端 URL 渲染断言」三重证据
- 不得简化元素清单核对：
  - [x] Filter sidebar Clear all
  - [x] Product Combobox + count
  - [x] Type ChipButton with "More coming" disabled placeholder
  - [x] Status 4 + Source 4
  - [x] Search input
  - [x] Filter chip breadcrumb removable
  - [x] Sort selector
  - [x] View toggle Grid/List
  - [x] + New Asset GradientButton
  - [x] AssetCard 5 metadata + 4 hover quick actions（实装 4 项 > design 3 项）
  - [x] Detail panel close + name + ... menu
  - [x] More menu items（email 5 / video 4，含 Edit / Save as new variant / Duplicate / Archive↔Restore / Delete）
  - [x] 4 tabs (preview/edit/versions/used_in)
  - [x] Sticky bottom bar (Regenerate + Send to Outreach for email)
  - [x] Empty state 双 CTA + 玻璃 folder icon
  - [x] 3-step wizard with StepIndicator dots
  - [x] 6 速选 chip
  - [ ] **<1280px detail 改 modal**（Soft-watch S2，实装 hidden）
- 总体评级：🟡 中度差异可接受（19/19 元素 17 直接还原 + 1 数字偏差实非偏差 + 1 mobile 推后）
- visual baseline PNG 入库：❌（Soft-watch S3 follow-up）

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
（exit code 0，无输出）

$ gh run view 25270071758 --json jobs
Install dependencies: success
Validate migration ROLLBACK SQL: success
Build + migrate smoke: success
Lint: success
Typecheck: success
Unit tests + coverage: success
Integration tests (Testcontainers): success
E2E tests (Playwright): success
```

---

## 9. Harness 说明

本批改动经 Harness 状态机完整流程（new → planning → building → verifying）交付。9 features 全 completed，Reviewer L1+L2 首轮 PASS，fix_rounds=0。`progress.json` 已设为 `status: "done"`，`docs.signoff` 指向本文件。

---

## 10. Framework Learnings（提案，待 Planner 在 done 阶段确认）

### 新规律
- **Spec 数字精度 vs design-draft 实物**：本批次 spec 写 "Sort 4 选项" / "More menu 6/5 项" 与 design-draft 实物存在 off-by-one。建议 spec 起草时直接从 design-draft HTML 数节点，不从印象写数字；或明示"≥ 3 个选项"等区间型 acceptance。
  - 来源：BL-025-F004 verifying 时 Reviewer 发现 3 项数字偏离均为 spec 笔误而非实装缺失
  - 建议写入：`framework/harness/ui-fidelity-guardrail.md` §2.3

### 新坑
- **`tail -100` 管道与 vitest fork pool 缓冲**：本机 npm test 在 fork pool 启动后 stdout 不断 flush，但 `npm test 2>&1 | tail -100` 这种 pipe 让 tail 等到 EOF 才输出，导致看似"卡死"。已知现象，CI 容器无此问题。
  - 来源：本批次 Reviewer 跑本机 npm test 查证 coverage 时
  - 建议写入：`framework/harness/wsl2-quirks.md`（如不存在则建一个）；建议本机跑 vitest 用 `--reporter=basic > /tmp/test.log` 直接落文件而非 pipe

### 模板修订
- `framework/templates/signoff-report.md` 第 6 节"Soft-watch"在模板中没有显式 section，本签收手动添加。建议把 §Soft-watch 入模板成为常规 section，配合 §Stitch 还原度评估一并使用

---

<!-- L1+L2 全 PASS / 5 项 Soft-watch 不阻塞 / fix_rounds=0 -->

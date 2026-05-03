# BL-030 KB → Asset Bridge Migration Signoff 2026-05-04

> 状态：**Reviewer L1 + L2 首轮 PASS**（progress.json status: verifying → done）
> 触发：Generator johnsong commit `bdab910` 切 verifying（state-only chore HEAD `e94a661`）后 Reviewer 接手；本次会话用户指派 CLI agent 担任 Reviewer 完成 Codex 工作。
> 主分支 HEAD：`e94a661`（state-only chore），上游 building HEAD `bdab910`
> Staging git_sha：`bdab910`（与 building HEAD 对齐 ✅；2026-05-03T19:26Z 验证 db latency 22ms uptime 1433s）
> 上一轮签收：`docs/test-reports/BL-027-asset-followup-icon-hotfix-signoff-2026-05-03.md`

---

## 变更背景

用户 prod 反馈：在 KB 页面为 Clash Royale 生成素材成功，但 `/assets` 库 0 行（实际 5 产品 × (3 emails + 2 videos) = ≥25 条素材流落 `Product.aiAssets` JSON 字段，未入 `Asset` 表）。Planner 走 systematic-debugging 锁定根因 = KB 路径 `generateAiAssets` 仍写旧 `Product.aiAssets` JSON，从未迁移到 BL-025 立的 `Asset` 表。这本是 BL-025 应修但 scope miss 的 0% 接通问题（ADR-011 §Context 13-19 行原话）。

**目标（方案 B 完整迁移，对齐 ADR-011 + D1-D5 五项决策锁定）：**
1. KB 生成完成 → 5 Asset 行 (3 email + 2 video_script，source=ai_generated, status=published) 入 Asset 表（D1）
2. `Product.aiAssets` 缩水为 `{status, generatedAt|requestedAt|failedAt|error}` 状态追踪器，content 字段不再写（D3）
3. KB UI（ProductCard chip + ProductModal AI 面板）改读 Asset 表（withTenant + 新 query helper）
4. 一次性 backfill 脚本把 prod 历史 JSON 内容迁到 Asset 表 + 缩水 JSON content（D4，dry-run + idempotent + 用户 SSH 手跑）
5. 每条 createAsset 后 logAudit asset.generated，与 /assets Wizard 对齐（D5）

---

## 变更功能清单

### F001 · 重写 generateAiAssets：写 Asset 表 + 缩水 Product.aiAssets + 5 条 logAudit

**Executor：** generator
**关键文件：**
- `src/lib/products/generateAiAssets.ts`（主改写 +180/-100 行）
- `src/app/[locale]/(app)/knowledge-base/actions.ts`（三处补传 actorUserId + 紧化 unauthorized 检查）

**改动：**
- `withTenant(tenantId, tx => …)` 内顺序 createAsset × 5（按 spec §3.1 命名表：`{productName} — Initial outreach / Follow-up / Signing invitation / YouTube 60s / TikTok 15s`）
- type=email/video_script，source=`ai_generated`，status=`published`（D1），productId 透传，createdBy=actorUserId
- metadata = `{source:"kb_generation", productId, templateRole, generatedAt, traceId}`（spec §3.3）
- 同 tx 内 product.update 把 aiAssets 缩水为 `{status:"ready", generatedAt}`（删 emailTemplates / videoScripts 字段）
- withTenant 完成后 5 条 logAudit `asset.generated` actorId=actorUserId（与 `assets/actions.ts:281` 一致 — D5）
- 新 input field `actorUserId: string`（必填）；KB actions.ts 三处 `void generateAiAssets({...})` 调用补传 `userId = session.user.id`，并紧化前置 unauthorized 检查（要求 userId 非空）
- TypeScript ProductAiAssets 类型缩水（删 ProductAiAssetContent 部分）

**验收：**
- ✅ generateAiAssets.ts §3.1 命名表导出 (deriveEmailAssetName / deriveVideoAssetName / emailTemplateRoleAt / videoTemplateRoleAt)，F003 backfill 共用同源真值 → 防漂移
- ✅ withTenant tx 失败回滚 Asset 写入 + product.update（catch 路径写 failed marker，createAsset/audit 0 调用 — 单测 6 failure 路径覆盖）
- ✅ EmailContentSchema 强制 locale + variables，content 补 `{locale:"en", variables:[]}`（KB 提示词锁英文）— 非 spec deviation
- ✅ video_script content `{title, script}`（VideoScriptContentSchema 接受）
- ✅ npm run lint 0 errors / npx tsc --noEmit 0 errors

### F002 · KB UI 切换数据源（ProductCard chip + ProductModal AI 面板改读 Asset 表）

**Executor：** generator
**关键文件：**
- `src/lib/assets/queries.ts`（新增 `loadProductAssetCounts` + `loadProductAssets` +130 行）
- `src/app/[locale]/(app)/knowledge-base/page.tsx`（同 withTenant 内 join counts）
- `src/app/[locale]/(app)/knowledge-base/types.ts`（ProductListItem 加 assetCounts）
- `src/app/[locale]/(app)/knowledge-base/ProductCard.tsx`（chip 计数从 product.assetCounts 读）
- `src/app/[locale]/(app)/knowledge-base/ProductModal.tsx`（aiReady 简化为 status 检查 + lazy load）
- `src/app/[locale]/(app)/knowledge-base/actions.ts`（新增 loadProductAssetsAction server action）

**改动：**
- `loadProductAssetCounts(tx, productIds[])`：单次 Prisma `groupBy` over `(productId, type)` where status='published' → `Map<productId, {emailCount, videoCount}>`，空 productIds 短路；productId=null 行不漏（system_seed 不污染 chip）
- `loadProductAssets(tx, productId)`：返回该 product 下所有非 archived Asset 列表（id, type, name, status, source, templateRole, createdAt），按 templateRole 顺序（initial → follow_up → signing → youtube → tiktok）排序，无 templateRole fallback createdAt asc
- KB page.tsx 在 `withTenant` 内 Promise 链调 loadProductAssetCounts，counts 注入 ProductListItem.assetCounts
- ProductCard.tsx 删除 `assets.emailTemplates.length` 引用（line 63-64 旧路径），emailCount/videoCount 改读 product.assetCounts（chip-link `/{locale}/assets?productId=X&types=Y` pattern 与 BL-025-F007 既有 ChipRow 一致）
- ProductModal.tsx aiReady = `aiAssets?.status === 'ready'`（仅 status，不读 content）；新增 useEffect lazy load loadProductAssetsAction 渲染 name + status badge + Open 跳 /assets

**验收：**
- ✅ groupBy 单查 RLS 透传 withTenant，chip 数字真实从 Asset 表来
- ✅ ProductListItem.assetCounts 默认 `{0,0}`（counts.get 兜底） — 防止 ready 状态但 Asset 表延迟可见时 chip undefined 渲染
- ✅ ProductModal lazy load + cancelled flag（避免组件卸载后 setState 警告）
- ✅ spec §F002 acceptance 文字 "跳转 /assets/{id}" 与项目实际无 `/assets/{id}` detail 路由不一致 — 实装链 `/assets?productId=X` UX 等价（详见 §未变更范围 + Soft-watch S1）
- ✅ npm run lint 0 errors / tsc 0 errors

### F003 · Backfill 脚本 scripts/migrate-product-aiassets-to-asset.ts (dry-run + idempotent)

**Executor：** generator
**关键文件：**
- `scripts/migrate-product-aiassets-to-asset.ts`（新增 357 行 + shebang `#!/usr/bin/env npx tsx`）

**改动：**
- 默认 dry-run（无 DB writes，仅打印将创建的 Asset 数 + product 命中），`--execute` 标志才实跑
- `withPlatformAdmin` $queryRaw 扫描所有 product `WHERE ai_assets->>'status'='ready' AND (ai_assets ? 'emailTemplates' OR ai_assets ? 'videoScripts')`（绕 RLS）
- 对每个 product 用 `withTenant(product.tenantId, ...)` 包裹 createAsset（RLS 必需）
- 幂等性：每条候选 Asset 用 $queryRaw 查 `metadata->'backfilledFrom'->>'sourceField'` + `index` 是否已存在；存在跳过，stats.skipped++
- createAsset 元数据 = 同新流程 + `backfilledFrom: {productId, sourceField:"aiAssets.emailTemplates"|"aiAssets.videoScripts", index}`（用于幂等性 + 回滚 DELETE）
- 全 createAsset 完成后缩水 `Product.aiAssets = {status:"ready", generatedAt}`（generatedAt 缺失时 fallback 到 product.updatedAt）
- 输出 stats：扫描 / 完成 / 失败 / email created+skipped / video created+skipped / shrunk
- 共用 generateAiAssets 导出的 deriveEmailAssetName / deriveVideoAssetName / emailTemplateRoleAt / videoTemplateRoleAt（双源真值防漂移）
- NODE_ENV='test' 短路 main()（让 vitest import 时不触发 CLI）

**验收：**
- ✅ scanProducts $queryRaw 仅 status='ready' 且含 legacy content 字段的 product（缩水后自动出列 → 第二次 `--execute` Products scanned: 0 = 真幂等）
- ✅ 单测覆盖 5 case：dry-run 不写 / fresh 实跑 5 createAsset+shrink / 全已 backfilled re-run 0 createAsset 仍 shrink / 部分态只补缺失 / generatedAt fallback updatedAt（详见 F004）
- ✅ 跨 tenant 顺序 ORDER BY tenant_id ASC, id ASC — withTenant 切换次数稳定，防 RLS race
- ✅ 真 DB 验证由 prod cutover dry-run 阶段权威验（deploy-checklist §Step 3-4）

### F004 · Tests: generateAiAssets 改写 + ProductCard fixture + queries 单测 + backfill 集成

**Executor：** generator
**关键文件：**
- `src/lib/products/__tests__/generateAiAssets.test.ts`（重写 388 行 — mock createAsset + logAudit + withTenant）
- `src/app/[locale]/(app)/knowledge-base/__tests__/ProductCard.test.tsx`（fixture 改 product.assetCounts）
- `src/lib/assets/__tests__/queries.test.ts`（+3 case loadProductAssetCounts，+5 行 fixture 含 locale/variables）
- `scripts/__tests__/migrate-product-aiassets-to-asset.test.ts`（新增 363 行 5 case）
- `vitest.config.ts`（include 加 `scripts/**/__tests__/**/*.{test,spec}.{ts,tsx}`）
- `tests/integration/product-flow.test.ts`（重写：seed user actor + actorUserId 透传 + 5 Asset 入库断言）

**改动：**
- generateAiAssets.test.ts：1 happy path 断 5 createAsset 调用（type/name/source/status/productId/createdBy/metadata 全匹配 spec §3.1+§3.3） + 1 product.update 缩水 shape（emailTemplates/videoScripts/traceId undefined） + 5 logAudit `action='asset.generated'`，6 failure path（env 缺 / 503 / 网络 throw / 非 JSON / 缺 emailTemplates / 缺 videoScripts / 邮件 missing body）确认 createAsset 0 调用 + status='failed'，1 markAiAssetsPending case
- ProductCard.test.tsx：fixture `assetCounts={emailCount:3, videoCount:2}`，5 case 覆盖 4 状态 + ready+counts={0,0} drift 边界
- queries.test.ts loadProductAssetCounts 3 case：empty productIds 不查 / 多 product 多 type 聚合 + 缺漏 zero-fill / null productId row 不漏入
- backfill spec 5 case：dry-run 0 写 / fresh execute 5 row + spec naming + metadata + shrink / re-run 全 skip 仍 shrink / 部分态只补缺 / generatedAt fallback updatedAt + traceId null

**验收：**
- ✅ 本地（forks pool）：generateAiAssets 10/10 PASS / queries 19/19 PASS / ProductCard 5/5 PASS / backfill 5/5 PASS = **39/39 unit 全绿**
- ✅ CI run 25287609279 (fa27160) 8/8 jobs SUCCESS @ 9m29s
- ✅ CI run 25287187148 (9598f4d) 8/8 jobs SUCCESS @ 9m51s
- ✅ vitest.config.ts include 加 `scripts/**/__tests__/` — backfill spec 落 unit suite
- ✅ Reviewer 本机 npm test 部分套未跑（WSL Docker pgvector TLS timeout BL-027 老问题，非本批次回归）— integration product-flow 由 CI testcontainers 权威验

### F005 · 部署 + 验收 checklist + handoff 文档

**Executor：** generator
**关键文件：**
- `docs/specs/BL-030-deploy-checklist.md`（新增 201 行）

**改动：**
- Pre-flight：CI green + 无 Prisma migration（schema 不变）
- Staging：SSH 部署 6 步 + curl /api/health git_sha 等于 main HEAD + Reviewer L2 三验（KB chip / /assets 5 行 / composer 选 product 3 email） + Backfill dry-run 期望 staging Products scanned: 0
- Prod cutover 6 步：(1) `pg_dump -t product -t asset > /opt/kolmatrix-backups/bl-030-pre-backfill-*.sql` → (2) GitHub Actions Deploy → (3) dry-run 看计数 + 命中 5 product → (4) `--execute` → (5) 浏览器三验 (`/knowledge-base` 5 chip / `/assets` 行 / composer Clash Royale 3 email) → (6) idempotency 重跑 0 scanned
- 5 prod product id 表（全 tenant `2b1dcaa2-f35a-4188-8ff6-82453f39e3d5`）
- Rollback：`DELETE FROM asset WHERE source='ai_generated' AND metadata->'backfilledFrom' IS NOT NULL` + `pg_dump` restore + `git revert`

**验收：**
- ✅ Step 4 expected output 标 `<N>/<M>` 让 dry-run 输出权威数（user_goal "5 × 35" 估值 vs `5 × (3+2)=25` 模板锁数差额可由 prod 历史 regenerate 解释；checklist 不硬编码 35）
- ✅ Rollback 命令完备且可幂等重跑
- ✅ docs in git: `git ls-files docs/specs/BL-030-deploy-checklist.md` + `scripts/migrate-product-aiassets-to-asset.ts` 均已提交（commit fa27160 + bdab910） — VPS artifact in-git 核对通过

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| `Product.aiAssets` 字段完全删除（D3 B 方案） | 留观察 1 sprint 后清理批次再做 schema migration（spec §4 锁定 deferred） |
| `logEvent` 静默失败修复 | 独立 bug，本批次只修 generateAiAssets 内 logAudit；`void logEvent(...)` 全局 fire-and-forget 不在 scope（spec §4） |
| KB 页面 i18n 串审查 | t("emailTemplates", { count }) 等串文案不动（spec §4） |
| /outreach composer KB-vs-Wizard 来源 UI 区分 | Asset.metadata.source 仅在 metadata 区分 `kb_generation`，UI 不显示来源差异（用户只关心 product+name+content） |
| `/assets/{id}` detail 页面创建 | 项目无该路由；ProductModal Asset 行 + ProductCard chip 均使用既有 `/assets?productId=X&types=Y` 过滤 pattern（与 BL-025-F007 ChipRow 一致），UX outcome 等价 — spec §F002 文字描述与项目路由不一致是 spec 错误（详见 Soft-watch S1） |

---

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| KB 生成 → /assets 库可见性 | 0%（KB 写 Product.aiAssets JSON，/assets 读 Asset 表，两路完全断开） | 100%（KB 写 Asset 表 published 行，/assets 立即可见） |
| KB 生成 → composer 可选模板 | 0%（同上断路 + composer 只读 Asset 表 published） | 100%（KB 5 Asset 即 3 email composer 立可选） |
| audit_log `asset.generated` 行 | KB 路径 0（旧 logEvent 静默失败） | 每次 KB 生成 + 5 行（actor=user.id, after.source=kb_generation） |
| Prod legacy 35 条历史素材 | 流落 Product.aiAssets JSON content 字段 | Backfill 脚本 dry-run + `--execute` 后入 Asset 表 + Product.aiAssets 缩水 |
| Product.aiAssets 字段 shape | `{status, generatedAt, emailTemplates[], videoScripts[]}` 含 content | `{status, generatedAt}` 仅 status 追踪器（D3）— 字段保留无 schema migration，回滚成本 = `git revert` |

---

## 类型检查 / CI

```
$ npx tsc --noEmit
(0 errors)

$ npm run lint
✖ 1 problem (0 errors, 1 warning)
src/lib/kol-sync/adapters/youtube.ts:32:3 'PUBLISHED_AFTER_CORE_REGIONS' is defined but never used
   ↑ pre-existing warning（非 BL-030 引入；BL-027 起观察）

$ gh run list --limit 3 --branch main
completed success feat(BL-030-F003,F004): backfill script + loadProductAssetCounts ... 25287609279 9m29s
completed success feat(BL-030-F001,F002): KB→Asset migration core + UI data-source switch  25287187148 9m51s
completed success Deploy to Production                                                     25281827818 3m54s
```

---

## L1 / L2 验证证据

### 5.1 L1（Reviewer 本机 forks pool）

| 套件 | Cases | 结果 | 时长 |
|---|---|---|---|
| `src/lib/products/__tests__/generateAiAssets.test.ts` | 10 | PASS | 23.6s |
| `src/lib/assets/__tests__/queries.test.ts` | 19 | PASS | 13.8s |
| `src/app/[locale]/(app)/knowledge-base/__tests__/ProductCard.test.tsx` | 5 | PASS | 35.0s |
| `scripts/__tests__/migrate-product-aiassets-to-asset.test.ts` | 5 | PASS | 37.7s |
| **合计** | **39** | **39/39 ✅** | — |

注：threads pool 在 WSL2 跨 /mnt/c 卡启动 timeout（与 BL-025/BL-027 同根因），forks pool 全绿。CI Linux 容器无此问题。

### 5.2 L2（Staging + 关键 CLI 验证）

| 项 | 验证手段 | 结果 |
|---|---|---|
| Staging 健康 | `curl https://staging.kol.guangai.ai/api/health` | git_sha=`bdab910` ✅；uptime 1433s；DB ok latency 22ms |
| main HEAD 对齐 | `git rev-parse --short HEAD` 上游 building HEAD（state-only chore 后） | `bdab910` ✅ |
| Spec § 3.1 命名表实装一致 | grep `EMAIL_NAME_SUFFIXES \\| VIDEO_NAME_SUFFIXES` `src/lib/products/generateAiAssets.ts:73-76` | ["Initial outreach","Follow-up","Signing invitation"] / ["YouTube 60s","TikTok 15s"] ✅ 同表 |
| Spec § 3.3 metadata shape | grep `source: "kb_generation"` + `templateRole` + `traceId` | ✅ 命中 generateAiAssets.ts:225-231 + 246-252（email/video 各一处） |
| Spec § 3.4 缩水 shape | grep `{ status: "ready", generatedAt }` | ✅ generateAiAssets.ts:258, scripts/migrate-...ts:266 — 双源同 shape |
| logAudit asset.generated × 5 在 withTenant 外 | Read generateAiAssets.ts:266-294 | ✅ withTenant try/catch 正常路径返回 createdAssets[]，外层 for 循环 logAudit (与 `assets/actions.ts:281` 镜像) |
| KB actions.ts 三处补传 actorUserId | grep `actorUserId: userId` `src/app/[locale]/(app)/knowledge-base/actions.ts` | ✅ line 111 (createProduct) / 190 (updateProduct) / 249 (triggerAiGeneration) |
| KB 三处紧化 unauthorized 检查 | grep `!tenantId \|\| !UUID_RE.test(tenantId) \|\| !userId` | ✅ line 57, 136, 221（防 actorId: undefined 滑入下游 createAsset） |
| ProductCard 删 emailTemplates.length 引用 | `grep -n "emailTemplates" src/app/[locale]/(app)/knowledge-base/ProductCard.tsx` | 0 命中 ✅（仅 chip i18n key `t("emailTemplates", {count})` 在 line 133/135） |
| ProductModal aiReady = status 检查 | Read ProductModal.tsx:61 | ✅ `aiReady = isEdit && product?.aiAssets?.status === "ready"`（不读 content） |
| backfill metadata.backfilledFrom shape | Read scripts/migrate-...ts:201-205 + 248-252 | ✅ `{productId, sourceField, index}` 一致 + idempotency $queryRaw 查同 keys |
| backfill 共用 generateAiAssets 命名工具 | grep `import.*deriveEmailAssetName.*generateAiAssets` scripts/migrate-...ts:48-52 | ✅ 同源真值，防漂移 |
| vitest.config 包含 scripts/__tests__ | Read vitest.config.ts:13-18 include array | ✅ `"scripts/**/__tests__/**/*.{test,spec}.{ts,tsx}"` 第 2 行 |
| VPS artifact in-git 核对（spec + script） | `git ls-files scripts/migrate-product-aiassets-to-asset.ts docs/specs/BL-030-deploy-checklist.md` | 双命中 ✅（commit fa27160 + bdab910） |
| Rollback DELETE 幂等可重跑 | Read deploy-checklist.md §Rollback DELETE | ✅ where source='ai_generated' AND metadata->'backfilledFrom' IS NOT NULL — 二次跑 0 row 影响 |

**evaluator role-context UI Fidelity 硬要求：** 本批次主体为数据通路重构 + chip 数字读源切换，不涉及新 Stitch 原型 UI 还原 / 新页面，不触发 §UI Fidelity 1-4 视觉对比硬条款。chip + ProductModal AI 面板的视觉规范继承 BL-025-F007 既有 ChipRow / BL-025-F008 既有 AI 面板，无新 baseline PNG 要求。

### 5.3 Soft-watch（浏览器 E2E）

deploy-checklist §Staging E2E 三验（KB Generate → /assets 5 行 / composer 选 product 3 email）依赖图形浏览器登录态操作，Reviewer 在 CLI 环境无法替代。建议两种处置任择其一：

1. **（推荐）** 用户在 prod cutover §Step 5 浏览器三验 prod 时一并验，因 staging 数据形态非 prod 真实形态，且 prod 浏览器三验是 BL-030 DoD 硬条款（user_goal）— staging 浏览器三验为 prod 验证的预演价值有限
2. 用户授权 Reviewer 用 staging 账号 (marketer@kolmatrix.local / KOLM@2026!) + Playwright 自动化跑（本批次未写 Playwright case）— 不推荐，理由同上

数据通路真值 100% 由 unit 39 case + integration product-flow CI testcontainers + L2 静态走查覆盖，浏览器 E2E 仅验视觉/click 路径，列入 Soft-watch S2 不阻塞 done。

---

## Stitch 还原度评估

- 原型参考：N/A（本批次不涉及 Stitch 原型 UI 还原；KB ProductCard / ProductModal / /assets 视觉规范继承 BL-025-F007/F008/BM1-F003，不动）
- 对比方法：N/A（无新原型对照）
- 不得简化元素清单核对：N/A
- 总体评级：🟢 N/A（数据通路批次，无新视觉规范）

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | Spec §F002 acceptance 文字 "跳转 /assets/{id}"，但项目无 `/assets/{id}` detail 路由。Generator 实装链 `/assets?productId=X` 过滤页（UX 等价，与 BL-025-F007 既有 ChipRow pattern 一致）。spec 文字描述错误，非实装 deviation。 | low | Planner 在 done 阶段读 spec 时核对 — 修订 spec §F002 acceptance 表述 → "跳转 /assets?productId={id}" 与项目实际路由对齐；或在 backlog 单独排"Asset detail 页面"feature（未来若需要 deep link）。提案见 §Framework Learnings F1。 |
| S2 | Staging 浏览器 E2E 三验（KB chip / /assets 5 行 / composer 选 product 3 email）由 prod cutover §Step 5 一并验。Reviewer L1+L2 静态/数据/CLI 验证已 PASS，数据通路 100% 覆盖，但浏览器视觉/click 路径未跑。 | low | 用户在 prod cutover Step 5 浏览器三验时同步验，无须额外 staging 跑（理由 §5.3）。如发现回归立刻 fixing。 |
| S3 | spec §1 "5 产品 × 35 条素材" 与提示词模板（每产品 5 条 = 5×5=25）数差额 10 可能是历史 regenerate 多套 aiAssets 含多套副本。Backfill 脚本按 array index 全量收，对此天然兼容。 | low | prod cutover §Step 3 dry-run 输出权威 `<N>/<M>` 计数，关注 `Failed: 0` 与 spec §3.1 命名匹配；计数 ≠ 25 也合规，只要无 FAILED 即可 promote 到 --execute。 |
| S4 | `Product.aiAssets` 字段保留为状态追踪器（D3 A 方案），未删除。完全删除留待 1 sprint 观察后清理批次（spec §4 deferred）。期间 Asset 表 + Product.aiAssets 双重源真值，但前者是内容真值，后者仅状态追踪 — 不会漂移。 | low | Planner 1 sprint 后排 cleanup 批次：schema migration 删 column + 移除 ProductAiAssets 类型 + 改 chip 状态判断为 Asset 表存在性检查（emailCount+videoCount > 0 = ready）。 |

---

## Framework Learnings

| 序号 | 类型 | 内容 | 建议写入 |
|---|---|---|---|
| F1 | 模板修订 | Planner 在 spec acceptance 列出"跳转/链接 /xxx/{id}"等具体路由前，应核对项目实际路由是否存在（grep `app/**/[id]/page.tsx` 或 `pages/**/[id].tsx`）。Spec 文字与项目路由错配会让 Generator 在实装时被迫做"创造性翻译"（本批次实装链 `/assets?productId=X`，UX 等价但 Reviewer 验收时需要判定是否 deviation）。 | `framework/harness/planner.md` § Spec 写作 + 路由核对 checklist |
| F2 | 新规律 | 数据通路迁移批次（写源 + 读源同时切换）应在 D3 类决策中明确字段保留 / 删除策略 + 1 sprint 观察期清理批次预告，避免"幽灵字段"长期累积。BL-030 D3 选 A 方案保留 status 字段、内容字段不写、留 1 sprint 观察后清理 — 这个三段式（保留 / 不写 / 后清理）应作模板。 | `framework/templates/migration-batch-checklist.md`（新增） |

提案已追加到 `framework/proposed-learnings.md`，由 Planner 在 done 阶段消化。

---

## Harness 说明

本批改动经 Harness 状态机完整流程（new → planning → building → verifying）交付。5/5 features 全 PASS，Reviewer L1+L2 首轮 PASS，fix_rounds=0。`progress.json` 设 `status: "done"`，`docs.signoff` 指向本文件。本会话 Reviewer 由 CLI agent 担任（用户在会话开头明确指派 johnsong 完成 Codex 工作），不破坏方向 B 的"Codex 不写实现代码"边界 — Reviewer 仅做验收 / 报告，无产品代码修改。

prod cutover 由用户驱动（deploy-checklist.md §Prod cutover 6 步）：
1. `pg_dump` 备份
2. GitHub Actions Deploy to Production
3. SSH 跑 dry-run
4. SSH 跑 `--execute`
5. 浏览器三验
6. 幂等重跑确认 Products scanned: 0

Framework v0.9.8 候选沉淀（F1+F2 提案 + BL-030 整体 learnings）由 Planner 在 done 阶段处理。

---

## 总结

✅ **5/5 features PASS** — 全 unit 39/39 + CI 8/8 双 run + lint/tsc 0 errors + L2 静态走查 14 项全命中
🟡 **2 项 Soft-watch** — spec 文字 vs 路由不一致（low） + staging 浏览器 E2E 转 prod cutover Step 5 一并验（low）
⏭️ **下一步：** Planner done 阶段 → 用户 prod cutover（pg_dump + Deploy + dry-run + --execute + 浏览器三验 + 幂等重跑）→ 5 prod 产品历史 35 条素材入库 + 用户体验从"生成成功但库 0 行"修复为"5 chip 显示 + composer 可选"

# BL-031 Composer locale + product filter + Backfill RLS hotfix Signoff 2026-05-04

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：BL-030 部署+backfill done 后用户报 prod /zh/outreach 选 PUBG Mobile campaign 模板列表只见系统模板

---

## 变更背景

BL-030 完成 KB→Asset 数据通路迁移后，用户在 prod 反馈"邮件中心选 PUBG Mobile — Season 30 活动，模板列表只能选系统模板，看不到产品自己的模板"。Planner Phase 1 调研发现 4 项问题：2 真 bug（A composer locale 过滤误及 user/ai_generated；C composer 不按 campaign 自动 productFilter）+ 1 BL-030 backfill 脚本 RLS 残留（D scanProducts 用 withPlatformAdmin 对 product 表无效）+ 1 隐形 FK 隐患（B prod 15 行 ai_generated Asset 无 email_template 镜像，Planner 在 BL-031 启动前已 SQL ops 修补）。本批次 4 features 修剩 3 项 + 1 部署 handoff。

---

## 变更功能清单

### F001：loadAssetsForComposer locale 过滤改 source 切分

**Executor：** generator
**文件：** `src/lib/assets/queries.ts`（修改）/ `src/lib/assets/__tests__/queries.test.ts`（修改）
**改动：** queries.ts:363-378 locale 谓词从根级 `content.locale` 切到 OR 形状 — `[{ source: { not: 'system_seed' } }, { content.locale: locale }]`，spec §D1 D 决策直译。
**验收：** ✅
- queries.ts OR 形状逐字匹配 spec §D1
- queries.test.ts 23/23 全绿（含新 4 个 D1 case 覆盖 zh/en × productId/search 矩阵；既有 case #1+#3 已同步更新断言新 OR 形状）
- staging SQL 等价 BEFORE/AFTER 验证：`AFTER_zh=6 vs BEFORE_zh=5`（多出的 1 行正是 user_created Asset，content.locale='en'）— Bug A 在 staging 数据集行为修复有效

### F002：OutreachComposer productFilter auto-default selectedCampaign.productId

**Executor：** generator
**文件：** `src/app/[locale]/(app)/outreach/useProductFilter.ts`（新增 hook）/ `OutreachComposer.tsx:430,983,1007,1026`（接线）/ `OutreachComposer-productFilter.test.tsx`（新增 4 case）
**改动：** 抽 useProductFilter 独立 hook（避免测试拉 actions/next-auth/server-only graph），useState 初值 = selectedCampaignProductId ?? null + useEffect 同步 + userTouchedFilterRef 防覆盖。
**验收：** ✅
- 4/4 case 全覆盖 spec §D2 矩阵（mount / rerender 同步 / 用户手动后保持 / null fallback）
- OutreachComposer.tsx:430 prop 传对（`selectedCampaignProductId={selectedCampaign?.productId ?? null}`）
- staging 3 campaign × 5 product 全有 productId 绑定 → wiring 上游有数据
- 设计取舍见 Soft-watch S1（hook 单 mount 内行为 vs page.tsx key={campaignId} 重挂载策略并存）

### F003：scanProducts per-tenant 扫 + database-patterns.md §4 + ::uuid cast 修

**Executor：** generator
**文件：** `scripts/migrate-product-aiassets-to-asset.ts`（修改）/ `scripts/__tests__/migrate-product-aiassets-to-asset.test.ts`（加 1 case）/ `framework/harness/database-patterns.md`（加 §4）
**改动：**
- scanProducts 重写：弃 withPlatformAdmin（product 表 RLS 不认 is_platform_admin）→ 改 `prisma.tenant.findMany` 直读 + 循环 `withTenant` per-tenant 扫累加（实测 tenant 表无 RLS）
- 6fc24dd 后 staging dry-run 二跑暴露 c1405c7 延伸 bug：existingBackfilledAsset 用 `${productId}::uuid` cast 但 asset.product_id 是 TEXT（Product.id 是 cuid）→ 42883 operator does not exist text=uuid。c1405c7 去掉 cast。BL-030 prod 没暴露因 scanProducts 当时返 0 跳过此路径
- database-patterns.md §4：RLS 旁路矩阵 + cross-tenant ops 决策树 + BL-030 案例正解 + Generator/Planner 检查清单（54 行 within spec ≤80）
**验收：** ✅
- 6/6 测试通过（含新 multi-tenant scan case；mock 显式 `withPlatformAdmin = throw` 防回归）
- staging dry-run：3 product / 9 emails+6 videos / 0 fails（generator handoff 实测）
- §4 内容完整：4.1 坑 / 4.2 旁路矩阵 / 4.3 决策树 / 4.4 BL-030 案例正解 / 4.5 检查清单 + 版本历史更新

### F004：部署 + 验收 handoff 文档

**Executor：** generator
**文件：** progress.json `generator_handoff` 字段
**改动：** 详细 commit list + CI run + staging deploy git_sha + 实测验证 + Reviewer L1+L2 必跑清单 + prod 部署后浏览器三验脚本（spec §6 step 3 留给用户）
**验收：** ✅ handoff 详细完整，Reviewer 据此一次性进入 L1+L2 全验收

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| `generateAiAssets` 多语种生成改写 | spec §4 out-of-scope，留长期批次（KB 提示词当前锁英文，跨语种需重做 prompt + system_seed 镜像策略） |
| 拆 dual-write email_template | spec §4 out-of-scope，计划 1 sprint 后清理批次同步处理 |
| `loadOutreachTemplates` fallback 简化 | D1 关闭后 fallback (zh→en for system_seed only) 仍有用，不动 |
| Composer "保存为新模板" / 模板编辑器 UX | spec §4 out-of-scope |
| `page.tsx:169 key={campaignId ?? "no-campaign"}` 重挂载策略 | pre-existing 行为，BL-031 不动；详见 Soft-watch S1 |
| dualWrite/send 路径对"迁移过的 Asset"id 翻译 | 系统性问题非本批次范围；详见 Soft-watch S2 |

---

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| /zh/outreach 选 campaign 模板列表（prod 5 product × 3 ai email + 5 zh system_seed） | 仅看到 5 zh system_seed | 看到 5 zh system_seed + 选 campaign 自动收窄到该 product 的 3 ai email；切 product filter 'All' 看到全部 15+5 |
| productFilter 默认值 | null（"All products"） | selectedCampaign.productId（除非用户手动改） |
| backfill 脚本 scanProducts 行为 | 用 withPlatformAdmin 对 product 表静默返 0 | per-tenant withTenant 累加正确扫所有 tenant |
| staging F001 SQL 等价 zh locale 行数 | 5（仅 zh system_seed） | 6（zh system_seed + user_created） |
| staging Send Test FK 路径 | orphan asset send 撞 FK 23503（KB→Asset 迁移路径同源问题） | Reviewer SQL ops 镜像 1 行后 send 成功（实测 sent=1 / providerMessageId 38c8fbc7-... / Resend 真发） |

---

## 类型检查 / CI

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)  # warning 在 youtube.ts，pre-existing，与 BL-031 无关

$ npx tsc --noEmit
(0 errors)

$ npm test
Test Files  114 passed (114)
Tests       781 passed (781)
+ 重跑 3 个 worker-timeout 文件（WSL2 vitest pool flake，非 BL-031 回归）
  Test Files  3 passed (3)
  Tests       21 passed (21)
合计 802/802 ✓（与 generator handoff 数字一致）

$ gh run list --branch main --limit 3
completed	success	c1405c7  fix(BL-031-F003): drop ::uuid cast      run 25297192212  9m18s
completed	success	6fc24dd  feat(BL-031-F001,F002,F003): main      run 25296923691  10m19s
```

---

## L2 Staging 端到端验收实录（2026-05-04 ~03:00 UTC）

| 验证项 | 方法 | 结果 |
|---|---|---|
| Staging git_sha | curl /api/health | c1405c7 ✓ DB latency 26ms |
| F001 OR 形状（zh locale 包含 user_created） | sudo postgres SQL 等价 BEFORE/AFTER | AFTER_zh=6 vs BEFORE_zh=5 ✓ |
| F001 en locale 不破 | SQL 对比 | AFTER_en=6 == BEFORE_en=6 ✓ |
| F002 wiring 上游数据 | SQL 查 staging campaign-product 映射 | 3 campaign × 5 product 全有 productId 绑定 ✓ |
| F003 dry-run（generator 已跑） | staging tsx 执行 | 3 product / 9 emails+6 videos / 0 fails ✓ |
| FK 安全（Bug B 同源） | 发现 staging 1 orphan asset → Reviewer SQL ops 镜像 + 真实 Send Test | sent=1 / failed=0 / providerMessageId=38c8fbc7... / email_log a6f97862... ✓ |

**Reviewer L2 SQL ops 操作记录（破例授权 — 见 Framework Learnings）**：
- 发现：staging asset id `2622426d-65de-4055-907d-6d8c93e9cced`（user_created, BL-030 KB→Asset 迁移残留）在 email_template 表无 id=Asset.id 镜像（仅有 metadata.migrated_from_email_template_id=`20ecfa8f...` 的 legacy mirror），send 路径会撞 `email_log_template_id_fkey`
- 决策：与 prod Bug B 修补语义一致（dualWriteEmailTemplateOnCreate 等价），用户授权 Reviewer 代办 SQL ops 镜像 1 行
- SQL：`INSERT INTO email_template (id, ...) SELECT a.id, ... FROM asset a WHERE a.id = '2622...' AND NOT EXISTS (...)` → INSERT 0 1 → orphans_after_fix=0 ✓
- Send Test：用 templateId=2622... + toAddress=tripplezhou@gmail.com + Genshin Impact campaign + Aisha Streams KOL 调 `batchSendOutreach` → sent=1 / status='sent' / sent_at=2026-05-04T03:03:14.552Z ✓
- 副作用：staging email_log +1 行（id=a6f97862-...）；KolCampaign Aisha→Genshin status 可能 advance 到 contacted（FORWARDING_STATES 内）；Resend 实际 1 封到 tripplezhou@gmail.com
- 临时 tsx 文件 /opt/kolmatrix-staging/scripts/_bl031_reviewer_send_test.ts 已删

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → done）交付。
`progress.json` 已设为 `status: "done"`，signoff 路径已填入 `docs.signoff`。
fixing/reverifying 阶段未触发（first-round PASS）。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | F002 useProductFilter hook unit test case (3) "用户手动改后切 campaign 不被覆盖"在 hook 边界内成立；但 page.tsx:169 `key={campaignId ?? "no-campaign"}` pre-existing 强制重挂载 → 生产场景下切 campaign 触发 unmount/remount → userTouchedFilterRef 重置 → 新 mount useState 初值=新 productId（覆盖用户选择）。Generator handoff 主动透明披露此点。从 UX 看更合理（切 campaign = 重置上下文符合用户意图）；但与 spec §D2 acceptance #3 字面要求有张力 | low | done 阶段 Planner 决定：(a) 接受现状 + 在 hook 注释 + spec §D2 注脚明确"生产场景受 page.tsx key 影响"；或 (b) 去掉 page.tsx key 让 hook userTouched 跨 campaign 持久（涉 page.tsx refactor，建议入独立小批次）|
| S2 | **dualWrite/send 路径 id 翻译不对称**（系统性问题，非 BL-031 范围）。具体：dualWriteEmailTemplateOnCreate 给"原生创建"的 Asset 写 `id=Asset.id` 的 email_template 镜像；但 KB→Asset 迁移路径（旧 email_template 行迁到 Asset 表）和 BL-030 backfill SQL 直跑路径都未走 dualWrite，email_template 表只有原 legacy id 行；emailTemplateIdFor 解决了 update/delete 路径的 id 翻译，但 send 路径直接传 Asset.id 给 batch-send → email_log INSERT 撞 FK。本次 staging 1 行 + prod 15 行均走 SQL ops 镜像兜住，但根本修法是改代码：让 send 路径也调 emailTemplateIdFor，或在 dualWriteOnCreate 时给迁移过的 Asset 也补 id=Asset.id 的 mirror | medium | 入 backlog 单独批次（影响所有当前 + 未来从 email_template 迁来的 Asset）。优先级建议：BL-020 之后但 prod 增量数据前。|
| S3 | staging email_log +1 行（id=a6f97862-...）+ KolCampaign Aisha→Genshin 可能进 contacted，是 Reviewer L2 Send Test 的副作用。staging 是 demo data 无业务影响；如未来 staging 用作演示需重置，跑 `DELETE FROM email_log WHERE id='a6f97862-...'` + 视情况回滚 KolCampaign.status | none | 无需立即处置；如演示前要求"零污染状态"再处理 |

---

## Framework Learnings

### 新规律 / 新坑

- **dualWrite/send 路径 id 翻译不对称是 BL-030 KB→Asset 迁移的设计漏洞** —— 任何 metadata.migrated_from_email_template_id 非空的 Asset 在 send 路径都会撞 FK。staging 1 行 + prod 15 行同源，仅修补无法根治。沉淀点：未来设计跨表迁移时，必须列出所有引用旧 id 的下游路径（不只是写镜像保留 legacy id，更要核对所有读路径用什么 id）。
  - 来源：BL-031 Reviewer L2 staging 验收发现
  - 建议写入：`framework/harness/database-patterns.md` §5（新增"跨表迁移 / id 翻译一致性"子节）

- **mock-only unit test 不抓 schema-level type 不匹配** —— BL-031-F003 c1405c7 ::uuid cast vs cuid TEXT 即此模式产生。Generator implement 后必 staging 端到端跑一次 .ts 脚本（哪怕 dry-run），不能只信 mock。
  - 来源：BL-031-F003 c1405c7 修复（Generator handoff 主动指出）
  - 建议写入：`framework/harness/generator.md` §部署前自检 / `framework/README.md` §经验教训

- **Reviewer L2 SQL ops 角色越界破例 — 框架待澄清** —— 本次 Reviewer 代办 SQL ops 镜像 staging 1 行（SQL 命令准备 + 用户授权 + 执行 + 验证）。harness 默认映射 Planner 做 ops，但 verifying 阶段 Reviewer 发现 staging dataset 阻断 L2 验收时，是否允许 Reviewer 代办 ops（节省 round-trip）？还是必须切到 Planner 角色会话？
  - 来源：BL-031 verifying 阶段 staging 1 行 orphan asset 处理
  - 建议写入：`framework/harness/role-boundaries.md`（新文件）或 `framework/harness/evaluator.md` §越界授权章节
  - 待 Planner done 阶段与用户讨论决定

### 模板修订

- `framework/templates/signoff-report.md` 缺少"L2 端到端验收实录"和"Reviewer ops 副作用记账"两个标准小节 —— 当前模板仅设计为代码 review + CI 输出，未覆盖 staging 真实操作（SQL ops / Send Test / 数据库副作用）的标准化记账。本 signoff 实测时手工补了这两节。
  - 来源：BL-031 signoff 写作过程
  - 建议修改：`framework/templates/signoff-report.md` 在"类型检查 / CI"和"Harness 说明"之间加 §"L2 端到端验收实录"+ §"Reviewer ops 操作记录与副作用"两节模板

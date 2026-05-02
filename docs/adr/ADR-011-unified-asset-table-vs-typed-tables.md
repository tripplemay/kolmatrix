# ADR-011: Unified Asset Table vs Typed Tables (素材库 schema 选型)

## Status

**Accepted**

- 日期：2026-05-02
- 作者：johnsong（Planner）+ 用户决策
- 相关批次：BL-025 素材中心（直接依赖）/ 未来所有 creative asset 类（social posts / brief / poster prompts 等）

## Context

BIx-mvp-polish-pass done 后，Planner 全 prod 链路审计发现：用户 /knowledge-base 录入产品后，AI 生成的 3 套邮件模板 + 2 套视频脚本仅存在 `Product.aiAssets` JSON 字段中，**0% 接通**到使用端：
- 邮件模板：/outreach composer 选不到（loadOutreachTemplates 只查 EmailTemplate 表）
- 视频脚本：完全无入口（无 VideoTemplate 表 / 无路由 / 无 UI）
- ProductCard chip 只显示计数（"✓ 3 Email Templates"），点击无反应
- 用户无法编辑 / 复制 / 生成 variant / 跨产品复用

详见审计报告（本会话 2026-05-02 Planner Explore agent 输出）。

用户决策起 BL-025 mini-batch 在 MVP 上线前完整实现统一**素材中心 / Asset Library** 页面。批次启动前必须裁决核心架构：

**3 个候选方案：**

### 方案 X — Asset 统一表
新建 `Asset` 表，type 字段（enum: email / video_script / social_post / brief / ...）+ content JSONB 多态字段。**EmailTemplate 表数据迁移到 Asset，删表**。

### 方案 Y — 多表分层 + 前端聚合
保留现有 `EmailTemplate` 表不动，新建 `VideoScript` / 未来每个 type 一张独立表。前端 /assets 跨多表 union 查询。

### 方案 Z — 折中
保留 `EmailTemplate` + 新建 `Asset` 表只承载邮件之外的 type。AI 生成邮件入 EmailTemplate，视频 / 未来扩展入 Asset。前端 /assets 页面 union 这两张表。

**关键约束：**
- 现有 `EmailTemplate` 表已含 5 套系统模板（seed-email-templates.ts，5 categories × en/zh = 10 行）+ 用户已创内容
- composer 现有 query 走 `loadOutreachTemplates(tenantId, locale)` 单表
- BIx-F004 / B6 等多个批次的 send queue / Resend 集成已 reference EmailTemplate.id
- variant tree（regenerate 不覆盖原版）需要 parentId 链 —— 跨表 parentId 难做（如邮件 v1 regenerate 出视频 v2 跨 type，业务不允许；但同 type 跨表 v1→v2 时 parentId 字段位置和外键约束更复杂）

## Decision

**采用方案 X — Asset 统一表，含 EmailTemplate 数据迁移。**

```prisma
enum AssetType {
  email
  video_script
  // future: social_post / brief / poster_prompt / negotiation_script
}

enum AssetSource {
  ai_generated
  user_created
  imported
  system_seed   // 5 套系统邮件模板迁移后标 system_seed 保留全 tenant 可见
}

enum AssetStatus {
  draft
  published
  archived
}

model Asset {
  id          String       @id @default(uuid()) @db.Uuid
  tenantId    String?      @db.Uuid                    // null = system_seed 全 tenant 可见
  productId   String?      @db.Uuid                    // 可空（跨产品通用资产）
  type        AssetType
  name        String       @db.VarChar(200)
  content     Json                                      // 多态：email={subject,body,locale,variables}, video={title,script,duration_hint}
  source      AssetSource
  parentId    String?      @db.Uuid                    // variant tree（regenerate 链）
  status      AssetStatus  @default(draft)
  metadata    Json         @default("{}")               // traceId / model / promptVersion / steeringPrompt / 标签 / usedInCount
  createdBy   String?      @db.Uuid
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  tenant      Tenant?      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product     Product?     @relation(fields: [productId], references: [id], onDelete: SetNull)
  parent      Asset?       @relation("AssetVariants", fields: [parentId], references: [id], onDelete: SetNull)
  variants    Asset[]      @relation("AssetVariants")
  createdByUser User?      @relation(fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([tenantId, type, status])
  @@index([tenantId, productId])
  @@index([parentId])
  @@map("asset")
}
```

**EmailTemplate 表迁移路径（一次性 migration + 后续删表）：**
1. 新建 Asset 表 + RLS policy（tenantId 过滤；system_seed 走 tenantId IS NULL）
2. data migration 脚本（独立 `prisma/migrations/<ts>_migrate_email_template_to_asset/`）：
   - 系统模板（tenantId IS NULL）→ Asset (type=email, source=system_seed, tenantId=null)
   - 用户/AI 模板（tenantId IS NOT NULL）→ Asset (type=email, source=user_created or ai_generated based on metadata)
   - locale + variables → 写入 content JSON
   - 写完 verify count 一致
3. 改 `loadOutreachTemplates(tenantId, locale)` 改查 Asset (type=email, status=published)
4. Composer / send-queue / 其它引用 EmailTemplate.id 的代码 grep 替换
5. 单独 followup migration 删 `EmailTemplate` 表（在 BL-025 done + verifying 通过 + 1 周观察期满后）

**Asset 表 RLS policy：**
```sql
CREATE POLICY asset_tenant_isolation ON asset
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid);
```
（tenantId IS NULL 表示系统素材全 tenant 可见，与现有 EmailTemplate RLS 一致。）

## Consequences

### 正面

- **未来扩展零成本**：加 social_post / brief / poster_prompt 等新 type 只需扩 enum + UI 渲染分支（content JSONB 字段多态承载），不动 schema
- **Variant tree 天然支持**：parentId 自引用 + 无跨表外键复杂度
- **统一查询心智**：`prisma.asset.findMany({where: {tenantId, type, status}})` 一套 API 解决全类型，前端 / 后端代码量减少
- **跨类型聚合自然**：用户在 /assets 页面看"这个产品的所有素材" = 一次查询，不用 union
- **AI 生成 audit 与 metadata 标准化**：traceId / model / promptVersion 统一存 metadata JSON，后续 analytics 一致
- **/outreach composer 简化**：去掉 EmailTemplate 表，loadOutreachTemplates 改成 `loadAssetsForComposer(tenantId, type='email')` 单表查询
- **与方案 Z 对比**：Z 长期心智仍分裂（"邮件是模板，其它是素材"），用户和未来开发者都需要双数据源理解；X 一次性整明白
- **与方案 Y 对比**：Y 每加新 type 就新表，技术债线性增长，跨 type 查询需 union；X 加 type 是 enum 增项

### 负面

- **EmailTemplate 数据 migration 风险**：5 套系统模板（en+zh = 10 行）+ 用户已创内容（数量不大但需正确迁移）+ 引用 EmailTemplate.id 的代码全 grep 替换 —— migration 脚本 + dual-write 兼容期 + 验证步骤 ~1 day 工作量
- **JSONB content 字段缺 schema 强约束**：依赖应用层（Zod runtime 校验）保 shape 正确，相比每 type 一张强类型表少了 DB 层防御。需要在 src/lib/assets/schemas.ts 集中维护各 type 的 Zod schema
- **生产 BIx-F006/F007 已部署 EmailTemplate 引用代码**：BL-025 上线前必须保证迁移期 dual-write 模式不破坏现有 send queue（系统模板照常工作）
- **migration 不可逆性高**：如未来发现统一表撑不住，回滚成本极高（要把 Asset 拆回多表）—— 接受这个风险，因为 X 设计已考虑长期扩展

### 中性

- **system_seed 标记取代 type=system 字段**：与现有 EmailTemplate.type='system' 行为等价，仅命名重构
- **跨 tenant 共享 system_seed 仍走 tenantId IS NULL**：与现有 EmailTemplate RLS 相同模式，无新边界

## Implementation Notes（BL-025 spec 细化）

1. **migration order（dual-write 兼容期）：**
   - Step 1：新建 Asset 表 + RLS + data migration（写 Asset 但不删 EmailTemplate）
   - Step 2：dual-write 期 —— Asset 写入新数据，EmailTemplate 同步写（保 send queue 旧路径不破）；持续 1 个 sprint 观察
   - Step 3：切 reader 全部走 Asset（loadOutreachTemplates / send-queue / 其它）+ 监控异常 1 周
   - Step 4：最后 followup migration 删 EmailTemplate 表
   - 实际操作：BL-025 batch 完成 Step 1+2+3；Step 4 留独立 cleanup migration ~1-2 周后

2. **content JSON shape（Zod 中央 schema）：**
   ```ts
   // src/lib/assets/schemas.ts
   export const EmailContentSchema = z.object({
     subject: z.string().max(200),
     body: z.string().max(10000),
     locale: z.enum(['en', 'zh', 'ja', 'ko', 'es']),
     variables: z.array(z.object({
       token: z.string(),
       description: z.string().optional(),
       required: z.boolean().default(false),
     })).default([]),
   });
   export const VideoScriptContentSchema = z.object({
     title: z.string().max(200),
     script: z.string().max(20000),
     durationHintSec: z.number().int().positive().optional(),
   });
   export const ASSET_CONTENT_SCHEMAS = {
     email: EmailContentSchema,
     video_script: VideoScriptContentSchema,
   } as const;
   ```

3. **Audit log（generate / regenerate 不限频但留底）：**
   - `audit_log.action` 增 `asset.generated` / `asset.regenerated` / `asset.imported`
   - 含 traceId + model + tokens 消耗 + steeringPrompt
   - 后续接入 admin dashboard 可按 tenantId 出每月 generate 量排行

## Alternatives Considered

| 方案 | 工时 | 长期心智 | 扩展成本 | 迁移风险 | 选 |
|---|---|---|---|---|---|
| X 统一表 + migration | ~1 day migration + 4 day batch | ⭐⭐⭐ 一致 | ⭐⭐⭐ 加 enum | 🔴 一次性高 | ✅ |
| Y 多表分层 | ~3 day batch | ⭐ 分裂 | 🔴 每加 type 新表 | 0 | ❌ |
| Z 折中（保留 EmailTemplate）| ~3 day batch | ⭐⭐ 半统一 | 🟡 邮件之外扩展 OK | 0 | ❌ |

用户 2026-05-02 决策选 X：MVP 时间不硬，长期价值优先；接受一次性 migration 风险换长期清爽 schema。

# BL-099 邮件模板 ADR-011 迁移收尾 — 统一 Asset 单一真相源

> **Type：** 迁移/技术债收尾（ADR-011 的 cleanup 批次）。一次到位（D1–D4）。
> **决策：** ADR-018（Asset 唯一真相源 + email_log 快照解耦 FK + drop email_template）
> **审计：** `docs/reviews/email-template-feature-audit-2026-06-09.md`
> **关联：** ADR-011 · BL-025-F006(dual-write) · BL-098(AI 定制 hotfix, symptom)
> **范围：** 纯 kolmatrix。含 2 个 prisma migration + 1 个一次性数据迁移。

## §1 现状（源码实证，详见审计 + ADR-018）

split-brain：Asset(type=email)=读路径已迁；email_template=写路径(`createUserTemplate` 等)+ analytics + email_log FK 仍在用。用户从两个入口(Composer"存为模板" + reach/templates 活 tab)建的模板**只写 email_template、不进 Asset → 存完即从 composer 列表消失**(prod ~16 个)。

**关键文件：**
- `src/lib/email/templates.ts` — `createUserTemplate`(133)/`updateUserTemplate`(157)/`deleteUserTemplate`(192)/`duplicateUserTemplate`(207) 全只碰 `tx.emailTemplate`；`countUserTemplates`(119) 读 email_template；`loadOutreachTemplates`(69) 读 Asset。
- `src/app/[locale]/(app)/reach/actions.ts:366` `saveTemplateAction` → createUserTemplate/updateUserTemplate。被 `OutreachComposer.tsx:306` + `TemplateWorkspaceClient.tsx:232,302` 调用。
- `src/lib/assets/mutations.ts` — createAsset/updateAsset/archive/delete 对 type=email 双写镜像到 email_template（id=asset.id）。
- `src/lib/email/analytics.ts:147-160` `getTopTemplates` — email_log.groupBy(templateId) → `tx.emailTemplate.findMany` 取名。
- `src/lib/email/batch-send.ts:104,201` — `tx.emailLog.create({ templateId })` 发送写日志。
- `prisma/schema.prisma` — `EmailTemplate`(374, @@map email_template) · `EmailLog.templateId`(399 String? uuid) + relation `template EmailTemplate?`(418)。

## §2 Features（按依赖顺序，drop 表必须最后）

> 所有 generator feature 验收含 L1 全绿（lint 0err/warn≤3 · tsc=0 · npm test）+ 单测。schema 变更跑 `npx prisma migrate dev`。

### F001 — 写路径统一到 Asset（generator）— 止活血
- `templates.ts` 的 `createUserTemplate / updateUserTemplate / deleteUserTemplate / duplicateUserTemplate` 改为操作 **Asset**（走 `assets/mutations.ts` createAsset/updateAsset/deleteAsset，type=email，source=user_created，content JSONB 存 subject/body/locale/variables，与 `loadAssetsForComposer` 读口径一致）。保持函数签名/返回 `EmailTemplateOption` 不变（内部换实现），让 `saveTemplateAction` 等调用方无需改。
- `countUserTemplates`(119) 改 count **Asset**（type=email, source≠system_seed, 当前 tenant）。
- withTenant RLS 保持；非法/跨租户/不存在 → 优雅返回（不 500）。
- **验收：** 工作区/Composer 建模板 → 立即出现在 composer 下拉 + 工作区列表；badge 数 == 列表用户模板数（不再打架）；改/删/复制对 Asset 生效。dual-write 仍在(F004 才删)，故此阶段 email_template 仍被镜像写——可接受。含单测。

### F002 — 历史 user email_template 行迁移到 Asset（generator）— 防数据丢失
- 一次性迁移（脚本或 migration data step，**幂等**）：把现存 `email_template WHERE type='user'` 行迁成 Asset（type=email, source=user_created, tenant 对位）。**去重**：已在 Asset（id 相同或 content 相同）的不重复建。
- 10 个 legacy `type='system'` email_template 行不迁（Asset 的 10 个 system_seed 是规范源，legacy 是过时副本）。
- **验收：** 迁移前后断言 user 模板"无丢失"（每个 tenant 的 user 模板在 Asset 可见数 ≥ 迁移前 email_template user 数）；幂等（重跑不产生重复）。脚本可只读 dry-run 预览 count。含单测（迁移逻辑 + 去重 + 幂等）。

### F003 — email_log 快照列 + 回填 + 解耦 FK + 发送写快照（generator）— schema migration
- prisma migration：`EmailLog` 加 `templateName String? @map("template_name")`；**回填** `UPDATE email_log SET template_name = (SELECT name FROM email_template WHERE id = email_log.template_id) WHERE template_id IS NOT NULL`（趁 email_template 还在）；**去掉** `template EmailTemplate?` relation + FK 约束，`template_id` 保留为 plain uuid。
- `batch-send.ts:104/201` 发送创建 email_log 时写 `templateName`（从发送用的 Asset 模板取名，快照）。
- **验收：** migration 跑通；历史行 template_name 回填；新发送写入快照名；FK 约束已移除（可验 information_schema 无该 constraint）。含单测。

### F004 — analytics 改读快照名（generator）
- `analytics.ts:147-160` `getTopTemplates` 改用 `email_log` 自身的 `template_name`（groupBy 可带 templateName，或取每组快照名），**删除 `tx.emailTemplate.findMany` join**。
- **验收：** top templates 名称来自 email_log 快照；system_seed 发送不再 null 名（若已回填）。含单测。

### F005 — 删双写 + drop email_template 表 + 清 model/引用（generator）— 不可逆，最后
- 移除 `assets/mutations.ts` 的 email_template 镜像写（create/update/archive/delete 四处）。
- prisma migration `DROP TABLE email_template`；删 schema `EmailTemplate` model。
- grep 全仓确认 **零** `tx.emailTemplate` / `prisma.emailTemplate` / `EmailTemplate` model 引用残留（类型 interface `EmailTemplateRecord/Option` 可保留为纯 TS 类型）。
- **验收：** 全仓 0 处引用 email_template 表；migration 跑通；L1 全绿 + build。**前置：F001–F003 须先验收通过**（数据已迁、FK 已解耦）。含单测。

### F006 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test（含各 feature 新单测）。
- L2 部署后 prod/staging：① 工作区新建模板 → 立即出现在 composer 下拉（修活 bug）；② AI 定制全部模板含 system_seed 正常；③ 邮件分析 top templates 显示快照名；④ 发送 → email_log.template_name 有快照；⑤ DB 无 email_template 表、user 模板零丢失（计数对比）。
- signoff `docs/test-reports/BL-099-signoff-2026-06-XX.md`。

## §3 风险与部署

- **不可逆（drop table）：** F005 最后做，Codex 须在 F001–F003（写路径迁移 + 数据迁移 + FK 解耦）验收通过后才放行 F005。
- **数据安全：** F002 迁移须幂等 + dry-run 可预览；F005 验收断言零用户模板丢失。
- **2 个 schema migration**（F003 加列+回填+解约束 / F005 drop table）：部署由用户手动触发，建议 F005 的 drop 单独一次部署窗口，前一窗口确认 F001–F004 在 prod 稳定后再 drop。⚠️ OOM：build NODE_OPTIONS=4096。
- **回填时序：** F003 回填必须在 F005 drop 之前（趁 email_template 在）。

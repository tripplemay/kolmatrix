# BL-098 邮件 AI 定制模板查询迁到 Asset 表（生产故障 hotfix）

> **Type：** Hotfix（prod 故障,走铁律 #9：Planner 方案→用户确认→Generator 实装→Evaluator 验收)
> **触发：** 2026-06-09 用户报 prod 邮件中心 — 选 "Clash Royale — Signing invitation" 模板 → 点 AI 定制 → 右侧 AI 重写窗口报"模板不存在 — 请从下拉列表中选择其他模板"
> **关联：** ADR-011（统一 Asset 表 + EmailTemplate dual-write 迁移）

## §1 根因（已实证，源码级）

| 环节 | 查哪张表 | id 类型 |
|---|---|---|
| 下拉列表 `loadOutreachTemplates`(`src/lib/email/templates.ts`)→ `loadAssetsForComposer` | ✅ 统一 **`Asset` 表**(type=email) | 返回 **asset id** |
| AI 定制 action `customizeEmailAction`(`src/app/[locale]/(app)/reach/actions.ts:116`) | ❌ 已废弃 **`emailTemplate` 表** | 拿 asset id 去 `tx.emailTemplate.findUnique({id})` |

下拉列表给的是 **asset id**,AI 定制拿去查 `emailTemplate` 表 → 查不到 → `template_not_found` → "模板不存在"。**纯 Asset 的模板**("Clash Royale — Signing invitation" 这类,不在旧 emailTemplate 表)必挂;dual-write 期两表都有的老模板才碰巧能查到。

**范围孤立：** 整个 `reach/actions.ts` 仅第 116 行查 `emailTemplate`;发送 / 模板 CRUD(:410/:447 `duplicateUserTemplate` 等)已用 Asset 路径。所以**只有 AI 定制有此 bug**(与用户现象一致:只 AI 定制报错)。

## §2 Features

### F001 — AI 定制模板查询从 emailTemplate 迁到 Asset（generator,kolmatrix）
- `reach/actions.ts:116` 把 `tx.emailTemplate.findUnique({where:{id: templateId}})` 改为**按 asset id 读 Asset 表**(type=email),从 content JSONB 提 `subject/body/locale`。
- **复用现成逻辑**:`loadOutreachTemplates` 的 `adapt`(asset row → {subject, body, locale})已有提取逻辑;建议抽一个共享 `getEmailTemplateById(tx, tenantId, assetId)` 让下拉列表/定制(及未来发送)同源,根治不一致。
- withTenant 保持 RLS;templateId 非 UUID / 非 email-type asset / 已软删 → 仍优雅返回(不 500)。
- 含单测(asset 模板查得到 + 非法 id 优雅失败)。L1 全绿(lint/tsc/test)。

### F002 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test。
- L2 部署后 prod/staging：选 **Asset-only 模板("Clash Royale — Signing invitation")→ AI 定制 → 正常出重写**(不再"模板不存在");回归：其它模板 AI 定制仍正常;发送路径不受影响。
- signoff `docs/test-reports/BL-098-signoff-2026-06-XX.md`。

## §3 风险

- 极小,单点修复(line 116)。纯 kolmatrix。⚠️ 部署 staging+prod(手动触发)注意 OOM(NODE_OPTIONS=4096)。
- 确认 Asset content JSONB 的 subject/body/locale 字段路径与 `loadOutreachTemplates` adapt 一致(避免提取口径不同)。

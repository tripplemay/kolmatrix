---
name: B4 email template library
description: BM2/B4 邮件模板库增强 - 把 AI 定制结果持久化为租户模板，并在 /outreach 发送界面与模板库页可复用、可管理
status: draft
created_by: johnsong (Planner)
created_at: 2026-04-29
---

# B4 — Email Template Library

## 1. 背景与目标

BM2 已经实现了 `/outreach` 邮件触达主链路、系统模板 seed、AI 定制和批量发送，但当前 AI 生成结果只存在于当前会话预览里，无法变成后续可选模板。用户看到“已生成模板”，切到发送界面后却无法复用，这是产品心智缺口，不是单点 UI 故障。

本批次目标是把模板能力补成完整闭环：

- 在 `/outreach` 中可以把 AI 定制结果保存为当前租户的用户模板
- 发送界面可以同时选择系统模板和我的模板
- 提供模板库页，支持查看、创建、编辑、复制、删除用户模板
- 系统模板保持只读，避免 seed 内容被误改
- 不改变现有发送、节流、日志和 contactStatus 行为

## 2. 范围

### In Scope

1. `/outreach` 读取并展示系统模板 + 当前租户用户模板
2. AI 定制对话框新增 `Save as template` 能力
3. 用户模板持久化到现有 `email_template` 表
4. 新增 `/outreach/templates` 模板库页，按 Stitch 设计稿实现
5. `OutreachTabs` 的 `Templates` 标签页变成可点击路由
6. 模板库支持搜索、locale 过滤、创建、编辑、复制、删除
7. 加入模板相关单测 / 集成测试 / E2E smoke / 视觉回归 baseline

### Out of Scope

- 新增模板专用数据库表
- 模板分享、模板市场、团队协作审批流
- 复杂富文本编辑器
- 发送队列、退订、webhook、点击/打开率追踪
- 修改邮件发送协议或 Resend 集成

## 3. 关键设计决策

| 决策 | 方案 | 理由 |
|---|---|---|
| 模板归属 | 复用现有 `email_template` 表，`tenantId = null` 为 system，`tenantId = currentTenantId` 为 user | 已有 schema 足够承载模板库，不引入不必要迁移 |
| 路由归属 | 使用 `/outreach/templates` 作为模板库页 | 与现有 `OutreachTabs` 和 email center 语义一致，改动面最小 |
| 编辑器形态 | Markdown/纯文本编辑器 + 实时预览 | 与现有发信 body 模式兼容，且已有 `react-markdown` 可复用做预览 |
| AI 定制保存 | `Use this version` 仅本次发送；`Save as template` 才落库 | 避免一次性 AI 结果污染模板库 |
| System 模板 | 只读，不允许编辑或删除 | 保留 seed 的稳定性，降低误操作风险 |
| UI 参照 | Stitch 的 `Email Template Editor — Honor of Kings` 设计稿 | 页面是新增 UI，必须保持设计一致 |

## 4. 数据与接口

### 4.1 现有数据模型约定

本批次不新增表结构，直接使用现有 `EmailTemplate`：

- `tenantId = null` 表示 system template
- `tenantId = currentTenantId` 表示 user template
- `type = "system" | "user"`
- `locale = "en" | "zh"`
- `variables` 继续存 JSON token catalogue

### 4.2 读取规则

`/outreach` 模板列表规则：

1. 先读当前 locale 的 system + user templates
2. 若结果为空且 locale 不是 `en`，fallback 到 `en` 的 system templates
3. 系统模板优先展示，用户模板第二组展示
4. 发送与预览只使用当前选中的模板，不自动覆盖本次临时 AI 预览

建议查询形态：

```ts
where: {
  OR: [{ tenantId: null }, { tenantId: currentTenantId }],
  locale: currentLocale,
}
```

### 4.3 保存规则

保存模板时：

1. 生成一条新的 `EmailTemplate`
2. `tenantId = currentTenantId`
3. `type = "user"`
4. 复制当前模板的 `variables`、`locale`、`subject`、`body`
5. 写审计/事件日志
6. 返回新模板 `id`，让前端自动选中

### 4.4 管理规则

- 仅 user templates 可编辑、复制、删除
- system templates 仅展示，不提供破坏性操作
- 删除 user template 不影响 system template 或历史 EmailLog

## 5. 验收标准

1. `/outreach` 页面可以看到系统模板和当前租户用户模板
2. AI 定制后点击 `Save as template`，刷新页面后仍然能在发送下拉里选到
3. `/outreach/templates` 页可以创建、编辑、复制、删除用户模板
4. 系统模板在模板库页不可编辑、不可删除
5. `/outreach` 与 `/outreach/templates` 的布局符合 Stitch 设计稿
6. 模板保存后不会影响现有发送、节流和邮件日志行为
7. 新增测试覆盖模板 union load、保存、CRUD guardrail 和页面路由
8. 新增视觉回归 baseline 能覆盖模板库页，并保持 `/outreach` 现有 baseline 可更新

## 6. 依赖与实现边界

- 依赖现有 BM2 outreach 基线
- 依赖现有 `react-markdown` / `remark-gfm` 作为预览组件能力
- 不要求新增 schema migration
- 不要求改 Resend、aigcgateway 或发信协议
- 如果后续需要模板来源追踪，再单独提 ADR / schema 增量，不在本批次内

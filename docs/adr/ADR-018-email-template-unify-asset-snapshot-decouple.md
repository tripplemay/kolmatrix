# ADR-018: 邮件模板统一到 Asset 单一真相源 + email_log 快照解耦

## Status

**Accepted**

- 日期：2026-06-09
- 作者：Kimi (planner) + 用户
- 相关批次：BL-099（落地工单，本 ADR 同期产出）
- 前序：ADR-011（统一 Asset 表 + EmailTemplate dual-write 迁移，**本 ADR 是其收尾**）· BL-025-F006（dual-write 实装）· BL-098（AI 定制 hotfix，symptom）
- 证据：`docs/reviews/email-template-feature-audit-2026-06-09.md`（源码 + prod 只读实证）

## Context（背景）

ADR-011 计划把邮件模板从独立 `email_template` 表迁到统一 `asset` 表（type=email），用 dual-write 过渡。`assets/mutations.ts` 注释写明"email_template becomes a read-only mirror after the cleanup migration (~1-2 weeks out, separate batch)"——但**收尾批次一直没做**，系统卡在 split-brain：

**源码 + prod（2026-06-09）实证的分裂：**

| 路径 | 实际表 | 后果 |
|---|---|---|
| Composer 下拉 / 工作区列表 `loadOutreachTemplates` | ✅ Asset | — |
| **建/改/删/复制模板**（`createUserTemplate` 等，两个入口：Composer"存为模板" + reach/templates 活 tab） | ❌ **只写 email_template** | 用户建的模板不进 Asset → **存完即从列表消失**（prod ~16 个用户模板就这么"丢"） |
| Tab badge `countUserTemplates` | ❌ email_template(17) | 与列表(Asset user=1)数字打架 |
| AI 定制 `customizeEmailAction` | ✅ Asset（BL-098 已修） | — |
| 邮件分析 `getTopTemplates` | ❌ email_template join 取名 | 10 个 system_seed 发送显示 null 名 |
| 发送审计 FK `email_log.template_id` → `email_template.id` | 真实 FK（schema:418） | 删表拦路石 |

prod 量化：Asset(type=email) 27 条 vs email_template 27 条，**10 个 system_seed Asset 无 email_template 镜像**（seed 脚本绕过双写）+ **16 个 user email_template 行未进 Asset**（旧 createUserTemplate 只写 email_template）。两套数据互不对位。

> **审计纠正：** 此前以为 reach/templates 工作区是"无入口孤儿" → 错，它是 reach 区的活 tab（`OutreachTabs.tsx`），用户在用。这把"技术债"升级为"活的用户可见 bug"。

## Decision（决策）

**Asset 表（type=email）= 邮件模板唯一真相源。email_template 表退役删除。**

四条具体决策：

### D1 — 写路径统一到 Asset
`createUserTemplate / updateUserTemplate / deleteUserTemplate / duplicateUserTemplate` 全部改为操作 Asset（走 `assets/mutations.ts` 的 createAsset/updateAsset/deleteAsset，type=email，source=user_created）。`saveTemplateAction` 随之指向 Asset。`countUserTemplates` 改 count Asset。用户建的模板立即出现在 composer 下拉与工作区。

### D2 — email_log FK 解耦 + 快照模板名（核心，不可逆）
`email_log.template_id` **去掉指向 email_template 的 FK 约束**，降为 plain uuid（保留供历史关联）。新增 `email_log.template_name`（text, nullable）**快照列**：发送时（`batch-send.ts`）写死当时模板名。

**理由：审计日志的语义本就该是"发送当时的名字"而非"当前名字"。** 模板改名/删除后，历史发送记录应保留发出时的名称，快照语义比 join 当前表更正确。analytics `getTopTemplates` 改读 `email_log.template_name`，不再 join email_template → email_log 自包含。

历史 email_log 行的 template_name 在迁移时从 email_template 回填（趁表还在）；无对应的留 null。

### D3 — 历史 user 模板迁移到 Asset（防数据丢失）
drop email_template 前，把现存 ~16 个 **user** email_template 行迁移成 Asset（user_created，幂等去重，已在 Asset 的不重复建）。10 个 legacy system email_template 行是 Asset 10 个 system_seed 的过时副本 → 安全丢弃（Asset 持有规范系统模板）。**铁律：不丢用户内容。**

### D4 — 删双写 + drop email_template 表
移除 `assets/mutations.ts` 的 email_template 镜像写；prisma migration `DROP TABLE email_template`；删 Prisma `EmailTemplate` model + 全部 `tx.emailTemplate` 引用。

### 范围
**一次到位**（用户决策 2026-06-09）：D1–D4 全部在 BL-099 一个批次内完成，含 2 个 schema migration + 1 个一次性数据迁移。

## 被否方案

- **email_template 降级为 FK shim（不删表）**：改动最小、风险最低，但双写与两表残留，split-brain 没根除——只是把写口统一了。否：用户要彻底收尾。
- **全量 remap email_log.template_id 到 Asset.id 后 drop**：需把历史 email_log 的 legacy email_template.id remap 到 asset.id，但两者 id 不相干、部分历史行无对应 Asset → remap 有数据缺口、迁移脚本复杂。否：D2 快照方案语义更对且无需 remap。

## Consequences（影响）

**正面：** 单一真相源；用户建模板立即可见（修活 bug）；email_log 自包含、审计语义更正确；删一张表 + 双写 + 重复 CRUD 路径，维护债清零。

**风险/代价：** 不可逆（drop table）→ D3 数据迁移必须先于 D4 且 D4 验收须断言零用户数据丢失（迁移前后 user 模板计数）；2 个 schema migration（加列+回填+解约束 / drop table）须按 prod 部署顺序谨慎；email_log.template_name 快照是新语义（历史行 null 可接受）。

**回滚：** drop table 后不可逆——故 D4 是批次最后一个 generator feature，且 Codex 须在 D1–D3 验收通过后才放行 D4。部署由用户手动触发，建议 D4 的 migration 单独一次部署窗口。

# 邮件模板功能审计 — ADR-011 迁移遗留(split-brain 存储)

> **类型：** 功能审计(Planner 独立任务,用户 2026-06-09 指派)
> **环境：** 源码 + prod kolmatrix DB 只读量化(DATABASE_ADMIN_URL,绕 RLS)
> **作者：** Kimi (planner)
> **关联：** ADR-011(统一 Asset 表)· ADR-012 · BL-025-F006(dual-write)· BL-098(AI 定制 hotfix,symptom)· BL-099(本审计派生的迁移收尾)

## 0. 结论

邮件模板功能卡在一场**没做完的 ADR-011 迁移**里,处于 **split-brain 存储**:`Asset` 表(新真相源)与 `email_template` 表(旧表)并存,**单向双写 + 消费方读表不一致**。这是 BL-098("模板不存在")的根因,且影响**全部 10 个系统种子模板**。BL-098 只修了 AI 定制一处(治标),根治需完成迁移收尾(BL-099)。

## 1. 设计意图 vs 现实

代码注释(`src/lib/email/templates.ts:25-29`)声称:"Asset 是唯一真相源,**email_template 不再被 app code 读取**,只作 `email_log.template_id` FK 镜像。"

**现实(源码实证)分裂:**

| 角色 | 实际表 | 证据 | 与意图一致? |
|---|---|---|---|
| composer 下拉 `loadOutreachTemplates` | ✅ Asset | `templates.ts:74` loadAssetsForComposer | ✓ |
| **AI 定制** `customizeEmailAction` | ❌ email_template | `reach/actions.ts:116`(已被 BL-098 修) | ✗ |
| **邮件分析** | ❌ email_template | `analytics.ts:156` findMany | ✗ |
| **模板工作区创建/改/删** `createUserTemplate` 等 | ❌ **只写 email_template**(不写 Asset) | `templates.ts:133` + `reach/actions.ts:366 saveTemplateAction` | ✗ |
| 双写镜像 | Asset → email_template(id=asset.id) | `assets/mutations.ts:8` **单向** | — |

## 2. prod 量化(2026-06-09,只读)

**Asset 表 type=email(27 条):** ai_generated/published **16** · system_seed/published **10** · user_created/draft **1**
**email_template 表(27 条):** user **17** · system **10**

**🔴 缺镜像(Asset 有、email_template 无 → AI 定制受害者):**

| source | status | 数量 |
|---|---|---|
| **system_seed** | published | **10** |

→ **10 个系统种子模板**在 Asset 里、但没有 email_template 镜像(seed 脚本直灌 Asset,绕过 `createAsset` 双写)。AI 定制按 asset-id 查 email_template → 查不到 → "模板不存在"。**"Clash Royale — Signing invitation" 即其中之一。**

> 注:email_template 的 10 个 "system" 是**旧的独立 legacy 种子**(id 与 Asset system_seed 不同)→ 系统种子模板实际有**两套**(10 legacy in email_template + 10 new in Asset,id 不相干),典型 split-brain。ai_generated/user 资产经双写 id=asset.id 进 email_template(17 user),所以这些定制能用。

## 3. 三个核心问题(按严重性)

1. **🔴 AI 定制对全部 10 个系统种子模板失效**(BL-098)。种子模板恰是 marketer 最常用的起点。BL-098 hotfix(customize 改读 Asset)一次修好全部 10 个,但只是这一处。
2. **🟠 模板工作区是孤儿 + 数据进错表**。`reach/templates` 工作区创建走 `createUserTemplate` → **只写 email_template、不写 Asset、无反向镜像**;而 composer 只读 Asset → **此工作区建的用户模板不会出现在 composer 下拉**。且未找到指向 `/reach/templates` 的导航入口(疑 orphaned)。
3. **🟡 维护债 + 真相源不明**。双写 + 两套 CRUD 路径 + 两张表;注释与现实脱节;analytics 仍读旧表(数据口径风险)。

## 4. 优化建议:完成 ADR-011 迁移收尾(BL-099)

1. **确立 Asset 为唯一真相源**。
2. **迁移剩余 email_template 读取方到 Asset**:analytics(`analytics.ts:156`);customize 已由 BL-098 迁。
3. **退役/重接孤儿工作区**:`reach/templates` 的 `createUserTemplate/update/delete` 改写 Asset(用 assets/mutations 路径),或整体删除该工作区(若已被 Asset 中心取代)。
4. **补齐系统种子镜像 或 取消镜像依赖**:要么给 10 个 system_seed Asset 补 email_template 镜像(过渡),要么把 `email_log.template_id` 迁到指向 Asset 后删 email_template。
5. **删双写 + 重复 CRUD 路径**,消除 split-brain。

**功能面本身不差**(工作区有搜索/locale 过滤/预览/AI 编辑;富文本编辑器是 backlog BL-027)——**问题在底层存储分裂,不在功能。**

## 5. 与 BL-098 的关系

BL-098(进行中,verifying)= **治标**(只修 AI 定制读 Asset)。本审计 = **根治路线图**(BL-099 收尾)。建议 BL-098 signoff 标注"symptom,根治见 BL-099"。

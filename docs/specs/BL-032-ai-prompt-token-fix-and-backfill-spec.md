# BL-032 — KB AI 生成邮件 placeholder 标准化（prompt 修正 + 历史数据 backfill）

> 状态：**待 Generator 实现**（progress.json status=building）
> 触发：BL-031 done + prod redeploy 后用户测 send，邮件正文出现字面 `[Creator Name]` `[Your Name]` 未替换。Phase 1 调研：KB AI 提示词未指定 placeholder 规约 → AI 自然写英文方括号 → 替换 regex 仅认 Mustache `{{token}}` → 0 匹配 → 原文带方括号发出。

---

## 1. 背景

### 1.1 系统约定（不动）

`src/lib/email/variable-substitute.ts:25` 替换 regex `/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g`，仅认 Mustache 语法。

合法 token catalog（来源 BM2-F006 spec）：
- `{{kol.name}}` / `{{kol.handle}}`
- `{{product.name}}` / `{{product.category}}` / `{{product.usp}}`
- `{{marketer.name}}`

scripts/seed-email-templates.ts 系统模板严格遵循（实测 grep 通过）。

### 1.2 现状（prod sha d23ef70）

KB AI 提示词（`src/lib/products/generateAiAssets.ts:88-97` userMessage）未给 AI placeholder 规约，导致 AI 模型自由发挥。Prod DB 实测：

| 来源 | 数量 | placeholder 形态 | 替换结果 |
|---|---|---|---|
| KB 路径（`generateAiAssets`）| **15** | 5 种方括号变体 | ❌ 替换 0 token，原文发出 |
| /assets Wizard（`generateAssetAction`）| 1 | Mustache `{{...}}` | ✅ 正常替换 |

5 种方括号变体（实测 distinct）：
- `[Creator Name]` / `[KOL Name]` / `[Creator]` → 应映射 `{{kol.name}}`
- `[Your Name]` → 应映射 `{{marketer.name}}`
- `[DATE]` → catalog 无 `{{date}}` token（D3 留 Soft-watch）

### 1.3 Definition of Done

- [ ] 3 features 全 PASS + Reviewer L1+L2 签收
- [ ] 新 KB AI 生成邮件正文 / 主题 100% 用 `{{token}}` Mustache（test：mock fetch 让 AI 返回含方括号的内容 → assert prompt instruction 包含规约文字 + Reviewer L2 staging 创建一新 product 触发 generation 实测验证生成内容含 `{{kol.name}}` `{{marketer.name}}` 等至少 2 个 mustache token）
- [ ] Backfill 脚本本地 testcontainers + staging dry-run + 实跑：把 prod 15 个 ai_generated bracket-style email 转 mustache，UPDATE 经 updateAsset mutation 触发 dualWriteEmailTemplateOnUpdate 同步 email_template 表
- [ ] Reviewer Send Test 选一个 PUBG Mobile email → 邮件正文 `{{kol.name}}` 替换为 KOL 实名 / `{{marketer.name}}` 替换为 marketer 实名
- [ ] prod redeploy + 用户 SSH 跑 backfill → 浏览器 send test 验证

---

## 2. 关键设计决策（Planner 已锁，Generator 不得变更）

### D1 — AI prompt placeholder 规约文字（F001）

在 `generateAiAssets.ts:88-97` userMessage 末尾追加段落（dedented，UTF-8）：

```
Use these EXACT Mustache tokens in subject/body where personalization is needed; do not use square brackets like [Creator Name] or [Your Name] (the system substitution layer only recognizes Mustache):
- {{kol.name}} for the creator/KOL recipient name
- {{product.name}} for the product/game name
- {{product.category}} for the product category  
- {{product.usp}} for the product unique selling points
- {{marketer.name}} for the sender/marketer signature

Example: "Hi {{kol.name}}, ..." / "—{{marketer.name}}".
```

**禁止其它形态：** AI 不得自创 `{{name}}` `{{recipient}}` 等 catalog 外 token；不得用 `[...]`、`<...>`、`%...%` 等替代语法。Prompt 已给 5 个明确选项。

### D2 — Backfill 脚本映射表（F002）

| 输入（bracket）| 输出（mustache）|
|---|---|
| `[Creator Name]` / `[KOL Name]` / `[Creator]` | `{{kol.name}}` |
| `[Your Name]` | `{{marketer.name}}` |
| `[DATE]` | **不替换**（保留字面，Soft-watch S1 标记）|

**正则实现：** 不区分大小写、单词边界，但要严防误改文中合法方括号文字（例：`[example]` 在 marketing 内容 — 实测 prod 当前数据无此案例，但脚本要保守只匹配 5 种已知）。

### D3 — Backfill 走 updateAsset mutation（不绕）

**不重蹈 BL-030 SQL ops 漏副作用的覆辙**。脚本必须：

1. 用 `withTenant(tenantId)` per-tenant scan（沿用 BL-031-F003 模式：先 `prisma.tenant.findMany`，再每 tenant 跑）
2. 找出待转 asset：`source='ai_generated' AND type='email' AND (content body 含任一 5 种 bracket 中 4 个待转的)`
3. 计算新 content（subject + body 全文 5→2 替换）
4. 调 `updateAsset(tx, assetId, { content: newContent })` — 自动触发 `dualWriteEmailTemplateOnUpdate`（mutations.ts:323-331）镜像同步 email_template subject/body
5. 不需要标 metadata.convertedAt（content 自身查 bracket 是否还在 = 天然幂等性 — 重跑会发现"无 bracket"自动跳过）

### D4 — Out of scope（本批次不做）

- `{{date}}` token 加入 SubstituteVariables（需扩 SubstituteVariables interface + UI 传 `new Date().toISOString()` + 时区考虑） — 留待 Soft-watch S1 后续处理
- 视频脚本 `[...]` 检查（video_script 不走 substitute pipeline，仅展示/复制）
- 历史 email_log 已发出的 bad-content 邮件数据（已发出无法收回；用户该清理 demo 数据另算）
- Prompt 多语种支持（KB 仍 hardcode 英文输出，本批次不动）

---

## 3. Files

**修改：**
- `src/lib/products/generateAiAssets.ts`（F001 — userMessage 末尾追加 D1 段落）
- `src/lib/products/__tests__/generateAiAssets.test.ts`（F001 — 加 1 case：fetch mock 返回含 `{{kol.name}}` 的 body，断言 createAsset.content.body 含此 token；并断言 prompt build 出的 string 含 'Use these EXACT Mustache tokens' 关键短语）

**新增：**
- `scripts/convert-bracket-tokens-to-mustache.ts`（F002 — 主脚本）
- `scripts/__tests__/convert-bracket-tokens-to-mustache.test.ts`（F002 — 集成测试，testcontainers）

---

## 4. 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 替换 regex 误改 marketing 文中合法 `[example]` 字面 | low | low | 只匹配白名单 4 种；对 prod 现 15 行手动 grep 确认无误改 |
| AI 仍偶尔不遵循 prompt 指令（claude-haiku-4.5 generation 不确定性）| medium | low | F001 测试 mock 控制；后续可加 generation 后 server-side validation 拒收 bracket-only token 的 AI response — 留 v0.9.9 提案 |
| Backfill 跑后 dualWriteEmailTemplateOnUpdate 异常（如某行 email_template 镜像本身缺失，updateMany 返 0 静默不报）| low | low | mutations.ts:148 注释已说明 updateMany 静默；脚本输出 stats 时区分 asset.updated vs email_template.affected（用户能察觉差异）|
| 重跑脚本重复扫已修复 asset | low | low | content 无 bracket 即跳过（D3 天然幂等）|

---

## 5. 部署顺序（用户操作）

1. BL-032 done + Reviewer 签收
2. GitHub Actions → Deploy to Production → main
3. SSH prod: `cd /opt/kolmatrix && node_modules/.bin/tsx scripts/convert-bracket-tokens-to-mustache.ts` (dry-run)
4. 看 stats 确认 15 行待改 → `node_modules/.bin/tsx scripts/convert-bracket-tokens-to-mustache.ts --execute`
5. 浏览器 prod /zh/outreach 选 PUBG Mobile — Season 30 → 选一个产品模板 → Send Test → 收件人邮件正文应见 KOL 实名（如 "Hi tripplezhou"）+ marketer 实名签名
6. 报回，Planner done 收尾

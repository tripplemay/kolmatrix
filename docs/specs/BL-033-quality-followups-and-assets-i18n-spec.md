# BL-033 — 质量收尾合集（Checkbox 视觉 hotfix + KB pipeline 强化 + /assets i18n 完整接入）

> 状态：**待 Generator 实现**（progress.json status=building）
> 触发：(1) 用户在 prod 浏览器测 outreach KOL 选择框，发现 unchecked 视觉永远显示 ✓；(2) 用户在 prod /zh/assets 看到 UI 仍英文显示，i18n 半成品；(3) 顺带闭 BL-032 Soft-watch S1（[DATE] token）+ S2（server-side validation 兜底）。

---

## 1. 背景

BL-032 done + prod backfill 完成后，用户连续报两个 prod 质量问题：

1. **Outreach KOL Checkbox 视觉错乱** — base-ui Indicator `keepMounted` 配置错配，unchecked 状态永远渲染 "check" 字面图标
2. **/assets 页 i18n gap** — 30 处 t() 调用 vs 60+ 硬编码英文，messages/{en,zh,ja,ko,es}.json 完全缺 `assets` 命名空间

加上 BL-032 留账 2 项 Soft-watch（[DATE] token / AI 输出 server-side validation），合并 1 mini-batch 一次解决。

### 1.1 Definition of Done

- [ ] 4 features 全 PASS + Reviewer L1+L2 + prod redeploy
- [ ] F001 浏览器手验：/zh/outreach KOL 表 unchecked checkbox 不显示 ✓ 字面图标；click 切换正常；indeterminate（部分选中）仍显示 dash
- [ ] F002 prod backfill 跑：1 行 Clash Royale — Signing invitation `[DATE]` → `{{date}}`；新生成 KB 邮件含 `{{date}}` token；composer 发邮件时 `{{date}}` 替换为今日日期（格式 `2026-05-04`）
- [ ] F003 staging 实测：mock fetch 让 AI 返 `[Creator]` 方括号 placeholder → server-side validation 拦截，Asset 写入失败 + Product.aiAssets.status=failed + 审计 log
- [ ] F004 浏览器手验：/zh/assets 全 UI 中文显示（含 toast / placeholder / aria-label / Wizard 3 步标题 / 错误信息）；切 /en/assets 全 English；ja/ko/es 不显示 raw key 字符串
- [ ] CI 全绿 + 现有测试不破

---

## 2. 关键设计决策（Planner 已锁，Generator 不得变更）

### D1 — Checkbox unchecked 视觉修法（F001）

删 `src/components/ui/Checkbox.tsx:69` 的 `keepMounted` 属性。Indicator 在 unchecked-not-indeterminate 时直接 `return null`（base-ui 默认行为）。

**理由：** 当前无 transition 动画需求；`keepMounted` 仅在做淡入淡出动画时需要保留 DOM。删除后 Indicator span 在 unchecked 时不渲染 → "check" 字面字符不会出现 → 视觉正确。

**测试 gap 修复：** 现有 5 case 全跳过 unchecked-not-indeterminate 视觉路径。F001 必加 ≥2 case：
- "renders no glyph when unchecked-not-indeterminate"：`expect(container.textContent).not.toContain('check')` `.not.toContain('remove')`
- "removes glyph when transitioning checked→unchecked"：rerender from `checked={true}` → `checked={false}`，glyph 消失

### D2 — `{{date}}` token 加入 SubstituteVariables（F002）

**SubstituteVariables interface 扩展（`src/lib/email/variable-substitute.ts:14`）：**

```ts
export interface SubstituteVariables {
  kol: { name: string; handle?: string | null };
  product: { name: string; category?: string | null; usp?: string | null };
  marketer: { name: string };
  date: string;     // 新增 — ISO yyyy-mm-dd 格式（不含时分秒，避免抄送看到完整时间戳冗长）
}
```

**`resolve()` 函数已支持嵌套路径**（line 26-37 `path.split(".")`）→ `{{date}}` 0 级访问无需改动 resolve 逻辑。

**调用方传值（`src/lib/email/composer-data.ts` 或 batch-send.ts 实际渲染处）：**
```ts
const date = new Date().toISOString().slice(0, 10);  // yyyy-mm-dd
substituteSubjectAndBody(template, { kol, product, marketer, date });
```

**KB AI prompt 同步更新（`src/lib/products/generateAiAssets.ts`）：** D1 段落添加 `{{date}}` token 项：

```
- {{date}} for the current date (formatted as yyyy-mm-dd, e.g. 2026-05-04)
```

**Backfill 1 行残留（Clash Royale — Signing invitation）：** 走 `updateAsset` mutation，content body/subject 替换 `[DATE]` → `{{date}}`，自动同步 dualWrite 到 email_template。可独立 SQL ops，但**为遵守 v0.9.9 铁律 5 必走 mutation 路径**（虽仅 1 行，原则不让步）。

### D3 — Server-side AI 输出 validation 兜底（F003，v0.9.9 §3 落地）

**位置：** `src/lib/products/generateAiAssets.ts` `parseAndValidate` 函数后追加 placeholder 验证步骤。

**算法：**
```ts
function validateNoBracketPlaceholders(parsed: ProductAiAssetContent): void {
  // 检测 [Creator Name] [Your Name] [KOL Name] [DATE] 等方括号 placeholder
  const BRACKET_RE = /\[[A-Z][a-zA-Z ]+\]/g;
  const MUSTACHE_RE = /\{\{[a-z][a-zA-Z0-9_.]+\}\}/g;
  const allText: string[] = [];
  for (const e of parsed.emailTemplates) { allText.push(e.subject, e.body); }
  for (const v of parsed.videoScripts) { allText.push(v.title, v.script); }
  
  for (const text of allText) {
    const brackets = text.match(BRACKET_RE) ?? [];
    const mustaches = text.match(MUSTACHE_RE) ?? [];
    if (brackets.length > 0 && mustaches.length === 0) {
      throw new AiPlaceholderViolationError(
        `AI output uses bracket placeholders (${brackets.slice(0,3).join(', ')}) but no Mustache tokens — prompt regression`
      );
    }
  }
}
```

**新错误类 `AiPlaceholderViolationError extends Error`** 在 generateAiAssets.ts 内定义，导出。

**生成流程接入（`generateAiAssets`）：**
```ts
const parsed = parseAndValidate(raw);
validateNoBracketPlaceholders(parsed);   // 新增 — 验证失败抛错
// 后续 createAsset / Product.update 走原路径
```

**catch 处理：** generateAiAssets 已有 try/catch 调 writeFailure → status='failed' + audit。AiPlaceholderViolationError 落入此 catch 路径自然处理。**不 retry**（spec D3 简化决策；v1.0 候选可加 1 次 retry）。

**测试要求（unit）：**
- mock fetch 返回含 `[Creator Name]` 但无 `{{}}` → 断言 createAsset 不被调用 + Product.aiAssets.status='failed' + audit log 含 'placeholder_violation' 或类似关键词
- mock fetch 返回正常 mustache → createAsset 调用 5 次，与现有 case 行为一致

### D4 — /assets i18n 完整接入（F004）

**5 messages 文件**（en/zh/ja/ko/es）添加 `assets` 命名空间。规模参照 `knowledgeBase`（zh.json 1068 chars），预估 1500-2500 chars/语言。

**Key 结构（assets 命名空间 schema）：**

```json
"assets": {
  "page": { "title": "Assets", "actionBar": { ... } },
  "filters": { "all": "All", "type": "Type", "status": "Status", "source": "Source", "sort": { "recent": "Recent", "name": "Name", ... } },
  "sources": { "ai_generated": "AI Generated", "user_created": "User Created", "imported": "Imported", "system_seed": "System" },
  "types": { "email": "Email", "video_script": "Video" },
  "statuses": { "draft": "Draft", "published": "Published", "archived": "Archived" },
  "tabs": { "preview": "Preview", "edit": "Edit", "used_in": "Used in" },
  "wizard": { "title": "Generate asset", "step1": { ... }, "step2": { ... }, "step3": { ... }, "buttons": { ... } },
  "card": { "quickActions": { ... } },
  "welcome": { "banner": { ... }, "emptyState": { ... } },
  "toasts": { "duplicated": "Duplicated", "archived": "Archived", "deleted": "Deleted", "saveFailed": "Save failed" },
  "errors": {                                                              // ← Q2 决策 B：含 actions.ts 错误码
    "unauthorized": "...", "validation": "...", "asset_not_found": "...",
    "product_not_found": "...", "parent_not_found": "...", "ai_config": "...",
    "ai_timeout": "...", "ai_response": "...", "ai_parse": "...",
    "internal": "...", "content_invalid": "...", "depth_exceeded": "..."
  }
}
```

**翻译策略：**
- **en + zh：** Generator 手填地道翻译（中英文都熟）
- **ja / ko / es：** Generator 用 LLM 批量翻译（claude-haiku-4.5 / 等），每个文件顶部注释 `<!-- BL-033-F004 machine-translated, 待 BL-014 人工审核 -->` 标记低质量
- **next-intl fallback：** 不依赖 — 5 语言全填，避免显示 raw key 字符串

**重构范围（src/app/[locale]/(app)/assets/）：**
- **AssetsClient.tsx** 1942 行 — 替换 ~60+ 硬编码字面（含 SORT_OPTIONS / TYPE_OPTIONS / STATUS_OPTIONS / SOURCE_OPTIONS 数组的 label 字段 + 所有 setStatusMessage 字面 + Wizard 三步标题 / 按钮 / 提示 + 空状态文案 + aria-label / placeholder）
- **_panel/EditTab.tsx** — 替换 3 处
- **_panel/UsedInTab.tsx** — 替换 1 处

**actions.ts 错误码联动（Q2=B）：** AssetsClient.tsx 处理 `result.code` 时 `t(\`assets.errors.\${result.code}\`)` 替代字面错误信息（actions.ts 服务端不动 — 仍返回结构化 code，UI 端做 i18n 映射）。

**禁止：**
- 不动 actions.ts 服务端 error message（用户不可见，logs 用）
- 不动 generators/email-generator.ts / video-script-generator.ts 内部 prompt（语言中性）
- 不重生 visual baseline（Q4=B 决策）

---

## 3. Files

**修改：**
- `src/components/ui/Checkbox.tsx`（F001 — 1 行删 keepMounted）
- `src/components/ui/__tests__/Checkbox.test.tsx`（F001 — 加 ≥2 unchecked 视觉 case）
- `src/lib/email/variable-substitute.ts`（F002 — interface 加 date 字段，本身 resolve 函数不需改）
- `src/lib/email/__tests__/variable-substitute.test.ts`（F002 — 加 case 覆盖 `{{date}}` 替换）
- `src/lib/email/composer-data.ts` 或实际 substitute 调用方（F002 — 传 date string）
- `src/lib/products/generateAiAssets.ts`（F002 prompt 加 `{{date}}` 选项 + F003 placeholder validation）
- `src/lib/products/__tests__/generateAiAssets.test.ts`（F003 — placeholder validation 单测）
- `src/app/[locale]/(app)/assets/AssetsClient.tsx`（F004 — i18n 重构）
- `src/app/[locale]/(app)/assets/_panel/EditTab.tsx`（F004）
- `src/app/[locale]/(app)/assets/_panel/UsedInTab.tsx`（F004）
- `messages/en.json` / `messages/zh.json` / `messages/ja.json` / `messages/ko.json` / `messages/es.json`（F004 — 加 assets 命名空间）
- 现有 `src/app/[locale]/(app)/assets/__tests__/*.test.tsx`（F004 — fixture 改用 i18n key 或 mock useTranslations）

**新增：** 无（不新建脚本：F002 backfill 1 行，由 Planner SSH prod 跑等价 SQL via updateAsset 不值得开脚本；或 Generator 提供一次性 SQL 注释入 spec §5 部署顺序）

---

## 4. 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F001 删 keepMounted 影响其他测试快照 | low | low | grep usage 已确认仅 OutreachComposer 用 Checkbox；既有测试 1+2 不需改 |
| F002 `{{date}}` 在历史 substitute 调用方未传 date 字段 → 渲染空字符 | medium | medium | TypeScript interface 改严，编译期捕获所有调用方未传 date 的位置；compiler 必报错 |
| F003 真 AI 偶尔合法用 `[brackets]` 在 marketing 文案（如 [Press Release]）误报 placeholder | low | medium | 正则 `\[[A-Z][a-zA-Z ]+\]` + 同时无任何 `{{}}` 才报；正常 mustache 文案不报；F003 测试加 case 验证「文中含 [Press] 但有 {{kol.name}}」不误报 |
| F004 ja/ko/es 机器翻译质量差 | high | low | 文件顶部注释标记 + BL-014 backlog 已含人工审核任务；本批次仅保 fallback 不显 raw key 即可 |
| F004 重构 AssetsClient 1942 行触发既有测试 break | medium | medium | __tests__ 既有 case 必同步更新；测试用 vi.mock('next-intl') 返回 identity function (key→key) 简化 |
| F004 i18n key 命名漂移 | low | low | spec §D4 schema 已锁，按结构填写 |

---

## 5. 部署顺序（用户操作）

1. BL-033 done + Reviewer 签收
2. GitHub Actions → Deploy to Production → main
3. **F002 backfill：** SSH prod 跑（spec §5.1 SQL）
4. 浏览器 prod 三验：
   - /zh/outreach Send Test → 收件箱内容含 `Hi <KOL名>` + 落款 `<Marketer名>` + 当前日期（如 `2026-05-04`）
   - /zh/outreach KOL 表 unchecked checkbox 视觉无 ✓
   - /zh/assets 全 UI 中文（含 toast / Wizard / 错误信息）
5. 报回，Planner done 收尾

### 5.1 F002 [DATE] backfill（1 行，由用户或 Planner 跑）

```bash
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix
# 走 updateAsset mutation 而非 raw SQL（v0.9.9 铁律 5）
node_modules/.bin/tsx -e "
import { withTenant } from '@/lib/db';
import { updateAsset } from '@/lib/assets/mutations';
const TENANT = '<find from prod>';  // Generator handoff 时给出实际 tenantId
const ASSET_ID = '<find from prod>';
await withTenant(TENANT, async (tx) => {
  const existing = await tx.asset.findUnique({ where: { id: ASSET_ID }, select: { content: true } });
  const c = existing.content;
  c.body = c.body.replace(/\[DATE\]/g, '{{date}}');
  c.subject = c.subject.replace(/\[DATE\]/g, '{{date}}');
  await updateAsset(tx, ASSET_ID, { content: c });
});
"
```

或最简：Generator 在 F002 acceptance 中承诺扩展 `convert-bracket-tokens-to-mustache.ts` 脚本加 `[DATE]` 映射 → `{{date}}`，prod 重跑脚本即可（推荐）。

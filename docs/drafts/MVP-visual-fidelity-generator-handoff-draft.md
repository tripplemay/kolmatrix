# MVP-visual-fidelity-hotfix · generator_handoff 草案

> **草案用途：** BM2 done 后，Planner 切 status=planning → building 时，将本文档内容写入 progress.json `generator_handoff` 字段。
> **起草时间：** 2026-04-26（BM2 reverifying 期间并行准备）
> **起草者：** Kimi (Planner)
> **生效条件：** BM2 全 PASS done 后立即采用，BM2 fixing 期间本草案不动。

---

## 0. 前置已完成清单（不要重做）

**F001 公共组件库已落地于 BM2 F006 前置 commit 链：**
- `src/components/ui/`：Button / Input / Select / Dialog / Table / Checkbox + barrel index.ts（6 atoms）
- `src/components/common/` 已补：ChipButton / StatusBadge / RingProgress / Sparkline；StatCard 既有
- `src/components/ui/__tests__/` 6 文件 unit test 全绿
- `src/components/common/__tests__/` 16 文件全绿
- 设计审计：`docs/specs/hotfix-f001-component-library-preimpl-audit.md` §8 Planner 事后裁决全 A 采纳

**视觉基线基础设施（BM2 F011-001 fix-round 1 沉淀）：**
- 12 张 baseline PNG 已入 git（dashboard + en-* 11 张）
- CI E2E 已拆为两步：fresh-seed visual-first + 全套 grep-invert visual
- seed deterministic 已就绪（`prisma/seed.ts` 用 `Date.UTC(2026,3,26)` 固定 epoch + LCG PRNG 替换所有 Math.random）
- visual spec `shouldSkipMissingBaseline` 检查 `testInfo.config.updateSnapshots` 不再永远 skip
- maxDiffPixels 8000（discovery 例外 viewport-only）
- update-visual-baselines workflow `mkdir -p tests/screenshots/baseline` defensive

**回归测试守门员（BM2 F011-001 沉淀，必须保持绿）：**
- `tests/unit/prisma-seed-chain.test.ts` 守 `seedSystemTemplates()` 链调
- `tests/unit/codex-wait-script.test.ts` 守 codex-wait.sh 接受 3xx
- `tests/unit/campaign-detail-rsc-boundary.test.ts` 守 transitionTo `Record<string,string>` 不能是函数
- `tests/unit/nav-config.test.ts` 守 NAV_ITEMS hrefs + deriveActiveNav 路由映射

---

## 1. 执行顺序

```
F001 残余（BL-010 + README + grep 替换清单 ~1.5h）
  └── F002 /discovery 重写  ← 推荐起手（影响面小，验证组件库 API）
       └── F003 /database 重写  ← Bulk Action Bar 较重
            └── F004 /campaigns 列表  ← KPI strip 简单
                 └── F005 /campaigns/:id 详情  ← 2-col + chart 最重，CampaignKolPanel 495 → 250 行
                      └── F006 /kols/[id] 轻度  ← 只改 className 密度
                           └── F007 baseline 重捕 + CI 验证
```

**串行推进（不并行）**：Generator 单线程，避免上下文切换；F005 完成后 grep `INPUT_CLASS|CHIP_BASE` 应返回零或 < 5 处。

---

## 2. 关键约束（BM2 教训沉淀，必须遵守）

### 2.1 E2E resilience 4 条铁律（BM1 F009 + BM2 F011 沉淀）

1. **禁用 `page.waitForLoadState('networkidle')`**：用 `expect(locator).toBeVisible({timeout:15000})` 替代
2. **不硬编 seed-dependent count**：用 regex 或 `>0` 断言，例 `expect(rows).toHaveCountGreaterThanOrEqual(1)` 而非 `toHaveCount(10)`
3. **revalidate 后 polling 15s**：mutation 后 `revalidatePath` 异步生效，断言用 polling 替代 `waitForTimeout`
4. **login redirect locale-prefixed regex**：`expect(page).toHaveURL(/\/(en|zh|ja|ko|es)\/login/)` 而非 `toHaveURL('/login')`

### 2.2 RSC → Client 函数 prop 禁令（BM2 F011 教训）

Server Component 不得传 function 给 Client Component，**所有 transition mapping 用 `Record<string, string>` 静态对象**：

```tsx
// ✘ 违规
<ClientComp transitionTo={(next: string) => { /* ... */ return computed }} />

// ✔ 合规
<ClientComp transitionTo={ {pending: 'contacted', contacted: 'quoted'} } />
```

测试守 `tests/unit/campaign-detail-rsc-boundary.test.ts` 静态源码 grep；F005 重写 CampaignKolPanel 时必须保持。

### 2.3 saveKol / 状态变更同时 revalidate 关联路由

任何 mutation 影响多个页面缓存时，必须在 Server Action 末尾全部 revalidate：

```ts
'use server'
export async function saveKol(...) {
  await db.kol.update(...)
  revalidatePath(`/${locale}/discovery`)
  revalidatePath(`/${locale}/database`)  // ← 不能漏
  revalidatePath(`/${locale}/kols/${id}`) // ← 不能漏
}
```

### 2.4 className 硬编码上限（ui-fidelity-guardrail.md §4.3）

每页面文件 `className="..."` 硬编码 ≤ 20 处；超过先抽到公共组件再继续。grep 命令：

```bash
grep -c 'className="' src/app/[locale]/\(app\)/discovery/page.tsx  # 应 < 20
```

### 2.5 幽灵控件零容忍（ui-fidelity-guardrail.md）

任何 checkbox / button / select 必须有 handler 或显式 `disabled` + tooltip。grep 检查：

```bash
grep -nE '(checkbox|button|select)' src/app/[locale]/\(app\)/database/page.tsx | xargs -I {} echo {}
# 人工核每个控件的 onClick / onChange / disabled 状态
```

---

## 3. 设计参考使用规则（ui-fidelity-guardrail.md §1.1）

**主参照物 = HTML 浏览器渲染**，不是 PNG 缩略图：

```bash
# 在两个浏览器窗口并排打开
# 左窗口：file:///Users/yixingzhou/project/joyce/design-draft/stitch-references/kol-discovery.html
# 右窗口：http://localhost:3000/en/discovery（dev）or staging URL
```

`design-draft/stitch-references/*.png` 是 512px 缩略图（Stitch 导出限制），**不能做像素级 fidelity 判断**。

**长期方案（F001 残余 BL-010 并入）：** 跑 `npm run render:stitch-previews` 生成 `design-draft/stitch-references/renders/<page>-1920.png` 入 git，作为设计稿高清归档。

---

## 4. 各 feature 关键提示

### F001 残余（~1.5h）

- **BL-010 render-stitch-previews 脚本：** 用 `playwright` headless chromium 1920×1200 viewport；遍历 `design-draft/stitch-references/*.html` 18 个；输出到 `design-draft/stitch-references/renders/`；外部 CDN 资源（Tailwind / Material Icons / fonts）用 `waitForLoadState('domcontentloaded') + 显式 image complete 等待` —— **禁用 `'networkidle'`**（同 §2.1 教训）
- README 写 ui/ 6 atoms + common/ 新增 4 业务组件 props 表

### F002 /discovery（~0.5-1d）

- 起手 grep 现有 className 密度作为 baseline，重写后再 grep 确认下降
- AI Smart Match CTA 用 `<Button variant="primary-gradient">` 直接复用 `gradient-cta` Tailwind class（与 BM1 F007 dashboard 视觉一致）
- xl:grid-cols-4 不要因为 1280×720 viewport 就降到 3；保 xl 断点 4 列

### F003 /database（~1d，最重）

- Bulk Action Bar：选中行用 `useState<Set<string>>`；'Add to Campaign' Dialog 用 `<Dialog>` 真接 `POST /api/campaigns/:id/kols/bulk`（新建 endpoint，body: `{kolIds: string[]}`，事务内 upsert + audit_log `kol.bulk_added_to_campaign`）
- Insights Panel Coverage Gap 卡硬编 'No data yet, coming in B6'（不 mock 假数据）
- Email bulk button 改 disabled tooltip：'Use /outreach for email campaigns'（BM2 F006 已实装 outreach 流，引导用户跳转）

### F004 /campaigns 列表（~0.5-1d）

- Reply Rate KPI：BM2 F006 EmailLog.status='replied' 已存在，可真算（`COUNT(replied) / COUNT(sent)`）；如本租户无邮件 → 硬编 '—'
- Reach Forecast：`Σ Kol.followers WHERE Kol.id IN (KolCampaign WHERE Campaign.status='active')`
- AI Suggestions panel 跳 /discovery 用 `<Link href="/discovery">`

### F005 /campaigns/:id 详情（~1-1.5d，最复杂）

- **CampaignKolPanel 495 → ≤250 行硬要求**：抽 modal 到 `<Dialog>`、抽表格到 `<Table>` + `<TRow>`、抽 contactStatus dropdown 到 `<Select>`
- Email Performance chart：用 `recharts` LineChart，data 从 `EmailLog WHERE campaignId=:id` GROUP BY date(contactedAt)
- Activity Timeline：`audit_log WHERE entityType='campaign' AND entityId=:id ORDER BY createdAt DESC LIMIT 10`
- Campaign Health 卡：spend rate = `spendTotal / budgetAmount`；days to closeout = `endDate - now()`
- AI Suggestions 静态文本：`Send to ${uncontactedCount} uncontacted KOLs`（uncontacted = `KolCampaign.status='pending'`）
- **RSC boundary 守门：** transitionTo 用 `Record<string, string>`（§2.2）

### F006 /kols/[id]（~0.5d，最轻）

- 不全量重写，只替换 className 密度 > 20 的部分
- 4 tabs Overview 真数据保持；Collabs/Contacts/AI 3 tab 加 `<EmptyState message="..." />`（如无 EmptyState 组件，临时用 `<GlassPanel>` 包文案）
- 新增 baseline `en-kols-detail.png`，URL `/en/kols/demo-kol-001`（seed 必有此 KOL，确认 `prisma/seed.ts` 含 demo-kol-001）

### F007 baseline 重捕（~0.5d）

- **不在本地跑 `--update-snapshots`**（WSL 无 sudo 装 Playwright deps）
- 走 GitHub Actions `update-visual-baselines.yml` workflow 触发，结果 PR 自动入 git
- 重捕清单：discovery / database / campaigns / campaign-detail / kols-detail（5 张）+ dashboard 视样式变化决定
- discovery 保持 viewport-only（per BM2 F011-001 fix-round 1，hydration async race 长期根因待查 → backlog 未关）
- 其他 11 张维持 fullPage

---

## 5. Planner 并行待办（hotfix building 期间）

不启动新批次。候选准备工作：

- **BIx-staging-automation 批次** spec 起草：BL-001 + BL-002 + BL-004 三件打包（staging deploy shell 脚本 + GIT_SHA 修复 + dotenv 自动加载）
- **Post-MVP roadmap 校准**：根据 hotfix 实际工时回看 docs/specs/roadmap.md 各批次估时
- **BL-012 KOL crawler sync** 答复爬虫团队 §11 10 条开放问题（用户接口）

---

## 6. MVP 时间线（hotfix 起算）

| 批次 | 估时 | 累计预期完成 |
|---|---|---|
| MVP-visual-fidelity（本批次） | 5-6 day | ~2026-05-02（hotfix 起算 4-26） |
| 种子用户 demo 准备（用户自测 + 手动 smoke） | 2-3 day | ~2026-05-05 |
| **MVP 正式可上线** | — | **~2026-05-05**（比原估 2026-05-14 早 ~9 天，因 BM2 提前完成） |

---

## 7. 启动检查清单（Planner 切 building 前必核）

- [ ] BM2 status = done（reverifying PASS）+ signoff 入 git
- [ ] 用户口头确认启动 hotfix（角色分配确认：planner=Kimi / generator=johnsong / evaluator=Reviewer 沿用）
- [ ] features.json 用本草案 `cp docs/drafts/MVP-visual-fidelity-features-draft.json features.json`
- [ ] 删除 `_draft_meta` 字段（草案专用，正式 features.json 不需）
- [ ] progress.json 切 sprint=MVP-visual-fidelity-hotfix / status=building / total_features=7 / completed_features=0 / fix_rounds=0
- [ ] reference_docs 数组替换为 hotfix 相关：spec / hotfix-f001 audit / ui-fidelity-guardrail / pre-impl-adjudication / database-patterns / harness-rules / backlog
- [ ] 提交 commit 'chore(state): MVP-visual-fidelity-hotfix planning → building，executor 启动'

---

**草案就绪，等 BM2 done 信号。**

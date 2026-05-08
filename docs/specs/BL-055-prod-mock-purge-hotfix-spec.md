# BL-055 prod-mock-purge-hotfix Spec

> 6 个 prod 用户可见 mock / placeholder / hydration 闪现 bug 一并修复。Bug 修复批次（无新功能），spec 软性要求但本次起草以保留 audit trail + Generator 实装依据。
>
> - **Spec 起草日期：** 2026-05-08
> - **Spec 作者：** Planner johnsong
> - **批次类型：** 普通批次（全 generator features，bug 修复 + UI mock 清理）
> - **状态：** Locked → Building（features.json F001-F007）
> - **插队原因：** 用户 5/8 反馈 6 个 prod 可见 bug，5/13 上线对外前必须闭合
> - **关联：** 暂停 BL-012-apify-kol-integration（Stage 1 ops 仍可由用户协调爬虫团队进行 — Stage 2 KOLMatrix 端 Generator 工作切到 BL-055）；BL-055 done 后恢复 BL-012 building（features 备份 `docs/specs/BL-012-features-pre-hotfix.json`）

---

## 1. 背景与目标

### 1.1 触发

用户 2026-05-08 在 prod redeploy 完成（@ commit `2287d8a` 5/8 01:13）后实地观察到 6 个用户可见 bug，连续反馈：

| # | 症状 | 用户感知 |
|---|---|---|
| 1 | 每次页面刷新顶部瞬间显示红色横条 + "wifi_off 网络已断开" | 视觉抖动 + 字面字符串泄露 + 不专业 |
| 2 | /outreach templates tab badge 永远显示 10 | 假数据，与真实 EmailTemplate 数量不一致 |
| 3 | /knowledge-base 底部"最近 AI 活动" 5 条全 mock + 全显示 "2.1 Credits" | 假数据，与真实 ai_generated assets 无关 |
| 4 | /roi AI 洞察某些条目图标显示为字面字符串"lightbulb"（实地审计同源还有 /database AI 洞察 + NetworkStatusBanner） | Material Symbols subset 漏字 |
| 5 | sidebar logo 下方 "Neural Velocity" mock 文字 | Stitch 设计稿模板代号残留，非产品 tagline |
| 6 | topbar 警报铃铛永远显示黄点 | 假未读通知数 |

### 1.2 业务目标

1. **5/13 上线对外前 prod 假数据 / 视觉抖动 / 字面字符串清零** — 任何外部客户首次接触不应感知 mock
2. **保持长期治本路径** — 短期清理（删 mock）+ 长期跟踪（BL-056 notifications 真化）+ framework 改进候选（BL-054 material-symbols-coverage.test.ts grep 模式扩展）
3. **不引入新业务功能 / 新 schema** — 仅清 mock + 修 hydration + 加 manifest

### 1.3 用户决议（5/8 lock）

| 决议项 | 选择 | 来源 |
|---|---|---|
| #1 修复方向 | A. NetworkStatusBanner mount-flag | 5/8 用户决议 |
| #1 状态机处理 | i. 独立 BL-055 hotfix batch | 5/8 用户决议（"不要立即安排，我还有新的问题需要反馈，我想一起修"） |
| #2 修复方向 | B. async fetch real count + 删 stale tooltipKey | Planner 推荐默认 lock |
| #3 修复方向 | A. 删 section（推荐） | Planner 推荐默认 lock（本批次省工时优先） |
| #4 修复方向 | B+. manifest 增 4 删 5 + 重生成 woff2 | Planner 推荐默认 lock |
| #5 修复方向 | 1=B（中文 tagline）+ 2=c（含 i18n 5 locale） | 5/8 用户决议 |
| #5 i18n 策略 | a.i. i18n + 5 locale 多语言 | Planner 默认 lock（与项目 next-intl 一致） |
| #5 5 locale 文案 | LLM 候选（zh/en 用户已示例 + ja/ko/es LLM）— Generator 开工前 5sec 用户最后确认 | Planner 默认 lock + spec §10 列文案 |
| #6 修复方向 | A. layout.tsx:36 改 0 + TODO 注释 | 5/8 用户决议 |
| #6 长期跟踪 | BL-056 加入 backlog ✅ @ commit `54e6648` | 5/8 用户决议 |

### 1.4 范围边界

**本批次包含：**
- NetworkStatusBanner.tsx 加 mount-flag 防 hydration flash
- OutreachTabs.tsx templates tab badge 改 async + 删 stale tooltipKey
- knowledge-base/page.tsx 删 RECENT_AI_ACTIVITY mock section（含 ActivityChip 函数 + 5 locale i18n keys 清理）
- Material Symbols subset manifest 增 4（lightbulb / insights / wifi / wifi_off）+ 删 5 dead（compare_arrows / folder_open / more_vert / restart_alt / restore）+ 重生成 woff2
- SidebarLogo.tsx + layout.tsx description + 5 locale messages 替换 Neural Velocity mock 为产品 tagline
- layout.tsx:36 unreadNotifications=1 改 0 + TODO(post-MVP) 注释
- L1 全套 + visual regression baseline 抓

**本批次不包含：**
- notifications 真化系统（BL-056 跟踪，post-MVP）
- material-symbols-coverage.test.ts grep 模式扩展（BL-054 sub-feature 候选）
- 代码注释 / token 命名中 "Neural Velocity" 字符串保留（无害，不影响用户）
- 真化 RecentActivity（dashboard `RecentActivityCard` + knowledge-base 的 RECENT_AI_ACTIVITY 一并真化属未来批次）
- design token 重命名（Neural Velocity tokens 在 globals.css 注释中保留作内部代号）

---

## 2. 关键设计决策

### 2.1 hotfix batch 切批次审计

- BL-012-apify-kol-integration 当前 Stage 1 ops 用户在协调爬虫团队 + 部署 service（KOLMatrix 端 Generator 未启动）→ 不冲突
- BL-012 features.json 已备份到 `docs/specs/BL-012-features-pre-hotfix.json`（7 features F001-F007 generator）
- BL-055 done 后 Planner 收尾时恢复 BL-012 features.json + progress.json 切回 BL-012 building
- 5/13 上线时间线无影响（BL-055 ~3.5h Generator + ~1h Reviewer = ~5h end-to-end，5/8 当天可 done；BL-012 Stage 1 ops 5/8-5/9 用户协作完成；BL-012 Stage 2 building 5/14+）

### 2.2 #1 双重根因协同修复

hotfix #1 NetworkStatusBanner 闪现实际有 2 重根因：
- (a) Hydration mismatch + Chromium 浏览器 onload 前 navigator.onLine 假性 false → F001 mount-flag 修
- (b) Material Symbols subset 漏 wifi_off + wifi → F004 manifest 加 修

两个 feature 协同闭合 #1 完整 bug — F001 + F004 同 commit 提交。

### 2.3 #4 audit 完整性铁律 1 v0.9.14 应用

audit 全仓 grep 完整 pattern 后发现：
- `lightbulb` 漏（用户报告 /roi）
- `insights` 漏（新发现 /database 同源）
- `wifi` + `wifi_off` 漏（与 #1 关联同元素）
- 5 dead entries（hygiene）

不 follow v0.9.14 完整 pattern 模式 grep → 仅修单点 lightbulb 会留 insights / wifi / wifi_off 3 个潜在 bug 漏抓。

### 2.4 #5 i18n + 5 locale 翻译策略

- SidebarLogo.tsx 改 server component 拉 i18n（`getTranslations("common.brand")`）+ 5 locale messages 加 `common.brand.subtitle` key
- layout.tsx:30 description 改用 `getTranslations("common.brand")` 在 metadata 函数内，但 Next.js metadata 字段不直接接 server function — 需要用 generateMetadata 函数 + locale param
- 5 locale 文案见 §10（Planner 默认 LLM 候选，Generator 开工前 5sec 用户确认）

### 2.5 #6 短期最小改动 + 长期 BL-056

- layout.tsx:36 `unreadNotifications={0}` 一行改即可
- 加 TODO(post-MVP) 注释引用 BL-056 跟踪
- NotificationBell 组件保留（按钮 / 黄点逻辑均不删，仅当前数据源传 0）

### 2.6 acceptance 边界（v0.9.16 P5.2 应用）

本批次 acceptance 不含全套 `npm run test:integration` 普遍绿门槛。`pre-commit-hook.test.ts` flaky 已 BL-054 治理，pre-impl audit 时不计入本批次评分。Reviewer 验收只看 BL-055 引入测试 + spec acceptance 表逐项 + visual regression baseline + 6 hotfix 用户报告症状全消失。

---

## 3. 6 hotfix 详细根因分析（缩略，详 Planner-用户对话历史）

### Hotfix #1 NetworkStatusBanner hydration flash

`src/hooks/useNetworkStatus.ts:25-38` 的 `readInitial()` 在客户端读 `navigator.onLine` 实际值。Chromium-based 浏览器在 `load` 事件前的某个窗口期 `navigator.onLine` 短暂返回 `false`，导致 React hydrate 时 isOnline 初始 false → banner 渲染（与 server HTML 无 banner 不一致）→ React 19.2 prod silent fix client wins → DOM 显示红 banner → 浏览器网络栈完成初始化触发 'online' 事件 → setIsOnline(true) → banner 隐藏。

### Hotfix #2 templates tab badge=10 硬编码

`src/app/[locale]/(app)/outreach/OutreachTabs.tsx:21` BM2-F006 时期占位：

```tsx
{ id: "templates", badge: 10, tooltipKey: "comingB4" },
```

文件顶部注释明示 `Badge counts (24 / 87 / 142) are intentionally static placeholders` — BL-024-F004/F005 解锁 tracking + suppression 时移除了 badge，但 templates 解锁后**未同步移除 placeholder**。tooltipKey: "comingB4" 同样 stale（templates 已激活 link，不应有 "Coming in B4" tooltip）。

### Hotfix #3 knowledge-base RECENT_AI_ACTIVITY 整段 mock

`src/app/[locale]/(app)/knowledge-base/page.tsx:72-87` 整个 section + `ActivityChip` 函数（line 92-147）+ 5 locale i18n `mockActivity.heading{1-5}` / `time{1-5}` 字典 + ActivityChip 内 `2.1 Credits` 硬编码 — 完全没有 DB query。BM1 时期占位 mock，未替换为真实 audit_log / Asset query。

### Hotfix #4 Material Symbols subset 漏字

完整 audit 发现 4 missing：

| icon | 用法 |
|---|---|
| `lightbulb` | RoiInsightsPanel.tsx:140 + WeeklyReportInsightsPanel.tsx:90 (function fallback return) |
| `insights` | DatabaseInsightsClient.tsx:70 (function fallback return) |
| `wifi` | NetworkStatusBanner.tsx:65 (JSX 三元 online 分支) |
| `wifi_off` | NetworkStatusBanner.tsx:65 (JSX 三元 offline 分支) |

5 dead entries：`compare_arrows / folder_open / more_vert / restart_alt / restore`（manifest 列了但 src/ 不再用）。

### Hotfix #5 Neural Velocity mock

`SidebarLogo.tsx:14` 硬编码 + `layout.tsx:30` description + 5 locale `engineVersion` "KOLMatrix Neural Velocity Engine v4.2.0"。来源：Stitch 设计稿项目代号（`environment.md:21` 已记录），BM1 还原 sidebar UI 时抄入代码。

### Hotfix #6 topbar 铃铛假黄点

`src/app/[locale]/(app)/layout.tsx:36` 硬编码 `unreadNotifications={1}`。整个项目 0 notifications 基础设施（无 schema / lib / query / dropdown UI / 触发链路）。BL-056 跟踪长期真化。

---

## 4. acceptance 表（features.json F001-F007 简表）

详 `features.json`。每条 acceptance 必须 Reviewer 逐项验收 PASS。

| feature | 范围 | 工时 |
|---|---|---|
| F001 | NetworkStatusBanner mount-flag 防 hydration flash | ~30min G + 10min R |
| F002 | OutreachTabs templates badge async + 删 stale tooltipKey | ~40min G + 10min R |
| F003 | knowledge-base 删 RECENT_AI_ACTIVITY mock section + 5 locale 字典清理 | ~30min G + 10min R |
| F004 | Material Symbols subset manifest 增 4 删 5 + 重生成 woff2 | ~20min G + 10min R |
| F005 | Neural Velocity mock 替换为产品 tagline（5 处 + 5 locale i18n） | ~1.5h G + 20min R |
| F006 | layout.tsx:36 unreadNotifications=1 改 0 + TODO 注释 | ~10min G + 5min R |
| F007 | L1 全套验证 + visual regression baseline | ~30min G + 10min R |
| **合计** | — | **~3.5h G + ~1h R** |

---

## 5. 测试策略

### 5.1 单测扩展

- F001 NetworkStatusBanner.test.tsx：加 case "mount 阶段 ssr → null（不渲染 banner）"；既有 6 case 保留
- F002 OutreachTabs.test.tsx：加 case "templates badge=fetched count" + "templates link href ok 无 tooltipKey 残留"
- F003 knowledge-base/__tests__/actions.test.ts + ProductCard.test.tsx 验证（删 section 后页面渲染正常）
- F005 SidebarLogo.test.tsx：改 expect 含 i18n key 调用而非硬编码 "Neural Velocity"

### 5.2 集成测试

无新增（hotfix 范围不变更后端逻辑）；既有 IT 全 PASS。

### 5.3 visual regression baseline

F007 抓 4 baseline：
- NetworkStatusBanner online 状态（无 banner）
- SidebarLogo 中文 locale + 英文 locale（2 个）
- OutreachTabs（templates tab badge 真实数字）
- KnowledgeBase（删 mock section 后底部）

### 5.4 L1 全套

`npm run lint` 0 error / `npx tsc --noEmit` 0 error / `npm test` 1084+ tests 全 PASS（含本批次更新）/ `npm run test:integration` BL-052 引入 + 既有 PASS（pre-commit-hook flaky 按 v0.9.16 P5.2 划归 BL-054 不计入）。

---

## 6. 部署计划

### 6.1 staging deploy

F007 done 后 Generator SSH 落 staging（deploy-staging.sh）→ smoke `/api/health` + 6 hotfix 症状检验：
- /zh/dashboard 刷新 banner 不闪现 + 不显字面字符串 wifi_off
- /zh/outreach templates badge 显示真实 EmailTemplate 数量
- /zh/knowledge-base 底部无 "最近 AI 活动" section
- /zh/roi AI 洞察图标显示正确（trending_up / warning / lightbulb 都是 glyph）
- sidebar 中文环境显示新 tagline，不再是 Neural Velocity
- topbar 铃铛无黄点

### 6.2 prod deploy

Reviewer signoff PASS → 用户手动触发 prod deploy workflow（与 5/13 上线时间线协同）→ prod /api/health PASS + 6 hotfix 症状检验。

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| F004 重生成 woff2 文件改动大 | git diff 二进制冲突可能 | 确保 F004 同 commit 提交 manifest + woff2，不混入其他 feature commit |
| F005 i18n 5 locale 翻译质量 | ja/ko/es LLM 翻译可能不地道 | spec §10 标注 LLM 候选 + Generator 开工前 5sec 用户确认窗口 + BL-014 backlog 已记录 ja/ko/es native review 链路 |
| F002 templates count revalidatePath 范围 | revalidatePath 当前仅覆盖 `/[locale]/outreach/templates`，但 outreach 主页 OutreachTabs 不同步刷新 | F002 acceptance 含 grep `revalidatePath` 全仓 + 加 `/[locale]/outreach` 覆盖 |
| F001 mount-flag 影响 SSR-CSR 对齐 | 测试 mock useEffect 行为可能微调 | 既有 6 单测扩展含 mount 阶段 null 渲染断言，按 React 标准模式 |
| 切批次 BL-012 features 恢复风险 | BL-055 done 后 Planner 忘恢复 BL-012 features.json | progress.json session_notes 明示 + Planner done 流程 step 1 必检 + features 备份 docs/specs/BL-012-features-pre-hotfix.json |
| visual regression baseline 漂移 | F007 baseline 与现有 7 baseline 冲突 | 4 个新 baseline 在干净环境抓（先跑 lint+tsc+npm test 全绿后再 baseline） |

---

## 8. 完成判定（DoD）

- [ ] features.json F001-F007 全部 status=completed
- [ ] L1 全套 PASS：lint 0 / tsc 0 / 1084+ unit / targeted IT
- [ ] 6 hotfix 用户报告症状全部消失（staging smoke 验证）
- [ ] visual regression 4 baseline 已抓 + 既有 baseline 不破
- [ ] Reviewer signoff PASS（B+ 以上 / Readiness=Ready）
- [ ] prod redeploy 含 BL-055（用户手动触发）
- [ ] BL-055 done 后 Planner 收尾 step：
  - 恢复 features.json from `docs/specs/BL-012-features-pre-hotfix.json`
  - progress.json status: done → building / current_sprint: BL-055 → BL-012-apify-kol-integration
  - project-status.md 更新 BL-055 → DONE + BL-012 → BUILDING（恢复）

---

## 9. 不在本批次（Out of Scope）

- notifications 真化系统（BL-056 backlog 跟踪）
- material-symbols-coverage.test.ts grep 模式扩展（BL-054 候选 sub-feature）
- design token 重命名（Neural Velocity tokens 内部代号保留）
- dashboard `RecentActivityCard` 真化（一并真化属未来批次，与 #3 同主题但范围不同页面）
- ja/ko/es i18n native review（BL-014 backlog 跟踪，本批次用 LLM 候选）
- BL-012-apify-kol-integration Stage 1 ops（用户与爬虫团队协作，不阻塞 BL-055）

---

## 10. 5 locale 翻译候选（Generator 开工前 5sec 用户最后确认窗口）

`messages/{locale}.json` 加 `common.brand.subtitle`：

| locale | 候选文案 | 来源 |
|---|---|---|
| zh | "游戏 KOL 智能营销平台" | 用户 5/8 示例 |
| en | "Game KOL Marketing Platform" | LLM 候选 / 业界惯例 |
| ja | "ゲーム KOL マーケティングプラットフォーム" | LLM 候选（BL-014 native review 后续） |
| ko | "게임 KOL 마케팅 플랫폼" | LLM 候选（BL-014 native review 后续） |
| es | "Plataforma de Marketing de KOL para Juegos" | LLM 候选（BL-014 native review 后续） |

`messages/{locale}.json` `engineVersion` 同步替换：

| locale | 当前值 | 新值 |
|---|---|---|
| en | "KOLMatrix Neural Velocity Engine v4.2.0" | "KOLMatrix Engine v4.2.0" |
| zh | (检查 zh 文案) | "KOLMatrix 引擎 v4.2.0" |
| ja/ko/es | (检查) | LLM 候选 |

`src/app/layout.tsx:30 metadata.description`：

| 当前值 | 新值（推荐） |
|---|---|
| `"Neural Velocity — AI-driven KOL campaign command center"` | `"KOLMatrix — Game KOL Marketing Platform / 游戏 KOL 智能营销平台"`（双语 SEO 友好） |

**用户最后确认窗口：** Generator 开工前 5sec ack 上述候选，如有调整请明示，否则按 spec 默认值实装。

---

## 11. 长期跟踪（hotfix 后续治本）

- **BL-056** notifications 系统真化（5/8 已加 backlog @ commit `54e6648`）
- **BL-054** flaky-network-test-isolate（含 material-symbols-coverage.test.ts grep 模式扩展候选 sub-feature）
- **BL-053** edge-states-refactor（暂不立项，含 dashboard RecentActivityCard 真化候选）
- **BL-014** ja/ko/es i18n native review（本批次 §10 LLM 候选 5 locale 后续）

BL-055 done 后 Planner 收尾时整合 project-status.md 反映上述长期跟踪状态。

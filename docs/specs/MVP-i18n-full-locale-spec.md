---
name: MVP-i18n-full-locale
description: 5 语言全翻 hotfix - zh 补 59 处 + ja/ko/es 全翻 ~810 处 + html lang 修 + 翻译流程沉淀（用户选 C 方案）
status: draft
created_by: Kimi (Planner)
created_at: 2026-04-27
estimated_effort: 3 day（AI 辅助翻译 + 人工 review）
prerequisites:
  - hotfix done（已满足，58fa549）
  - aigcgateway 余额 ≥ $20（当前 $49.60，充足）
  - 用户确认翻译质量基准（见 §3 决策）
blocks:
  - MVP-prod-launch-smoke（建议 i18n hotfix done 后再 prod redeploy）
  - MVP-seed-demo-prep（demo 含未翻译 UI 体验差）
---

# MVP-i18n-full-locale — 5 语言全翻 hotfix

## 1. 背景与目标

用户 2026-04-27 报告："切到中文显示，控制台页面依然显示为英文"。Planner 调研发现 3 处根因：

1. **zh.json 漏翻 59 处**（dashboard 12 / auth 11 / discovery 9 / topbar 7 / outreach 5 / userMenu 3 / 等）
2. **ja/ko/es 各漏翻 ~812 处**（各 1076 leaves 中 ~75% 仍是 en 文本，从未翻译）
3. **`<html lang="en">` 硬编码**（root layout 不读 locale，影响 a11y + SEO）

**用户选 C 方案：5 语言全翻**（不降级 ja/ko/es 为 "Coming soon"），目标：

- 真正支持 PRD §11 锁定的 5 个 locale（en/zh/ja/ko/es）
- 用户切到任意语言看到的都是该语言完整 UI
- a11y 合规（html lang 正确）
- 翻译流程文档化 + AI 辅助脚本沉淀（未来加新键时可一键补翻）

**非目标：**
- 不做 marketing site 翻译（kolquest.com 独立工作）
- 不做错误 / 后端日志翻译（运维场景，留 en）
- 不做 PDF / 邮件模板自定义翻译（B4-extended 范围）
- 不做 CMS / dynamic content 翻译（DB 数据保持原文）

## 2. 范围（7 features）

### In Scope

1. **F001** — 翻译流程基础设施（aigcgateway Action + 翻译脚本 + 人工 review checklist）
2. **F002** — zh.json 补全 59 处
3. **F003** — ja.json 全翻 ~812 处
4. **F004** — ko.json 全翻 ~812 处
5. **F005** — es.json 全翻 ~812 处
6. **F006** — `<html lang>` 修 + 静态守门 tests
7. **F007** — i18n 翻译 runbook + Topbar 5 语言选择器全启用

### Out of Scope

- 错误消息 / Server log 翻译（保持 en，运维场景）
- 邮件模板用户自定义翻译（B4-extended）
- DB seed 数据翻译（用户自己的产品/KOL 数据）
- 未来新增 locale（仅扩 5 语言到全翻；新加第 6 语言独立批次）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| **翻译方式** | **AI 辅助批量翻译（aigcgateway）+ 人工 review** | 4 语言 ~2500 leaves；纯人工 5+ 天；纯 AI 风险大；混合最优 |
| **AI 模型选择** | **Claude Sonnet 4.6**（高质量，含上下文理解）| 模板/营销文案需要语调；Gemini Flash 便宜但 nuance 差 |
| **Action 设计** | aigcgateway 新建 `ui-i18n-translate` Action（input: source_text, target_lang, context, glossary; output: JSON 翻译） | Action 化 + 可复用未来加新键 |
| **批量粒度** | **按 section 翻译（section-by-section）** | 每 section 一次调用，traverse JSON 树；保 nested key 结构；上下文清晰 |
| **品牌词不翻译** | "KOLMatrix" / "AI" / "AIGC" / "API" / 平台名（YouTube/TikTok/Twitch/Bilibili/Instagram）保英文；提供 glossary | 保品牌识别度 |
| **变量保留** | `{name}` `{date}` `{count}` 等占位符**严格保留**（AI prompt 强约束） | 否则 t() 调用 fail |
| **HTML 标签保留** | `<accent>` `<br></br>` 等内联 HTML 保留 | 翻译文案含 HTML 嵌套 |
| **review 比例** | **100% 人工 review**（不允许 AI 直接 commit）| 翻译错误用户立见，零容错；可 spot check 但全文必须扫一遍 |
| **品牌语调** | **专业 / 简洁 / 轻友好**（参考 en.json 现有调性，dashboard greeting "Welcome back, {name}." → 中文 "{name}，欢迎回来。") | 保品牌一致性 |
| **zh 已翻部分处理** | **不重翻已翻部分，仅补 59 处**（避免 review 工作量爆炸） | 已翻部分用户已 OK |
| **静态守门** | 3 个 test：(a) 每 locale leaf == en leaf 数 = 0; (b) 占位符保留率 100%; (c) 无 hardcoded 英文字符串扫描（grep src/） | 防回退 + 防新增键漏翻 |
| **Topbar 语言选择器** | **5 语言全启用**（不 disable ja/ko/es） | C 方案核心交付 |
| **html lang fix** | root layout 改异步 + 接 params; locale layout 已 set request locale | 同时修 a11y |
| **新增键流程** | runbook 写明：加新键到 en.json → 跑 `npm run i18n:translate` 脚本 → AI 自动补 4 语言 → 人工 review | 沉淀流程，未来不再积累债 |

## 4. 功能列表

### F001 — 翻译流程基础设施

**实现：**

1. **新建 aigcgateway Action `ui-i18n-translate`**
   - input variables：`source_text`（JSON 子树）/ `target_lang`（zh/ja/ko/es）/ `context`（如 "dashboard greeting"） / `glossary`（品牌词 list）
   - model：claude-sonnet-4-6
   - prompt 模板：
     ```
     You are a professional UI translator for KOLMatrix, a global gaming KOL/KOC marketing platform.

     Translate the following UI strings from English to {target_lang}.

     STRICT RULES:
     1. Preserve ALL placeholders: {name}, {date}, {count}, etc. — do not translate them.
     2. Preserve ALL inline HTML: <accent>, <br></br>, <strong>, etc. — translate text inside, not tags.
     3. DO NOT translate brand terms: KOLMatrix, AI, AIGC, API, YouTube, TikTok, Twitch, Bilibili, Instagram, Facebook, Twitter, Discord.
     4. Tone: professional, concise, lightly friendly. Match the original English tone.
     5. Context: {context}
     6. Glossary (use these consistent translations): {glossary}

     Output ONLY valid JSON matching the input structure. No code fences, no commentary.

     Input JSON:
     {source_text}
     ```

2. **新建 `scripts/i18n-translate.ts`**：
   - 读 `messages/en.json`
   - 对比 `messages/{zh,ja,ko,es}.json` 找出未翻译 leaves
   - 按 section 分批调 aigcgateway Action
   - 写入对应 messages/{locale}.json（保留已翻译，仅填空白）
   - 输出 diff 报告（哪些 leaves 翻了 / 哪些保留）

3. **package.json 加 script：**
   - `"i18n:translate": "tsx scripts/i18n-translate.ts"`
   - `"i18n:translate:dry": "tsx scripts/i18n-translate.ts --dry-run"`（仅打印不写）

4. **glossary 文件：**
   - `docs/i18n/brand-glossary.json`：品牌词 + 5 语言对应翻译
   - 例：`{"KOL": {"zh": "KOL", "ja": "KOL", "ko": "KOL", "es": "KOL"}, "Campaign": {"zh": "投放活动", "ja": "キャンペーン", "ko": "캠페인", "es": "Campaña"}}`

**Acceptance：**
- `mcp aigcgateway create_action` 创建 ui-i18n-translate Action 成功
- `npm run i18n:translate:dry` 跑通且打印未翻译 leaves 清单
- glossary.json 含 ≥ 30 品牌词条目
- script 严格保留 placeholders + HTML tags（unit test 覆盖）

### F002 — zh.json 补全 59 处

**实现：**
- 跑 `npm run i18n:translate -- --target zh` 自动补 59 处
- 人工 review 全 59 处翻译，调整不通顺 / 文化不当之处
- diff commit `i18n(zh): fill 59 missing leaves (dashboard/auth/discovery/topbar/outreach/userMenu/etc)`

**Acceptance：**
- zh.json 与 en.json leaves 数完全一致
- 静态测试 `tests/unit/i18n-zh-coverage.test.ts`：`zh leaf == en leaf` 数 = 0
- 人工 spot check：dashboard greeting / topbar searchPlaceholder / userMenu profile/settings/signOut 中文正确

### F003 — ja.json 全翻 ~812 处

**实现：**
- `npm run i18n:translate -- --target ja`
- 人工 review 重点：长句通顺度 / 敬语级别 / 品牌词保留
- diff commit `i18n(ja): full translation (812 leaves)`

**Acceptance：**
- ja.json 与 en.json leaves 数一致
- 静态测试 ja-coverage 通过
- 用户 spot check ≥ 5 关键页（dashboard / discovery / database / campaigns / weekly-report）日文正确

### F004 — ko.json 全翻 ~812 处

**实现：** 同 F003，target ko

**Acceptance：** 同 F003

### F005 — es.json 全翻 ~812 处

**实现：** 同 F003，target es

**Acceptance：** 同 F003

### F006 — `<html lang>` 修 + 静态守门 tests

**实现：**

1. **修 `src/app/layout.tsx`** root layout：
   - 改 async + 接 `params: Promise<{locale?: string}>`（root 不一定有 locale）
   - 实际：root layout 用 `lang="en"` 是正确的，因为它不在 [locale] 下；真正的 lang 应在 `[locale]/layout.tsx` 设
   - 修复方案：root layout 移除 `<html>` `<body>`（让 [locale]/layout 渲染）
   - **注意：** 这是 Next.js App Router 的常见问题；root layout 必须有 html/body，但子 layout 不能再有 html/body
   - 解决：root layout 保留 html/body，但 lang 设 "en" 作为 fallback；[locale]/layout 用 React Server Components 在 head 注入 lang via metadata 或 wrapping

   **更准确的修复（待 Generator 确认）：**
   - 把 `<html>` `<body>` 移到 [locale]/layout.tsx
   - root layout 改成"占位 wrapper"或者直接 return children（next 16 支持？需查）
   - alternative: root layout 用 client-side useEffect 同步更新 document.documentElement.lang（hack）

2. **静态守门 tests（3 个）：**
   - `tests/unit/i18n-coverage-{zh,ja,ko,es}.test.ts`：4 个 test，每个验证 locale leaf == en leaf 数 = 0
   - `tests/unit/i18n-placeholders.test.ts`：所有 locale 的 leaves 中 `{xxx}` 占位符与 en 一一对应
   - `tests/unit/no-hardcoded-english.test.ts`：grep src/components/ + src/app/ 中的 React 组件，检测明显英文字符串（如 `<span>Dashboard</span>`），白名单内除外

**Acceptance：**
- `<html lang="zh">` 在 /zh/* 路由 + en 在 /en/* 路由 + ja/ko/es 同理
- 3 个守门 test 全绿
- 用户切语言后 view-source 验证 lang 属性正确

### F007 — i18n 翻译 runbook + Topbar 全启用

**实现：**

1. **`docs/dev/i18n-runbook.md`**：
   - 加新文案流程（en.json 加新 key → run translate script → review）
   - 新增 locale 流程（如未来加 fr）
   - glossary 维护
   - 翻译质量评级标准（A: native quality / B: 通顺 / C: 字面但可懂 / D: 错误重翻）

2. **Topbar 5 语言全启用**：
   - 当前 selector 应该已是 5 语言（routing.locales）；如有 disable 逻辑移除
   - 验证切换语言后 `<html lang>` + 文本 + cookie 都同步

**Acceptance：**
- runbook ≥ 80 行
- Topbar 切到 ja/ko/es 后页面渲染对应翻译
- cookie `NEXT_LOCALE` 写入正确

## 5. 依赖关系

```
F001 (基础设施 + Action + 脚本) ────┐
                                    ├─→ F002 zh 补 59
                                    ├─→ F003 ja 全翻
                                    ├─→ F004 ko 全翻
                                    └─→ F005 es 全翻
                                           │
                                           ▼
F006 (html lang + 守门 tests) ──→ F007 (runbook + Topbar)
```

**强依赖：** F001 → F002-F005（脚本前置）；F006 / F007 可并行 F002-F005 之后

**推荐顺序：** F001 → F002（最小验证 AI 翻译质量）→ F003 + F004 + F005 串行（每个翻完 review）→ F006 → F007

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| AI 翻译质量低（机械、不通顺） | 高 | F001 用 Claude Sonnet（高质量）+ 严格 prompt + 100% 人工 review；F002 zh 先做小规模验证质量 |
| 占位符 / HTML tag 被破坏 | 高 | F001 prompt 强约束 + script 后处理验证 + 静态测试守门 |
| 品牌词不一致（KOL 翻成 "意见领袖" / KOLMatrix 翻成 "KOL 矩阵"） | 中 | F001 glossary 文件 + prompt 注入；review 时 grep 验证 |
| 文化禁忌（特别是 zh / ja / ko 敬语） | 中 | 人工 review 兜底；用户 spot check ja/ko 关键页 |
| 翻译后 UI 文本超长破坏布局（德语经典问题，中日韩较短不严重） | 低 | F006 测试覆盖关键页 + visual regression 截图（hotfix 已落） |
| aigcgateway 余额耗尽 | 低 | 实测 4 语言总成本 < $1（4200 input × 4 + ~16k output × 4 = $0.5），余额充足 |
| html lang 修复影响 SSR / hydration | 中 | F006 设计阶段先 spike Next.js 16 root vs locale layout 推荐模式；不行就 next-intl 官方建议 |
| 翻译键值含 markdown 渲染（weekly-report） | 中 | F003-F005 review 重点核 markdown 渲染正确（`*斜体*` 不破坏） |
| 翻译期间用户继续加新 key（en.json 漂移） | 中 | F002-F005 期间禁止新增 i18n key（与 demo prep 协调）；如必须加，跑 i18n:translate 补 |

## 7. 验收方式（Evaluator 阶段）

### L1 自动化
- 4 个 i18n-coverage tests 全绿（each locale leaf == en）
- placeholders test 全绿
- no-hardcoded-english test（带白名单）全绿
- typecheck / lint / 现有套件不退化

### L2 staging
- /en/dashboard /zh/dashboard /ja/dashboard /ko/dashboard /es/dashboard 5 路由 200
- 每个路由 view-source `<html lang>` 正确
- 5 关键页（dashboard/discovery/database/campaigns/weekly-report）每语言人工 spot check（用户参与，每语言 ~10 min）
- Topbar 语言选择器 5 语言全可用，切换后 cookie + URL + 文本同步

### L3 翻译质量评级（用户参与）
- zh：A 级（native quality 必须，用户母语）
- ja/ko/es：B 级可接受（通顺即可，可作为 demo 上线起点）；如发现 C 级以下条目登记 backlog

## 8. 引用文档

- `messages/en.json`（翻译源）
- `src/i18n/routing.ts`（locale 配置）
- `src/middleware.ts`（locale routing）
- `src/i18n/request.ts`（next-intl request config）
- `docs/product/KOLMatrix-MVP-PRD.md` §11（5 locale 决策）
- `framework/harness/database-patterns.md`（如 DB seed 含翻译需对齐）
- aigcgateway docs：https://aigc.guangai.ai

## 9. 启动检查清单（Generator 开工前）

- [ ] hotfix done + signoff（已满足，commit 58fa549）
- [ ] aigcgateway 余额 ≥ $20（当前 $49.60）
- [ ] glossary 草案 review（Planner 提供，用户最终批准）
- [ ] F001 spike 决定 html lang 修复路径（root vs locale layout）

## 10. 估时（精确）

| 环节 | 预估 |
|---|---|
| F001 翻译基础设施（Action + script + glossary 草案） | ~3-4h |
| F002 zh 补 59 处（AI 翻 + 人工 review） | ~1-1.5h |
| F003 ja 全翻 812 处（AI ~30min + review ~1.5h） | ~2h |
| F004 ko 全翻 812 处 | ~2h |
| F005 es 全翻 812 处 | ~2h |
| F006 html lang 修（含 spike） + 守门 tests | ~3h |
| F007 runbook + Topbar | ~1.5h |
| L2 staging 验证 + 反复修 | ~2h |
| 缓冲（review 慢 / 重翻） | ~3h |
| **总计** | **~20h ≈ 2.5-3 day** |

## 11. 与时间线

| 节点 | 预估 |
|---|---|
| 用户确认 spec + 启动 | 2026-04-27 |
| Generator MVP-i18n-full-locale building | 2026-04-27 ~ 2026-04-30 |
| Reviewer L1 + L2 验收 | 2026-04-30 |
| done + 用户触发 prod redeploy | 2026-04-30 ~ 2026-05-01 |
| MVP-prod-launch-smoke 启动 | 2026-05-01 |
| MVP-seed-demo-prep 启动 | 2026-05-01 |
| 首批种子用户邀请发出 | **~2026-05-04**（比之前估的 05-05 推迟 ~1 天，因 i18n hotfix 插队） |

## 12. 与现有 spec 关系

- **阻塞：** MVP-prod-launch-smoke + MVP-seed-demo-prep（i18n done 后才推 prod，避免 demo 用户看到混乱翻译）
- **不阻塞：** BIx-staging-automation / B4-extended（独立路径）
- **后续：** 加新 i18n key 时遵循 §F007 runbook 流程，不再积累债

## 13. 待用户确认（启动前）

1. **AI 模型选择：** 推荐 Claude Sonnet 4.6（高质量），可否？还是用 Gemini 3 Pro / 4 Flash 省成本？
2. **review 工作量：** 100% 人工 review 4 语言 ~2500 leaves，~5h 工时谁负责？（Planner 起草 + 用户最终拍板？还是用户自己翻 review？）
3. **zh 已翻部分是否复审：** Planner 推荐**不复审**（仅补 59）；如用户要求 100% 复审 zh，工时 +2h
4. **品牌 glossary：** Planner 起草 30 词初版给用户 review；用户可否提供更专业的市场术语对照？
5. **角色分配：** 沿用 Kimi/johnsong/Reviewer？还是用户自己接 review 工作？

---

**Spec 状态：** draft（2026-04-27 Planner 起草，待用户确认 5 个 open question 后切 planning → building）

**预估 MVP 时间线：~2026-05-04 上线**（i18n hotfix 推迟 ~1 天，可接受）

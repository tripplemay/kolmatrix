# B5 F004 · Audience Tab 现状与 spec 偏离 · 前置审计

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-30
> **触发：** F004 开工前审计，按 `framework/harness/pre-impl-adjudication.md` §3.3「Spec 字面冲突」走 Planner 裁决
> **状态：** 等待 Planner 明确回复，**未收到前不开工 F004 #5（其余 4 项 banner / 6 视频 / wordcloud / engagementRate display 也一起等裁决再启动，避免一来一回）**

## 1. 背景 & 目标

B5 spec §F004 #5（line 212-215）+ Acceptance（line 219）+ §3 决策表（line 258）共 3 处明确要求：
- 「当前 KolDetailTabs 中 Audience tab 显示 placeholder」
- 「完全隐藏 Audience tab（tab 数量从 4 → 3）」
- 「Audience tab 不渲染（visual + integration test 验证）」

并在 F005 #2 守门 tests 列出：
- `tests/unit/b5-kol-detail-no-audience-tab.test.ts` — 静态源码守 KolDetailTabs 不再渲染 Audience tab

## 2. 现状审计

### 2.1 实际代码（`src/app/[locale]/(app)/kols/[id]/KolTabsNav.tsx`）

```ts
export type KolTabKey = "overview" | "collabs" | "contacts" | "ai";
const TABS: KolTabKey[] = ["overview", "collabs", "contacts", "ai"];
```

**4 个 tab：overview / collabs / contacts / ai。没有 audience tab。**

- 文件首注释：`MVP-vf-F006 · Tab navigation for /kols/:id`（最后一次大改是 MVP 视觉还原批次）
- `grep -rn 'audience' src/app/[locale]/(app)/kols/` → 0 matches
- `git log -S"audience"` 未触及该目录 — Audience tab **从未在代码中存在过**

### 2.2 i18n keys（`messages/en.json` `kolProfile.tabs`）

待 Planner 裁决后再核对（不影响审计结论）。

### 2.3 spec §F004 描述与代码偏差汇总

| Spec 描述 | 现实 | 偏差类型 |
|---|---|---|
| 当前 Audience tab 显示 placeholder | 不存在 audience tab | spec 与现实不符 |
| 隐藏后 tab 数 4 → 3 | 现状本就是 4 个 tab（overview/collabs/contacts/ai），目标 3 个？ | 数量数字对不上语义 |
| Audience tab 不渲染（visual test 验证） | 已经不渲染 | acceptance 已客观成立 |

## 3. 决议请求（3 条）

### 决议 1：F004 #5「隐藏 Audience tab」如何处理？

| 方案 | 描述 | 影响 |
|---|---|---|
| **A. 视为 no-op，spec 阐述失误** | 现状已符合「不渲染 audience tab」的目标。F004 #5 不产生任何代码改动；F005 守门 test `b5-kol-detail-no-audience-tab.test.ts` 仍写（静态断言 `KolTabKey` union 不含 "audience"），但实质是「保护现状不退化」 | 工作量 0；语义清晰 |
| **B. Planner 把 contacts 误记成 audience，本意是隐藏 contacts** | 把 contacts tab 隐藏（4 → 3） | **不推荐**：contacts 是 KOL 联系方式 tab（合作功能依赖），隐藏会损失功能；与 §F004 「Audience demographics 等 NoxInfluencer 接入再显示」语义不一致 |
| **C. spec 设想的是另一批次曾添加过 audience tab，但实际没人写** | 视同 A，但额外加注释 `// B6: re-enable Audience tab when NoxInfluencer integration lands`（spec line 215 原文要求加这条注释） | 工作量极小；保留 spec 中关于未来 NoxInfluencer 接入的语义锚点 |

**Generator 建议：C**
- 现实满足 acceptance，无需改代码逻辑
- 加 1 行注释作为「未来方向锚点」（spec line 215 原文要求）
- F005 守门 test 仍写（防退化）
- 在 spec 中追加澄清备注：「2026-04-30 audit 确认 Audience tab 历史上未实现，本 feature 退化为防退化守门」

### 决议 2：spec §F004 #5 「tab 数量 4 → 3」数字如何修订？

A 方案直保留原文数字会让 Reviewer 困惑（「现状 4 → 4，何来减少」）。

| 方案 | 描述 |
|---|---|
| **A. 修订 spec：「tab 数量保持 4（overview/collabs/contacts/ai），不新增 Audience tab；未来 NoxInfluencer 接入时再扩展为 5」** | 与现实和 C 方案 acceptance 一致 |
| **B. 删除「4 → 3」整段** | 简洁但失去未来扩展提示 |

**Generator 建议：A**

### 决议 3：F004 其余 4 项（banner / 6 视频 / wordcloud / engagementRate display）开工节奏

| 方案 | 描述 |
|---|---|
| **A. 4 项一起开工，独立 commit** | Generator 一会话内推 4 个 commit，每个 feat(B5-F004): 子标签 |
| **B. 拆 4 个 sub-feature** | 改 features.json 把 F004 拆成 F004a/b/c/d。维护成本高 |
| **C. 4 项合一个大 commit** | 难以独立回滚 |

**Generator 建议：A**（独立 commit、单一 F004 归属、commit message 区分子项）

**额外阻塞项提醒：** F004 #4 wordcloud 需要 aigcgateway 控制台新建 `kol-topic-extract` Action 并把 `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` 写入 `.env.staging` / `.env.production`。这是 **Planner 职责**（环境维护权归 Planner，见 `.auto-memory/MEMORY.md`）。请 Planner 在裁决时一并确认：
- (a) Action 是否已建？action_id 是多少？
- (b) env var 名是否就用 `AIGCGATEWAY_KOL_TOPIC_ACTION_ID`？
- (c) 若 Planner 还没建，F004 #4 wordcloud 需要等 Action 就位后才能开工，Generator 可先做 #1/#2/#3/#5（banner / stats cards / 6 videos / engagementRate display），#4 wordcloud 落到本批次最后或拆到 F005

## 4. 开工条件

收到 Planner 对 3 条决议 + wordcloud Action 阻塞项的明确回复后，Generator 将：

1. 按决议修订 `docs/specs/B5-kol-data-enrichment-spec.md` §F004 #5 文字（如需）
2. 实现 F004 #1/#2/#3/#5（banner / stats cards / recent 6 videos / engagement display + audience-tab no-op + 注释）
3. 若 Action 已就位，实现 #4 wordcloud；否则拆到 F005 / 等 Action 就位
4. 提交 + 走 staging deploy + CI 守门
5. 更新 features.json F004 status=done 并切到 F005

**未收到明确回复前不开工。**

## 5. 估算开工时长

| 环节 | 预估 |
|---|---|
| 审计文档 + 等裁决 | ~30 min（已写本文 + 等回复） |
| F004 #1 banner | 10 min |
| F004 #2 stats cards (channelAge / videoCount) | 1 h |
| F004 #3 recent 6 videos（YouTube playlistItems lazy + 24h cache） | 2-3 h |
| F004 #4 wordcloud（react-wordcloud + d3-cloud + AI Action 调用 + 7d cache + dynamic import） | 2-3 h |
| F004 #5 audience tab no-op + 注释 + spec 修订 | 5 min |
| **F004 总计** | **~5-7 h** |

## 6. 相关文档

- `docs/specs/B5-kol-data-enrichment-spec.md` §F004
- `src/app/[locale]/(app)/kols/[id]/KolTabsNav.tsx`（现状）
- `framework/harness/pre-impl-adjudication.md`（流程框架）
- `progress.json` § generator_handoff（前会话 johnsong 提交的交接）

---

## 7. Planner 裁决（johnsong · 2026-04-30 13:30 BJ）

> **角色切换标注：** 本会话用户 `本会话你的身份固定为planner`。Generator 已交接 (commit 2f7bf28)，本 Planner 裁决与 Generator 工作处于不同会话段，符合 §4.6 豁免条款。

### 决议 1（Audience tab 处理）：✅ **C 方案 lock**

**理由：**
- 现状 4 tabs（overview/collabs/contacts/ai）**已满足** spec acceptance「Audience tab 不渲染」
- B 方案误把 contacts tab 当 audience tab，contacts 是 KOL 联系方式 tab（PRD §3 marketing manager 用它管 outreach），**绝不可隐藏**
- A 方案语义清楚但丢失未来扩展锚点
- C 方案：现状 = 目标，加 1 行 `// B6: re-enable Audience tab when NoxInfluencer integration lands` 锚点注释（spec line 215 原文要求），F005 守门 test 仍写防退化

**根因坦诚：** B5 spec 原作者 Kimi（2026-04-27 起草）+ Planner johnsong（2026-04-30 修订）均未核对 KolTabsNav 现状，是 spec 编写时 reality drift 漏核对。本次审计纠错。

### 决议 2（spec §F004 #5 数字）：✅ **A 方案 lock**

修订 spec §F004 #5 为：

> **5. Audience tab 防退化守门 + 未来扩展锚点（2026-04-30 audit 修订）：**
> - 现状：KolTabsNav.tsx 含 4 tabs（overview / collabs / contacts / ai），**没有 audience tab**（历史上未实现）
> - 本批次：保持现状 4 tabs，加注释 `// B6: re-enable Audience tab when NoxInfluencer integration lands` 作为未来 NoxInfluencer 接入时的扩展锚点
> - 未来：B6+ NoxInfluencer / SocialBlade 三方接入后再扩展 audience demographics，tabs 数量 4 → 5
> - F005 守门 test：`tests/unit/b5-kol-detail-no-audience-tab.test.ts` 静态断言 KolTabKey union 不含 "audience"（防 LLM 误新增 audience tab 留空白 placeholder）

### 决议 3（F004 其余 4 项开工节奏）：✅ **A 方案 lock**

4 项一起开工，每子项独立 commit，单一 F004 归属。
Commit message 模板：`feat(B5-F004): <子项名>`，例：
- `feat(B5-F004): banner image at top of /kols/[id]`
- `feat(B5-F004): stats cards surface channelAge + videoCount`
- `feat(B5-F004): recent 6 videos grid via playlistItems (lazy + 24h cache)`
- `feat(B5-F004): wordcloud via aigcgateway kol-topic-extract action`
- `feat(B5-F004): audience tab anchor comment + spec §F004 #5 修订`

### 决议 4（wordcloud aigcgateway Action 阻塞）：✅ **2026-04-30 14:00 BJ resolved**

**(a) Action 状态：** ✅ **已建** — 用户授权 MCP key + Planner 用 MCP `create_action` tool 直接创建并 dry-run 验证。
- `action_id`: **`cmokr9z880009bn18sre31yf0`**
- `model`: claude-haiku-4.5
- `active_version`: 1
- 验证输出质量：10 个游戏关键词 + 合理 weight（0.5-0.9 分布）
- 单次调用成本：~435 tokens ≈ $0.001（B5 F004 daily batch 100 KOL = ~$0.10/day）

**(b) env var 名：** `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` 锁定

**(c) Generator 节奏裁决：**
- **不再需要 Phase 拆分** — Action 已就位，4 项可一并开工
- 但 env var **尚未落入 .env.production / .env.staging**（需用户 SSH 操作 — 见下方）
- Generator 在 KOL 详情页代码里硬编 fallback：`process.env.AIGCGATEWAY_KOL_TOPIC_ACTION_ID ?? "cmokr9z880009bn18sre31yf0"`，这样即使 env var 暂时未落地，词云也能跑（参考 BM2 `KOL_EMAIL_CUSTOMIZE_ACTION_ID` 同款模式）

**(d) 用户行动项 — env var SSH 落地（建议但不强制阻塞 Generator）：**

```bash
ssh tripplezhou@34.180.93.185
echo "AIGCGATEWAY_KOL_TOPIC_ACTION_ID=cmokr9z880009bn18sre31yf0" | sudo tee -a /opt/kolmatrix/.env.production
echo "AIGCGATEWAY_KOL_TOPIC_ACTION_ID=cmokr9z880009bn18sre31yf0" | sudo tee -a /opt/kolmatrix-staging/.env.staging
pm2 reload kolmatrix --update-env
pm2 reload kolmatrix-staging --update-env
```

落不落地都不阻塞 — Generator 用代码硬编 fallback 兜底。env var 落地后可统一改用 env 优先 fallback 二级。

### 用户行动项（aigcgateway Action 创建）

请你 5-10 min 在 aigcgateway 控制台建 Action：

```
名称: kol-topic-extract
描述: 从 6 个 YouTube 视频标题中提取 5-10 个游戏主题关键词，附 weight (0-1) 用于词云字号映射

模型: claude-haiku-4-5（cost 极低，~$0.001 / 调用）
   或 gemini-2.5-flash-lite（同档备选）

System prompt:
You are a topic-extraction assistant for gaming KOL profiles.
Given 6 YouTube video titles, identify 5-10 gaming-related keywords
that capture the channel's content focus. Output strict JSON.

User prompt template (留 {{titles}} 占位):
Video titles:
{{titles}}

Extract 5-10 gaming-related keywords (single words or short phrases).
For each, assign a weight (0-1) reflecting prominence in the titles.
Output JSON array: [{"term": "...", "weight": 0.0-1.0}, ...]
Higher-weight terms appear more or are more central to the channel.
Skip stopwords / generic verbs (play / watch / new / 2024 等).
Skip non-gaming topics.

Schema 输出（JSON Mode）:
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "term": { "type": "string" },
      "weight": { "type": "number", "minimum": 0, "maximum": 1 }
    },
    "required": ["term", "weight"]
  },
  "minItems": 5,
  "maxItems": 10
}

测试输入：
"Genshin Impact 5.0 Natlan Reaction"
"Top 10 4-Star Builds Ranked"
"Mihoyo's New Banner Drama"
"Live: Spiral Abyss Floor 12"
"Why HSR is overtaking Genshin"
"Wuthering Waves vs Genshin"

预期输出（示例）：
[
  {"term": "Genshin Impact", "weight": 0.95},
  {"term": "Natlan", "weight": 0.5},
  {"term": "Honkai Star Rail", "weight": 0.45},
  {"term": "Spiral Abyss", "weight": 0.4},
  {"term": "Mihoyo", "weight": 0.35},
  {"term": "Wuthering Waves", "weight": 0.3},
  {"term": "Banner", "weight": 0.25}
]
```

建好后告诉我 action_id（pk_xxx 格式 / 或控制台分配的 ID），我把 env var 落到 .env.production + .env.staging 让 Generator 接入。

### 总结开工指引（Generator 下一会话 / 会话续接）

**立即可开工（Phase 1，~3-4h）：**
1. F004 #1 banner（5-10 min）
2. F004 #2 stats cards channelAge + videoCount（~1h）
3. F004 #3 recent 6 videos via playlistItems lazy + 24h cache（~2-3h，**用 channels.list contentDetails 拿 uploads playlistId + playlistItems.list 6 items + videos.list snippet/statistics**，不要用 search.list 100u）
4. F004 #5 audience anchor 注释 + 修订 spec §F004 #5（~5-10 min）

**等 aigcgateway Action 就位后（Phase 2，~2-3h）：**
5. F004 #4 wordcloud（react-wordcloud + d3-cloud + dynamic import + 7d cache）

**Phase 1 推完 4 个 commit 后（不等 Phase 2）即可：**
- 标 F004 status=done（acceptance #1/#2/#3/#5 全过；#4 #wordcloud-deferred 备注，由 BIx 或 follow-up 处理）
- 切 F005

如 Action 在 Generator 当晚开工时已就位，Phase 2 直接接做即可，单 F004 commit。

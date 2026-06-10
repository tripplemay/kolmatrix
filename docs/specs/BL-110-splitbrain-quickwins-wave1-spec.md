# BL-110 split-brain 快赢止血(波1)— 死链 / 脏卡 / accept 口径 / Reply 空态

> **Type：** 快赢止血批次(bug 修复，spec 软性但本批次列硬以含产品决策)。
> **来源：** docs/reviews/full-feature-chain-audit-2026-06-09.md(全功能链路审计)+ 路线图 docs/reviews/split-brain-remediation-roadmap-2026-06.md 波1
> **本批次 = 波1，合并 backlog BL-101/102/103/104**(执行后从 backlog 移除；本批次号 BL-110)。
> **特征：** 4 个小改、用户可见、低风险、各自独立可测。纯 kolmatrix。

## §1 背景

审计发现 split-brain 病灶家族。波1 取其中 4 个**小改动、用户可见**的，一批止血：

| 本批 F | 源 backlog | 病灶 | 形态 |
|---|---|---|---|
| F001 | BL-104 | KOL 详情面包屑 → /kols 404 死链 | C 基建没接线 |
| F002 | BL-103 | /assets 列表泄漏 AI 解释缓存行(空白脏卡 + welcome 失效) | D 读路径过宽 |
| F003 | BL-102 | kol_campaign 双 accept，skip/swap 的 KOL 在详情页显示"已接受" | B 写错口径 |
| F004 | BL-101 | Reply 链 repliedAt 只读不写，prod 回复面板靠 seed 假数据撑场 | A 读了没人写 |

> H6 "Edit Brief" 死链**不在本批**——它依赖 campaign 编辑页是否存在，留波3 BL-105 一并(补编辑入口时接真页)。本批 F001 只修 /kols 面包屑。

## §2 Features（全 generator + Codex；各自独立，无强依赖）

> 所有 generator feature 含单测 + L1 全绿(lint 0err warn≤3 / tsc=0 / npm test)。

### F001 — KOL 详情面包屑死链修复（generator，源 BL-104）
- `src/app/[locale]/(app)/kols/[id]/page.tsx:162` 面包屑 "Back to Database" href `/{locale}/kols`(该路由不存在，`(app)/kols/` 下只有 `[id]/`，无 `kols/page.tsx`)→ 点击 404。
- **修：** 面包屑改指 `/{locale}/match`(KOL 工作台实际入口)；或加 `/kols`→`/match` redirect。择一(建议改链接更轻)。同步 i18n label 若文案需调整(label 仍 "返回数据库"语义可保留，仅改 href)。
- 验收：KOL 详情点面包屑 → 到 /match，不再 404。含断言新 href 的测试。

### F002 — /assets 列表 type 白名单收口（generator，源 BL-103）
- `src/lib/assets/queries.ts:120` `buildListWhere` 仅当 `filter.types` 非空才加 type 谓词 → `/assets` 默认无 type 过滤时返回租户**全部 4 种 type**，混入 `ai_recommendation_explanation_short/detailed` 缓存行(`cache.ts:126,208` 直写 asset)→ 空白脏卡。
- **修：** `buildListWhere` 无显式 type filter 时默认 `where.type IN LISTABLE_ASSET_TYPES`(常量 `[email, video_script]`，与 `filter-shape.ts:31 ASSET_TYPES` 对齐)。
- **同步修 welcome 抑制：** `src/app/[locale]/(app)/assets/page.tsx:65` `userOwnedCount` 按 LISTABLE_ASSET_TYPES 限定(或排除解释类型)，避免跑过 AI 解释的租户被误判 userOwnedCount>0 跳过 welcome。
- 验收：/assets 只显示 email/video_script 资产，无空白脏卡；从没建真实资产的租户(仅有解释缓存)正确进 welcome。含测试(列表查询带 type 白名单 + welcome-count 排除解释类型)。

### F003 — kol_campaign accept 读口径统一（generator，源 BL-102）
- 病灶：AI 面板三键走 `suggestion-actions.ts:55 writeDecision` 写 `suggestionStatus`(skip 也插 `source='ai_smart_match'` 行)；详情页 accept 走 `recommend-actions.ts:132` 只写 `status/source` **不写 suggestionStatus**；读面 `detail.ts:115` select 无 suggestionStatus，`AcceptedKolsPanel.tsx:66` 只 filter `source`，`page.tsx:72 acceptedCount=kols.length` → skip/swap 行错误进"已接受"。
- **止血(读口径)：** `detail.ts` kolCampaigns select 加 `suggestionStatus`；`AcceptedKolsPanel` + `acceptedCount` 过滤 `suggestionStatus ∈ {accepted, NULL}`(NULL = 详情页直接 accept + legacy backfill 行)。
- **根治(写口径，小改一并做)：** `recommend-actions.ts:132` 详情页 accept 也写 `suggestionStatus='accepted'`，与 ADR-016 约定一致；保留读口径 `accepted OR NULL` 兼容历史。
- 验收：在 /match AI 面板 skip/swap 的 KOL **不再**出现在 /campaigns/[id] "已接受"列表，acceptedCount 不含 skip/swap；详情页 accept 的 KOL 正常显示。含测试(skip/swap 行被过滤 + 详情 accept 写 suggestionStatus + legacy NULL 仍显示)。

### F004 — Reply 链诚实空态（generator，源 BL-101，止血）
- 病灶：Reply Rate KPI / Recent Replies 卡(`analytics.ts:183`)/ tracking "replied" 列 / Dashboard 邮件趋势 Replied 线(`email-performance.ts:47`)全读 `email_log.repliedAt`，但全仓无任何写入(回复需 inbound-email，B4 deferred 未实装)；dev/staging seed 假数据撑场，prod 恒空/0 却显示得像真数据。
- **止血(不实装 inbound，仅诚实化)：** 三处回复面板 + Dashboard Replied 维度在**无真实回复数据**时显示诚实空态/标注(如 "回复追踪待上线(B4)" / "—" 而非伪装的 0%/0 条)；保留 UI 骨架(B4 上线即复活)。Dashboard 邮件趋势图 Replied 线保留但加脚注"回复数据待 inbound 接入"。
- **决策(Planner)：** 选"诚实标注空态"而非"删除 Replied 维度"——保留骨架、改动更小、B4 上线零返工。
- 验收：prod 真实(无 repliedAt)环境三处回复面板不再显示误导性 0%/数字，而是诚实空态/标注；seed 数据存在时(dev)仍正常显示。含测试(repliedAt 全空→空态文案 / 有值→正常)。

### F005 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test(含各 feature 新测)。
- L2 部署后 staging/prod：① KOL 详情面包屑 → /match 不 404 ② /assets 无空白脏卡 + 解释缓存租户进 welcome ③ /match skip/swap 的 KOL 不在 /campaigns/[id] 已接受列表 ④ 回复面板诚实空态(无误导 0%)。
- signoff `docs/test-reports/BL-110-signoff-2026-06-XX.md`。

## §3 风险

- 极小，纯 kolmatrix，4 个独立小修。F002 注意 `LISTABLE_ASSET_TYPES` 与未来新增 asset type 的对齐(加 type 时需更新白名单——加注释提示)。F003 注意 legacy NULL 行的 `accepted OR NULL` 口径不要误伤。
- ⚠️ 部署 staging+prod(手动触发)注意 OOM(NODE_OPTIONS=4096)。
- H6 Edit Brief 死链**不在本批**(留波3 BL-105)。

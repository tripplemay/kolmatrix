# 全功能链路实装审计 — split-brain 同型病灶普查

> **类型：** 独立审计任务（用户 2026-06-09 指派，与 BL-099 并行）
> **方法：** 7 个并行审计 agent 按域追踪真实端到端实现链（UI→action/API→lib→DB），只读
> **作者：** Kimi (planner)
> **触发：** BL-098/BL-099 暴露的邮件模板"读写路径不对位"(split-brain)病灶，普查全项目同型问题
> **关联：** docs/reviews/email-template-feature-audit-2026-06-09.md · ADR-011 · ADR-016 · ADR-018

## 0. 结论

普查覆盖 5 主路由（Brief/Match/Reach/Campaigns/Insight）+ CRM/Assets/KOLs/ROI + Admin + 横切基础设施。**核心业务主链大多真实闭环**（KOL 同步/embedding/value-score/smart-match、Brief AI 生成、Resend 真发、RLS 隔离、audit log、rate-limit 均健康，无假数据撑场）。

**但确认了一个"split-brain 病灶家族"——邮件模板不是孤例**，共 **6 个 🔴 高危 + 8 个 ⚠️ 中危**。家族分四种形态：

| 形态 | 含义 | 实例 |
|---|---|---|
| **A. 读了没人写** | 读路径活、写路径从不存在 | Reply 链(repliedAt)、Dashboard Replied 线 |
| **B. 写了没人读 / 写错口径** | 写一处语义、读另一处口径 | kol_campaign 双 accept、tsvector 全文搜索 |
| **C. 基建建好没接线** | stub/孤儿，能力齐全无入口 | 邮件队列、AI 语义搜索、campaign 编辑写路径、孤儿 API |
| **D. 读路径作用域过宽** | 读比写宽，混入不该显示的数据 | /assets 列表泄漏解释缓存行 |

## 1. 🔴 高危发现（用户可见 bug / 数据错乱）

### H1 — 邮件批量发送同步阻塞，>~10 收件人必超时且部分已发 [形态 C]
- **现象：** 批量外联在收件人 >~10 时必触发 60s 超时报错，但部分邮件**已真发出**，用户无从得知发了几封。批量发送实质不可用于稍大名单。
- **根因：** `jobQueue`(`lib/jobs/queue.ts:134`)是 `InMemoryJobQueue`（自述无持久化/无重试/无跨进程）；**邮件发送根本没接队列**——`reach/actions.ts:321` 直接 `await batchSendOutreach`，`batch-send.ts:213` 每封 `await sleep(6000)`（10封/分节流），整个发送在 server action 内同步执行，与 60s wall-clock 竞速（`actions.ts:317`，注释自承"超时不取消已发"）。`register.ts:5` 注释"BM2 email sending will populate"从未兑现。
- **严重性：高（用户可见 + 静默部分发送）。**
- **建议：** 上真 BullMQ + 发送改异步队列任务（server action 立即返回、后台续跑、EmailLog 轮询进度）；或至少分批降低单次量 + 明确回报"已发 N 封"。

### H2 — Reply 链 repliedAt 只读不写，prod 回复面板靠 seed 假数据撑场 [形态 A]
- **现象：** Reply Rate KPI、Recent Replies 卡片、tracking "replied" 列、**Dashboard 邮件趋势图 Replied 线**全部读 `email_log.repliedAt`。dev/staging 有 ~20% seed 行带 repliedAt 撑场面，**prod 真实环境恒 0/空**，UI 无"seed/estimated"标注 → 营销人误读为"零回复"。
- **根因：** 全仓**无任何生产代码写 repliedAt**（grep 赋值仅在测试）。Resend webhook `handler.ts:43` `STATUS_BY_EVENT_TYPE` 只有 delivered/bounced/complained/opened/clicked，无 replied（回复是 inbound email，独立机制未实装）。spec `BM2-f006:97` 标注 B4 deferred。
- **严重性：高（用户可见，跨 reach+dashboard 两域）。**
- **建议：** 止血优先——prod 给三处显式空态 + "回复追踪 B4 上线"标注，或从图例/KPI 移除 Replied 维度；根治需 inbound-email ingestion 写 repliedAt。

### H3 — Match 域 kol_campaign 双 accept 写面，skip/swap 的 KOL 在详情页显示"已接受" [形态 B]
- **现象：** 用户在 /match AI 面板明确"跳过/移候补"的 KOL，转到 `/campaigns/[id]` 却显示为"已接受"，顶部 acceptedCount 计数虚高。
- **根因：** 两条 accept 写路径写不同列——AI 面板三键走 `suggestion-actions.ts:55 writeDecision` 写 `suggestionStatus`（skip 也插一行 `source='ai_smart_match'`）；详情页 accept 走 `recommend-actions.ts:132` 只写 `status/source`、**不写 suggestionStatus**。读面 `detail.ts:115` select 无 suggestionStatus，`AcceptedKolsPanel.tsx:66` 只 filter `source`，`page.tsx:72 acceptedCount=kols.length` 不区分 → skip/swap 行全落进"已接受"。ADR-016 约定的 `WHERE suggestion_status='accepted'` 除 /match 外**无任何读者执行**（全仓证实）。
- **严重性：高（用户可见 + 数据语义错乱）。**
- **建议：** 止血——`detail.ts` select 加 suggestionStatus，AcceptedKolsPanel/acceptedCount 过滤 `suggestionStatus ∈ {accepted, NULL}`；根治——详情页 accept 也写 `suggestionStatus='accepted'`，全项目"已接受 KOL"读口径统一（accepted OR NULL 兼容 legacy）。

### H4 — /assets 列表泄漏 AI 解释缓存行，空白脏卡 + welcome 引导失效 [形态 D]
- **现象：** `/assets` 网格混入 `ai_recommendation_explanation_short/detailed` 缓存行，渲染成空白/无意义卡片（标签显示 cache key 名）；且这些 `ai_generated` 行使 `userOwnedCount>0`，让从没建过真实资产的租户**错误跳过 welcome 引导**直接看空白网格。
- **根因：** `loadAssetsForListing` 的 `buildListWhere`(`queries.ts:120`)仅当 `filter.types` 非空才加 type 谓词，`/assets` 默认无 type 过滤 → 返回租户全部 4 种 type。解释缓存由 `cache.ts:126,208 tx.asset.create` 直写 asset 表做缓存分区，列表读路径未排除。`filter-shape.ts:31 ASSET_TYPES` 只列 email/video_script，证明 UI 契约本只认这俩，listing 层漏对齐。
- **严重性：高（用户可见空白脏卡 + welcome 失效）。**
- **建议：** `buildListWhere` 加 `LISTABLE_ASSET_TYPES=[email,video_script]` 白名单默认过滤；welcome-count 同步按 type 限定。低风险单点修复。

### H5 — KOL 详情面包屑"返回数据库"→ /kols 404 死链 [形态 C]
- **现象：** KOL 详情页面包屑 "Back to Database"（`page.tsx:162` href=`/{locale}/kols`）指向**不存在的路由**——`(app)/kols/` 下只有 `[id]/`，无 `kols/page.tsx`。点击必 404。
- **根因：** `/kols` 在受保护路径表（`middleware-helpers.ts:19`）但无对应 page。
- **严重性：高（用户可见死链）。**
- **建议：** 面包屑改指 `/match`，或补 `/kols`→`/match` redirect。

### H6 — "Edit Brief" 按钮 → /campaigns/[id]/edit 404 死链 [形态 C]
- **现象：** `BriefSummaryPanel.tsx:224` "Edit Brief" 链接 `/{locale}/campaigns/{id}/edit`，该路由不存在，点击 404。
- **根因：** spec 原锁定占位路由 `/{locale}/n`，实现改指 `/edit` 但同样未建。CTA 自始无后端。
- **严重性：高（用户可见死链）。**
- **建议：** 退役该按钮，或补 campaign 编辑页（与 H7 一并决策）。

## 2. ⚠️ 中危发现（债 / 数据风险 / 半成品）

### M1 — Campaign 编辑写路径全部 UI 断线（5 action + 多 API route 实装无入口）[形态 C]
- campaign 整条编辑/状态流转(draft→active→completed)/营收记录/KOL 移除改名单 的 5 个 server action（`update.ts`/`kol-operations.ts`）+ API route + lib 全部实装且有单测，但**前端零调用方**。用户实际无法编辑已建活动/推进状态/记录营收/移除名单成员。
- 根因：BL-066-F006 + BL-070-F005 把详情页重构成 AI-native 只读 3-panel（删了 6 个编辑组件），但下层 action/API/lib 未同步退役。`CampaignHeader.tsx`（唯一 import 编辑 action 者）无任何 render。
- **严重性：中（功能性缺失，不丢数据）。** ⚠️ **可能是有意的 AI-native 重构** → 需用户确认是"该退役死代码"还是"该补回编辑入口"。

### M2 — KPI 快照 cron 无仓库内调度接线，prod 趋势可能永久降级
- `kpi_daily_snapshot` 写入依赖**仓库外手工 crontab**（`scripts/kpi-snapshot-daily.ts` 注释说挂在 `/etc/cron.d`，但仓库无 vercel.json/GH cron/任何调度证据）。若部署环境没挂这条 cron，快照表永空 → 所有 KPI 趋势 chip 永久停"—"降级态。降级是诚实的（不显假趋势），但"真趋势"功能 prod 可能从未生效，代码内无法自证。
- **严重性：中-高（需核实 prod crontab）。**

### M3 — analytics.ts:156 读废弃 email_template（BL-099 在收尾）
- `getTopTemplates` 用 `tx.emailTemplate.findMany` 取名。当前靠 dual-write 镜像撑着（受控，非已断），但正是 BL-099 F004 要切到 Asset 的最后读点。**已在 BL-099 批次范围内**，列此备查。

### M4 — KOL 详情页不过滤 deleted_at/is_suspicious [形态 D]
- `loadKol`(`page.tsx:87`)`findUnique({where:{id}})` 无软删/可疑过滤。软删/可疑 KOL 虽从 /match 列表隐藏，detail 直链仍可渲染，与列表口径不一致。
- **严重性：中。** 建议 `where:{id, deletedAt:null}` 命中走 notFound()。

### M5 — tsvector 全文搜索写无人读 + query 构造 bug [形态 B]
- `kol.search_vector` 由 DB trigger 每写必更，唯一读者 `searchKols()`(`tsvector.ts:49`)**全仓零调用**（UI 搜索走 ILIKE）；且 `buildKolSearchQuery` `replace(/ /g,"")` 把多词压成单 token 已坏。`filters.ts:415` 注释谎称"available via searchKols()"。
- **严重性：中（债，死代码已坏）。**

### M6 — 孤儿 API 端点（零 fetch 调用方）[形态 C]
- `PATCH /api/kols/[id]`（邮箱，emailSource enum 已过期对不上现网词表）、`POST /api/campaigns/[id]/kols` + `[kolId] PATCH/DELETE`、`relationship-status` REST。均实装无调用方（配套 UI 已删/未建）。
- **严重性：中（死代码债 + 误导性"API 已就绪"表象）。**

### M7 — AI 语义搜索假功能（aiQuery/?ai=），显示筛选 chip 实不筛 [形态 B/C]
- `?ai=<query>` 全套基建（解析 `filters.ts:317`、chip 展示 `MatchActiveFilters.tsx:46`、empty-state 计数）存在，但 `buildKolWhere` 从不读 aiQuery，配套引擎 `runSemanticKolSearch`(`semantic-search.ts:115`)零调用。`filters.ts:319 search=aiQuery?undefined:searchTrimmed` 还会抹掉 search。若 `?ai=` 经 URL 置位 → 显示 "AI: xxx" 筛选 chip 实际返回整池无筛选。现网搜索框 `name="search"` 暂不产 `?ai=`，入口未暴露。
- **严重性：中（潜在用户可见"假筛选"，最危险的中间态）。** 建议接线 runSemanticKolSearch 或整链移除。

### M8 — ROI AI Insights 喂模型 startedAt:null/kolCount:0 硬编码
- `roi/actions.ts:70` 把每条 campaign 的这两字段写死传 AI，尽管类型声明了真实字段 → AI 洞察质量被悄悄削弱。
- **严重性：中。** 建议 loader 真取或从 payload 删除。

## 3. ✅ 诚实 stub / 已知债（非病灶，列出以正名）

- **通知 bell**：0 基础设施但全程 TODO 标注 + backlog BL-056 跟踪，`layout.tsx:38` 硬编码 0（不再是曾经的永显黄点）。无谎报。
- **WeeklyReport "Download PDF"**：`window.print()` + 打印 CSS，对应 BL-016 deferred 真 PDF，注释/toast 不谎称生成服务端文件。
- **send_queue tab**：真 disabled + "comingB4" tooltip。
- **CPI 对比卡**：硬编码行业基准但带 sample 角标 + 公开数据来源标注。
- **prewarm 队列内存 stub**：同 H1 同源缺失基建，当前只影响非关键 LLM 预热（失败回退实时生成）。
- **event_log 写多读少**（18 写 1 读）：文档定位 observability/future webhooks，设计如此。
- **死代码**：`runSemanticKolSearch`/`loadCoverageGapSummary` 零调用；Dashboard 进度条硬编码 75%；status:"queued" 死筛选项。低优先。
- **CRM**：relationship-status/funnel/recent-changes 全链真实；`avgRoi:null`/spendSparkline 有显式 placeholder 标注。

## 4. 核心主链健康确认（无病灶）

KOL 同步(apify→DB upsert)/embedding/value-score/smart-match 四条核心管线、Brief AI 生成→建 campaign、Resend 真发(prod 缺 key 直接拒发不静默 mock)、webhook 五态状态机(除 replied)、RLS withTenant 事务级隔离、audit_log 真写真读(7 读者)、rate-limit 三限流器真 Redis、saved-searches、admin 监控页(真拉外部 apify-kol-service + zod)、ROI 汇总/趋势/表格(真按 closedAt 分桶聚合)、WeeklyReport 生成/分享/撤销 token —— 均真实闭环。

## 5. 建议处置（待用户决策）

| 编号 | 发现 | 建议批次 | 优先级 |
|---|---|---|---|
| H1 | 邮件发送同步阻塞 + 队列 stub | hotfix 止血(分批/回报) + BL 真 BullMQ | 高 |
| H2 | Reply 链只读不写 | hotfix 止血(prod 空态标注) | 高 |
| H3 | kol_campaign 双 accept 口径错乱 | hotfix(读口径加 suggestion_status 过滤) | 高 |
| H4 | /assets 泄漏解释缓存行 | hotfix(type 白名单) | 高 |
| H5 | /kols 面包屑 404 | hotfix(改指 /match) | 高 |
| H6 | Edit Brief 404 | 并入 M1 决策 | 高 |
| M1 | campaign 编辑写路径断线 | 需先定性(退役 or 补入口) | 中 |
| M2 | KPI 快照 cron | 核实 prod crontab | 中 |
| M4/M5/M6/M7/M8 | 软删过滤/死代码/孤儿 API/假语义搜索/ROI 硬编码 | 合并一个"实装链路收口"批次 | 中 |

> H4/H5 极小改动可考虑并入 BL-099 或单开小 hotfix；H1/H2/H3 是独立的真 bug，建议各自走铁律 #9 hotfix 流程（Planner 方案→用户确认→Generator 修→Codex 验）。

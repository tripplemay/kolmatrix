---
name: BIx-mvp-polish-pass
description: MVP 上线前最后 polish - /crm 3 disabled controls 真做 + 5 项 misc 文案/小修 + 11 页 edge states critical paths + YouTube sync 配额优化 P1 ~89% + 真 engagement batch + 前端 perf Critical+High 六件套（next.config.ts / next/font / next/image / recharts dynamic / markdown dynamic / AppShellLayout island）
status: decisions-locked, awaits MVP-internal-demo-prep done
created_by: johnsong (Planner)
created_at: 2026-04-30
decisions_locked_at: 2026-04-30
revised_at: 2026-05-01（用户接受前端审计 CR-4/5/6 + H-P1/2/3 并入 F005，~1.4 day Generator）
estimated_effort: ~5-5.5 day Generator + 0.5 day Reviewer
features_count: 5
prerequisites:
  - MVP-internal-demo-prep done（含 P0 polish 4 项 F006/F007）
trigger: MVP-internal-demo-prep done 后立即启动
---

# BIx-mvp-polish-pass — MVP 上线前最后 polish

## 1. 背景与目标

### 1.1 来源

- `docs/product/MVP-polish-audit-2026-04-30.md` §"P1 — 独立 micro-batch / 团队 demo 后期补"
- `docs/reviews/frontend-audit-2026-05-01.md`（三 agent 并行前端审计 6 Critical / 16 High / 29 Medium / 15 Low / 2 Info）

用户 2026-04-30 决议：
- 取消 P1-5 mobile responsive（团队不会通过移动端使用产品）
- 接受 P0 4 项并入 MVP-internal-demo-prep（F006/F007）
- P1 必做 6 项 + critical paths edge states 合并到本批次

用户 2026-05-01 决议（前端审计后续）：
- F005 = CR-4/5/6（性能 Critical 三件套）+ H-P1/2/3（高价值 perf 三件套）共六件套合并 → 选项 (γ)
- 跳过 H-P4 Suspense 边界（范围易扩 → 留 backlog 评估）+ H-P5 列表虚拟化（无 scale signal → BL-022）
- CR-1/2/3 安全 Critical + H-S1/2/3 安全 High 走 backlog 单独跟踪

### 1.2 目标

清掉团队第一眼可见的 ghost controls（6 个 disabled 按钮），消除"半成品观感"；并修关键 edge states（loading / empty / error）让团队体验稳定；**完成前端 perf 关键基础设施（next.config.ts / next/font / next/image / recharts+markdown dynamic / AppShellLayout island），降初始 JS ≥200KB + LCP −30%。**

### 1.3 非目标

- ❌ Mobile 响应式适配（团队不用 mobile）
- ❌ ja/ko/es 翻译人审（产品工作非 dev → BL-014 backlog）
- ❌ Visual regression 跨平台（infra → BL-015 backlog）
- ❌ jsPDF / puppeteer 真 PDF（团队不抱怨可不做 → BL-016 backlog）
- ❌ /shared/weekly-report token 过期 + 撤销（团队内部 demo 不会真分享给外部）
- ❌ 11 页 mobile 适配 / 全量 edge states 系统性 spot check（仅 critical paths）
- ❌ H-P4 全应用 Suspense / loading.tsx 边界（范围易扩 → backlog 单独评估）
- ❌ H-P5 列表页虚拟化（当前分页兜底，无 scale signal → BL-022 backlog）
- ❌ 前端审计 CR-1/2/3 安全 Critical + H-S1/2/3 安全 High（走 backlog 单独跟踪，团队内部 demo 风险低）

## 2. 范围（5 features）

> **2026-05-01 修订**：原 4 features → 5 features，新增 F005 前端 perf 六件套。详见 `docs/reviews/frontend-audit-2026-05-01.md` Critical/High 路线图 + 用户 2026-05-01 (γ) 决议。


### F001 — /crm Header 3 个 disabled 控件清理

**Executor：** generator
**估时：** ~1 day

**实现：**

1. **时间 toggle（thisQuarter / Last 90d / allTime）真做**
   - 当前：仅 "Last 90d" 可点，其他两个 disabled
   - 改造：3 个 button 全可点，按 created_at 范围 filter 4 个 CRM 组件：
     - `CrmKpiStrip`：collabKpi 按时间窗 aggregate
     - `CrmPipelineBars`：stageDistribution 按时间窗
     - `CrmFunnel`：funnelMetrics 按时间窗
     - `CrmRecentChanges`：audit_log 按时间窗
   - URL 参数：`?range=thisQuarter|last90d|allTime`，default `last90d`
   - `runCrmOverview(tenantId, { range })` 接受 range 参数

2. **Export CSV 按钮真做**
   - 当前：disabled with tooltip
   - 改造：Server Action 生成 CRM 数据 CSV（KOL 列表 + 阶段 + kolCampaign + 金额）
   - 用 `Content-Disposition: attachment; filename="crm-{tenant}-{YYYYMMDD}.csv"` 下载

3. **+Manual log 按钮删除（不真做，PRD §11.4 已说手动接入 webhook = B4-extended）**
   - 直接从 CrmHeader 移除该按钮
   - 删除 i18n key `crm.header.manualLog*`

**Acceptance：**
- /crm 时间 toggle 3 个全可点击，切换刷新 4 个组件数据
- /crm Export CSV 点击下载真实 CSV 文件
- /crm +Manual log 按钮不再显示
- tests/integration/crm-time-range.test.ts 验证 3 range × 4 组件
- tests/integration/crm-export-csv.test.ts 验证 CSV 内容
- staging git_sha 与本 commit 一致

### F002 — Misc 5 项 polish（campaigns Owner filter / database Email btn / PDF 文案 / mock_sent fail-fast）

**Executor：** generator
**估时：** ~2h

**实现：**

1. **/campaigns Owner filter 真做（P1-3）**
   - 当前：disabled
   - 改造：filter 取自 `Campaign.ownerUserId`，显示当前 tenant 内 user 列表
   - SQL where + URL 参数 `?owner=<userId>`
   - 当 tenant 仅 1 用户时 hide filter（避免冗余）

2. **/database BulkActionBar Email 按钮改跳转（P1-4）**
   - 当前：disabled，注释说 "point users at /outreach instead"
   - 改造：onClick → `router.push('/outreach?kolIds=' + selectedKolIds.join(','))`
   - /outreach 页接收 `?kolIds=...` query 自动预选

3. **/weekly-report PDF 帮助文案（P1-8a）**
   - 当前：Download PDF 实际是 `window.print()` 但用户不知道
   - 改造：button title="Save as PDF in the print dialog"；click 后 toast："Choose 'Save as PDF' in the print dialog that opens"

4. **邮件 mock_sent fail-fast（P1-9）**
   - 当前：`src/lib/email/resend.ts` 无 RESEND_API_KEY 时 silent mock_sent
   - 改造：production 环境（NODE_ENV=production）下无 key 时 `throw new Error('RESEND_API_KEY missing in production')`
   - dev 仍允许 mock_sent（local dev 不一定有 key）

5. **/campaigns/AiSuggestionsCard "Coming with B2" badge 已在 MVP-internal-demo-prep F007 处理**（不重复）

**Acceptance：**
- /campaigns Owner filter 真过滤（tenant 单用户时 hide）
- /database BulkActionBar Email 跳转 /outreach 带预选
- /weekly-report Download PDF 显示友好 print 对话框引导
- 邮件无 key + production env → 立即 throw（不 silent mock）
- existing tests 不破坏
- staging git_sha 与本 commit 一致

### F003 — 11 页 critical paths edge states spot check + 必修

**Executor：** generator
**估时：** ~半天 (~4h)

**实现：**

针对 11 页 critical paths（不全量 spot check），检查并修：

| 页面 | Critical empty state | Critical error state |
|---|---|---|
| `/dashboard` | 新 tenant（0 KOL / 0 Campaign）→ 不崩 | EmailLog query 失败 → friendly fallback |
| `/discovery` | 0 KOL match filter → 友好 empty + 引导清 filter | aigcgateway Smart Match 失败 → toast |
| `/database` | 0 saved KOL → 友好 empty + 引导 /discovery | API 500 → error boundary |
| `/kols/[id]` | invalid id → 404 friendly | YouTube API 失败 → fallback to cached |
| `/knowledge-base` | 0 Product → 引导创建 | aigcgateway 生成失败 → retry button |
| `/campaigns` | 0 Campaign → 友好 empty + New Campaign CTA | API 失败 → error boundary |
| `/campaigns/[id]` | 0 KOL in campaign → 引导 Add KOL | revenue 录入失败 → form error |
| `/outreach` | 0 sendable KOL → 引导 /campaigns/[id] 添加 | Resend 失败 → error toast |
| `/crm` | 0 audit_log → 友好 empty | runCrmOverview 失败 → error |
| `/roi` | 0 closed campaign → 友好 empty | API 500 → error boundary |
| `/weekly-report` | 0 历史 → 引导 Generate | 生成失败 → retry CTA |

**重点修：** loading skeleton 仅明显空白 ≥ 1.5s 的页加（默认 Next.js suspense 已处理大多数）；error boundary 全 11 页加 `error.tsx` 兜底。

**Acceptance：**
- 11 页有 `error.tsx` 兜底（display friendly error + reload CTA）
- 11 页关键 empty state 有 friendly 引导（不出现纯白屏 / Lorem ipsum）
- tests/integration/edge-states-coverage.test.ts 验证 11 页 error boundary 存在
- 手工 spot check：dev 模式停 PG → 11 页全部 graceful（非崩溃）
- staging git_sha 与本 commit 一致

### F004 — YouTube sync 配额优化（P1 ~89% 利用率 + 真 engagement batch）

**Executor：** generator
**估时：** ~1.5-2 day

**背景：**

`docs/product/MVP-sync-strategy-audit-2026-04-30`（本会话归档）发现当前 B6 daily sync 仅用 18% 配额（1,805/10,000u），且 dedupe rate 趋向 99% → 数日内 insert→0。用户 2026-04-30 决议 P1 ~89% 利用率方案。

**实现：**

1. **search.list `maxResults` 10 → 50（免费 5×）**
   - `src/lib/kol-sync/adapters/youtube.ts:DAILY_MAX_RESULTS` 10 → 50
   - 单次 search.list cost 不变（100u），返回从 10 → 50 → 信息密度 ×5

2. **Region 矩阵 6 → 14**
   - 新增 8 个：GB / DE / BR / MX / TH / ID / IN / ES
   - `DAILY_REGIONS` 数组扩展
   - 覆盖欧洲 + 拉美 + 东南亚 + 印度 + 西语市场

3. **Keyword 池 3 固定 → 12-15 池 day-of-year mod 6 轮转**
   - 每 region 维护 12-15 个游戏品类相关词（覆盖 MOBA / FPS / RPG / 二次元 / 直播 / 解说 / 攻略 / Vtuber / 测评 / 速通 / VR / indie / 手游 等品类）
   - 每天根据 `dayOfYear % 6` 决定取池中第 6×i + (0..5) 那 6 个 keyword
   - `DAILY_KEYWORDS_BY_REGION` 改为 `DAILY_KEYWORD_POOL_BY_REGION` + 加 `pickDailyKeywords(region, date): readonly string[]` helper

4. **Page 轮转（day-of-year mod 6 cycle）**
   - day 1-3 of cycle: page 1（默认）
   - day 4-5: page 2（用上次 nextPageToken）
   - day 6: page 3
   - search.list 调用时按 cycle 加 `pageToken` 参数
   - cursor 保存：写入 `kol_sync_cursor` 表（新建简单 KV 表 tenantId/region/keyword → nextPageToken），或简化为内存 Map（每次冷启动重置）—— 选**前者，新表 + migration**（与 BL-012 6 月接入兼容）

5. **publishedAfter 切片（4 个时间窗）**
   - 4 个时间窗：last_90_days / last_180_days / last_365_days / last_730_days
   - 每天按 `dayOfYear % 4` 选一个时间窗，对 6 个核心 region 各打 1 个 search.list
   - 6 search × 100u = 600u/day
   - 命中"新涌现"channel（默认 query 受 relevance 排序压制看不到）

6. **分层 refresh（替代 FIFO）**
   - Tier 1：top 50 by valueScore → 每 3 天 refresh
   - Tier 2：51-500 by valueScore → 每 7 天 refresh
   - Tier 3：500+ by lastSyncedAt asc → 每 21 天 refresh
   - **Flagged**（metadata.flags.suspicious_growth = true）→ 必入当日 batch
   - 总日 refresh ~150-200 KOL，cost ~4u（3 channels.list calls，几乎不变）

7. **Top 100 KOL 真 engagement batch 预计算（替代 B5 F004 lazy-load）**
   - 每天选 top 100 KOL by valueScore
   - 用 channels.list 拿 contentDetails（uploads playlist id）—— 100 / 50 = 2 calls = 2u
   - 用 playlistItems.list 拿 uploads playlist 最新 6 video ids —— 100 calls × 1u = 100u
   - 用 videos.list 拿 6 × 100 = 600 video stats（batched 50/call = 12 calls）—— 12u
   - 计算 avg(likeCount + commentCount) / avg(viewCount) → 写回 `Kol.engagementRate`
   - 同时把 6 视频 metadata（id / title / thumbnailUrl / viewCount / likeCount / publishedAt）写入 `Kol.metadata.latestVideos[]`（B5 详情页 top 100 KOL 直接读，避开 lazy-load）
   - Total batch cost: **~114u/day**

8. **Per-matrix observability log enhancement**
   - 改 `src/lib/kol-sync/log.ts` `DailyLogLine` schema
   - 加 `perMatrix: Array<{region, keyword, page, found, newAfterDedupe, filterRejections}>`
   - 加 `engagementBatchStats: {topKolsProcessed, engagementUpdated, latestVideosUpdated}`
   - 兼容现有 jq 查询（保留原顶层字段）

**配额组合（P1 ~89% utilization）：**

```
Discover 主矩阵：14 region × 6 keyword × 100u  = 8,400u
publishedAfter 切片：6 search × 100u           =   600u
channels.list (enrich 14 × 1u + tier 2u)       =    16u
Top 100 engagement batch                        =   114u
healthcheck                                     =     1u
─────────────────────────────────────────────────────
                                          总计 = 9,131u (91%)
                                       安全余量 =   869u
```

> **注：** 91% 略高于"目标 88%"。若实测某天 quota window edge 触发 403，可减 publishedAfter 切片 6 → 4（-200u → 88.6%）作 fallback。BIx F004 spec 提供 env var `KOL_SYNC_PUBLISHED_AFTER_SLICES` 控制（默认 6，告警时降 4）。

**Acceptance：**
- maxResults 10 → 50 落地
- DAILY_REGIONS 14 region 完整
- KEYWORD_POOL 每 region ≥ 12 词，day-of-year mod 轮转 6 词逻辑
- Page 轮转 cursor 持久化（kol_sync_cursor 表 + migration + ROLLBACK SQL）
- publishedAfter 4 切片轮转
- 分层 refresh 按 valueScore 切 Tier 1/2/3 + flagged 必入
- Top 100 engagement batch + latestVideos 写入 Kol.engagementRate + Kol.metadata.latestVideos
- DailyLogLine schema 加 perMatrix + engagementBatchStats
- tests/integration/sync-quota-optimization.test.ts 验证 14 region matrix + 池轮转 + 分层 refresh + engagement batch
- staging 跑 7 天连续观察：每日 inserted ≥ 30（vs 当前 1-8）+ 配额 8,500-9,200u + 0 errors
- staging git_sha 与本 commit 一致

**用户 2026-05-01 已裁决（c）：**

- `FILTER_MIN_SUBSCRIBERS` 改为 env var `KOL_SYNC_MIN_SUBSCRIBERS`，默认值：
  - **prod：`1000`**（与 PRD §10.1 "500-10K 微网红" + `quality.ts` 1K 阈值对齐）
  - **staging：`10000`**（保留降噪能力，避免 staging 测试数据池过散）
- 实现要求：`scripts/seed-kol-from-youtube.ts` + `src/lib/kol-sync/adapters/youtube.ts` 读 `process.env.KOL_SYNC_MIN_SUBSCRIBERS`，未设时默认 `1000`；staging `.env.staging` 显式写 `KOL_SYNC_MIN_SUBSCRIBERS=10000`；prod `.env.production` 不写或写 `1000`
- 文档：spec 起草 acceptance 加一条「env var 落入 .env.staging + 验证 staging 跑 sync 时拉取下界=10K」

### F005 — 前端 perf Critical + High 六件套（next.config.ts / next/font / next/image / recharts dynamic / markdown dynamic / AppShellLayout island）

**Executor：** generator
**估时：** ~1.4 day（~11.2h，含 1.5h 缓冲）

**来源：** `docs/reviews/frontend-audit-2026-05-01.md` CR-4/5/6 + H-P1/2/3。用户 2026-05-01 (γ) 决议。

**实现：**

#### Part A — `next.config.ts` 完整配置（CR-4，~3h）

当前 `next.config.ts` 仅挂 next-intl 插件。补全：

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },          // YouTube thumbnail
      { protocol: "https", hostname: "yt3.ggpht.com" },        // YouTube channel avatar legacy
      { protocol: "https", hostname: "yt3.googleusercontent.com" }, // YouTube channel avatar new
      // Generator 开工时 grep KOL 数据中 platform=twitch/tiktok/bilibili 的实际 CDN 域补齐
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["recharts", "@base-ui/react"],
  },
  serverExternalPackages: ["@prisma/client", "bcrypt", "googleapis", "resend"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // CSP 走 Report-Only 一周观察期，本批次只做 Report-Only，不切 enforce
          { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://aigc.guangai.ai; frame-ancestors 'none';" },
        ],
      },
    ];
  },
};
```

#### Part B — Material Symbols 字体改 next/font 自托管（CR-5，~2h）

当前 `src/app/layout.tsx:33-36` 直接 `<link>` 加载 Google Fonts Material Symbols 完整轴变量字体（~300+ KB woff2，第三方域名 DNS+TLS+下载，无 `font-display: swap`）。

**Planner 决议（2026-05-01）：** 走 next/font 自托管 Material Symbols 子集（**保留**当前图标系统，不破坏全应用 100+ 处 `<span class="material-symbols-outlined">` 调用）。lucide-react M-P8 卸载单独处理（不在 F005 范围）。

实现路径：
1. 生成项目实际使用的 icon 子集（`grep -ohE 'material-symbols-outlined.*?>[\w_]+' src/ | sort -u` 得到约 100 个 icon name）
2. 用 [google-fonts-helper](https://gwfh.mranftl.com/) 或 [glyphhanger](https://github.com/zachleat/glyphhanger) 生成 Material Symbols Outlined OPSZ+WGHT 子集 woff2（仅含使用的 icon）
3. 落 `public/fonts/material-symbols-subset.woff2`
4. `src/app/layout.tsx` 用 `next/font/local` 加载，`display: 'swap'`
5. 删除 `<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined">`

**预期：** 主线程阻塞 −200~400ms，FOIT 消除。

#### Part C — 7 处原生 `<img>` 替换为 `<Image>`（CR-6，~3h）

audit 列出 7 处文件全替换为 `next/image`：

| 文件 | 类型 | 处理 |
|---|---|---|
| `CampaignKolRow.tsx:117` | KOL 头像 | `<Image fill sizes="40px">` w/ object-cover |
| `KolHero.tsx:49` | KOL banner | `<Image priority width={1200} height={240}>` 首屏 |
| `RecentVideosGrid.tsx:47` | YouTube 缩略图 6 张 | `<Image width={320} height={180} loading="lazy">` |
| `AvatarWithPlatformBadge.tsx:68` | KOL 通用头像 | `<Image fill sizes={size variant}>` |
| `CampaignRow.tsx:62` | mini avatar | `<Image width={32} height={32}>` |
| `SidebarUserChip.tsx:14` | 用户头像 | 同上 |
| `UserAvatarMenu.tsx:46` | 用户头像 | 同上 |

**全部加 `width/height` 防 CLS；`priority` 仅给 KolHero banner（首屏 LCP 候选）；其他 lazy 默认。**

#### Part D — recharts 三处 dynamic（H-P1，~45min）

参 `src/app/[locale]/(app)/kols/[id]/TopicCloudClient.tsx:16` 范式，三处 chart 复制套路：

```tsx
// roi/RoiTrendChart.tsx
"use client";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("./RoiTrendChartImpl"), { ssr: false });
export default function RoiTrendChart(props) { return <Chart {...props} />; }
```

三处目标文件：
- `src/app/[locale]/(app)/roi/RoiTrendChart.tsx:18-28`
- `src/app/[locale]/(app)/campaigns/[id]/EmailPerformanceChart.tsx:11-20`
- `src/features/dashboard/EmailPerformanceChart.tsx:11-19`

**预期：** 每页 −90KB gzipped × 3 页 = **−270KB**（与 CR-4 optimizePackageImports 协同：tree-shake + dynamic 拆 chunk 双重收益）。

#### Part E — react-markdown + remark-gfm dynamic（H-P2，~30min）

两处目标：
- `src/app/[locale]/(app)/weekly-report/WeeklyReportRenderer.tsx:12-13`
- `src/app/[locale]/(app)/outreach/templates/TemplateWorkspaceClient.tsx:5-6`

同 dynamic 套路，markdown 子树标 dynamic，外壳保留。**预期：−50KB gzipped。**

#### Part F — AppShellLayout 拆 ActiveNavClient island（H-P3，~1.5h）

当前 `src/components/layout/AppShellLayout.tsx:1` 整文件标 `"use client"`，仅为了在 `Sidebar` / `TopBar` 里调 `usePathname()` 高亮当前路由。代价：sidebar 全子树（logo / nav links / footer / chip）都拉到 client bundle。

改造：
1. 拆出 `src/components/layout/ActiveNavClient.tsx`（~30 行 `"use client"`，仅含 `usePathname()` + active class 计算 + 把 active path 通过 context/data attribute 暴露给 nav links）
2. `AppShellLayout.tsx` 删 `"use client"`，回归 server component
3. Sidebar 子树（logo / 静态 nav 列表 / SidebarUserChip）全部 server-rendered，hydration 仅留 ActiveNavClient

**预期：** −15-25KB gzipped + hydration 减负 ~50-100ms。

**注意：** sidebar active state 是用户高频感知的视觉，staging spot check 必须覆盖每条 nav link 切换正确。

**Acceptance：**

- `npm run build` + `@next/bundle-analyzer` 实测初始 JS（dashboard / campaigns / roi / discovery）减 ≥200KB gzipped（audit 估 400-500KB，留余量）
- next/image 替换后 staging KOL 列表页 / Discovery / Detail 页所有图片正常渲染（无 broken image / 无 CLS）
- `curl -I https://staging.kol.guangai.ai/` 验证 6 个 HTTP 安全头存在（X-Frame-Options DENY / X-Content-Type-Options nosniff / Referrer-Policy / Permissions-Policy / HSTS / CSP-Report-Only）
- Lighthouse 移动端 perf score ≥ 75（base 估 ~50；目标 LCP −30%）
- recharts 三页 client bundle 不含 chart 代码（用 bundle-analyzer 验证），首次访问按需 dynamic load
- WeeklyReportRenderer / TemplateWorkspaceClient 不再 SSR markdown bundle，client dynamic load
- AppShellLayout.tsx 不再有 `"use client"`，仅 ActiveNavClient.tsx 标 client；sidebar active state 在所有 nav link 上正确高亮
- Material Symbols 字体走 next/font local，`<link>` Google Fonts 已删；DevTools Network 看不到 fonts.googleapis.com 请求；100+ 处 `material-symbols-outlined` icon 全部正常渲染（无字符方框）
- CSP Report-Only 一周观察期不报告任何来自正常使用的 violation（团队走查后下批次切 enforce）
- existing tests 不破坏；visual baseline 必要时重生（dashboard.spec.ts / campaigns / roi / kols-detail / login）
- staging git_sha 与本 commit 一致

**风险（详见 §5）：** next/image CDN 域漏配 / next/font 子集漏 icon / AppShellLayout 拆 island 影响 sidebar active / CSP enforce 漏白名单。

## 3. 关键设计决策（已 lock）

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 范围 | 仅 P1 必做 6 项 + critical paths edge states | 移除 mobile（团队不用）+ 移 i18n/visual baseline 等到 backlog |
| /crm Manual log 按钮 | 删除（非 disable） | PRD §11.4 已锁 Manual log = B4-extended |
| /campaigns Import 按钮 | 已在 MVP-internal-demo-prep F007 删除 | 不重复 |
| /campaigns AiSuggestionsCard | 已在 MVP-internal-demo-prep F007 修文案 | 不重复 |
| Owner filter（仅 1 用户时）| 隐藏 filter | 避免冗余 UI |
| edge states 范围 | 仅 critical paths（11 页 × 1-2 关键 state）| 全量 spot check 工时翻倍，团队 demo 不需要 |
| mobile responsive | **完全移除** | 用户 2026-04-30 明确 "团队不会通过移动端使用产品" |
| **YouTube sync 配额利用率** | **P1 ~89%**（原 18% → ~91% 满载，留 ~9% 安全余量）| 用户 2026-04-30 决议 P1（加 IN/ES 共 14 region）；从昨天数据看 82% 配额浪费且 dedupe rate 攀升至 99% |
| **真 engagement 实现路径** | **Batch 预计算（top 100 KOL/day，cost ~114u）替代 B5 F004 lazy-load** | 用户同意；ROI 提升 ~50×（lazy-load 100u/次 vs batch 1.14u/channel）；详情页瞬开不依赖 API |
| **Page 轮转 cursor 持久化** | 新 `kol_sync_cursor` 表 + migration | day-of-year mod cycle 跨 cron run 保留 nextPageToken |
| **F005 范围 = CR-4/5/6 + H-P1/2/3（六件套）** | 用户 2026-05-01 (γ) | 跳过 H-P4 Suspense（范围易扩 → backlog）+ H-P5 虚拟化（无 scale signal → BL-022） |
| **Material Symbols 字体策略** | next/font 自托管子集 | 保留视觉一致；不切 Lucide React（M-P8 卸载单独处理） |
| **CSP 上线策略** | Report-Only 一周观察期 | 本批次只做 Report-Only，下批次切 enforce；避免一次性切到 enforce 误伤 |
| **next/image 替换范围** | 全 7 处一次性替换 | 渐进式替换会留 mixed pattern 长期债 |

## 4. 依赖关系

```
MVP-internal-demo-prep done → BIx-mvp-polish-pass building
                                       ↓
                                F001 + F002 + F003 + F004 + F005 (Generator 串行)
                                       ↓
                                Reviewer L1+L2 verifying（含 perf 实测：bundle-analyzer + Lighthouse）
                                       ↓
                                done → 团队 demo 启用 ⭐
```

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| /crm 时间 toggle 改 4 个组件可能影响 visual baseline | 中 | F001 含 baseline 更新；先 staging 验证 |
| Export CSV 真做时数据量大可能超时 | 低 | F001 限 max 10K 行 / 加 streaming |
| Owner filter SQL 性能（小 tenant 不影响）| 低 | 单 tenant 用户 ≤ 5 时无索引压力 |
| edge states 11 页 critical paths 工时超预估 | 中 | 缓冲 1h；如某页复杂超预算 → 推到 backlog |
| 邮件 fail-fast 改动可能让 dev 跑测试失败 | 低 | F002 限 production env；dev 仍 silent mock |
| **F005-A** next/image CDN 域漏配 → broken image | 中 | Acceptance 含 staging 三页浏览器走查；漏配立即补 remotePatterns；优先 grep KOL platform CDN 域 |
| **F005-B** next/font 子集生成漏覆盖某 icon → 字符方框 | 中 | 子集脚本 grep 全代码所有 `material-symbols-outlined` icon name；CI 加 icon name 与子集 diff 检查 |
| **F005-C** AppShellLayout 拆 island 影响 sidebar active state | 中 | staging spot check 必须覆盖每条 nav link 切换；e2e 测试加 active class 断言 |
| **F005-D** CSP Report-Only 切 enforce 时漏白名单（本批次不切，下批次） | 中 | 本批次只 Report-Only；一周 violation log 观察后再切 |
| **F005-E** recharts/markdown dynamic 后首次渲染闪 loading skeleton | 低 | dynamic 默认 fallback 为 null（不闪）；如有体感差 → 加 lightweight skeleton |
| **F005-F** Lighthouse perf score < 75（达不到 acceptance）| 中 | 留 1.5h 缓冲调优；如全六件套已落地仍未达 → 单独 backlog 跟踪（不阻塞 done）|

## 6. 验收方式

### L1 自动化
- F001 crm-time-range + crm-export-csv integration tests
- F002 owner-filter + bulk-email-jump integration tests
- F003 edge-states-coverage 11 页 error.tsx 存在性检查
- F005 next.config.ts 配置存在性 + remotePatterns 完整性 unit test
- F005 visual baseline 重生（dashboard / campaigns / roi / kols-detail / login 必查）
- typecheck / lint / 现有套件不退化

### L2 staging
- /crm 3 时间 toggle 切换 + Export CSV 下载
- /campaigns Owner filter 真过滤
- /database BulkActionBar Email 跳转 /outreach 带 ?kolIds=...
- 11 页 error.tsx + empty state spot check（dev 停 PG → 全 graceful）
- **F005 perf 实测：** `npm run build` + `@next/bundle-analyzer` 截图 chunk 大小变化（dashboard / campaigns / roi 三页 chart bundle 移除）；Lighthouse 移动端 perf score ≥ 75
- **F005 安全头：** `curl -I https://staging.kol.guangai.ai/` 验证 6 个 HTTP 头存在
- **F005 图片：** Discovery / Detail / Campaigns 三页浏览器走查 — 所有 KOL 头像 + banner + 视频缩略图 200 加载，无 broken image，无 CLS
- **F005 字体：** DevTools Network 看不到 fonts.googleapis.com 请求；100+ 处 `material-symbols-outlined` icon 全渲染（重点查 KOL list / Campaigns Header / Sidebar nav）

### L3 prod 烟测
- 同 MVP-internal-demo-prep F005 checklist 但补 BIx 涉及功能（time toggle / Export CSV / Owner filter）
- **F005 perf 二次验证：** prod Lighthouse 实测 + bundle-analyzer 对比 build artifact

## 7. 引用文档

- `docs/product/MVP-polish-audit-2026-04-30.md`（本批次起源 + 完整 P1 清单）
- `docs/reviews/frontend-audit-2026-05-01.md`（F005 来源 — 三 agent 并行前端审计 6 Critical / 16 High / 29 Medium / 15 Low / 2 Info）
- `docs/specs/MVP-internal-demo-prep-spec.md`（前置批次，F006/F007 已含 P0 4 项）
- `docs/product/KOLMatrix-MVP-PRD.md` §11.4（CRM 简化版决策）+ §12（Out of Scope）
- `framework/harness/ui-fidelity-guardrail.md`（ghost controls 容许带 tooltip 的 guardrail）

## 8. 启动检查清单（Generator 开工前）

- [ ] MVP-internal-demo-prep done + signoff
- [ ] 用户触发 prod redeploy（含 F006/F007）
- [ ] prod /api/health 200 + redis.status="not_used"（F007 落地证据）
- [ ] /campaigns 页面无 "Coming with B2" badge（F007 落地证据）
- [ ] F005 开工前 `grep -ohE 'material-symbols-outlined.*?>[\\w_]+' src/ | sort -u` 出 icon name 清单留底（用于子集生成验证）
- [ ] F005 开工前 `npm install --save-dev @next/bundle-analyzer`（如尚未安装）

## 9. 估时

| 环节 | 预估 | 执行者 |
|---|---|---|
| F001 /crm 3 disabled 控件清理（time toggle real / Export CSV impl / Manual log delete）| ~1 day | Generator |
| F002 Misc 5 项 polish（Owner filter + Email btn + PDF 文案 + mock_sent + AiSuggestions 已删）| ~2h | Generator |
| F003 11 页 critical paths edge states + 必修 | ~半天 (~4h) | Generator |
| **F004 YouTube sync 配额优化（P1 ~89% + 真 engagement batch）**| ~1.5-2 day | Generator |
| **F005 前端 perf 六件套（CR-4/5/6 + H-P1/2/3）**| ~1.4 day (~11.2h) | Generator |
| 缓冲 | ~4h | — |
| **总计** | **~5-5.5 day Generator + 0.5 day Reviewer** | — |

## 10. 用户决策（2026-04-30 lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | Mobile responsive 是否做 | ❌ 不做（团队不用 mobile）|
| 2 | P0 4 项归属 | ✅ 并入 MVP-internal-demo-prep F006/F007 |
| 3 | P1 范围 | ✅ 必做 6 项 + critical edge states，其他入 backlog |
| 4 | 时机 | ✅ MVP-internal-demo-prep done 后立即启动 |
| 5 | 整体方案 | ✅ 单一 BIx-mvp-polish-pass micro-batch（原 ~2-2.5 day，加 F004 后 ~3.5-4.5 day）|

### 2026-04-30 二次决议（YouTube sync 配额优化）

| # | 问题 | 用户答复 |
|---|---|---|
| 6 | 配额利用率目标 | ✅ **P1 ~89%**（加 IN/ES 共 14 region；P2 95% 危险，P3 98% 极危险） |
| 7 | 真 engagement 实现路径 | ✅ **替代 B5 F004 lazy-load，改 BIx F004 batch 预计算 top 100 KOL/day** |
| 8 | 改造批次归属 | ✅ **C 方案：合到 BIx-mvp-polish-pass**（避免拆碎独立批次）|
| 9 | FILTER_MIN_SUBSCRIBERS = 10K vs PRD 微网红 | ✅ **(c) env var `KOL_SYNC_MIN_SUBSCRIBERS`：prod 默认 1000 / staging 显式 10000** —— 与 PRD §10.1 微网红对齐 + 保留 staging 降噪能力（用户 2026-05-01 决议）|

### 2026-05-01 三次决议（前端审计 perf 整改）

| # | 问题 | 用户答复 |
|---|---|---|
| 10 | 6 项前端 Critical 是否插队 MVP-internal-demo-prep | ❌ 不插队（团队内部 demo 风险低；MVP 批次保持 7 features）|
| 11 | F005 范围（CR-4/5/6 + H-P1/2/3 / 4 / 5 是否一并入 BIx）| ✅ **(γ)** 仅 CR-4/5/6 + H-P1/2/3 六件套；H-P4 Suspense 进 backlog 评估，H-P5 虚拟化进 BL-022（无 scale signal）|
| 12 | Material Symbols 字体策略 | ✅ next/font 自托管子集（保留视觉一致；M-P8 lucide-react 卸载单独处理） |
| 13 | CSP 上线节奏 | ✅ Report-Only 一周观察期，本批次只做 Report-Only，下批次切 enforce |
| 14 | CR-1/2/3 安全 Critical + H-S1/2/3 安全 High 归属 | ✅ 走 backlog 单独跟踪（不进 BIx；团队内部 demo 安全风险低）|

---

**Spec 状态：** decisions-locked, awaits MVP-internal-demo-prep done

**与其他批次关系：**
- 依赖 MVP-internal-demo-prep done（F006/F007 已含 P0）
- 不与 B8-ai-extensions 冲突（B8 邀请后第 2 周做，本批次 done 后才发邀请 / 启动团队 demo）
- 不与 B4-extended-email-system 冲突（B4-extended 含 webhook + manual log）

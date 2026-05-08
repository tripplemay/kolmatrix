# BL-012 apify-kol Integration Spec — v2（5/8 02:30 用户重新讨论后修订）

> KOLMatrix 接入爬虫团队 `guang-tech/apify` fork（apify-kol-service）作为第二数据源，**采用稳妥的"先 admin preview 验证 → 决策门通过 → 真接入"分阶段策略**。
>
> - **Spec 起草：** v1 5/8 ~01:30 / v2 5/8 ~02:30 用户重新讨论后扩范围
> - **Spec 作者：** Planner johnsong
> - **批次类型：** 单批次合并（13 generator features，Stage 1.5 + Stage 2）
> - **状态：** Locked → 等 BL-055 hotfix done → BL-012 building
> - **关联：** `docs/reviews/apify-fork-audit-2026-05-08.md`（462 行 audit）

---

## 修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 5/8 ~01:30 | 初始 spec — 单 stage 7 features（Stage 2 only：apify-kol.ts adapter 直接写 Prisma Kol 表） |
| **v2** | **5/8 ~02:30** | 用户重新讨论后扩范围 — **新增 Stage 1.5 admin preview 页面 + 4 维度决策门 checklist**；features 7→13；时间线 5/13 仅含 Stage 1+1.5（不含 Stage 2 真接入）；用户决议 5 子项 lock 1A/2A/3A/4B/5B |
| **v3** | **5/8 ~16:30** | Stage 1.5 signoff PASS @ commit `f2f5dbb` (A-/Ready) 后用户增量请求 — **加 sidebar 入口 §4.5.6**：UserAvatarMenu 下拉 conditional admin tools section（仅 platform_admin/tenant_admin 可见，业界惯例 GitHub/Notion 等头像菜单含 admin tools，**不违反 canonical 8-item rule** BL-025-F004.B）；features.json 加 F006a；progress.json status: done → building / total_features 13→14 |
| **v4** | **5/8 ~19:30** | BL-012 综合 signoff PASS @ commit `4712066` (A-/Ready，fix-round 1+F006a+fix-round 2 全闭合) 后用户决议 4B — **绕过 §4.5.4 决策门** (当前 1/4 passed) 启动 Stage 2 真接入；接受风险（次质量数据进主流程，metadata.source='apify-kol' 隔离作后续清理 option，主流程 UI 不加默认过滤）；BL-058-apify-data-quality-await backlog 加入跟踪 4 维度迭代；progress.json status: done → building 重激活 Stage 2；features.json F007-F013 7 features 仍按 v2 spec 设计；v0.9.18 (auth role enum 实物核查) + v0.9.19 (external API zod schema 实物 sample 验证) 同沉淀 framework |

---

## 1. 背景与目标

### 1.1 业务背景

KOLMatrix 当前 KOL 数据源：
- **B6 YouTube Data API daily sync**（`src/lib/kol-sync/adapters/youtube.ts`，prod 在用）
- **静态 XLSX seed**（2524 条，已逐步淘汰）
- **Apify Discovery API 即用即抓**（discovery 页 ad-hoc）

爬虫团队 5/6 创建 `guang-tech/apify` fork，5/7 完成 Apify→TikHub 全迁移，提供独立的 apify-kol-service（IG+TikTok+YouTube+X 4 平台）。

### 1.2 v2 修订的稳妥接入策略

**用户 5/8 02:30 关切：** KOLMatrix 当前 138 KOL + 真 engagement 信号 + 5 个用户业务数据是宝贵资产，Stage 2 adapter 直接写 Prisma Kol 表会污染主流程；如果 fork 端数据质量 / 数量不达标（字段完整度低 / email 抽取率差 / 评分分布不合理 / 跨平台覆盖薄弱），后续清理 / 回退成本极高。

**v2 策略：** 在 Stage 1 部署 + Stage 2 真接入之间**插入 Stage 1.5 admin preview 页面** — 直接调 fork 端 `GET /kol` API 在独立 admin 页面渲染数据（**不入 Prisma Kol 表 / 不走 KolSyncAdapter / 不污染主流程**）。用户实地审视质量 + 数量 → 决策门通过 → 才启动 Stage 2 真接入。

```
Stage 1（部署）→ Stage 1.5（admin preview 页 + 4 维度阈值 stats）→ 用户决策门 → Stage 2（adapter 真接入 + 写 Prisma）
              ↑                                                ↑
              低成本独立验证                                  质量门控 + 反馈爬虫团队迭代窗口
```

### 1.3 业务目标

1. **多平台覆盖：** Stage 2 完成后 KOLMatrix 数据源覆盖 IG / TikTok / YouTube（B6 + apify 双源容灾）/ X 4 平台
2. **零污染主流程的数据验证：** Stage 1.5 让用户在低成本（独立 admin 页）下审视 fork 端数据质量
3. **决策门 + 反馈迭代：** 不满意时反馈爬虫团队 → 改进 → 再审 → 直至质量数量满意才正式接入
4. **5/13 上线节点：** 含 Stage 1（部署）+ Stage 1.5（admin preview 页可访问）；**不含 Stage 2 真接入**（与 v1 5/13 不含 Stage 2 一致）

### 1.4 用户决议（5/8 lock）

| # | 决议项 | 选择 | 来源 |
|---|---|---|---|
| 1 | TikHub paid balance 付费方 | B. 爬虫团队负责 | v1 5/8 |
| 2 | apify-kol service 部署位置 | A. 复用 KOLMatrix VM | v1 5/8 |
| 3 | 5/13 上线是否含 BL-012 | B. 含 Stage 1+1.5（admin preview 页）；不含 Stage 2 | v2 修订（与 v1 5/13 不含真接入一致） |
| 4 | TikHub 首充金额 | A. $50 demo | v1 5/8 |
| 5 | 拆 stage 还是合并 | B. 合并单批次 | v1 5/8 |
| 5.1 | preview 路径 | A. `/[locale]/admin/apify-preview` | v2 5/8 |
| 5.2 | preview 访问权限 | A. 仅 admin role 可见 | v2 5/8 |
| 5.3 | preview 是 read-only 还是含导入按钮 | A. 纯展示（read-only） | v2 5/8 |
| 5.4 | 决策门 acceptance 标准 | B. checklist 化（4 维度具体阈值） | v2 5/8 |
| 5.5 | preview 页长期保留 | B. 保留作长期 admin 监控工具 | v2 5/8 |

### 1.5 范围边界

**v2 本批次包含：**
- Stage 1（用户 + Planner ops 协作）：apify-kol-service 部署 + TIKHUB_TOKEN 协调 + 充值 + 录种子 + smoke
- **Stage 1.5（Generator F001-F006）：admin preview 页面 + 4 维度阈值 stats**
- **用户决策门**（实地审视，无代码改动）
- Stage 2（Generator F007-F013，决策门通过后启动）：apify-kol.ts adapter + 字段映射 + 集成测试 + dispatcher 集成 + 删过期占位 + 文档同步 + L1 验证

**v2 本批次不包含：**
- apify-kol-service 端代码改动（fork 维护方负责）
- KOLMatrix 端 UI / Discovery 页面新增调用 fork 业务读 API（数据通过 Stage 2 sync 流入 Kol 表后既有 UI 自动可用）
- 4 平台 IG/TT/X 的 Discovery 抓取链路（apify-kol-service 自动处理）
- TikHub 商务约定 / 充值流程（爬虫团队负责）
- B6 YouTube adapter 改动（保持现状双源容灾）
- ja/ko/es i18n native review（admin 工具仅中英双语 sufficient，BL-014 不阻塞）

---

## 2. 关键设计决策

### 2.1 v2 新增 Stage 1.5 admin preview 设计

**决议 5.1 路径：** `/[locale]/admin/apify-preview`
- 不污染 `(app)/` 主路径
- 与未来 admin 工具集中（如 admin/health / admin/audit-logs 等）
- 路径 `[locale]` 段保留多语言（admin 工具中英双语 sufficient）

**决议 5.2 权限：** 仅 admin role
- middleware / route guard 复用既有 admin auth check（参考其它 admin endpoints）
- 业务方（marketer role）访问 → 302 redirect 到 dashboard
- 防止业务方误以为这些是已审核的真实 KOL

**决议 5.3 read-only：** 纯展示，无导入按钮
- preview 页**不调用** Prisma `kol.create` / `kol.upsert`
- 不走 KolSyncDispatcher / KolSyncAdapter / quality.ts / refresh-selector.ts 任一现有 sync 路径
- 仅调 fork 端 `GET /kol?...` 业务读 API + 直接 render
- 与 Stage 2 自动批量入库**完全隔离**（避免双路径混乱）

**决议 5.4 决策门 acceptance：** 4 维度 checklist 化具体阈值（详 §4.5.3）

**决议 5.5 长期保留：** preview 页长期保留作 admin 监控工具
- Stage 2 接入后仍可见 — 用于 spot-check 入库前 vs 入库后字段差异
- 数据健康度长期可见（每周 admin 进入看 fork 端是否还在产数据）
- 不打扰主 UI — admin 路径隐藏

### 2.2 数据流隔离铁律

Stage 1.5 preview 页**严格 read-only**：

```
┌─ apify-kol-service (KOLMatrix VM) ─┐
│  GET /kol?platform=...&page=N     │ ←──── Stage 1.5 preview 页 server component fetch（仅渲染，不入库）
│                                    │
└────────────────────────────────────┘
                    │
                    ▼ (Stage 2 决策门通过后才接通)
┌─ KOLMatrix Prisma Kol table ──────┐
│  KolSyncAdapter (apify-kol.ts)    │ ←──── Stage 2 真接入（写 Prisma）
└────────────────────────────────────┘
```

**铁律：** Stage 1.5 preview 页代码任何 commit **不得 import** `@/lib/kol-sync/import.ts` / `@/lib/kol-sync/dispatcher.ts` / Prisma `kol.upsert` / `kol.create` 等任何 Kol 入库路径。Reviewer L1 grep 守门验证。

### 2.3 acceptance 边界（v0.9.16 P5.2 应用）

本批次 acceptance **不含**全套 `npm run test:integration` 普遍绿门槛。`pre-commit-hook.test.ts` flaky 已 BL-054 治理，pre-impl audit 不计入 BL-012 评分。Reviewer 验收只看 BL-012 引入测试 + spec acceptance 表逐项 + Stage 1.5 决策门 stats 实时计算正确。

### 2.4 Adapter 命名 `apify-kol` 而非 `crawler-team`（v1 不变）

`metadata.source` 字段：
- 已在用：`'youtube-api-daily'`（B6 YouTube adapter）
- 新增（Stage 2）：`'apify-kol'`（与 fork 实物项目名 apify-kol-monorepo 一致）

### 2.5 占位 `crawler-team.ts.todo` 处理（v1 不变）

`src/lib/kol-sync/adapters/crawler-team.ts.todo` 占位与 5/7 fork 实物 API 不一致（详 audit §6.2）。F011 删除占位，Stage 2 新写 `apify-kol.ts`。

---

## 3. 数据契约（v1 不变，省略详细字段映射；详 audit §3 + v1 spec §3）

`GET /kol?platform=...` Response Shape 已确认 + 字段映射表 + 错误分类。

---

## 4. 数据准备步骤（Stage 1，5/13 上线前必须完成；v1 不变）

> Stage 1 不入 features.json，由 Planner ops + 用户协作完成。Stage 1.5 building 启动前需 §4.1-§4.6 全部 ✓。

### 4.1-4.6 Stage 1 ops（v1 不变）

详 v1 spec §4.1-§4.6（TIKHUB_TOKEN 协调 / VM SSH 部署 docker-compose / smoke / 录种子 / .env 加 2 行 / 数据可用性验证）。

---

## 4.5 Stage 1.5 — admin preview 页面（v2 新增）

### 4.5.1 设计目标

- **零污染：** 仅调 fork 端 `GET /kol` API → server-side render；**不写 Prisma**
- **数据可视化：** 主表格展示 N 条 KOL + 字段质量 indicator + 4 维度 stats cards
- **过滤维度：** 继承 fork API 的 platform / minFollowers / hasEmail / sort / page
- **可审视：** 每条 KOL 可 expand 看完整 raw JSON
- **决策门：** 4 维度阈值 checklist 实时计算 + 视觉标记 ✓ / ✗

### 4.5.2 页面结构

```
/[locale]/admin/apify-preview
├─ Header bar
│  └─ Title: "Apify-KOL Preview (READ-ONLY)" + 警告 banner "数据未入库，仅审视用"
├─ Filter row
│  ├─ Platform select (all / instagram / tiktok / youtube)
│  ├─ Min followers number input
│  ├─ Has email toggle
│  ├─ Sort select (relevance / followers / influence / quality / reachability / recent)
│  └─ Page size 50 / page N pagination
├─ Stats cards (4 维度阈值实时计算)
│  ├─ #1 字段完整度 ✓/✗
│  ├─ #2 4 维度评分分布 ✓/✗
│  ├─ #3 跨平台覆盖 ✓/✗
│  └─ #4 数据新鲜度 ✓/✗
├─ Main table (50 KOL per page)
│  ├─ 列：username / platform / followers / verified / 4 维度评分 / emails count / matchedTags / last_scraped_at
│  ├─ Row click → expand panel 显示完整 raw JSON
│  └─ 字段质量 indicator (空字段标灰；email 抽取标绿)
└─ Footer: "决策门：4/4 维度通过 → 启动 Stage 2 真接入；任一维度 ✗ → 反馈爬虫团队改进"
```

### 4.5.3 4 维度决策门 acceptance checklist（用户决议 5.4=B 阈值化）

| 维度 | 阈值 | 测量方法（preview 页 stats card 实时计算） | 不达标处置 |
|---|---|---|---|
| **#1 字段完整度** | username + displayName + followers + platform + profileUrl 必填 5 字段 100% 非空；email 抽取率（emails.length>0 OR aggregatorEmails.length>0）≥40% | server-side aggregate 统计当前过滤集 N 条 | 反馈爬虫团队：必填字段为何缺；email 抽取 pipeline 改进 |
| **#2 4 维度评分分布** | relevanceScore + influenceScore 平均 ≥0.5；qualityScore + reachabilityScore 至少 60% KOL 非 null；评分 0-1 区间使用合理（不是全 0 或全 1） | aggregate avg + null count + std deviation | 反馈：评分算法是否有效；冷启动期 cold tier KOL 评分 null 是否合理 |
| **#3 跨平台覆盖** | IG / TT / YT / X 至少 3 平台有数据；任一平台不少于 100 条；游戏垂类 matchedTags 命中率（matchedTags 含 gaming/esports/mobilegame 等关键词）≥70% | aggregate per platform count + tag match | 反馈：缺哪个平台；非游戏垂类 KOL 是否被错抓 |
| **#4 数据新鲜度** | last_scraped_at 最近 7 天内 ≥80%；7-30 天内 ≤15%；>30 天 ≤5% | aggregate per scrapedAt bucket | 反馈：refresh scheduler 是否正常 |

### 4.5.4 决策门通过判定

- **4/4 维度全 ✓** → 用户在 spec 里明示"决策门通过"+ 通知 Planner 启动 Stage 2 building（Generator 接力 F007-F013）
- **3/4 或更少 ✓** → 反馈 ✗ 维度细节给爬虫团队 → 等 fork 端改进 → 用户重新审视 preview 页 → 直至 4/4 通过
- **决策门通过时间不限：** 5/13 上线时间线已不依赖 Stage 2，决策门可以推迟到 5/13 后任意时段

### 4.5.4-v4 修订（5/8 19:30 用户决议绕过决策门）

⚠️ **v4 修订 — 用户决议 4B 绕过 §4.5.4 决策门启动 Stage 2：**

- **触发：** 5/8 19:00 prod fix-round 2 完成后，BL-012 综合 signoff PASS @ commit `4712066`，但决策门 4 维度 **1 / 4 passed**（spec §4.5.3 阈值未达 3 维度）
- **用户决议（5/8 19:30）：** 绕过决策门启动 Stage 2 入主流程，**接受风险**：
  - 次质量数据进 KOLMatrix Kol 表（`metadata.source='apify-kol'` 隔离）
  - 主流程 UI（discovery / database / smart-match）**不加默认过滤** — 业务方可见 apify-kol 数据
  - 后续清理 option：SQL ops `WHERE metadata->>'source' = 'apify-kol' AND quality = 'low'`
- **配套措施：**
  - BL-058-apify-data-quality-await backlog 加入（决议 3A）— 长期跟踪 fork 数据 4 维度迭代 + 反馈爬虫团队 + 评估主流程 UI 默认过滤选项
  - v0.9.19 沉淀（external API zod schema 实物 sample 验证）— 防 future 类似 schema mismatch
  - quality.ts 加 'apify-kol' source 分支严格过滤（emails/aggregatorEmails 双空 → quality='low'，作为 outreach 路径过滤兜底）

**v4 修订理由：**
- 5/13 上线 buffer 充裕（5+ 天），现在启动 Stage 2 不阻塞上线
- fork 端数据持续累积，4 维度可能短期内自然改善
- metadata.source 隔离作后续清理 option — 数据真入库后清理仍可控
- 用户业务上希望 5/13 上线即含 4 平台数据（IG/TT/YT），不希望等爬虫团队迭代

**何时回到 §4.5.4 严格判定：** BL-058 启动条件触发时（业务方反馈次质量数据扰乱 / 30 天 4 维度未达 / fork 重大更新）→ 评估是否补加主流程 UI 默认过滤 + SQL 清理。

### 4.5.5 反馈机制

`docs/specs/BL-012-stage1.5-feedback-log-YYYY-MM-DD.md` 文档：用户每次审视 preview 页后写一份反馈日志，列出：
- 审视日期 + 样本量 + 过滤条件
- 4 维度阈值 ✓ / ✗ 状态
- 不达标维度具体问题（screenshot + 具体 KOL 例子）
- 反馈给爬虫团队的 issue（如 GitHub issue link to guang-tech/apify）
- 下次审视时间

### 4.5.6 Sidebar 入口（v3 增量 — admin tools 可见性）

**用户决议 5/8 ~16:30：** Stage 1.5 signoff PASS 后增量请求 — UserAvatarMenu 下拉菜单加 conditional admin tools section。

**实装位置选择：** UserAvatarMenu（topbar 右上角头像点击展开）而非 sidebar nav 顶级 item，因为：
- ⚠️ **不违反 canonical 8-item rule**（既有 spec 铁律 BL-025-F004.B + nav-config.ts:92-94 注释）— sidebar 8 个 nav items 是 spec lock，不可加第 9 个
- ✅ **业界惯例** — GitHub/Notion/Slack 等用户头像菜单含 admin tools
- ✅ **conditional 仅 admin role 可见** — marketer/client 看到的菜单仍是 profile/settings/signout 3 项，不打扰主 UI
- ✅ admin 自然在 user identity 上下文中

**实装结构：**

```
UserAvatarMenu 下拉（admin role 看到）：
├─ User info (name + email)
├─ ──── separator ────
├─ Profile (icon: person)
├─ Settings (icon: settings)
├─ ──── separator ────                           ⭐ v3 新增
├─ "Admin Tools" 小标题 (uppercase tracking)     ⭐ v3 新增
├─ Apify Preview (icon: admin_panel_settings)    ⭐ v3 新增 → /{locale}/admin/apify-preview
├─ ──── separator ────
└─ Sign out (icon: logout)
```

**渲染条件（与 F001 admin auth gate 严格一致）：**

```ts
// src/lib/auth/roles.ts (新建 helper)
export function isAdminRole(role?: string | null): boolean {
  return ["platform_admin", "tenant_admin"].includes(role ?? "");
}
```

F001 page.tsx 同步重构使用此 helper（避免字面 array 重复 — v0.9.17/v0.9.18 候选「auth role enum 实物核查」精神延伸）。

**i18n keys 新增：** `userMenu.adminTools` + `userMenu.adminApifyPreview` 5 locale（admin 工具中英 sufficient，ja/ko/es 同 LLM 候选 BL-014 不阻塞）

**测试要求：**
- UserAvatarMenu.test.tsx 加 4 case：tenant_admin 渲染 admin section / platform_admin 渲染 / marketer 不渲染 / undefined role 不渲染
- TopbarActions.test.tsx + AppShellLayout.test.tsx 既有 tests 适配 role prop 透传

**详 features.json F006a。**

---

## 5. KOLMatrix 端实装

### 5.1 Stage 1.5 features F001-F006（admin preview 页，~3-4h Generator）

详 features.json F001-F006。

### 5.2 Stage 2 features F007-F013（adapter 真接入，~5-6h Generator，决策门通过后启动）

详 features.json F007-F013。文件总览：

| 文件 | 操作 | feature |
|---|---|---|
| `src/lib/kol-sync/adapters/apify-kol.ts` | 新增（implements KolSyncAdapter） | F007 + F008 |
| `tests/integration/apify-kol-adapter.test.ts` | 新增（≥4 case） | F009 |
| `src/lib/kol-sync/dispatcher.ts` | 修改（注册 apify-kol adapter） | F010 |
| `scripts/kol-sync-daily.ts` | 修改（dispatcher 注入 apify-kol adapter） | F010 |
| `src/lib/kol-sync/quality.ts` | 修改（加 `'apify-kol'` source 分支质量规则） | F010 |
| `src/lib/kol-sync/adapters/crawler-team.ts.todo` | **删除**（占位与实物 API 不一致） | F011 |
| `docs/dev/kol-sync-runbook.md` | 修改（双 adapter 调度说明） | F012 |
| `.auto-memory/environment.md` | 修改（secrets 表 +2 行 + 新增 §"apify-kol service" 段） | F012 |

---

## 6. 测试策略

### Stage 1.5 单测 + 集成测试

- F001 admin auth gate 单测（admin / marketer / unauth 三 case）
- F002 server-side fetch fork API 单测（mock fork response，参 F003 类似）
- F003 主表格渲染单测 + 4 维度 stats card 实时计算单测 ≥4 case
- F006 集成测试 ≥1 case（msw mock fork API → preview 页 SSR + 4 维度 stats 渲染）

### Stage 2 单测 + 集成测试（v1 不变）

- F008 mapApifyKolItemToRawKolData 单测 ≥3 case
- F009 集成测试 ≥4 case（msw fixture：pagination + 429 + 字段映射 + healthCheck）

### L1 全套（F013）

`npm run lint` 0 error / `npx tsc --noEmit` 0 error / `npm test` 1084+ tests 全 PASS / `npm run test:integration` 既有 + 本批次相关 PASS。

---

## 7. 部署 + cron 调度

### 7.1 Stage 1.5 部署

- F001-F006 done → Generator SSH 落 staging（含 admin preview 页可访问）→ smoke `/admin/apify-preview` 渲染 + 4 维度 stats 显示
- 用户在 staging 实地审视决策门
- staging 验证后 prod redeploy（5/13 上线含 Stage 1.5）

### 7.2 Stage 2 部署（决策门通过后）

详 v1 spec §7（dispatcher 集成 + cron 行 + prod redeploy）。

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Stage 1.5 preview 页误用 Prisma 入库 | 污染主流程 | §2.2 数据流隔离铁律：Reviewer L1 grep 守门验证 import 不含 prisma kol mutation |
| 4 维度阈值不达标 → 决策门长期不通过 | Stage 2 拖延 | 反馈日志 + 爬虫团队迭代窗口（不阻塞 5/13 上线，决策门弹性） |
| TikHub balance 耗尽 → fork 端抓取静默停止 | 数据陈旧度 ↑ → 维度 #4 ✗ | apify-kol /admin/stats 月度监控 + 用户每月续充约定 |
| admin auth gate 错误（business 用户能看到） | 数据未审核暴露给业务方 | F001 严格 admin role check + 单测 3 case + Reviewer L2 staging 实地切换账号验证 |
| Stage 2 启动条件混乱（决策门不明示） | Generator 误启动 / 用户没明示 | spec §4.5.4 明示决策门通过路径：用户在 progress.json session_notes 或专用 feedback log 写 "决策门通过 4/4，启动 Stage 2"；Generator 启动前 grep 验证 |
| fork 端字段增减 | preview 页字段映射失效 | preview 页代码用 z.object() runtime 验证 + raw JSON expand 兜底；Stage 2 集成测试覆盖字段映射 |
| KOLMatrix VM RAM 共生瓶颈 | apify-kol service 抢 RAM 影响 KOLMatrix | docker-compose mem_limit 1GB（v1 不变） |

---

## 9. Acceptance 表（features.json F001-F013 简表）

| feature | Stage | 范围 | 工时 |
|---|---|---|---|
| F001 | 1.5 | admin preview 页路由 + admin auth gate | ~30min G + 10min R |
| F002 | 1.5 | server-side fetch fork `GET /kol` API + parse | ~40min G + 10min R |
| F003 | 1.5 | 主表格 + filter row + raw JSON expand | ~1h G + 10min R |
| F004 | 1.5 | 4 维度 stats cards + 阈值实时计算 + ✓/✗ 标记 | ~50min G + 15min R |
| F005 | 1.5 | i18n 中英双语 + admin 路径文案 | ~20min G + 5min R |
| F006 | 1.5 | 单测 + 集成测试 ≥1 case | ~30min G + 10min R |
| F007 | 2 | apify-kol.ts 新建 implements KolSyncAdapter | ~1.5h G + 15min R |
| F008 | 2 | mapApifyKolItemToRawKolData 字段映射 | ~50min G + 10min R |
| F009 | 2 | tests/integration/apify-kol-adapter.test.ts ≥4 case | ~1h G + 10min R |
| F010 | 2 | dispatcher 集成 + scripts/kol-sync-daily.ts + quality.ts | ~50min G + 10min R |
| F011 | 2 | 删除 crawler-team.ts.todo + 全仓引用更新 | ~20min G + 5min R |
| F012 | 2 | docs/dev/kol-sync-runbook.md + environment.md | ~30min G + 10min R |
| F013 | 2 | L1 全套验证 + 双 adapter 不互扰回归 | ~30min G + 10min R |
| **Stage 1.5 合计** | — | F001-F006 admin preview | **~3.5h G + ~1h R** |
| **Stage 2 合计** | — | F007-F013 adapter 真接入 | **~5.5h G + ~1.5h R** |
| **总合计** | — | F001-F013 | **~9h G + ~2.5h R** |

---

## 10. 完成判定（DoD）

### Stage 1.5 done（5/13 前）

- [ ] features.json F001-F006 全部 status=completed
- [ ] L1 PASS
- [ ] staging deploy `/admin/apify-preview` 渲染 + 4 维度 stats 实时计算 + admin auth gate 严格
- [ ] prod redeploy 含 Stage 1.5（5/13 上线）

### 用户决策门（5/13 后任意时段）

- [ ] 用户实地审视 staging+prod preview 页 ≥1 次
- [ ] 4/4 维度 ✓（或反馈 ✗ 维度给爬虫团队 → 迭代 → 重审）
- [ ] 用户在 progress.json session_notes 或 `docs/specs/BL-012-stage1.5-feedback-log-YYYY-MM-DD.md` 明示"决策门通过，启动 Stage 2"

### Stage 2 done（决策门通过后）

- [ ] features.json F007-F013 全部 status=completed
- [ ] L1 PASS
- [ ] staging smoke + prod redeploy 含 Stage 2
- [ ] B6 YouTube adapter + apify-kol adapter 双源容灾验证（dispatcher 一端 fail 另一端继续）

### BL-012 整体 done

- [ ] Reviewer signoff PASS（B+ 以上 / Readiness=Ready）
- [ ] `.auto-memory/project-status.md` 更新 BL-012 → DONE
- [ ] `.auto-memory/environment.md` secrets 表 +2 行 + apify-kol service 段
- [ ] BL-013 / 其他延伸（如 webhook 接入）不在本批次

---

## 11. 不在本批次（Out of Scope）

- apify-kol-service 端代码改动（fork 维护方负责）
- KOLMatrix 端 UI / Discovery 页面新增调用 fork 业务读 API（数据通过 Stage 2 sync 流入 Kol 表后既有 UI 自动可用）
- 4 平台 IG/TT/X 的 Discovery 抓取链路（apify-kol-service 自动处理）
- TikHub 商务约定 / 充值流程（爬虫团队负责）
- B6 YouTube adapter 改动（保持现状双源容灾）
- BL-013+ 后续可能涉及的 webhook / 准实时 push（apify-kol service 端 ready 后另起批次）
- ja/ko/es 完整 i18n（本批次仅中英双语，admin 工具 sufficient）

---

## 12. 时间线（v2 修订）

```
5/8 02:00-02:30 用户重新讨论 v2 修订（spec lock）
5/8 02:30-07:30 BL-055 hotfix building（插队，~5h）
5/8 ~07:30 BL-055 done → 切回 BL-012 building
5/8-5/9 Stage 1 ops（用户协调爬虫团队 + Planner SSH 部署 apify-kol-service docker-compose up + smoke + 录种子 + 数据累积）
5/9-5/10 Stage 1.5 building（Generator F001-F006 ~3.5h + Reviewer ~1h）
5/10 Stage 1.5 staging deploy
5/10-5/12 用户实地审视决策门（弹性时长）
5/13 ⭐ 上线对外（含 Stage 1+1.5；Stage 2 未接，apify 数据仅 admin preview 可见）
5/13 后（决策门通过时）Stage 2 building（Generator F007-F013 ~5.5h + Reviewer ~1.5h）
5/14+（取决于决策门时机）Stage 2 done + prod redeploy 含 Stage 2 真接入

整体 BL-012 done 时机：取决于决策门，可能 5/15-5/30 弹性
```

5/13 上线时间线**不受 v2 修订影响** — 5/13 仅含 Stage 1+1.5 (admin preview 页)，与 v1 5/13 仅含 Stage 1 等价（KOLMatrix 主流程仍未接 apify 数据）。

---

## 13. 长期跟踪

- **BL-013（候选未立项）：** apify webhook 准实时 push 接入（fork 端 §10 #7 ready 后）
- **BL-012b（候选）：** Stage 2 done 后 dashboard / discovery 页 UI 增强使用 apify 数据特性（4 维度评分 / aggregator emails 等）
- **BL-014（已立项）：** ja/ko/es i18n native review（本批次只中英）

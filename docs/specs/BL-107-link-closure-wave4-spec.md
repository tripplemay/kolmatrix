# BL-107 链路收口(波4)+ BL-106 KPI 快照 cron

> **Type：** 收尾/清理 + ops(审计中危合集)。spec 硬性(含删除决策)。
> **来源：** docs/reviews/full-feature-chain-audit-2026-06-09.md M2/M4/M5/M6/M7/M8 · 路线图波4
> **本批 = 波4，合并 backlog BL-107 + BL-106**(执行后从 backlog 移除；本批 sprint 名 BL-107)。
> **M7 决策(用户 2026-06-12)：** 假 AI 语义搜索**单开批次认真做**(新 backlog BL-112)；本批仅**止血移除误导性 ?ai= UI**，保留引擎。

## §1 背景(审计实证)

| 项 | 现状 | 本批处置 |
|---|---|---|
| M4 | KOL 详情 `loadKol`(page.tsx:87)`findUnique` 无 deletedAt/isSuspicious 过滤 → 软删/可疑 KOL 经直链仍渲染 | 加过滤 |
| M8 | ROI AI Insights(`roi/actions.ts:70`)喂模型 `startedAt:null/kolCount:0` 硬编码 | 真取或删 |
| M5 | tsvector 全文搜索(`searchKols`/`tsvector.ts`)写无人读 + query 构造 bug(replace(/ /g)压单token);UI 用 ILIKE;唯一引用 filters.ts 注释谎称 available | 删死码 |
| M6 | 孤儿 API:`PATCH /api/kols/[id]`(邮箱,enum 过期)、`POST /api/campaigns/[id]/kols` + `[kolId] PATCH/DELETE`、relationship-status REST — 零 fetch 调用方 | 删死端点 |
| M7 | 假 AI 语义搜索 ?ai=:解析(filters.ts:317)+ chip(MatchActiveFilters)+ empty-state 全套基建在,但 buildKolWhere 不读 aiQuery、`runSemanticKolSearch` 零调用 → 显示"AI: xxx"筛选实不筛 | **止血**:移除误导 UI,保留引擎(BL-112 接) |
| BL-106 | prod 实证:KPI 快照 cron **不存在** + `kpi_daily_snapshot` 表 **空(count=0)** → dashboard KPI 趋势 prod 从未生效(永久"—") | 装持久 cron |

## §2 Features

> 全 generator 含单测 + L1 全绿。删除类须 grep 全仓确认零残留引用 + build 绿。

### F001 — M4 软删过滤 + M8 ROI 硬编码修(generator)
- M4:`kols/[id]/page.tsx` `loadKol` findUnique 加 `where:{id, deletedAt:null}`(+ 视情 isSuspicious);命中软删 → notFound()。与 /match 列表口径一致。
- M8:`roi/actions.ts:70` 喂 AI 的 `startedAt/kolCount` 改从 loader 真取(若 RoiInsightCampaign 类型有源)或从 payload+类型删除(避免类型谎称有值)。
- 单测(软删 KOL 直链 notFound / ROI payload 字段)。

### F002 — M5 tsvector 死码删 + M6 孤儿 API 删(generator)
- M5:删 `searchKols`/`buildKolSearchQuery`(`tsvector.ts`)+ filters.ts:415 谎称注释;**保留 DB `search_vector` 列 + trigger**(drop 列要 migration,且无害;仅删死 TS code 与误导注释)或评估一并 migration drop(Generator 判断,优先只删 TS 死码低风险)。
- M6:删孤儿 route `PATCH /api/kols/[id]`(邮箱)、`POST /api/campaigns/[id]/kols` + `[kolId]`、relationship-status REST(确认全仓零 fetch 调用方再删;保留仍有调用方的)。
- grep 确认删除项零残留引用;单测/build 绿。

### F003 — M7 ?ai= 误导 UI 止血(generator)
- 移除/中和 `?ai=` 的误导性 UI:`MatchActiveFilters` 不再渲染 "AI: xxx" chip;`filters.ts:317-319` 不再特殊处理 aiQuery(stray ?ai= 变 no-op 或回落 search,不显假筛选);empty-state 计数不引 aiQuery。
- **保留** `lib/discovery/semantic-search.ts`(`runSemanticKolSearch` 引擎)+ 核心 filter 逻辑,供 **BL-112 真 AI 语义搜索**接;本批仅去 UI 误导。
- 单测(?ai= 在 URL 时不渲染假 chip / 不影响正常 search)。

### F004 — BL-106 持久 KPI 快照 cron(generator, ops)
- prod KPI 快照 cron 缺失 + 表空。装**持久**调度:`deploy-prod.sh` 加步骤 ensure `/etc/cron.d/kolmatrix-kpi-snapshot`(每日, 链在 kol-sync 后, 跑 `cd /opt/kolmatrix && npm run kpi-snapshot:daily`),每次部署重建(抗 VM reset — 同 backup-retention 教训)。建议同步 ensure backup-retention cron.d(自愈 cron 类 bug)。
- 更新 deployment-runbook §Backups/§Cron + environment.md。
- 验收:部署后 `/etc/cron.d/kolmatrix-kpi-snapshot` 存在;手动跑一次脚本 → `kpi_daily_snapshot` 写入行(count>0);dashboard KPI 趋势从"—"复活(需≥若干天数据,首日先验写入)。

### F005 — Codex L1+L2 + signoff(codex)
- L1:lint 0err warn≤3 / tsc=0 / npm test。
- L2 部署后:① 软删 KOL 直链 notFound ② 删除的 API/死码全仓零引用 + build 绿 ③ stray ?ai= 不显假筛选 chip ④ ROI insights 不再硬编码 ⑤ KPI cron 装好 + 手动跑写入 kpi_daily_snapshot。
- signoff `docs/test-reports/BL-107-signoff-2026-06-XX.md`。

## §3 风险

- **删除类**:务必 grep 全仓确认零调用方再删 + `npm run build` 绿(死端点/死码)。M5 DB 列/trigger 保留(drop 要 migration,无害);仅删 TS 死码。
- **M7 保留引擎**:只去 UI 误导,不删 semantic-search.ts(BL-112 要用)。
- **BL-106 cron**:prod ops(deploy 脚本 + cron.d);⚠️ 抗 VM reset 须放 deploy 脚本而非裸 crontab。
- 纯 kolmatrix(无 schema 变更,除非 M5 选 drop 列)。⚠️ 部署 OOM NODE_OPTIONS=4096。

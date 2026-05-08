---
name: B6-kol-daily-sync
description: KOL 数据每日自动增量同步 - Sync Worker 通用接口 + YouTube adapter（首个数据源）+ cron + 监控 + 数据质量校验。不依赖外部团队，KOLMatrix 自主可控。为 BL-012 爬虫团队 6 月接入做实战预演（接口已就绪，6 月仅替换 adapter）。
status: decisions-locked
created_by: Kimi (Planner)
created_at: 2026-04-27
decisions_locked_at: 2026-04-27
estimated_effort: 3-5 day
prerequisites:
  - MVP-kol-seed-redo done（YouTube API 调用栈 + import 流程已就绪）
  - YouTube API quota 充足（每日 ~1000-3000 units，10K/day 30% 利用率）
trigger: 用户决定（详见 §10 时序方案 A/B/C）
---

# B6-kol-daily-sync — KOL 每日自动增量同步

> **2026-05-09 历史化通告（BL-012-F011）：** §F006 / §依赖图 提到的 `src/lib/kol-sync/adapters/crawler-team.ts.todo` 占位文件已删除。BL-012 走的不是当时设想的「爬虫团队 v1 handoff API」路径，而是接入 5/7 fork 实物（`apify-kol-service`），新写 `src/lib/kol-sync/adapters/apify-kol.ts`。后续接入以 `docs/specs/BL-012-apify-kol-integration-spec.md` 为准。本 spec 描述 B6 YouTube 路径仍然有效。

## 1. 背景与目标

### 1.1 触发

用户 2026-04-27 提问 "未来可否每天利用当日配额自动增量爬取 KOL 入库？"

核心动机（用户原话）：**"不依赖外部团队验证 KOL 发现"**。

### 1.2 战略价值

1. **自主可控数据增长** — 不依赖 BL-012 爬虫团队 6 月交付（外部团队延期风险中等）
2. **空窗期持续增长** — MVP 上线 ~05-07 → 爬虫团队交付 ~06-25，5-7 周空窗如什么都不做 KOL 库冻结在 1500 条
3. **Sync Worker 接口前置** — KOLMatrix 反正要写 sync worker（无论数据源），先做 YouTube adapter 6 月仅替换 adapter（~1 day）不浪费工时
4. **数据增长曲线信号** — 跟踪已入库 KOL 的 follower count 变化（趋势分析，B5 enrichment 后做）
5. **PMF 验证** — 让种子用户体验"产品在持续增长"（每日 +50-100 KOL），提升留存

### 1.3 非目标

- 不做 KOL 实时同步（每日 cron 即可，PRD 不需准实时）
- 不做 KOL 视频 / 评论 / 互动深度爬取（B5 已 done 范围 / 视频内容超 quota）
- 不替换 BL-012 爬虫团队（6 月接入后双数据源共存，按 source 标签区分）
- 不做跨平台同步（仅 YouTube；TikTok/Bilibili 等留 B7+）
- 不做 audience demographics 同步（YouTube 不公开，需爬虫团队 NoxInfluencer）

## 2. 范围（6 features）

### F001 — Sync Worker 通用接口（Adapter pattern）

**实现：**

```typescript
// src/lib/kol-sync/types.ts
export interface KolSyncAdapter {
  name: string;  // 'youtube' | 'crawler-team' | 'tiktok' | etc.
  source: string;  // 'youtube-api' | 'crawler-api-v1' | etc.

  /** Discover new KOLs (delta sync) */
  discover(params: SyncParams): Promise<RawKolData[]>;

  /** Refresh existing KOL stats (subscribers / engagement / etc.) */
  refresh(externalIds: string[]): Promise<RawKolData[]>;

  /** Adapter health check (API key valid / quota left) */
  healthCheck(): Promise<{ healthy: boolean; details?: any }>;
}

// src/lib/kol-sync/dispatcher.ts
export class KolSyncDispatcher {
  constructor(private adapters: KolSyncAdapter[]) {}

  async runDailySync(opts: DailySyncOpts): Promise<SyncReport>;
  async runRefresh(opts: RefreshOpts): Promise<RefreshReport>;
}
```

**目的：** 不直接调 YouTube API；通过 adapter 抽象，6 月可加 `CrawlerTeamAdapter` 替换。

**Acceptance：**
- types + dispatcher + 1 个 mock adapter
- tests/unit/kol-sync-dispatcher.test.ts 5 fixture（adapter 注册 / dispatch / health / fail handling / multi-adapter）

### F002 — YouTube adapter（首个真实现）

**实现：**

```typescript
// src/lib/kol-sync/adapters/youtube.ts
export class YouTubeKolSyncAdapter implements KolSyncAdapter {
  name = 'youtube';
  source = 'youtube-api';

  async discover(params: { region: string; keywords: string[]; minSubscribers?: number; maxResults?: number }): Promise<RawKolData[]> {
    // 复用 scripts/seed-kol-from-youtube.ts 的爬取逻辑
    // 但每日调用规模小：~50-100 KOL
  }

  async refresh(externalIds: string[]): Promise<RawKolData[]> {
    // channels.list batch（50 IDs/call，cost 1 unit/call）
    // 用于跟踪 subscriberCount / videoCount / viewCount 变化
  }

  async healthCheck(): Promise<{ healthy: boolean; quotaLeft?: number }> {
    // 简单测试 API key + 估算今日配额剩余
  }
}
```

**每日策略：**
- discover：6 region × 3 keyword × 10 results = 18 search calls × 100 = 1800 units（含已入库去重）
- refresh：所有 is_demo=false 的 KOL 每周轮询一次（按 last_synced_at 排序，每日处理 ~200 个 = 4 channels.list calls × 1 = 4 units）
- 合计：~1800-2000 units/day（10K 配额 18-20% 利用率）
- 预期增量：每日 30-50 真新 KOL（去重后），4 周 ~1000 增量

**Acceptance：**
- YouTube adapter 实现 KolSyncAdapter 接口
- discover 跑通 + 去重 + 全字段填充（沿用 kol-seed-redo F002 全字段策略）
- refresh 跑通 + last_synced_at 更新
- tests/integration/youtube-adapter.test.ts mock + 真 API 调用（少量 quota，gated by env）

### F003 — Cron 配置 + 调度

**实现：**

```bash
# infrastructure/cron/kolmatrix-kol-sync
# Runs daily at 16:30 PT (北京 08:30 next day) — after YouTube quota reset
30 8 * * * tripplezhou cd /opt/kolmatrix && npm run kol-sync:daily >> /var/log/kolmatrix-kol-sync.log 2>&1
```

**npm script：**
```json
"kol-sync:daily": "tsx scripts/kol-sync-daily.ts",
"kol-sync:daily:dry": "tsx scripts/kol-sync-daily.ts --dry-run"
```

**`scripts/kol-sync-daily.ts`：**
- 用 KolSyncDispatcher + YouTubeKolSyncAdapter
- 跑 discover + refresh
- 写入 KOL 表（metadata.is_demo=false / metadata.source='youtube-api-daily'）
- 输出报告 docs/test-reports/kol-sync-daily-{date}.md

**部署：**
- 仅 prod 跑（避免 staging 双重 quota 消耗）
- staging 仅手动 npm run kol-sync:daily 验证
- log rotation（logrotate 配 /var/log/kolmatrix-kol-sync.log，保留 30 天）

**Acceptance：**
- infrastructure/cron/kolmatrix-kol-sync 入 git + deploy 到 VM /etc/cron.d/
- prod 第一次自动跑（监控）
- log 文件可 tail 查看
- /var/log/kolmatrix-kol-sync.log 自动 rotation

### F004 — 失败重试 + 监控 + 告警

**实现：**

1. **失败重试：**
   - YouTube API 失败：3 次重试 30s/2min/5min backoff（同 BM2 F006）
   - DB write 失败：upsert 天然幂等
   - 全量 fail：写 alert log + email/slack（B6 阶段先 email，未来 BI4 加 Sentry）

2. **监控指标（结构化日志）：**
   ```typescript
   {
     timestamp: '2026-05-08T08:30:00+0800',
     adapter: 'youtube',
     discover_count: 47,
     refresh_count: 200,
     dedupe_skipped: 12,
     quota_consumed: 1823,
     duration_ms: 45230,
     errors: []
   }
   ```

3. **告警阈值（写入日志，未来接 Sentry）：**
   - quota_consumed > 3000（异常高消耗）
   - discover_count = 0（连续 3 天 → 数据源可能挂）
   - errors.length > 0（任何错误）

**Acceptance：**
- scripts/kol-sync-daily.ts 含完整 try/catch + 重试逻辑
- structured 日志 JSON 写入 /var/log/kolmatrix-kol-sync.log
- 告警阈值文档化在 docs/dev/kol-sync-runbook.md
- tests/unit/kol-sync-retry.test.ts 覆盖 retry / backoff / max attempts

### F005 — 数据质量校验

**实现：**

写入前过滤：
1. **去重：** upsert by (tenantId, platform, externalId)（沿用 F003 修复后键）
2. **去 spam：** subscriberCount < 1000 → skip（业内 nano-creator 下限）
3. **去僵尸：** lastUploadAt > 90 days → skip
4. **去 NSFW：** 用 channel meta brand_safety_rating 字段（如有）
5. **重复账号检测：** 同 channel.id 不同 handle（罕见，但可能 channel 改名）→ 仅 update display_name 不新建

写入后异常监控：
- followers 增长曲线异常（突增 10x → 可能 fake follower buy）→ 写入 metadata.flags.suspicious_growth = true，UI 不展示
- 长期下降（30 天 -50% subscribers）→ 写入 metadata.flags.declining = true

**Acceptance：**
- 5 条过滤规则在 import 流程实现 + tests
- tests/integration/kol-sync-quality.test.ts 5 fixture（spam / 僵尸 / NSFW / 重复 / 异常增长）
- 数据质量报告 docs/test-reports/kol-quality-weekly-{date}.md（cron 周报）

### F006 — Tests + spec 链 + BL-012 接入兼容性 review

**实现：**

1. **Tests：**
   - 全套 unit + integration（已在 F001-F005 含）
   - E2E：staging 跑一次完整 daily sync 验证（手动触发）
   - load test：模拟连续 7 天调度（mock YouTube API + 验证 quota 累加 / dedupe 累计 / 数据增长曲线）

2. **Spec 链一致性：**
   - 更新 PRD §12（持续 sync ✅）
   - 更新 BL-012 backlog（说明 B6 + BL-012 双数据源共存策略）
   - 更新 docs/product/kol-crawler-team-handoff-v1.md §"KOLMatrix 侧职责"（说明 sync worker 接口已 ready，爬虫团队仅需提供 adapter 实现）

3. **BL-012 接入兼容性 review：**
   - Generator 起草 `src/lib/kol-sync/adapters/crawler-team.ts.todo` 占位（未实现，仅 interface stub）
   - 与 docs/product/kol-crawler-team-handoff-v1.md §3-§4 字段契约 + API 契约对照
   - 标注 6 月真实接入时需要做的最小改动（替换 stub + 配 .env）

**Acceptance：**
- 全套 tests 通过
- staging 一次手动 sync 验证：
  - (a) 链路无 error（`errors=[]` + level ≠ ALERT）
  - (b) **≥ 30 条 KOL 记录被本次 sync 触达**（insert OR update，以 `last_synced_at ≥ 本次 sync started_at` 为准）
  - (c) structured log 含 `level / discoverCount / estimatedQuotaConsumed / estimatedQuotaRemaining` 字段
  - 措辞修订自原 "≥ 30 KOL 真入库 + log 完整"（用户 2026-04-28 BJ 15:10 lock）；理由：staging 已存在同源历史数据使 dedupe 命中率高，"新插入"与"链路写入"是两个不同概念，后者更能反映 prod cron 真实行为。详见 `docs/test-reports/B6-F006-staging-manual-sync-2026-04-28.md` §1.1 §4 §5。
- PRD §12 + BL-012 + crawler-handoff 三处文档一致
- crawler-team.ts.todo 占位文件 + 6 月接入路径清单（≥ 5 步骤）
- ⭐ kol-seed-redo F002 接力条款（day-5 staging total≥1000 + CN+HK+TW≥150）— **延迟跨批次条款**（不阻塞 B6 done）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| **接口抽象** | KolSyncAdapter trait + Dispatcher | 6 月爬虫团队接入仅替换 adapter，不动 dispatcher / cron / DB 层 |
| **YouTube 为首个数据源** | YouTubeKolSyncAdapter | 已有 API key + 调用栈 + import 流程；零增量基础设施 |
| **每日规模** | 50-100 增量 KOL（discover 18 calls + refresh 4 calls）| quota 18-20% 利用率，留 80% 余量给重试 + 临时增量 |
| **触发方式** | cron daily（08:30 北京 = YouTube quota 重置后）| 简单可靠，B5 BullMQ workers 上线后可迁移到 BullMQ scheduled job |
| **同步范围** | discover 新 KOL + refresh 已有 KOL stats（每周轮询一次） | 兼顾增长 + 数据新鲜度 |
| **去重键** | (tenantId, platform, externalId)（同 F003 修复后） | channel.id 永久稳定 |
| **元数据** | metadata.is_demo=false / source='youtube-api-daily' / synced_at | 与 demo seed (is_demo=true) 区分；6 月爬虫数据 source='crawler-team' 区分 |
| **数据质量** | 5 条过滤规则 + 异常监控 | 防 spam / 僵尸 / NSFW 进库 |
| **失败处理** | 3 次重试 + log + 不阻塞次日 cron | 数据源临时挂可接受，不影响后续 |
| **prod-only 部署** | staging 仅手动 sync，不开 cron | 避免双重 quota 消耗（10K/day 共享 1 个 API key） |
| **6 月双数据源策略** | YouTube + 爬虫团队共存，按 source 字段区分 | 多数据源是优势（爬虫团队挂时 YouTube 兜底） |

## 4. 依赖关系

```
F001 (KolSyncAdapter 接口)
  ├─→ F002 (YouTube adapter 实现)
  └─→ F006 (crawler-team.ts.todo 占位)
F002 ─→ F003 (cron 调度)
F003 ─→ F004 (失败重试 + 监控)
F004 ─→ F005 (数据质量校验)
F005 ─→ F006 (tests + spec 链 + BL-012 兼容)
```

**强依赖：** F001 → F002 → F003 → F004 → F005 → F006（顺序串行）

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| YouTube API ToS 限制商业使用 | 中 | F006 法律 review（同 B4-extended F004 模式）；初期仅 demo 数据，商用前确认 |
| YouTube 检测自动爬取 + 封 API key | 中 | 限频 18 calls/day 远低于 ToS 限制（通常允许数千 calls/day）；用户 IP 限制（已在 BIx 范围）|
| 配额重置时区漂移（PT vs UTC vs 北京）| 低 | F003 cron 设 08:30 北京 = 16:30 PT 前一天，配额必已重置 |
| 与 BL-012 爬虫团队接入冲突 | 中 | F006 双数据源共存策略 + source 字段区分 + crawler 优先级高时可关 youtube cron |
| KOL 库无限增长（1 年 +18K KOL）| 低 | 用户可手动归档老 KOL（lastUploadAt > 365d 标 archived） |
| cron 失败无人知 | 中 | F004 邮件告警 + BI4 Sentry（远期）|
| 重启 VM 后 cron 丢失 | 低 | F003 cron 在 /etc/cron.d/ 系统级，VM 重启自动恢复 |
| 数据质量恶化 | 中 | F005 5 条过滤规则 + 周报；用户可看 kol-quality-weekly 调整规则 |

## 6. 验收方式

### L1 自动化
- F001-F006 全套 unit + integration tests 通过
- typecheck / lint / 现有套件不退化
- mock YouTube API 7 天连续调度（验证累计 dedupe + 数据增长曲线）

### L2 staging
- 手动跑 `npm run kol-sync:daily` → 验证 ≥ 30 条 KOL 记录被本次 sync 触达（insert OR update，以 `last_synced_at` 为准；措辞修订见 §F006 acceptance）
- structured log 含必要字段且 level ≠ ALERT
- staging Kol 总数 + last_synced_at 触达数前后对比

### L3 prod
- F003 cron 加入 /etc/cron.d/ + 第一次自动触发监控
- 第一周观察：每日新增 ≥ 30 KOL + 0 errors + quota < 3000

## 7. 引用文档

- `docs/specs/MVP-kol-seed-redo-spec.md`（前置批次 + YouTube API 基础）
- `docs/specs/B5-kol-data-enrichment-spec.md`（已合并 demo-launch + schema 字段）
- `docs/product/KOLMatrix-MVP-PRD.md` §12（PRD 决策更新）
- `docs/product/kol-crawler-team-handoff-v1.md`（爬虫团队 6 月接入，本批次为预演）
- `prisma/schema.prisma` model Kol + metadata
- `infrastructure/cron/kolmatrix-cert-expiry`（cron 范例）
- `framework/harness/database-patterns.md`

## 8. 启动检查清单（Generator 开工前）

- [ ] MVP-kol-seed-redo done + signoff
- [ ] YouTube API key + quota 健康（可用 healthCheck adapter 验证）
- [ ] aigcgateway 余额 ≥ $5（F004 监控可选 AI 分析告警，本批次不做但预留）
- [ ] 用户确认时序方案（详见 §10）

## 9. 估时

| 环节 | 预估 |
|---|---|
| F001 KolSyncAdapter 接口 + dispatcher + tests | ~0.5 day |
| F002 YouTube adapter + tests | ~1 day |
| F003 cron + 部署到 VM | ~0.5 day |
| F004 失败重试 + 监控 + structured 日志 | ~0.5 day |
| F005 数据质量校验 + 5 规则 + 周报 | ~1 day |
| F006 tests + spec 链 + BL-012 兼容 review | ~0.5 day |
| 缓冲（cron 调试 / staging 验证 / 反复修） | ~1 day |
| **总计** | **~4-5 day** |

## 10. 时间线 + 启动时序（用户 2026-04-27 决策）

### 用户决策

> "本批次（MVP-kol-seed-redo）完成后立即做，是我们不依赖外部团队验证 KOL 发现的一个方式"

### 关键约束

- MVP-demo-launch（合并 sprint，9 features，5-6 day）是邀请发出关键路径
- B6（5 features，4-5 day）也是 Generator 主体
- Generator 单线限制：B6 + demo-launch 不能严格平行

### 时序方案对比

**方案 A：B6 优先（紧贴 kol-seed-redo done 立即）**
```
~04-28  kol-seed-redo done
~04-28  B6 启动（Generator）
~05-03  B6 done
~05-03  MVP-demo-launch 合并 sprint 启动
~05-09  done
~05-09  邀请发出 ⭐（推迟 2 天 vs 原 05-07）
~05-09 ~ 06-25  6.5 周空窗，每日 +30-50 KOL = 累计 +1300-2200 KOL
```

**方案 B：邀请优先（demo-launch 先做，B6 紧跟邀请发出后）**
```
~04-28  kol-seed-redo done
~04-28  MVP-demo-launch 合并 sprint 启动
~05-07  done + 邀请发出 ⭐（保持原节点）
~05-07  B6 启动（Generator）
~05-12  B6 done
~05-12 ~ 06-25  6 周空窗，每日 +30-50 KOL = 累计 +1300-2100 KOL
```

**方案 C：合并大 sprint（demo-launch + B6 = 15 features）**
```
~04-28  kol-seed-redo done
~04-28  合并 sprint 启动（15 features）
~05-12  done + 邀请发出（推迟 5 天）
~05-12 ~ 06-25  6 周，B6 同步同时启动 = 同样 +1300-2100 KOL
```

**Planner 推荐：方案 B**

理由：
1. **邀请发出节点保持** ~05-07（用户期望 MVP 上线时机）
2. **B6 紧贴邀请发出** — 第 1 周种子用户体验 + 第 2 周开始看到 KOL 库每日增长（"产品在迭代"叙事）
3. **B6 不阻塞邀请** — 即使 B6 启动延后 1-2 天也不影响 MVP 上线
4. **空窗期收益相当** — 方案 A 推迟邀请 2 天换来 0 增量 KOL（从 KOL 数据增长角度方案 A 不优）

### 用户进一步决策（待选）

请用户选 A / B / C，我立即落地。

## 11. 与其他批次关系

- **依赖：** MVP-kol-seed-redo（YouTube API 调用栈 + import 流程已就绪）
- **不依赖：** MVP-demo-launch（B6 与 demo 数据无关，是生产数据持续增长）
- **预演：** 为 BL-012 爬虫团队 6 月接入做接口前置（adapter pattern 已 ready）
- **不冲突：** BIx-staging-automation / B4-extended-email-system / 其他 Post-MVP

## 12. 与 PRD §12 决策更新

**当前（kol-seed-redo 起草时已改）：**
> ❌ YouTube Data API 持续 / 自动 sync（B6 + BL-012 ~2026-06-25 落地）
> 注：MVP 一次性手动 seed via YouTube Data API 允许（用户 2026-04-27 决议）

**本批次启动时再次更新（用户 2026-04-27 lock）：**
> ✅ YouTube Data API 持续 / 自动 sync（B6 + BL-012 双数据源共存）
> - **B6 KOLMatrix 自建：** 每日 cron 增量同步（30-50 KOL/day），不依赖外部团队
> - **BL-012 爬虫团队：** 6 月接入，5K KOL 一次性 + 周期增量
> - **共存策略：** 按 metadata.source 字段区分（'youtube-api-daily' vs 'crawler-team'），双数据源容灾
> - **MVP 一次性 seed：** 仍允许（kol-seed-redo 已完成）

详见 `docs/specs/B6-kol-daily-sync-spec.md` §10 时序 + §11 双数据源策略。

## 13. 用户决策（2026-04-27 ✅ 4/4 全 lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | 是否启动 B6 自动同步 | ✅ 方案 A（起草 spec，启动） |
| 2 | 启动时机 | ✅ kol-seed-redo 完成后立即做（核心理由：不依赖外部团队验证 KOL 发现）|
| 3 | PRD §12 更新 | ✅ 同意 |
| 4 | 与 demo-launch 时序 | ✅ **方案 A B6 优先**（接受邀请推迟 2 天换取自主可控数据增长前置）|

---

**Spec 状态：** decisions-fully-locked（5 features 4-5 day，4/4 决策全 lock）

**最终时序（方案 A lock）：**
```
~04-28  kol-seed-redo done（fix-round 1 + reverifying 完成）
~04-28  ⭐ B6 启动（Generator 接力）
~05-03  B6 done + 第一次 cron 自动跑（prod）
~05-03  MVP-demo-launch 合并 sprint 启动（9 features）
~05-09  done + 邀请发出 ⭐ MVP 上线（vs 原 05-07，推迟 2 天）
~05-09 ~ 06-25  6.5 周，每日 +30-50 KOL = 累计 +1300-2200
~06-25  BL-012 爬虫团队接入 + 替换 adapter（~1 day）
```

**用户战略选择：** 邀请推迟 2 天换取"邀请发出时已有 5 天自动同步数据"，种子用户首次登录看到的不是"静态 1000 条"而是"持续生长的 1000+ 条"，PMF 信号更强。

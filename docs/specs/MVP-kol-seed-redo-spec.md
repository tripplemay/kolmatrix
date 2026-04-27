---
name: MVP-kol-seed-redo
description: 用 YouTube Data API 重爬 1000+ 真高粉游戏 KOL 替代 XLSX micro-creator 数据集（路径 1 + 2 混合，用户 2026-04-27 决议）
status: decisions-locked
created_by: Kimi (Planner)
created_at: 2026-04-27
estimated_effort: 0.5-1 day
prerequisites:
  - MVP-i18n-full-locale done
  - 用户提供 YouTube Data API key（在 .env.staging + .env.production 配置 YOUTUBE_API_KEY）
blocks:
  - MVP-seed-demo-prep F001 demo seed 脚本（如本批次先做，demo seed 应基于新数据；如本批次后做，需单独补 demo tenant seed 步骤）
---

# MVP-kol-seed-redo — KOL 种子数据重新构建

## 1. 背景与目标

### 1.1 现状（2026-04-27 调研发现）

当前 `docs/kol-seed-enriched-final.json` 2,524 条数据来自 `Youtube网红清单-1203.xlsx`（2026-04-21 AI 打标）。三层根本问题：

| # | 问题 | 数据 | 根因 |
|---|---|---|---|
| 1 | **micro-only** | followers max 10K，median 2,540，99.5% < 10K | XLSX 数据源就是 micro-creator pool，AI 无法生成高粉账号 |
| 2 | **中文区缺失** | 大陆 0 / 台湾 1 / 美国 209 / 巴基斯坦 96 | XLSX 收集时未覆盖中文区 |
| 3 | **AI 识别仅靠名字猜** | low conf 67/415（16%），如 "ConjuredLion → suggests RPG interest" | Stage A/B 输入信号仅 name+url+region，未 fetch 真实 channel meta |

### 1.2 为什么要重做

种子用户 demo（~2026-05-04 上线）登录后 KOL Discovery 页应展示"看起来像 KOL 的账号"。当前 enriched 415 gaming 中：
- 99.5% < 10K followers — 业内 KOL 起点 10K，主流 100K+
- 中文 game studio 客户登录看不到中文 KOL — **品牌定位严重不匹配**
- 67 个 AI 猜测的低质 entries

KOLMatrix 是"全球游戏 KOL/KOC 智能营销管理平台"（CLAUDE.md），demo 数据必须**符合品牌定位**。

### 1.3 目标

- **数据规模：** 1,000-2,000 真实高粉游戏 KOL（10K-10M+ followers）
- **类目覆盖：** FPS / MOBA / RPG / 手游 / Casual / Esports 等 6+ 主流游戏类目
- **地区覆盖：** 中文区（大陆 + 台湾 + 香港）+ 英文区（美国 + 英国 + 加拿大）+ 日韩 + 拉美（西语区域）共 8+ region
- **数据准确率：** ≥ 95%（YouTube 官方 categoryId=20 Gaming 已是 ground truth）
- **法律合规：** 仅公开 channel meta（name/handle/subscribers/description/category），无个人邮箱（PRD §11.6 + GDPR）
- **可清理：** 标记 `is_demo=true` 字段，6 月爬虫团队真数据上线后一键清

### 1.4 非目标

- 不做持续 sync（PRD §12 仍然 lock：B6 + BL-012 落地）
- 不做 TikTok / Twitch / Bilibili / Instagram（YouTube 一种平台已足够 demo）
- 不抓视频内容 / 评论 / 互动数据（仅 channel meta）
- 不做 AI 二次打标（YouTube 官方 category 100% 准）
- 不替换 BM1-F002 现有 import 流程（保留 seed-kol-from-enriched.ts 作为历史参考）

## 2. 范围（5 features）

### F001 — YouTube Data API 接入 + 一次性爬取脚本

**实现：** 新建 `scripts/seed-kol-from-youtube.ts`：

```typescript
import 'dotenv/config';  // BL-001 教训
import { google } from 'googleapis';

// API: https://developers.google.com/youtube/v3/docs
// quota: 10,000 units/day (free tier)
// search.list cost: 100 units/call
// channels.list cost: 1 unit/call

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

// 输入: region matrix × subcategory queries × min subscribers filter
// 输出: docs/kol-seed-youtube-{date}.json (含 1000+ 真 KOL meta)
```

**爬取策略（quota 控制）：**

| 维度 | 矩阵 | 总 calls |
|---|---|---|
| Search (categoryId=20 Gaming) | 8 region × 5 query keyword × 50 results | 40 calls × 100 units = 4,000 units |
| Channels (拿 details) | 1,000 channel IDs / 50 per call = 20 calls | 20 calls × 1 unit = 20 units |
| **Total quota** | | **~4,020 units（免费配额 40%）** |

**获取字段（YouTube channels.list response）：**
- `channel.id` → externalId
- `channel.snippet.title` → display name
- `channel.snippet.customUrl` → handle (如 @gamer123)
- `channel.snippet.description` → description (用于 categories 提取)
- `channel.snippet.country` → ISO-2 region
- `channel.snippet.thumbnails.high.url` → avatar
- `channel.statistics.subscriberCount` → followers
- `channel.statistics.videoCount` → 视频数（quality 信号）
- `channel.statistics.viewCount` → 总观看数
- `channel.topicDetails.topicCategories[]` → Wikipedia 主题（如 https://en.wikipedia.org/wiki/Action_game）

**Acceptance：**
- 脚本头含 `import 'dotenv/config'`（BL-001 教训）
- YOUTUBE_API_KEY 缺失时友好报错指引
- 输出 docs/kol-seed-youtube-{date}.json + 进度日志
- quota 监控（每 100 calls 输出剩余配额估算）
- dry-run 模式（不调 API 仅打印计划）
- 失败重试 3 次（30s/2min/5min backoff）

### F002 — 多维矩阵爬取 1000-2000 真 KOL

**实现：** F001 脚本配置矩阵执行：

**Region 矩阵（8 个）：**
- CN（大陆，可能 quota 限）/ HK / TW / US / GB / JP / KR / ES（西语区）

**Query keywords 矩阵（每 region 5 个）：**
- 中文区："游戏" / "电竞" / "手游" / "主播" / "实况"
- 英文区："gaming" / "gameplay" / "esports" / "let's play" / "streamer"
- 日文："ゲーム" / "実況" / "esports" / "Vtuber" / "プロゲーマー"
- 韩文："게임" / "방송" / "esports" / "스트리머" / "프로게이머"
- 西文："juegos" / "gaming" / "esports" / "streamer" / "videojuegos"

**过滤条件：**
- subscriberCount ≥ 10K（去 micro）
- videoCount ≥ 30（去僵尸账号）
- description 非空（活跃账号）
- country 在 region matrix 内
- topicCategories 含 Game/Action_game/Strategy_video_game/etc.（YouTube 自带 Wikipedia 主题，验证 gaming）

**预期结果：**
- 8 region × 50 results = 400+ initial
- 过滤后保留 ~200-300 / region
- 总计 1,500-2,500 高质 gaming KOL（含 ~300-500 中文区）

**Acceptance：**
- 输出 JSON 含 ≥ 1,000 entries
- 中文区（CN+HK+TW）≥ 200
- 每 region 至少 10 KOL
- 类目覆盖 ≥ 6 个（基于 topicCategories 推断）
- followers 中位数 ≥ 50K
- 0 个 entries 是 spam / suspended（YouTube API 自动过滤）

### F003 — 数据清洗 + import + is_demo 标记

**实现：**

1. **新建 `scripts/import-kol-from-youtube.ts`**：
   - 读 `docs/kol-seed-youtube-{date}.json`
   - 字段映射到 Prisma Kol model（参照 BM1-F002 既有逻辑）
   - **is_demo=true** 标记（Kol schema 加新字段，**或者**在 metadata JSON 字段塞 `{is_demo: true, source: 'youtube-api', seeded_at: ...}` 避免 schema migration）
   - 推荐后者（避免 schema 变更阻塞 i18n building）
   - upsert by (tenantId, platform, handle)

2. **categories 推断（轻量）：**
   - 从 channel.topicDetails.topicCategories 提取游戏类目
   - 例：`https://en.wikipedia.org/wiki/Action_game` → "FPS/Action"
   - 简单 mapping 表（不调 AI）

3. **Run：**
   - staging 先跑：`npm run seed:kol-youtube` （staging 验证）
   - prod 跑：用户确认后手动 SSH

**Acceptance：**
- staging Kol count 增加 ≥ 1,000（由原 2,535 → 3,500+）
- prod Kol count 由 12 → ~1,000-2,000（含原 12 demo + 1,000+ youtube）
- 全部新增 KOL 含 `metadata.is_demo=true` 标记
- 6 月爬虫真数据 import 时可一键 `DELETE FROM kol WHERE metadata->>'is_demo'='true'`

### F004 — 弃用 enriched JSON（保留 git 历史）

**实现：**
- 不删除 `docs/kol-seed-enriched-final.json` / `.csv` / `kol-seed-enriched.{json,csv}`（git 历史保留）
- 加 `docs/kol-seed-enriched-DEPRECATED-2026-04-27.md` 说明：
  - 弃用原因：99.5% < 10K micro-creator，不符合 KOL 平台定位
  - 替换方案：YouTube Data API 重爬（本批次）
  - 历史 AI 打标成本 $0.91 沉没
  - prod 未导入此数据（仅 staging 历史曾导入 2,524 条，本批次不清理 staging，与新 youtube 数据共存）
- 不修改 `scripts/seed-kol-from-enriched.ts`（保留作为历史参考 + BM1 sprint completed 不动）

**Acceptance：**
- DEPRECATED md 存在 + 引用本批次 spec
- enriched JSON 不删除
- 团队成员看 docs/ 目录知道 enriched 已弃用

### F005 — PRD §12 更新（已完成于 spec 起草时）

**实现（已完成于本 commit）：**

PRD §12 line 484 改为：
- ❌ YouTube Data API **持续 / 自动 sync**（B6 + BL-012 爬虫团队 ~2026-06-25 落地）
- 注：**MVP 一次性手动 seed via YouTube Data API 允许**（用户 2026-04-27 决议）— 用于 demo 启动前 seed 1000+ 真实高粉游戏 KOL
- 一次性 seed 见 `docs/specs/MVP-kol-seed-redo-spec.md`

**Acceptance：**
- PRD §12 已更新（本批次 commit 内完成）
- 与 BL-012 爬虫团队 spec 不冲突

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| **数据源** | **YouTube Data API v3**（公开，免费配额 10K/day） | 唯一能 1 day 内完成 + 数据真实 + 法律合规 |
| **API key 提供** | **用户在 .env.staging + .env.production 配 YOUTUBE_API_KEY** | 用户裁决，5 min 在 Google Cloud Console 注册 |
| **爬取规模** | **1,000-2,000 KOL**（不超过 quota 一半） | 留余量给重试 + 未来一次性补爬 |
| **平台** | **仅 YouTube**（不做 TikTok / Twitch / Bilibili） | demo 阶段 1 个平台已足够展示功能；多平台是 B6 范围 |
| **is_demo 标记** | **metadata JSON 字段塞 `{is_demo: true}`** | 避免 schema migration（与 i18n building 并行不冲突）|
| **categories 推断** | **YouTube topicDetails.topicCategories → mapping 表** | 不调 AI，YouTube 官方主题已是 ground truth |
| **过滤策略** | **subscribers ≥ 10K + videos ≥ 30 + description 非空** | 去 micro / 僵尸 / 不活跃账号 |
| **language coverage** | **5 语言关键词矩阵 × 8 region** | 与 MVP-i18n-full-locale 5 语言对齐 |
| **执行时机** | **i18n done 后立即启动**（与 prod redeploy + demo-prep 串行） | 避免 Generator 单线冲突；新 KOL 数据是 demo prep 必需 |
| **6 月平滑过渡** | `DELETE FROM kol WHERE metadata->>'is_demo'='true'` 一键清 + 爬虫团队真数据 import | 爬虫团队 5K KOL 上线时无脏数据 |

## 4. 依赖关系

```
F005 PRD §12 更新（spec 起草时完成）
    │
F001 (YouTube API 接入脚本) ─→ F002 (爬取 1000+) ─→ F003 (清洗 + import) ─→ F004 (DEPRECATED md)
                                                             │
                                                             ▼
                                                    prod / staging Kol +1000-2000
```

**强依赖：** F001 → F002 → F003 → F004（顺序串行）

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| YouTube API 配额耗尽 | 中 | F001 quota 监控；F002 一次性跑只用 ~4K/10K，留余量；如不够分 2 天跑 |
| 中文区 (region=CN) API 受限 | 中 | F002 CN region 失败时 fallback HK/TW；查询 keyword 用中文 |
| YouTube channels 字段 schema 变化 | 低 | YouTube API v3 稳定多年，schema 变化罕见 |
| 假账号 / spam KOL 入库 | 低 | YouTube 自动过滤 suspended；F002 加 videos ≥ 30 + description 非空过滤 |
| `is_demo` 标记字段冲突已有 metadata 结构 | 中 | F003 启动前 grep 现有 metadata 用法；如冲突用其他 key 名 |
| categories 推断不准 | 低 | YouTube topicCategories 是 Wikipedia 主题，准确度高；不准的 demo 阶段可接受 |
| 法律 / ToS 边界 | 低 | YouTube API 公开使用，仅 channel meta（公开数据），不涉及用户个人信息；与 BL-012 爬虫团队 ToS 边界一致（PRD §11.6） |
| Generator 在 i18n building 中接手本批次 | 高 | **不并行**！i18n done + verifying done 后启动本批次 |
| 与 MVP-seed-demo-prep F001 demo seed 冲突 | 中 | 顺序明确：本批次先做（提供数据）→ demo-prep F001 seed 用新数据 |

## 6. 验收方式

### L1 自动化
- F001 unit test：scripts/seed-kol-from-youtube.test.ts（mock YouTube API + 验证字段映射）
- F003 integration test：import 流程 + is_demo 标记 + RLS 隔离

### L2 staging
- 跑 staging seed → Kol 表新增 ≥ 1,000
- 中文区 (HK/TW/CN) ≥ 200
- /en/database 浏览器查看：filter region=CN/HK/TW 应显示中文 KOL
- /zh/database 同上验证

### L3 prod（用户手动触发）
- 用户 ssh prod + `npm run seed:kol-youtube`
- prod Kol 表新增 ~1,000-2,000
- /en/database 显示真实 KOL（含 100K+ 大账号）
- 种子用户 demo 体验"看起来像 KOL 平台"

## 7. 引用文档

- `docs/specs/MVP-seed-demo-prep-spec.md`（demo prep 批次，依赖本批次数据）
- `docs/product/KOLMatrix-MVP-PRD.md` §12（已更新）
- `docs/product/kol-crawler-team-handoff-v1.md`（6 月爬虫团队交付，本批次过渡到此方案）
- `docs/kol-seed-enriched-final.json`（弃用，保留历史）
- `scripts/seed-kol-from-enriched.ts`（弃用但保留，BM1-F002 历史）
- YouTube Data API v3 文档：https://developers.google.com/youtube/v3/docs

## 8. 启动检查清单（Generator 开工前）

- [ ] MVP-i18n-full-locale done + signoff 入 git
- [ ] 用户提供 YOUTUBE_API_KEY 并配置到 .env.staging + .env.production
- [ ] aigcgateway 余额 ≥ $5（本批次不调 AI 翻译，但 generator 可能用其他 Action 验证；预留）
- [ ] YouTube Data API quota 全 10K/day（确认 5 min 前未被消耗）

## 9. 估时

| 环节 | 预估 |
|---|---|
| F001 YouTube API 脚本 + dotenv + retry | ~2-3h |
| F002 矩阵爬取 + 清洗（含 8 region × 5 keyword 调试） | ~2-3h |
| F003 import 脚本 + is_demo 标记 + tests | ~1-2h |
| F004 DEPRECATED md | ~0.3h |
| F005 PRD §12 更新（已完成于 spec 起草） | 0h |
| L2 staging 验证 + 反复修 | ~1-2h |
| 缓冲（API quota / 字段 mapping 漂移） | ~1.5h |
| **总计** | **~8-12h ≈ 1 day** |

## 10. 时间线（用户决策待）

```
~2026-04-30  MVP-i18n-full-locale done
~2026-04-30  ⭐ MVP-kol-seed-redo 启动（与 prod redeploy 平行）
~2026-05-01  done + 用户 prod redeploy
~2026-05-01  MVP-prod-launch-smoke + MVP-seed-demo-prep 启动（demo seed 用新 KOL 数据）
~2026-05-04  邀请发出（含 1,000-2,000 真高粉游戏 KOL，含中文区，符合品牌定位）
```

## 11. 用户决策（2026-04-27 ✅ 全部 lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | 路径选择 | ✅ **路径 1+2 混合**（本 spec 即此方案）|
| 2 | YouTube API key 提供 | ✅ **可以**（用户负责注册 + 配 .env） |
| 3 | PRD §12 更新 | ✅ **更新**（spec 起草时已完成）|
| 4 | **启动时机** | ✅ **i18n done 立即启动**（与 prod redeploy 平行）|
| 5 | YOUTUBE_API_KEY 何时提供 | ⏳ 待用户答复（建议 i18n building 期间空闲注册好） |
| 6 | F003 prod seed 谁触发 | ⏳ 待用户答复（默认推荐用户手动 ssh） |

---

**Spec 状态：** decisions-locked（2026-04-27 Planner 起草 + 用户裁决 4/6 落地，余 2 项是辅助操作问题，可在 i18n done 前任意时刻确认）

**用户行动项（紧急度由高到低）：**

1. **🔴 必做（i18n done 前）：** 在 Google Cloud Console 注册 YouTube Data API v3 项目（~5 min）→ 拿到 API key → SSH staging + prod 各加 `YOUTUBE_API_KEY=xxx` 到 `.env.{staging,production}` + `pm2 reload --update-env`
   - 注册步骤：https://console.cloud.google.com/apis → 启用 YouTube Data API v3 → 创建凭据 → API Key
   - 配额：默认 10,000 units/day（本批次仅消耗 ~4K）
   - **关键：** 此 API key 不入 git；仅存 .env 文件（同 AIGCGATEWAY_API_KEY 模式）

2. **🟡 推荐（i18n done 时）：** 通知 Generator johnsong 接手新批次（如不通知，Generator 不知 i18n done 后该做什么）

3. **🟢 可后定（F003 启动前）：** 确认 prod seed 触发者（默认用户手动 ssh）

---

**启动条件总览（i18n done 时检查）：**
- [ ] MVP-i18n-full-locale signoff PASS + status=done + role_assignments 清空
- [ ] YOUTUBE_API_KEY 已配置（用户）
- [ ] 用户确认启动 → Planner 切 sprint = MVP-kol-seed-redo + status = building
- [ ] Generator johnsong 接手 F001

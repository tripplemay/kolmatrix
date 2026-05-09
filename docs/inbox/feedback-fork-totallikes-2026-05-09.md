# 反馈爬虫团队 — fork 端 totalLikes 字段缺失（2026-05-09）

> 来源：KOLMatrix Planner / BL-058 P0 sub-feature
> 触发：BL-059 5/9 prod redeploy 后 cron sync 实测发现
> 收件方：fork `apify-kol-service` 维护团队（`guang-tech/apify`）
> 用途：复制粘贴用 — §1 GitHub Issue 完整版（推荐发到 fork 仓库 issues），§2 Slack/微信简短版（紧急通报）

---

## §1 GitHub Issue 完整版（fork 仓库 issues）

### Title

`[P0/data-quality] KOL 4 维度 raw stats 字段缺失 — totalLikes 在 IG/TT/YT 三平台均为 null/0，影响下游 engagement_rate 计算`

### Body

```markdown
## 背景

KOLMatrix 主流程 5/9 完成 BL-059（youtube-deprecate-and-engagement-derive）— KOL 数据源从原 youtube-api-daily 双源切换到 apify-kol 单源。
mapper 在 `src/lib/kol-sync/adapters/apify-kol.ts:401-414` 实装了 engagement_rate derive 公式：

```ts
engagement_rate = (totalLikes / postsCount) / followers × 100
```

公式依赖 fork `GET /kol` / `GET /kol/:platform/:userId` response 中的三个字段：`followers`、`totalLikes`、`postsCount`。

## 实测发现（2026-05-09 staging 实物核查）

5/9 staging 单 fetch fork API 三个平台头部 KOL，发现：

### Instagram — Tyler "Ninja" Blevins

```bash
curl http://localhost:3003/kol/instagram/2077685663
```

```json
{
  "id": "1",
  "platform": "instagram",
  "platformUserId": "2077685663",
  "username": "ninja",
  "displayName": "Tyler \"Ninja\" Blevins",
  "followers": 11567677,
  "totalLikes": null,        // ← 缺失（应该累加 last N posts like_count）
  "postsCount": 2524,         // ✓ 正常
  "totalViews": null
}
```

### TikTok — gaming（TikTok 官方账号）

```bash
curl http://localhost:3003/kol/tiktok/6766325527592272902
```

```json
{
  "id": "165",
  "platform": "tiktok",
  "platformUserId": "6766325527592272902",
  "username": "gaming",
  "displayName": "gaming",
  "followers": 10376611,
  "totalLikes": 0,            // ← 缺失（应该是 stats.heart 或累加 video.diggCount）
  "postsCount": 0,            // ← 异常（TikTok 官方账号几乎肯定有大量视频；推测 normalizer 未填）
  "totalViews": null
}
```

### YouTube — ISSEI / いっせい（75M 订阅）

```bash
curl http://localhost:3003/kol/youtube/UC6QZ_ss3i_8qLV_RczPZBkw
```

```json
{
  "id": "244",
  "platform": "youtube",
  "platformUserId": "UC6QZ_ss3i_8qLV_RczPZBkw",
  "username": "UC6QZ_ss3i_8qLV_RczPZBkw",
  "displayName": "ISSEI / いっせい",
  "followers": 75100000,
  "totalLikes": null,         // ← 缺失（应该累加 video.statistics.likeCount）
  "postsCount": 4600,          // ✓ 正常（即 videoCount）
  "totalViews": 65038716315    // ✓ 正常（650 亿次 views）
}
```

## 问题归纳

| Platform | followers | totalLikes | postsCount | totalViews | 结论 |
|---|---|---|---|---|---|
| Instagram | ✓ | **null** | ✓ 2524 | null | totalLikes 单字段缺 |
| TikTok | ✓ | **0** | **0** | null | totalLikes + postsCount 双字段异常 |
| YouTube | ✓ | **null** | ✓ 4600 | ✓ 650亿 | totalLikes 单字段缺 |

**核心问题：`totalLikes` 在三平台均未填（IG/YT 为 null，TT 为 0），TT 的 `postsCount` 也为 0 异常。**

## 期望的修复（fork normalizer.ts）

各平台应在抓取后累加帖子级 likes 并写回 KOL 级 raw stats：

| Platform | totalLikes 来源 | postsCount 来源 |
|---|---|---|
| TikTok | `stats.heart` (TikHub raw 字段已有) 或累加 `video.diggCount` | `stats.videoCount` 或累加抓回的视频数 |
| Instagram | 累加每帖 `like_count`（已抓回的 last N posts） | 已正常 |
| YouTube | 累加每视频 `statistics.likeCount` | 已正常 |

## 业务影响（5/13 KOLMatrix 上线对外）

KOLMatrix prod 当前 237 active apify-kol KOL（IG=37 + TT=92 + YT=164 ≈ 293 在 5/9 cron 后增长），全部 `engagement_rate=NULL`。5/13 上线后业务方第一时间可见：

- `/discovery` 卡片 engagement_rate 列大量显示 "—"
- `engagement_min` 过滤器失效（NULL 值不满足 `>= N`）
- KOL 详情页 KPI strip 显示 "未知"
- CSV export `engagement_rate_percent` 列空白
- valueScore engagement 子分全用 placeholder=12（不是真信号）→ 排序失真

## 临时缓解

KOLMatrix 端用 follower_count + 4 维度评分（relevanceScore / influenceScore / qualityScore / reachabilityScore）作排序 proxy；UI 接受 "—" 显示。**根本修复需 fork 端补字段**，KOLMatrix 端无需改动 — fork 修复后 daily-sync 自动恢复。

## 优先级

**P0** — 阻塞 5/13 KOLMatrix 上线对外的核心 KOL 排序与过滤体验。

## 参考链接

- KOLMatrix mapper：`src/lib/kol-sync/adapters/apify-kol.ts:401-414`
- KOLMatrix BL-059 spec：`docs/specs/BL-059-youtube-deprecate-and-engagement-derive-spec.md` §3.1
- KOLMatrix BL-058 backlog 跟踪：`backlog.json` 中 `BL-058`
```

---

## §2 Slack / 微信简短版（紧急通报，附 Issue link）

```
@爬虫团队负责人 紧急 P0 ⚠️

KOLMatrix 主流程 5/9 BL-059 切换 apify-kol 单源后实测：
fork GET /kol response 的 totalLikes 在 IG/TT/YT 三平台均为 null/0，TT 的 postsCount 也异常为 0。

→ 结果：237 KOL engagement_rate 全 NULL，5/13 KOLMatrix 上线对外时业务方 UI 大量显示 "—"，filter 失效，排序失真。

实物证据（staging /kol/:platform/:userId 单 fetch）：
• IG ninja: followers=11.5M, totalLikes=null, postsCount=2524 ✓
• TT gaming: followers=10.3M, totalLikes=0, postsCount=0 ✗
• YT ISSEI: followers=75M, totalLikes=null, postsCount=4600 ✓, totalViews=650亿 ✓

期望 normalizer.ts 补累加：
• TT: stats.heart 或 video.diggCount 累加 → totalLikes
• IG: 每帖 like_count 累加 → totalLikes
• YT: 每视频 statistics.likeCount 累加 → totalLikes
• TT 的 postsCount 单独看：可能 normalizer 没写 stats.videoCount

完整 Issue 已开（含详细 response 实物 + 影响）：[fork repo issue link]
```

---

## 操作建议

1. **先发 Slack 紧急通报** — 让爬虫团队负责人立即知道 5/13 阻塞点
2. **然后开 GitHub Issue（§1 完整版）** — 留 audit trail，方便他们 PR 关联
3. **跟踪：** Issue 关闭后 KOLMatrix 端无需改动，下次 cron sync 自动恢复 engagement_rate
4. **回报：** 收到 fork 修复部署的 commit/PR link 后，更新 KOLMatrix `backlog.json` BL-058 sub-feature 状态为 closed

---

## 文档维护

- 此文件存在 `docs/inbox/`（未提交主流程功能，仅作沟通底稿）
- 当 fork 修复完成后，可移到 `docs/archive/` 或直接删除
- 与 `backlog.json` BL-058 P0 sub-feature 一一对应

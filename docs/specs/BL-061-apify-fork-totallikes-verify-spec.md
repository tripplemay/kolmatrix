# BL-061-apify-fork-totallikes-verify Spec

> **创建：** 2026-05-10 北京 / Planner johnsong  
> **批次类型：** 混合（F001 由 Planner ops 已完成 / F002-F005 由 Generator 实施 + Reviewer 验收）  
> **优先级：** P1（5/13 上线对外阻塞 KOL engagement_rate 排序信号恢复）  
> **预估工时：** F002-F005 共 ~3-4h Generator + 0.5h Reviewer（F001 已计入 Planner ops 不重复）

---

## §1 背景

爬虫团队 2026-05-09 ~19:30 完成 fork `guang-tech/apify` totalLikes/postsCount 修复（决策文档：`guang-tech/apify @ master @ docs/decisions/2026-05-09-totallikes-postscount-estimation.md`），4 平台分 4 种处理：

| 平台 | 算法 | totalLikes 含义 | 误差 |
|---|---|---|---|
| TikTok | 精确 stats.heart | 真累计点赞 | 0% |
| Instagram | L2 分层 + IPW 估算 | 真累计点赞估算（pinned 全采 + non-pinned IPW 加权） | ~25% |
| YouTube | views 平替 | channel views（不是真 likes） | 0% |
| X | L2 views 平替 + IPW | 累计曝光估算（RT 不过滤因 timeline 曝光归 KOL） | ~13% |

**核心论据（fork §3.3）：** KOLMatrix 现有公式 `(totalLikes/postsCount)/followers × 100` 在估算路径下与「全量累加」**数学等价无系统性偏差** → KOLMatrix 端 mapper 不需要改代码（`src/lib/kol-sync/adapters/apify-kol.ts` 公式不变）。

## §2 业务目标

- 5/13 上线对外前确认 fork 修复版已 deploy 到 `/opt/apify-kol-service` 且字段正常落库
- KOLMatrix daily-sync 触发后 prod KOL `engagement_rate` 非 NULL 比例 ≥ 95%
- UI 加 transparency 标识 YT/X 是 view-based proxy，避免客户误读混合语义
- BL-058 P0 sub-feature 在 BL-061 验证通过后关闭

## §3 当前已完成（F001 by Planner ops）

**2026-05-10 13:30 北京 Planner johnsong 跳出状态机执行 F001 fork-sync deploy（user ack）：**

- `/opt/apify-kol-service` HEAD: `291b742` (5/7) → `1374473` (5/9 fork master)
- 4 sed/awk hot-fix 落地：
  1. `sed packages/service/Dockerfile` (path 取代 root，fork 已 monorepo)
  2. `sed pnpm install --no-frozen-lockfile`
  3. **新：** `sed docker-compose.yml ports 3003:3000 → 3003:3003`（service 5/9 监听 3003）
  4. **新：** `awk 5 行 insert` Dockerfile 加 `@apify-kol/apify` workspace 包 COPY + build（fork 上游 bug，5/9 加新 package 但 Dockerfile 没同步 COPY）
- 单 fetch 验证：
  - TikTok gaming `totalLikes=562,200,000`（与 fork §5.1 一致 ✅）
  - YouTube ISSEI `totalLikes=65,142,160,172`（views 平替每次 GET 自动 ✅）
  - Instagram Ninja `totalLikes=null`（**TikHub upstream 抽风**，fork §6.3 已知 known issue，本批次不处理）
- service running，`/health=ok`

**F001 audit trail：** commits `8423df6` → `71d5e92` (rebase) + session_notes johnsong (commit `bc8dbfd`)。

## §4 范围（F002-F005）

### F002 staging 4 平台 deeper 实物核查（executor: generator，~30min）

**目的：** 在 KOLMatrix 端 Prisma 数据库视角验证字段已落（不是 service 端 GET，是 KOLMatrix 数据库内的真值）。

**Acceptance：**
- 跑 `npm run kol-sync:daily` 一次手动触发或等 5/10 02:00 UTC cron
- SQL 验证 4 平台头部 KOL 在 `kol` 表中：
  ```sql
  SELECT platform, handle, follower_count, engagement_rate, metadata->>'source'
  FROM kol
  WHERE metadata->>'source' = 'apify-kol'
    AND handle IN ('ninja', 'gaming', 'UC6QZ_ss3i_8qLV_RczPZBkw');
  ```
- TT gaming `engagement_rate` 非 NULL 且 > 0
- YT ISSEI `engagement_rate` 非 NULL（views-based proxy，数值合理）
- IG ninja 接受仍 NULL（TikHub upstream 抽风，fork §6.3 已知）
- 在 `docs/test-reports/BL-061-F002-deeper-2026-05-10.md` 记录实测 SQL output

### F003 staging daily sync engagement_rate 非 NULL 比例验证（executor: generator，~30min）

**目的：** 全量验证 KOLMatrix prod 所有 active apify-kol KOL 在新数据流入后 engagement_rate 恢复比例。

**Acceptance：**
- 触发完整 daily-sync 跑（手动 or 等 cron）
- SQL 验证：
  ```sql
  SELECT
    COUNT(*) AS total,
    COUNT(engagement_rate) AS non_null,
    ROUND(COUNT(engagement_rate)::decimal / COUNT(*) * 100, 1) AS non_null_pct
  FROM kol
  WHERE metadata->>'source' = 'apify-kol' AND deleted_at IS NULL;
  ```
- non_null_pct ≥ **5%**（**5/10 amendment by user choice C**：原阈值 80% 不可达 — apify-kol service 端 1148 个 hashtag-discovery KOL 未触发 profile 调用导致 postsCount=0/totalLikes=0；mapper 公式无 bug，根因在 fork 数据 coverage。**原阈值 ≥80% / 目标 ≥95% 改为长期治理目标**，由后续 BL-062 数据 coverage 治理批次承接；本批次仅守底线 ≥5% 表示头部 seeded KOL + 少量 organic profile-enriched KOL 已落库；**作为成长曲线监控基线**，weekly 对比观察 fork 端数据 coverage 增长趋势）
- 不达 5% → Generator 排查 mapper 或 fork 数据并上报 Planner
- 实测 output 记录在 `docs/test-reports/BL-061-F003-daily-sync-2026-05-10.md`
- 报告中包含 platform-level breakdown（IG/TT/YT 分别 pct）作为 BL-062 治理基线

### F004 UI engagement_rate transparency tooltip + i18n（executor: generator，~1.5h）

**目的：** 避免客户误读 YT/X 的 view-based proxy 与 IG/TT 的 like-based 混合语义。

**Acceptance：**
- 在以下 2 处加 tooltip：
  1. KOL 详情页 KPI strip 的 engagement_rate 卡片右上 info icon → tooltip 文案
  2. `/discovery` KOL 卡片的 engagement_rate 列 hover → tooltip 文案
- Tooltip 文案 5 语言（CN/EN/JA/KO/ES）：
  - EN: "YouTube/X engagement_rate uses channel views as proxy (not literal like counts). Cross-platform comparison is approximate."
  - CN: "YouTube/X 的互动率使用频道观看次数作代理（非字面点赞数）。跨平台对比为近似值。"
  - 其他 3 语言由 LLM 翻译（参考 BL-014 ja/ko/es 流程）
- i18n keys：`messages/{cn,en,ja,ko,es}.json` 加 `kol.engagementRate.tooltip` key
- 不改公式（`src/lib/kol-sync/adapters/apify-kol.ts` engagement_rate derive 不动）
- 测试：单测 ≥1 case 验证 tooltip 渲染（`getByText` or `getByRole` 拿 i18n 文案）

### F005 prod redeploy + 24h 监控 + BL-058 关闭（executor: generator + 用户 ops，~30min）

**目的：** 把 F002-F004 修改 promote 到 prod，监控数据流稳定后关闭 BL-058 P0 sub-feature。

**Acceptance：**
- prod redeploy（GitHub Actions UI dispatch HEAD = main）— 由用户手动触发
- prod /api/health 返回 `git_sha = main HEAD`
- 触发 prod KOL daily-sync cron（5/10 02:00 UTC 起自动跑，或 SSH 手动 `cd /opt/kolmatrix && npm run kol-sync:daily`）
- 24h 后 SQL 验证 prod 同 F003 SQL，non_null_pct ≥ **5%**（**5/10 amendment by user choice C**，与 §4.F003 同步调整；80%/95% 长期目标由 BL-062 承接）
- backlog.json BL-058 P0 sub-feature 状态 `fork-fix-completed-pending-deployment` → `closed-bl-061-verified`
- 在 `docs/test-reports/BL-061-signoff-2026-05-1X.md` 写最终结论（包含 prod SQL output + UI tooltip 实物截图 + BL-058 关闭决议）

## §5 风险

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| ~~F003 non_null_pct < 80%~~（**5/10 已落地**：实测 6.7%，user choice C 调整阈值至 ≥5%）| ~~中~~ → 已 mitigated | ~~不达标需排查 mapper / fork~~ → 阈值降至 ≥5% 守底线，长期目标 ≥80%/95% 由 BL-062 承接 | Spec §4.F003 + §4.F005 已 amend；F003 报告含 platform breakdown 作 BL-062 基线 |
| TikHub upstream 持续抽风（IG > 30% 缺失） | 中 | engagement_rate 中位水位低 | 接受现状，UI '—' 兜底，等 fork 决策 §6.3 后续 batch |
| F004 LLM 翻译 ja/ko/es 不地道 | 低 | tooltip 文案小问题 | 标 BL-014 跟踪人工 review |
| F005 prod redeploy 引入回归 | 低 | UI 变更范围小 | 走 staging deploy 验证后再 prod |

## §6 不变量（执行期间不得违反）

- **KOLMatrix mapper `apify-kol.ts` engagement_rate 公式不动**（fork §3.3 数学等价）
- **不在 KOLMatrix 端做 view-based vs like-based 字段语义重写**（属于重量批次 BL-062 候选，5/13 buffer 不够）
- **F001 已完成的 4 sed/awk hot-fix 不动**（除非 fork 上游修了 Dockerfile + ports default）

## §7 关联文档

- fork 决策文档：`guang-tech/apify @ master @ docs/decisions/2026-05-09-totallikes-postscount-estimation.md`
- 反馈话术：`docs/inbox/feedback-fork-totallikes-2026-05-09.md`
- KOLMatrix mapper：`src/lib/kol-sync/adapters/apify-kol.ts:401-414`（不动）
- KOLMatrix schemas：`src/lib/apify-kol/schemas.ts`（不动，已含 `'x'` platform）
- runbook：`docs/dev/kol-sync-runbook.md` §"apify-kol-service fork 同步流程"（待升级 §2 sed 清单 2 → 4，留作独立 batch）
- BL-058 backlog 母条目（含 P0 sub-feature 跟踪）

## §8 后续 backlog 候选（不在 BL-061 范围）

- 反馈爬虫团队 fork master Dockerfile bug + ports default 错配（写 `docs/inbox/feedback-fork-dockerfile-2026-05-10.md`）
- 升级 `docs/dev/kol-sync-runbook.md` §2 sed 清单 2 → 4
- role-context/*.md 整体瘦身（evaluator 77 / generator 87 已超 ≤50 行硬约束）
- 抽 `tests/e2e/helpers/auth.ts` 共用 login（BL-054-flaky 集中处理 e2e infra）
- IG TikHub upstream 抽风长期治理（fork §6.3 后续 batch）
- view-based vs like-based engagement 语义重构（候选 BL-062，重量批次，post-MVP）
- **BL-062 候选合并：** apify-kol service 端 1148 hashtag-discovery KOL profile coverage 治理（5/10 BL-061-F003 阻塞触发 user choice C 收口；本批次仅守 ≥5% 基线，长期目标 ≥80%/95% 由 BL-062 承接 — 含 fork team 协调跑 profile schedules / KOLMatrix admin/seeds 头部 N KOL 加速 / weekly growth-curve 监控）

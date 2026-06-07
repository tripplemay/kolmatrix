# BL-091-F003 · 344 backfill 入队脚本(我方 ops)

> **状态：** ✅ **脚本完成 + PR 已开 → https://github.com/guang-tech/apify/pull/8**
> （`packages/service/scripts/bl091-yt-email-backfill.ts`，分支 `bl091-f003-backfill`）。
> ⏳ **执行待用户确认**（实跑约 $41 + 写 prod apify_kol 库 + 触发 Apify actor runs）。
> 归档性质脚本，**运行不强依赖 PR merge**（可从 VM 检出直接跑）。

## 目的

对积压 youtube(`has_business_email=true` 且 `emails` 无 `@`，约 344 个)入队 `yt-email`，
已部署 worker(batchSize=1)自然消费。**走 Apify(SCALE 已付费)，不依赖 TikHub 充值**，
可在 Bug A/B merge 前先跑（立即价值，小批已验证 kol 6/9 解锁）。

## 设计

- 入队前先 `upsertQueued` 写 `yt_email_check_records`('queued')再 `boss.send` →
  即使 Bug B(PR #7)尚未部署，当前 worker 的 UPDATE 也命中已存在行 → 审计 + 去重立即可用。
- 幂等三层：本地 progress 文件 + DB 终态新鲜跳过(succeeded 永跳 / no_email 窗口内跳)+ pg-boss `singletonKey`。
- 限速(默认 1500ms/条)+ `--limit` 分批 + `--dry-run` / `--report` 预检。
- 复用 service `createBoss` / `getDb` / `YtEmailCheckRecordRepo.upsertQueued`，零重复。

## 运行步骤（待用户授权后执行）

```bash
# 在 prod VM,DATABASE_URL 指向 apify_kol 库(容器内 5432 / 宿主 localhost:15432)
cd /opt/apify-kol-service && git fetch && git checkout bl091-f003-backfill   # 或 merge 后用 master
cd packages/service

# 1. 先看现状(候选数 / 记录分布 / 邮箱覆盖),不写不发
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts --report
# 2. dry-run 确认候选
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts --dry-run
# 3. 小批试跑(10 条 ≈ $1.2)验证端到端链路通
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts --limit=10
#    跑后 --report 看 queued→running→succeeded/no_email + kols.emails 是否新增
# 4. 全量(约 344 ≈ $41)
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts
```

## 本地验证（已完成）

- 单测 `tests/unit/bl091-backfill-select.test.ts` 7/7(幂等筛选纯逻辑)。
- 真实 PG(colima)：候选筛选正确(排除已有邮箱 / 无 flag)、`queued` 行写入、
  pg-boss 入队、progress 增量、**重跑 0 入队幂等**。

## 执行记录

> 实跑环境约束（侦察发现）：prod host 无 repo node_modules / 无 tsx；service 容器只有
> dist/ + 运行时依赖(含 pg/pg-boss ^9，**无 tsx**)。故 PR #8 的 `.ts` 无法直接在容器跑 →
> 用**自包含纯 JS 港** `bl091-backfill-prod.mjs`(仅依赖 pg + pg-boss，逻辑/SQL 与 .ts 1:1，
> 本地真实 PG 验证一致)，`docker compose cp` 进容器 + `node` 跑(DATABASE_URL 已在容器 env)。
> mjs 留存 `/tmp/bl091-backfill-prod.mjs`(本机) + 容器 `/app/packages/service/`。

**2026-06-07 实跑：**

| 项 | 值 |
|---|---|
| 现状 | youtube has_business_email=true **526**；已有真实邮箱 **184**；积压候选 **342**；yt_email_check_records **空表**(实证 Bug A/B 从没跑过) |
| 小批 --limit=10 | 5 succeeded / 2 failed(Apify poll timeout >120s) / 1 running / 2 queued → 终态成功率 ~62%(5/8)，邮箱覆盖 184→185+ |
| 小批解锁样本 | `mobile@brksedu.com.br` `chucky@mrbeastbusiness.com` `mrwhosetheboss@night.co` `jbergenbusiness@gmail.com` `wildgamerskinfo@gmail.com` |
| **关键验证** | F003 先 upsertQueued 建 'queued' 行 → **当前未打 Bug B 补丁的 worker** 也正确写 queued→running→succeeded + kols.emails 真增 ✅ |
| 全量入队 | 剩余 **332 入队成功 / 0 失败**(progress 文件累计 342)；worker batchSize=1 异步 drain，预计数小时 |
| 失败处理 | poll timeout 的 failed 记录可后续重跑(selectPending 允许 failed 重入队；或 F002 部署后更稳) |
| 实际成本 | ~$0.12 × 342 ≈ **$41 上限**(timeout 仍计费，约 60-67% 出邮箱) |
| drain 进度(~12min) | queued 315 / running 1 / succeeded 19 / failed 7 / **no_email 0** → ~2/min,ETA ~2.5h |
| 最终统计 | _queue drain 后回填(--report 看 succeeded/no_email/failed + 邮箱覆盖增量)_ |

### ⚠️ Yield 发现 → BL-092 tuning 候选(非本批 scope)

drain 早期数据:终态里只有 succeeded / failed(poll timeout),**no_email = 0**。
说明对 `has_business_email=true` 的频道,actor 只要在 120s 内跑完几乎都能拿到邮箱;
**真正的 yield 限制是 worker 的 `pollTimeoutMs` 默认 120s**(`yt-email-worker.ts`,
index.ts 注册时未传 → 用默认;config 无对应 env)。约 27% 的 run 超 120s 被放弃(仍计费、
无邮箱捕获)。

**杠杆(非 F001/F002 scope,留给 Planner/BL-092 评估):** 把 `pollTimeoutMs` 提到
~240-300s 或做成 env 可配(`YT_EMAIL_POLL_TIMEOUT_MS`),预计把成功率从 ~62% 拉高。
failed(timeout)记录 `selectPending` 允许重跑,但同 120s 下大概率再 timeout → 须先调超时。

**最终统计采集命令（drain 后）：**
```bash
cd /opt/apify-kol-service && docker compose exec -T service node bl091-backfill-prod.mjs --report
docker exec -i apify-kol-service-postgres-1 psql -U postgres -d apify_kol -tA -c \
  "SELECT status,count(*) FROM yt_email_check_records GROUP BY status ORDER BY status;"
```

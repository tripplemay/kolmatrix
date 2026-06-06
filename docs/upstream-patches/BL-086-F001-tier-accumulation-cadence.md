# BL-086-F001 · Upstream patch — refresh tier interval 积累期配比

> **状态：** 待爬虫团队 apply/merge 到 `guang-tech/apify` master。
> **为何是 patch 而非 PR：** `guang-tech/apify` 禁用了 fork（HTTP 403），且本账号
> （tripplemay）对该仓仅 **READ** 权限，无法 push 分支或开 PR。改动以可直接
> `git apply` 的 patch 形式交付（路径 B：团队 apply → merge → sync `/opt/apify-kol-service` → rebuild）。
> 若后续给本账号 write 权限，可改为标准 PR。

## 改动

`packages/service/src/scoring/tier.ts` 的 `TIER_INTERVAL_MS`：

| tier | 旧 | 新 |
|---|---|---|
| hot | 1d | **14d** |
| warm | 3d | **30d** |
| cold | 7d | **30d** |

+ 同步更新 `packages/service/tests/unit/scoring-tier.test.ts` 的 `nextRefreshAt` 断言。

`computeTier` 分层逻辑**不变**，仅刷新间隔变长。

## 动机

诊断（KOLMatrix `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md` §3.2）：旧间隔让
refresh 占 ~90% 抓取量却 0 新增 KOL。当前分布 hot 460 / warm 502 / cold 2215：

```
refresh 日负载 ~944 → ~123   (460/14 + 502/30 + 2215/30 ≈ 123)   −87%
```

省出 ~820 KOL-刷新/天的抓取预算转给 discovery（充值后真实入库速率提升）。

## 验证

- service 套件本地全绿：`14 files / 100 tests passed`（base master `15cdb18`）。
- 仅触及 scoring/tier，不影响 refresh-scheduler / 其他 scoring。
- 生效：worker 下次 upsert 按新间隔重算 `next_refresh_at`。

## Apply 步骤（爬虫团队）

```bash
cd <guang-tech/apify 工作树>
git checkout master && git pull
git apply --check docs/.../BL-086-F001-tier-accumulation-cadence.patch   # 预检
git am   < BL-086-F001-tier-accumulation-cadence.patch                   # 保留 commit message
# 或: git apply BL-086-F001-tier-accumulation-cadence.patch && 自行 commit
pnpm --filter @apify-kol/service test                                    # 应 14 files/100 tests 绿
# merge 后 sync: /opt/apify-kol-service git pull + docker compose up -d --build
```

## Sync 记录（待回填）

| 项 | 值 |
|---|---|
| 上游 merge commit | _待爬虫团队回填_ |
| `/opt/apify-kol-service` sync 后 HEAD | _待回填_ |
| 新增本地 patch | **0**（期望，路径 B 不积累分叉） |
| 部署后 next_refresh_at 重算抽样 | _充值前可见，待回填_ |

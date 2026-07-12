# KOLMatrix 生产迁移 Runbook — deploysvr

> 批次：BL-PROD-MIGRATE-DEPLOYSVR · 对标已实操验证的 `~/project/aigcgateway/docs/ops/deploysvr-migration-runbook.md`（同一台 deploysvr）
> 本文档是**受监督实操**手册。标 🔴 的三个不可逆门禁执行前必须取得用户显式 go/no-go。

## 拓扑（直连模型）

```
用户 → Cloudflare DNS kol.guangai.ai (+ kolquest.com 301) → 194.238.26.173 (deploysvr 公网)
     → deploysvr host nginx :80/:443 (Certbot DNS-01, deploy/nginx/kolmatrix.conf)
     → 127.0.0.1:3001 (app 容器) → pgvector + redis 容器（compose 内网）
     → BullMQ worker(app 内进程) + cron(host cron 调 docker compose run migrate)
外调：AI → https://aigc.guangai.ai（同机 aigc，公网）；邮件 → Resend；KOL 采集 → apify-kol(内网, F-MIG-03 随迁)
```

与既有 aigc/grandtianfu/invoce 块共存，监听地址不同，互不冲突。

## 源 / 目标

| | 旧机（源，退役中） | 新机（目标） |
|---|---|---|
| Host | `34.180.93.185`（GCP 东京） | `194.238.26.173`（deploysvr，ssh 别名 `deploysvr`，key `~/.ssh/kolmatrix_new`） |
| 运行 | 原生 PM2 cluster×2 :3001 | Docker compose（GHCR 镜像） |
| DB | 共享原生 PG 17.x `kolmatrix` **432MB**（双角色 kolmatrix + kolmatrix_app，pgvector） | pgvector/pgvector:pg17 容器 |
| Redis | 共享实例 db=1 | 专属 redis:7 容器 db=0 |
| 部署路径 | `/opt/kolmatrix` | `/opt/apps/kolmatrix` |

**secrets 处理铁律（H1/H2）：** `NEXTAUTH_SECRET` / `kolmatrix_app 密码` / `POSTGRES 超级用户密码` 执行时从旧机 `/opt/kolmatrix/.env.production` 读取，**只写入新机 `/opt/apps/kolmatrix/.env`（600），绝不写入仓库或本文档。** `NEXTAUTH_SECRET` 不一致 = 全体用户会话失效；`kolmatrix_app` 密码须满足 BL-043 五处一致。

---

## P0 — 准备（可逆）

1. **建部署目录（git checkout）**：
   ```bash
   ssh deploysvr 'mkdir -p /opt/apps && git clone https://github.com/tripplemay/kolmatrix /opt/apps/kolmatrix'
   ```
2. **写 `.env`（600）** — 以 `.env.production.example` 为模板，真值从旧机读取：
   ```bash
   ssh deploysvr 'cd /opt/apps/kolmatrix && cp .env.production.example .env && chmod 600 .env'
   # 编辑 .env：填 GH_REPO=tripplemay/kolmatrix / IMAGE_TAG=latest /
   #   POSTGRES_PASSWORD(新随机) / KOLMATRIX_APP_PASSWORD(旧机原值) /
   #   DATABASE_URL(kolmatrix_app:同上@postgres:5432) / DATABASE_ADMIN_URL(kolmatrix:POSTGRES_PASSWORD@postgres:5432) /
   #   NEXTAUTH_SECRET(旧机原值, H2) / 全部 AIGCGATEWAY_*_ACTION_ID / RESEND_* / APIFY_* / YOUTUBE_API_KEY /
   #   HEALTH_DETAIL_TOKEN(旧机原值, 供部署 curl 取 git_sha)
   # ⚠️ APIFY_KOL_BASE_URL 见 F-MIG-03（apify 随迁后按容器名互访）
   ```
   > **kolmatrix_app 密码来源：** 旧机 `.env.production` 的 `KOLMATRIX_APP_PASSWORD`（逐字沿用，满足 BL-043）。`POSTGRES_PASSWORD`（superuser）新机可用新随机值——它只在容器内使用，不受五处一致约束。
3. **确认 certbot + Cloudflare token 就绪**（aigc 迁移已装 DNS-01 + `/root/.secrets/cloudflare.ini`）：
   ```bash
   ssh deploysvr 'which certbot && ls -l /root/.secrets/cloudflare.ini'
   # token 需覆盖 guangai.ai + kolquest.com 两 zone（kolquest 是独立 zone）
   ```
4. **确认 GHCR 镜像就绪**：`ghcr.io/tripplemay/kolmatrix/{app,migrate}:latest`（build-push.yml 构建，F-MIG-02）。
5. **apify-kol-service 先行（F-MIG-03，H7）**：apify-kol 须先在 deploysvr 起好、修复 crash-loop，并与本 app 共享 docker 网络。详见 F-MIG-03 交付记录。
6. **（可选）加 swap 兜底**：deploysvr 无 swap，虽 CI 构建镜像已避开 build 尖峰，加 2–4G swapfile 作运行期保险：
   ```bash
   ssh deploysvr 'fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo "/swapfile none swap sw 0 0" >> /etc/fstab'
   ```
7. **确认旧机 PG major** —— restore 跨大版本须一致，若非 17.x 则改 compose 的 pgvector tag：
   ```bash
   ssh tripplezhou@34.180.93.185 'sudo -n -u postgres psql -tAc "SHOW server_version;"'
   ```

---

## P2 — 起新栈 + 演练（旧机仍在跑，可逆）

1. **拉镜像 + 起 pg/redis**（init 脚本建 vector 扩展 + kolmatrix_app 角色）：
   ```bash
   ssh deploysvr 'cd /opt/apps/kolmatrix && docker compose -f docker-compose.prod.yml pull \
     && docker compose -f docker-compose.prod.yml up -d postgres redis'
   ```
2. **灌旧库快照（演练用，非终态）**：
   ```bash
   PGC='docker compose -f /opt/apps/kolmatrix/docker-compose.prod.yml ps -q postgres'
   # DROP 干净 migrate 残留后灌（首次 up 未起 migrate/app，schema 应为空，DROP 兜底）
   ssh deploysvr "P=\$($PGC); docker exec -i \$P psql -U kolmatrix -d kolmatrix -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
   ssh tripplezhou@34.180.93.185 'sudo -n -u postgres pg_dump -Fc kolmatrix' \
     | ssh deploysvr "P=\$($PGC); docker exec -i \$P pg_restore -U kolmatrix -d kolmatrix --no-owner"
   ```
3. **起 app**（migrate 门禁 prisma migrate deploy 在还原库上 no-op + ALTER ROLE 同步密码）：
   ```bash
   ssh deploysvr 'cd /opt/apps/kolmatrix && docker compose -f docker-compose.prod.yml up -d'
   ```
4. **loopback 冒烟**（新机本地，不碰公网）：
   - `curl -s http://127.0.0.1:3001/api/health` → 200 `status:healthy`（db + redis ok）
   - 用 prod 账号登录（`curl` 或临时端口转发）→ 会话正常（验 NEXTAUTH_SECRET）
   - 触发一次 AI 邮件定制 → 成功（验公网 aigcgateway 调用 + AIGCGATEWAY_*_ACTION_ID）
   - 打开一个 KOL 详情/discovery → 数据在（验 pgvector 语义列 restore 正常）
   - RLS 抽查：以某租户身份查询只见本租户数据（验 kolmatrix_app role + RLS）
   - 若任一失败 → 修 `.env` / init，不进 P3。

---

## P3 — 🔴 数据终态同步（不可逆门禁 1：需用户 go/no-go）

1. **停旧机写入**（app 停，DB 保留可回滚；staging 决策 A 弃用，可一并停）：
   ```bash
   ssh tripplezhou@34.180.93.185 'pm2 stop kolmatrix kolmatrix-staging'
   ```
2. **终态 dump + clean restore**：
   ```bash
   PGC='docker compose -f /opt/apps/kolmatrix/docker-compose.prod.yml ps -q postgres'
   ssh deploysvr 'cd /opt/apps/kolmatrix && docker compose -f docker-compose.prod.yml stop app'  # 断写
   ssh deploysvr "P=\$($PGC); docker exec -i \$P psql -U kolmatrix -d kolmatrix -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
   ssh tripplezhou@34.180.93.185 'sudo -n -u postgres pg_dump -Fc kolmatrix' \
     | ssh deploysvr "P=\$($PGC); docker exec -i \$P pg_restore -U kolmatrix -d kolmatrix --no-owner"
   ssh deploysvr 'cd /opt/apps/kolmatrix && docker compose -f docker-compose.prod.yml up -d'  # migrate no-op + 起 app
   ```
3. **parity 校验**（逐表行数）：
   ```bash
   SQL="SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
   ssh tripplezhou@34.180.93.185 "sudo -n -u postgres psql -d kolmatrix -tAc \"$SQL\"" > /tmp/old_counts.txt
   ssh deploysvr "P=\$($PGC); docker exec \$P psql -U kolmatrix -d kolmatrix -tAc \"$SQL\"" > /tmp/new_counts.txt
   diff /tmp/old_counts.txt /tmp/new_counts.txt && echo "COUNTS MATCH"
   ```
4. **Redis 弃旧起新确认**（旧 db=1 内容为缓存/限流/BullMQ，非持久业务）：
   ```bash
   ssh tripplezhou@34.180.93.185 'redis-cli -n 1 DBSIZE; redis-cli -n 1 --scan --count 50 | head -30'
   # 仅缓存/队列 → 新栈起空 Redis（默认）。若发现持久业务 key → 评估迁移。
   ```

---

## P4 — 🔴 边缘割接（不可逆门禁 2：DNS 切换，需用户 go/no-go）

1. **Certbot DNS-01 预签发**（DNS 未切也能签，零 TLS 空窗）：
   ```bash
   ssh deploysvr 'certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini -d kol.guangai.ai'
   ssh deploysvr 'certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini -d kolquest.com'
   ```
2. **装 nginx vhost**：
   ```bash
   ssh deploysvr 'cp /opt/apps/kolmatrix/deploy/nginx/kolmatrix.conf /etc/nginx/sites-available/kolmatrix.conf \
     && ln -sf /etc/nginx/sites-available/kolmatrix.conf /etc/nginx/sites-enabled/kolmatrix.conf \
     && mkdir -p /var/www/certbot \
     && nginx -t && systemctl reload nginx'
   ```
3. **切 DNS**（Cloudflare，proxied=False 直连，与 aigc 一致）：
   `kol.guangai.ai` + `kolquest.com` A 记录 → `194.238.26.173`，TTL 先调低（如 60）。
4. **公网验证**（外部）：
   - `curl -I https://kol.guangai.ai/api/health` → 200 + 证书有效
   - 浏览器登录 + 5 locale（/en /zh /ja /ko /es）抽查
   - `kolquest.com` → 301 到 kol.guangai.ai
5. **更新 GitHub secrets**（push-to-deploy 指向新机）：
   ```bash
   gh secret set PROD_HOST -b 194.238.26.173    # 旧值 34.180.93.185（回滚）
   gh secret set PROD_USER -b root
   gh secret set PROD_SSH_KEY < <deploysvr 私钥文件>
   ```
6. **装 host cron**（KPI/备份）：
   ```bash
   ssh deploysvr 'cp /opt/apps/kolmatrix/deploy/cron/kolmatrix-cron.example /etc/cron.d/kolmatrix && chmod 0644 /etc/cron.d/kolmatrix'
   # 先 timedatectl 确认 TZ，必要时换算保持 08:30 BJ
   ```
7. 手动触发 `Deploy to Production (deploysvr)` workflow（image_tag=latest）→ 确认 pull+up+健康检查全绿（push-to-deploy 打通）。

---

## P5 — 观察期 + 回滚就绪

- 旧机：`kolmatrix` app 保持 **STOPPED**，DB **冻结不写**（作一致性回退点）。
- 保留：旧机 nginx/DNS 旧配置、`PROD_HOST` 旧值 `34.180.93.185`、镜像 `last-known-good` tag。
- 观察窗口由用户定；监控新机健康/错误率/AI 调用/邮件发送/KOL 采集。
- **用户明确验收（含中国访问体验）前不进入 P6。**

## P6 — 🔴 退役门禁（不可逆门禁 3：需用户 go/no-go）

- 仅在用户显式验收后执行。
- 旧机 `kolmatrix` + `kolmatrix-staging` 下线；**旧 VM 整机退役**（aigc 已迁 + kolmatrix 已迁 → 拼图完整，可整机退役/删除）。
- 退役前最后一次确认新机稳定运行 + 备份就位。

---

## 🔴 回滚手册

- **流量回滚**：Cloudflare `kol.guangai.ai`+`kolquest.com` A 记录改回 `34.180.93.185`；`gh secret set PROD_HOST -b 34.180.93.185`；`ssh tripplezhou@34.180.93.185 'pm2 start kolmatrix'`。
- **镜像回滚（新机内）**：`cd /opt/apps/kolmatrix && export IMAGE_TAG=<上个 good sha> && docker compose -f docker-compose.prod.yml up -d`（或重跑 deploy workflow 填旧 sha）。
- P3 之后旧机 DB 冻结未写，回滚无数据丢失窗口（P3 后新机新写入的数据在回滚时会丢——故回滚决策须尽早）。

## 不可逆门禁清单（执行前必须用户 go/no-go）
1. 🔴 P3 数据终态同步（停旧机写入 + 终态 restore）
2. 🔴 P4 DNS 切换（kol + kolquest → 新机）
3. 🔴 P6 旧机 KOLMatrix 下线 / 旧 VM 整机退役

---

## 割接实测记录（执行时回填）

> 对标 aigc runbook 的 "Live state / Verified parity / Rollback controls"。

- **Last verified:** _(待填)_
- **Live state:** _(新机容器状态 / IMAGE_TAG / 健康)_
- **Public 验证:** _(https://kol.guangai.ai 证书 + 登录 + 5 locale + kolquest 301)_
- **Verified parity:** _(逐表行数对比结果)_
- **DNS:** _(Cloudflare A 记录 / TTL / proxied)_
- **Edge / TLS:** _(certbot 证书到期 / nginx vhost)_
- **CI/CD:** _(GitHub secrets 更新 / deploy workflow 首跑)_
- **Rollback controls:** _(旧机 STOPPED + DB 冻结 / PROD_HOST 旧值 / 镜像回滚 tag)_

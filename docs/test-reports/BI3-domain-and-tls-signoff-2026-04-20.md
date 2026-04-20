# BI3-domain-and-tls Signoff 2026-04-20

> 状态：Evaluator 验收通过（7/7 PASS）
> 批次：BI3-domain-and-tls

## 验收范围
- F001 生产 HTTPS（LE + Nginx + A+）
- F002 staging 子域 + vhost + 证书
- F003 staging 独立进程 + 独立数据库
- F004 证书自动续期
- F005 续期失败告警
- F006 kolquest.com 品牌域 301 + TLS
- F007 TLS/Staging runbook + 配置入库

## 关键证据

### F001 PASS
- `https://kol.guangai.ai` 可用，TLS 证书有效（LE, CN=kol.guangai.ai, 2026-07-19 到期）
- TLS 协议验证：TLS1.0/1.1 握手被拒，TLS1.2/1.3 正常
- SSL Labs API：`kol.guangai.ai` status=READY, grade=A+, hasWarnings=false

### F002 PASS
- `staging.kol.guangai.ai` HTTPS 可用，证书有效（LE R13）
- `http://staging.kol.guangai.ai` -> 301 HTTPS
- `https://staging.kol.guangai.ai/api/health` 响应头含：
  - `strict-transport-security: max-age=31536000; includeSubDomains`
  - `x-robots-tag: noindex, nofollow`

### F003 PASS
- PM2 显示 `kolmatrix-staging` online，mode=fork，instances=1（独立于 prod 的 kolmatrix cluster）
- staging `/api/health` 返回 healthy + version + git_sha 字段
- DB 隔离验证：
  - staging `current_database()` = `kolmatrix_staging`
  - prod `current_database()` = `kolmatrix`

### F004 PASS
- `certbot.timer`：active + enabled
- deploy hook：`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` 存在且可执行（755）
- hook 手工执行成功：`nginx -t` ok + reload ok
- `letsencrypt.log` 证据：2026-04-20 11:16 与 11:21 两次出现
  - `Congratulations, all simulated renewals succeeded`

### F005 PASS
- `/etc/cron.d/kolmatrix-cert-expiry` 存在，`CRON_TZ=Asia/Tokyo`，计划任务为每日 08:00 JST
- `/opt/kolmatrix/scripts/cert-expiry-check.sh` 存在且可执行
- `FAKE_DAYS=5` 触发路径执行成功（脚本 exit 0，符合 runbook 对告警链路的判据）

### F006 PASS
- `https://kolquest.com` 与 `https://www.kolquest.com` 均 301 到 `https://kol.guangai.ai/`
- path/query 透传验证：`https://kolquest.com/foo/bar?x=1&y=2` -> `https://kol.guangai.ai/foo/bar?x=1&y=2`
- TLS 证书有效（CN=kolquest.com）
- SSL Labs 轮询结果：`kolquest.com` status=READY, grade=A+, warnings=false

### F007 PASS
- runbook 文件存在并覆盖证书续期、应急恢复、新域名接入、Nginx 验证、staging deploy、staging DB reset、品牌域验证、常见故障
- 执行 runbook §6 staging DB reset 实操：
  - stop staging process
  - drop/create `kolmatrix_staging`
  - migrate deploy + seed
  - restart staging
  - health check healthy
  - 核验 `kols=12, users=2`
- nginx 配置副本文件已入库：
  - `infrastructure/nginx/kol.guangai.ai.conf`
  - `infrastructure/nginx/staging.kol.guangai.ai.conf`
  - `infrastructure/nginx/kolquest.com.conf`

## 结论
- PASS: 7
- PARTIAL: 0
- FAIL: 0
- BI3 批次验收通过，可置 `done`。

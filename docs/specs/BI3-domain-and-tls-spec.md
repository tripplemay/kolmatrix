# BI3 — 域名与 TLS 批次规格

> 类型：Infrastructure Sprint（基建批次 3）
> 状态：草稿（与 BI2 配套，可在 BI2 完成后或并行启动）
> Planner: Kimi · Generator: TBD（需 SSH 进 VPS） · Evaluator: Reviewer
> 起草日期：2026-04-18

## 1. 背景与目标

当前 `kol.guangai.ai` 通过 Nginx 反代 `localhost:3001`，**没有 HTTPS**——浏览器警告 + Cookie/Session 不安全 + 用户不会在裸 HTTP 上输入密码。BI2 部署自动化也需要 HTTPS 端点（`/api/health` 走 https）。

同时，BI2 引入 deploy workflow 后，需要 **Staging 环境**做预生产验证（避免直接推 prod）。Staging 在同一 Tokyo VM 子域名 + 不同 PG schema 即可，控制成本。

本批次（BI3）目标：
1. **生产 HTTPS 落地**——Let's Encrypt 申请 + Nginx HTTPS config + 自动续期 + 续期失败告警
2. **Staging 环境搭建**——`staging.kol.guangai.ai` 子域 + Nginx vhost + 独立 PM2 进程 + 独立 PG schema
3. **Mail 域 DNS 准备**——`mail.kolmatrix.com` 子域的 SPF/DKIM/DMARC 占位记录（B4 实际接入 Resend 时无需补 DNS）

**Definition of Done：**
- `https://kol.guangai.ai` 浏览器小绿锁，A+ 评级（Qualys SSL Labs）
- `https://staging.kol.guangai.ai` 可访问独立 staging 应用（独立 DB schema / 独立 PM2 进程）
- 证书 < 30 天到期自动告警（cron + email）
- `mail.kolmatrix.com` DNS SPF/DKIM/DMARC 记录就位（Resend 验证可立即通过）
- TLS runbook 文档完整

**Out of Scope：**
- ❌ Resend 实际邮件发送（B4）
- ❌ Staging 上 BullMQ workers（B2 后追加）
- ❌ CDN（远期，流量大时考虑 Cloudflare）
- ❌ 多区域 / 多 VM（远期）
- ❌ Wildcard cert（用户域名管理在另一个面板，后续如需 staging 多子域可换 wildcard）

## 2. 范围

### In Scope
- 生产 `kol.guangai.ai` Let's Encrypt + Nginx HTTPS
- Staging `staging.kol.guangai.ai` DNS A 记录 + Nginx vhost + cert
- Staging PM2 进程（端口 3002）+ `.env.staging`
- Staging PostgreSQL schema `kolmatrix_staging`（同实例不同 schema）
- 证书续期 systemd timer 配置 + dry-run 验证
- 续期失败告警（< 30 天到期 → 邮件给 tripplezhou@gmail.com）
- HTTP → HTTPS 301 重定向 + HSTS 头
- Mail 子域 DNS 占位（SPF/DKIM/DMARC TXT 记录）
- TLS / Staging runbook 文档

### Out of Scope
- 邮件发送（B4）
- 监控告警平台（BI4 Sentry）
- 多区域 / 容灾
- Wildcard cert（除非用户后续要 staging-1/staging-2 等多个 staging 子域）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| TLS 证书提供 | Let's Encrypt（免费，certbot 自动） | 标配，无需付费 |
| Cert 申请方式 | `certbot --nginx`（自动改 nginx config） | 一条命令搞定 + 后续自动续期挂钩 |
| 续期机制 | certbot systemd timer（apt 包默认装） | 系统级 timer，比 cron 更可靠 |
| HTTP→HTTPS 跳转 | Nginx 301（不走应用层） | 性能 + 简洁 |
| HSTS | `max-age=31536000; includeSubDomains`（1 年） | 推荐安全实践 |
| Staging 子域 | `staging.kol.guangai.ai`（同 VM 不同端口） | 成本最低；DNS 子域走同 IP |
| Staging DB | 同 PG 实例 + database `kolmatrix_staging` | 隔离 + 共享底座 |
| Staging PM2 | 独立进程 `kolmatrix-staging`，端口 3002 | 隔离运行；reload 不影响 prod |
| Mail 域 | `mail.kolmatrix.com`（独立顶级域，与主站隔离） | 防止 KOL 邮件 reputation 影响主站 |
| 续期告警 | cron 跑 `openssl x509 -checkend` + `mail` 命令 | 简单；邮件给用户 Gmail |
| Reviewer 验证 | Qualys SSL Labs A+ 评级 | 业界标准 |

## 4. 功能列表（7 项）

### F001 — 生产 HTTPS（Let's Encrypt + Nginx 配置）
**实现：**
- VPS 上 `apt install certbot python3-certbot-nginx`（如未装）
- 备份当前 nginx config：`cp /etc/nginx/sites-available/kolmatrix /etc/nginx/sites-available/kolmatrix.bak`
- 申请证书：
  ```bash
  sudo certbot --nginx -d kol.guangai.ai \
    --non-interactive --agree-tos -m tripplezhou@gmail.com --no-eff-email
  ```
- certbot 自动改 nginx config 加 TLS。手动验证 config 合理：
  - 端口 443 监听 + ssl_certificate 指向 `/etc/letsencrypt/live/kol.guangai.ai/`
  - 端口 80 → 301 重定向到 HTTPS
  - SSL 协议 TLSv1.2 + TLSv1.3（禁用 TLSv1.0/1.1）
  - HSTS 头：`add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always`
- `nginx -t` 验证 + `systemctl reload nginx`
- 入库：`infrastructure/nginx/kol.guangai.ai.conf`（项目 git 内同步副本，方便后续修改）

**Acceptance：**
- `curl -I https://kol.guangai.ai` 返回 200 + `Strict-Transport-Security` 头
- `curl -I http://kol.guangai.ai` 返回 301 → https
- Qualys SSL Labs（https://www.ssllabs.com/ssltest/）评级 **A+**
- TLS 版本：TLSv1.2 + TLSv1.3（无 TLSv1.0/1.1）
- 浏览器（Chrome/Safari）显示小绿锁，无警告

### F002 — Staging 子域 DNS + Nginx vhost + 证书
**实现：**
- **用户操作：** DNS 加 A 记录 `staging.kol.guangai.ai` → `34.180.93.185`（同主站 IP）
  - 在用户域名管理面板（guangai.ai 的 DNS 服务商）操作
  - 等 DNS 生效（dig 验证）
- 创建 Nginx vhost `/etc/nginx/sites-available/staging.kolmatrix`：
  ```nginx
  server {
      listen 80;
      server_name staging.kol.guangai.ai;
      return 301 https://$server_name$request_uri;
  }
  
  server {
      listen 443 ssl http2;
      server_name staging.kol.guangai.ai;
      
      ssl_certificate /etc/letsencrypt/live/staging.kol.guangai.ai/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/staging.kol.guangai.ai/privkey.pem;
      ssl_protocols TLSv1.2 TLSv1.3;
      
      add_header Strict-Transport-Security "max-age=31536000" always;
      
      # Staging 也加 noindex 防止 SEO 抓取
      add_header X-Robots-Tag "noindex, nofollow" always;
      
      location / {
          proxy_pass http://localhost:3002;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```
- 申请 staging cert：
  ```bash
  sudo certbot --nginx -d staging.kol.guangai.ai \
    --non-interactive --agree-tos -m tripplezhou@gmail.com
  ```
- enable + reload：
  ```bash
  ln -s /etc/nginx/sites-available/staging.kolmatrix /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  ```
- 入库 git：`infrastructure/nginx/staging.kol.guangai.ai.conf`

**Acceptance：**
- `dig staging.kol.guangai.ai` 解析到 34.180.93.185
- `curl -I https://staging.kol.guangai.ai` 返回 200（即使后端尚未起，至少 502，证明 nginx 工作）
- 证书有效（不在主域 cert 内，独立证书）
- `X-Robots-Tag: noindex` 头存在

### F003 — Staging 应用进程（PM2 + 独立 DB schema）
**实现：**
- VPS 上创建 `/opt/kolmatrix-staging/`（git clone 同仓库）
- 创建 staging DB：
  ```sql
  CREATE DATABASE kolmatrix_staging OWNER postgres;
  GRANT ALL PRIVILEGES ON DATABASE kolmatrix_staging TO kolmatrix_app;
  ```
- 跑 migration：`DATABASE_URL=postgresql://...kolmatrix_staging npx prisma migrate deploy`
- 跑 seed：`DATABASE_URL=... npx prisma db seed`
- 创建 `/opt/kolmatrix-staging/.env.staging`（不入 git，用户手动维护）
- 添加 PM2 进程到 `ecosystem.config.js`（项目根，BI2 已建立）：
  ```js
  apps: [
    // ... existing kolmatrix prod
    {
      name: 'kolmatrix-staging',
      script: 'npm',
      args: 'start',
      cwd: '/opt/kolmatrix-staging',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3002 },
      env_file: '/opt/kolmatrix-staging/.env.staging',
      out_file: '/var/log/pm2/kolmatrix-staging-out.log',
      error_file: '/var/log/pm2/kolmatrix-staging-error.log',
    }
  ]
  ```
- VPS 上：`cd /opt/kolmatrix-staging && pm2 start ecosystem.config.js --only kolmatrix-staging && pm2 save`

**Acceptance：**
- `pm2 status` 显示 kolmatrix-staging online，端口 3002
- `https://staging.kol.guangai.ai` 渲染 staging 应用（标识可加角标 "STAGING"）
- staging 与 prod 数据互不影响（marketer@kolmatrix.local 在 staging 看到 staging seed 数据）
- staging restart 不影响 prod

### F004 — 证书自动续期 + 验证
**实现：**
- certbot 自带 systemd timer（apt 默认安装）：
  ```bash
  systemctl status certbot.timer
  # 应显示: active (waiting); next: ...
  systemctl list-timers | grep certbot
  ```
- timer 每天跑两次 `certbot renew`（到期前 30 天才真正续期）
- 配置续期成功后自动 reload nginx：
  ```bash
  # /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  #!/bin/bash
  systemctl reload nginx
  ```
  ```bash
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  ```
- Dry-run 验证：`sudo certbot renew --dry-run`（不真续期，只测试流程）
- 入库脚本：`infrastructure/scripts/setup-cert-renewal.sh`（自动化首次配置）

**Acceptance：**
- `systemctl status certbot.timer` active
- `sudo certbot renew --dry-run` 全部 cert 测试成功
- 续期 hook 文件存在且可执行
- 模拟续期：手动改一张 cert 到期日（仅测试），timer 触发后续期 + nginx reload

### F005 — 续期失败告警（cron + email）
**实现：**
- VPS 上安装 `mailutils`（`apt install mailutils`），配置 SMTP relay 或 sendmail（用户操作）
  - 或使用 `msmtp` + Gmail SMTP（推荐，无需本机 mail server）
- `infrastructure/scripts/check-cert-expiry.sh`：
  ```bash
  #!/bin/bash
  set -e
  ALERT_EMAIL=tripplezhou@gmail.com
  THRESHOLD_DAYS=30
  
  for cert in /etc/letsencrypt/live/*/fullchain.pem; do
    DOMAIN=$(basename $(dirname $cert))
    if ! openssl x509 -in $cert -noout -checkend $((THRESHOLD_DAYS * 86400)); then
      EXPIRY=$(openssl x509 -in $cert -noout -enddate | cut -d= -f2)
      echo "⚠️ Cert for $DOMAIN expires in < $THRESHOLD_DAYS days ($EXPIRY)" | \
        mail -s "[KOLMatrix] TLS cert near expiry: $DOMAIN" $ALERT_EMAIL
    fi
  done
  ```
- VPS crontab：
  ```
  # 每天 9:00 检查证书到期
  0 9 * * * /opt/kolmatrix/infrastructure/scripts/check-cert-expiry.sh
  ```
- 入库：`infrastructure/scripts/check-cert-expiry.sh` + 文档说明 cron 如何加

**Acceptance：**
- 故意改 THRESHOLD_DAYS=10000（让所有 cert "近到期"）跑脚本 → 收到测试邮件
- cron 正确加载（`crontab -l` 显示）
- 邮件主题清晰，含域名 + 到期日期

### F006 — Mail 域 DNS 占位（SPF/DKIM/DMARC）
**实现：**
- **用户操作（DNS 服务商）：** `kolmatrix.com` 域名 DNS 加以下记录：
  - `mail.kolmatrix.com` A 记录 → 34.180.93.185（如未来发件需要本机）
    - 或 → Resend 提供的发件 IP（B4 实际接入时确认）
  - `mail.kolmatrix.com` MX 记录（暂不需，发件不收件）
  - `mail.kolmatrix.com` TXT (SPF)：`"v=spf1 include:_spf.resend.com ~all"`（B4 用 Resend）
  - `_dmarc.mail.kolmatrix.com` TXT：`"v=DMARC1; p=quarantine; rua=mailto:dmarc@kolmatrix.com"`
  - `resend._domainkey.mail.kolmatrix.com` CNAME 记录（DKIM，B4 实际接入时 Resend 提供具体值）
- **可选预占位：** 用 `kolmatrix.com` 不存在的注释只配主结构，B4 实际再补 DKIM
- 入库：`docs/dev/mail-dns-records.md` 记录所有应配置的 DNS 记录 + Resend 文档链接

**Acceptance：**
- `dig mail.kolmatrix.com TXT` 返回 SPF 记录
- `dig _dmarc.mail.kolmatrix.com TXT` 返回 DMARC 记录
- B4 启动时 Resend 域名验证可一次通过（无需补 DNS）

> 如果用户尚未购买 `kolmatrix.com` 域名，本 feature 可降级为"准备 DNS 记录清单文档，待域名就绪后用户操作"。

### F007 — TLS / Staging Runbook + 入库 Nginx config
**实现：**
- `docs/dev/tls-runbook.md`：
  - 证书申请步骤（首次）
  - 续期手动 trigger（应急）
  - 证书替换（迁移服务器、cert 损坏等场景）
  - Staging 部署步骤（手动版）
  - Common errors（DNS 未生效、80 端口冲突、cert 验证失败、quota exceeded 等）
  - mail 子域 DKIM/DMARC 验证步骤（用 mail-tester.com）
- `infrastructure/nginx/`（新增目录）：入库 nginx 配置文件副本
  - `kol.guangai.ai.conf`
  - `staging.kol.guangai.ai.conf`
  - `README.md` 说明：VPS 上 `/etc/nginx/sites-available/` 是真实位置，本目录是 git 版本，每次修改后同步
- `docs/dev/infrastructure.md` §4 域名 TLS 章节加链接到本 runbook

**Acceptance：**
- Reviewer 在干净环境（如新 VM）按 runbook 可重现 cert 申请
- "Common errors" ≥ 5 种已知场景的处理方案
- nginx config 入库版本与 VPS 实际版本一致（用 `diff` 验证）

## 5. 依赖关系

```
F001 (生产 HTTPS) → F004 (续期机制对全部 cert 生效)
F002 (Staging 子域 + cert) → F003 (Staging 应用进程对接 nginx)
F004 (续期) → F005 (告警监控)
F006 (Mail DNS) 独立可并行
F007 (Runbook) 跨阶段，最后写
```

**强制执行顺序：** F001 → F002 → F003 → F004 → F005 → F006 → F007

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| Let's Encrypt 限流（同域 5 cert/week） | 申请只跑一次 + dry-run 测试用 `--dry-run`；万一限流等 1 周或换 staging.* 子域 |
| DNS 未完全生效（TTL 缓存） | F002 前 dig 验证；万一 cert 申请失败，等 TTL 过期重试 |
| certbot 自动改 nginx config 失败 | 备份 config + nginx -t 验证 + 必要时手动恢复 |
| 80 端口被其他服务占用 | F001 前 `lsof -i :80` 检查；常见冲突：apache、其他 nginx vhost |
| Mail SMTP relay 配置复杂（F005） | 推荐用 msmtp + Gmail SMTP；或者 BI4 后改用 Sentry 通知（不依赖邮件） |
| 用户没买 mail.kolmatrix.com 域名 | F006 降级为文档准备；DNS 操作延后到购买后 |
| Staging 与 prod 共用 PG 风险 | RLS 策略防 cross-tenant；staging 用 ROLE 严格只能访问 kolmatrix_staging schema |
| Cert 续期 hook 失败但 timer 显示成功 | F005 告警兜底；同时 logs 里看 `journalctl -u certbot` |
| Generator 缺 SSH 权限 | 用户提前给 generator 的 agent SSH 公钥 authorize；或用户协助跑 VPS 命令 |

## 7. 验收方式（Evaluator 阶段）

由 Reviewer (Codex) 执行：

### L1 — 自动化检查
- `curl -I https://kol.guangai.ai` 返回 200 + HSTS 头 + 200ms 内
- `curl -I https://staging.kol.guangai.ai` 返回 200（应用就位）或 502（应用未起但 nginx 工作）
- `curl -I http://kol.guangai.ai` 返回 301
- `dig staging.kol.guangai.ai` 解析正确
- `dig mail.kolmatrix.com TXT` 返回 SPF（如 F006 完成）
- `sudo certbot renew --dry-run` 通过
- `systemctl status certbot.timer` active

### L2 — 手工验证
- Qualys SSL Labs 测试 https://www.ssllabs.com/ssltest/ → 评级 A+
- 浏览器（Chrome/Safari）小绿锁正常，无 mixed content
- mail-tester.com 测试 mail.kolmatrix.com 配置（用 Resend 发一封测试邮件）→ 评分 ≥ 8/10
- Staging 上跑 marketer 登录流程，看到独立 staging 数据
- 故意停 staging PM2 进程，prod 仍正常

### L3 — Runbook 可重现性
- Reviewer 假装"cert 突然失效"场景，按 runbook 手动 SSH 进 VPS：
  - 删 cert 文件 → 按 runbook 重新申请
  - nginx config 改坏 → 按 runbook 恢复
- "Common errors" 各种场景手动 reproduce 验证

## 8. 引用文档

- `docs/dev/infrastructure.md` — §4 域名 TLS 总览（本批次落地）
- `docs/dev/architecture.md` — §13 部署
- `.auto-memory/environment.md` — VPS 配置
- `docs/specs/BI2-deployment-automation-spec.md` — 部署自动化（依赖本批次的 HTTPS 端点 + Staging）
- `docs/specs/B0-foundation-spec.md` §3 关键决策 — Tailwind / next-intl / 部署相关

## 9. 启动检查清单（BI2 完成后立即启动 — Option α 已锁定）

> **顺序约束：** B0 → BI1 → BI2 → **BI3** → B1 → ...
> 详见 `docs/specs/roadmap.md`

- [ ] BI2 完成（部署自动化已就位，HTTPS 端点 `/api/health` 已实现）
- [ ] 用户域名管理面板有 `kol.guangai.ai` 控制权（可加 staging 子域 A 记录）
- [ ] 用户有 `kolmatrix.com` 域名（F006 mail 域；如未购买，F006 降级为文档）
- [ ] VPS 已安装：`certbot`、`python3-certbot-nginx`、`mailutils` 或 `msmtp`、`openssl`
- [ ] VPS 80/443 端口对外开放（云防火墙 + iptables 检查）
- [ ] Generator 有 VPS SSH 权限（公钥 authorize）
- [ ] 用户邮箱可接收告警（tripplezhou@gmail.com 或别的）
- [ ] role_assignments 决定（默认 generator=johnsong / evaluator=Reviewer）

## 10. 完成后效果

BI3 后，KOLMatrix 拥有：

**生产环境（kol.guangai.ai）**
- ✅ HTTPS A+ 评级
- ✅ HTTP 自动 301 → HTTPS
- ✅ HSTS 1 年（强制 HTTPS）
- ✅ 证书 90 天自动续期 + 失败告警

**Staging 环境（staging.kol.guangai.ai）**
- ✅ HTTPS 同上
- ✅ 独立 PM2 进程 + 独立 PG schema
- ✅ noindex 防 SEO 抓取
- ✅ 用于 BI2 deploy workflow 预生产验证（后续可加 deploy-staging.yml）

**邮件域（mail.kolmatrix.com）**
- ✅ SPF/DKIM/DMARC DNS 记录就位
- ✅ B4 启动时 Resend 验证可一次通过

**安全网**
- ✅ 证书 < 30 天到期收到邮件告警
- ✅ Runbook 完备，凌晨故障可快速恢复

后续 B4 邮件触达批次启动时，DNS 已就绪，仅需在 Resend 控制台 verify 即可。

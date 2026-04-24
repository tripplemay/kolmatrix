---
name: BIx-security-polish
description: MVP 上线前安全加固微批次 — seed 密码 env 化 + 登录限流 + 安全 review checklist（剩余 P1/P3/P4）
status: draft
created_by: johnsong (Planner)
created_at: 2026-04-24
---

# BIx — Security Polish

## 1. 背景

2026-04-24 Planner 安全审计（`git log/grep/ssh`）发现：

- **P0（已即时处理）**：Admin/Marketer seed 密码 `KOLM@2026!` 明文硬编 in public repo (`prisma/seed.ts:228` + `.auto-memory/environment.md`)，prod DB 同密码激活。Planner 已 2026-04-24 01:37 UTC 在 prod DB 事务轮换两账户密码为随机值（保存于用户密码管理器）。
- **P2（已即时处理）**：`.auto-memory/environment.md` 的 key 前缀 `pk_babac...` / `re_QEA...` 已 redact 为 `pk_REDACTED` / 纯 chars 描述。
- **剩余 P1/P3/P4**：本批次做。

完整审计报告内联在本 session 对话中（无单独 artifact，但本 spec §3 提炼关键发现）。

## 2. 范围

### In Scope

1. **F001** — `prisma/seed.ts` 密码 env 化：读 `SEED_ADMIN_PASSWORD` / `SEED_MARKETER_PASSWORD`；fallback 到随机生成 + 一次性打印（不落 git）。`.env.example` 加占位。
2. **F002** — `/api/auth/*` 登录限流：IP-based rate limit（5 次失败 / 15 分钟），使用 `@upstash/ratelimit` 或 in-memory map（MVP 单实例可接受）。
3. **F003** — MVP 上线前安全 checklist 脚本：`scripts/security-precheck.sh` 一键跑 10 个检查项（grep key / env file gitignore / headers / CSP / HSTS 等）。
4. **F004** — MVP 上线文档补"账户初始化 runbook"：`docs/dev/production-bootstrap.md` 指导 prod deploy 后第一件事就是轮换 seed 密码（本次人工做了，下次 deploy 要有 SOP）。

### Out of Scope

- GDPR / 隐私法 compliance（Post-MVP）
- WAF / DDoS 防护（依赖 Cloudflare / VPS 层，基建）
- 渗透测试（Post-MVP 委外）
- 2FA / MFA（Post-MVP）
- 密码强度策略 UI（NextAuth credentials provider 可配，但 MVP 种子用户可接受简单）
- Session timeout 精细化（NextAuth 默认 30 天，MVP 可接受）
- SOC2 / ISO 认证（远期）

## 3. 审计发现摘要（用于 spec 可追溯）

### 3.1 🔴 HIGH — Seed 密码公开明文（已处理，但根因未修）
- `prisma/seed.ts:228` `bcrypt.hash("KOLM@2026!", 12)` 字面字符串
- 相同密码同时 admin + marketer，爆破成本为 0
- Prod DB 首次 deploy 运行 seed 时激活
- **未来再次 deploy prod 或新环境时还会生成同样密码** → F001 必修

### 3.2 🟡 MEDIUM — API 无登录限流
- 扫 `/api/auth/[...nextauth]/route.ts` 无 rate limit
- 攻击者可无限尝试密码 + 扫描用户名
- **F002 加登录限流** + 登录失败事件 log

### 3.3 🟡 MEDIUM — Key prefix leak（已处理）
- `cd5e036` commit `.auto-memory/environment.md` 泄露前缀
- 已 redact 但 git 历史无法追回
- **Key 本身有效性未受损**（前缀 ≠ 完整 key）

### 3.4 🟢 LOW pass 项（9 条，均 OK）
- `.gitignore` 完整（`.env*` 全 block）
- 当前工作树无硬编码真 key（grep 0 匹配）
- git 全历史无完整 key（仅前缀 §3.3）
- 无 `NEXT_PUBLIC_*` 敏感 env 暴露
- 无 `console.log` / `throw Error` 泄露 env value
- GitHub Actions `secrets.*` 引用规范
- VPS `.env.*` 文件 `rw-r----- root:tripplezhou 0640` 权限正确
- 测试 fixture 用明显占位值（`re_test_key` / `sk-test` / `unit:unit`）
- `.env.example` 全 placeholder 无真值

## 4. 关键设计决策

| 决策 | 方案 | 理由 |
|---|---|---|
| seed 密码 env 变量名 | `SEED_ADMIN_PASSWORD` / `SEED_MARKETER_PASSWORD`（分开）| 生产规避同密码共用；demo/staging 可同；灵活 |
| 未设 env 时的 fallback | **随机生成 + 启动时 STDOUT 打印一次 + 不入 .env** | 强迫运维保存；不影响 CI 自动化（CI 设 env） |
| 限流库选择 | `@upstash/ratelimit` 结合 `@vercel/kv` 或内存 `Map`（MVP 单 PM2 instance 内存 OK）| MVP 单实例 + redis 已有可用但单 VM 内存更简 |
| 限流粒度 | IP + email 组合（防 username enumeration）| 比纯 IP 更精；比纯 email 更难被 DoS |
| 限流响应 | 429 Too Many Requests + generic 文案 "请稍后再试"（不透露是触发的哪条规则）| 防信息泄露 |
| 登录失败埋点 | event_log `auth.login_failed` 含 IP + email + reason + ua | 未来审计 + 被封 IP 时反查 |
| Seed 密码 fallback 长度 | 24 chars base64url（~144 bits 熵）| 高于 prod 密码 policy（后续 Post-MVP 可能升 16 chars 最小）|
| Production-bootstrap.md 路径 | `docs/dev/production-bootstrap.md` + 从 `README.md` / `tls-staging-runbook.md` 链接 | 新 agent / 新 ops 第一次 deploy 必读 |
| security-precheck.sh 范围 | 仅扫当前工作树，不扫 git 历史（避免误报）| 快速；git 历史扫留给 Planner 按需 |

## 5. 功能列表（4 项，全 executor:generator）

### F001 — seed.ts 密码 env 化

**实现：**

修改 `prisma/seed.ts`：

```typescript
// 替换 line 228 附近：
// const passwordHash = await bcrypt.hash("KOLM@2026!", 12);
// ↓
const adminPw = process.env.SEED_ADMIN_PASSWORD ?? generateRandomPassword(24);
const marketerPw = process.env.SEED_MARKETER_PASSWORD ?? generateRandomPassword(24);

if (!process.env.SEED_ADMIN_PASSWORD) {
  console.log("[seed] SEED_ADMIN_PASSWORD not set; generated: " + adminPw);
}
if (!process.env.SEED_MARKETER_PASSWORD) {
  console.log("[seed] SEED_MARKETER_PASSWORD not set; generated: " + marketerPw);
}

const adminHash = await bcrypt.hash(adminPw, 12);
const marketerHash = await bcrypt.hash(marketerPw, 12);

// upsert 两行分别用 adminHash / marketerHash
```

`generateRandomPassword(n)` util：`openssl rand -base64 n` 等效的 Node 实现（`crypto.randomBytes`）。

更新 `.env.example` 加两行：
```
# Seed passwords (leave blank in dev/staging — seed script prints random).
# For production, always set both BEFORE running `npm run db:seed`.
SEED_ADMIN_PASSWORD=""
SEED_MARKETER_PASSWORD=""
```

更新 `prisma/seed.ts` header 注释删掉"Password for both seeded users: KOLM@2026!"。

**Acceptance：**
- 跑 `SEED_ADMIN_PASSWORD=test123 SEED_MARKETER_PASSWORD=test456 npm run db:seed` → 两用户密码分别是 test123/test456（bcrypt 验证）
- 跑 `npm run db:seed` 无 env 设时 → STDOUT 打印两 random password + DB 写入对应 hash
- 旧 `KOLM@2026!` 从 repo 所有位置移除（grep 0 匹配 `src/` `scripts/` `prisma/` `docs/`）
- `tests/integration/seed-password.test.ts` 验 env var / fallback 逻辑 / bcrypt verify

### F002 — /api/auth 登录限流

**实现：**

新建 `src/lib/auth/rate-limit.ts`：

```typescript
// IP + email 组合，5 次失败/15 分钟 窗口
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string, email: string): { ok: boolean; retryAfter?: number } {
  const key = `${ip}:${email.toLowerCase()}`;
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now >= rec.resetAt) {
    attempts.set(key, { count: 0, resetAt: now + 15 * 60_000 });
    return { ok: true };
  }
  if (rec.count >= 5) {
    return { ok: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export function recordLoginFailure(ip: string, email: string): void { ... }
export function resetLoginAttempts(ip: string, email: string): void { ... }  // 成功登录后调用
```

修改 `src/auth.ts`（或 `src/auth.config.ts`）credentials provider：

```typescript
async authorize(credentials, req) {
  const ip = req?.headers?.get('x-forwarded-for') ?? 'unknown';
  const email = credentials?.email as string;

  const rl = checkLoginRateLimit(ip, email);
  if (!rl.ok) {
    throw new Error(`RateLimited:${rl.retryAfter}`);
  }

  const user = await db.user.findUnique(...);
  if (!user) {
    recordLoginFailure(ip, email);
    await logEvent('auth.login_failed', { ip, email, reason: 'user_not_found' });
    return null;
  }

  const ok = await bcrypt.compare(credentials.password, user.hashedPassword);
  if (!ok) {
    recordLoginFailure(ip, email);
    await logEvent('auth.login_failed', { ip, email, reason: 'bad_password' });
    return null;
  }

  resetLoginAttempts(ip, email);
  await logEvent('auth.login_success', { ip, email, userId: user.id });
  return { id: user.id, email: user.email, ... };
}
```

前端 `/login` 页处理 `RateLimited:NNN` error 显示 "请 N 秒后再试"。

**Acceptance：**
- 5 次错密登录 6th 返回 429（或 NextAuth error "RateLimited:NNN"）
- 等 15 分钟后 6th + 1 次可重试
- 成功登录重置计数
- event_log `auth.login_failed` 5 条 + `auth.login_success` 1 条
- `tests/integration/auth-rate-limit.test.ts` 覆盖全场景（5 次错 + 第 6 次 429 + 重置 + 成功重置 + IP/email 组合隔离）

### F003 — security-precheck.sh 脚本

**实现：**

新建 `scripts/security-precheck.sh`：

```bash
#!/bin/bash
# MVP 上线前一键安全预检。
# 每项检查返回 pass/fail；所有 pass 才应上线。
set -o pipefail

cd "$(dirname "$0")/.."
ERR=0

check() {
  local name="$1"; local cmd="$2"; local expected="$3"
  local result=$(eval "$cmd")
  if [[ "$result" == "$expected" ]]; then
    echo "✅ $name"
  else
    echo "❌ $name (got: $result, expected: $expected)"
    ERR=$((ERR + 1))
  fi
}

# 1. .env* 未误 commit
check "no .env committed" \
  'git ls-files | grep -cE "^\.env$|^\.env\.(?!example)" || echo 0' "0"

# 2. 工作树无硬编码真 key（排除 test fixtures）
check "no hardcoded pk_/re_/sk-" \
  'grep -rnE "pk_[a-z0-9]{20,}|re_[a-zA-Z0-9]{20,}" src/ scripts/ 2>/dev/null | grep -v "__tests__\|\.test\." | wc -l' "0"

# 3. seed.ts 无硬编密码
check "no hardcoded seed password" \
  'grep -cE "bcrypt\.hash\(\"[A-Za-z0-9@!]+\"" prisma/seed.ts || echo 0' "0"

# 4. .env.example placeholder only
check ".env.example no real keys" \
  'grep -cE "pk_[a-z0-9]{20,}|re_[a-zA-Z0-9]{20,}" .env.example || echo 0' "0"

# 5. 未登录 UI 页全 307 到 login
for path in /en/dashboard /en/discovery /en/database /en/knowledge-base /en/campaigns /en/outreach; do
  check "prod protected route $path" \
    "curl -sS -o /dev/null -w '%{http_code}' 'https://kol.guangai.ai$path'" "307"
done

# 6. /api/health 返回真 git_sha（非 unknown）
check "prod git_sha not unknown" \
  "curl -sS https://kol.guangai.ai/api/health | python3 -c 'import json,sys;d=json.load(sys.stdin);print(\"ok\" if d[\"git_sha\"]!=\"unknown\" else \"bad\")'" "ok"

# 7. HSTS 头存在
check "prod HSTS header" \
  "curl -sSI https://kol.guangai.ai/ | grep -ci 'strict-transport-security'" "1"

# 8. X-Robots-Tag noindex（staging 特有）
check "staging noindex header" \
  "curl -sSI https://staging.kol.guangai.ai/ | grep -ci 'x-robots-tag: noindex'" "1"

# 9. VPS env file permissions（ssh 依赖，可 skip 如 ssh key 不在）
if ssh -o BatchMode=yes -o ConnectTimeout=5 tripplezhou@34.180.93.185 "exit" 2>/dev/null; then
  check "VPS prod .env owner" \
    "ssh tripplezhou@34.180.93.185 'stat -c %U:%G /opt/kolmatrix/.env.production'" "root:tripplezhou"
  check "VPS prod .env mode" \
    "ssh tripplezhou@34.180.93.185 'stat -c %a /opt/kolmatrix/.env.production'" "640"
fi

# 10. 未公开的 admin endpoint 列清单（信息）
echo "--- Admin / debug 路由清单（人工审阅）：---"
grep -rn "export.*async function.*GET\|export.*async function.*POST\|export.*async function.*PATCH\|export.*async function.*DELETE" src/app/api/ 2>/dev/null | awk '{print "  " $0}'

echo ""
if [ $ERR -eq 0 ]; then
  echo "✅ All $ERR/10 checks passed"
  exit 0
else
  echo "❌ $ERR checks failed"
  exit 1
fi
```

入 git `infrastructure/security-precheck.sh`（或 `scripts/`）。`package.json` 加 script `"security:precheck"`.

**Acceptance：**
- `npm run security:precheck` 跑完 10 项全绿
- 任一项故意破坏（如 `.env` 加 fake git add → 检查 1 失败）触发 exit 1
- `ssh vps 'git ls-files infrastructure/security-precheck.sh'` 非空（framework v0.9.3 artifact in-git）

### F004 — production-bootstrap.md runbook

**实现：**

新建 `docs/dev/production-bootstrap.md`：

```markdown
# Production Bootstrap Runbook

> 触发场景：(a) 首次 prod deploy；(b) prod DB 重建；(c) 新 VM 迁移。
> 风险等级：HIGH（涉及 DB 写入 + 密码管理）

## 1. 前置条件

- [ ] VPS SSH key 就位
- [ ] `.env.production` 所有 secrets 就位（AIGCGATEWAY / RESEND / NEXTAUTH_SECRET / DATABASE_URL / DATABASE_ADMIN_URL）
- [ ] 密码管理器就绪（储存即将生成的 admin + marketer 密码）

## 2. 安全 deploy 流程

### Step 1: Deploy code
GitHub Actions "Deploy to Production" workflow_dispatch 触发；等待 deploy 完成。

### Step 2: Seed DB（首次）
```bash
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix

# 生成两个强密码并设为 env var（临时只在 shell session）
export SEED_ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d "/+=" | cut -c1-20)
export SEED_MARKETER_PASSWORD=$(openssl rand -base64 18 | tr -d "/+=" | cut -c1-20)

# 立即保存到本地密码管理器（下一步打印前就存）
echo "ADMIN: $SEED_ADMIN_PASSWORD"
echo "MARKETER: $SEED_MARKETER_PASSWORD"
# ← 复制这两个值到密码管理器，确认保存后继续

npm run db:seed
# seed 读 env var，不会打印 fallback 随机值

# unset 避免 env 残留
unset SEED_ADMIN_PASSWORD
unset SEED_MARKETER_PASSWORD

# 跑 KOL seed（BM1）
npm run seed:kol

# 跑 email template seed（BM2）
npm run seed:email-templates
```

### Step 3: 健康检查 + 登录验证
```bash
curl -sS https://kol.guangai.ai/api/health | jq
# Login with admin@kolmatrix.local + 新密码
```

### Step 4: 安全预检
```bash
npm run security:precheck  # 10 项全绿
```

## 3. 已有 prod 环境的密码轮换（应急）

若发现密码已泄露（如 seed.ts 硬编密码被公开）：

```bash
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix

NEW_PW=$(openssl rand -base64 18 | tr -d "/+=" | cut -c1-20)
NEW_HASH=$(node -e "const b=require('bcrypt');b.hash('$NEW_PW',12).then(h=>console.log(h))")

sudo -u postgres psql kolmatrix -c \
  "UPDATE \"user\" SET hashed_password='$NEW_HASH', updated_at=NOW() WHERE email='<target>';"

echo "NEW PASSWORD for <target>: $NEW_PW"
# 保存到密码管理器，立即用 NEW_PW 登录测试
```

（2026-04-24 实操记录：admin + marketer 两账户已按此流程轮换）

## 4. 后续监控

- 每周跑一次 `security:precheck`（或 cron 每日跑）
- event_log 查 `auth.login_failed` 异常激增信号
- 密码过期策略（Post-MVP 升）
```

**Acceptance：**
- 文档存在且内容完整
- 从 `README.md` 主文档新增链接 "Production bootstrap → docs/dev/production-bootstrap.md"
- `tls-staging-runbook.md` 末加交叉引用

## 6. 依赖关系

```
F001 (seed.ts env 化)
  │
  └── F004 (runbook 引用 F001 新 env var)

F002 (登录限流) ── 独立

F003 (precheck script) ── 独立（F001/F002 落地后 precheck 会更全面）

F004 (bootstrap runbook) ── 最后（引用 F001/F002/F003）
```

**执行顺序：** F001 → F002 + F003 并行 → F004

## 7. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| 限流 in-memory Map 在 PM2 cluster（未来多实例）失效 | 低 | MVP 单 fork instance；Post-MVP scale-out 时迁 Redis |
| Seed 随机密码 fallback 打印到 PM2 log | 中 | 生产必设 env var；`logs/pm2-*.log` 文件 `0640` 权限 |
| 登录限流误伤真用户 | 低 | 15 min 窗口 + 5 次允许比行业常见 |
| Bootstrap runbook 未被首次 deploy 读 | 中 | F004 强制写入 README + CLAUDE.md T0 必读索引 |

## 8. 验收方式（Evaluator）

### L1
- `npm run test:coverage` 新增覆盖率 ≥ 项目基线
- `npm run lint` + `npx tsc --noEmit` 绿

### L2（staging）
- Staging 跑 `npm run security:precheck` 10 项全绿
- Staging `/login` 5 次错密→6th 429 复现
- Staging seed re-run with env vars 正确写入

### L3 视觉
- 不涉及

## 9. 估时

| 环节 | 预估 |
|---|---|
| F001 seed env 化 + tests | 1h |
| F002 rate-limit + auth.ts hook + tests | 2h |
| F003 precheck script | 1h |
| F004 bootstrap runbook | 30min |
| **总计** | **~4.5h** |

## 10. 时机

**MVP 上线前必做**；不阻塞 BM2 building。建议 BM2 done 后（与 MVP-visual-fidelity hotfix 并行但独立，1 天内跑完）。

也可以插到 BI5-staging-polish micro-batch 同时做（两个 polish 批次合并为一个 `BIx-pre-launch-polish`），但 scope 太大不推荐。

## 11. 引用文档

- 2026-04-24 Planner 安全审计（本 session 对话）
- `.auto-memory/environment.md`（已 redact）
- `.auto-memory/role-context/evaluator.md`
- `framework/harness/deploy-patterns.md` §2 artifact in-git

---

**Spec 状态：** draft（2026-04-24 Planner 起草，时机 BM2 done 后或 MVP 上线前最晚机会）

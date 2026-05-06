# BL-043 deploy-staging.yml + .env.staging Bridge 闭合 — Spec

> **状态：** Planner 起草 @ 2026-05-06 20:15（用户决议「BL-044 done 后立即启动」）
> **作者：** Planner johnsong
> **触发：** BL-040 staging deploy run 25415574990 卡 health 503（DB 28P01 password authentication failed for kolmatrix_app）— Planner ops 5/6 15:55 SSH 短期修复完成，但长期治理（fail-fast + 文档化）入 BL-043 backlog
> **预估：** 2-3h Generator + 0.5h Reviewer
> **批次类型：** 普通批次（3 features 全 `executor:generator`）

---

## 1. 背景与目标

### 1.1 已落地范围（BL-024-F006/F007 retroactive）

实地核查后发现 BL-043 backlog 描述的设计 gap 已 80%+ 闭合：

| 改动 | commit | 实际状态 |
|------|--------|---------|
| `deploy-staging.sh` 用 sudo psql peer auth + ALTER ROLE（与 deploy-prod.sh 同模式）| 8be3115 | ✅ 已落地 |
| `deploy-staging.yml` `set -a; source .env.staging; set +a` export env 到 shell | b7bf1aa | ✅ 已落地 |
| `.env.staging` 含 KOLMATRIX_APP_PASSWORD（Planner ops 5/6 15:55 SSH 落地）| ops | ✅ 已落地（不入 git）|
| staging deploy run 25431413537（5/6 19:00 Kimi BL-044 触发）| — | ✅ healthy PASS |

### 1.2 实质剩余范围

3 项失败模式硬化 + 文档化：

1. **fail-fast on KOLMATRIX_APP_PASSWORD unset**：当前 deploy-staging.sh + deploy-prod.sh silent skip — 应改 fail-fast（exit 1 + clear error）防止配置漂移
2. **environment.md staging Postgres 段文档化**：当前一句话「角色同 prod」简陋，应明确 staging+prod 共用 role + 密码 sync 协议 + ALTER ROLE peer auth 模式
3. **smoke test**：触发 staging deploy run with main HEAD → 验证完整链路

### 1.3 Definition of Done

- 3 features 全 PASS by Reviewer L1+L2
- staging deploy run 触发（验证 fail-fast + env-bridge 链路完整）
- environment.md staging Postgres 段含完整文档（密码同步协议 + 修改密码 ops 步骤）
- 不阻塞 5/13 上线对外（prod 不受影响）

---

## 2. 功能清单（3 features 全 generator）

### F001 · deploy-staging.sh + deploy-prod.sh fail-fast on KOLMATRIX_APP_PASSWORD unset

**Executor:** generator
**Priority:** high
**预估工时:** 1h

**改动：**

`infrastructure/deploy-staging.sh` line 75-83 + `scripts/deploy-prod.sh` line 79-87：

```bash
# 当前（silent skip）：
if [ -n "${KOLMATRIX_APP_PASSWORD:-}" ]; then
  echo "   • rotating kolmatrix_app password (idempotent)"
  sudo -u postgres psql ... ALTER ROLE ...;
else
  echo "   ⚠️  KOLMATRIX_APP_PASSWORD unset — skipping app-role password rotation"
fi

# 改为（fail-fast）：
if [ -z "${KOLMATRIX_APP_PASSWORD:-}" ]; then
  echo "❌ FATAL: KOLMATRIX_APP_PASSWORD unset in .env.{staging,production}" >&2
  echo "   This var must be set so the deploy script can ALTER ROLE on the kolmatrix_app role." >&2
  echo "   Add KOLMATRIX_APP_PASSWORD=<random_hex> to /opt/kolmatrix{,-staging}/.env.{production,staging}" >&2
  echo "   then redeploy. See .auto-memory/environment.md §Postgres for full ops procedure." >&2
  exit 1
fi
echo "   • rotating kolmatrix_app password (idempotent)"
sudo -u postgres psql ... ALTER ROLE ...;
```

**为何 fail-fast 安全：**
- prod + staging 当前都已配置 KOLMATRIX_APP_PASSWORD（Planner ops 已落地）→ fail-fast 不会破坏当前部署
- 首次 bootstrap 场景：用户必须先配 .env，符合 ops 流程预期
- 防止未来配置漂移（如有人误清 .env 重启）

**Acceptance：**
- [ ] `infrastructure/deploy-staging.sh` 改 fail-fast 模式（exit 1 + multi-line error）
- [ ] `scripts/deploy-prod.sh` 同步 fail-fast
- [ ] 错误信息含修复指引（指向 environment.md §Postgres）
- [ ] `npm run lint + tsc + test` 全绿（无相关测试，但守门 sanity）

---

### F002 · environment.md staging Postgres 段文档化

**Executor:** generator
**Priority:** high
**预估工时:** 30 min

**改动：**

`.auto-memory/environment.md` 当前 line 77（staging Postgres 段一句话）扩展为完整 ops 文档：

```markdown
| Postgres | 共用 prod Postgres 实例；DB 名 `kolmatrix_staging`，**角色同 prod**（kolmatrix superuser + kolmatrix_app app role）。**密码同步协议（BL-043 lock）：** kolmatrix_app role 在 prod + staging 共享同一 PG role（同实例），密码必须在 `.env.production` 和 `.env.staging` 中保持完全一致；任一文件密码与 PG 实际不一致都会触发 28P01 password authentication failed。**修改 kolmatrix_app 密码 ops 步骤：** (1) 生成新随机密码 `openssl rand -hex 32`；(2) 同时改 `.env.production` 和 `.env.staging` 中 `KOLMATRIX_APP_PASSWORD=<新值>` + `DATABASE_URL` 中 `kolmatrix_app:<新值>@`；(3) 触发 prod redeploy（deploy-prod.sh ALTER ROLE 落地新密码到 PG）；(4) 触发 staging redeploy（deploy-staging.sh 验证新密码工作）；(5) BL-043 F001 fail-fast 守门确保 .env 缺失立即 fail。**ALTER ROLE 模式：** sudo psql + unix socket peer auth（v0.9.13 §5.1 sediment + BL-024-F007 retroactive；非 PGPASSWORD over TCP）|
```

新增段后追加一段子表：

```markdown
### Postgres kolmatrix_app role 密码 sync 协议（BL-043 lock 2026-05-06）

| 文件 | 字段 | 必须一致 |
|------|------|---------|
| /opt/kolmatrix/.env.production | KOLMATRIX_APP_PASSWORD | ✓ |
| /opt/kolmatrix/.env.production | DATABASE_URL（kolmatrix_app:PWD@...）| ✓ |
| /opt/kolmatrix-staging/.env.staging | KOLMATRIX_APP_PASSWORD | ✓ |
| /opt/kolmatrix-staging/.env.staging | DATABASE_URL（kolmatrix_app:PWD@...）| ✓ |
| Postgres kolmatrix_app role | password | ✓ |

修改任一字段必须同步全部 5 处。deploy-{prod,staging}.sh ALTER ROLE 自动落地 (3) → (5)；(1)(2)(4) 由用户 ops 手工保持一致。
```

**Acceptance：**
- [ ] `.auto-memory/environment.md` line 77 staging Postgres 段扩展（含密码同步协议 + 修改 ops 步骤 + ALTER ROLE 模式）
- [ ] 新增 Postgres kolmatrix_app role 密码 sync 协议子表（5 处必须一致）

---

### F003 · staging deploy run smoke test + 验证 fail-fast

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min - 1h

**改动：**

1. 触发 staging deploy run with main HEAD（含 F001 改动）
2. 验证：
   - F001 fail-fast 路径：临时 SSH 把 .env.staging 中 KOLMATRIX_APP_PASSWORD 注释掉 → 触发 deploy → 应快速 fail（exit 1）+ multi-line error；恢复 .env.staging 后再次 deploy 应 PASS
   - 标准路径：deploy-staging.sh 完整跑过（git pull → npm ci → prisma migrate → ALTER ROLE → next build → pm2 restart → health 200）
3. 测试报告：`docs/test-reports/BL-043-deploy-bridge-smoke-2026-05-XX.md`（Reviewer 写）

**Acceptance：**
- [ ] staging deploy run with main HEAD PASS（health 200 + DB ok + git_sha 对齐）
- [ ] fail-fast 路径手工验证（注释 .env 中 KOLMATRIX_APP_PASSWORD → 应 exit 1）
- [ ] 测试报告记录 2 路径结果（standard + fail-fast）

---

## 3. 变更文件清单

```
infrastructure/deploy-staging.sh        F001 EDIT (fail-fast 替代 silent skip)
scripts/deploy-prod.sh                  F001 EDIT (同步 fail-fast)
.auto-memory/environment.md             F002 EDIT (staging Postgres 段扩展 + 密码 sync 协议)
docs/test-reports/BL-043-deploy-bridge-smoke-2026-05-XX.md   F003 NEW (Reviewer 写)
```

---

## 4. 关键设计决策

### D1 · fail-fast 而非 silent skip
- silent skip 让配置漂移问题（如 BL-040 staging deploy 503）变成隐藏故障 — fail-fast 让问题立即可见
- 当前 prod + staging 都已配，fail-fast 不会破坏部署
- 首次 bootstrap 场景：用户必须先配 .env（符合 ops 流程）

### D2 · prod + staging 同步改 fail-fast
- prod 也可能踩同坑（如未来某次 ops 误清 .env）
- 一致性原则：deploy-{prod,staging}.sh 行为对齐

### D3 · 密码 sync 协议 5 处
- prod .env (KOLMATRIX_APP_PASSWORD + DATABASE_URL pwd) + staging .env (同 2 处) + PG role pwd = 5 处必须一致
- 修改任一密码必须同步全部 → 文档化为 ops checklist

### D4 · 不改 deploy-{prod,staging}.yml workflow
- 当前 workflow `set -a; source .env; set +a` 链路完整，无需改动
- 改动局限 sh 脚本 + environment.md（最小改动面）

---

## 5. v0.9.x 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.7 §1.6 PM2 env_file 不可靠 | 不涉及 PM2 .env 重读（BL-043 仅改 sh fail-fast + 文档）|
| v0.9.13 §5.1 spec deploy-script vs yml | 不涉及 yml 改动（已 BL-024-F006 落地）|
| v0.9.13 §4.7 ALTER ROLE peer auth | F002 文档化此模式作 ops checklist |
| v0.9.14 §1.7 PM2 .env reload 不可靠 | 不涉及 .env 改动（仅文档）|
| v0.9.14 §planner.md 铁律 1 完整 pattern grep | Planner 起 spec 前已 grep deploy-staging.{yml,sh} + scripts/deploy-prod.sh + environment.md → 发现 BL-024-F006/F007 已闭合 80%+，本批次缩窄到 fail-fast + 文档化 |

---

## 6. 实装顺序（Generator 接手参考）

```
1. F001 infrastructure/deploy-staging.sh：silent skip → fail-fast（exit 1 + multi-line error）
2. F001 scripts/deploy-prod.sh：同步 fail-fast
3. F002 .auto-memory/environment.md line 77：扩展 staging Postgres 段 + 密码 sync 协议子表
4. lint + tsc + test 守门（无新测试）
5. push commit
6. F003 staging deploy smoke test（用户授权后由 Generator/Reviewer 实地触发）
7. 切 verifying（Reviewer 跑 L1+L2，含 fail-fast 手工验证）
```

---

## 7. Definition of Done

### 7.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | 触发 staging deploy run（验证 F001 fail-fast 路径 + 标准路径）| F001+F002 push 后 |
| 2 | 后续修改 kolmatrix_app 密码时遵循 environment.md 5 处同步协议 | ops 时 |

### 7.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（无新测试加，无 regression）+ CI 全绿
- **L2：** staging deploy run smoke test 完整 PASS（standard path + fail-fast path 验证）

### 7.3 Soft-watch（不阻塞 done）

- prod redeploy 触发后 fail-fast 同模式（用户下次 prod redeploy 时验证）
- 跨批次密码 sync ops 实战（如未来某次轮换）

---

> **Spec lock：** Planner johnsong @ 2026-05-06 20:15。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段发现良性偏差按 §11 building 中段变种处理。

# BI2 部署自动化 · 测试计划（给 Reviewer）

> **批次**：`BI2-deployment-automation`
> **状态**：Generator 交付完成（progress.json status=`verifying`），待 Reviewer 执行本计划
> **范围**：8 features / 5 shell 脚本 / 2 workflow / 1 runbook / 1 `/api/health` 路由
> **对照 spec**：`docs/specs/BI2-deployment-automation-spec.md` §7
> **相关 Planner 裁决记录**：F003 acceptance（Free 私有 repo 无 required reviewer + Env scope + Secrets 已就位）— 见 features.json F003 字段

---

## 1. 目标与边界

本计划把 spec §7 的 L1/L2/L3 层级**具体化为可执行用例**，覆盖：

- **L1**（本地自动化）：Generator 在 dev 机上已全部本地验证过，Reviewer 重跑确认可复现
- **L2**（真 VPS 部署）：**必须** Reviewer 在 prod 测试时段触发 `deploy-prod.yml` 走完整链路；含自动回滚模拟
- **L3**（runbook 可重现）：按 `docs/dev/deployment-runbook.md` 在 SSH 进 VPS 的情况下跑 ≥3 种应急场景

**签收门槛（Signoff Gate）**：所有 P0 用例 PASS；P1 ≥ 80% PASS；零 FAIL（PARTIAL 需 Planner 裁决后补 fixing 轮次）。

---

## 2. 入口条件（全部满足才启动）

- `progress.json.status == "verifying"` 且 `completed_features == 8`
- 本机已装 `shellcheck`、`jq`（apt）、`actionlint`（`~/.local/bin`，Reviewer 可 `curl -sSfL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash | bash -s latest ~/.local/bin`）
- dev 环境可跑：`docker compose up -d` + `npm run dev`（localhost:3000 或 AGENTS 规范端口 3099）
- VPS 前置全部就位（Planner 2026-04-20 已确认）：
  - `/opt/kolmatrix`、`/opt/kolmatrix-backups` 目录
  - `jq` / `pg_dump` / `pm2-6.0.14` / `node-22` 已装
  - `.env.production` 已配（root:deploy 0640）
  - deploy SSH key（ed25519）已 authorize
  - GitHub `production` environment + 3 Secrets（`PROD_HOST` / `PROD_USER` / `PROD_SSH_KEY`）
- 测试账号：勿动 `marketer@kolmatrix.local` / `admin@kolmatrix.local` 的生产数据

---

## 3. 测试用例

### L1 — 本地自动化（目标：≤ 30 分钟全跑完）

#### TC-L1-001（P0）shellcheck 所有脚本 clean

```bash
shellcheck scripts/*.sh
echo "exit=$?"
```

**预期**：exit 0，无 warning / error。
**证据**：命令输出（空输出 = 全绿）。

#### TC-L1-002（P0）actionlint 两个 workflow clean

```bash
~/.local/bin/actionlint .github/workflows/ci.yml .github/workflows/deploy-prod.yml
echo "exit=$?"
```

**预期**：exit 0。
**证据**：命令输出。

#### TC-L1-003（P0）validate-rollback-sql.sh 正反用例

**正向**：

```bash
./scripts/validate-rollback-sql.sh
```

预期 exit 0，打印 `✅ 4 migration(s) all include -- ROLLBACK: recipe`。

**反向（tamper test）**：

```bash
cp prisma/migrations/20260420000000_rls_nullif_empty_tenant/migration.sql /tmp/good.sql
grep -v "^-- ROLLBACK:" /tmp/good.sql \
  > prisma/migrations/20260420000000_rls_nullif_empty_tenant/migration.sql
./scripts/validate-rollback-sql.sh ; echo "tamper exit=$?"
# 期望：exit 1 + "❌ Missing '-- ROLLBACK:'"
cp /tmp/good.sql prisma/migrations/20260420000000_rls_nullif_empty_tenant/migration.sql
rm /tmp/good.sql
./scripts/validate-rollback-sql.sh ; echo "restored exit=$?"
# 期望：exit 0
```

#### TC-L1-004（P0）healthcheck.sh 4 场景

| 场景             | 命令                                                                                                 | 预期                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| dev UP + healthy | `HEALTHCHECK_RETRIES=5 HEALTHCHECK_WAIT=1 ./scripts/healthcheck.sh http://localhost:3000/api/health` | exit 0                                                                              |
| dev DOWN         | (先 `fuser -k 3000/tcp`) 同上命令                                                                    | exit 1，HTTP 000 打印 N 次                                                          |
| 404 endpoint     | `./scripts/healthcheck.sh http://localhost:3000/api/does-not-exist`                                  | exit 1，HTTP 404 打印 N 次                                                          |
| dev UP + PG 停   | `docker stop kolmatrix-postgres`; 同 dev UP 命令                                                     | exit 1，HTTP 503；body 显示 `checks.database.status=error` + `timeout after 1500ms` |

**证据**：4 次命令输出 + exit code。

#### TC-L1-005（P0）backup-db.sh 模拟

VPS 默认 `pg_dump -U postgres kolmatrix_prod`，本地 Docker PG 用户名/库名不同，env 覆盖：

```bash
docker exec kolmatrix-postgres pg_dump -U kolmatrix kolmatrix | gzip > /tmp/db-smoke.sql.gz
gzip -dc /tmp/db-smoke.sql.gz | head -5
du -h /tmp/db-smoke.sql.gz
rm /tmp/db-smoke.sql.gz
```

**预期**：head 显示 `-- PostgreSQL database dump`；size 合理（dev seed ~24K）。

> Reviewer 无需本地跑 backup-db.sh 本身（env 覆盖路径过多）；上面的等价 pipeline 就覆盖了脚本唯一有风险的环节。

#### TC-L1-006（P0）GET /api/health 单元测试 + 本地 curl

```bash
npm run test:unit -- src/app/api/health
# 预期：4/4 PASS

# dev up 时
curl -s -w "\nHTTP %{http_code} / %{time_total}s\n" http://localhost:3000/api/health
# 预期：HTTP 200，time < 0.2s，JSON 含 status="healthy"

# dev up 但 PG 停
docker stop kolmatrix-postgres
curl -s -w "\nHTTP %{http_code} / %{time_total}s\n" http://localhost:3000/api/health
# 预期：HTTP 503，time < 2s（F001 加了 1500ms Promise.race 超时）
docker start kolmatrix-postgres
```

#### TC-L1-007（P0）CI 上 8/8 jobs green

```bash
gh run list --limit 1 --branch main --json conclusion,jobs -q '.[0]'
```

**预期**：当前 HEAD commit 的 CI conclusion=success；8 个 jobs（install / lint / typecheck / build / validate-rollback-sql / unit-tests / integration-tests / e2e-tests）全绿。

---

### L2 — 真 VPS 部署（**必须**在 GitHub UI + SSH 进 VPS 完成）

> 时段选择：建议在**低流量时段**执行，预留 30-60 分钟应对异常。所有用例失败时第一动作是查 `docs/dev/deployment-runbook.md §Health check debug`。

#### TC-L2-001（P0）触发 deploy-prod.yml 成功

**步骤**：

1. GitHub UI → Actions → "Deploy to Production" → Run workflow
2. `ref`: `main`，`skip_backup`: `false`
3. 观察 workflow 8 步全绿（checkout → validate-rollback-sql → SSH → deploy-prod.sh 内部 8 步）
4. 总耗时 ≤ 10 分钟

**预期**：

- workflow conclusion=success
- 最后一步 `healthcheck.sh` 打印 `✅ Healthy on attempt X/5`

**证据**：workflow 运行 URL + SSH 进 VPS 后 `pm2 describe kolmatrix | grep uptime`（应 < 2 分钟）。

#### TC-L2-002（P0）备份文件 + manifest 记录

SSH 进 VPS：

```bash
ls -lh /opt/kolmatrix-backups/ | head
tail -5 /opt/kolmatrix-backups/manifest.log
gzip -dc /opt/kolmatrix-backups/db-<最新 timestamp>.sql.gz | head -5
```

**预期**：

- 看到本次 deploy 的 `db-YYYYMMDD-HHMMSS.sql.gz` 新文件
- manifest 多一行 `<timestamp> <git SHA == github.sha> <filename>`
- gzip -dc 输出真 PostgreSQL dump

#### TC-L2-003（P0）`/api/health` 反射新 SHA

```bash
curl -s https://kol.guangai.ai/api/health | jq .
```

**预期**：

- HTTP 200
- `.status == "healthy"`
- `.git_sha == <刚 deploy 的 github.sha 的 7-40 字符 prefix>`（证明 PM2 reload 已切到新代码）
- `.checks.database.status == "ok"`

#### TC-L2-004（P1）零丢包 reload

按 `docs/dev/deployment-runbook.md §Verifying zero-downtime reload` 跑 curl loop：

- Terminal A：`while true; do curl -s -o /dev/null -w "%{http_code} " https://kol.guangai.ai/api/health; sleep 1; done`
- Terminal B：`pm2 reload kolmatrix --update-env`

**预期**：Terminal A 不出现 502 / 503 / connection reset（偶发 200 之外的码即 fail）。

#### TC-L2-005（P0）自动回滚链路（**最关键的端到端证明**）

**步骤**：

1. 本地新建 branch `fixing-test/break-health`，改 `src/app/api/health/route.ts`，故意让 DB 检查永远 error（例：抛 error 替代 query）
2. push 到 main（或在 workflow 直接填该 ref）
3. 触发 deploy-prod.yml
4. 观察：
   - prisma migrate deploy 通过（不影响）
   - build 通过
   - pm2 reload 通过
   - `healthcheck.sh` 5 次重试全败
   - `scripts/rollback.sh` 自动启动，回滚到触发前 SHA
   - 回滚后 healthcheck.sh 通过
   - workflow conclusion=failure（deploy 本身失败，但服务恢复）
5. `curl https://kol.guangai.ai/api/health` 返回 200 且 `.git_sha` = **回滚前的 SHA**
6. SSH 进 VPS `cat /tmp/prev-sha` 能看到回滚目标

**清理**：删除 `fixing-test/break-health` 分支；main 保持回滚后的 SHA（或再触发一次正常 deploy 覆盖）。

**证据**：workflow URL + 回滚前后的 `git_sha` 对比。

#### TC-L2-006（P1）workflow 受 `production` environment 保护

**预期**：Actions UI 看到 "Deploy to Production" 关联 environment production，deployment history 有记录（尽管 Free 私有 repo 无 required reviewer，Env scope 的 secrets 隔离 + audit 功能仍生效）。

**证据**：GitHub → Settings → Environments → production 下有 Deployment history 条目。

---

### L3 — Runbook 可重现（按 `docs/dev/deployment-runbook.md` 跑 ≥3 种应急）

#### TC-L3-001（P0）SSH 应急入口

**步骤**：按 runbook §SSH emergency access 用 deploy 专用 key 登陆 VPS。
**预期**：能成功 `ssh ... deploy@kol.guangai.ai` 并 `cd /opt/kolmatrix`。
**证据**：`whoami` + `pwd` 输出。

#### TC-L3-002（P1）手动部署 fallback

**步骤**：按 runbook §Manual deploy fallback 的 8 步，手动跑一次部署（跟刚 automated deploy 同 ref 也可，只为验证命令可行）。
**预期**：每步命令跟 runbook 对得上；最后 `./scripts/healthcheck.sh` exit 0。
**证据**：8 步的 shell 输出（截图或贴 log）。

#### TC-L3-003（P1）pg_restore 恢复演练

**步骤**：按 runbook §DB restore 把任意一个历史 `db-*.sql.gz` 恢复到一个**临时 DB**（**禁止恢复到 `kolmatrix_prod`**）：

```bash
sudo -u postgres createdb kolmatrix_restore_smoke
gzip -dc /opt/kolmatrix-backups/db-<timestamp>.sql.gz \
  | psql -U postgres kolmatrix_restore_smoke
psql -U postgres kolmatrix_restore_smoke -c "SELECT count(*) FROM tenant;"
sudo -u postgres dropdb kolmatrix_restore_smoke
```

**预期**：restore 成功，tenant 表有行。
**证据**：count 输出。

#### TC-L3-004（P2）常见错误至少 3 种演练

从 runbook §Common errors 6 条里**选 3 条**演练应急处理：

- **推荐选**：1（OOM / restart 循环）或 5（PM2 未恢复） — 这两个最常遇到
- 或：2（端口冲突）、6（healthcheck.sh vs curl 漂移）

演练方式：**故意触发 → 按 runbook 定位 → 确认恢复**。

**预期**：每条能按 runbook 步骤定位并恢复；**发现 runbook 步骤不够清晰就回写 feedback**（runbook 迭代是 L3 价值之一）。

---

## 4. 签收输出物

- **执行记录**：`docs/test-reports/BI2-deployment-automation-execution-YYYY-MM-DD.md`
  - 每条 TC 的 PASS / FAIL / PARTIAL + 证据（命令输出 / 截图 / workflow URL）
  - L2/L3 的实际耗时 + 任何偏差
- **签收报告**（全绿时）：`docs/test-reports/BI2-deployment-automation-signoff-YYYY-MM-DD.md`
- **截图 / trace 归档**：`docs/test-reports/artifacts/BI2/`
- **progress.json 推进**：`reverifying → done`（Reviewer 写）

---

## 5. 风险与应对

| 风险                                         | 应对                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| L2 真实部署失败导致 prod 宕机                | 自动回滚应工作（TC-L2-005 已验证路径）；若 rollback.sh 也失败（exit 2）→ runbook §Manual rollback |
| pg_restore 误操作覆盖 prod DB                | TC-L3-003 **强制**用 `kolmatrix_restore_smoke` 临时 DB；禁止 `psql ... kolmatrix_prod` 写入       |
| WSL-local baseline vs CI / VPS chromium 漂移 | 跟 BI1 一样，视觉回归本批次不涉及（L1 覆盖 workflow + 脚本，不涉及截图）                          |
| Env scope secrets 没传到 SSH                 | TC-L2-001 第一步即验证（GIT_SHA + SKIP_BACKUP 进 deploy-prod.sh）                                 |
| deploy SSH key 失效 / authorize 漂移         | TC-L3-001 优先跑；失败直接停 L2，找 Planner 检查 authorize                                        |

---

## 6. 跨文档引用索引

- Spec：`docs/specs/BI2-deployment-automation-spec.md`（§7 Generator 原 L1/L2/L3）
- Runbook：`docs/dev/deployment-runbook.md`（L3 场景的操作手册）
- BI1 test plan（参考格式）：`docs/test-cases/B0-foundation-test-plan.md`
- `progress.json` session_notes：johnsong 字段记录本批次所有本地验证细节

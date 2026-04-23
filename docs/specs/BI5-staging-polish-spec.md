---
name: BI5-staging-polish
description: Staging DevX 收口微批次 — 修 BL-001/BL-002 + 交付 deploy-staging.sh（基建批次）
status: draft
created_by: johnsong (Planner)
created_at: 2026-04-24
---

# BI5 — Staging DevX Polish

## 1. 背景与目标

BM1 staging deploy 实操过程（2026-04-23 Planner 两次手动部署）暴露 3 个 DX gap：

- **BL-001**：`scripts/seed-kol-from-enriched.ts` 缺 `import 'dotenv/config';`，`npm run seed:kol` 独立跑必报 `DATABASE_ADMIN_URL must be set`
- **BL-002**：`staging /api/health` 返回 `git_sha: "unknown"`（prod 正常）—— 初判 build-time env 注入可修，实测 `GIT_SHA=xxx npm run build` 仍无效，根因更深
- **BL-004**：staging deploy 仍全手动 SSH + 8-10 条分步指令；新 agent 上手需读 runbook §5 + §6 共 10-20 分钟；framework v0.9.3 合规要求脚本入 git

本批次一次收口：修根因 + 入一个可执行的 `deploy-staging.sh`，让后续 Generator/Evaluator/用户 deploy staging 变"一条命令"。

## 2. 范围

### In Scope

1. **F001** — 修 BL-002：定位 `/api/health` 的 `git_sha` 读取机制，让 staging 返回真 SHA（非 `unknown`）
2. **F002** — 修 BL-001：`scripts/seed-kol-from-enriched.ts` 加 `import 'dotenv/config';`
3. **F003** — 交付 `infrastructure/deploy-staging.sh`（入 git），整合修复，端到端 2 分钟部署
4. **F004** — 文档更新：`docs/dev/tls-staging-runbook.md §5` 引用新脚本；相关 backlog 条目 close

### Out of Scope

- GitHub Actions workflow（方案 B，已在 BL-004 决策中延后到 MVP 后团队扩员）
- Prod deploy 重写（prod 已有 `deploy-prod.yml`，不动）
- DB 备份 / 迁移兼容性检查增强（另起批次）
- 独立 dev/prod aigcgateway key 拆分（观察期）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| BL-002 修复定位优先级 | Generator 开工 F001 前先 `git log --all -p -- src/app/api/health/route.ts` + 比对 `deploy-prod.yml`，找 git_sha 来源后再定方案 | 盲目改会走弯路（Planner 已走一遍 build-time env 注入失败）|
| `deploy-staging.sh` 放置位置 | `infrastructure/deploy-staging.sh`（与 `infrastructure/nginx/*` 同目录）| 集中 infra artifact；git ls-files 可一次查全部 |
| 脚本默认行为 | **非破坏**：不 drop DB / 不清 seed / 不 force push；仅 pull + 可选 ci + build + 可选 migrate + 可选 seed + restart + health | DB reset 走 runbook §6 独立操作，保持 `deploy-staging.sh` 幂等安全 |
| 增量智能探测 | 脚本 detect package-lock 变更决定 npm ci / detect migration/schema 变更决定 migrate / detect seed 脚本变更决定 seed | 避免全量 3 分钟 → 增量 1 分钟 |
| GIT_SHA 注入方式 | 待 F001 结果决定（可能是 build-time env / 运行时 env / build 前生成文件）| 不预先锁死 |
| 失败处理 | `set -euo pipefail` + trap 打印 `✗ FAILED at Step N` 后 exit 非零 | CI-friendly；可被其他脚本 wrap |
| 输出格式 | 分段标题 + 时间戳 + 关键指标（HEAD SHA / DB count / health body）| 一眼看状态，不需再 curl 验证 |
| 脚本可调参数 | MVP 无 flag；若未来需要加 `--fresh-db` / `--skip-seed`，那时再加 | KISS；MVP 用户 10-16 次 deploy 不需要 flag |

## 4. 功能列表（4 项，全 executor:generator）

### F001 — 修 BL-002：/api/health 返回真 git_sha

**实现：**

1. **先定位**（不动代码）：
   ```bash
   git log --all -p -- src/app/api/health/route.ts | head -200
   cat .github/workflows/deploy-prod.yml | grep -A3 -i "git\|sha"
   grep -rn "GIT_SHA\|git_sha" src/ next.config.* 2>/dev/null
   ```
   输出定位到具体来源（3 种可能之一：build-time env / 运行时 env / build 生成文件）。

2. **根据定位结果对症修复**，三种可能的修复样板：
   - 若 handler 读 `process.env.GIT_SHA`（运行时）→ `deploy-staging.sh` 必须在 `pm2 restart` 前 export 该变量，或写入 `.env.staging` 注释区
   - 若 handler 读 build-time 注入的常量（`next.config.ts` 的 `env.GIT_SHA`）→ build 前 `export GIT_SHA=$(git rev-parse HEAD)` 必须生效（实测无效则 handler 读的是别的）
   - 若 handler 读某个 `.git-sha` 文件 → build 前 `git rev-parse HEAD > .git-sha`

3. **验证**：staging restart 后 `curl /api/health | jq .git_sha` 必须返回非 `unknown` 的真 SHA。prod 已工作不动。

**Acceptance：**
- `curl https://staging.kol.guangai.ai/api/health | jq .git_sha` 返回 7 字符短 SHA 或 40 字符全 SHA（非 "unknown"）
- 同 curl prod `kol.guangai.ai/api/health` 不退化（保持原 `4b05cb6...` 或新 deploy 的 sha）
- `tests/integration/health-endpoint.test.ts` 加 case：检查 git_sha 格式为 `/^[a-f0-9]{7,40}$/`（不再允许 'unknown'）

### F002 — 修 BL-001：seed:kol 脚本加 dotenv import

**实现：**

`scripts/seed-kol-from-enriched.ts` 文件第一行之后加：

```typescript
import 'dotenv/config';
```

（保持与 `prisma.config.ts` 的 dotenv 加载风格一致）。

可选（更稳）：同步检查 `scripts/` 目录下其他独立可执行脚本是否有相同 gap，统一加：

```bash
grep -L "dotenv" scripts/*.ts
# 对列出的每个脚本评估是否需要加 import
```

**Acceptance：**
- 在 VPS 上 `cd /opt/kolmatrix-staging && npm run seed:kol`（不 `source .env`）能成功跑完，返回 `[seed:kol] done { total: 2524, ... }`
- `tests/integration/seed-kol-env.test.ts` 用 subprocess spawn 跑 `npm run seed:kol`，env 仅含 PATH + HOME，验证不再抛 `DATABASE_ADMIN_URL must be set`（若 DATABASE_URL 同样缺失才该抛）
- `scripts/` 目录下其他同类独立脚本（如 `seed-email-templates.ts`，BM2 F002 未来会产生）也加 dotenv/config（预防 BM2 同样踩）

### F003 — 交付 infrastructure/deploy-staging.sh

**实现：**

新建 `infrastructure/deploy-staging.sh`（入 git），目标端到端 2 分钟完成部署 + 含验证。

**骨架：**

```bash
#!/bin/bash
# Deploy current main HEAD to staging. Non-destructive: no DB drop / no seed wipe.
# Use docs/dev/tls-staging-runbook.md §6 for DB reset.
set -euo pipefail

APP_DIR="/opt/kolmatrix-staging"
PM2_NAME="kolmatrix-staging"
HEALTH_URL="https://staging.kol.guangai.ai/api/health"
PREV_SHA=""
NEW_SHA=""

log_step() { echo ""; echo "==> [$(date +%H:%M:%S)] $*"; }
log_err()  { echo "✗ FAILED at $1" >&2; }
trap 'log_err "${STEP:-unknown step}"' ERR

cd "$APP_DIR"

STEP="Step 0/8 — baseline"
log_step "$STEP"
PREV_SHA=$(git rev-parse --short HEAD)
echo "  PREV_SHA=$PREV_SHA"

STEP="Step 1/8 — git pull"
log_step "$STEP"
git pull --ff-only origin main 2>&1 | tail -3
NEW_SHA=$(git rev-parse --short HEAD)
echo "  NEW_SHA=$NEW_SHA ($(git rev-list --count $PREV_SHA..$NEW_SHA) commits ahead)"

STEP="Step 2/8 — npm ci（条件触发）"
log_step "$STEP"
if ! git diff --quiet "$PREV_SHA" HEAD -- package-lock.json; then
  echo "  package-lock 变了，跑 npm ci"
  npm ci 2>&1 | tail -3
else
  echo "  package-lock 未变，跳过"
fi

STEP="Step 3/8 — npm run build (GIT_SHA=$NEW_SHA)"
log_step "$STEP"
# 注意：GIT_SHA 实际注入方式由 F001 定位后最终确认（此处占位，F001 修完后 Generator 对齐）
GIT_SHA="$NEW_SHA" npm run build 2>&1 | tail -5

STEP="Step 4/8 — prisma migrate deploy（条件触发）"
log_step "$STEP"
if ! git diff --quiet "$PREV_SHA" HEAD -- prisma/migrations/ prisma/schema.prisma; then
  echo "  schema/migration 变了，跑 migrate deploy"
  npx prisma migrate deploy 2>&1 | tail -5
else
  echo "  schema 未变，跳过"
fi

STEP="Step 5/8 — seeds（条件触发）"
log_step "$STEP"
if ! git diff --quiet "$PREV_SHA" HEAD -- scripts/seed-kol-from-enriched.ts prisma/seed.ts scripts/seed-email-templates.ts; then
  echo "  seed 脚本变了，re-seed（F002 修后无需 source .env）"
  npm run db:seed 2>&1 | tail -3
  npm run seed:kol 2>&1 | tail -3
  [ -f scripts/seed-email-templates.ts ] && npm run seed:email-templates 2>&1 | tail -3 || true
else
  echo "  seed 脚本未变，跳过（DB 数据保留）"
fi

STEP="Step 6/8 — pm2 restart"
log_step "$STEP"
pm2 restart "$PM2_NAME" --update-env 2>&1 | tail -3

STEP="Step 7/8 — wait + health check"
log_step "$STEP"
sleep 3
HEALTH=$(curl -sS "$HEALTH_URL")
echo "$HEALTH" | python3 -m json.tool

STEP="Step 8/8 — git_sha 核对"
log_step "$STEP"
GIT_SHA_SEEN=$(echo "$HEALTH" | python3 -c "import json,sys; print(json.load(sys.stdin)['git_sha'])")
if [[ "$GIT_SHA_SEEN" == "unknown" ]]; then
  echo "  ⚠️  health 仍返回 unknown（F001 修复需确认生效）"
  exit 2
elif [[ "$GIT_SHA_SEEN" != "$NEW_SHA"* ]]; then
  echo "  ⚠️  git_sha 返回 '$GIT_SHA_SEEN' 与期望 '$NEW_SHA...' 不匹配"
  exit 3
else
  echo "  ✅ git_sha=$GIT_SHA_SEEN 匹配"
fi

echo ""
echo "✓ Deploy complete $(date +%H:%M:%S): $PREV_SHA → $NEW_SHA"
echo "→ $HEALTH_URL"
```

**Acceptance：**
- `ssh vps 'bash /opt/kolmatrix-staging/infrastructure/deploy-staging.sh'` 端到端成功（exit 0）
- 失败场景（故意断网 / 跑前改坏 package-lock）脚本 exit 非 0 并打印 `✗ FAILED at Step N`
- 无 schema 变更场景脚本在 ~1 分钟内完成（增量 detect 工作）
- 有 schema 变更场景脚本在 ~2 分钟内完成（全量跑）
- `tests/integration/deploy-staging-script.test.ts` 可选（mock pm2/curl 验脚本骨架；如 BM2 Generator 觉得测脚本 overkill 可 skip 仅 manual 验）

### F004 — 文档更新 + backlog close

**实现：**

1. `docs/dev/tls-staging-runbook.md §5` "Deploy new code to staging" 段落前加：
   ```markdown
   > **推荐路径（2026-04-24 BI5 起）**：`bash /opt/kolmatrix-staging/infrastructure/deploy-staging.sh` 一条命令跑完以下所有步骤。手动步骤仅保留用于调试或自定义场景。
   ```
2. `backlog.json` 把 BL-001 / BL-002 / BL-004 status 置 `completed`，`completed_at` 填值（或从 json 移除，归档到 `backlog-archive.json`——二选一，建议后者保持 backlog 精简）。
3. `.auto-memory/environment.md` § "VPS env 文件当前 secrets 状态" 一节末加一行引用：Deploy staging 请用 `infrastructure/deploy-staging.sh`。

**Acceptance：**
- `git ls-files infrastructure/deploy-staging.sh` 非空（framework v0.9.3 合规）
- `grep -n "deploy-staging.sh" docs/dev/tls-staging-runbook.md` 非空
- `backlog.json` 不再含 BL-001 / BL-002 / BL-004（或标 completed）
- 再跑 `bash deploy-staging.sh` 幂等（第 2 次跑时几乎所有 step 跳过，仅 pm2 restart + health check，约 8 秒）

## 5. 依赖关系

```
F001 (git_sha root cause + fix)
  │
  └── F003 (script uses the fix)

F002 (dotenv fix)
  │
  └── F003 (script assumes seed works)

F003 (script)
  │
  └── F004 (runbook + backlog)
```

**执行顺序：** F001 + F002 并行 → F003 → F004

F001 和 F002 完全解耦，Generator 可任意顺序做；F003 等两者合入再开工（避免 script 基于错误假设写）。

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| F001 定位 git_sha 源头困难 | 中 | Generator 若 2h 内定位不出，改成"在 `.env.staging` 加 `GIT_SHA=` 行 + 脚本 restart 前更新"的运行时 workaround，不追求根因完美修复 |
| F003 脚本跑一半失败后 staging 状态不一致 | 低 | 脚本非破坏（不 DROP DB）+ `set -euo pipefail` 快速止损；恢复路径：回到上一个 SHA + `pm2 restart` |
| F003 在 CI 里测成本高 | 低 | 整合测试 optional；manual 验证通过即可。Unit test 层面覆盖 F001 / F002 |
| 手动 VPS deploy 习惯未迁移到脚本 | 低 | F004 runbook 置顶推荐新路径，但保留手动步骤作调试 fallback |

## 7. 验收方式（Evaluator 阶段）

### L1 自动化
- `tests/integration/health-endpoint.test.ts` git_sha 格式断言绿
- `tests/integration/seed-kol-env.test.ts` subprocess test 绿
- `npm run lint` + `npx tsc --noEmit` 绿

### L2 功能验证（staging）
- ssh + `bash /opt/kolmatrix-staging/infrastructure/deploy-staging.sh` 端到端成功
- 跑第 2 次验证增量 detect 生效（大部分 step 跳过）
- 故意改坏 package-lock 验证 exit 非 0 + `✗ FAILED` 消息
- `/api/health` git_sha 为真 SHA
- **VPS artifact in-git check**：`ssh vps 'cd /opt/kolmatrix-staging && git ls-files infrastructure/deploy-staging.sh'` 非空

### L3 视觉
- 不涉及

## 8. 引用文档

- `docs/dev/tls-staging-runbook.md` §5 + §6
- `.github/workflows/deploy-prod.yml`（比对 git_sha 注入方式）
- `backlog.json` BL-001 / BL-002 / BL-004
- `framework/harness/deploy-patterns.md` §2（VPS artifact in-git 硬要求）

## 9. 启动检查清单（Generator 开工前）

- [ ] BM2 当前批次不阻塞（本批次可在 BM2 building idle 期穿插，也可 BM2 done 后独立做）
- [ ] 读 `backlog.json` BL-002 `investigation_log`（Planner 已记录两次失败尝试，避免重走）
- [ ] F001 先做 `git log --all -p -- src/app/api/health/route.ts` + 核 deploy-prod.yml，定位后再改

## 10. 估时

| 环节 | 预估 |
|---|---|
| F001 定位 + 修 git_sha | 2-3h（1h 定位 + 1h 修 + 0.5h 测）|
| F002 加 dotenv 2 行 + test | 30min |
| F003 脚本编写 + 本地/VPS 迭代 | 2-3h |
| F004 runbook + backlog close | 30min |
| **总计** | **~5-7h（1 天内搞定）** |

---

**Spec 状态：** draft（2026-04-24 Planner 起草，BM2 done 后或 idle 期启动）

---
name: BIx-staging-automation
description: Staging 部署自动化 - 整合 BL-001/002/004/013 + prod git_sha 一并修
status: decisions-locked
created_by: Kimi (Planner)
created_at: 2026-04-27
decisions_locked_at: 2026-04-27
estimated_effort: 2.5-3 day
prerequisites:
  - MVP-seed-demo-prep done（用户裁决：demo done 立即启动，不等第一周 monitoring）
  - prod 健康（已通过 MVP-prod-launch-smoke 验证）
---

# BIx-staging-automation — Staging 部署自动化

## 1. 背景与目标

当前 staging 部署全手动 SSH（参见 `docs/dev/tls-staging-runbook.md` §5），每次需要 5-10 分钟人工执行 6 步命令（git pull / npm ci / migrate / build / pm2 reload / health check）。Planner 在 BM2 L2 deploy 时实测踩坑：

1. `npm ci` 默认 `--omit=dev` 漏装 `@tailwindcss/postcss` build deps（BL-013）
2. seed:kol 缺少 `dotenv/config` 自动加载（BL-001）
3. health endpoint git_sha 始终显示 unknown（BL-002，runtime env 不保留）
4. 手动流程容易遗漏步骤 + 易出错（BL-004）

本批次目标：**一次性消除 4 个 staging 手动 deploy 痛点，让 staging deploy 像 prod 一样一条命令搞定。**

**非目标：**
- 不做 GitHub Actions auto-deploy staging（1 人团队不需要 webhook 触发；保持 Planner / Generator / 用户手动触发可控）
- 不做 staging E2E 自动跑（已有 codex-setup/codex-wait 工具链，Reviewer 按需触发）
- 不做 staging 数据周期清理（独立 ops 任务，本批次仅 placeholder）

## 2. 范围

### In Scope（5 features）

1. **F001** — `infrastructure/deploy-staging.sh` 入 git（一条命令完成 git pull / npm ci / migrate / build / pm2 reload / health）
2. **F002** — BL-013 修复（package.json move build deps to dependencies，方案 A）
3. **F003** — BL-001 修复（scripts/seed-kol-from-enriched.ts + 同类脚本头加 `import 'dotenv/config'`）
4. **F004** — BL-002 修复（health endpoint git_sha runtime 可见，staging deploy 流程注入 GIT_SHA 到 pm2 runtime env）
5. **F005** — runbook 更新 + tests/integration/staging-deploy-script.test.ts 静态守门（防回退）

### Out of Scope

- prod deploy 流程改造（已稳定；scripts/deploy-prod.sh + .github/workflows/deploy-prod.yml 不动）
- pm2 ecosystem.config.js（如有）改造（BL-002 修复在 deploy script 层处理，不改 pm2 配置）
- staging 数据 reset 自动化（runbook §6 已有手动流程，足够 MVP）
- staging URL / TLS 续期（BI3 已落，不动）
- monitoring / alerting（BI4 范围）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 入 git 路径 | `infrastructure/deploy-staging.sh` | 与 `infrastructure/{certbot,cron,nginx}/` 同目录，统一 infra-as-code |
| 命令风格 | 单文件 bash 脚本（参照 deploy-prod.sh，~80 行）| 1 人团队不引入 ansible/terraform；shell 易读 + 易调试 |
| GIT_SHA 注入路径 | **deploy-staging.sh 写入 /opt/kolmatrix-staging/.env.staging 后 pm2 reload --update-env** | runtime env 保留；同 prod deploy 模式一致 |
| BL-013 修复方案 | **方案 A**：移到 dependencies | hotfix BL-013 已确认推荐；避免 staging/prod 命令分歧 |
| 健康检查策略 | 同 prod：scripts/healthcheck.sh 5× / 3s poll | 复用现有工具；不引入新依赖 |
| 失败回滚 | 不实现 staging 自动回滚（仅 prod 有），失败时 abort 留半成品由人工修 | staging 容忍度高，破坏性 abort 可接受；自动回滚增加复杂度 |
| Dotenv 加载位置 | **每个独立运行的 script 头加 `import 'dotenv/config'`**（不依赖 shell `source .env`）| 让脚本本身可以 `npx tsx scripts/foo.ts` 跑通 + 文档化的 env 依赖 |
| 测试守门 | tests/integration 用静态 source code grep 守 deploy-staging.sh 流程关键步 | 同 BM2 codex-wait-script.test.ts 模式 |
| 文档 | `docs/dev/tls-staging-runbook.md` §5 大改写：从 6 步手动改为 "ssh + 1 条命令" + fallback 6 步保留 | runbook 仍然记录手动流程作为应急 fallback，但默认推荐脚本 |

## 4. 功能列表

### F001 — `infrastructure/deploy-staging.sh` 入 git

**实现：**

```bash
#!/usr/bin/env bash
#
# Staging deploy driver — runs on the VPS, invoked by:
#   ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix-staging && ./infrastructure/deploy-staging.sh'
# 或本地 oneliner：
#   ssh tripplezhou@34.180.93.185 'bash -s' < /opt/kolmatrix-staging/infrastructure/deploy-staging.sh
#
# Sequence (mirrors deploy-prod.sh §F003 minus rollback + backup):
#   1. git fetch + pull --ff-only origin main
#   2. compute GIT_SHA + write to .env.staging
#   3. npm ci --production=false  (装全部 deps，含 build-time tailwindcss)
#   4. prisma migrate deploy
#   5. npm run build
#   6. pm2 reload kolmatrix-staging --update-env  (zero-downtime)
#   7. healthcheck (5×/3s poll /api/health)
#   8. echo summary（git_sha + uptime + db ok latency）
#
# 与 prod 区别：
#   - 不做 pre-deploy backup（staging 数据丢失可接受）
#   - 不做自动回滚（staging 失败留半成品由人工修，避免复杂度）
#   - 默认 pull main HEAD，不接 GIT_SHA 入参（手动 deploy 不指定旧 sha）

set -euo pipefail

: "${REPO_DIR:=/opt/kolmatrix-staging}"
cd "$REPO_DIR"

echo "── 1/8  git pull --ff-only origin main"
git fetch --all --prune
git pull --ff-only origin main

echo "── 2/8  compute GIT_SHA + inject into .env.staging"
GIT_SHA=$(git rev-parse --short HEAD)
echo "   GIT_SHA = $GIT_SHA"
# upsert GIT_SHA= line into .env.staging
if grep -q "^GIT_SHA=" .env.staging; then
  sed -i "s|^GIT_SHA=.*|GIT_SHA=$GIT_SHA|" .env.staging
else
  echo "GIT_SHA=$GIT_SHA" >> .env.staging
fi

echo "── 3/8  npm ci"
npm ci --production=false

echo "── 4/8  prisma migrate deploy"
# load .env.staging for DATABASE_URL
set -a
# shellcheck disable=SC1091
source .env.staging
set +a
npx prisma migrate deploy

echo "── 5/8  next build"
GIT_SHA=$GIT_SHA npm run build

echo "── 6/8  pm2 reload"
pm2 reload kolmatrix-staging --update-env

echo "── 7/8  healthcheck"
sleep 3  # let pm2 settle
"$REPO_DIR/scripts/healthcheck.sh" --base-url http://localhost:3002

echo "── 8/8  summary"
curl -sS https://staging.kol.guangai.ai/api/health | python3 -m json.tool
echo "✅ Staging deploy success: $GIT_SHA"
```

**Acceptance：**
- 文件入 git `infrastructure/deploy-staging.sh` 0755
- 本机 `ssh staging-vm 'cd /opt/kolmatrix-staging && ./infrastructure/deploy-staging.sh'` 5 分钟内完成
- health endpoint 返回 git_sha 不再为 "unknown"
- pm2 status 显示 kolmatrix-staging online + 0 restart 次数（前提：步骤无错）
- scripts/healthcheck.sh 复用（不新建），如该脚本只支持 prod URL 则加 `--base-url` 参数（属 healthcheck.sh 改动，本批次内）
- runbook §5 更新为 "推荐：./infrastructure/deploy-staging.sh / fallback：6 步手动"

### F002 — BL-013 修复（dep 移动）

**实现：** 修 `package.json`：

```diff
   "dependencies": {
     ...
+    "@tailwindcss/postcss": "^4",
+    "tailwindcss": "^4",
     ...
   },
   "devDependencies": {
     ...
-    "@tailwindcss/postcss": "^4",
-    "tailwindcss": "^4",
     ...
   }
```

`npm install` 重生成 `package-lock.json`。

**Acceptance：**
- package.json + package-lock.json 提交
- 本地 `rm -rf node_modules && NODE_ENV=production npm ci && npm run build` 通过（验证 prod-like 行为）
- staging 用 deploy-staging.sh 跑通（含 npm ci --production=false 的 sanity check：仍然能装全部 deps，与本修复不冲突）
- 静态测试 tests/unit/package-deps.test.ts：验证 @tailwindcss/postcss 在 dependencies（防回退）

### F003 — BL-001 修复（dotenv 自动加载）

**实现：** 在所有独立运行的 scripts 头加 `import 'dotenv/config';`：

```diff
+ import 'dotenv/config';
+
  /**
   * BM1-F002 · KOL seed from AI-enriched JSON.
   * ...
   */
  import { readFile } from "node:fs/promises";
```

**适用范围（grep）：**
- scripts/seed-kol-from-enriched.ts（BL-001 主因）
- scripts/seed-email-templates.ts（BM2 F002 实现，需核对是否已有；如有，跳过）
- scripts/seed-marketing-templates.ts（如有）
- 其他 `scripts/*.ts` 顶层 process.env 读取的脚本

**Acceptance：**
- grep 扫 `scripts/*.ts` 发现所有顶层读 `process.env` 的脚本头都有 `import 'dotenv/config'`
- `npm run seed:kol` 在裸 shell（无 `set -a && source .env`）下跑通
- tests/unit/scripts-dotenv-loaded.test.ts 静态守门（grep 检测）

### F004 — BL-002 修复（git_sha runtime 可见）+ prod 同坑一并修（用户裁决）

**根因（Planner 2026-04-27 调研）：**
- `src/app/api/health/route.ts` L79: `git_sha: process.env.GIT_SHA ?? "unknown"`
- 健康接口在 **runtime** 读 GIT_SHA env
- staging 手动 deploy 时，build-time `GIT_SHA=xxx npm run build` **不持久化**到 pm2 process env
- pm2 reload 后 process 拿到的 env 来自 .env.staging（如其中无 GIT_SHA → unknown）

**修复 staging（已包含在 F001 deploy-staging.sh §2 中）：** 部署脚本将 GIT_SHA upsert 到 .env.staging，再 pm2 reload --update-env 让 process 拿到。

**修复 prod（用户裁决"一并修"）：**
- `scripts/deploy-prod.sh` 在 `npm run build` 前增加：
  ```bash
  # Persist GIT_SHA to .env.production for runtime visibility (BL-002 fix)
  if grep -q "^GIT_SHA=" .env.production; then
    sed -i "s|^GIT_SHA=.*|GIT_SHA=$GIT_SHA|" .env.production
  else
    echo "GIT_SHA=$GIT_SHA" >> .env.production
  fi
  ```
- prod 验证：下次 prod deploy 后 `curl https://kol.guangai.ai/api/health | jq .git_sha` 必须等于 deploy 的 commit sha（前 7 位）

**Acceptance：**
- BL-002 staging 验证：deploy-staging.sh 跑完后 git_sha 返回 7 位 sha
- BL-002 prod 验证：下次 prod deploy 后 git_sha 同样返回 7 位 sha（可通过测试 prod 触发非业务 commit deploy 验证）
- 可选 polish：把 GIT_SHA 也写到 `.next/git-sha.txt` build-time artifact，作为兜底（runtime fallback 读 file）— 本批次不做，留 backlog

### F005 — runbook 更新 + 静态守门测试

**实现：**

1. `docs/dev/tls-staging-runbook.md` §5 大改写：
   - 主推：`ssh + ./infrastructure/deploy-staging.sh`
   - Fallback 6 步手动（保留）：标"应急 / 调试用"
   - 新增 Troubleshooting 段：deploy-staging.sh 各步失败时的诊断命令

2. `tests/integration/staging-deploy-script.test.ts`：
   - 静态 source code 检查（同 BM2 codex-wait-script.test.ts 模式）：
     - deploy-staging.sh 含 `npm ci --production=false`
     - 含 `pm2 reload kolmatrix-staging --update-env`
     - 含 GIT_SHA 注入 .env.staging 的 sed/grep 模式
     - 含 healthcheck step
   - 不实际跑（避免 CI 触发 SSH）

3. `tests/unit/package-deps.test.ts`：
   - `@tailwindcss/postcss` + `tailwindcss` 在 `dependencies`（不在 devDependencies）

4. `tests/unit/scripts-dotenv-loaded.test.ts`：
   - 所有 `scripts/*.ts` 顶层 import 含 `dotenv/config`

**Acceptance：**
- runbook §5 ≥ 50 行（主流程 + fallback + troubleshooting）
- 3 个 test 文件全绿；防回退覆盖 4 个修复点
- 用户 dry-run 一次完整 deploy-staging.sh 验证可用

## 5. 依赖关系

```
F002 (BL-013 dep) ─┐
                   ├─→ F001 (deploy-staging.sh) ─→ F005 (runbook + tests)
F003 (BL-001 dotenv) ┤
                   │
F004 (BL-002 git_sha) ─┘ (实现含在 F001 内，无独立代码)
```

**强依赖：** F002 / F003 必须在 F001 之前完成（让 deploy-staging.sh 一次跑通）；F004 实现在 F001 内；F005 最后

**推荐顺序：** F002 → F003 → F001 → F004 验证 → F005

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| F002 移 dep 到 dependencies 导致生产 bundle 体积膨胀 | 低 | 实测 +30MB 可接受；监控 prod node_modules 大小不超过 500MB |
| F004 修复后发现 prod git_sha 也走的同路径 → prod 行为变化 | 中 | 修复仅在 deploy-staging.sh 内做，不动 prod；先实测 prod 行为再决定是否同步修 |
| F001 healthcheck.sh 不支持 staging URL | 低 | F001 acceptance 含 `--base-url` 参数化，最多 5 行 shell 改动 |
| pm2 reload 不重读 .env.staging（reload 不等于 restart） | 中 | F001 用 `pm2 reload --update-env` 强制读新 env；如仍不生效用 `pm2 restart`（staging 单 fork 无 zero-downtime 损失） |
| Generator 修 BL-013 时 npm install 引入 lockfile 漂移（其他包升级） | 中 | F002 acceptance 要求用 `npm install @tailwindcss/postcss tailwindcss --save` 精准迁移而非裸 npm install |
| BL-001 修 dotenv 后某些 script 双重 dotenv 加载报错 | 低 | dotenv/config 幂等，多次调用安全 |
| staging 改动期间被 hotfix Generator 推送干扰 | 中 | BIx 启动前确认 hotfix done，不并行 |

## 7. 验收方式（Evaluator 阶段）

### L1 自动化
- 4 个新 test 文件全绿
- typecheck / lint / 现有套件不退化
- `rm -rf node_modules && NODE_ENV=production npm ci` 后 `npm run build` 通过（验证 F002 修复）

### L2 staging（强制）
- ssh staging-vm 跑 `./infrastructure/deploy-staging.sh` 5 分钟内完成
- 健康检查 git_sha 返回正确 7 位 sha
- npm run seed:kol 裸 shell 跑通（验证 F003）

### L3 prod（不做）
- 本批次不动 prod；prod 验证留 monitoring（Sentry / Grafana 未上 BI4 后做）

## 8. 引用文档

- `docs/dev/tls-staging-runbook.md`（runbook 修改目标）
- `scripts/deploy-prod.sh`（参照实现）
- `src/app/api/health/route.ts` L79（git_sha 来源）
- `framework/harness/deploy-patterns.md`
- `backlog.json` BL-001 / BL-002 / BL-004 / BL-013

## 9. 启动检查清单（Generator 开工前）

- [ ] MVP-visual-fidelity-hotfix done + signoff 入 git
- [ ] MVP-seed-demo-prep done（避免 staging 改动期间影响 demo 发放）
- [ ] prod 已稳定运行 ≥ 7 天
- [ ] 用户确认 BIx 启动时机（建议 MVP 上线 + 第一周 monitoring 之后）

## 10. 估时

| 环节 | 预估 |
|---|---|
| F002 BL-013 dep 移动 + lockfile + 验证 | ~0.5 day |
| F003 BL-001 dotenv 加载 + grep 全脚本 | ~0.3 day |
| F001 deploy-staging.sh + healthcheck.sh 参数化 | ~0.5 day |
| F004 BL-002 验证 + prod 路径调研 | ~0.3 day |
| F005 runbook 改写 + 3 个守门测试 | ~0.5 day |
| 缓冲 + L2 staging 验证 + 反复修 | ~0.4 day |
| **总计** | **~2.5 day** |

## 11. 与时间线（用户裁决：demo done 立即启动）

| 节点 | 预估 |
|---|---|
| MVP-visual-fidelity-hotfix done | ~2026-05-02 |
| MVP-prod-launch-smoke done（平行 micro-batch） | 2026-05-02 |
| MVP-seed-demo-prep done | ~2026-05-05 |
| 首批种子用户邀请发出 | 2026-05-05 |
| **BIx-staging-automation 启动**（用户裁决 demo done 立即，不等第一周 monitoring） | **~2026-05-05** |
| BIx done | ~2026-05-08 |

**调整说明：** 比原 spec 草案的 "MVP 上线后第一周观察期满（5/12）" 提前 7 天，避免 staging deploy 痛点积累；不影响 prod 稳定性（仅改 staging + prod git_sha 一处）。

---

**Spec 状态：** decisions-locked（2026-04-27 Planner 起草 + 用户裁决 3/3 全部落地，demo done 后切 planning → building）

**用户决策（2026-04-27 全部 ✅）：**
1. 启动时机：**demo done 立即**（不等第一周 monitoring）✅
2. F004 prod git_sha：**一并修 prod**（同样 .env.production upsert + pm2 reload --update-env 模式）✅
3. F002 dep 移动：**留在 BIx 内做**，不独立 micro-batch；同时 **Generator 在 hotfix building 间隙可顺手做**（如已修则 BIx F002 标 "已落地" 跳过）✅

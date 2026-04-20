# BI2 F006 · rollback.sh exit 2 分支受控演练规格

> **发起者：** Kimi (Planner)
> **日期：** 2026-04-20
> **触发：** Reviewer reverifying round 2 判 F006 PARTIAL（`rollback.sh` 的 `exit 2` 分支即 "healthcheck 失败后 MANUAL INTERVENTION REQUIRED" 未在生产安全条件下受控演练）
> **执行者：** Reviewer（或 Generator 协助）
> **前置批准：** 用户 2026-04-20 确认走 mock healthcheck 方案

---

## 1. TL;DR

在 VPS 上以 trap 兜底的方式临时 stub `/opt/kolmatrix/scripts/healthcheck.sh` 为 `exit 1`，让 `rollback.sh` 走完完整流程（git checkout / npm ci / build / pm2 reload）后触达 exit 2 分支。全程 ~2 分钟，对生产零影响（F002 B1 zero-downtime 已保证 pm2 reload 不掉包）。

---

## 2. 为什么这样做

### 2.1 rollback.sh 的三分支

```bash
exit 1  # PREV_SHA_FILE 不存在                    [Round 1 已验 ✅]
exit 0  # 回滚 + 二次 healthcheck 通过             [Round 2 已验 ✅]
exit 2  # 回滚 + 二次 healthcheck 仍失败            [← 本次演练目标]
```

### 2.2 rollback.sh 的关键约束

```bash
# scripts/rollback.sh:48
/opt/kolmatrix/scripts/healthcheck.sh
```

healthcheck 调用**硬编码绝对路径**（非 `$REPO_DIR`），所以无法通过 REPO_DIR 隔离来让 healthcheck 失败。必须直接在 `/opt/kolmatrix/scripts/` 下 stub。

**这不是 bug：** rollback 是 last-resort 脚本，硬编码绝对路径确保无论 REPO_DIR 被篡改与否都调真 healthcheck。Planner 不改此行。

### 2.3 为什么不 "PREV_SHA = 一个 break /api/health 的坏 commit" 来自然触发

要在 prod 硬让 /api/health 坏掉才能触发二次 healthcheck 失败。风险：
- rollback.sh 真的把坏 commit 部署到 prod（即使之后 exit 2 报警，2-3 分钟窗口内 /api/health 是坏的）
- F003 deploy workflow 监控看板会亮红灯
- 得不偿失

**Mock healthcheck 方案：** 回滚流程真跑（prev-sha = 当前 HEAD，git checkout no-op，但 npm ci + build + pm2 reload 都真跑），只是最后一步 healthcheck 被 stub 成 exit 1。这样：
- rollback 过程对服务无影响（reload 同一份代码，F002 zero-downtime）
- exit 2 分支被真实触发
- 演练结束 trap 自动恢复 healthcheck

### 2.4 窗口期风险与缓解

Stub 期间（~90-120 秒），如其他进程调用 `/opt/kolmatrix/scripts/healthcheck.sh` 会得到 exit 1。已知调用点：
- `scripts/deploy-prod.sh` 内 deploy 最后一步（仅 deploy workflow 运行时）
- `rollback.sh` 自身（本演练正在调）
- 其他无

**缓解：** Reviewer 演练期间不触发 deploy workflow；trap 兜底确保脚本中断也会恢复。

---

## 3. 执行步骤（Reviewer 按此跑）

### 3.1 准备（用户通报）

Reviewer 开始前告诉用户"F006 exit 2 演练开始，预计 3 分钟，期间不要触发 deploy workflow"。结束后通报"演练完成"。

### 3.2 SSH + 切目录

```bash
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix
```

### 3.3 写 "drill 封装脚本"到 /tmp（trap 兜底恢复）

将以下整体粘贴到 VPS 终端（一次性脚本，执行完即删）：

```bash
cat > /tmp/f006-exit2-drill.sh <<'DRILL_EOF'
#!/usr/bin/env bash
set -euo pipefail

REPO=/opt/kolmatrix
HC="$REPO/scripts/healthcheck.sh"
BAK="$HC.f006-drill.bak"
PREV_SHA_FILE=/tmp/prev-sha-f006-drill

echo "[drill] starting F006 exit 2 drill at $(date -u +%FT%TZ)"

# ----- Cleanup (invoked via trap on any exit) -----
restore() {
  local rc=$?
  echo "[drill] restore() running (script exit=$rc)"
  if [[ -f "$BAK" ]]; then
    mv -f "$BAK" "$HC"
    chmod +x "$HC"
    echo "[drill] ✅ healthcheck.sh restored from backup"
  fi
  rm -f "$PREV_SHA_FILE"
  # sanity: ensure restored healthcheck matches git HEAD
  if ! git -C "$REPO" diff --quiet -- scripts/healthcheck.sh; then
    echo "[drill] ⚠️  git diff on scripts/healthcheck.sh NOT CLEAN after restore — MANUAL CHECK"
    git -C "$REPO" diff --stat -- scripts/healthcheck.sh
  else
    echo "[drill] ✅ git diff clean — scripts/healthcheck.sh matches HEAD"
  fi
}
trap restore EXIT

# ----- Step 1: capture current SHA as "prev-sha" (rollback no-op on git side) -----
cd "$REPO"
CURRENT_SHA=$(git rev-parse HEAD)
echo "$CURRENT_SHA" > "$PREV_SHA_FILE"
echo "[drill] prev-sha file = $PREV_SHA_FILE (content: $CURRENT_SHA)"

# ----- Step 2: back up real healthcheck.sh + install stub -----
cp -f "$HC" "$BAK"
cat > "$HC" <<'STUB_EOF'
#!/usr/bin/env bash
echo "[f006-drill-stub] simulated healthcheck failure"
exit 1
STUB_EOF
chmod +x "$HC"
echo "[drill] healthcheck.sh stubbed (always exits 1)"

# ----- Step 3: run rollback.sh with PREV_SHA_FILE override -----
echo "[drill] invoking rollback.sh now..."
set +e
PREV_SHA_FILE="$PREV_SHA_FILE" "$REPO/scripts/rollback.sh"
RB_EXIT=$?
set -e

echo "[drill] rollback.sh returned exit code: $RB_EXIT"

# ----- Step 4: assertion -----
if [[ $RB_EXIT -eq 2 ]]; then
  echo "[drill] ✅ exit code 2 confirmed"
else
  echo "[drill] ❌ expected exit 2, got $RB_EXIT — FAILED"
  exit 10
fi

# ----- Step 5: verify service alive (F002 B1 guarantee) -----
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' https://kol.guangai.ai/api/health)
if [[ "$HTTP" == "200" ]]; then
  echo "[drill] ✅ public /api/health still 200 (service unaffected by drill)"
else
  echo "[drill] ⚠️  public /api/health returned $HTTP — investigate"
fi

echo "[drill] drill complete at $(date -u +%FT%TZ)"
DRILL_EOF
chmod +x /tmp/f006-exit2-drill.sh
```

### 3.4 执行演练并捕获完整输出

```bash
/tmp/f006-exit2-drill.sh 2>&1 | tee /tmp/f006-exit2-drill.log
```

**预期输出关键行（自上而下）：**
```
[drill] starting F006 exit 2 drill at ...
[drill] prev-sha file = /tmp/prev-sha-f006-drill (content: <HEAD SHA>)
[drill] healthcheck.sh stubbed (always exits 1)
[drill] invoking rollback.sh now...
🔄 Rolling back /opt/kolmatrix → <HEAD SHA>
...npm ci / npm run build / pm2 reload 输出...
[f006-drill-stub] simulated healthcheck failure       ← stub 被 rollback.sh 调到
❌ Rollback ALSO failed healthcheck — MANUAL INTERVENTION REQUIRED
   Follow docs/dev/deployment-runbook.md §Manual rollback from here.
[drill] rollback.sh returned exit code: 2
[drill] ✅ exit code 2 confirmed
[drill] ✅ public /api/health still 200 (service unaffected by drill)
[drill] restore() running (script exit=0)
[drill] ✅ healthcheck.sh restored from backup
[drill] ✅ git diff clean — scripts/healthcheck.sh matches HEAD
[drill] drill complete at ...
```

### 3.5 清理（trap 已自动做，再次手动确认）

```bash
# 确认 trap 清理完成
ls /opt/kolmatrix/scripts/healthcheck.sh.f006-drill.bak 2>&1 | head -1   # 应 no such file
ls /tmp/prev-sha-f006-drill 2>&1 | head -1                                 # 应 no such file
git -C /opt/kolmatrix diff --stat scripts/healthcheck.sh                   # 应空输出
./scripts/healthcheck.sh https://kol.guangai.ai/api/health && echo "real hc OK"

# 清理一次性 drill 脚本
rm /tmp/f006-exit2-drill.sh
```

---

## 4. Acceptance（Reviewer 判 F006 PASS 用）

全部满足 → F006 从 PARTIAL 升 PASS：

1. ✅ `/tmp/f006-exit2-drill.log` 包含以下证据：
   - `❌ Rollback ALSO failed healthcheck — MANUAL INTERVENTION REQUIRED`（rollback.sh line 57 的原文字）
   - `[drill] ✅ exit code 2 confirmed`
2. ✅ `rollback.sh` exit code = `2`
3. ✅ 演练后 `git diff scripts/healthcheck.sh` 空（恢复 clean）
4. ✅ 演练期间 `https://kol.guangai.ai/api/health` 一直 200（pm2 reload 零掉包，F002 保证）
5. ✅ 演练后跑一次真的 `./scripts/healthcheck.sh` exit 0

如任意一项不过，Reviewer 写 round 3 fixing feedback 回 progress.json，Generator/Planner 再议。

---

## 5. 演练后的 Reviewer 动作

1. 把 `/tmp/f006-exit2-drill.log` 关键行摘到 `docs/test-reports/BI2-deployment-automation-reverifying-round2-2026-04-20.md` 的 F006 段落下方（或新建 round2-fixing-followup report，二选一）
2. 更新 progress.json `evaluator_feedback`：F006 从 PARTIAL → PASS，pass_count 从 7 → 8，清空 issues（或只剩 F006 移除后空）
3. 切 `status: fixing → reverifying`，Planner 看到 8 PASS → done
4. 签收报告 `docs/test-reports/BI2-deployment-automation-signoff-2026-04-20.md`，置 status=done

---

## 6. 风险登记

| 风险 | 概率 | 缓解 |
|---|---|---|
| Stub 期间其他进程调 healthcheck.sh | 低（只有 deploy workflow 用）| Reviewer 演练前通报用户不触发 deploy；窗口 <3min |
| 脚本执行中断，healthcheck 未恢复 | 极低 | `trap restore EXIT` 兜底，任何 exit 路径都恢复 |
| npm ci 改变 node_modules 引起异常 | 极低 | ci 是 deterministic reinstall，不改 lockfile |
| npm run build 失败 | 低 | 当前 HEAD 本身就是 prod 跑的 build，失败会被 trap 兜底 |
| pm2 reload 丢包 | 极低 | F002 B1 已验 60/60 zero-downtime |

---

## 7. 版本

| 日期 | 产出 |
|---|---|
| 2026-04-20 | 初版（Planner Kimi） |

# BL-069 cap-exhausted staging simulation runbook

> **批次：** `BL-069-brief-page-merge` fix-round 1 (B2)
> **目标读者：** Codex Reviewer + 后续 Phase 4/5 dogfood operator
> **创建：** 2026-05-18 / Generator johnsong
> **关联 spec：** `docs/specs/BL-069-brief-page-merge-spec.md` §F002 / §F007

## 背景

Reviewer 在 2026-05-18 staging spot-check（fix-round 0）拦截 BL-069 验收时记录:

> B2 (Medium): cap 满模拟未完成。当前 staging/仓库没有 reviewer 可安全执行的注入开关或文档化步骤，只看到单测 mock 覆盖。

`parseBriefAction` (BL-069 F002 server action) 的 cap-exhausted fallback
路径在生产中由 `checkLlmCostBudget(tenantId)` 触发，需要某 tenant 在过去
24h 内实际花掉 $5 才会命中。**这在 staging 复现成本高（要 LLM 真烧钱）
且无法精确控制时机**，使得 Reviewer 无法在 spot-check 窗口内验证 UX
（toast 文案 / 表单保留 / 链路完整）。

## 解决方案：staging-only env flag

`BRIEF_FORCE_CAP_EXHAUSTED=true` 让 `parseBriefAction` 在 cap 预检
阶段**直接走 cap fallback 分支**（不调 `checkLlmCostBudget`、不发起
LLM call、不计费），同时仍按正常 cap_exhausted 路径写 audit_log（带
`forced: true` 标记便于 dashboard 区分）。

实装位置：`src/app/[locale]/(app)/brief/brief-actions.ts` 第 4 步
（`process.env.BRIEF_FORCE_CAP_EXHAUSTED === "true"` 时短路）。

## ⚠️ 安全约束（生产铁律）

- **prod `.env.production` 永远不得设置 `BRIEF_FORCE_CAP_EXHAUSTED`。**
  这个开关会让所有 tenant 的 brief AI 解析永久走 cap fallback，等于
  让产品 broken。
- **staging 用完必须立刻取消设置。** 跑完一个 dogfood spot-check 立即
  unset 并 pm2 reload，避免影响后续 dogfood 流程（其他人 AI parse 突然
  全 cap）。
- env flag 缺失或非字符串 `"true"` 时正常路径生效（`===` 严格匹配）。
- 一旦设置，所有 brief 解析请求都会走 cap path——**操作期间不能同时跑
  parse-success 验证或 dogfood 真实 query**。

## 操作步骤（Reviewer）

### 启用 cap 模拟

```bash
ssh tripplezhou@34.180.93.185

# 1. 备份当前 staging env
sudo cp /opt/kolmatrix-staging/.env.staging \
  /opt/kolmatrix-backups/.env.staging.bl069-cap-sim.$(date +%Y%m%d-%H%M%S)

# 2. 追加 env flag
sudo tee -a /opt/kolmatrix-staging/.env.staging > /dev/null <<'EOF'

# BL-069 fix-round 1 (B2): TEMPORARY cap-exhausted simulation flag.
# UNSET after dogfood spot-check. Production must NEVER set this.
BRIEF_FORCE_CAP_EXHAUSTED=true
EOF

# 3. 验证写入
sudo grep "BRIEF_FORCE_CAP_EXHAUSTED" /opt/kolmatrix-staging/.env.staging

# 4. pm2 reload to pick up the new env
pm2 reload kolmatrix-staging --update-env

# 5. 验 staging health 仍 healthy
curl -s "https://staging.kol.guangai.ai/api/health?token=<HEALTH_DETAIL_TOKEN>" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('status:', d['status'])"
```

### 验证 cap UX

1. 浏览器打开 `https://staging.kol.guangai.ai/en/brief`（用 marketer 账号
   `marketer@kolmatrix.local` / `KOLMatrix@2026!`）
2. 在顶部 AI brief input bar 填任意 query（例：`Q2 brief test`）
3. 点击 Generate 按钮
4. **预期**：
   - 显示 `brief-ai-toast-cap` toast，文案匹配
     `messages/en.json` `brief.aiInputBar.capExhaustedToast`
     ("Daily AI quota reached. Please fill the form manually.")
   - CampaignForm 字段保持空（silent fallback per §5 不变量 #4）
   - Browser DevTools Network 标签**没有** LLM 调用（不掉钱）
5. 截屏存档作为 spot-check 证据

### 验证 audit log forced marker

```bash
ssh tripplezhou@34.180.93.185 << 'AUDIT'
cd /opt/kolmatrix-staging
DATABASE_URL=$DATABASE_ADMIN_URL psql -At -c "
  SELECT id, action, payload->'after'->>'forced' AS forced, created_at
  FROM audit_log
  WHERE action = 'ai_brief.parse_cap_exhausted'
    AND created_at > NOW() - INTERVAL '15 minutes'
  ORDER BY created_at DESC
  LIMIT 5;
"
AUDIT
```

应看到最近行的 `forced=true`。

### 清理（必做！）

```bash
ssh tripplezhou@34.180.93.185

# 1. 用备份文件还原 (推荐 — 一步到位)
sudo cp /opt/kolmatrix-backups/.env.staging.bl069-cap-sim.<TIMESTAMP> \
  /opt/kolmatrix-staging/.env.staging

# 或: 手工删 BRIEF_FORCE_CAP_EXHAUSTED 那一行
# sudo sed -i '/^BRIEF_FORCE_CAP_EXHAUSTED=/d' /opt/kolmatrix-staging/.env.staging

# 2. 验 flag 已移除
sudo grep "BRIEF_FORCE_CAP_EXHAUSTED" /opt/kolmatrix-staging/.env.staging \
  || echo "(no flag found — clean)"

# 3. pm2 reload to drop the env
pm2 reload kolmatrix-staging --update-env

# 4. 再跑一次正常 brief 解析验证恢复正常
```

## 验证清单（Spot-check 报告内体现）

- [ ] 启用 flag 前: 截图 brief 解析正常（成功 toast / 表单填好）
- [ ] 启用 flag 后: 截图 cap toast + 表单空
- [ ] Network 标签未触发真实 LLM call（不掉钱）
- [ ] audit_log 含 `forced=true` 条目
- [ ] 清理 flag 后再次 brief 解析正常
- [ ] 备份文件路径记入 spot-check 报告

## 何时移除此机制

`BL-070 二次清理` 评估保留 vs 删除。如 prod cap 监控成熟（dashboards
+ alerting），保留 staging-only 入口；如 dogfood 自动化成熟，可移除。

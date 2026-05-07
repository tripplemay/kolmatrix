# Ops Report — 孤儿 campaign 4425e07e 清理 2026-05-07

> **类型：** Planner ops（铁律 6 跨角色 ops 用户授权）
> **执行者：** Planner johnsong (CLI)
> **执行时间：** 2026-05-07 13:30~13:40 +0800
> **用户授权：** 2026-05-07 13:30 conversation（BL-049 building 期间）
> **关联：** BL-046 product soft delete（长期治本批次，5/12 实装；本次 ops 是 short-term 一次性清理 / 不等 BL-046）

---

## 1. 触发与决议

**孤儿 campaign 来源：**
- `4425e07e-3954-4ecf-94a3-a48dbe22baba` "王者荣耀世界 5 月推广计划 A"
- 用户 4/29 创建 product → campaign + 10 KOL 关联 → 4/29~5/2 删除 product (hard delete)
- FK `campaign_product_id_fkey ON DELETE SET NULL` 沉默拉链 → campaign.product_id = NULL
- 5/2 status 转 completed（业务影响 = 0，活动已结束）

**用户决议变更（5/6 → 5/7）：**
- 5/6 19:55 决议：1=D 短期不修 + 2=A 5/12 BL-046 长期治本一并解决
- **5/7 13:30 用户改决议：** 不等 BL-046，先 ops 一次性清理孤儿（彻底清掉，UI 不再展示）

---

## 2. Before State (5/7 13:30)

```
prod kolmatrix DB:
  campaign (4425e07e-3954-4ecf-94a3-a48dbe22baba):
    name="王者荣耀世界 5 月推广计划 A"
    status=completed
    product_id=NULL
    tenant_id=2b1dcaa2-...3d5
    owner_user_id=072f45dc-... (marketer@kolmatrix.local)
    created_at=2026-04-29 12:24
    updated_at=2026-05-02 04:50
    budget=10000.00 USD / start=2026-05-01 / end=2026-05-09 / markets=[global]

  cascade 关联：
    kol_campaign:    10 rows  ← FK RESTRICT 须先删
    email_log:        0 rows  (FK SET NULL 但无关联)
    campaign_metric:  0 rows  (FK CASCADE 但无关联)

  audit_log（resource_id=4425e07e）:
    2026-04-29  campaign.status_transitioned
    2026-05-02  campaign.status_transitioned
```

---

## 3. Backup（不可逆 ops 前置）

```bash
# prod /tmp/ops-backup/ (server-side COPY TO STDOUT)
campaign-4425e07e-2026-05-07.tsv         540 bytes   1 row + header
kol_campaign-4425e07e-2026-05-07.tsv    2289 bytes  10 rows + header
```

备份命令：
```bash
sudo -u postgres psql -d kolmatrix -tA -c \
  "COPY (SELECT * FROM campaign WHERE id = '4425e07e-...') TO STDOUT WITH CSV HEADER" \
  > /tmp/ops-backup/campaign-4425e07e-2026-05-07.tsv

sudo -u postgres psql -d kolmatrix -tA -c \
  "COPY (SELECT * FROM kol_campaign WHERE campaign_id = '4425e07e-...') TO STDOUT WITH CSV HEADER" \
  > /tmp/ops-backup/kol_campaign-4425e07e-2026-05-07.tsv
```

> **注意：** 备份文件含 prod 业务数据（KOL ID / tenant_id 等），**不入 git**（PII / data sensitivity）。仅保留 prod `/tmp/ops-backup/` 作短期 rollback 参考；30 天后系统清除（/tmp 默认行为）。

---

## 4. Transaction（5/7 13:40 COMMIT）

完整 SQL：`/tmp/ops-delete-orphan-campaign.sql`（49 行）

```sql
BEGIN;

-- 1. audit_log 补记（不可逆 ops 必须先记审计）
INSERT INTO audit_log (tenant_id, action, resource_type, resource_id, payload, created_at)
VALUES (
  '2b1dcaa2-...3d5'::uuid,
  'campaign.deleted_by_planner_ops',
  'campaign',
  '4425e07e-...'::uuid,
  jsonb_build_object(
    'campaign_name', '王者荣耀世界 5 月推广计划 A',
    'campaign_status_at_delete', 'completed',
    'product_id_at_delete', NULL,
    'reason', 'orphan campaign cleanup — product hard-deleted ... user 5/7 13:30 决议 ops 一次性清理而非等 BL-046',
    'cascaded_kol_campaign_count', 10,
    'cascaded_email_log_count', 0,
    'cascaded_campaign_metric_count', 0,
    'operator', 'Planner johnsong (CLI)',
    'harness_iron_rule', '6 (cross-role ops with user authorization)',
    'user_authorization_at', '2026-05-07 conversation BL-049 building 期间',
    'backup_files', ARRAY[/* 见 §3 */]
  ),
  NOW()
);

-- 2. DELETE kol_campaign（FK RESTRICT 须先删）
DELETE FROM kol_campaign WHERE campaign_id = '4425e07e-...';

-- 3. DELETE campaign
DELETE FROM campaign WHERE id = '4425e07e-...';

COMMIT;
```

执行结果：
```
BEGIN
INSERT 0 1                          ← audit_log 补记
DELETE 10                           ← kol_campaign 10 行
DELETE 1                            ← campaign 1 行
验证 campaign 4425e07e:    0  ✓     ← 期望 0
验证 kol_campaign:         0  ✓     ← 期望 0
验证 audit_log 行数:       3  ✓     ← 期望 3 (历史 2 + 本次补记 1)
COMMIT
```

---

## 5. After State (5/7 13:40)

```
prod kolmatrix DB:
  campaign (4425e07e-...):     0 rows  ✓ DELETED
  kol_campaign for 4425e07e:   0 rows  ✓ DELETED (10 cascaded)
  audit_log for 4425e07e:      3 rows  ✓ KEPT (audit trail)
    2026-04-29  campaign.status_transitioned        (历史)
    2026-05-02  campaign.status_transitioned        (历史)
    2026-05-07  campaign.deleted_by_planner_ops     (本次 ops)
```

---

## 6. Side-Effect Checklist（v0.9.x ops 副作用核查）

| 维度 | Before | After | 影响 |
|------|--------|-------|------|
| `campaign` 总数 | 4 | 3 | -1（孤儿 campaign 移除） |
| `kol_campaign` 总数 | 21 | 11 | -10（10 个 KOL 关联） |
| `email_log` 总数 | 310 | 310 | 不变（0 关联）|
| `campaign_metric` 总数 | 0 | 0 | 不变 |
| `audit_log` 总数 | +0 | +1 | +1（补记）|
| `kol` 总数 | 2442 | 2442 | 不变（kol_campaign 删不影响 kol 表）|

---

## 7. UI 验证（用户手工）

请用户在浏览器走查：
- `/zh/campaigns` 列表 → 应仅 3 campaigns（PUBG / Genshin / Honor of Kings），无 "王者荣耀世界 5 月推广计划 A"
- `/zh/database` KOL 详情 → 之前关联 campaign=4425e07e 的 10 KOL 现在不再显示该 campaign（kol_campaign 已删）
- `/zh/dashboard` campaign 计数 → 应反映 -1

---

## 8. Rollback 路径（如发现问题）

```bash
# 30 天内 (5/7 → 6/6) backup 文件仍在 prod /tmp/ops-backup/：

# 重新插入 campaign
sudo -u postgres psql -d kolmatrix -c \
  "COPY campaign FROM '/tmp/ops-backup/campaign-4425e07e-2026-05-07.tsv' WITH CSV HEADER"

# 重新插入 kol_campaign
sudo -u postgres psql -d kolmatrix -c \
  "COPY kol_campaign FROM '/tmp/ops-backup/kol_campaign-4425e07e-2026-05-07.tsv' WITH CSV HEADER"
```

> **注意：** rollback 后 audit_log 历史保留（含本次 deleted_by_planner_ops 行）— 不删除审计记录，便于后续 forensic。

---

## 9. 时间线

| 时间 (5/7 +0800) | 步骤 |
|------------------|------|
| 13:30 | 用户授权清理孤儿 campaign |
| 13:32 | Planner 实地核查 prod 状态（campaign 4425e07e + 10 kol_campaign + 0 email_log + 0 campaign_metric） |
| 13:33 | FK 约束核查（kol_campaign RESTRICT / email_log SET NULL / campaign_metric CASCADE / audit_log no-FK）|
| 13:35 | 备份执行（COPY TO STDOUT → /tmp/ops-backup/*.tsv）|
| 13:38 | 写 SQL 文件（49 行 BEGIN + audit_log INSERT + 2 DELETE + 验证 + COMMIT）|
| 13:40 | psql -f 执行 transaction → 全 COMMIT 验证通过 |
| 13:42 | Planner 写 ops report + commit + push（本文件） |

---

## 10. 关联与后续

- **BL-046 product soft delete**（5/12 实装）— 长期治本：product `deleted_at` 列 + deleteProduct 改 soft + 关联检查 + audit_log。本次 ops 一次性清理仅消化已存在孤儿；未来 BL-046 防止新孤儿产生。
- **审计 trail 永久保存**：audit_log 中 `campaign.deleted_by_planner_ops` 行包含完整 reason / operator / iron_rule / user_authz timestamp / cascade counts / backup paths，未来 forensic 时可还原全场景。

---

> **Ops report lock：** Planner johnsong @ 2026-05-07 13:42 +0800。本文件作历史 audit trail，不删。

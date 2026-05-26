# BL-076 apify-kol discover-import numeric overflow Hotfix Spec

> **Sprint：** BL-076-apify-numeric-overflow
> **Type：** Prod hotfix（铁律 #9）— Schema migration + adapter clamp + import.ts try/catch 三件套
> **预估工时：** ~6.5h ≈ 1 day Generator + 0.5 day Reviewer
> **关联：** BL-075-signoff-2026-05-27.md §6 residual warning（discover-import numeric overflow）+ /var/log/kolmatrix-kol-sync.log 14 天 fail 证据
> **状态：** A0+A1 完成 → 待 building
> **依赖：** BL-075 done（已满足）

---

## §1 背景与触发

### 1.1 触发 + 严重度提升

BL-075 Reviewer signoff §6 标 residual warning `discover-import[apify-kol]: numeric field overflow`，原 medium priority。

BL-076 Phase A0 audit SSH prod log 实测发现：**5/12 起 14+ 天 prod daily-sync 全部 fail**。每天报告 `discoverCount=2107-2567 inserted=0 updated=0 errors=1`。**新 KOL 14+ 天未同步进 prod DB**。严重度升 **P1**（生产数据同步管道断）。

### 1.2 根因（已定位）

| 维度 | 信号 |
|---|---|
| **错误源** | `src/lib/kol-sync/adapters/apify-kol.ts:409` 计算 `engagementRate = (totalLikes / postsCount) / followers * 100` |
| **Schema 限制** | `engagementRate Decimal? @db.Decimal(5, 2)` — 范围 `-999.99 ~ 999.99` |
| **触发场景** | 极少 followers + view-based proxy `totalLikes`（YT/X）+ 少 postsCount → engagementRate 可超千。例: followers=100, totalLikes=1M, postsCount=1 → rate = 1,000,000% |
| **错误处理 gap** | `src/lib/kol-sync/import.ts` 第一个 overflow KOL 让 `for raw of raws` 整体 throw → 整 batch fail，inserted=0 |
| **error 传播** | `scripts/kol-sync-daily.ts:328` outer try/catch 包成 `discover-import[apify-kol]: ...` 报告 + audit_log |

### 1.3 A1 用户 5/27 lock（3 子决策）

| 决策 | Lock |
|---|---|
| **修复策略** | A: **三件套** — Schema migration Decimal(5,2)→Decimal(7,2) + adapter clamp + import.ts per-KOL try/catch |
| **Defense + log** | A: **均包含** — `engagement_outlier=true` metadata flag（>100% engagement）+ audit_log `kol.import_failed` per-KOL fail |
| **14 天回填** | B: **追 backfill** — BL-076 修后额外跑一次全量 discover-import 追 5/12-5/27 遗漏 KOL |

### 1.4 角色分配

role_assignments = null（默认映射）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- F001 Schema migration engagementRate Decimal(5,2) → Decimal(7,2)
- F002 adapter clamp（max 99999.99）+ outlier flag（>100% engagement → `engagement_outlier=true`）
- F003 import.ts per-KOL try/catch + audit_log kol.import_failed
- F004 14 天遗漏 KOL backfill（SSH prod 跑一次全量 discover-import）
- F005 Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE

- engagement_rate 公式重新设计（保现公式，仅修边界 + 容量）
- view-based proxy 与 like-based 跨平台语义统一（BL-061 fork §3.3 已 lock，不动）
- 其他 numeric 字段（avg_views Int / value_score Int / follower_count Int — 都是 Int 不会 overflow）
- KOL data coverage gap 进一步治理（已在 BL-075）

### 2.3 不变量

1. **不破坏现有 1397 KOL 数据**（migration ALTER TYPE 不丢数据，Decimal 增精度安全）
2. **import.ts try/catch 不静默失败**：每个 fail 必写 audit_log
3. **outlier flag 不丢业务信号**：>100% engagement 仍写入但加 flag 供 UI 过滤
4. **backfill 不重复 sync 现有 KOL**：用 tenantId_platform_externalId unique key 自动 dedupe
5. **migration 必带 ROLLBACK SQL**（per v0.9.22 #22 BL-070 沉淀）

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Audit SSH prod log 14 天 fail 证据 + 根因定位 | ✅ done |
| **A1** | 3 子决策 lock | ✅ done |
| **B** | F001 Schema migration | 1h | Generator |
| **C** | F002 adapter clamp + outlier flag | 1.5h | Generator |
| **D** | F003 import.ts try/catch + audit_log | 1.5h | Generator |
| **E** | F004 14 天 backfill SSH prod 跑 | 1h | Generator |
| **F** | F005 Reviewer L1+L2 + signoff | 1.5h | Codex |

**总：** ~6.5h ≈ 1 day Generator + 0.5 day Reviewer

---

## §4 Features 详细描述

### F001: Schema migration engagementRate Decimal(5,2) → Decimal(7,2)

**Why：** 容纳 view-based proxy KOL 的极端 engagementRate 值（最大 99999.99）。

**What：**

1. 新建 migration `prisma/migrations/<timestamp>_kol_engagement_rate_decimal_7_2/migration.sql`:

```sql
-- BL-076-F001: extend engagement_rate from NUMERIC(5,2) (range ±999.99) to
-- NUMERIC(7,2) (range ±99999.99) so view-based proxy KOL (YT/X) with
-- low followers + high totalLikes don't overflow the column.
--
-- ROLLBACK:
-- ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(5, 2);
-- (Will fail if any row has |engagement_rate| > 999.99; clamp via
--  UPDATE first then ALTER.)

ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(7, 2);
```

2. `prisma/schema.prisma` 更新：

```prisma
- engagementRate  Decimal?  @map("engagement_rate") @db.Decimal(5, 2)
+ engagementRate  Decimal?  @map("engagement_rate") @db.Decimal(7, 2)
```

3. `npx prisma migrate dev` 本地验证 + `npx prisma generate` 重生 client

4. staging 跑 `npx prisma migrate deploy` 验证

**Acceptance：**
- [ ] migration SQL 含 `-- ROLLBACK:` 注释（per v0.9.22 #22 沉淀）
- [ ] schema.prisma Decimal(5,2) → Decimal(7,2)
- [ ] `npx prisma migrate dev` 本地 PASS
- [ ] staging `npx prisma migrate deploy` PASS
- [ ] migration 不丢数据（现有 KOL 全部保留）
- [ ] L1 typecheck PASS（Prisma client 重生）

---

### F002: adapter clamp engagementRate + outlier flag

**Why：** 应用层防御，即使 schema 已 Decimal(7,2)，超 99999.99 仍 overflow。Outlier flag 供 UI + 数据分析使用。

**What：**

1. `src/lib/kol-sync/adapters/apify-kol.ts:409` 改：

```ts
- const engagementRate =
-   typeof followers === "number" && followers > 0 &&
-   typeof postsCount === "number" && postsCount > 0 &&
-   typeof totalLikes === "number" && Number.isFinite(totalLikes)
-     ? (totalLikes / postsCount) / followers * 100
-     : null;
+ const rawEngagementRate =
+   typeof followers === "number" && followers > 0 &&
+   typeof postsCount === "number" && postsCount > 0 &&
+   typeof totalLikes === "number" && Number.isFinite(totalLikes)
+     ? (totalLikes / postsCount) / followers * 100
+     : null;
+
+ // BL-076-F002: clamp engagementRate to Decimal(7,2) max (99999.99) so
+ // upsert never throws "numeric field overflow"; values > 100 set
+ // engagement_outlier=true flag for downstream analysis (view-based
+ // proxy KOL on YT/X with low followers commonly produce >100% values
+ // which are noise per BL-061 fork §3.3).
+ const engagementRate =
+   rawEngagementRate == null
+     ? null
+     : Math.min(rawEngagementRate, 99999.99);
+ const engagementOutlier =
+   rawEngagementRate != null && rawEngagementRate > 100;
```

2. raw output 加 `engagement_outlier` 字段（KolSyncAdapterOutput type）：

```ts
return {
  ...
  engagement_rate: engagementRate,
  engagement_outlier: engagementOutlier,   // BL-076-F002 新加
  scrapedAt: now(),
};
```

3. `src/lib/kol-sync/types.ts` interface 加 `engagement_outlier?: boolean` 字段

4. `src/lib/kol-sync/import.ts` mapToUpsertPayload 把 `engagement_outlier` 写入 `metadata.flags`:

```ts
const flags = {
  ...verdict.flags,
  engagement_outlier: raw.engagement_outlier ?? false,
};
```

5. 单测 `src/lib/kol-sync/adapters/__tests__/apify-kol.test.ts` ≥3 case:
   - rawRate 5.5 → engagementRate=5.5, outlier=false
   - rawRate 150 → engagementRate=150, outlier=true
   - rawRate 1,000,000 → engagementRate=99999.99 (clamped), outlier=true

**Acceptance：**
- [ ] adapter 计算后 Math.min clamp 99999.99
- [ ] >100 rawRate 设 engagement_outlier=true
- [ ] adapter output type 含 engagement_outlier 字段
- [ ] import.ts mapToUpsertPayload 写入 metadata.flags
- [ ] 单测 ≥3 case PASS
- [ ] L1 PASS (lint + tsc + vitest)

---

### F003: import.ts per-KOL try/catch + audit_log kol.import_failed

**Why：** 任何 future numeric / validation 错误不应让整 batch fail（健壮性兜底）。每次 fail 写 audit_log 可追溯。

**What：**

1. `src/lib/kol-sync/import.ts` 在 `await prisma.kol.upsert(...)` 包 try/catch:

```ts
try {
  await prisma.kol.upsert({
    where: { tenantId_platform_externalId: { ... } },
    create: { ... },
    update: data,
  });
  if (existing) stats.updated += 1;
  else stats.inserted += 1;
} catch (err) {
  // BL-076-F003: per-KOL try/catch so single bad row doesn't fail the
  // whole batch. Write audit_log for forensic + bump stats.failed.
  stats.failed = (stats.failed ?? 0) + 1;
  const errMessage = err instanceof Error ? err.message : String(err);
  console.error(
    `[kol-sync/import] upsert failed for ${payload.platform}/${payload.externalId}:`,
    errMessage,
  );
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: opts.tenantId,
        action: "kol.import_failed",
        resourceType: "kol",
        resourceId: null,
        payload: {
          platform: payload.platform,
          externalId: payload.externalId,
          displayName: payload.displayName,
          followerCount: payload.followerCount,
          engagementRate: payload.engagementRate,
          error: errMessage.slice(0, 500),  // truncate
        } as Prisma.InputJsonValue,
      },
    });
  } catch (auditErr) {
    // audit log itself failing is non-fatal — don't recurse
    console.error("[kol-sync/import] audit_log write also failed:", auditErr);
  }
}
```

2. `import.ts` ImportStats 加 `failed: number` 字段；初始 0

3. `scripts/kol-sync-daily.ts` 在最终 stats 报告里包含 `failed=<N>`，alerts 含 `failed>0`

4. 单测 ≥3 case:
   - upsert 抛错 → stats.failed=1, audit_log 写一次
   - upsert 成功 → stats.failed=0, audit_log 不写
   - audit_log 写入也失败 → 不抛，仅 console.error

**Acceptance：**
- [ ] import.ts upsert 包 try/catch
- [ ] stats.failed 字段加 + 累加
- [ ] audit_log kol.import_failed 写入（含 platform/externalId/displayName/error）
- [ ] daily-sync 报告含 failed count + alerts
- [ ] 单测 ≥3 case PASS

---

### F004: 14 天遗漏 KOL backfill（SSH prod 跑一次 discover-import）

**Why：** F001-F003 修后下一次 daily-sync 会自动 sync 当天 apify-kol 返回。但 5/12-5/27 14 天遗漏的 KOL 不一定还在 apify-kol 当前返回内（apify-kol 可能 shift window）。一次性跑全量 discover-import 追回。

**What：**

1. SSH prod 跑：
```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix && npm run kol-sync:daily 2>&1 | tail -40'
```

2. 验证报告 stats: `inserted > 0`（有新 KOL 进入）+ `failed = 0`（无 numeric overflow）

3. 如 inserted 数远小于 14 天预期遗漏（如 < 200）说明 apify-kol 已 shift window，遗漏 KOL 永久丢失，记 audit doc。

4. 抽样 10-15 个新 KOL（latest_synced_at > BL-076 deploy time）人工 review 数据完整性

5. 写 `docs/test-reports/BL-076-backfill-2026-05-27.md` 报告

**Acceptance：**
- [ ] SSH prod 跑 daily-sync 成功（report level != WARN/ERROR）
- [ ] stats.inserted >= 1（至少有 KOL 进入）
- [ ] stats.failed = 0（修复生效）
- [ ] 抽样 10-15 新 KOL 数据完整性 review
- [ ] audit doc 报告 written

---

### F005: Reviewer L1+L2 + signoff（executor:codex）

**L1 自动化：**
1. `npm run lint` PASS
2. `npx tsc --noEmit` PASS
3. `npm test` PASS（含 F002 + F003 新单测）
4. `npx prisma migrate status` PASS（migration 已 applied）
5. Prisma schema engagementRate Decimal(7,2) 确认

**L2 staging 抽样实测：**
1. staging 跑 `npm run kol-sync:daily`，验 stats.inserted > 0 + stats.failed = 0
2. SSH prod 跑 daily-sync 同上验证
3. prod KOL 表查 engagement_rate > 999.99 的存在（验 schema 扩容生效）
4. prod 查 metadata.flags.engagement_outlier = true 的 KOL（验 outlier flag 写入）
5. prod audit_log 查 kol.import_failed 记录（如有，确认 try/catch 路径起效）
6. SQL 验：`SELECT count(*) FROM kol WHERE created_at > '2026-05-27' AND last_synced_at > '2026-05-27'` 看新 KOL 数

**Acceptance（signoff doc）：**
- [ ] L1 5 项 / L2 6 项全 PASS
- [ ] 0 numeric overflow error in next 24h kol-sync log
- [ ] signoff doc `docs/test-reports/BL-076-signoff-2026-05-27.md`

---

## §5 风险 / 应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| Schema migration ALTER TYPE 锁表过长 | 低 | 中 | ALTER COLUMN TYPE Decimal(5,2)→Decimal(7,2) 在 PG 中是 metadata-only 改变，秒级完成 |
| Migration 在 staging 跑后 client 不重生 | 低 | 高 | F001 acceptance 含 `npx prisma generate`；deploy-staging.sh 已含 generate 步骤 |
| Backfill 跑后 inserted 仍 0（apify-kol shift window 严重）| 中 | 低 | audit doc 记录，后续考虑 fork 上游全量 export 协作 |
| outlier flag 在 UI 未使用造成 dead code | 低 | 低 | 短期不要求 UI 接入，仅作为 metadata flag 备用；F005 acceptance 验数据库存在即可 |
| Per-KOL try/catch 掩盖 future bug 不易察觉 | 中 | 中 | stats.failed > 0 触发 alerts；audit_log kol.import_failed 提供 forensic |
| migration rollback 触发 numeric overflow（数据已 > 999.99） | 中 | 中 | ROLLBACK SQL 注释含警告 "先 UPDATE clamp 再 ALTER" |

---

## §6 Done Definition

- [ ] F001-F005 全 acceptance PASS
- [ ] Reviewer L1+L2 全 PASS（signoff doc 终签）
- [ ] progress.json status = done
- [ ] prod daily-sync 24h 后无 numeric overflow error
- [ ] backlog.json BL-076 entry 移除
- [ ] .auto-memory/project-status.md BL-076 DONE marker

---

## §7 沉淀候选（done 阶段或 v0.9.24 batch）

1. **prod log alerting**（BL-072 沉淀候选 #4 配套）— 14 天 daily-sync 全 fail 未触发任何告警，反映 prod log alerting 缺失
2. **per-KOL try/catch 模板**（batch insert 健壮性）— for-loop 中单元素 fail 不阻塞 batch 的标准模式
3. **Schema migration ROLLBACK 含先 clamp 后 ALTER 警告**（BL-070 #22 模板扩展）
4. **adapter output schema 与 DB 列 type 边界 check 模板**（adapter 拿到 raw 数值后 clamp/sanity check / outlier flag 三件套）

---

## §8 后续

- v0.9.24 framework sediment batch（13 + 4 BL-076 新 = 17 条积压）— 优先级提升
- BL-076 done 后用户 dogfood，看 prod 是否还有其他 sync 链路问题

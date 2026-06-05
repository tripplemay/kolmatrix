# BL-083 YT business email mapper 接 + UI 显示 + outreach 优先 Spec

> **Sprint：** BL-083-yt-business-email-mapper
> **Type：** KOL data 治理（mapper gap 补齐 + UI 显示 + outreach 优先级）
> **预估工时：** ~1-2 day Generator + 1.5h Reviewer
> **关联：** fork 端 `docs/specs/2026-05-08-yt-business-email-via-apify-design.md` (5/8 已 ship + 复盘) / KOLMatrix `src/lib/kol-sync/adapters/apify-kol.ts` mapper / `src/lib/kol-sync/types.ts`
> **状态：** A0 audit done 6/04 / A1 lock 6/04 → 待 building (用户审 spec 后切)
> **依赖：** BL-082 done (已满足 @ bl082-done tag 6/05) + fork 端 `APIFY_API_TOKEN` 已配 (6/05 ops done)

---

## §1 背景与触发

### 1.1 触发 + audit 实证

2026-06-04 用户 BL-082 building 期间分享 fork 端 `2026-05-08-yt-business-email-via-apify-design.md`。Planner audit prod 发现严重 mapper gap：

| 维度 | 数量 | 占比 |
|---|---:|---:|
| YT KOL 总数 | 722 | 100% |
| `hasBusinessEmail=true` (fork 标记需解锁) | 497 | 69% |
| `metadata.raw.emails[]` 非空 (fork 已通过 Apify actor 解锁) | **219** | **30%** |
| `kol.email` 字段 (KOLMatrix 主字段实际存的) | 6 | 0.8% |

**抽样实例 (fork 已解锁, KOLMatrix 用不到)：**
- `gamertechtoronto@gmail.com`
- `itzyblack888ink@gmail.com`
- `Chandler@badmoontalent.com`

### 1.2 根因 (mapper gap)

| # | 文件:行 | bug | 严重度 |
|---|---|---|---|
| **R1** | `src/lib/kol-sync/adapters/apify-kol.ts` mapper | 完全没接 fork `emails` 字段 → 219 个真实 business email 全在 metadata.raw 但业务逻辑读不到 | 🔴 P0 |
| **R2** | `src/lib/kol-sync/types.ts` `RawKolData` | 无 emails 字段类型定义 | 🔴 配套 |
| **R3** | `kol.email` Prisma 字段 | VARCHAR(320) 单字段，无法存 array (fork 返 `emails: string[]`) | 🟡 需 schema 扩展 |
| **R4** | `kol` 表 | 无 `email_source` 字段区分 bio-regex / business-unlock 来源 | 🟡 需 schema 扩展 |

### 1.3 A1 决策 lock (6/04)

| 决策 | Lock |
|---|---|
| **路径** | A 轻量 KOLMatrix-only — mapper 接 + UI 显示 + outreach 优先 + email_source 字段区分 |
| **不走 B (主动 trigger)** | fork 端 post-processing 已自动入队，剩 278 个未解锁多半是 actor status=NO_EMAIL (YT 后台没配)。手动按钮对此无效。如未来 marketer 真反馈"我想立即解某 KOL email"再开 B 批次 |
| **multi-email 存储** | `kol.emails JSONB` 数组列（单 KOL 多 email 极少，JSONB 简单胜过关联表）|
| **email_source 字段** | `VARCHAR(20)` 含 `bio-regex` / `business-unlock` / `manual` 三个值 |
| **primary email** | `kol.email` 字段保持兼容（取 emails[0] 或专门 primary 字段），UI 不破现有 outreach 引用 |
| **fork 依赖** | fork 端 `APIFY_API_TOKEN` 6/05 已配 + dry-run /v2/users/me 200 验证，fork yt-email worker 持续 auto-unlock 不需 KOLMatrix 主动 |

### 1.4 角色分配

`role_assignments = null` (默认映射: Generator + Codex Reviewer)

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- **F001** mapper 接 fork `emails` 字段：`RawKolData` types 加 `emails?: string[] | null`，`apify-kol.ts` mapper 映射 `item.emails`，单测 ≥4 case
- **F002** Schema migration：`kol` 表加 `emails JSONB` (array) + `email_source VARCHAR(20)` + ROLLBACK SQL
- **F003** import.ts upsert 路径：写 emails array + email_source；primary email (kol.email) 兼容现 outreach 引用（取 emails[0] 或保留现 kol.email + 加 emails 并存）
- **F004** UI /kol/[id] detail + /discovery + /database：显示所有 emails + source chip ('已通过 YouTube business email 解锁' / 'bio 中提取')；filter 加 `has-business-email` chip
- **F005** outreach pipeline 优先级：composer 选 KOL 时如有 `business-unlock` source 优先用之；如仅 `bio-regex` 在 tooltip 警告"该 email 来自 bio 文本提取，请二次确认"
- **F006** prod backfill 脚本：一次性把 219 个 metadata.raw.emails 拍到 kol.emails + email_source='business-unlock'；幂等
- **F007** Codex Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE

- B 路径"主动 trigger 按钮" (用户决定不做)
- TT / IG business email (fork 端无对应 actor，TikHub `get_channel_email` 已下架)
- email 验证 (deliverability 检查，NeverBounce / ZeroBounce 等第三方 API) — 留独立批次
- email 与 KOL 多对一去重 (跨 KOL 同 email 检测) — 留独立批次
- fork 端任何代码 (跨团队，5/8 已 ship 自动跑)

### 2.3 不变量

1. **不破坏现有 6 个 kol.email 字段值** — backfill 仅填 NULL kol.emails 行，不覆盖已有 kol.email
2. **不破坏现有 outreach 路径** — 现有引用 kol.email 单字段的代码不动；新加 kol.emails array 共存
3. **mapper 接 emails 字段时遇 fork 返非法值 (非 array / 含 non-string)** — fallback null + log warn 不阻塞 batch
4. **email_source 默认值** — 现有 6 个 kol.email 行 backfill 时全标 `bio-regex` (保守假设来自 BL-031 bio 提取)，新 mapper 写入时按 fork emails 来源标 `business-unlock`
5. **migration 必带 ROLLBACK SQL** (per v0.9.22 #22 BL-070 沉淀)
6. **0 业务路径破坏**: discovery / smart-match / weekly-report / outreach composer 等下游对 kol.email 字段读取语义不变

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Audit (prod SQL 数据分布 + fork 文档 + mapper 源码) | ✅ done 6/04 |
| **A1** | 1 子决策 lock (A 路径 + JSONB + email_source 字段) | ✅ done 6/04 |
| **B** | F001 mapper + types + 单测 | 1.5h | Generator |
| **C** | F002 Schema migration + index | 1h | Generator |
| **D** | F003 import.ts upsert | 1.5h | Generator |
| **E** | F004 UI 3 页 + filter chip | 3h | Generator |
| **F** | F005 outreach composer 优先级 + tooltip | 2h | Generator |
| **G** | F006 prod backfill script + 219 row backfill | 1.5h | Generator |
| **H** | F007 Reviewer L1+L2 + signoff | 1.5h | Codex |

**Critical path：** B→C→D→E+F (并行可) → G → H

---

## §4 验收门槛 (5 dimensions)

### 4.1 功能正确性

- F001 mapper 单测 ≥4 case：(1) fork emails ['a@b.com'] → kol.emails=['a@b.com'] + email='a@b.com' (2) fork emails 多个 → kol.emails 全保留 + email=primary (3) fork emails 不存在 → fallback null (4) fork emails 含非 string → fallback null + warn log
- F002 migration apply 后 `\d kol` 显 `emails JSONB` + `email_source VARCHAR(20)` 列
- F003 import.ts upsert 抽样测：mapper 给的 emails array + email_source='business-unlock' 正确写入 DB
- F004 UI /kol/[id] 抽样验：有 emails 的 KOL 显示 chips；空时显示"暂无 email" placeholder
- F005 outreach composer 选 KOL 时 business-unlock email 高亮 / bio-regex email 灰显 + tooltip 警告
- F006 prod backfill 后 219 行 kol.emails 非空 + email_source='business-unlock'，幂等

### 4.2 量化提升

- prod kol.email 字段填充率 0.8% → kol.emails 字段填充率 **30%+** (219+ 行)
- outreach 投递准确率提升 (期望 business-unlock email 比 bio-regex 准确度高 3-5 倍)
- 后续 fork 持续 auto-unlock，KOLMatrix mapper 持续接收（无需再 backfill）

### 4.3 数据完整性

- backfill 不覆盖现有 6 个 kol.email (虽全 bio-regex 但保守不动)
- multi-email 抽样 ≥3 KOL 验 array 完整 (顺序保持 fork 返回)
- email_source 抽样 ≥5 KOL 全部 'business-unlock' (backfill 来源单一)

### 4.4 ops 安全

- migration ROLLBACK SQL 可单独跑 (DROP INDEX + DROP COLUMN)
- backfill script dry-run 模式不写 DB
- backfill 幂等：WHERE kol.emails IS NULL，重跑只补未填行

### 4.5 framework / 文档

- `framework_reviewed` 由 F007 done 收尾决定
- `docs/dev/kol-sync-runbook.md` 加 §"YT business email mapper" 段说明
- 弱 ADR-worthy：multi-email 存储 + email_source 来源标记选择可记 ADR-XXX（影响窄，仅 KOL 表，可缓）

---

## §5 风险与已知边界

| 风险 | 缓解 |
|---|---|
| **fork 端 emails 字段格式变化** | mapper try/catch + zod schema validation；非法时 fallback null + audit_log |
| **现有 outreach 引用 kol.email 单字段被破** | F003 保留 kol.email + 加 kol.emails 并存；逐步迁移引用 |
| **JSONB array 性能** | YT KOL 总 722 + 平均每 KOL 1-2 email，JSONB 性能足；如未来 100K+ 再考虑关联表 |
| **email_source 后续扩展需求 (如 'verified' / 'unverified')** | VARCHAR(20) 留空间；未来加新 enum 值兼容 |
| **TT/IG 无 business email actor** | spec 明确 out-of-scope；如未来 fork 加新 actor，mapper 现有逻辑可复用 |

---

## §6 完成定义 (DoD)

- [ ] F001-F006 全 PASS (features.json acceptance)
- [ ] F007 Reviewer signoff `docs/test-reports/BL-083-signoff-2026-06-XX.md` 含 L1/L2 实测
- [ ] prod backfill 后 SQL 抽样：kol.emails 填充率 ≥30% (219 行)
- [ ] 6 个现有 kol.email 字段 0 影响
- [ ] outreach composer UI 实测 business-unlock 优先级正确
- [ ] commit message 含 `feat(BL-083-F00X):` 标签对应 features.json
- [ ] `docs/dev/kol-sync-runbook.md` 更新

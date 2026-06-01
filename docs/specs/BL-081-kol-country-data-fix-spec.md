# BL-081 KOL country mapper bug + retry storm 修复 Spec

> **Sprint：** BL-081-kol-country-data-fix
> **Type：** Data pipeline P1 fix（mapper bug + silent retry storm）
> **预估工时：** ~10h Generator + 1.5h Reviewer
> **关联：** BL-075-F002 `kol-country-enrichment` Action / `src/lib/kol-sync/adapters/apify-kol.ts:438` / `src/lib/kol-sync/enrichment-stage.ts:283-307`
> **状态：** A0 audit done → A1 lock → 待 building（等用户审 spec）
> **依赖：** BL-080 paused（已归档到 `docs/archive/paused-batches/`），无功能依赖

---

## §1 背景与触发

### 1.1 触发

2026-06-01 用户问 "5/27 起每天均匀调用 aigcgateway 500 多次在做什么" → Planner Kimi 5 维 audit:

| 维度 | 实证 |
|---|---|
| **aigcgateway 流量** | 5/27-6/01 daily 503-510 calls, 100% 为 `kol-country-enrichment` Action, 100% claude-haiku-4.5, 0 error |
| **5/26 一次性 backfill** | 2276 calls / $2.56 / 触发于 `scripts/kol-enrichment-backfill.ts` 13.3h 跑完 |
| **prod KOL 池** | 1 tenant, 2146 active KOL; 仅 90 (4%) 有 country, 2081 (97%) 每日 cron 命中 WHERE |
| **LLM 真填 country** | daily ~80-95 个 (LLM 命中率 16%); 1000+ 个返 null 不写 DB → 下次 cron 又调 |
| **真新 KOL 入库** | 5/27-6/01 共 749 个 (~107/天), 远低于 500/天 LLM 流量 |
| **5/27 + 5/31 0-discover** | fork apify-kol-service 端 discoverCount 同昨日, 0 增量 (跨团队问题) |

### 1.2 根因（已定位 4 处）

| # | 文件:行 | bug | 严重度 |
|---|---|---|---|
| **R1** | `src/lib/kol-sync/adapters/apify-kol.ts:438` | mapper 硬编码 `country: null`，丢弃 fork 端 `location` 字段（YouTube 596/716 = 83% 有真值，TT/IG 0 但 fork 字段确实存在）| 🔴 P0 |
| **R2** | `src/lib/kol-sync/adapters/apify-kol.ts:361` | 注释 `"fork doesn't expose these; reserved for future enrichment"` 已过时且错误，需更正 | 🟡 文档债 |
| **R3** | `src/lib/kol-sync/enrichment-stage.ts:283-307` | WHERE 仅按 `country_code IS NULL OR language IS NULL` 过滤，无 "已尝试 give up" 标记位 → LLM 返 null 时 `result.country=null` → 不写 DB → 下次再扫 → silent retry storm | 🔴 P0 |
| **R4** | `scripts/kol-sync-daily.ts` (?) `refresh=0` 7 天稳定 0 | refresh-selector 完全没工作（独立路径，需调查根因 — 可能 selector bug / fork 不支持 refresh endpoint / cursor stale）| 🟡 P1 调查 |

### 1.3 A1 用户 5-6/01 lock（3 子决策）

| 决策 | Lock |
|---|---|
| **范围** | **P0 + refresh-selector 调查** — 5 features：mapper fix + attempted_at 列 + enrichment-stage 改造 + refresh 调查 report + Reviewer。不一并做 fork 端 5/27+5/31 0-discover 对账（跨团队，留待后续 user 找爬虫团队） |
| **Normalize 策略** | **i18n-iso-countries lib** — npm 包，350+ 国家含 ISO 3166-1 + 多语言别名（Türkiye/Turkey 等已覆盖），+1 dep 治本 |
| **TT/IG 无 location 怎么办** | **继续 LLM + retry 上限**（attempted_at 一次性，不再 silent retry）。LLM 命中率虽仅 16%，但 1419 KOL (66%) 只跑一次，成本 ≤$1.2 一次性 |

### 1.4 角色分配

`role_assignments = null`（默认映射：Generator + Codex Reviewer）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- **F001** mapper 接 fork `location` 字段 + i18n-iso-countries normalize + 单测 ≥6 case
- **F002** Schema migration: `kol` 表加 `country_enrichment_attempted_at TIMESTAMPTZ` 列 + (tenant_id, country_enrichment_attempted_at) 复合索引
- **F003** `enrichment-stage.ts` WHERE 改造：排除已 attempted 的 KOL，每次 LLM call (无论成功/null) 都更新 `country_enrichment_attempted_at = NOW()`
- **F004** `daily-sync` `refresh=0` 调查 + report (独立投入，仅产 report 不实装 fix；report 入 `docs/audits/BL-081-refresh-selector-audit.md`)
- **F005** staging + prod 验证：staging 跑 enrichment-stage 量化 LLM call 降幅；prod 跑一次 backfill 给所有现存 2081 KOL 写 attempted_at（确保 silent retry stop）
- **F006** Codex Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE

- fork apify-kol-service 端 5/27+5/31 0-discover 根因排查（跨团队，用户找爬虫团队）
- refresh-selector 实装 fix（仅 audit 产 report，根因清晰后单独批次）
- KOL country 之外的 enrichment 字段补全（language 走 franc 已稳定 / brand_safety / monetization_status 等）
- `i18n-iso-countries` 升级到更复杂 country normalize lib (per-locale, fuzzy match 等)
- LLM 切换更便宜模型（haiku 4.5 单 call $0.0009 已极便宜）

### 2.3 不变量

1. **不破坏现有 90 KOL 已有 country_code**（migration ADD COLUMN 安全，append-only 字段）
2. **mapper 接 location 字段后，遇 fork 返回 unknown country name 时 fallback null**，不报错不阻塞 sync
3. **attempted_at 写入是幂等的**：每次 enrich attempt（无论成功/null）都更新；下次 cron 若 KOL `bio` / `audience_geo_dist` 字段变化（说明信号变了）需要 reset attempted_at 触发重试 — 此条 F003 acceptance 必含逻辑
4. **migration 必带 ROLLBACK SQL** + index ROLLBACK
5. **F005 backfill 不调 LLM**（只写 attempted_at = NOW()，目的是阻止后续 daily retry，省钱）
6. **0 业务路径破坏**：discovery / smart-match / database 等下游依赖 `country_code` 字段，确保只新增数据不删 / 改语义

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Audit aigcgateway log + prod DB + mapper code + daily-sync log | ✅ done |
| **A1** | 3 子决策 lock | ✅ done |
| **B** | F001 mapper 接 location + normalize lib + 单测 | 2.5h | Generator |
| **C** | F002 Schema migration + index | 1h | Generator |
| **D** | F003 enrichment-stage WHERE + attempted_at 更新逻辑 | 2.5h | Generator |
| **E** | F004 refresh-selector audit report (独立, 仅查不修) | 2h | Generator |
| **F** | F005 staging 量化 + prod backfill 写 attempted_at | 2h | Generator |
| **G** | F006 Reviewer L1+L2 + signoff | 1.5h | Codex |

**Critical path：** B → C → D → F → G（E 与 B-D 并行可行，不阻塞主路径）

---

## §4 验收门槛（5 dimensions）

### 4.1 功能正确性

- F001 mapper 单测 ≥6 case：(1) US 正常映射 (2) "United States" 映射 (3) Türkiye 映射 TR (4) "Mars" 等未知 fallback null (5) location 字段缺失 fallback null (6) location 是空字符串 fallback null
- F002 migration apply 后 `\d kol` 显 `country_enrichment_attempted_at` 字段 + index `kol_tenant_id_country_enrichment_attempted_at_idx`
- F003 daily cron 单 run 抽样测：(1) 已 attempted 的 KOL 不进 LLM (2) 未 attempted 的 KOL 进 LLM 后写 attempted_at (3) attempted_at 写入失败时事务 rollback 不留半成品

### 4.2 量化降幅

- **预期：** daily LLM call 从 500/天 → 100-150/天（YT mapper 直接获取 596 个 country = 5/天 维度全消失；TT/IG 在 attempted_at backfill 后 LLM 也只一次性 / 不再 silent retry）
- **F005 验收：** staging 跑 enrichment-stage 7 天后实测 daily LLM call <200，prod 跑 backfill 后 next 24h 实测 LLM call <200

### 4.3 成本影响

- 当前：$0.44/天 ≈ $13/月 ≈ $160/年
- 治本后：$0.10/天 ≈ $3/月 ≈ $36/年
- 一次性 backfill 写 attempted_at：~$0（不调 LLM 只更新 DB）
- 长期：KOL 池子上 10K 后省 ~$300-3000/年（无 silent retry storm）

### 4.4 数据完整性

- migration 不丢现有 90 个 country_code（ADD COLUMN 安全）
- prod backfill 不覆盖现有 country_code（attempted_at 字段独立，与 country_code 写入路径分离）
- 下游 discovery / smart-match / database 抽样：country filter 仍按现行规则工作

### 4.5 framework / 文档

- `docs/audits/BL-081-refresh-selector-audit.md` 产 root cause + 修复建议（独立批次落地）
- `src/lib/kol-sync/adapters/apify-kol.ts:361` 注释修正
- `.auto-memory/project-status.md` 覆盖更新
- 若发现 mapper bug 跨 ≥2 平台 / 影响 ≥3 字段，触发 ADR-XXX `KOL data enrichment 责任划分`（fork vs mapper vs LLM 各自承担字段表）

---

## §5 风险与已知边界

| 风险 | 缓解 |
|---|---|
| **i18n-iso-countries 误码** | 单测覆盖 top 30 国家手动核对；遇未识别 fallback null 不阻塞 |
| **fork 端 location 字段不稳定（未来变 null/格式变）** | mapper 加 try/catch，单 KOL fail 不阻塞 batch；audit_log 记不可识别 location |
| **prod backfill 阻塞 daily sync** | F005 backfill 跑在独立 script 不走 daily cron，避免与 cron 冲突 |
| **migration 期间 daily sync 跑** | migration 选凌晨低峰 (BJ 03:00, daily cron 08:30 之前) |
| **TT/IG attempted_at 后业务方有需求加 country 怎么办** | 后续手动跑 backfill script 重置 attempted_at = NULL 触发重试（runbook 文档化） |

---

## §6 完成定义（DoD）

- [ ] F001-F005 全 PASS（features.json acceptance）
- [ ] F006 Reviewer signoff `docs/test-reports/BL-081-signoff-2026-06-XX.md` 含 L1/L2 实测
- [ ] LLM call 实测 <200/天（prod backfill 后 next 24h）
- [ ] 90 个现有 country 数据 0 影响
- [ ] refresh-selector audit report 入 `docs/audits/`
- [ ] `.auto-memory/project-status.md` 更新批次状态
- [ ] commit message 含 `feat(BL-081-F00X):` 标签对应 features.json

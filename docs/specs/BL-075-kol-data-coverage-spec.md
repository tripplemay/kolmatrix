# BL-075 KOL Data Coverage — country/language 字段 NULL 填充 Spec

> **Sprint：** BL-075-kol-data-coverage
> **Type：** Data infra（KOL 数据完整性治理，BL-062 起 batch）— enrichment lib + LLM Action + backfill + daily sync 集成 + UI filter 启用 + health metric
> **预估工时：** ~14h ≈ 2 day Generator + 0.5 day Reviewer
> **关联：** docs/test-reports/BL-073-prod-hotfix-audit-2026-05-26.md §3.1（prod KOL 数据 audit 实测）
> **状态：** A0+A1 完成 → 待 building
> **依赖：** BL-073 done（filter UX disable 已落，本批撤回）+ BL-074 不冲突可并行
> **关联：** BL-062 closed-merged-into-BL-075

---

## §1 背景与触发

### 1.1 触发

BL-073 issue #4B SSH prod audit 暴露：prod 1385 个 active gaming KOL 的 `country_code` + `language` 字段**全部 NULL/空**。用户在 /match filter 选 country 或 language → 永远命中 0 行 → 误为 "search broken"。

BL-073-F006 已短期处理（UI disable + early-return），但**长期根治需填充字段**。这正是 BL-062 backlog "KOL data coverage gap 治理" 早识别（5/8 起就在）但一直没起 batch 的问题。

### 1.2 现状 audit（5/26 SSH 实测）

| 字段 | 当前 |
|---|---|
| KOL total active gaming | 1397（含 12 demo_seed）|
| **country_code 非空** | **0 / 1397 = 0%** |
| **language 非空** | **0 / 1397 = 0%** |
| bio 非空 | 568 / 1397 = **40.6%** ← 可用于推断 |
| audience_geo_dist 非空 | 12 / 1397 = **0.9%** ← top-1 直取，但稀疏 |
| display_name | 100% 有 |
| categories | 100% Gaming/Esports |

**bio 样本质量：** 多为 1-3 行英文/意大利/葡萄牙/日文等多语种文本，含 brand 线索（NFL/NBA → US，IDN Times → ID 印尼）。LLM 推断 country 可行但准确性中等（50-70%）。

### 1.3 A1 用户 5/26 lock（4 项子决策）

| 决策 | Lock |
|---|---|
| **Enrichment 方法** | A: **混合** — langdetect npm 做 language（0 LLM 成本）+ LLM (Claude Haiku via aigcgateway) 做 country |
| **准确性 / 覆盖率** | A: **Best-effort**（不设硬阈，抽样 20-30 KOL 人工 review 记录实际 accuracy + fill_rate）|
| **Backfill 范围** | A: **一次性 backfill 1397 全量** + 后续 daily sync 增量 + **立刻撤 BL-073-F006 UI disable** 启用 filter |
| **Job 集成** | A: **合入 kol-sync-daily.ts** 加 enrichment 阶段 + audit_log + daily fill_rate report 写 kpi_daily_snapshot |

### 1.4 角色分配

role_assignments = null（默认映射）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- F001 enrichment lib（langdetect + LLM helper）+ 单测
- F002 aigcgateway 创 `kol-country-enrichment` Action + env var 落 prod/staging
- F003 kol-sync-daily.ts 加 enrichment 阶段（含 audit_log）
- F004 scripts/kol-enrichment-backfill.ts + 跑一次 1397 KOL 全量
- F005 UI filter 启用（撤 BL-073-F006 disable + getDataCoverage 提示保留）
- F006 /api/health fill_rate 指标 + kpi_daily_snapshot 写入
- F007 Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE（明示）

- apify-kol fork 源头同步（方向 D，跨团队协作长周期，本批次不做）
- 历史数据 backfill 之外的字段（仅 country/language，不动 audience_age_dist / monetization_status 等其他 NULL 字段）
- BL-062 完整范围（如 engagement_rate non_null_pct 长期 ≥ 80%/95%，本批次仅做 country/language 子集）
- 准确性 hard threshold 验证（A1 lock A best-effort，不做硬阈拦截）
- LLM enrichment 在用户实时操作中触发（不集成到 KOL upsert/create 路径，仅 daily sync + backfill）

### 2.3 不变量

1. **0 业务逻辑改动**（除 UI filter 启用是撤 BL-073-F006 disable，恢复原状）
2. **LLM 成本控制**：一次性 backfill ~$0.5-1（Claude Haiku 1397 × ~100 tokens），日增量 $0.001/day
3. **audit_log 必写**：每 KOL enrichment 必有 `audit_log` 记录 `before/after/confidence`
4. **fill_rate 必写 kpi_daily_snapshot**：daily sync 后写当天 country/language fill_rate
5. **prompt 不硬编码**：country 推断 prompt 在 aigcgateway Action 内，KOLMatrix 仅引 Action ID（per ADR-009）
6. **langdetect 不依赖 LLM**：language 推断纯本地 npm pkg，零成本零网络
7. **filter UX 启用前必先 backfill**：F005 必须在 F004 后做，避免 UI 开启但数据仍 NULL

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Audit (BL-073 §3.1) + SSH 实测 1397 KOL 推断材料分布 | ✅ done |
| **A1** | 4 子决策 lock | ✅ done |
| **B** | F001 enrichment lib + F002 aigcgateway Action | 4h | Generator |
| **C** | F003 daily sync 集成 + F004 backfill script + 跑 1397 KOL | 4h | Generator |
| **D** | F005 UI filter 启用 + F006 health metric | 1.5h | Generator |
| **E** | F007 Reviewer L1+L2 + signoff | 2h | Codex |

**总：** ~11.5h ≈ 2 day Generator + 0.5 day Reviewer

---

## §4 Features 详细描述

### F001: enrichment lib (langdetect npm + LLM country helper) + 单测

**Why：** 中央 lib 提供 `enrichKol(input): Promise<KolEnrichmentResult>`，供 F003/F004 复用。

**What：**

1. 新建 `src/lib/kol/enrichment.ts`：

```ts
import { detect } from "langdetect";    // 或 franc
import { runAigcAction } from "@/lib/aigc/run-action";

export interface KolEnrichmentInput {
  bio?: string | null;
  displayName: string;
  handle: string;
  audienceGeoDist?: Record<string, number> | null;
  platform: string;
  categories?: string[];
}

export interface KolEnrichmentResult {
  language: string | null;             // ISO 639-1 (e.g. "en", "ja")
  country: string | null;              // ISO 3166-1 alpha-2 (e.g. "US", "JP")
  languageConfidence: number;          // 0-1
  countryConfidence: number;           // 0-1
  source: {
    language: "langdetect" | "fallback-en";
    country: "audience-geo-top1" | "llm" | "fallback-null";
  };
}

export async function enrichKol(input: KolEnrichmentInput): Promise<KolEnrichmentResult> {
  // 1. Language: langdetect on (bio + displayName + handle) concat
  const langText = [input.bio, input.displayName, input.handle].filter(Boolean).join(" ");
  let language: string | null = null;
  let languageConfidence = 0;
  let langSource: KolEnrichmentResult["source"]["language"] = "fallback-en";
  if (langText.length > 5) {
    const detected = detect(langText);
    if (detected && detected[0]?.prob > 0.5) {
      language = detected[0].lang;
      languageConfidence = detected[0].prob;
      langSource = "langdetect";
    }
  }

  // 2. Country: audience_geo_dist top-1 优先, fallback LLM
  let country: string | null = null;
  let countryConfidence = 0;
  let countrySource: KolEnrichmentResult["source"]["country"] = "fallback-null";
  if (input.audienceGeoDist && Object.keys(input.audienceGeoDist).length > 0) {
    const sorted = Object.entries(input.audienceGeoDist)
      .filter(([k]) => k !== "Other")
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 40) {  // top-1 >= 40% 才采纳
      country = sorted[0][0];
      countryConfidence = sorted[0][1] / 100;
      countrySource = "audience-geo-top1";
    }
  }
  if (!country) {
    // LLM fallback
    try {
      const actionId = process.env.AIGCGATEWAY_KOL_COUNTRY_ACTION_ID;
      if (!actionId) throw new Error("AIGCGATEWAY_KOL_COUNTRY_ACTION_ID not set");
      const llmResult = await runAigcAction(actionId, {
        bio: input.bio ?? "",
        display_name: input.displayName,
        platform: input.platform,
        audience_geo: JSON.stringify(input.audienceGeoDist ?? {}),
      });
      // 期望返回: { country: "US", confidence: 0.7 } 或 { country: null, confidence: 0 }
      if (llmResult.country && llmResult.confidence > 0.5) {
        country = llmResult.country;
        countryConfidence = llmResult.confidence;
        countrySource = "llm";
      }
    } catch (e) {
      // LLM failure → keep null
    }
  }

  return { language, country, languageConfidence, countryConfidence, source: { language: langSource, country: countrySource } };
}
```

2. 单元测试 `src/lib/kol/__tests__/enrichment.test.ts` ≥6 case：
   - 纯英文 bio → language=en
   - 日文 bio → language=ja
   - audience_geo_dist top-1=JP 60% → country=JP, source=audience-geo-top1
   - audience_geo_dist 空 + LLM mock 返 US → country=US, source=llm
   - 无任何材料 → country=null, source=fallback-null
   - LLM mock throw → country=null（不抛 error）

3. `package.json` 加 dependency `langdetect`（或 `franc`）

**Acceptance：**
- [ ] src/lib/kol/enrichment.ts 实现 enrichKol() 函数
- [ ] 单测 ≥6 case 全 PASS
- [ ] langdetect npm pkg 安装并使用
- [ ] LLM fallback 经 runAigcAction (via aigcgateway)
- [ ] LLM 失败 → 不 throw，country 返 null
- [ ] audience_geo_dist top-1 ≥40% 才采纳（避免 21% 低置信也算 country）

---

### F002: aigcgateway 创 kol-country-enrichment Action + env var

**Why：** ADR-009 lock：所有 AI 集成走 aigcgateway，prompt 不硬编码在 KOLMatrix 源码。

**What：**

1. 在 aigcgateway 控制台或通过 MCP `mcp__aigc-gateway__create_action` 创建：
   - name: `kol-country-enrichment`
   - description: "Infer KOL country (ISO 3166-1 alpha-2) from bio + audience geo + platform"
   - model: `claude-haiku-4.5`
   - prompt 模板：
     ```
     You are a KOL audience analyst. Given the following KOL information, infer their primary country of operation.
     
     bio: {{ bio }}
     display_name: {{ display_name }}
     platform: {{ platform }}
     audience_geo (JSON): {{ audience_geo }}
     
     Return JSON: { "country": "<ISO 3166-1 alpha-2 e.g. US, JP>" or null, "confidence": 0-1 number }
     If you cannot infer with confidence ≥0.5, return { "country": null, "confidence": 0 }.
     ```
   - variables: `bio`, `display_name`, `platform`, `audience_geo`
   - response_format: `{ type: "json_object" }`

2. 拿到 action_id（如 `cmXXXXXXX`）

3. SSH prod + staging 落 env var：
   ```
   AIGCGATEWAY_KOL_COUNTRY_ACTION_ID=cmXXXXXXX
   ```
   备份 `.env.{production,staging}.bl075-f002.YYYYMMDD-HHMMSS`，`pm2 reload --update-env`

4. 更新 `.auto-memory/environment.md` Actions 清单（per BL-067 / BL-068 / BL-069 模式）

**Acceptance：**
- [ ] aigcgateway 含 `kol-country-enrichment` Action，model claude-haiku-4.5
- [ ] action_id 落 prod + staging `.env`，备份文件存在
- [ ] pm2 reload --update-env 后 prod + staging health 200 healthy
- [ ] .auto-memory/environment.md Actions 清单更新（含 action_id + env var name + 预估单次成本）
- [ ] 单次 LLM 调用实测（手动 mcp__aigc-gateway__run_action）返 valid JSON {country, confidence}

---

### F003: kol-sync-daily.ts 加 enrichment 阶段

**Why：** daily sync 后新 KOL 自动 enriched，无 NULL 数据漏出。

**What：**

1. `scripts/kol-sync-daily.ts` 在 sync stage 后加 enrichment stage：

```ts
// 现有 sync stage 后
const newOrUnenrichedKols = await withTenant(tenantId, (tx) =>
  tx.kol.findMany({
    where: {
      deletedAt: null,
      OR: [
        { countryCode: null },
        { countryCode: "" },
        { language: null },
        { language: "" },
      ],
    },
    select: { id: true, bio: true, displayName: true, handle: true, audienceGeoDist: true, platform: true, categories: true },
  })
);

for (const kol of newOrUnenrichedKols) {
  const result = await enrichKol(kol);
  if (result.language || result.country) {
    await withTenant(tenantId, async (tx) => {
      const before = { language: null, country_code: null };  // 实际取 before
      await tx.kol.update({
        where: { id: kol.id },
        data: {
          ...(result.language && { language: result.language }),
          ...(result.country && { countryCode: result.country }),
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          action: "kol.enriched",
          resourceType: "kol",
          resourceId: kol.id,
          payload: { before, after: result, source: result.source },
        },
      });
    });
  }
}
```

2. 加 rate limit / concurrency（如 p-limit 5 个 LLM 调用并发）

3. 日志记 fill_rate + enrichment count

**Acceptance：**
- [ ] kol-sync-daily.ts 加 enrichment stage（含 audit_log 写入）
- [ ] 仅处理 NULL country_code 或 NULL language 的 KOL（避免重复 enrichment）
- [ ] 并发限制 5（避免 LLM rate limit）
- [ ] 日志记 enrichment count + LLM call count + LLM cost 估算
- [ ] 单元测试 mock LLM 验证集成（≥3 case）
- [ ] staging 跑一次 daily sync 实测有 enrichment 发生

---

### F004: scripts/kol-enrichment-backfill.ts + 跑 1397 KOL 全量

**Why：** 历史 1397 KOL 一次性补全，BL-073-F006 UI disable 才能撤。

**What：**

1. 新建 `scripts/kol-enrichment-backfill.ts`：

```bash
# 用法
npx tsx scripts/kol-enrichment-backfill.ts --dry-run   # 仅打印不写 DB
npx tsx scripts/kol-enrichment-backfill.ts             # 实跑
npx tsx scripts/kol-enrichment-backfill.ts --tenant=<uuid>  # 指定 tenant
```

复用 `enrichKol` 同 F003 逻辑，但批量跑：
- 拉全部 NULL country_code OR language KOL（用 withPlatformAdmin 跨 tenant）
- 每 KOL 调 enrichKol，更新 + audit_log
- 进度 print（每 100 个）
- 并发 5
- 最终报告：total / enriched / failed / fill_rate / LLM call count / cost

2. SSH prod 跑：
```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix && set -a; source .env.production; set +a; ./node_modules/.bin/tsx scripts/kol-enrichment-backfill.ts'
```

3. 抽样 20-30 KOL 人工 review accuracy（best-effort 不设硬阈，仅记录实际 accuracy）

4. 输出 audit doc `docs/test-reports/BL-075-backfill-2026-05-XX.md`

**Acceptance：**
- [ ] scripts/kol-enrichment-backfill.ts 实现 dry-run + 实跑模式
- [ ] dry-run 模式仅 print 不写 DB（可重复跑确认逻辑）
- [ ] 跑 1397 KOL 实跑完成（prod 跑）
- [ ] 报告: enriched count, language fill_rate, country fill_rate, LLM call count, cost
- [ ] 抽样 20-30 KOL 人工 review，记 accuracy（不设硬阈）
- [ ] audit doc `BL-075-backfill-<date>.md` 含报告 + 抽样

---

### F005: UI filter 启用 — 撤 BL-073-F006 disable + 提示保留

**Why：** 数据填充后，country/language filter 不应再 disable。但 fill_rate 不会 100%，应给用户"覆盖率提示"。

**What：**

1. `src/app/[locale]/(app)/match/MatchFilterSidebar.tsx`:
   - 撤 `aria-disabled / pointer-events-none` 在 country/language 维度
   - getDataCoverage 仍调（保留 backend 函数）但**不再 disable**
   - 改为显示 "已覆盖 N% KOL" 提示（如 "country 已覆盖 67%, 33% 无数据"），用户知道选 filter 可能漏部分 KOL

2. `src/app/[locale]/(app)/match/search.ts` runMatchSearch:
   - 撤 BL-073-F006 加的 early-return（filter coverage=0 不再特殊处理，正常发 SQL）
   - 但保留 `countryCode IS NOT NULL` 维度的 filter coverage 计算（用于上面 UI 提示）

3. `messages/{zh,en,ja,ko,es}.json` 加 `match.filterSidebar.coverageHint` 5 locale（如 "覆盖 {pct}%"）

**Acceptance：**
- [ ] MatchFilterSidebar country / language 维度不再 disable
- [ ] 显示 "已覆盖 N%" 提示文案 5 locale
- [ ] runMatchSearch early-return 撤
- [ ] staging 实测 /zh/match filter 可点 country/language + 显示覆盖率提示
- [ ] 选 filter → 返回相应 KOL（验真有数据返回）

---

### F006: /api/health fill_rate 指标 + kpi_daily_snapshot 写入

**Why：** 监控 fill_rate 变化趋势，告警基础。

**What：**

1. `src/app/api/health/route.ts` 加 KOL fill_rate 字段：
   ```ts
   {
     status: "healthy",
     uptime_seconds: ...,
     checks: { database: ..., redis: ... },
     kol_coverage: {       // BL-075 新加
       country_fill_rate: 0.67,
       language_fill_rate: 0.89,
       total_active_kols: 1385,
       last_updated: "<ISO datetime>"
     },
     timestamp: ...
   }
   ```

2. kol-sync-daily.ts 后写 `kpi_daily_snapshot` 记每日 fill_rate（如有该表，否则跳）

3. 文档化 prod 监控建议 in `framework/harness/deploy-patterns.md` 或 backlog（BL-072 沉淀候选 #4 prod error log alerting 配套）

**Acceptance：**
- [ ] /api/health response 含 kol_coverage 子结构
- [ ] kpi_daily_snapshot 写入（如表存在）
- [ ] curl prod/staging /api/health 返 valid JSON
- [ ] tests/unit health-route 单测含 kol_coverage 验证

---

### F007: Reviewer L1+L2 抽样验证 + signoff（executor:codex）

**L1 自动化（必跑）：**
1. `npm run lint` PASS（0 error / warning ≤3）
2. `npx tsc --noEmit` PASS
3. `npm test` PASS（含 F001 + F003 + F006 单测）
4. `scripts/kol-enrichment-backfill.ts --dry-run` 跑通输出预期格式
5. `.auto-memory/environment.md` Actions 清单含 kol-country-enrichment

**L2 staging 抽样实测：**
1. /api/health prod 返 kol_coverage fill_rate >0
2. SSH staging 跑 `daily sync` 验 enrichment stage 触发 + audit_log 写入
3. staging /zh/match filter sidebar country/language 不 disable + 覆盖率提示显示
4. staging /zh/match 选 country=US filter → 返回 country=US 的 KOL（验数据真有）
5. backfill 抽样 20-30 KOL 人工 review accuracy 记录在 signoff
6. prod backfill 跑后 fill_rate ≥ 60% (language) / ≥ 30% (country) — best-effort 仅记不卡硬阈

**Acceptance（signoff doc）：**
- [ ] L1 5 项 / L2 6 项全 PASS
- [ ] 0 broken cross-reference / 0 LLM cost runaway
- [ ] signoff doc `docs/test-reports/BL-075-signoff-2026-05-XX.md` 含 fill_rate + accuracy 报告

---

## §5 风险 / 应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| langdetect 准确性低（特别短文本如 single-word display_name）| 中 | 中 | langdetect 用 bio + displayName + handle 拼接增加文本量；置信度 <0.5 fallback null（不写错值）|
| LLM 推断 country 准确性低 | 中 | 中 | LLM 返 confidence；阈 0.5 才采纳；audience_geo_dist top-1 优先（更可靠）|
| Backfill 耗时长 / LLM rate limit | 低 | 低 | 并发 5 + 错误 retry；预估 1397 × 1s/call ÷ 5 = ~5 min total |
| LLM 成本超预算 | 低 | 低 | Claude Haiku $0.25/M input；1397 KOL × ~100 tokens ≈ $0.035 backfill |
| BL-073-F006 UI disable 撤后 filter 命中 0 行复现 | 中 | 中 | 数据填充后预期 fill_rate ≥60% (lang)；用户体验"覆盖率提示"标注 |
| audit_log 写入失败导致部分 KOL 无回溯 | 低 | 中 | enrichKol + DB update 包同 transaction（withTenant 内）|
| aigcgateway Action ID 缺失 → backfill crash | 低 | 高 | F001 enrichKol LLM fallback `try/catch` 返 null 不抛；F002 必须先完成 |

---

## §6 Done Definition

- [ ] F001-F007 全 acceptance PASS
- [ ] Reviewer L1+L2 全 PASS（signoff doc 终签）
- [ ] progress.json status = done
- [ ] backlog.json BL-075 entry 移除
- [ ] BL-062 entry 移除（closed-merged-into-BL-075）
- [ ] .auto-memory/project-status.md BL-075 DONE marker
- [ ] prod backfill 跑完，fill_rate report 在 signoff doc

---

## §7 沉淀候选（done 阶段或 v0.9.24 batch）

1. **enrichment 模式模板**：langdetect (零 LLM) + LLM fallback (置信度 ≥0.5) + audit_log + dry-run script 的组合模式 — 入 framework/harness/ai-action-contract.md 或 generator.md
2. **数据 coverage 治理 audit 模板**：prod SSH SQL 查 col 非空率 + 推断材料分布 → 决定方法 — 入 evaluator.md L2 段
3. **filter UX 三态防御扩展**：disable (BL-073-F006) → 启用 + 覆盖率提示 (BL-075-F005) → 长期 fill_rate ≥90% 后去提示，作为 UI 渐进升级模板

---

## §8 后续

- BL-062 closed-merged-into-BL-075（backlog 同步删 BL-062 entry）
- v0.9.24 framework sediment batch：现 9 条 + BL-075 新 3 条 = 12 条积压
- 未来 enrichment 扩展：audience_age_dist / monetization_status / engagement_authenticity 同类问题独立 batch

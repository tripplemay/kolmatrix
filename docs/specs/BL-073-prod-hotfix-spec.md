# BL-073 Prod Hotfix Spec — Material Symbols bare ligature + /brief 嵌套宽度 + i18n missing key + 防御升级

> **Sprint：** BL-073-prod-hotfix
> **Type：** Prod hotfix（铁律 #9）— src/ 业务码 + script + test 防御升级
> **预估工时：** ~12h ≈ 1.5 day Generator + 0.5 day Reviewer
> **关联：** docs/test-reports/BL-073-prod-hotfix-audit-2026-05-26.md（Phase A0 audit + A1 lock）
> **状态：** A0+A1 完成 → 待 building
> **依赖：** BL-072 done @ tag bl072-done @ bc24e09（已满足）

---

## §1 背景与触发

### 1.1 触发

5/26 prod deploy BL-072 fix 后，用户继续报 4 个新 prod issue（其中 1 个 IA 架构议题 + 1 个数据完整性议题，分别归 BL-074 + BL-075）。本批次仅含 prod hotfix 维度 3 issue（#1 + #2 + #4A）+ 防御升级。

### 1.2 4 Issues 概况（详 audit doc §1）

- **#1**：/campaigns/[id] 8 个 Material Symbols icon 字面文字（multi-line span bare pattern，BL-072-F005/F007 防御 v1 漏检）
- **#2**：/brief form 区域居中两边大量留白（BriefPageClient 嵌套 max-w-3xl）
- **#4A**：/match emptyState 显示 `match.emptyState.body` 字面（5 locale key 全 MISSING + BL-072-F007 test 不验 key existence）

### 1.3 A1 用户 5/26 lock

- 分批 = A 3 独立批次（BL-073 + BL-074 + BL-075）
- BL-073 scope = 含防御升级 + filter UX 防御（country/language disable）
- i18n empty 文案区分两态：默认空 vs filter 命中空
- subset script Pattern 7（bare in multi-line span）+ false-positive 排除清单升级
- F007 test 升级 + STRICT_MODE 渐进 flip

### 1.4 角色分配

- role_assignments = null（默认映射）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- F001 Material Symbols 8 漏 ligature manifest + woff2 重生
- F002 subset script Pattern 7 bare string in multi-line span grep
- F003 BriefPageClient max-w-3xl 删 + grep 嵌套防御
- F004 i18n match.emptyState.body 补 5 locale + 区分两态文案 + 扫其他 MISSING（weeklyReport.title 等）
- F005 i18n-page-side-consumption test v2 加 key existence 检测
- F006 filter UX 防御 country/language disable + early-return
- F007 material-symbols-coverage test v2 + STRICT_MODE flip
- F008 Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE（明示）

- IA refactor 加第 5 nav "活动"（归 BL-074）
- KOL country/language 数据源头填充（归 BL-075）
- 业务逻辑功能新增 / 修改（本批次仅修 outbound 一致性 + i18n + Material Symbols + filter UX 维度）

### 2.3 不变量

1. **0 业务逻辑改动**（除 filter UX disable，本质 UI 提示，非业务变更）
2. **i18n brand kept-en allowlist 不破** — match.emptyState.body 是普通文案非 brand，真翻 5 locale
3. **Pattern 7 false-positive 排除清单与 Pattern 6 同步增量**（不分叉）
4. **STRICT_MODE flip 渐进**：仅 Material Symbols 维度 flip 为 strict，i18n + link-target 仍 advisory（避免 false-positive 拦截合法 PR）

---

## §3 Features 详细描述

### F001: Material Symbols 8 漏 ligature manifest + woff2 重生

**Why：** Issue #1（audit §5）— prod /campaigns/[id] 8 个 icon 字面文字。

**What：** 在 `scripts/material-symbols-icons-manifest.txt` 追加 8 行（含 file:line + JSX 类型 label）：

```
forward_to_inbox       # campaigns/[id]/BriefSummaryPanel.tsx:239   | bare multi-line span (BL-073-F001)
refresh                # campaigns/[id]/AiRecommendationPanel.tsx:618  | bare multi-line span (BL-073-F001)
article                # 多文件                                        | bare multi-line span (BL-073-F001)
attach_money           # campaigns/[id]/BriefSummaryPanel.tsx:211 等   | bare multi-line span (BL-073-F001)
error_outline          # 多文件                                        | bare multi-line span (BL-073-F001)
hourglass_empty        # 多文件                                        | bare multi-line span (BL-073-F001)
mark_email_unread      # reach / weekly-report 多文件                  | bare multi-line span (BL-073-F001)
verified_user          # 多文件                                        | bare multi-line span (BL-073-F001)
```

跑 `bash scripts/regenerate-material-symbols-subset.sh` 重生 woff2，commit 同 commit 含 manifest + woff2。

**Acceptance：**
- [ ] manifest 含 8 行
- [ ] woff2 size 增 (~11008 → ~11800B 加 8 glyphs)
- [ ] script 输出 ICON_COUNT 增 8
- [ ] staging 实测 /campaigns/[id]：8 icon glyph 正确渲染（不再字面文字）

---

### F002: subset script Pattern 7 — bare string in multi-line span grep

**Why：** Issue #1 audit 暴露 Pattern 6 只覆盖 quoted。

**What：** `scripts/regenerate-material-symbols-subset.sh` 加 Pattern 7：

```bash
# Pattern 7: bare ligature on own line within multi-line span (BL-073-F002)
# 匹配 `material-symbols-outlined` 上下文 -A 5 行内, 独立成行的纯小写下划线标识符
# (排除 prop name / closing tag / 注释行 / 关键字)
grep -rE 'material-symbols-outlined' src/ --include="*.tsx" --include="*.ts" -A 5 --no-filename 2>/dev/null \
  | awk -F'-' '/material-symbols/{next} {print}' \
  | grep -E '^[[:space:]]+[a-z][a-z_0-9]+[[:space:]]*$' \
  | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' \
  | grep -vE '^(true|false|null|undefined|inherit|currentColor|cyan|purple|neutral|sm|md|lg|xl|left|right|top|bottom|center|start|end|grid|swap|email|body|cta|h2|title|truncate|invisible|normal|platforms|card|table|ai_generated|duplicate|offline|aria|className|onClick|href|data|id|role|hidden|ref|defer|async|prefetch|type|name|value|checked|selected|required|readonly|autocomplete|autofocus|min|max|step|pattern|action|method|target|rel|download|div|span|button|a|p|img|ul|li|section|children)$' \
  | sort -u
```

合并入现有 sort -u 输出。false-positive 排除清单与 Pattern 6 同步（追加 Pattern 7 实测出的新词）。

**Acceptance：**
- [ ] script 含 Pattern 7（注释说明 + 关键字排除）
- [ ] Pattern 7 跑后自然发现 8 个漏 ligature（无 manifest 时也能命中）
- [ ] ICON_COUNT 不 regress（与原 quoted-only 输出比对 ≥）
- [ ] false-positive 排除清单文档化于 framework/harness/checklists/material-symbols-pattern.md（不重复，与 Pattern 6 共享）

---

### F003: BriefPageClient max-w-3xl 删 + 嵌套防御

**Why：** Issue #2 — BriefPageClient.tsx:120 二级 max-w-3xl 覆盖 page.tsx 1600px。

**What：**

1. `src/app/[locale]/(app)/brief/BriefPageClient.tsx:120` 改：
   ```tsx
   - <div className="mx-auto max-w-3xl space-y-6">
   + <div className="space-y-6">
   ```

2. 验证 CampaignForm 内 responsive grid（md:grid-cols-2 / md:grid-cols-4）在 1600px 容器下正常展开

3. 如个别 single-field 行（如 "活动名称（可选）"）变得过长不易读，可在该 field 父容器加 `max-w-2xl`（局部约束 vs 全 form 约束）

**Acceptance：**
- [ ] BriefPageClient.tsx:120 max-w-3xl 删
- [ ] /brief?tab=campaign + /brief?tab=products 在宽屏 (1600+) 渲染时 form 区域与 tab nav 同宽
- [ ] CampaignForm 内 grid 在 ≥768px 展开为 2-4 列
- [ ] single-field 行（若过长）局部加 max-w-2xl 约束
- [ ] grep 全仓嵌套 max-w 防御: `grep -rn "max-w-" src/app/\[locale\]/\(app\)/{brief,match,reach,insight}/ --include='*.tsx'` 输出 review，0 个意外 max-w 二级约束

---

### F004: i18n match.emptyState.body 补 5 locale + 两态文案 + 扫其他 MISSING

**Why：** Issue #4A — match.emptyState.body 5 locale 全 MISSING + prod log 还含 weeklyReport.title MISSING。

**What：**

1. `messages/{zh,en,ja,ko,es}.json` `match.emptyState` 加 `body` key + 区分两态：

```json
"emptyState": {
  "title": "未找到符合的 KOL",
  "body": "请尝试调整筛选条件或清除部分筛选。",        // filter 命中空（zh）
  "bodyDefault": "KOL 库正在同步中，稍后再来看看。"     // 默认空（zh）— 备用
}
```

实际改 page.tsx 逻辑判断 `hasActiveFilters` 选用哪个文案。

2. 删孤儿 `tipHeading` + `tipBody`（grep 全仓确认 0 caller）

3. SSH prod log 扫近 7 天 MISSING_MESSAGE 全量，输出待修 key 清单（含 `weeklyReport.title` 等），同 commit 补齐 5 locale

4. `tests/unit/i18n-locale-coverage.test.ts` 8/8 跑通

**Acceptance：**
- [ ] match.emptyState.body 5 locale 完整翻译
- [ ] page.tsx 区分 hasActiveFilters → 选 body vs bodyDefault
- [ ] 孤儿 tipHeading/tipBody 删除（grep 0 caller 确认）
- [ ] prod log 扫出的其他 MISSING_MESSAGE 全部补全 5 locale
- [ ] i18n-locale-coverage test 8/8 PASS
- [ ] staging 实测 /zh/match emptyState 文案中文显示

---

### F005: i18n-page-side-consumption test v2 — 加 key existence 检测

**Why：** BL-072-F007 v1 只 grep raw English，不验 `t(key)` 调用的 key 在 messages 实际 exist。

**What：**

`tests/unit/i18n-page-side-consumption.test.ts` 扩展逻辑：

1. 现有 raw English literal scan 保留（advisory）
2. **新加：** 扫所有 page.tsx + *Client.tsx + *Panel.tsx + *Bar.tsx 的 `t("<key>")` / `t('<key>')` 调用
3. 对每个 key 拼 namespace（如 `getTranslations("match.emptyState")` + `t("body")` → `match.emptyState.body`）
4. 验该 key 在 messages/en.json 实际 exist（en 为 source of truth）
5. 不 exist → fail test 列 file:line + key
6. 第一版 advisory（warning），稳定后转 strict

**Acceptance：**
- [ ] test 扩展含 key existence check
- [ ] 第一版 advisory（STRICT_MODE=false）
- [ ] BL-073-F004 修复后跑 test 0 fail
- [ ] CI workflow 含该 test job

---

### F006: filter UX 防御 — country/language disable

**Why：** Issue #4B 真根因 = prod 数据 country/language 全 NULL，filter UI 命中 0 行误为 search broken。

**What：**

1. `src/lib/kol/filters.ts` 加辅助函数 `getDataCoverage(tx, tenantId)` 返回每维度有数据的 distinct values count：
   ```ts
   const coverage = await getDataCoverage(tx, tenantId);
   // { regions: 0, languages: 0, platforms: 3, categories: 2 }
   ```

2. `src/app/[locale]/(app)/match/page.tsx` server-side 拿 coverage 传给 MatchFilterSidebar

3. `MatchFilterSidebar` 对 coverage=0 维度 UI disable + 显示 "(暂无数据)" 提示

4. `runMatchSearch` 加 early-return：filter 选了 coverage=0 维度 → 直接返 empty result 不发 SQL

5. **Acceptance UX：** 用户选 country/language 仍能看 UI 灰显但**不能点**，避免误以为"我没选对"

**Acceptance：**
- [ ] getDataCoverage 函数实现 + 单测
- [ ] MatchFilterSidebar 接收 coverage prop + disable 渲染
- [ ] runMatchSearch early-return 优化
- [ ] staging 实测：country/language filter 灰显 + 提示文案
- [ ] 单元测试 ≥4 case（coverage 0 / coverage >0 / 选了 disabled filter / early-return）

---

### F007: material-symbols-coverage test v2 + STRICT_MODE flip

**Why：** BL-072-F007 v1 只 grep quoted；STRICT_MODE 一直 false 没拦 deploy。

**What：**

1. `tests/unit/material-symbols-coverage-unit.test.ts` 加 Pattern 7 bare detection（与 F002 同步规则）
2. STRICT_MODE 拆分：`STRICT_MS_ICONS=true`（Material Symbols 维度 strict）+ `STRICT_I18N=false`（i18n 仍 advisory）+ `STRICT_LINK_TARGET=false`（link-target 仍 advisory）
3. Material Symbols 维度 flip strict：测试 fail = CI fail
4. CHANGELOG 记 STRICT_MODE 渐进升级路径

**Acceptance：**
- [ ] test 加 bare detection 与 Pattern 7 同步
- [ ] STRICT_MS_ICONS=true，i18n + link-target 仍 false
- [ ] BL-073-F001 修复后跑 test PASS
- [ ] 如未来再加 Material Symbols icon 未追 manifest → CI fail 拦截

---

### F008: Reviewer L1+L2 抽样验证 + signoff（executor:codex）

**Why：** 大范围 src/ + script + test 修改最后验证。

**L1 自动化（必跑）：**
1. `npm run lint` PASS（0 error，warning ≤3）
2. `npx tsc --noEmit` PASS
3. `npm test` 1322+ tests PASS（含 F005/F007 新增 test）
4. `grep -rEn 'forward_to_inbox|refresh|article|attach_money|error_outline|hourglass_empty|mark_email_unread|verified_user' scripts/material-symbols-icons-manifest.txt` 全命中（manifest 完整）
5. woff2 size 增 ~800B
6. messages/zh.json 含 match.emptyState.body + 5 locale 平齐

**L2 staging 抽样实测：**
1. /zh/campaigns/[id] 8 icon 正确渲染
2. /zh/brief form 区域与 tab nav 同宽 1600px
3. /zh/match emptyState 中文文案显示（非字面 key）
4. /zh/match filter sidebar country/language 灰显 + "(暂无数据)"
5. /zh/match 默认进入显示 20 个 KOL 卡片
6. CI 工作流跑 Material Symbols strict 验拦截能力

**Acceptance：**
- [ ] L1 6 项 / L2 6 项全 PASS
- [ ] 0 hardcoded English / 0 字面 ligature / 0 stale link
- [ ] signoff doc `docs/test-reports/BL-073-signoff-2026-05-XX.md`

---

## §4 风险 / 应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| F002 Pattern 7 false-positive 误抓 prop name | 中 | 中 | 排除清单逐次实测增量；STRICT_MS_ICONS 启用前先 advisory 跑 1-2 PR |
| F003 删 max-w-3xl 后 CampaignForm 单行过宽不易读 | 中 | 低 | acceptance 含 spot check；必要时单 field 加 max-w-2xl |
| F004 prod log 扫不全 MISSING_MESSAGE（log 轮转）| 中 | 低 | 同时跑本机 grep `t("` + 比对 messages 拿全量 key；prod log 仅作辅助 |
| F005 page-side test false-positive 拦合法 t() 调用 | 低 | 中 | 第一版 advisory；先 BL-073 自测 PASS 再讨论 strict |
| F006 getDataCoverage 加查询 latency | 低 | 中 | 用 distinct + null 比较 + cached 或 Promise.all 与 main query 并行 |
| F007 STRICT_MS_ICONS flip 后未来 PR 被拦 | 低 | 低 | 这是预期效果；framework 文档化"加新 icon 必更 manifest" |

---

## §5 Done Definition

- [ ] F001-F008 全 acceptance PASS
- [ ] Reviewer L1+L2 全 PASS（signoff doc 终签）
- [ ] progress.json status = done, fix_rounds 记录
- [ ] 3 user-facing issue 在 staging 验证通过 + prod deploy 后复测
- [ ] backlog.json 加 BL-074 + BL-075 entry（5 沉淀候选 v0.9.24 batch）
- [ ] .auto-memory/project-status.md BL-073 DONE marker

---

## §6 后续批次预告

- **BL-074-ia-v2**: 5 路由 IA + ADR-015 + i18n nav.campaigns
- **BL-075-kol-data-coverage**: apify-kol fork country/language 同步 + 本地 enrichment
- **v0.9.24 framework sediment**: BL-072 + BL-073 累计 9 条沉淀候选 inline-merge

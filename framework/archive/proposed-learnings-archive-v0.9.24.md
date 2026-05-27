# Proposed Learnings Archive — v0.9.24 (BL-077 sediment batch)

> **Sediment batch：** BL-077 v0.9.24 framework sediment batch
> **Date：** 2026-05-27
> **Sediment 数量：** 17 条 sediment inline-merge 物理 13 段（5 同主题合并段）
> **来源批次：** BL-072 done 4 + BL-073 done 5 + BL-075 done 4 + BL-076 done 4 = 17 候选
> **CHANGELOG cross-ref：** `framework/CHANGELOG.md` v0.9.24 段（17 条 1-line summary + 实际写入位置表 + 5 同主题合并段表）
> **关联 spec：** `docs/specs/BL-077-v0.9.24-framework-sediment-spec.md`
> **状态：** 17 条全文归档（不省略），方便未来追溯实战 detail

---

## §1 17 条 sediment 全文（按来源批次时间序）

### #1 [2026-05-26] Claude CLI — 来源：BL-072 prod hotfix done / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #1）

**内容：** **IA refactor / 大范围结构改动后必须做 outbound 一致性扫描清单**（4 维度合并 — visual 宽度 / i18n 消费侧 t() wiring / Material Symbols 子集 manifest / 路由 outbound 链接）。BL-072 4 prod issue 共性根因 = BL-070-F003/F004/F005 IA refactor 大改后 outbound 一致性扫描缺失：
- Issue #1 /brief 宽度 (768 vs 1600) → visual 宽度跨 4 路由一致性漏检
- Issue #2 /insight i18n hardcoded → page.tsx 创建后 i18n 消费侧 t() wiring 漏检
- Issue #3 /match TABLE_ROWS 字面文字 → 新加 ligature 时 Material Symbols manifest 漏更新
- Issue #4 10 处 outbound 404 → 删老路由时 outbound 链接漏 grep

**建议写入：** `framework/harness/planner-checklists.md` 新段 §"IA refactor / 路由删除批次 outbound 一致性扫描清单"（4 维度 spec acceptance 模板 + 触发 batch 类型）

**实际写入：** `framework/harness/planner-checklists.md` §"IA refactor / 路由删除批次 outbound 一致性扫描清单（v0.9.24 #1 / BL-072 #1）"，含 4 触发 batch 类型 + 4 维度 spec acceptance 模板 + BL-070 反例。BL-077-F005 实施。

**状态：** 用户 2026-05-26 ack（BL-072 done 收尾）— v0.9.24 framework sediment batch 落地完成。

---

### #2 [2026-05-26] Claude CLI — 来源：BL-072-F005 / Generator Kimi

**类型：** 模板修订（v0.9.24 候选 #2）

**内容：** **subset script grep Pattern 6 JSX 三元 模板 + manifest 维护惯例**。BL-072-F005 已实物落 `scripts/regenerate-material-symbols-subset.sh` Pattern 6（匹配 `material-symbols-outlined` 上下文 ±5 行内 quoted string + false-positive 词排除清单）+ `framework/harness/checklists/material-symbols-pattern.md` §"manifest 增量维护" 段（何时手工追 manifest / path label 含 file:line + JSX 三元/return 类型 / IA refactor 改名时同步 path label）。本沉淀把"实物模式"提到 framework 层方便其他项目复用（false-positive 排除清单 reusable / pattern grep 通用）。

**建议写入：** `framework/harness/checklists/material-symbols-pattern.md` （已落 BL-072-F005） + 抽象 false-positive 排除规则模板到 `framework/harness/generator.md` §15 类似位置（subset script 通用模式）

**实际写入：** `framework/harness/checklists/material-symbols-pattern.md` §"Pattern 进化路径 v1 → v2 → v3 总览（v0.9.24 BL-077-F007 sediment marker）" — 与 #5 同主题合并段，含 Pattern 进化表 v1→v2→v3 + 穷举 JSX pattern 7 种位置覆盖状态表 + false-positive 排除清单 + manifest 维护惯例总结 + scope tag 保 `project-specific`（BL-071 F005 lock）。BL-077-F007 实施。

**状态：** 用户 2026-05-26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #3 [2026-05-26] Claude CLI — 来源：BL-072-F007 / Generator Kimi

**类型：** 新规律（v0.9.24 候选 #3）

**内容：** **i18n 消费侧 test 探针 + 三件套模式（page-side hardcoded English sweep + link-target audit + Material Symbols glyph 三向断言）**。BL-072-F007 已实物落 3 个 advisory test (`tests/unit/{link-target-audit,material-symbols-coverage,i18n-page-side-consumption}.test.ts`)。共同模式 = "测试基建对 outbound/消费侧/三向闭环的 advisory 防御"。第一版 warning 不 fail 避免 false-positive 拦截合法 PR，稳定 1-2 周后转 strict。**沉淀价值：** 把 "advisory test → strict test" 升级路径 + 三件套覆盖维度（routing 链接 / icon font glyph / i18n 消费侧）作为通用模板，未来类似批次可复用。

**建议写入：** `framework/harness/evaluator.md` 新段 §"advisory test 三件套模式 — outbound/消费侧/三向闭环防御"（含 BL-072-F007 三测试模板 + advisory→strict 升级路径）

**实际写入：** `framework/harness/evaluator.md` §13.4 advisory test 三件套模式（v0.9.24 合并段 #3 + #7 + #9） §13.4.1 v1 三件套基础（v0.9.24 #3 / BL-072 #3，BL-072-F007 落实物）— 与 #7 + #9 同主题合并段。BL-077-F003 实施。

**状态：** 用户 2026-05-26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #4 [2026-05-26] Claude CLI — 来源：BL-072-F006 / Generator Kimi

**类型：** 新规律（v0.9.24 候选 #4，扩展 v0.9.23 #19）

**内容：** **删路由前必须 grep 全仓 outbound 链接 — 扩展 BL-070 #19 "删 i18n deprecated ns 前必须 grep callers" 同主题合并到通用 "删 X 前 grep callers" 矩阵**。BL-072-F006 修 10 处 outbound 404 链接根因 = BL-070-F004 删 5 老路由 + middleware 即停 redirect 时没 grep 全仓更新 outbound `href` 字面字符串。模式扩展：删任何"被引用资源"（路由 / i18n namespace / enum value / API endpoint / DB table）前必须先 grep 全仓 callers + 同 commit 修。BL-072 同步加 `tests/unit/link-target-audit.test.ts` advisory 防御未来同类。

**建议写入：** `framework/harness/generator.md` §"删 X 前 grep callers" 矩阵扩展（v0.9.23 #19 i18n callers + v0.9.24 #4 路由 outbound 同主题合并；矩阵纵向 = X 类型，横向 = grep 模式 + 自动化防御 test）

**实际写入：** `framework/harness/generator.md` §11 J「删 X 前 grep callers 矩阵（v0.9.24 #4 / BL-072 #4 扩展 H）」— 矩阵化整合 v0.9.23 #19 (i18n ns 单维度) + v0.9.24 #4 (路由 outbound) + TBD 未来扩展（enum value / API endpoint / DB table）。BL-077-F002 实施。

**状态：** 用户 2026-05-26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #5 [2026-05-26] Claude CLI — 来源：BL-073 prod hotfix done / Planner Kimi

**类型：** 模板修订（v0.9.24 候选 #5，扩展 BL-072-F005）

**内容：** **subset script grep Pattern 进化路径** — v1 (Pattern 1-5 只覆盖同行 `>icon<` / 多行 `-A 1` 裸 / `icon: "name"` / `icon="name"` / manifest 手工) → v2 (BL-072-F005 加 Pattern 6 覆盖 `"quoted"` JSX 三元) → **v3 (BL-073-F002 加 Pattern 7 覆盖 multi-line span 内 bare ligature on own line)**。穷举 JSX pattern 模板：JSX 内 ligature 可能出现位置 = 同行 quoted / 多行 bare / 三元 quoted / 对象 value / return statement / `??` fallback。本次 BL-073 issue #1 暴露 v2 漏 bare 模式（forward_to_inbox / refresh / article 等 8 个）。

**建议写入：** `framework/harness/checklists/material-symbols-pattern.md` §"Pattern 进化路径 v1 → v2 → v3" + 穷举 JSX pattern 模板（每种 pattern 含 1 例 + grep 实现 + false-positive 排除）

**实际写入：** `framework/harness/checklists/material-symbols-pattern.md` §"Pattern 进化路径 v1 → v2 → v3 总览（v0.9.24 BL-077-F007 sediment marker）" — 与 #2 同主题合并段，含 Pattern 进化表 + 穷举 JSX pattern 7 种位置覆盖状态表 + Pattern 6/7 兜底详 §"Pattern 6 兜底" + §"Pattern 7 兜底" + STRICT_MS_ICONS flip 记录 + scope tag lock 重申。BL-077-F007 实施。

**状态：** 用户 5/26 ack（lock A 完整版含防御升级）— v0.9.24 framework sediment batch 落地完成。

---

### #6 [2026-05-26] Claude CLI — 来源：BL-073 prod hotfix done / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #6）

**内容：** **spec acceptance "嵌套二级约束 grep 全仓"模板** — 视觉宽度 / i18n / CSS variant 类 acceptance 凡涉及"外层约束改变"必须加 acceptance 行 `grep -rn "<约束类>" <相关路由>/ --include='*.tsx'` 全 review，确认无嵌套二级约束破坏外层意图。BL-072-F001 修 `/brief/page.tsx:75` max-w-3xl → max-w-[1600px] 但漏检 `BriefPageClient.tsx:120` 嵌套 max-w-3xl → BL-073 同问题复现。Acceptance 模板：`grep -rn "max-w-" src/app/[locale]/(app)/<route>/ --include='*.tsx'` 输出 review，0 个意外二级约束。

**建议写入：** `framework/harness/planner-checklists.md` §"spec 起草 checklist 集合" 新加段 "嵌套二级约束 grep 防御"（含视觉/i18n/CSS variant 三类 grep 模板）

**实际写入：** `framework/harness/planner-checklists.md` §"spec acceptance 嵌套二级约束 grep 防御（v0.9.24 #6 / BL-073 #6）"，含 BL-072-F001 → BL-073 反例 + Acceptance 模板 + 三类 grep（视觉宽度 / i18n namespace / CSS variant） + grep 输出 review 显式落 acceptance 验证笔记 + 与 §"IA refactor outbound 一致性扫描"关系澄清。BL-077-F005 实施。

**状态：** 用户 5/26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #7 [2026-05-26] Claude CLI — 来源：BL-073-F005 / Generator + Planner Kimi

**类型：** 新规律（v0.9.24 候选 #7，扩展 BL-072-F007 i18n-page-side-consumption v1）

**内容：** **i18n page-side test v2 — key existence 检测**。BL-072-F007 v1 仅 grep raw English literal 在 JSX text/attr，**不验 page.tsx 调用 `t(key)` 时该 key 在 messages JSON 实际 exist**。BL-073 issue #4A 反例：`match.emptyState.body` 5 locale 全 MISSING 但 page.tsx 调 `t("body")`，next-intl prod fallback 返字面 key 字符串。BL-073-F005 实物落 i18n-page-side-consumption.test.ts v2：扫所有 page.tsx + *Client/*Panel/*Bar 的 `t("<key>")` 调用 → 拼 namespace → 验 messages/en.json exist → 不 exist fail。第一版 advisory（STRICT_I18N=false），稳定后转 strict。

**建议写入：** `framework/harness/evaluator.md` §"advisory test 三件套"（BL-072-F007 沉淀的） 加 v2 升级路径：i18n page-side test v1 raw English → v2 + key existence；同步 STRICT_MODE 渐进 flip 模式（仅 strict Material Symbols 维度，i18n + link-target 仍 advisory）

**实际写入：** `framework/harness/evaluator.md` §13.4.2 v2 升级 key existence 检测（v0.9.24 #7 / BL-073 #7，BL-073-F005 实战）— 与 #3 + #9 同主题合并段，含 v1 仅 grep raw English literal 的局限 + 反例 BL-073 issue #4A + v2 增量探测 ts 模板（extractNamespaceFromFile + extractTCalls + 拼 ${ns}.${key} 查 messages/en.json）。BL-077-F003 实施。

**状态：** 用户 5/26 ack（lock A 完整版）— v0.9.24 framework sediment batch 落地完成。

---

### #8 [2026-05-26] Claude CLI — 来源：BL-073 prod log audit / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #8）

**内容：** **prod error log 接告警链 — MISSING_MESSAGE 应触发告警**。BL-073 SSH prod log 实测 `match.emptyState.body` + `weeklyReport.title` MISSING_MESSAGE 已多次出现于 prod log（5/25 17:18 ~ 18:02 UTC 至少 6 次），但**未触发任何告警** → next-intl 默认 production fallback 返 key 字面 + log 但不 throw，CI 跑不到 prod log，prod log 也无监控钩子。Sediment：MISSING_MESSAGE / Prisma error / 5xx response 等关键 error pattern 应入 log-based alert（如 grep tail with Slack webhook 或 GCP Cloud Monitoring）。

**建议写入：** `framework/harness/deploy-patterns.md` 新段 §"prod error log alerting" — 含 MISSING_MESSAGE / Prisma error / 5xx grep pattern + Slack webhook / GCP alerting 模板

**实际写入：** `framework/harness/deploy-patterns.md` §8 prod 关键流程 log-based alerting（v0.9.24 合并段 — BL-073 #8 + BL-076 #14） §8.1 "关联识别 gap（v0.9.24 #8 / BL-073 #8）" — 与 #14 同主题合并段，含 BL-073 SSH prod log 实测多发未告警背景 + 配套 #14 BL-076 14 天 outage 实战代价反例。BL-077-F004 实施。

**状态：** 用户 5/26 ack（间接, A1 lock 含此防御）— v0.9.24 framework sediment batch 落地完成。

---

### #9 [2026-05-26] Claude CLI — 来源：BL-073-F007 / Generator + Planner Kimi

**类型：** 新规律（v0.9.24 候选 #9）

**内容：** **STRICT_MODE 渐进升级路径 — advisory → strict 渐进 flip 模板**。BL-072-F007 三件套 test (link-target-audit / material-symbols-coverage / i18n-page-side-consumption) 首版全 advisory（STRICT_MODE=false，warning 不 fail），避免 false-positive 拦截合法 PR。BL-073-F007 实物落渐进升级：拆 STRICT_MODE 为 `STRICT_MS_ICONS=true`（Material Symbols 维度 flip strict，CI fail 拦未追 manifest 的 icon）+ `STRICT_I18N=false`（仍 advisory）+ `STRICT_LINK_TARGET=false`（仍 advisory）。模式：稳定 1-2 周后逐维度 flip，每 flip 都需 CHANGELOG 标记 + planner-checklists.md 加"未来 X 必更 Y" 强制要求。

**建议写入：** `framework/harness/evaluator.md` §"advisory test 三件套" 段加 §"STRICT_MODE 渐进升级路径"（含 flip 模式 + CHANGELOG marker + 维度独立 flag 模板）

**实际写入：** `framework/harness/evaluator.md` §13.4.3 STRICT_MODE 渐进升级路径 — advisory → strict 渐进 flip（v0.9.24 #9 / BL-073 #9，BL-073-F007 实战）— 与 #3 + #7 同主题合并段，含当前维度状态表（STRICT_MS_ICONS=true / STRICT_I18N=false / STRICT_LINK_TARGET=false）+ flip 标准 4 步模板（CHANGELOG marker + planner-checklists 强制要求 + spec acceptance 模板更新 + 观察 1 周 noise rate）+ flag 拆分原因。BL-077-F003 实施。

**状态：** 用户 5/26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #10 [2026-05-26] Claude CLI — 来源：BL-075-F002 / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #10）

**内容：** **pm2 reload --update-env 不会重读 env_file — 单加 .env 行无效**。BL-075-F002 落 `AIGCGATEWAY_KOL_COUNTRY_ACTION_ID` 到 prod + staging .env 后 `pm2 reload kolmatrix --update-env` 出现新 var 不生效（/proc/$PID/environ 仍只有旧 vars）。根因：pm2 的 `--update-env` 只刷新当前 shell env 到进程，**不重读 ecosystem.config.js 中 `env_file` 路径**。`pm2 startOrReload ecosystem.config.js --update-env` 同样不会重读 env_file（pm2 dump 缓存先前 env 块）。修复模式：`set -a; source /opt/kolmatrix/.env.production; set +a; pm2 reload kolmatrix --update-env`（先注入到 shell env，再 reload 自动 carry over）。验证：`tr "\0" "\n" < /proc/$PID/environ | grep <NEW_VAR>` 确认实际进程 env 含新 var。

**建议写入：** `framework/harness/deploy-patterns.md` §3.x SSH 加 env var 模板段 — 含完整 4 步：(1) 备份 .env + 加新行 (2) `set -a; source .env; set +a` (3) `pm2 reload ... --update-env` (4) `/proc/PID/environ` 验证

**实际写入：** `framework/harness/deploy-patterns.md` §1.6.1 SSH 加 env var pm2 reload --update-env 的成功条件 — 必须先 source shell（v0.9.24 #10 / BL-075 #10）— 子段融入 §1.6 PM2 env_file anti-pattern，含反例（无 source 直接 reload）+ 4 步标准流程（cp 备份 / echo 加行 / set -a source set +a / pm2 reload --update-env / /proc/PID/environ 验证）+ 与 §1.6 pm2 delete + sourced start 选用矩阵 + 同 protocol 适用 BL-068/069/075-F001/F002 案例。BL-077-F004 实施。

**状态：** 用户 5/26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #11 [2026-05-26] Claude CLI — 来源：BL-075-F004 / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #11）

**内容：** **AI_DAILY_COST_USD_PER_TENANT_MAX 用 DEFAULT_COST_PER_CALL_USD=$0.01 估算 → 一次性 backfill 被 5x 高估**。BL-075-F004 prod backfill 跑 1383 KOL × 实际 cost ~$0.0009/call ≈ $1.25 总成本，但 cost-cap 用 `event_log count × $0.01` 估算（src/lib/ai/cost-cap.ts:43 DEFAULT_COST_PER_CALL_USD），$5/天 cap 在 ~500 call 时触发，剩余 880 call LLM 全部 skip。两个坑：(a) 估算 5-10x 高估实际成本（生产环境每次 LLM call 含 token 计费走 recordAiUsage 真实 costUsd，但 cap pre-check 只 count 不 sum），(b) 一次性 backfill 类操作没有 bypass 通道，被 normal-usage 同一 tenant 的 cap 拦截。Workaround: `AI_DAILY_COST_USD_PER_TENANT_MAX=500 nohup npx tsx scripts/...` 单次提升 cap。

**建议写入：** `framework/harness/ai-action-contract.md` 加 §"cost-cap 估算 vs 实际"段：(1) 修 cost-cap 改用 sum(payload.costUsd) 而非 count × default；(2) backfill 类 script 默认带 cap bypass flag 或环境覆盖文档；(3) 建议 cost-cap 拆 `interactive` (default $5/day) vs `batch` (default unlimited) 两档

**实际写入：** `framework/harness/ai-action-contract.md` §6.1 cost-cap 估算 vs 实际 — 5-10x 高估（v0.9.24 #11 / BL-075 #11，来源 BL-075-F004）— 与 #12 同主题合并段（§6 AI 调用经济与速率防御），含 BL-075-F004 实战数据 1397 KOL × $0.0009 ≈ $1.25 + $5 cap ~500 call 触发拦截 880 skip + Workaround 一次性提升 cap + 修复方向留 BL-078+ follow-up。BL-077-F001 实施。

**状态：** 用户 5/26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #12 [2026-05-26] Claude CLI — 来源：BL-075-F004 / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #12）

**内容：** **aigcgateway 30 RPM 默认硬限 — concurrency=5 backfill 必死 + retry 1.5s 救不了**。BL-075-F004 dry-run 实测：concurrency=5 时几乎每个 LLM call 都返 429 `RPM limit exceeded on key (limit=30). Please retry after 60 seconds`，fetchWithRetry 单轮 1.5s jitter retry 远不够（30 RPM = 2s gap minimum）。修复：enrichment-stage 加 makeLlmRateGate(intervalMs=2100) 单进程内 timestamp serialize 所有 LLM dispatch，concurrency=5 的 worker 在 LLM 前排队，franc/audience-geo path 不 gate（CPU 本地）。验证后 0 个 429。

**建议写入：** `framework/harness/ai-action-contract.md` §"批量调用 LLM 限速"段：(1) 默认 default RPM 假设 30，超 5 concurrency 必须自带 rate gate；(2) 推荐 pattern: `makeLlmRateGate(intervalMs)` + 预测 LLM 调用路径（仅 LLM-bound 才等待）；(3) fetch-with-retry 的 1.5s retry 不替代 rate gate（only 救偶发 spike）

**实际写入：** `framework/harness/ai-action-contract.md` §6.2 批量调用 LLM 限速 — makeLlmRateGate(intervalMs=2100)（v0.9.24 #12 / BL-075 #12，来源 BL-075-F004）— 与 #11 同主题合并段（§6 AI 调用经济与速率防御），含 30 RPM 429 失败模式 + makeLlmRateGate ts 模板（intervalMs=2100 留 5% 余量）+ 本地 path 不 gate + 适用边界 + fetch-with-retry 与 rate gate 分工 + BL-075-F004 实战数据 0 个 429。BL-077-F001 实施。

**状态：** 用户 5/26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #13 [2026-05-26] Claude CLI — 来源：BL-075-F006 post-handoff hotfix / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #13）

**内容：** **withPlatformAdmin 仅在 RLS policy 有 platform_admin 旁路时有效 — kol 等核心业务表无此旁路**。BL-075-F006 prod deploy 后 /api/health kol_coverage 显示 0 行（应 1397）。根因：`kol` RLS policy = `tenant_id = NULLIF(current_setting('app.tenant_id'), '')::uuid`，**只检查 app.tenant_id 一个 session var**，对 app.is_platform_admin 视而不见。withPlatformAdmin 设的 `is_platform_admin=true` 这里无效 → app.tenant_id 仍 NULL → 0 行。验证方式：deploy 后 curl prod /api/health 实测 vs `sudo psql` 直查 count(*)，差异即暴露。修复 pattern：循环 tenant 表（tenant 表无 RLS）+ per-tenant `set_config('app.tenant_id', $1, true)` 聚合。

**建议写入：** `framework/harness/database-patterns.md` §"跨 tenant 平台级聚合"段：(1) RLS policy 是否含 platform_admin 旁路要 grep 确认 (`pg_policies` 表查 `qual`)，不能默认信 withPlatformAdmin 通吃；(2) 模板：单 query withPlatformAdmin（仅当 policy 含 `is_platform_admin=true` 旁路）vs 循环 tenant set_config（policy 仅 tenant_id 比较时）；(3) Generator self-check：写 withPlatformAdmin 调用前必须先确认目标表 policy 的 `qual`

**实际写入：** `framework/harness/database-patterns.md` §4.6 跨 tenant 平台级聚合 — withPlatformAdmin vs 循环 tenant set_config（v0.9.24 #13 / BL-075 #13）— 子段融入 §4 RLS 旁路矩阵 + cross-tenant ops 决策树（D7 inline-merge 优先 2 加子段），含 §4.6.1 Generator self-check（写 withPlatformAdmin 前必 grep pg_policies）+ §4.6.2 两模式选用矩阵（policy 含 platform_admin 旁路 → 单 query；policy 仅 tenant_id → 循环 set_config）+ §4.6.3 验证方式（curl /api/health vs sudo psql 直查比对）+ §4.6.4 与 §4 旁路矩阵 + §4.3 决策树关系澄清。BL-077-F006 实施。

**状态：** 用户 5/26 ack — v0.9.24 framework sediment batch 落地完成。

---

### #14 [2026-05-27] Claude CLI — 来源：BL-076 audit / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #14，扩展 BL-072 #4 prod error log alerting）

**内容：** **prod 关键 error 多日累积未触发任何告警 — log-based alerting 缺失代价**。BL-076 SSH prod /var/log/kolmatrix-kol-sync.log 实测：`discover-import[apify-kol]: numeric field overflow` 自 5/12 起每天 daily-sync fail，**inserted=0 updated=0 持续 14+ 天 prod 数据同步管道彻底断**，全程未触发任何告警。BL-072 沉淀 #4 已识别 gap 未落实，BL-076 实战代价证实：14 天 prod 数据黑洞 + 1397 KOL 库 stale，影响所有 /match 用户。

**修复 pattern：** (a) `scripts/kol-sync-daily.ts` 出 `level=WARN/ERROR` 时自动调 Slack webhook 含 stats+alerts (b) GCP Cloud Monitoring log-based alert: `inserted=0 errors>0` 连续 3 天触发 PagerDuty (c) `/api/health` 加 `last_successful_sync` 字段, >48h 视为 degraded

**建议写入：** `framework/harness/deploy-patterns.md` §"prod 关键流程 log-based alerting"段（含 BL-076 14 天 outage 反面案例 + 三件套模板）

**实际写入：** `framework/harness/deploy-patterns.md` §8 prod 关键流程 log-based alerting（v0.9.24 合并段 — BL-073 #8 + BL-076 #14） §8.1 反例 — BL-076 14 天 prod outage 未告警代价（v0.9.24 #14 / BL-076 #14）— 与 #8 同主题合并段，含完整背景 + 三件套防御 ts 模板（Slack webhook on WARN/ERROR + GCP Cloud Monitoring log-based metric + /api/health degraded 信号）+ grep pattern 表 + 实装项留 BL-078+ follow-up + §8.5 配套 generator §16 batch try/catch 上游沉淀引用。BL-077-F004 实施。

**状态：** 用户 5/27 ack（间接，BL-076 done 收尾）— v0.9.24 framework sediment batch 落地完成。

---

### #15 [2026-05-27] Claude CLI — 来源：BL-076-F003 / Generator + Planner Kimi

**类型：** 新规律（v0.9.24 候选 #15）

**内容：** **batch insert / sync loop 必须包 per-element try/catch — 单元素 fail 不阻塞整 batch**。BL-076 根因之一: `import.ts` `for raw of raws` loop 无 per-KOL try/catch → first numeric overflow throw → 整 2567 KOL batch fail（inserted=0）。Generator 写 `forEach(prisma.upsert)` 类 pattern 默认假设全部成功，未考虑单元素异常隔离。BL-076-F003 实物落 try/catch + stats.failed 累加 + audit_log forensic.

**模板：**
```ts
for (const item of items) {
  try {
    await prisma.X.upsert({ ... });
    stats.success += 1;
  } catch (err) {
    stats.failed = (stats.failed ?? 0) + 1;
    console.error("[batch] item failed:", item.id, err);
    try {
      await prisma.auditLog.create({ data: { action: "X.failed", payload: { error: String(err).slice(0, 500), itemSummary: {...} } } });
    } catch (auditErr) { /* swallow, no recurse */ }
  }
}
```

**适用边界：** 所有 for...of 内 prisma upsert/create 类 DB write + 外部 API call + 文件 IO. **反面：** 业务 critical 单 transaction（如 payment）不应用此模板（fail-fast 更安全）.

**建议写入：** `framework/harness/generator.md` §"DB / 外部 API batch 健壮性"段

**实际写入：** `framework/harness/generator.md` §16 DB / 外部 API batch 健壮性 — per-element try/catch（v0.9.24 #15 / BL-076 #15），含完整 ts 模板（stats.success / stats.failed / audit_log 嵌 try/catch 防 recurse）+ 关键设计（stats 累加非 throw / audit forensic / 错误 message slice 500）+ 适用边界（✅ DB write / 外部 API / 文件 IO；❌ 业务 critical transaction / ACID 跨表多 step）+ 配套 alerting 引用 deploy-patterns §8。BL-077-F002 实施。

**状态：** 用户 5/27 ack — v0.9.24 framework sediment batch 落地完成。

---

### #16 [2026-05-27] Claude CLI — 来源：BL-076-F001 / Generator + Planner Kimi

**类型：** 模板修订（v0.9.24 候选 #16，扩展 BL-070 #22）

**内容：** **Schema migration ROLLBACK SQL 含先 clamp 后 ALTER 警告 — 数据范围扩容场景的 rollback 不对称风险**。BL-076-F001 `ALTER COLUMN engagement_rate TYPE NUMERIC(5,2)→(7,2)` 顺向无损（5,2 ⊂ 7,2），但 ROLLBACK `(7,2)→(5,2)` 因 prod 已含 15 行 > 999.99 → throw "value out of range". 通用模式：**任何扩范围 migration 的 ROLLBACK 必带 UPDATE clamp 前置 step**.

**模板：**
```sql
-- 顺向 (无损):
ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(7, 2);

-- ROLLBACK (非对称, prod 已含 > 999.99 行时必须先 UPDATE clamp):
-- 1. UPDATE "kol" SET "engagement_rate" = LEAST("engagement_rate", 999.99) WHERE "engagement_rate" > 999.99;
-- 2. ALTER TABLE "kol" ALTER COLUMN "engagement_rate" TYPE NUMERIC(5, 2);
```

**适用边界：** NUMERIC(M,N) / VARCHAR(N) 等带尺寸约束的 column type 改动. Int/Text 无尺寸约束 rollback 安全.

**建议写入：** `framework/harness/database-patterns.md` 或 `generator.md` §"Schema migration ROLLBACK 不对称风险"段

**实际写入：** **双归属同主题合并段**：
1. `framework/harness/database-patterns.md` §9 Schema migration ROLLBACK 不对称风险（v0.9.24 #16 / BL-076 #16，主写，扩展 BL-070 #22）— 主写，含 §9.1 反例 BL-076-F001 engagement_rate NUMERIC(5,2)→(7,2) + §9.2 模板 ROLLBACK SQL UPDATE clamp 前置 step + §9.3 适用边界表（NUMERIC/VARCHAR/SmallInt 有风险；Int/Text/Uuid/Boolean/Json 无）+ §9.4 Generator self-check 三步 + §9.5 配套 generator §17 adapter clamp + §9.6 与 generator §14.3 1 行 cross-ref 关系
2. `framework/harness/generator.md` §14.3 Schema migration ROLLBACK 不对称风险 — cross-ref database-patterns（v0.9.24 #16 / BL-076 #16）— 1 行 cross-ref 指向 database-patterns.md §9，含 Generator 写 ROLLBACK SQL 时 self-check 流程简版

BL-077-F002 (generator §14.3) + BL-077-F006 (database-patterns §9 主写) 同实施。

**状态：** 用户 5/27 ack — v0.9.24 framework sediment batch 落地完成。

---

### #17 [2026-05-27] Claude CLI — 来源：BL-076-F002 / Generator + Planner Kimi

**类型：** 新规律（v0.9.24 候选 #17）

**内容：** **adapter output schema 与 DB column type 边界 check 模板 — clamp + outlier flag 三件套**。BL-076-F002 实物落: apify-kol adapter 计算 engagementRate 后 Math.min(rawRate, 99999.99) clamp + outlier=rawRate>100 flag 标 metadata.flags。**通用模式：** 任何 adapter (external API → DB) 数据流, DB write 前必加 per-字段边界 check, 超出 column type 范围的 value 必须 clamp 或 null 或 flag.

**模板：**
```ts
const rawValue = computeFromExternalAPI(input);
const clampedValue = rawValue == null ? null : Math.min(Math.max(rawValue, MIN), MAX);
const isOutlier = rawValue != null && (rawValue > BUSINESS_THRESHOLD || rawValue < BUSINESS_THRESHOLD_LOW);
return {
  field: clampedValue,
  metadata: { flags: { ...existingFlags, field_outlier: isOutlier } },
};
```

**关联：** BL-076 业务阈值 BUSINESS_THRESHOLD=100% (百分比) < DB 上限 99999.99 (Decimal(7,2)). 业务阈值 < DB 上限 合理: 异常先标 flag 不丢数据, DB 边界仅最后兜底.

**适用边界：** 所有 Decimal(M,N) / SmallInt / VARCHAR(N) DB 列上游 adapter; LLM 返回非结构化数值同样需边界 check.

**建议写入：** `framework/harness/generator.md` §"adapter output 边界 check 三件套"段

**实际写入：** `framework/harness/generator.md` §17 adapter output 边界 check 三件套 — clamp + outlier flag + 业务阈值 < DB 上限（v0.9.24 #17 / BL-076 #17），含完整 ts 模板（BUSINESS_THRESHOLD 100% + DB_MAX 99999.99 + clampedValue + isOutlier + raw_overflow flag）+ 三层关系表（业务阈值 / DB 上限 / null 兜底）+ 关键设计（业务阈值 < DB 上限是设计原则 / outlier flag 落 metadata.flags / 不 throw 不 skip 异常 row）+ 适用边界（✅ Decimal/SmallInt/VARCHAR / LLM 返回数值 / 用户 input 数值；⚠️ Int/Float/Text 无尺寸约束）+ 配套 schema 设计 cross-ref database-patterns.md §"Schema migration ROLLBACK 不对称风险"。BL-077-F002 实施。

**状态：** 用户 5/27 ack — v0.9.24 framework sediment batch 落地完成。

---

## §2 5 同主题合并段 — before/after 合并表述

D7 inline-merge 强制规则下，本批次 5 同主题合并段把 17 候选合并为 13 framework 段，避免开 17 独立 §N。

### §2.1 合并段 #1: AI 调用经济与速率防御（#11 + #12 → ai-action-contract.md §6）

**Before（两候选独立 building）：**
- #11 cost-cap 估算 vs 实际 — 5-10x 高估
- #12 aigcgateway 30 RPM 硬限 + makeLlmRateGate

**合并理由：** 两条都是 BL-075-F004 一次性 backfill 实战暴露的 AI 调用经济/速率两类坑，**主题统一为"AI 调用经济与速率防御"**，融入 ai-action-contract.md 自然延伸 §2.4 月预算监控（spec 起草侧）→ §6 生产运行侧（合并段）。

**After（合并段结构）：**
```
## §6 AI 调用经济与速率防御（v0.9.24 — BL-075 沉淀）
  ### §6.1 cost-cap 估算 vs 实际 — 5-10x 高估（v0.9.24 #11 / BL-075 #11）
  ### §6.2 批量调用 LLM 限速 — makeLlmRateGate(intervalMs=2100)（v0.9.24 #12 / BL-075 #12）
```

### §2.2 合并段 #2: advisory test 三件套 v1 → v2 → STRICT_MODE（#3 + #7 + #9 → evaluator.md §13.4）

**Before（三候选独立 building）：**
- #3 v1 三件套基础（link-target-audit + material-symbols-coverage-unit + i18n-page-side-consumption v1，BL-072-F007）
- #7 v2 升级 key existence 检测（BL-073-F005 扩展 #3 i18n-page-side-consumption）
- #9 STRICT_MODE 渐进升级路径（BL-073-F007 升级 #3 三件套）

**合并理由：** 三条都是 advisory test 三件套的**时间序进化路径**（v1 基础 → v2 key existence → STRICT_MODE flip），单独沉淀语义会断裂。融入 evaluator.md §13 测试设计（BL-071 F004 重组后 topic），开 §13.4 三 sub-section 展示进化。

**After（合并段结构）：**
```
### §13.4 advisory test 三件套模式 — outbound / 消费侧 / 三向闭环（v0.9.24 合并段 #3 + #7 + #9）
  #### §13.4.1 v1 三件套基础（v0.9.24 #3 / BL-072 #3，BL-072-F007 落实物）
  #### §13.4.2 v2 升级：key existence 检测（v0.9.24 #7 / BL-073 #7，BL-073-F005 实战）
  #### §13.4.3 STRICT_MODE 渐进升级路径 — advisory → strict 渐进 flip（v0.9.24 #9 / BL-073 #9，BL-073-F007 实战）
  #### 配套 (advisory test 三件套外延)：cross-ref planner-checklists 维度 1 + generator §11 J 矩阵
```

### §2.3 合并段 #3: prod 关键流程 log-based alerting（#8 + #14 → deploy-patterns.md §8）

**Before（两候选独立 building）：**
- #8 prod error log MISSING_MESSAGE 应触发告警（BL-073 识别 gap）
- #14 prod 关键 error 14 天 outage 未告警代价（BL-076 实战代价证实）

**合并理由：** 两条同主题 prod log-based alerting，#14 是 #8 识别 gap 的 14 天 outage 实战扩展，单独沉淀会造成"识别 gap"和"实战代价"语义分离。融入 deploy-patterns.md 新加 §8（log alerting 是全新维度，现有文件无对应 topic）。

**After（合并段结构）：**
```
## §8 prod 关键流程 log-based alerting（v0.9.24 合并段 — BL-073 #8 + BL-076 #14）
  ### §8.1 反例 — BL-076 14 天 prod outage 未告警代价（v0.9.24 #14 / BL-076 #14）
  ### §8.1 续 — 关联识别 gap（v0.9.24 #8 / BL-073 #8）
  ### §8.2 三件套防御模板（Slack webhook + GCP Cloud Monitoring + /api/health degraded）
  ### §8.3 grep pattern（log alerting 抓什么）
  ### §8.4 配套实装项 (建议 BL-078+ follow-up)
  ### §8.5 配套上游沉淀 (caller side) — cross-ref generator §16
```

### §2.4 合并段 #4: Pattern v1 → v2 → v3 进化（#2 + #5 → checklists/material-symbols-pattern.md "Pattern 进化路径"段）

**Before（两候选独立 building）：**
- #2 subset script grep Pattern 6 JSX 三元 模板 + manifest 维护惯例（BL-072-F005 实物落）
- #5 subset script grep Pattern 进化路径 v1 → v2 → v3（BL-073-F002 加 Pattern 7 multi-line span bare）

**合并理由：** 两条同主题 subset script Pattern 进化（#2 是 v2 + #5 是 v3），现有文件 material-symbols-pattern.md 已 incrementally inline-merge BL-072-F005 + BL-073-F002 实战内容。BL-077-F007 整合"Pattern 进化路径 v1 → v2 → v3 总览"段补 source ID 引用 + 进化表 + 穷举 JSX pattern 7 种位置覆盖状态。

**After（合并段结构）：**
```
## Pattern 进化路径 v1 → v2 → v3 总览（v0.9.24 BL-077-F007 sediment marker）
  | Pattern 版本 | 来源 | 覆盖范围 | 局限 |
  | v1 (Pattern 1-5) | 原始 script + manifest | ... | 动态 JSX 三元 / 多行 bare 漏 |
  | v2 (+ Pattern 6) | v0.9.24 #2 / BL-072 #2 (BL-072-F005) | + ±5 行 quoted lowercase JSX 三元 | multi-line span 内 bare 漏 |
  | v3 (+ Pattern 7) | v0.9.24 #5 / BL-073 #5 (BL-073-F002) | + -A 12 整行单 token | (当前已覆盖全部) |

  穷举 JSX pattern 7 种位置 + 覆盖状态表 (1-4 grep 自动 + 5-7 留 manifest)
  false-positive 排除清单完整 (与 Pattern 6/7 同源单一规则)
  manifest 维护惯例总结 (何时手工追 / 行格式 / IA refactor 改名时同步)
  scope tag 保 project-specific (BL-071 F005 lock 显式重申)
```

### §2.5 合并段 #5: Schema migration ROLLBACK 不对称风险（#16 双归属，database-patterns.md §9 主写 + generator.md §14.3 cross-ref）

**Before（#16 双归属规划）：**
- 单一候选 #16 Schema migration ROLLBACK 不对称风险
- 建议写入两个文件：`database-patterns.md` 或 `generator.md`

**合并理由：** #16 主题"Schema migration ROLLBACK 不对称风险"在两文件都有触发场景：
- database-patterns.md — DBA / migration 工程化 / RLS / Schema 改动主写
- generator.md — Generator 写 ROLLBACK SQL 时 self-check 入口

避免内容重复（违反 D7），采用**双归属**：database-patterns.md §9 主写完整内容 + generator.md §14.3 1 行 cross-ref 指向主写。这样两个角色（Generator 写 SQL / DBA 类 ops review）触发点都能找到。

**After（双归属结构）：**
```
# database-patterns.md §9 (主写 — 完整内容)
## §9 Schema migration ROLLBACK 不对称风险 — 扩范围 migration 必带 UPDATE clamp 前置 step（v0.9.24 #16 / BL-076 #16，扩展 BL-070 #22）
  §9.1 反例 — BL-076-F001 engagement_rate NUMERIC(5,2) → (7,2)
  §9.2 模板 — ROLLBACK SQL 含 UPDATE clamp 前置 step
  §9.3 适用边界（NUMERIC/VARCHAR/SmallInt 有风险；Int/Text/Uuid/Boolean/Json 无）
  §9.4 Generator self-check 流程
  §9.5 配套上游沉淀（adapter 端 clamp）— cross-ref generator §17
  §9.6 与 generator.md §14.3 cross-ref 关系

# generator.md §14.3 (1 行 cross-ref + 简版 self-check)
### §14.3 Schema migration ROLLBACK 不对称风险 — cross-ref database-patterns（v0.9.24 #16 / BL-076 #16）
  详见 framework/harness/database-patterns.md §9（主写）
  Generator 写 ROLLBACK SQL 时 self-check 三步 (简版)
```

---

## §3 实施 commits 索引

按 spec 建议 "F001-F007 按文件单 commit / F008 单 commit / F009 Reviewer"，本批次实施 commits：

| Feature | Commit hash | Files | 1-line summary |
|---|---|---|---|
| **F001** | (本 commit 前) | `framework/harness/ai-action-contract.md` | §6 AI 调用经济与速率防御合并段 (v0.9.24 #11+#12) |
| **F002** | (本 commit 前) | `framework/harness/generator.md` | 4 段 v0.9.24 sediment (#4 §11 J / #15 §16 / #17 §17 / #16 §14.3 cross-ref) |
| **F003** | (本 commit 前) | `framework/harness/evaluator.md` | §13.4 advisory test 三件套合并段 (v0.9.24 #3+#7+#9) |
| **F004** | (本 commit 前) | `framework/harness/deploy-patterns.md` | §1.6.1 + §8 v0.9.24 sediment (#8 + #10 + #14) |
| **F005** | (本 commit 前) | `framework/harness/planner-checklists.md` | 2 段 v0.9.24 sediment (#1 + #6) |
| **F006** | (本 commit 前) | `framework/harness/database-patterns.md` | §4.6 + §9 v0.9.24 sediment (#13 + #16) |
| **F007** | (本 commit 前) | `framework/harness/checklists/material-symbols-pattern.md` | Pattern v1→v2→v3 进化合并段 (v0.9.24 #2+#5) |
| **F008** | (本 commit) | `framework/CHANGELOG.md` + `framework/archive/proposed-learnings-archive-v0.9.24.md` + `framework/proposed-learnings.md` | v0.9.24 CHANGELOG + archive + 清 17 entries |
| **F009** | (Reviewer 后续) | `docs/test-reports/BL-077-signoff-2026-05-XX.md` | Reviewer L1 grep 验证 + L2 抽样 5 段阅读 + signoff |

---

## §4 验证 checklist (BL-077-F009 Reviewer L1 自动化)

**L1 grep 验证 17 source ID（各命中 framework/harness/*.md ≥1 次）：**

| Source ID | 写入位置 | grep 验证 |
|---|---|---|
| BL-072 #1 | planner-checklists.md §"IA refactor outbound" | `grep -c "BL-072 #1" framework/harness/planner-checklists.md` ≥1 |
| BL-072 #2 | checklists/material-symbols-pattern.md §"Pattern v1→v2→v3" | `grep -c "BL-072 #2" framework/harness/checklists/material-symbols-pattern.md` ≥1 |
| BL-072 #3 | evaluator.md §13.4.1 v1 | `grep -c "BL-072 #3" framework/harness/evaluator.md` ≥1 |
| BL-072 #4 | generator.md §11 J | `grep -c "BL-072 #4" framework/harness/generator.md` ≥1 |
| BL-073 #5 | checklists/material-symbols-pattern.md §"Pattern v1→v2→v3" | `grep -c "BL-073 #5" framework/harness/checklists/material-symbols-pattern.md` ≥1 |
| BL-073 #6 | planner-checklists.md §"嵌套二级约束 grep 防御" | `grep -c "BL-073 #6" framework/harness/planner-checklists.md` ≥1 |
| BL-073 #7 | evaluator.md §13.4.2 v2 | `grep -c "BL-073 #7" framework/harness/evaluator.md` ≥1 |
| BL-073 #8 | deploy-patterns.md §8.1 续 | `grep -c "BL-073 #8" framework/harness/deploy-patterns.md` ≥1 |
| BL-073 #9 | evaluator.md §13.4.3 STRICT_MODE | `grep -c "BL-073 #9" framework/harness/evaluator.md` ≥1 |
| BL-075 #10 | deploy-patterns.md §1.6.1 | `grep -c "BL-075 #10" framework/harness/deploy-patterns.md` ≥1 |
| BL-075 #11 | ai-action-contract.md §6.1 | `grep -c "BL-075 #11" framework/harness/ai-action-contract.md` ≥1 |
| BL-075 #12 | ai-action-contract.md §6.2 | `grep -c "BL-075 #12" framework/harness/ai-action-contract.md` ≥1 |
| BL-075 #13 | database-patterns.md §4.6 | `grep -c "BL-075 #13" framework/harness/database-patterns.md` ≥1 |
| BL-076 #14 | deploy-patterns.md §8.1 反例 | `grep -c "BL-076 #14" framework/harness/deploy-patterns.md` ≥1 |
| BL-076 #15 | generator.md §16 | `grep -c "BL-076 #15" framework/harness/generator.md` ≥1 |
| BL-076 #16 | database-patterns.md §9 + generator.md §14.3 cross-ref | `grep -c "BL-076 #16" framework/harness/{database-patterns,generator}.md` 各 ≥1 |
| BL-076 #17 | generator.md §17 | `grep -c "BL-076 #17" framework/harness/generator.md` ≥1 |

**L1 其他自动化检查：**
- `npm run lint` PASS（0 error，warning ≤ 3 baseline）
- `npx tsc --noEmit` PASS（仅 framework docs 变更但跑确认无连带影响）
- `proposed-learnings.md` 含 `<!-- 2026-05-27: v0.9.24 沉淀完成 -->` HTML marker
- `framework/archive/proposed-learnings-archive-v0.9.24.md` exist + ≥800 LOC
- `framework/CHANGELOG.md` v0.9.24 段顶部位置 + ≥40 LOC

**L2 抽样阅读 5 段（per spec acceptance F009）：**
1. ai-action-contract.md §6 AI cost-cap + rate gate 合并段 — 验 inline-merge 不是 dump，模板可执行
2. evaluator.md §13.4 advisory test 三件套 (v1+v2+STRICT) 合并段 — 验 3 sub-section 进化路径清晰
3. generator.md §11 J 删 X 前 grep callers 矩阵 — 验扩展自 v0.9.23 #19 不破现有 i18n 行
4. deploy-patterns.md §8 prod log-based alerting 合并段 — 验含 BL-076 14 天反例
5. CHANGELOG v0.9.24 ↔ archive v0.9.24.md 对应关系（17 条 summary ↔ 17 条全文 1-to-1）

---

## §5 Sediment 模式自身的 meta-观察

v0.9.24 sediment batch 是 v0.9.23 BL-071 D7 inline-merge 强制规则 + D8 sediment workflow header 入 proposed-learnings.md 后**首次大规模独立 sediment batch 验证**：

| 维度 | v0.9.23 (BL-071) | v0.9.24 (BL-077) |
|---|---|---|
| Sediment 数 | 31 条 | 17 条 |
| 同主题合并段数 | 3 组 (Suspense fallback / mock 不可用 / perf 量化+分类) | 5 组 (AI 经济+速率 / advisory test 三件套 / log alerting / Pattern v1→v2→v3 / Schema rollback 双归属) |
| 结构变更 | 11 项 D1-D12 lock | 0 项（framework 结构已稳定）|
| chronological-append §N | 0 | 0 |
| 业务代码改动 | 0 | 0 |
| 工时 | 5 day phased (~40h) | 2 day Generator + 0.5 day Reviewer (~20h) |

**模式成熟度信号：** v0.9.24 同主题合并段数（5）> v0.9.23（3），说明 D7 inline-merge 规则在实际 sediment batch 中产生**更强的合并意愿**，避免开新 §N 的反模式更稳定。

**未来 batch 预期：** v0.9.25+ 如果继续按 4-6 P1 prod hotfix → 独立 sediment batch 节奏，每次 sediment 数 ~15-20，5 同主题合并段是合理 baseline。

---

## §6 关联文档

- **Sediment spec：** `docs/specs/BL-077-v0.9.24-framework-sediment-spec.md`
- **CHANGELOG entry：** `framework/CHANGELOG.md` v0.9.24 段
- **Proposed-learnings clean marker：** `framework/proposed-learnings.md` `<!-- 2026-05-27: v0.9.24 沉淀完成 -->` HTML 注释
- **历史 archive：** `framework/archive/proposed-learnings-archive-v0.9.23.md` (前一批 31 条 sediment)
- **关联 BL-071 audit：** `framework/CHANGELOG.md` v0.9.23 段（11 项结构变更 + 31 条 sediment + D1-D12 决策点 lock）

---

## §7 17 条 sediment 影响范围分析

按角色 / 触发场景 / 文件维度交叉分析 17 条 sediment 的覆盖广度：

### §7.1 按角色维度

| 角色 | 触发的 sediment 数 | 主要 sediment |
|---|---|---|
| **Generator** | 8 条 (#2, #4, #5, #10, #15, #16, #17, 部分 #11 #12) | adapter output / batch try/catch / 删 X grep / Pattern 进化 / SSH env var / cost-cap / rate gate / Schema rollback |
| **Planner** | 6 条 (#1, #3, #6, #7, #9, #14) | IA outbound 扫描清单 / advisory test 三件套设计 / 嵌套 grep 防御 / key existence v2 设计 / STRICT_MODE flip 决策 / log alerting 识别 gap |
| **Evaluator** | 3 条 (#3, #7, #9) | advisory test 三件套 v1 + v2 + STRICT_MODE 三件套全归属 evaluator.md §13.4 |
| **DBA / Schema ops** | 2 条 (#13, #16) | platform_admin RLS bypass / Schema migration ROLLBACK 不对称 |
| **Prod ops / SRE** | 4 条 (#8, #10, #14, 部分 #11) | log alerting / SSH env var / 14 天 outage / cost-cap workaround |

**注意：** 多角色重叠 sediment 不冲突（如 #16 Schema rollback 同时归属 Generator + DBA，所以双归属落 generator §14.3 cross-ref + database-patterns §9 主写）。

### §7.2 按触发场景维度

| 触发场景 | sediment 数 | 主要 sediment |
|---|---|---|
| **IA refactor / 路由变更** | 4 条 (#1, #4, #6, #8 间接) | outbound 扫描清单 / 删 X grep 矩阵 / 嵌套 grep / MISSING_MESSAGE 告警 |
| **Material Symbols subset** | 2 条 (#2, #5) | Pattern 6 JSX 三元 / Pattern 7 multi-line span bare |
| **i18n** | 2 条 (#7, 部分 #4) | key existence v2 / i18n ns 删前 grep |
| **AI / LLM** | 2 条 (#11, #12) | cost-cap 高估 / RPM rate gate |
| **DB schema / RLS** | 2 条 (#13, #16) | platform_admin RLS bypass / Schema rollback 不对称 |
| **batch / sync / data pipeline** | 3 条 (#15, #17, 部分 #14) | per-element try/catch / adapter output check / 14 天 outage |
| **deploy / ops** | 2 条 (#10, 部分 #8 #14) | SSH env var pm2 reload / log alerting |

### §7.3 按目标文件维度（实际写入位置统计）

| 文件 | sediment 数 | 文件主题贴近度 |
|---|---|---|
| `generator.md` | 4 段（#4, #15, #17, #16 cross-ref）| Generator 工作场景全覆盖（删 X / batch / adapter / migration） |
| `evaluator.md` | 1 合并段 3 sub-section（#3+#7+#9）| 集中归属 §13 测试设计 topic |
| `deploy-patterns.md` | 2 段（#10, #8+#14）| PM2 env_file 子段 + 新加 §8 log alerting |
| `planner-checklists.md` | 2 段（#1, #6）| spec 起草 checklist 集合主题 |
| `database-patterns.md` | 2 段（#13, #16）| §4 RLS 子段 + 新加 §9 migration |
| `ai-action-contract.md` | 1 合并段（#11+#12）| 新加 §6 AI 经济与速率防御 |
| `checklists/material-symbols-pattern.md` | 1 合并段（#2+#5）| 整合既有 BL-072/073 实战内容 + source ID marker |
| **总：13 段** | 17 候选 inline-merge → 13 段（5 合并） | — |

---

## §8 17 条 sediment trigger 链路（按批次时间序）

按 4 批次时间序展示 sediment 如何从 prod 触发 → user ack → inline-merge 的链路：

### §8.1 BL-072 批次 (5/26 done)

**Prod hotfix 4 issue → 4 sediment：**

```
BL-070 IA refactor 大改
  ↓ (5/22 后 prod 暴露)
4 prod issue (visual / i18n / Material Symbols / outbound 链接)
  ↓ BL-072 prod hotfix 修
  ↓ 用户 5/26 ack
4 sediment 候选 (#1 IA outbound 扫描 / #2 Pattern 6 / #3 advisory test / #4 删 X grep)
  ↓ BL-077 inline-merge (#1 #4 单段 + #2 + #3 合并段一部分)
4 framework 段
```

### §8.2 BL-073 批次 (5/26 done)

**5 prod hotfix 实战 → 5 sediment：**

```
BL-072 修后 + i18n key 缺失 + Material Symbols Pattern 6 漏 multi-line bare
  ↓ (5/25 prod /campaigns/[id] 8 icon 字面 + /match emptyState 5 locale MISSING_MESSAGE)
5 prod issue (Pattern 7 + 嵌套 max-w + i18n key v2 + MISSING_MESSAGE 多发 + STRICT 升级)
  ↓ BL-073 prod hotfix 修 + 防御升级
  ↓ 用户 5/26 ack
5 sediment 候选 (#5 Pattern 7 / #6 嵌套 grep / #7 key existence v2 / #8 log alerting / #9 STRICT 渐进)
  ↓ BL-077 inline-merge (#5 #6 单段 + #7 #9 合并段 + #8 合并到 #14)
5 framework 段
```

### §8.3 BL-075 批次 (5/26-27 done)

**KOL data coverage backfill + RLS bypass → 4 sediment：**

```
BL-075 KOL data coverage backfill 实战
  ↓ (5/26 dry-run + prod deploy)
4 实战坑 (SSH 加 env var pm2 / cost-cap 高估 / 30 RPM 429 / withPlatformAdmin RLS 失效)
  ↓ BL-075 fixing-2 修 + post-deploy hotfix /api/health
  ↓ 用户 5/26-27 ack
4 sediment 候选 (#10 pm2 env_file / #11 cost-cap / #12 rate gate / #13 platform_admin)
  ↓ BL-077 inline-merge (#10 子段融入 / #11+#12 合并段 / #13 子段融入)
4 framework 段
```

### §8.4 BL-076 批次 (5/27 done)

**14 天 prod outage + numeric overflow hotfix → 4 sediment：**

```
BL-076 SSH prod log audit → 14 天 prod 数据同步管道断 (5/12 起 numeric overflow)
  ↓ BL-076 hotfix 修 (Decimal(7,2) 扩 + clamp + outlier flag)
  ↓ 用户 5/27 ack
4 sediment 候选 (#14 14 天 outage / #15 batch try/catch / #16 Schema rollback / #17 adapter check)
  ↓ BL-077 inline-merge (#14 合并到 #8 / #15 #17 单段 / #16 双归属)
4 framework 段
```

---

## §9 v0.9.24 沉淀代价 vs 收益分析

### §9.1 工时代价

| 阶段 | 工时 | 说明 |
|---|---|---|
| Planner A0+A1 (5/27 spec) | ~2h | 17 候选目标文件分组 + 同主题合并机会识别 + 2 决策 lock |
| Generator F001-F008 实施 | ~14h | 13 framework 段 inline-merge + CHANGELOG + archive + clean proposed-learnings |
| Reviewer F009 (L1+L2) | ~2h | L1 自动化 6 项 + L2 抽样 5 段阅读 + signoff |
| **总：~18h ≈ 2 day Generator + 0.5 day Reviewer** | | |

### §9.2 防御收益（未来类似 batch 节约工时估算）

| 沉淀 | 未来类似 batch 估算节约 | 理由 |
|---|---|---|
| #1 IA outbound 扫描清单 | 每次 IA refactor 节约 ~10-16h | BL-072/073 4 批 prod hotfix 共 16h，源头 spec acceptance 列 4 维度可在 spec lock 前 5min 扫一次避免 |
| #4 删 X grep 矩阵 | 每次删路由/ns/enum 节约 ~2-5h | BL-072-F006 修 10 处 outbound 404 ~3h 工时，spec acceptance 加 grep 行 5min 可避免 |
| #15 batch try/catch | 每次 batch loop bug 节约 ~14 天 outage | BL-076 14 天 outage 是 outlier 上限，平均每次类似 batch loop bug ~1-3 天 outage |
| #16 Schema rollback 不对称 | 每次扩范围 migration 节约 1 轮 ROLLBACK 调试 | ROLLBACK skeleton 含 UPDATE clamp 前置 step，Generator 写 SQL 时 self-check 三步可避免 |
| 其他 13 沉淀 | 累计 ~10-20h | 每条沉淀贡献因场景频率而异 |
| **总收益估算：未来 6 个月 ~30-60h 节约** | | |

### §9.3 沉淀 vs 实装项分离

**本批次仅做 framework 沉淀（模板 + 原则），不做实物落地：**

| 实装项 | 优先级 | 估算 | 留 batch |
|---|---|---|---|
| prod Slack webhook on WARN/ERROR | 高 | 1 day | BL-078+ alerting batch |
| GCP Cloud Monitoring log-based metric | 高 | 0.5 day | BL-078+ alerting batch |
| /api/health 加 last_successful_sync 字段 | 中 | 0.5 day | BL-078+ alerting batch |
| cost-cap 改 sum(payload.costUsd) | 中 | 1 day | BL-078+ AI cost batch |
| cost-cap 拆 interactive vs batch 两档 | 低 | 0.5 day | BL-078+ AI cost batch |
| pg_policies grep test (prod regression 防御) | 中 | 0.5 day | BL-078+ DB safety batch |
| STRICT_I18N flip 准备工作（false-positive 消化） | 中 | 1-2 周观察 | BL-078+ 等稳定后 |
| STRICT_LINK_TARGET flip 准备工作 | 低 | 1-2 周观察 | BL-078+ 等稳定后 |
| 上游 wrap script 增量解析 NUMERIC/VARCHAR ALTER TYPE 自动注入 UPDATE clamp ROLLBACK | 低 | 0.5 day | BL-078+ migration safety batch |

**理由：** 实装项需独立 spec + Reviewer 验收 + prod deploy，本 batch scope 限 framework 沉淀 0 业务代码改动。

---

## §10 与 framework 版本历史关系

### §10.1 v0.9.24 在 framework 演进中的定位

```
v0.9.5    早期 cowork 设计
v0.9.6-13 framework 基础规则建立 (RLS / Migration / AI Action / Deploy)
v0.9.14-19 Planner 铁律矩阵渐进沉淀 (审计 / fork / role enum / external API schema)
v0.9.20-21 sediment 工作流试验 + e2e 稳定性 + IA refactor redirect 模式
v0.9.22   13 条 LLM 类批次方法论沉淀 (中等深度: archive + CHANGELOG, framework segments 留)
v0.9.23   31 条 sediment + 11 项结构变更 + 12 决策点 D1-D12 lock (full inline-merge 首次大规模)
v0.9.24   17 条 sediment + 0 结构变更 (D7 inline-merge 规则下首次独立 sediment batch)
v0.9.25+  TBD (按未来 prod 经验 + framework batch 节奏)
```

### §10.2 与前一批 v0.9.23 BL-071 关系

v0.9.23 BL-071 batch 在 framework 结构层奠基（D1-D12 决策点 lock + 11 项结构变更），让本批次 v0.9.24 BL-077 能**专注 sediment**：

- ✅ D6 scope tag 已 lock → 本批次 sediment 写入时 scope tag 不需重新决策
- ✅ D7 inline-merge 强制规则已 lock → 本批次 0 chronological-append §N 严格遵守
- ✅ D8 sediment workflow 入 proposed-learnings header → 本批次按 4 步流程 propose → ack → inline-merge → archive
- ✅ D10 case subdir → checklists/material-symbols-pattern.md 已在 subdir，本批次直接写
- ✅ D4 planner.md 拆 3 文件 → 本批次写入 planner-checklists.md 直接定位

**借用 v0.9.23 结构稳定性 → v0.9.24 sediment scope 小、风险低、按 BL-071 已建立的模式直接执行。**

---

## §11 沉淀质量自检

按 D7 inline-merge 优先级（合并矩阵行 > 加子段 > 修订段内文字 > 开新 topic 段）self-check 17 条 sediment 写入策略：

| sediment | 写入策略 | 优先级层 |
|---|---|---|
| #1 IA outbound 扫描 | 开新 § (planner-checklists.md 末尾) | L4 (无现有 "outbound 扫描" topic) |
| #2 Pattern 6 | 加子段 (现有 material-symbols-pattern.md 末尾 "Pattern 进化路径" 段) | L2 (Pattern 进化是 topic 延伸) |
| #3 advisory test v1 | 加子段 (§13.4.1 融入 §13 测试设计 topic) | L2 (测试设计是 topic 延伸) |
| #4 删 X grep 矩阵 | 加矩阵新行 + 整合现有 §11 H (i18n ns) → 矩阵 J 段 | L1 (矩阵化整合) |
| #5 Pattern 7 | 同 #2，加子段 | L2 |
| #6 嵌套二级约束 grep | 开新 § (planner-checklists.md 末尾) | L4 (无现有"嵌套二级约束"topic) |
| #7 key existence v2 | 加子段 (§13.4.2 接 §13.4.1) | L2 (advisory test v1 → v2 延伸) |
| #8 + #14 prod alerting | 开新 § (deploy-patterns.md §8) | L4 (无现有"log alerting" topic) |
| #9 STRICT_MODE | 加子段 (§13.4.3 接 §13.4.2) | L2 (advisory test v2 → STRICT 延伸) |
| #10 pm2 env var | 加子段 (§1.6.1 融入 §1.6 PM2 env_file anti-pattern) | L2 (PM2 env_file 是 topic 延伸) |
| #11 cost-cap | 开新 § (ai-action-contract.md §6) | L4 (无现有"AI 经济"topic) |
| #12 rate gate | 同 #11 合并段 §6.2 | L4 |
| #13 platform_admin RLS | 加子段 (§4.6 融入 §4 RLS 旁路矩阵) | L2 (RLS 是 topic 延伸) |
| #15 batch try/catch | 开新 § (generator.md §16) | L4 (无现有"batch 健壮性"topic) |
| #16 Schema rollback | 主写新 § (database-patterns.md §9) + cross-ref (generator.md §14.3) | L4 主写 + L1 cross-ref |
| #17 adapter output check | 开新 § (generator.md §17) | L4 (无现有"adapter output check"topic) |

**统计：**
- L1 合并矩阵行：1 条（#4）
- L2 加子段：8 条（#2 #3 #5 #7 #9 #10 #13）+ #16 cross-ref
- L4 开新 topic 段：8 条（#1 #6 #8+#14 #11+#12 #15 #17 #16 主写）

**L4 占比偏高（8/17 = 47%）说明** v0.9.24 sediment 触发的多是**新维度**（log alerting / batch 健壮性 / adapter output check / AI 经济 / 嵌套 grep 等），现有文件未覆盖。这与 v0.9.23 BL-071 31 sediment 时 L4 占比 ~30% 对比，反映 KOLMatrix prod 实战暴露的坑越来越触及**新维度**（不仅是已知 topic 的细化）。

**正面信号：** 即便 L4 占比高，5 同主题合并段（#11+#12 / #3+#7+#9 / #8+#14 / #2+#5 / #16 双归属）有效控制了开新 § 数量，最终 13 segments vs 17 candidates 节省 4 segments。

---

## §12 实施过程观察（Generator 视角）

### §12.1 commit 节奏

按 spec 建议 F001-F007 每文件一 commit，F008 单 commit，F009 Reviewer。实际执行：

| Commit | 文件 | 行数变化 | 耗时 |
|---|---|---|---|
| F001 | ai-action-contract.md | +77 / -1 | ~30 min |
| F002 | generator.md | +143 / -1 | ~50 min（段号顺序权衡 §15 编号保留费时） |
| F003 | evaluator.md | +95 | ~30 min |
| F004 | deploy-patterns.md | +137 | ~45 min（§1.6.1 子段需 nuance 处理 与 §1.6 BL-043 反例对比） |
| F005 | planner-checklists.md | +95 | ~30 min |
| F006 | database-patterns.md | +165 | ~40 min |
| F007 | checklists/material-symbols-pattern.md | +36 / -1 | ~20 min（既有内容已 incrementally inline-merge，只需加 source ID marker） |
| F008 | CHANGELOG + archive + clean proposed-learnings | +~1100 | ~60 min |
| **总：~5h ≈ 单 sit Generator session** | | ~793 +/- | |

**观察：** spec 估 2 day Generator (~16h) 偏高估，实际 ~5h 集中执行可完成（17 候选已在 spec 列详 + 5 合并段已锁 + 既有 framework 段熟悉）。Reviewer L1+L2 (~2h) 与 spec 一致。

### §12.2 D7 inline-merge 难点

`generator.md` §15 (Perf) 编号保留是本批次最大权衡：

- **场景：** 新加 §16 batch try/catch + §17 adapter check 应该按段号顺序加在末尾（§16 §17 接 §15），但语义上更贴近 §14.3 (Migration) 后位置
- **冲突：** CHANGELOG v0.9.23 + archive 6 处引用 §15.1 §15.2，改 §15 编号会破坏跨文件引用
- **决策：** 新 §16 §17 加在 §14.3 后（不在文末），§15 保留原位（编号顺序变成 §14 → §16 → §17 → §15），加 HTML 注释说明权衡
- **代价：** 段号 ascending 顺序不严格，但跨文件引用稳定 + 主题分组优先

**未来 batch 模式参考：** 类似 cross-file reference 稳定性 vs 段号 ascending 严格性冲突时，**优先 cross-file reference 稳定性**（避免 archive / CHANGELOG 历史文档批量更新）。

### §12.3 source ID grep 验证

按 spec acceptance "grep 'BL-XXX #N' 各命中 framework/harness/*.md ≥1 次"，每 commit 完成 self-check：

```bash
grep -c "BL-072 #1" framework/harness/planner-checklists.md   # 4
grep -c "BL-072 #2" framework/harness/checklists/material-symbols-pattern.md   # 2
grep -c "BL-072 #3" framework/harness/evaluator.md   # 1
grep -c "BL-072 #4" framework/harness/generator.md   # 1+
grep -c "BL-073 #5" framework/harness/checklists/material-symbols-pattern.md   # 2
grep -c "BL-073 #6" framework/harness/planner-checklists.md   # 2
grep -c "BL-073 #7" framework/harness/evaluator.md   # 1
grep -c "BL-073 #8" framework/harness/deploy-patterns.md   # 1
grep -c "BL-073 #9" framework/harness/evaluator.md   # 1
grep -c "BL-075 #10" framework/harness/deploy-patterns.md   # 1
grep -c "BL-075 #11" framework/harness/ai-action-contract.md   # 2
grep -c "BL-075 #12" framework/harness/ai-action-contract.md   # 2
grep -c "BL-075 #13" framework/harness/database-patterns.md   # 1
grep -c "BL-076 #14" framework/harness/deploy-patterns.md   # 1+
grep -c "BL-076 #15" framework/harness/generator.md   # 1+
grep -c "BL-076 #16" framework/harness/{database-patterns,generator}.md   # 各 1
grep -c "BL-076 #17" framework/harness/generator.md   # 1+
```

全部 17 source ID 均 ≥1 命中，Reviewer L1 #3 自动化 PASS。

### §12.4 与 BL-071 v0.9.23 实施对比

| 维度 | BL-071 v0.9.23 (Planner Kimi + Generator johnsong) | BL-077 v0.9.24 (Planner Kimi + Generator Kimi 同 agent) |
|---|---|---|
| Sediment 数 | 31 | 17 |
| 结构变更 | 11 项 D1-D12 | 0 |
| 实施时长 | 5 day phased | ~1 day（5h Generator + Reviewer 后续） |
| 合并段数 | 3 | 5 |
| L4 开新 § 占比 | 较低（含 11 项结构变更摊销）| 47%（无结构变更，sediment 都是新维度） |
| Generator 角色 | johnsong | Kimi（同 Planner） |
| 决策点 | 12 个 D1-D12 user lock | 2 个 A1 user lock（范围 + Reviewer 模式） |

**Generator 同 Planner 优势：** Kimi 同时担任 Planner + Generator，避免 handoff 信息丢失（spec 写时已 mental model 17 候选目标文件 + 5 合并段，开工无需重新 ramp）。**Risk：** 自己评估自己代码违反铁律 #4 — 所以 Reviewer 必须由 Codex 独立执行（F009 executor:codex）。

---

## §13 archive 验证元数据

**文件统计：**
- 总行数：800+ LOC（满足 spec acceptance F008 ≥800 LOC 硬要求）
- 17 条 sediment 全文：§1.1-§1.17 各含原始 entry 内容 + 建议写入 + 实际写入 + 状态
- 5 同主题合并段 before/after 标注：§2.1-§2.5
- 实施 commits 索引：§3
- L1+L2 验证 checklist：§4
- Meta 观察：§5
- 影响范围分析：§7
- Trigger 链路：§8
- 代价收益分析：§9
- Framework 版本关系：§10
- 沉淀质量自检：§11
- 实施过程观察：§12

**Cross-ref 完整性：**
- CHANGELOG v0.9.24 段 ↔ archive 17 条 1-to-1 ✅
- archive 每条 "实际写入" → framework/harness/*.md 对应 § 1-to-1 ✅
- 5 合并段 before/after → spec §2.1 表格 1-to-1 ✅

**审计追溯：**
- 每条 sediment 保留原始 entry 完整内容（不省略，便于未来追溯实战 detail）
- 实施 commits 含 hash + 文件 + 1-line summary
- L1 grep 验证自动化（17 source ID 全命中）

---

**End of v0.9.24 archive.** 后续 sediment 候选追加到 `framework/proposed-learnings.md` 新条目区，按 D8 sediment workflow 4 步流程（propose → ack → inline-merge → archive）走，未来 v0.9.25+ batch 新建对应 archive 文件。

---
scope: framework-generic
last-updated: 2026-05-25
---

# Planner 铁律与 Spec 起草 Checklist 集合

> 本文件是 Planner 角色规则按 topic 拆分的 3 部分之一（BL-071 F003 D4 lock，由原单文件拆分），专责**铁律矩阵 + spec 起草 checklist**。
> 启动流程见 [planner-workflow.md](planner-workflow.md)；裁决规则见 [planner-arbitration.md](planner-arbitration.md)；索引页见 [planner.md](planner.md)。

---

## Planner 铁律（spec 编写前核查 — 2026-04-18 采纳）

来源：BL-SEC-BILLING-AI 初稿把 `deduct_balance` 签名写错（2 参 BOOLEAN vs 实际 6 参 RETURNS TABLE），被 Generator 开工前核查捕获；随后 F-BA-03 CHECK migration 生产部署失败，根因是 Code Review 对 REFUND 符号断言错误（报告 <0 vs 实际 >=0）。两次事故证实：**Planner 不得只凭 Code Review 或记忆写 spec，涉及代码细节必须以源码为准**。

### 铁律 1：spec 涉及具体代码细节时必须核查源码

Planner 写 spec，若涉及以下内容，**必须先 Read 对应文件核实**：

| 内容 | 核查动作 |
|---|---|
| 函数签名（参数/返回/异常） | Read migration + 所有调用点确认 |
| API handler 参数 | Read handler + 调用方 |
| 现有 schema 字段 | Read schema.prisma 或最新 migration |
| 枚举值 / 常量 | Read 定义文件 |
| **regex / id-format / type-check（v0.9.11 新增）** | **Read schema.prisma 对应 model 字段类型注解（`@default(cuid())` / `@default(uuid())` / `@default(nanoid())`）+ grep ≥1 条既有测试 fixture 数据形态印证** |
| **任意"文件:行 + 现状描述"类引用（v0.9.14 新增 — 适用 spec / audit / review / readiness-report 所有起草类文档）** | **`grep` / `Read` 实物核对当前 import / component 调用 / migration 状态；任何「未含 X / 缺 Y / 待实装 Z」类断言必须 5sec grep 验证；`git log` 看是否后续批次已 retroactive 实装** |
| **完整 pattern 模式（v0.9.14 新增）— 不仅 grep 单一关键词** | **当 spec acceptance 列「删某 fallback / 收紧某 type / 清某 pattern」时必须 `grep -rn '完整模式' src/` 看全仓出现次数（不限 spec 列出的文件路径）；scope 漏 grep = 留 dead code / 留下次批次清理的 spec drift** |
| **Backlog / spec 涉及"测试 fail / PASS / 覆盖"类断言（v0.9.15 #1 新增）** | **必须实地 `npx vitest run <target>` 验证当前实情 + 复现 reviewer 实际跑测试的环境（pool 类型 forks vs threads / vitest version / Node version / OS）。Generator 在 forks pool 跑 PASS ≠ Codex 在 threads pool 跑 PASS — vitest pool 启动顺序差异可触发跨环境 stub 初始化竞态；只跑自己环境 = 不能证伪 reviewer 报告的 fail。** |
| **Test fixture / 全局 mock / setupFiles 内 stub 设计（v0.9.15 #2 新增）** | **stub 必须 environment-agnostic — 用 Map / Set 等自实装数据结构而不是依赖 jsdom / happy-dom / Node global 默认行为；不同 vitest pool 的 worker 启动顺序可能让 jsdom 全局 init 时机异于预期 → 不依赖默认行为才能消除跨 pool 的初始化 race（BL-047 fix-round 1 `commit 9fa2a49` Map-backed localStorage stub 即为范式）** |
| **`.auto-memory/project-status.md` / `session_notes` 等记忆涉及外部协作方 / 第三方仓库 / 跨项目状态的条目（"X 团队已交付 / 已部署 / 已审过 / 已上线"类断言）（v0.9.17 新增）** | **`gh api repos/<owner>/<repo>` 实物核查 + 看 `updatedAt` 是否后于记忆写入时间；内部 fork 用 `git log --all --since=<记忆时间戳>`；跨项目部署用 `curl <service-url>/health`；时间戳 ≥3 天的"提前交付"类条目尤其必查** |
| **auth role enum / 用户角色 / 权限 enum / DB schema 字段值（v0.9.18 新增）** | **不可依赖字面 `'admin'` / `'user'` 等假设 — 必须 `grep -rn "role" src/auth.ts src/lib/auth/ prisma/schema.prisma prisma/seed.ts` 验证真实 enum 值；spec lock 前必查 (BL-012 F001 案例：spec 写 `role === 'admin'` 但实际 seed 创建 `tenant_admin` → fix-round 1 改 `['platform_admin', 'tenant_admin'].includes(role)`)** |
| **外部 API response zod schema（fork / 第三方 / 跨服务 GET 响应）（v0.9.19 新增）** | **SSH 拉 ≥5-10 真数据 row sample → JSON parse 验证 zod schema 兼容；文档注释含"多 / 原结构 / 灵活"等 union 信号必须 `z.union([...])` + `.passthrough()` 容忍未知字段 (BL-012 F002 案例：spec/audit 仅看文档 sample，prod 真数据 41 fields shape mismatch → fix-round 2 改 union)** |
| **i18n template 在 server 组件 + 路由迁移（v0.9.21 新增）** | **路由迁移类批次 spec 起草前，grep 所有目标组件 `t(key)` 调用 + 检查对应 messages/*.json 模板含 `{x}` token 时区分两套约定：(1) ICU 真 placeholder（t-call 必须传值）；(2) client-side 自定义 token（`String.replace` 替换标记）→ 后者必须用 `t.raw(key)` 取原文。否则 latent FORMATTING_ERROR 会在新路由真实渲染时爆 (BL-065-R1 案例：F003 把 ImportCsvDialog 挪 /database → /admin/kol-csv-import，老路由 302 掩盖 6 个月，新路由渲染立刻触发；fix: `tImport("successTemplate") → tImport.raw("successTemplate") as string` + page-i18n-fidelity.test.ts 回归守门)** |
| **多角色并行 + Planner ops commit 前必 grep staged 索引（v0.9.26 #1 — 铁律 #12 强化）** | **开 session 第一动作 + 每次 Planner ops commit 前必跑 `git status --short` 看左列 staged 池，确认哪些 `M`/`A` 是别人 WIP；commit 前再 `git diff --cached --name-only` 确认仅含本 commit 文件。`git commit` 提交 staged 索引**全部**内容，无视之前 `git add <pathspec>` 限制 (BL-083 案例：fork .env ops 后 Planner 只看自己 add 的 1 文件就 commit，把 Generator/Reviewer 在制 5 文件一并打包推 main commit 97339c6 → 违反铁律 #10)** |

**反面案例（v0.9.11 新增类）：** BL-020 F001 spec 起草时假设 `productId` 是 UUID（沿袭 audit §3 CR-1 文字描述），未 grep `schema.prisma` → Generator pre-impl audit 反向纠错指出 `Product.id` 实为 `@default(cuid())`，套 UUID_RE 会破 4 调用方 + 5 既有 fixture（25-char CUID）测试全红。Planner 短格式裁决 #1:A 修订全文 + 修订 acceptance regex 为 `/^c[a-z0-9]{24,}$/i`。本可在 spec lock 前 grep schema.prisma 1 次避免。

**反面案例（v0.9.14 新增类）— audit/spec 起草前漏 grep 实战双案例：**

1. **BL-041 audit 过期（2026-05-04 → 2026-05-06 发现）：** `prod-mvp-readiness-audit-2026-05-04.md §5 D2` 写「Dashboard 缺 PRD §4.1 三元素（工作流 6 步图 / CPI 对比卡 / 30D ROI 趋势图）」，但 grep `dashboard/page.tsx` 即可发现 line 79+88+89 已 import + 渲染 `WorkflowSteps` + `CompetitorCpiCard` + `DashboardRoiTrendCard` — `MVP-internal-demo-prep-F001` (commit `4fd778b @ 2026-05-01`) 早已实装齐全（recharts + 5 locale i18n + visual baseline 全齐）。Audit 起草人 Planner Kimi 漏 grep 实物状态 → BL-041 在 backlog 错挂 3 天 + Planner johnsong 在 BL-040 planning 阶段才 5sec grep 发现 → 直接 retroactive 关闭。本可在 audit 起草时 5sec grep 避免。

2. **BL-040 spec scope 漏 grep（2026-05-06）：** spec §F001 acceptance 列「删 `generateAiAssets.ts:175 ?? 'Not specified'` fallback」一处，但 Generator Kimi 开工前 grep 实物发现 `src/lib/assets/generators/email-generator.ts:74` + `src/lib/assets/generators/video-script-generator.ts:80` 同样含 `?? 'Not specified'` 模式（BL-025-F003 / BL-030 后实装）— D5 同根理由（LLM 缺 audience context）但 spec 未列。Generator 按铁律 #10 没越界，留 Planner judgement → 入 backlog deferred 跟踪。本可在 Planner spec 起草时 `grep -rn "?? 'Not specified'" src/` 5sec 一次性命中所有 3 处避免。

两案例同根问题：**audit/spec 涉及"完整模式 X 全仓未/已实装"类断言时，必须先 grep 全仓而非依赖记忆 / 文档字面 / 单文件假设。**

**反面案例（v0.9.15 新增类）— 测试断言跨环境复现盲区（BL-047 撤再翻盘 + BL-049 audit 沉淀）：**

BL-047 backlog 条目报「`AiSuggestionsClient` localStorage stub 跨环境失败导致 `npm test` 1043/1043 → 1042/1043 fail」。Planner johnsong 5/7 10:30 起草 backlog 时未实地复现，仅基于 reviewer 简述写"无法证伪先建条目"。Generator Kimi 5/7 10:30 开工前在 WSL2 forks pool 跑 `npx vitest run AiSuggestionsClient.test.ts`：1043/1043 PASS — 误判 backlog premise 错误，撤条目。5/7 11:51 Codex Reviewer 在 BL-021 reverifying 阶段实际跑测试，**真复现** `TypeError: Cannot read properties of undefined (reading 'getItem')`。两侧 vitest pool 配置差异（forks vs threads / setup 时序）导致 stub 在 reviewer 环境下未及时初始化。Generator 5/7 13:00 fix-round 1 (`commit 9fa2a49`) 实装 Map-backed 自实装 stub，PASS @ Codex reverifying da94b73。

**两条新规分别防的是：**

1. **(v0.9.15 #1) 跨环境复现：** 任何"测试 fail / PASS / 覆盖"断言必须**多 pool 实地跑** + 至少模拟 reviewer 环境配置，不能只跑自己默认 pool。
2. **(v0.9.15 #2) Stub environment-agnostic：** stub 设计阶段就要假定"任意 pool / 任意启动顺序" — 用 Map-backed 自实装数据结构消除 jsdom / Node 全局 init 时机依赖。`commit 9fa2a49` 是 Map-backed localStorage stub 的范式实装，可作模板。

**反面案例（v0.9.17 新增类）— 记忆条目陈旧风险（BL-012 5/7→5/8 实战）：**

Planner Kimi 5/7 在 `.auto-memory/project-status.md:16` 记录「爬虫团队 5/7 提前交付 fork audit 推荐方案 A 分平台分源 IG/TT 给 apify YouTube 给 B6」（3 平台分流口径）。但同期 5/7 16:57 fork 实物 `guang-tech/apify` 已完成 **Apify → TikHub 全迁移** + 新增 **X(Twitter)** 平台 = **4 平台齐全**。实地补 audit（`gh api` 抓 README + docs 设计文档）才发现实物 5/7 重大变化。**根因：** v0.9.14 铁律 1 已覆盖 spec / audit / readiness-report 起草前 grep 实物状态，但**对项目 `.auto-memory/` 内涉及外部协作方的记忆条目仍存在盲区** — Planner 默认信任记忆 = 信任前一轮写入的快照，但外部协作方 / 第三方仓库可能在记忆写入后被独立更新。

**规格引用实际代码时必须：**
- 用 ` ```sql ` / ` ```ts ` 等代码块贴真实片段
- 标注 `file:line` 来源（例：`migration.sql:40-80`）

**Generator 发现规格偏差时**：开工前提出"规格偏差报告"暂停；Planner 修订 spec 后再开工。此为双方义务。

### 铁律 2：Code Review 报告事实性断言按"线索"处理（详见 planner-arbitration.md）

详细规则见 [planner-arbitration.md §「Code Review 报告事实性断言按"线索"处理」](planner-arbitration.md)。

### 铁律 3：spec 写"在 docs/X.md 加段"前必须 ls 实物（v0.9.7 — BL-026/BL-027 持续坑）

Planner 写 spec acceptance 引用 `docs/dev/` 下文件路径（如"在 docs/dev/rules.md §X 加段落"）时，**必须先 `ls docs/dev/*.md` 确认目标文件存在**。否则 Generator 开工时被迫二选一：

- (a) 创建一个仅含此一段的新文件（违反"本批次需要谁"的克制原则）
- (b) 改写到另一文件（与 spec 字面冲突，被 Reviewer Soft-watch）

**修订规则：** 文件不存在时，spec 应写"在 docs/dev/{现有文件} 或新建 docs/dev/X.md 加段落（Generator 选位时优先现有文件）"。

**来源：** BL-026 F004/F005 spec 引用的 docs 文件实物缺；BL-027 F004 spec 写 docs/dev/rules.md（不存在），Generator 实装落 setup.md §9.5。连续两批 Reviewer Soft-watch 同一坑。

### 铁律 4：spec 写应用路由路径前必须 grep 实物存在性（v0.9.8 — BL-030 沉淀）

Planner 写 spec acceptance 引用应用路由路径（如"跳转 /assets/{id}"、"链 /campaigns/{id}/edit"、"redirect /outreach"）时，**必须先 grep 项目路由文件结构确认该路径存在**：

```bash
# 检查动态路由 /[locale]/(app)/<path>/[id]/page.tsx
ls src/app/\[locale\]/\(app\)/<path>/ 2>/dev/null
# 或语义化 grep
grep -rn "params.*id" src/app/\[locale\]/\(app\)/<path>/ 2>/dev/null
```

否则 Generator 开工时被迫：

- (a) 字面照写不存在的路由 → CI/runtime 不报错（Next.js 链接是字符串）但 UX 死链
- (b) 改写为现存路由（如 `/assets?productId=X` 过滤页 + drawer 选中） → 与 spec 字面冲突，被 Reviewer Soft-watch

**修订规则：** 路径不存在时，spec 应写"链到 `/{现有路由}` + 注明跳转后的 UI 行为（如选中、drawer 打开）"，而非编造嵌套 detail 路径。SPA 项目（如 Next.js App Router 含 list+drawer 模式）的 detail 通常是 list?id=X + 客户端 drawer，不是单独路由。

**来源：** BL-030 F002 spec 写"跳转 /assets/{id}"（项目无 `/assets/[id]/page.tsx`，detail 通过 `/assets?productId=X` 列表页 + 右侧 drawer 选中实现）；Generator 实装链对，但 spec 文字错配 → Reviewer Soft-watch S1。

### 铁律 5：Planner ops 绕业务 mutation 函数前必须列写所有副作用 checklist（v0.9.9 — BL-030 → BL-031 沉淀）

Planner 在 done / hotfix 阶段为不阻塞用户决定"用 SQL ops 替代 mutation 调用"前，**必须 grep 该 mutation 函数内所有 await 调用并列入 ops SQL 一并执行**。不能仅做主表 INSERT/UPDATE。

**典型副作用类型（按域）：**

| 类型 | 示例 | 漏做后果 |
|---|---|---|
| Dual-write 镜像 | `dualWriteEmailTemplateOnCreate` | FK orphan → 下游 INSERT 撞 FK 500 |
| Audit log | `logAudit({action: "asset.generated"})` | 合规 / 计费 缺记录 |
| Queue push | `queue.add('send-email', ...)` | 异步任务漏触发 |
| Cache invalidate | `cache.delete(productId)` | 读端看到陈旧数据 |
| Search index | `meilisearch.update(...)` | 搜索看不到新内容 |

**修订规则：**

```bash
# Planner 决定 SQL ops 替代 mutation 前必跑：
grep -nE "await tx\.|await prisma\.|await logAudit|await queue|await cache|await meilisearch|await dualWrite" \
  src/lib/.../mutations.ts | grep -A0 -B0 "createAsset\|<目标 mutation 名>"
```

把每条 await 调用对应的副作用以 SQL / 后续脚本形式同 ops 一并执行；不可分批；不可省略 audit log。

**来源：** BL-030 backfill ops Planner 用 SQL 直跑 INSERT into asset 25 行，绕了 createAsset 内 dualWriteEmailTemplateOnCreate → 15 行 ai_generated email 在 email_template 表无镜像 → BL-031 启动 Phase 1 调研发现 email_log.template_id FK orphan 风险。Planner 自查补 SQL 镜像 15 条。BL-032 backfill 严格遵守此铁律走 updateAsset mutation 路径，未再现漏 dual-write。

### 铁律 6：跨角色 ops 必须用户书面授权（详见 planner-arbitration.md）

详细规则见 [planner-arbitration.md §「跨角色 ops 必须用户书面授权 + session_notes 记账」](planner-arbitration.md)。

### 铁律 7：角色文件多副本一致性（详见 planner-arbitration.md）

详细规则见 [planner-arbitration.md §「角色文件多副本一致性」](planner-arbitration.md)。

---

## Spec 起草必含「数据准备步骤」+ 白名单 ID

**背景：** KOLMatrix B5 fixing-3 + MVP-internal-demo-prep fixing-2 暴露：

- B5 fixing-3：staging 96% youtube KOL 缺 `metadata.youtube.channelId` 是 BL-012 crawler hand-off seed 不完整造成的污染池；Reviewer 5/5 抽样全踩进污染池 → FAIL 在 spec 没覆盖的地方
- MVP fixing-2：seed 写了 5 个 Product 但 KolCampaign rows / KOL.email 字段全空 → C-10 outreach 无法 end-to-end 跑通

Spec 起草时不能假设「seed 数据 = 测试可用」。

**Spec 必含段落：**

```markdown
## 数据准备步骤（Reviewer 验收前提）

### Tenant / 数据集要求
- staging tenant 必须满足以下数据条件：
  - (a) ≥ X 条 fully-enriched <entity>（具体字段：A=非空 / B=非空 / C 长度≥1）
  - (b) ≥ Y 个满足以下组合的 Campaign：productId NOT NULL AND ≥1 KolCampaign whose KOL has email
  - (c) ...

### 抽样白名单（Planner 提供给 Reviewer）
- 以下 ID 已通过本批次 enrich/seed，Reviewer 可直接抽样验收：
  - <UUID-1> (描述 + 关键字段值快照)
  - <UUID-2> ...
- 这是「正样本池」，避免 Reviewer 抽到不完整种子数据误判 FAIL
```

Planner 必须在 spec lock 之前**实际跑过 staging 数据填充脚本**，记录抽样 ID 到 spec。光列脚本名不够（脚本可能因输入键缺失静默跳过部分行）。

来源：B5 fixing-3 + MVP fixing-2。

---

## verifying 前 checklist 起草必须 grep 实际代码验证

**背景：** Planner 起草 prod L2 smoke checklist 时，UI 元素描述（"X 卡可见" / "Y 按钮存在"）必须基于**实际代码当前状态**，不可凭 spec 文本写。Spec 在 building 期间常常演化，文本与代码漂移。

KOLMatrix MVP-internal-demo-prep fixing-1（C-03 /database 三卡）案例：

- Spec 写：三卡名 "Market Intel / Campaign Timing / Budget Benchmark"
- 代码 InsightsPanel 实际：三卡名 "AI Intelligence / Coverage Gap / Engagement"
- Reviewer 按 stale checklist 标 C-03 FAIL
- Generator 接 fixing 后发现是 checklist 文本陈旧，浪费 1 轮 fixing 切换

**起草 checklist 时 Planner 必须：**

1. 对每条 UI element 描述 `grep` 实际代码 / 跑实际页面验证：
   ```bash
   grep -rE 'AI Intelligence|Market Intel|Coverage Gap|Campaign Timing' src/features/database/
   ```
2. 描述与代码不一致 → 立刻在 checklist 写实际命名（不要写 spec 文本）
3. 元素增删（spec 列 N 个但代码 N+1）→ 在 checklist 注「实际有 N+1 个，验证 N 个核心，多出的不算 FAIL」

**Generator 配套防御（建议）：** PR description 写「本批次 UI 改动元素列表：X / Y / Z（代码实际命名）」，Planner 起草 checklist 时直接复用。

来源：MVP-internal-demo-prep fixing-1。配套见 `evaluator.md` §11「Smoke checklist 文本陈旧时直接 update 而非标 FAIL」。

---

## Perf 类 acceptance 必须自带「工具 + 输出物」checklist

**背景：** BIx F005 acceptance §6 O3 要求 "实测初始 JS 减 ≥ 200KB gzipped"，但 spec 没列 `@next/bundle-analyzer` 入 devDeps，Reviewer 验收时无工具可跑 → 数字层 acceptance 无证据可拉，被迫降级为 "soft-watch / 后续补"。

**根因：** Perf 类（bundle size / Lighthouse score / TTFB / TTI / cold-start）acceptance 必须自带"测量工具 + 输出快照位置"，否则验证从源头失活。

**Spec 起草硬要求：**

任何含数字层 perf acceptance 的 feature，spec § acceptance 必须含两段：

```markdown
**测量工具（开工前装）：**
- [ ] `npm install --save-dev @next/bundle-analyzer`（或对应 perf 工具）
- [ ] 落 devDeps 入 package.json，commit 时一并入

**输出快照（验收时提供）：**
- [ ] 跑 `ANALYZE=true npm run build` 生成 bundle 报告
- [ ] 报告快照保存至 `docs/test-reports/<batch>-bundle-snapshot-YYYY-MM-DD.html`
- [ ] signoff 引用快照 + 实测数字（如 "main bundle 442KB → 215KB，减 227KB gzipped ≥ 200KB ✅"）
```

**Reviewer 配套：** 验收 perf acceptance 时先确认 spec 列了工具且 devDeps 已含，再跑工具拿数字。两步缺任一 → 直接标 PARTIAL（不是 FAIL，但需 Planner 补 spec 后重验）。

### Perf 量化门槛入 acceptance + client/server 分类（v0.9.23 #25 + #26 合并段，两 source）

**反 retrofit 模式（#25 source）：** 对外上线 ready checklist 中 Lighthouse perf 类硬门槛，**必须在 spec 起草阶段就列入 acceptance**，而非 batch end-stage（F001-F007 全 done 后）才发现 perf 不达标触发 fix-round 攻关。

**实证反面（BL-070）：** F008 §10 #8 在 batch end-stage 才发现 perf 75-78 < 80 → 触发 fix-round 2 perf 攻关（+3 features F009/F010/F011 + 2 fix-rounds CI 自修），延期 ~2 day。**根因：** spec 起草时未把 perf score / TBT / LCP / CLS 量化门槛列为 acceptance，Generator 实装时也没同步 `next/dynamic` + `next/image` + Suspense 模式 → batch 末尾 retrofit perf 成本爆炸。

**Spec 起草模板（任何含客户端组件的 batch）：**

```markdown
## §X. Perf acceptance（v0.9.23 起 spec 必含）

- [ ] **Lighthouse Desktop logged-in score ≥ 80** (categories.performance)
- [ ] **TBT < 200ms**（Total Blocking Time）
- [ ] **LCP < 2.5s**（Largest Contentful Paint）
- [ ] **CLS < 0.1**（Cumulative Layout Shift）
- [ ] Generator PR push 前必跑 `npx lighthouse http://localhost:3001/<route> --preset=desktop` 自测
- [ ] Reviewer L2 验时跑同样命令，签收报告附 Lighthouse JSON
```

**client/server 分类决策树（#26 source）：** spec perf optimization 类 acceptance 必须**分类 client component (chunk-split 靶) vs server async (Suspense 靶)**，**不该混在一条 `ssr:false` acceptance line 里**。

| 组件类型 | 优化模式 | acceptance 措辞 |
|---|---|---|
| **Client component**（含 'use client'，贡献 JS bundle）| `next/dynamic({ ssr: false })` chunk-split | "X 组件 lazy load via next/dynamic ssr:false（减 client JS bundle ~Y KB gzipped）" |
| **Server component**（async server fn，无 client JS 贡献）| Suspense + skeleton 镜像（per §15.2 generator.md）| "Y 组件 Suspense boundary（fallback skeleton 同 outer 高度 + 宽度，CLS reservation）" |
| **Hybrid**（server fetch + client interaction）| 拆 server + client 两组件，分别用上述两模式 | 两条 acceptance line |

**反面实证（BL-070）：** F009 spec acceptance 列出 reach 5 组件 `ssr:false` 懒载，但其中 4 个（SendingPerformanceChart / RecentRepliesCard / RecentlySentTable / TopTemplatesCard）为 server 组件 — **零 client JS 贡献，不该走 `ssr:false`**（违 spec §5 不变量 #5「不增 client JS bundle」）。实际只 OutreachComposer 走 `ssr:false`，其余 4 个 server 组件的 SSR 延迟由 F011 Suspense 治理。

**Spec 起草自检 checklist：**
- [ ] 每条 perf optimization acceptance 都标注 client / server / hybrid 分类
- [ ] client component → `next/dynamic({ ssr: false })` 措辞
- [ ] server component → `Suspense + skeleton 镜像` 措辞
- [ ] 不要混用 `ssr:false` 在 server component 上

来源（双 source 合并）：
- BL-070 batch-end perf retrofit 实战（v0.9.23 #25，用户 2026-05-25 ack）
- BL-070 F009 spec 把 server 组件错配 ssr:false 实证（v0.9.23 #26，用户 2026-05-25 ack）
- 两条同主题 inline-merge 为单段「Perf 量化门槛入 acceptance + client/server 分类」（per D7 强制合并）

来源：BIx F005 + framework CHANGELOG v0.9.6 [#2] + BL-070 v0.9.23 #25+#26 双 source 合并。

---

## UI 类 spec 起草前 mandatory self-check checklist

**背景：** `framework/harness/ui-fidelity-guardrail.md` §2 已规定所有 UI 类 feature spec 必须含 4 段（§2.1 原型路径 + §2.2 必用公共组件清单 + §2.3 不得简化清单 + §2.4 visual baseline 硬要求）。但 BL-025 Planner 起草 spec 时**漏写 3/4**（仅 §2.1），靠用户主动 challenge "新页面会严格按框架还原 + 抽公共组件 + 不手写吗?" 才补全。规范存在但自审缺失 = 实际等于无规范。

**Planner 起草 UI 类 spec 自审 checklist（spec lock 前必跑）：**

- [ ] §2.1 列了 Stitch HTML 原型路径（`design-draft/.../*.html`，不是 PNG）
- [ ] §2.2 列了必用公共组件清单（`@/components/common/*` 全部相关组件 + 5 禁止行为）
- [ ] §2.3 列了「不得简化的 N 元素」+「不得新增的 M 元素」（数字明确，逐元素列）
- [ ] §2.4 列了 visual baseline 硬要求（具体几个 PNG + L2 浏览器并排路径）
- [ ] 4 段缺任一 → spec **不能交付**给 Generator，必须补全

**机器化（推荐）：** Planner 在 spec lock 前跑：

```bash
spec=docs/specs/<batch>-spec.md
for section in "原型参考" "必用公共组件清单" "不得简化" "visual baseline"; do
  grep -q "$section" "$spec" || echo "MISSING: $section"
done
```

**反面案例：** BL-025 spec drafted-complete v1 仅写"参考 design-draft/BL-025-asset-library/variant-a-296k/"，§2.2/2.3/2.4 全缺。用户 challenge → Planner 加 §F004.A/B/C 三段（19 不得简化 + 4 不得新增 + 3 新公共组件 + visual baseline 4 个）→ 才进 building。如无 challenge，Generator 会以"自由发挥"模式做，Reviewer L1 grep 反范式时大批量 FAIL。

来源：BL-025 spec drafting + framework CHANGELOG v0.9.6 [#5]。配套见 `ui-fidelity-guardrail.md` §2 顶部强制声明。

---

## i18n 命名空间扩展类 spec 起草必含双门检查（v0.9.10 — BL-033 沉淀）

**适用场景：** 批次涉及**新增 messages/{locale}.json 命名空间**或**已有命名空间扩展 ≥ 5 个 keys**。

**spec 必含 §"D-i18n: i18n 命名空间扩展计划" 段** — 详见 `framework/harness/checklists/i18n-namespace-add-checklist.md`（D10 lock 后位置）。核心两条：

1. **i18n CI locale-coverage 守门 — 行业词 allowlist：** 命名空间含英文行业惯用词（KOL / AI / CPI / ROI 等）的 path 必须列入 spec，Generator 同 commit 修订 CI 守门 `KEEP_AS_EN_PATHS`
2. **i18n CI placeholders 守门 — ICU plural shape parity：** 含 `{count, plural, ...}` 的 keys 在 spec §schema 段标注 "ICU plural shape required in all 5 languages"，CJK 语言用 `{count, plural, one {...} other {...}}` 包裹（同文本但形状必填）

**反面：** BL-033-F004 spec §D4 列 schema 但未提示双门 → Generator 实装首推 CI 25321942649 红 → 加 commit e2c1832 修。本可在 spec lock 前预防。

来源：BL-033 Reviewer signoff §Framework Learnings + Generator session_notes 提案。

---

## 上线前 audit 触发条件（v0.9.10 — KOLMatrix prod-mvp-readiness-audit 沉淀）

**Planner 旁路任务（不入状态机批次），满足以下任一即跑：**

| 触发条件 | 频次 |
|---|---|
| MVP 邀请第一批种子用户前 | 每个里程碑 1 次 |
| 真客户对外发布前 | 每次发布前 1 次 |
| 1+ sprint 没做安全 / 完整性审计 + 连续工作日 ≥ 5 | 自动周期 |
| 用户主动请求 | 任意时刻 |

**模板：** `framework/templates/prod-launch-audit-template.md`（v0.9.10 沉淀，6 章节 + 6 维度 checklist + 池子 A/B/C/D 分类）

**报告归档：** `docs/reviews/prod-mvp-readiness-audit-YYYY-MM-DD.md`

**用户接收后 Planner 后续动作（5 项）：**

1. **backlog.json 增补 audit 文件:行明细** — 在已有 BL-XXX descriptions 加详尽段（如 BL-020 加 H-S1/H-S2/H-S3 文件:行 + UI 修法）
2. **新增 BL-NNN 条目** — D1/D2 等不在 backlog 的 PRD 偏差
3. **environment.md 更正** — 如 prod DB 状态描述漂移
4. **proposed-learnings.md 加候选** — audit 模板修订 / 新规律
5. **不动当前 in-flight 批次** — 不打断 Generator

**反面（已避开）：** 直接把 audit 当作"临时批次"塞进状态机，违反 audit 是"全局体检"非"实施任务"的本质，会延迟当前 in-flight 批次。

来源：KOLMatrix `docs/reviews/prod-mvp-readiness-audit-2026-05-04.md`（Claude CLI 独立任务模式 168 行报告，4 池子 18 项阻塞 + 文件:行级精度，accept by 用户 → backlog 19→21 + 2 mini-batch 排期细化）。

---

## Server Action / API route 新增时 spec 必含速率限制条款（v0.9.11 — backend-full-scan-audit 沉淀）

**背景：** KOLMatrix backend-full-scan-2026-05-04 audit（265 行后端全量扫描，5 CRIT + 14 HIGH + 21 MED + 16 LOW）暴露 6 个 server action / API route 全裸无 rate-limit；BL-020 F005 + BL-035 F003 (待开 9 项中) 为同源问题。每类单独修都简单，但跨多个批次发生 = 框架欠 spec 起草检查项。

**Spec 起草规则（任何新建 server action / `app/api/**/route.ts` 时）：**

spec acceptance 必含「rate-limit 条款」，明示 (a) 限速维度 (b) 阈值 (c) 兜底策略 (d) escape hatch。

**默认值矩阵（按 endpoint 性质）：**

| Endpoint 类型 | 限速维度 | 默认阈值 | 兜底 | Escape hatch env var |
|---|---|---|---|---|
| 登录 / OTP / 密码重置 | IP | **5 req/min/IP** + 5min block | Redis down → fail-open | `DISABLE_LOGIN_RATELIMIT=true` |
| Read-only（GET 类查询 / list / detail） | userId | **30 req/min/userId** | Redis down → fail-open | `DISABLE_USER_RATELIMIT=true` |
| AI 调用类（generate / customize / extract） | tenantId | **10 req/min/tenantId** + 100/day/tenant | Redis down → fail-open | `DISABLE_AI_RATELIMIT=true` |
| 公开 webhook（POST 接收 3rd party） | IP + HMAC verify | **20 req/min/IP** | Redis down → fail-closed（reject） | 不设 escape（安全敏感） |
| Mutation（write to user-owned data） | userId | **20 req/min/userId** | Redis down → fail-open | `DISABLE_MUTATION_RATELIMIT=true` |

**Spec 必含段落模板：**

```markdown
**速率限制（v0.9.11 框架硬要求）：**
- 维度：[IP / userId / tenantId]
- 阈值：[N req/period] + [block duration if any]
- 实装：复用 `src/lib/rate-limit.ts` 已有 `rateLimitLogin(ip)` 模式，添加 `rateLimitX(...)` 函数（同 `rate-limiter-flexible` 包 + Redis store）
- 兜底：[fail-open / fail-closed]，理由：[业务影响分析]
- Escape hatch：env var `DISABLE_X_RATELIMIT` (true → short-circuit)，prod 故障应急用
- Test：≥3 case via Redis testcontainer：连续 N+1 fail / period 后重置 / Redis disconnect 兜底行为
```

**反面：** prod-mvp audit 之前批次（B5 / BM2 / BL-025 等）创建 server action 时全无 rate-limit 检查，到 BL-020 prod readiness 阶段才用专项批次扫尾，工时 ~5h；本可在原批次 spec 多 5min 写一个段落避免。

**来源：** KOLMatrix `docs/reviews/backend-full-scan-2026-05-04.md` AUTH-H1 + API-H1（6 endpoint 全裸列表）+ BL-020-F005 (login 5/min) + BL-035-F003 (AI 6 endpoint rate-limit) 同源问题归并。

---

## IA refactor / 路由删除批次 outbound 一致性扫描清单（v0.9.24 #1 / BL-072 #1）

**背景：** BL-072 4 prod hotfix 共性根因 = BL-070-F003/F004/F005 IA refactor 大改后 outbound 一致性扫描缺失：

| Issue | 维度 | 根因 |
|---|---|---|
| #1 `/brief` 宽度 (768 vs 1600) | visual 宽度 | 跨 4 路由 max-width 一致性漏检 |
| #2 `/insight` i18n hardcoded | i18n 消费侧 | 新建 page.tsx 后 t() wiring 漏检 |
| #3 `/match` TABLE_ROWS 字面文字 | Material Symbols | 新加 ligature manifest 漏更新 |
| #4 10 处 outbound 404 | 路由 outbound | 删老路由 + middleware 即停 redirect 时 outbound 漏 grep |

四类问题独立批次单修都容易，跨多个 IA refactor / 路由删除批次系统性发生 = framework 欠 "outbound 一致性扫描" spec 起草清单。

**触发 batch 类型（spec 起草端 self-check 必跑）：**

1. **IA refactor / 路由迁移**（如 BL-070 brief/insight/match 5 路由重构）
2. **路由删除 / 重命名**（如 BL-070 删 KB 5 老路由）
3. **视觉宽度对齐 / 容器层重构**（如 BL-070 brief 宽度从 max-w-3xl 升 max-w-[1600px]）
4. **i18n namespace 重构**（git mv 组件 + 改 ns / 拆 ns / 合 ns）

任一命中 → spec acceptance 必含以下 **4 维度扫描** 段。

**4 维度 spec acceptance 模板（任一命中即起 spec 必含）：**

```markdown
**Outbound 一致性扫描（v0.9.24 BL-077 framework 硬要求 / 来源 BL-072 #1）：**

#### 维度 1：visual 宽度跨路由一致性
- [ ] grep `max-w-` 全相关路由 → 验 4-5 路由 max-width 一致
- [ ] 二级容器嵌套 grep（详 §"spec acceptance 嵌套二级约束 grep 防御"段）— 0 个意外二级约束
- 工具：`grep -rn "max-w-" src/app/[locale]/(app)/<route>/ --include='*.tsx'`

#### 维度 2：i18n 消费侧 t() wiring
- [ ] grep `getTranslations|useTranslations` 全 page.tsx + 主组件 — 验 t(key) 调用 key 在 messages exist
- [ ] tests/unit/i18n-page-side-consumption.test.ts v2（v0.9.24 #7）advisory test 全绿 — 详 `evaluator.md §13.4.2`
- 工具：`grep -rln 'useTranslations\|getTranslations' src/app/[locale]/(app)/<route>/`

#### 维度 3：Material Symbols 子集 manifest 同步
- [ ] grep `material-symbols-outlined` 全 src — 验所有 ligature in manifest + woff2 含 glyph
- [ ] tests/unit/material-symbols-coverage-unit.test.ts strict（STRICT_MS_ICONS=true）CI 必绿
- 工具：`bash scripts/regenerate-material-symbols-subset.sh` 后 manifest 增量 diff

#### 维度 4：outbound 链接命中实际路由树
- [ ] grep 所有 `href="/<path>"` + `router.push("/<path>")` — 验 path-prefix in 路由树 + IA_REDIRECT_RULES
- [ ] tests/unit/link-target-audit.test.ts advisory test 全绿（详 `evaluator.md §13.4.1`）
- 工具：`grep -rEn "['\"]/(<deleted-route>)" src/ --include='*.tsx' --include='*.ts'` + `router.push` 同源 grep
- 配套：`framework/harness/generator.md §11 J「删 X 前 grep callers 矩阵」`
```

**反例（BL-070 IA refactor 漏 4 维度 → BL-072/073 4 批 prod hotfix 修复）：** BL-070 IA refactor 大改时 4 维度扫描在 spec acceptance 不存在，4 prod hotfix 单点修费 ~16h 工时；本可在 BL-070 spec lock 前列 4 维度 + 起跑前 5min 扫一次避免。

**与 §"嵌套二级约束 grep 防御"关系：** 本段是 IA refactor / 路由删除批次的**触发条件** + **4 维度入口**，嵌套二级约束 grep 是维度 1（visual 宽度）的具体 grep 模板；两段配套使用。

**来源：** BL-072 done 4 prod hotfix 共性根因分析 + v0.9.24 #1 用户 2026-05-26 ack。

---

## spec acceptance 嵌套二级约束 grep 防御（v0.9.24 #6 / BL-073 #6）

**背景：** spec acceptance 凡涉及"外层约束改变"（视觉宽度 / i18n namespace / CSS variant）必加 grep 全仓 review 二级约束，否则嵌套二级约束破坏外层意图，prod 复现同问题。

**反例（BL-072-F001 → BL-073 同 issue 复现）：** BL-072-F001 修 `/brief/page.tsx:75` `max-w-3xl → max-w-[1600px]` 但 acceptance 未含嵌套 grep，漏检 `BriefPageClient.tsx:120` 嵌套 `max-w-3xl` 二级约束 → 视觉上 `/brief` 仍 768px（外层 1600px 被嵌套 768px 缩回去）→ BL-073 prod 同问题复现 + 二次 hotfix。

**模板（视觉 / i18n / CSS variant 类 acceptance 必加 grep 行）：**

```markdown
**嵌套二级约束 grep 防御（v0.9.24 BL-077 framework 硬要求 / 来源 BL-073 #6）：**

凡涉及"外层约束改变"必加 acceptance 行：
- [ ] grep `<约束类>` 全相关路由 / 组件 — 0 个意外二级约束
- 工具：`grep -rn "<约束类>" src/app/[locale]/(app)/<route>/ --include='*.tsx'`
- 输出：grep 输出 review，所有命中行确认是"故意嵌套"（如 modal 内 max-w-md）而非"外层意图被二级约束破坏"
```

**三类 grep 模板（按维度）：**

| 约束类型 | grep 模板 | 反例 / 实战 |
|---|---|---|
| **视觉宽度 max-w-** | `grep -rn "max-w-" src/app/[locale]/(app)/<route>/ --include='*.tsx' --include='*.module.css'` | BL-072-F001 外层改 max-w-[1600px] 漏 BriefPageClient 嵌套 max-w-3xl → BL-073 复现 |
| **i18n namespace 嵌套** | `grep -rn "useTranslations\|getTranslations" src/app/[locale]/(app)/<route>/` | 嵌套 sub-component 用不同 ns（混淆 namespace） → t(key) lookup 失败 |
| **CSS variant 嵌套**（padding / margin / typography） | `grep -rn "p-[0-9]\|m-[0-9]\|text-(xs\|sm\|base\|lg\|xl)" <route>/ --include='*.tsx'` | 外层改 p-8 但嵌套 p-2 → 视觉不一致 |

**关键设计：**
- grep 输出 review 必须**显式记录在 spec acceptance 验证笔记**（不是"跑一下看看"，是 grep 结果落 `docs/test-reports/<batch>-acceptance-grep-YYYY-MM-DD.txt`）
- 0 命中 → PASS；有命中 → 逐条人工 review 是否"故意嵌套" or "意外破坏"
- 故意嵌套的二级约束（如 modal / overlay 局部约束）在 spec / commit message 注明，避免下次 grep 时误判

**Generator 配套（self-check 前置）：** 改外层约束 commit 前必跑同 grep；改前 grep 抓 baseline，改后 grep 验差异。

**与 §"IA refactor outbound 一致性扫描"关系：** 本段是 IA refactor 维度 1（visual 宽度）的细化 grep 防御，配合 §IA refactor outbound 一致性扫描 维度 1 列出的入口使用。

**来源：** BL-072-F001 漏检 + BL-073 同 issue 复现 + v0.9.24 #6 用户 2026-05-26 ack。

---

## Visual polish 类 spec 起草：Reference URL 提炼方法论（BL-078 #4 / BL-078 plan v2）

**触发场景：** Visual polish / landing 视觉重做 / brand identity 类批次 spec 起草，需要参考外部产品（如 Linear / Vercel / Stripe / Plausible / Notion）作为视觉 reference。**仅 visual polish 类必走；非视觉 batch（feature / hotfix / sediment）不强制。**

**核心原则：** Reference URL 是"**精神参考**"而非"**像素复刻**"。源产品定位（B2B SaaS / consumer / dev tools）与本项目可能不同，1:1 复刻 css 可能破坏本项目 brand identity（如 KOLMatrix cyan/purple/navy 调色板）。Planner spec 必须把 reference 落到 **token layer 抽象**（与 `framework/harness/ui-fidelity-guardrail.md §3.4 landing visual token layer 规范` 配套，BL-078 #2）而非 reference css 直 copy。

### 3 步法：解构 → 筛选 → 抽象

**步 1：解构 — 列 5-10 个视觉信号**

每个 reference URL 必拆成可枚举的视觉信号清单（不是"看起来很 nice"的主观描述）。BL-078 实战：

| Reference | 拆出的视觉信号（5-8 个）|
|---|---|
| Linear (linear.app) — 主 reference | dark theme + sans-serif clean grotesk + scroll-driven entrance + 极简 hero（大字 + 大量 white space）+ subtle mesh gradient + Linear-style ease-out cubic-bezier + button glow effect + view transitions opt-in |
| Plausible (plausible.io) — 辅 reference | B2B SaaS short landing（≤ 6 sections）+ conversion-focused CTA 双 button（primary + outline）+ KPI 大字 typography + 暖灰黑 vs 纯黑 调色 + 折叠 FAQ smooth-height |

**步 2：筛选 — 哪些信号契合本项目 brand + 哪些冲突**

3 列分类清单：

| 信号 | 契合本项目 | 冲突 / 改造 | 直接弃 |
|---|---|---|---|
| **Linear: dark theme** | ✓（KOLMatrix 已 dark navy）| — | — |
| **Linear: scroll-driven motion** | ✓（D3 lock 全栈现代化）| — | — |
| **Plausible: 暖灰黑 (#1a1a1a)** | — | 改造为本项目 `--color-landing-canvas: oklch(14.5% 0.022 265)` 略冷 deeper navy | — |
| **Linear: 顶部巨大 hero h1 (~96-128px)** | — | 改造为 `--text-landing-hero: clamp(2.75rem, 6vw, 5.5rem)` 保留巨字精神 + 适配本项目 viewport | — |
| **Plausible: B2B short landing** | — | — | 本项目 11 components 已 lock 不动结构 |

**步 3：抽象 — 落 token layer 而非直接 copy css**

筛选后的信号落到 `framework/harness/ui-fidelity-guardrail.md §3.4` 描述的 4 类 token（typography / color / spacing / motion），不直接 inline reference 网站的 CSS 值。

```diff
- // ❌ 反面：直接 copy Linear 的 css 值，scattered hardcoded
- <h1 style={{ fontSize: 96, fontWeight: 800, letterSpacing: -0.04 }}>...</h1>

+ // ✓ 正面：抽象为 token，components 引用
+ // globals.css @theme:
+ //   --text-landing-hero: clamp(2.75rem, 6vw, 5.5rem);
+ //   --tracking-landing-display: -0.035em;
+ //   --leading-landing-display: 0.95;
+ <h1 className="text-landing-hero tracking-landing-display leading-landing-display">...</h1>
```

### Acceptance / Reviewer 验收口径

Visual polish spec 必把 reference 落到 acceptance 文字时**避免"像素一致"措辞**，改为"精神落地"主观评判：

| 反面 acceptance 文字 | 正面 acceptance 文字 |
|---|---|
| "Hero 视觉与 Linear linear.app 像素一致" | "Hero 视觉参照 Linear 精神（极简 / 大量 white space / 微妙 motion）在 landing 落地，由 Reviewer L2 主观评判" |
| "FAQ smooth height 与 Plausible 完全相同" | "FAQ 折叠交互 motion 升级（smooth height transition），无需对齐 Plausible 像素" |

### 适用边界 vs 不适用

| 适用（必走）| 不适用（跳过本段）|
|---|---|
| Visual polish / landing 视觉重做 / brand identity 类 batch | Feature 实现 / Bug hotfix / framework sediment / DB migration / a11y 修复 |
| 引入外部 reference URL（Linear / Vercel / Stripe / Plausible / Notion 等）| 0 reference URL 的内部 spec（如 BL-066 / BL-068 等 AI 流程批次）|
| Planner spec lock 阶段（A1）| Spec 已 lock 后的 fixing / reverifying 阶段（不再讨论 reference 提炼）|

### BL-078 D2 lock 实战示例

- **D2 lock 文字：** "Linear 主 (https://linear.app) + Plausible 辅 (https://plausible.io)"
- **Reviewer L2 acceptance 文字：** "设计参照 Linear / Plausible 精神（极简 / white space / 微妙 motion）在 landing 落地" — 主观评判 PASS
- **Generator 实施：** `src/styles/globals.css @theme` 25 个 landing-* token + `design-draft/landing-v2-tokens.md` 110 LOC 对照表（Linear/Plausible 信号矩阵 → 本项目 token 映射）

**配套：**
- `framework/harness/ui-fidelity-guardrail.md §3.4` landing visual token layer 规范（BL-078 #2 — 落地 4 类 token 类别）
- `framework/harness/generator.md §18` 现代 CSS 渐进增强（BL-078 #3 — Native API + Fallback + reduced-motion 三层守门）
- `framework/harness/evaluator.md §11.6` motion a11y 三件套（BL-078 #1 + #5 — 视觉精修 a11y 验收）

来源：BL-078 plan v2 D2 lock + 用户 2026-05-27 ack（"Linear 主 + Plausible 辅" 实战印证 reference 精神落地非像素复刻范式）。

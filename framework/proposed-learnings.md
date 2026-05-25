# Framework 提案暂存区

> Generator 和 Evaluator 在工作中发现值得沉淀的经验时，追加到本文件。
> Planner 在 done 阶段读取本文件，逐条提交给用户确认。
> 确认后由 Planner 正式写入 `framework/` 对应文件，并在 `CHANGELOG.md` 追加记录，最后从本文件移除已确认条目。
> 已闭环条目归档到 `framework/archive/proposed-learnings-archive-vX.Y.md`。

---

## 写入流程（D7 + D8 lock，BL-071 F007）

sediment（沉淀）从 proposed-learnings.md 走向 `framework/harness/*.md` 的标准路径。本节是 D8 lock 把"散落在多个角色文件 + 经验记忆"的沉淀工作流统一到 proposed-learnings.md header 一处的产物。

### 4 步流程

| 步 | 谁做 | 何时 | 产物 |
|---|---|---|---|
| **1. propose** | Generator / Evaluator | 批次 building / verifying / fixing / reverifying 任意阶段发现 | 追加 entry 到 `framework/proposed-learnings.md` 末尾（line 40 起新条目区），格式见下 |
| **2. 用户 ack** | 用户 | done 阶段 Planner 逐条提交时 / 即时对话中 | 用户回复"ack"或等同措辞；含修订意见时 entry 文字按意见修订后再 ack |
| **3. inline-merge** | Planner | done 阶段（或独立 framework sediment batch） | 按 D7 inline-merge 规则写入 `framework/harness/*.md` 对应 topic 段（不是 chronological-append §N，详见下文） |
| **4. archive** | Planner | inline-merge 完成同 commit | 归档 entry 全文到 `framework/archive/proposed-learnings-archive-vX.Y.Z.md` + 加 `<!-- vX.Y.Z 沉淀完成 -->` HTML 注释到本文件 header markers 块 + 从新条目区移除原 entry + `framework/CHANGELOG.md` 顶部新增 vX.Y.Z 段 1-line summary |

### D7 inline-merge 强制规则（禁 chronological-append §N）

**核心：** 新 sediment 必须找贴近的 topic 段合并，**不得**通过追加 `§N` chronological 段落落地。

**inline-merge 优先级（从高到低尝试）：**

1. **合并矩阵行：** 目标文件已有矩阵/表格（如 planner-checklists.md 铁律 1 矩阵 / generator.md 测试边界矩阵）→ 新规律若属同一维度，直接加新行
2. **加子段：** topic 段已存在但新内容是该 topic 的延伸 / 反例 / 实战 → 加子段 §X.Y（如 deploy-patterns.md §3.2 加 §3.2.1 staging deploy 前置 git pull）
3. **修订段内文字：** 新内容是对已有规则的细化 / 边界澄清 → 直接修订段内某段文字（如 evaluator.md §11.1 fire-and-forget 段加一句"或 vi.waitFor 50-100ms retry"）
4. **开新 topic 段（最后手段）：** 仅当上述 3 个都不适用 — 即新 sediment 真的代表一个全新维度，topic 在现有文件中无对应位置 → 开新 ## 段

**反模式：** 追加 `## §N. 新规律 X` 到文件末尾时间序排，这是 v0.9.22 之前的旧习。BL-071 audit §3.1 暴露 evaluator.md §10-§20 11 段时间序最严重。

### sediment 类型分类

| 类型 | 含义 | 典型写入位置 |
|---|---|---|
| **新规律** | 跨多批次复现的稳定模式 | 合并入矩阵 / 加子段 |
| **新坑** | 单次踩坑但有借鉴价值 | "踩坑列表"段 / 反例段 |
| **模板修订** | 已有 spec / signoff / acceptance 模板需调整 | 直接 inline 改原段 |
| **铁律补充** | 升级 harness-rules.md 铁律列表（影响所有项目） | `harness-rules.md` 新增/修订铁律 + 必须用户书面 ack + framework-generic 抽象后 port template |

### 写入位置决策树

```
是 sediment 还是？
├─ 否 → 不进 proposed-learnings.md，可能进 ADR 或 spec 反例段
└─ 是
   ├─ 影响所有项目（铁律级）？
   │  ├─ 是 → harness-rules.md 铁律 + 用户书面 ack 才能 port template
   │  └─ 否
   │     ├─ 影响多角色？
   │     │  ├─ 是 → 多文件同步（按角色 cross-ref 矩阵）
   │     │  └─ 否 → 单角色文件
   │     └─ 项目特定 vs framework-generic？
   │        ├─ 项目特定 → 当前项目根 + framework-generic template 不动
   │        └─ framework-generic → 项目根 + framework-generic template 同步
   └─ 是 ADR-worthy（跨批次影响 / 不可逆 / 当时辩论过的关键决策）？
      └─ 是 → 加 ADR 文件 + 引用 proposed-learnings entry 作为来源
```

### Entry 格式（追加到本文件新条目区）

```markdown
## [YYYY-MM-DD] {Claude CLI / Codex / Generator agent-id} — 来源：{触发场景简述：批次 ID + feature ID + fix-round 编号 / audit 名}

**类型：** 新规律 / 新坑 / 模板修订 / 铁律补充

**内容：** [一句话总结 → 多段详述 → 含具体 commit hash / file:line / 反例 case]

**建议写入：** `framework/harness/{file}.md` §{具体段名 or 矩阵行编号} / 配套 cross-ref / 同主题合并提示

**状态：** 用户 YYYY-MM-DD 已 ack — 待 done 阶段 / 专门 framework sediment batch 正式写入
```

---

<!-- 2026-05-04: v0.9.9 沉淀完成（8 条 learnings 来源 BL-030/BL-031/BL-032），全部已写入 framework/ 对应文件 + CHANGELOG。 -->

<!-- 2026-05-04: v0.9.10 沉淀完成（3 条 learnings 来源 BL-033 + prod-mvp-readiness-audit），全部已写入 framework/ 对应文件 + CHANGELOG。 -->

<!-- 2026-05-05: v0.9.11 沉淀完成（5 条 learnings 来源 BL-020 + backend-full-scan-2026-05-04 audit），全部已写入 framework/ 对应文件 + 项目根 .nvmrc + .auto-memory/environment.md + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.11.md。 -->

<!-- 2026-05-05: v0.9.12 沉淀完成（3 条 learnings 来源 BL-034），全部已写入 pre-impl-adjudication.md §11 + database-patterns.md §8.1 + deploy-patterns.md §5 + evaluator.md §17 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.12.md。 -->

<!-- 2026-05-06: v0.9.13 沉淀完成（2 条 learnings 来源 BL-024），全部已写入 deploy-patterns.md §5.1 + ai-action-contract.md §4.7 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.13.md。 -->

<!-- 2026-05-06: v0.9.14 沉淀完成（2 条 learnings 来源 BL-040 + BL-041 audit 过期 + BL-043 staging fix），全部已写入 planner.md 铁律 1 矩阵 +2 行延伸 + deploy-patterns.md §1.7（v0.9.7 §1.6 范围扩展）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.14.md。 -->

<!-- 2026-05-07: v0.9.15 沉淀完成（2 条 learnings 来源 BL-021 F002 撤再翻盘 + BL-049 测试基建 audit），全部已写入 planner.md 铁律 1 矩阵 +2 行（v0.9.15 #1 跨 pool 复现 + #2 stub environment-agnostic）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.15.md。 -->

<!-- 2026-05-08: v0.9.16 沉淀完成（1 条 learning 来源 BL-052 verifying P5 裁决），全部已写入 planner.md §"Planner 裁决职责" §P5.2 段 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.16.md。 -->

<!-- 2026-05-08: v0.9.17 沉淀完成（1 条 learning 来源 BL-012 apify-kol fork audit），全部已写入 planner.md 铁律 1 矩阵 +1 行（v0.9.17 记忆条目陈旧风险）+ 反面案例段（BL-012 5/7→5/8 实战）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.17.md。 -->

<!-- 2026-05-08: v0.9.18 沉淀完成（1 条 learning 来源 BL-012 F001 fix-round 1 admin role enum mismatch），全部已写入 planner.md 铁律 1 矩阵 +1 行（v0.9.18 auth role enum 实物核查）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.18.md。 -->

<!-- 2026-05-08: v0.9.19 沉淀完成（1 条 learning 来源 BL-012 F002 fix-round 2 prod zod schema mismatch），全部已写入 planner.md 铁律 1 矩阵 +1 行（v0.9.19 external API response zod schema 实物 sample 验证）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.19.md。 -->

<!-- 2026-05-10: v0.9.20 沉淀完成（1 条 learning 来源 BL-060 fix-round 1→2 e2e suite-level isolation vs 单 case 信号区分），写入 .auto-memory/role-context/evaluator.md §"E2E suite 稳定性诊断" + .auto-memory/role-context/generator.md §"扩范围 vs 单点修的判断"。后续 batch 候选（抽 tests/e2e/helpers/auth.ts + global-setup.ts + storageState 复用）入 backlog 跟踪。归档暂未写 framework/archive/proposed-learnings-archive-v0.9.20.md（git history 已有 commits cae1f8f / 821c094 完整记录）。-->

<!-- 2026-05-14: v0.9.21 沉淀完成（4 条 learnings 来源 BL-064 fix-round 3 + BL-065-R1 + BL-065-F006 + BL-065-F007 fix-rounds=1），全部已写入：planner.md 铁律 1 矩阵 +1 行（v0.9.21 i18n template 路由迁移）+ §fix-rounds 数解读；generator.md §9 IA refactor redirect scope + §10 大型删除批次执行模板；evaluator.md §20 L1+角色门禁手动探针；同步 .auto-memory/role-context/{generator,planner,evaluator}.md 短摘要 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.21.md。 -->

<!-- 2026-05-17: v0.9.22 沉淀完成（13 条 learnings 来源 BL-066 done 3 条 + BL-067 done 5 条 + BL-068 done 5 条），中等深度沉淀模式：archive 完整 13 条全文 + CHANGELOG 完整 13 条 1-line summary + cross-reference 待写入文件；framework/harness/*.md 实际段落起草（估 12 段 × 30-80 行）**留独立 framework batch 或合并 v0.9.23 一并沉淀**，避免 v0.9.22 commit 范围过大冲淡 BL-069 节奏。归档：framework/archive/proposed-learnings-archive-v0.9.22.md。待写入位置详见归档 §4 / CHANGELOG v0.9.22 段表。 -->

---

<!-- 新条目从这里开始追加 -->

## [2026-05-18] Claude CLI — 来源：BL-069 fix-round 1 B1 / Generator + Planner johnsong

**类型：** 新规律

**内容：** **middleware IaRedirectRule 加 optional `status` field 模式** — 向后兼容（default 302）+ per-rule override 301，让同一 middleware 实现支持混合 301/302 redirect。BL-069 fix-round 1 案例：BL-064 IA refactor 时全部 redirect 默认 302（开发期保留 rollback 能力），BL-069 spec 要求 KB+Campaigns/new → /brief 用 301 永久（per 决策点 #2 用户 ack 完全 redirect）。Reviewer L2 验出 302，fix-round 1 修：`IaRedirectRule` interface 加 `status?: 301 | 302` field（default 302），BL-069 3 条 rule 设 status=301，middleware.ts 用 `rule.status ?? 302`，e2e ia-refactor-redirects.spec.ts REDIRECT_CASES 加 status field + `assert response.status()`。**应用：** 未来 IA refactor 类批次 redirect 设计时，spec 内显式规定 status，middleware 实现端 optional field + default 安全；避免"全 302"或"全 301"硬编码导致 mixed-rule 批次重写。

**建议写入：** `framework/harness/generator.md` 新段 §"middleware IaRedirectRule mixed-status 模式"（含 BL-069 fix-round 1 案例 + IaRedirectRule interface 签名模板 + spec 表 status 字段示例）或合并入 v0.9.22 #5 InMemoryJobQueue 同段（基础设施 MVP 模式）

**状态：** 用户 2026-05-18 已 ack — 待 BL-070 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-18] Claude CLI — 来源：BL-069 fix-round 1 B2 / Generator + Planner johnsong

**类型：** 新规律 / 模板修订

**内容：** **staging-only env flag + runbook 让 Reviewer 可执行受控 chaos test 模式**。BL-069 fix-round 1 案例：F002 spec acceptance 含 cap 满 silent fallback 路径，但 Reviewer L2 时发现无 staging-only 模拟入口（dev only 路径用 mock，staging 真实跑需触发真 cap 满即烧真钱）→ Reviewer 标 B2 medium blocker。fix-round 1 修：(1) 加 `BRIEF_FORCE_CAP_EXHAUSTED=true` staging-only env flag（严格 `=== 'true'` 防 typo / audit `forced=true` 字段标记）短路 cap 检查；(2) 写 `docs/dev/bl069-cap-exhausted-simulation-runbook.md`（备份 + tee + pm2 reload + UX 验 + 清理 5 步）；(3) 2 单测（启用 enable / `'yes'` 非严格 regression guard）。**对比 BL-067 §6 chaos test 模式（改 .env.staging API key）：** 本模式更安全 — 专用 flag 不破坏全 API key；runbook 显式 + 严格 `=== 'true'` 防 typo；audit `forced` 字段让 dashboard 监控可区分真 cap 满 vs 模拟。**应用：** 所有"chaos/edge case 实测"类 acceptance（cap 满 / network error / 5xx mock）都应用此模式 — spec 内显式规定 staging-only flag + runbook 路径，避免 Reviewer L2 卡壳。

**建议写入：** `framework/harness/evaluator.md` 新段 §"chaos test 模式：staging-only env flag + runbook"（含 BL-069 fix-round 1 案例 + 对比 BL-067 §6 模式 + flag 命名规范 + runbook 5 步模板）

**状态：** 用户 2026-05-18 已 ack — 待 BL-070 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-18] Claude CLI — 来源：BL-068 vs BL-069 fix-rounds 对比 / Planner johnsong

**类型：** 新规律 / 反面案例对比

**内容：** **fix-round 类型分类：implementation-gap vs LLM-behavior**。BL-068 fix-rounds=3（B1-B4 client + B5-B6 prompt + B6 真因 dedupe），BL-069 fix-rounds=1（B1 redirect status + B2 chaos flag）— **数量差 3x，原因 = fix-round 类型不同**。

**类型 A: implementation-gap fix-round**（BL-069 B1+B2）— Generator 实装与 spec 字面有差距（302 vs 301 / 缺 chaos flag），Reviewer L2 报，Generator 直接修代码即可，**1 轮通过**。

**类型 B: LLM-behavior fix-round**（BL-068 B5-B6）— LLM 实际输出与 prompt 预期不一致（凑足 N / 重复 ID），需要 MCP trace 抓真因（v0.9.22 #9）+ server-side fallback（dedupe-then-validate v0.9.22 #10）+ prompt 强化（自检 § v0.9.22 #11），**多 fix-round 才收敛**。

**应用：** Planner 在 Reviewer 报 verifying 失败时先分类（A or B），A 直接 ack Generator 修代码 + 推估 1 fix-round 通过；B 必先 trace（v0.9.22 #13）+ 推估 2-3 fix-round 通过。预期 fix_rounds 数 = 1 + N(B 类 blockers)。**沉淀价值：** 帮助 Planner 起草 batch 计划时按 LLM 类批次 vs 静态实装类批次区分预期 fix_rounds 数（影响排期 + 用户期望管理）。

**建议写入：** `framework/harness/planner.md` 新段 §"fix-round 类型分类：A implementation-gap vs B LLM-behavior"（含 BL-068 vs BL-069 对比表 + 预期 fix_rounds 数公式 + 与 v0.9.22 #13 配对使用）

**状态：** 用户 2026-05-18 已 ack — 待 BL-070 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

<!-- BL-070 done @ 2026-05-25 Planner Kimi 批量追加 12 条 v0.9.23 候选 (#17-19 fix-round 0 + #21-24 fix-round 1 + #25 Planner + #26-28 fix-round 2 + #29-30 fix-round 3). 用户 2026-05-25 ack 方案 A — 本会话仅追加 proposed-learnings.md，存量 26 条整体留专门 framework sediment batch 落 framework/harness/*.md + CHANGELOG + archive. -->

## [2026-05-19] Claude CLI — 来源：BL-070-F004 #1 / Generator johnsong

**类型：** 新坑（v0.9.23 候选 #17，扩展 v0.9.21 BL-064-F006 沉淀范围）

**内容：** **删显式子路由前必须先加上游 [id] UUID guard**。BL-070-F004 案例：删 `src/app/[locale]/(app)/campaigns/new/page.tsx` 后 Next.js fallback 到动态 `/campaigns/[id]/page.tsx` → Prisma `findFirst({ id: 'new' })` 抛 `invalid input syntax for type uuid` 500。同 commit 必须给动态 `[id]/page.tsx` 加 `UUID_RE.test(id)` guard 走 `notFound()`。grep 自查：`find src/app -name 'page.tsx' -path '*\[*\]*'` 列动态路由后逐个查是否已有 guard。

**建议写入：** `framework/harness/generator.md` 新段 §"删显式子路由前的 UUID guard 检查清单"（扩展 v0.9.21 BL-064-F006 沉淀）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-19] Claude CLI — 来源：BL-070-F004 #2 / Generator johnsong

**类型：** 新坑（v0.9.23 候选 #18）

**内容：** **`notFound()` 在 next-intl 包装下 HTTP status 不可预测（200 或 404）**。Next.js 15 App Router server component `notFound()` 标准是 404，但 next-intl middleware 包装响应后实际 status 可能 surface 为 200 + not-found body。e2e 验路由废弃时不能严格 `expect(status).toBe(404)`，应 `expect(status).toBeOneOf([200, 404])` + 验 Location header 不含错误目的地（或验 page body 含 "not found" 文案 + URL 未变化）。

**建议写入：** `framework/harness/generator.md` 新段 §"next-intl + notFound() HTTP status 不可靠"（含 e2e assertion 模板）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-19] Claude CLI — 来源：BL-070-F005 #1 / Generator johnsong

**类型：** 新坑（v0.9.23 候选 #19）

**内容：** **删 i18n deprecated ns 前必须 grep 实际 callers，ns 可能跨 batch git mv 后仍 in use**。BL-070-F004 git mv 把 KB CRUD 组件搬到 brief/ 但组件内部仍 `useTranslations("knowledgeBase")`。盲信 marker `will delete this namespace` 整 ns 删会破 production。Python 批处理脚本应内嵌该自检：`grep -rln 'useTranslations|getTranslations.*"<ns>"' src/` 0 caller 才能整 ns 删。

**建议写入：** `framework/harness/generator.md` 新段 §"i18n deprecated ns 删除前的 caller-grep 自检"（含 Python 批处理脚本模板）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-20] Claude CLI — 来源：BL-070 fix-round 1 #21 / Generator johnsong

**类型：** 新坑（v0.9.23 候选 #21）

**内容：** **e2e server-action mock 不可用 — RSC wire format 不可由 Playwright `route.fulfill` 满足**。BL-070 F006 4 个 refine e2e case 在 mock fired 后 toast 永远 timeout，根因 = Playwright `page.route.fulfill({body: JSON.stringify(...)})` 返 plain JSON 不满足 Next.js RSC wire format → client deserialise throw → catch 走 network toast。任何 body shape filter 都救不了。必须 `test.skip(true, SKIP_*_REASON)` always-skip + unit suite + staging dogfood 覆盖。同 brief-flow.spec.ts cases 3-5 历史 precedent。

**建议写入：** `framework/harness/evaluator.md` 新段 §"e2e server-action mock 不可用：always-skip + unit + staging 三件套"（含 RSC wire format 解释 + skip 模板）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-20] Claude CLI — 来源：BL-070 fix-round 1 #22 / Generator johnsong

**类型：** 模板修订（v0.9.23 候选 #22）

**内容：** **`prisma migrate dev` 创 migration 不自动加 ROLLBACK 注释**，`scripts/validate-rollback-sql.sh` 是后置 CI 检查，触发 CI 红。建议 `prisma migrate dev` wrap script 自动注入 ROLLBACK skeleton（`-- ROLLBACK: <inverse SQL here>`），从生产源头避免 CI 红。

**建议写入：** `framework/harness/generator.md` 新段 §"prisma migrate dev wrap script — 自动注入 ROLLBACK skeleton"

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-20] Claude CLI — 来源：BL-070 fix-round 1 #23 / Generator johnsong

**类型：** 新坑（v0.9.23 候选 #23）

**内容：** **Next.js 16 `'use server'` file-level directive 禁非 async function exports**。在 `'use server'` 文件里加 zod schema/常量 / 普通对象/类的 export 会触发 build/runtime error。zod schema/常量必须独立到 `schema.ts` / `constants.ts` 等无 `'use server'` 的模块。BL-070 fix-round 1 实证：landing batch 加 `AccessRequestSchema` 到 actions.ts 触发，必须抽到 `src/app/[locale]/request-access/schema.ts`。

**建议写入：** `framework/harness/generator.md` 新段 §"'use server' file-level directive 约束清单"（含 zod schema 抽离模板）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-20] Claude CLI — 来源：BL-070 fix-round 1 #24 / Generator johnsong

**类型：** 模板修订（v0.9.23 候选 #24）

**内容：** **`github-actions[bot]` 默认 `GITHUB_TOKEN` commit 不 cascade CI workflow** — 这是 GitHub 默认安全行为（防止 bot commit 触发无限 CI 循环）。`ci.yml` 必加 `workflow_dispatch` trigger 才能在 bot commit 后手动重跑 CI；类似 `deploy-staging.yml` / `deploy-prod.yml` / `update-visual-baselines.yml` 也应检查并加 `workflow_dispatch`。

**建议写入：** `framework/harness/deploy-patterns.md` 新段 §"github-actions[bot] commit 不 cascade CI — workflow_dispatch 通解"

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-25] Claude CLI — 来源：BL-070 Planner Kimi 反思 / Planner Kimi

**类型：** 新规律（v0.9.23 候选 #25）

**内容：** **对外上线 ready checklist 中 Lighthouse perf 类硬门槛，必须在 spec 起草阶段就列入 acceptance**。本批次 F008 §10 #8 在 batch end-stage（F001-F007 全 done 后）才发现 perf 75-78 < 80 触发 fix-round 2 perf 攻关（+3 features F009/F010/F011 + 2 fix-rounds CI 自修），延期 ~2 day。**应用：** 后续 IA refactor / 重客户端组件类 batch 在 features.json 起草时即把 perf score / TBT / LCP / CLS 量化门槛列为 acceptance，Generator 实装时同步用 `next/dynamic` + `next/image` + Suspense 模式；不要 batch 末尾才 retrofit perf。

**建议写入：** `framework/harness/planner.md` 新段 §"perf 量化门槛入 acceptance — 反 retrofit 模式"（含 BL-070 反面案例 + 起草模板）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-25] Claude CLI — 来源：BL-070 fix-round 2 #26 / Generator Kimi

**类型：** 新规律（v0.9.23 候选 #26）

**内容：** **spec perf optimization 类 acceptance 必须分类 client component (chunk-split 靶) vs server async (Suspense 靶)，不该混在一条 `ssr:false` acceptance line 里**。BL-070 F009 spec acceptance 列出 reach 5 组件 `ssr:false` 懒载，但其中 4 个（SendingPerformanceChart/RecentRepliesCard/RecentlySentTable/TopTemplatesCard）为 server 组件 — 零 client JS 贡献，不该走 `ssr:false`（违 spec §5 不变量 #5）。实际只 OutreachComposer 走 `ssr:false`，其余 4 个 server 组件的 SSR 延迟由 F011 Suspense 治理。

**建议写入：** `framework/harness/planner.md` 新段 §"perf acceptance 必须区分 client/server 组件"（含 chunk-split vs Suspense 分类决策树）

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-25] Claude CLI — 来源：BL-070 fix-round 2 #27 / Generator Kimi

**类型：** 新规律（v0.9.23 候选 #27）

**内容：** **异构 CDN avatar/logo 场景，`unoptimized={true}` + explicit dims 是最稳的 next/image 落地姿势**，优于强上 `images.remotePatterns` 累积白名单导致 build error / 运行时 403。多平台 KOL avatar CDN（YT 现；TikTok/Twitch/Bilibili later）远多于 next.config.ts whitelist 能覆盖，`unoptimized` 跳 AVIF/WebP 转换通路但保留 explicit width/height 的 CLS reservation 收益。小尺寸 avatar (32-64px) 优化收益微；大图 (banner 1200×240) 也 unoptimized — 在低流量 detail page 不致命。

**建议写入：** `framework/harness/generator.md` 新段 §"next/image 异构 CDN 落地：unoptimized + explicit dims"

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-25] Claude CLI — 来源：BL-070 fix-round 2 #28 / Generator Kimi

**类型：** 新坑（v0.9.23 候选 #28）

**内容：** **引入 lazy boundary 时必须检查并同步老 fidelity test importer 名**。BL-070 F009 把 `MatchRefineBar` 改为 `MatchRefineBarLazy` 后，老 `f004-bl068-refine-fidelity` 测试断言 `import { MatchRefineBar } from "./MatchRefineBar"` 失败，必须同步改 2 case，否则 fidelity grep 报误警。

**建议写入：** `framework/harness/generator.md` 新段 §"lazy boundary 引入时的 fidelity test 同步清单"

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-25] Claude CLI — 来源：BL-070 fix-round 3 #29 / Generator Kimi

**类型：** 新规律（v0.9.23 候选 #29）

**内容：** **Suspense fallback skeleton 必须像素级镜像实际 outer 结构**，不仅 `glass-panel + animate-pulse` 视觉。skeleton 高度差异会按下游 shifted 内容总高度（本批 1039px 高的主网格）放大 CLS 评分。本次 88px → 150px 的 62px 反差直接造成 `/match` 0.348 CLS 评分。修复 = skeleton 重写为同 grid + 4×150px 卡槽，CLS 跌至 0.008。**关联反思：** F011 Suspense PR push 前未做 Lighthouse 本地 dry-run → Reviewer fix-round 2 才捕 CLS → 沉淀：Suspense 落地必配 Lighthouse Desktop logged-in 自测。

**建议写入：** `framework/harness/generator.md` 新段 §"Suspense fallback skeleton 像素级镜像规范 + Lighthouse 落地自测"

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

---

## [2026-05-25] Claude CLI — 来源：BL-070 fix-round 3 #30 / Generator Kimi

**类型：** 新规律（v0.9.23 候选 #30）

**内容：** **Suspense fallback 宽度在 `flex-wrap` 父容器下必须与实际等宽**（或更宽），否则 swap 时横向 reflow 触发换行 → 横向 reflow 间接放大垂直 CLS 评分。本次 `SaveSearchControlsSkeleton` 从 `w-44`（~176px）改为 ~460px 等宽 SaveSearchControls 实际渲染宽度，消除 flex-wrap header 横向 reflow。**Lighthouse 13.x audit 定位工具：** `cls-culprits-insight` 在 JSON 输出 path = `details.items[].node.selector + snippet + boundingRect` — 比 `layout-shift-elements` 更准确直指 shift target，后续优化 perf 优先 grep 此键。

**建议写入：** `framework/harness/generator.md` 新段 §"Suspense fallback 宽度等宽规范（flex-wrap 父容器）+ Lighthouse cls-culprits-insight 定位法"

**状态：** 用户 2026-05-25 已 ack — 待 framework sediment batch 正式写入

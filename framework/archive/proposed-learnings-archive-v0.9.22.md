# Framework Proposed Learnings — v0.9.22 归档

> **沉淀日期：** 2026-05-17
> **沉淀来源：** BL-066 done 收尾 (5/15, 3 条) + BL-067 done 收尾 (5/16, 5 条) + BL-068 done 收尾 (5/17, 5 条) = 13 条
> **用户 ack 时间：** 2026-05-15 / 2026-05-16 / 2026-05-17（各批次 done 阶段 inline ack）
> **沉淀模式：** 中等深度 — archive 完整保留 13 条 + CHANGELOG 完整段 + proposed-learnings.md 清空。framework/harness/* 各文件实际段落起草留独立 framework batch（或合并 v0.9.23 同沉淀），避免 v0.9.22 commit 范围过大冲淡 BL-069 节奏。

---

## §1 BL-066 done 阶段 3 条 (用户 2026-05-15 ack)

### #1 连续 3 次 pre-impl audit + Planner 裁决模式

**类型：** 模板修订

**内容：** 连续 3 次 pre-impl audit + Planner 裁决模式（F002 / F006 / F007 共 18 决议点 lock）→ 9 features + 0 fix-round 一次性成型（fix_rounds=0），验证 v0.9.21 pre-impl-adjudication 模式 ROI。批次级"3 audit 串联"是新粒度（以往多为单 feature 一 audit），值得作为大批次（≥ 9 features）的推荐节奏沉淀。

**建议写入：** `framework/harness/pre-impl-adjudication.md` 新段 §"批次级多 audit 串联模式"（具体规模门槛 + 适用判断 + 与 fix-rounds 关系实证）

---

### #2 verifying gate 量化 criterion 锚定语义而非字面

**类型：** 新规律 / 新坑

**内容：** verifying gate 量化 criterion 设计应锚定**语义信号**而非**字面数字**。BL-066 F007 staging recompute 后字面 criterion (b)「top-15 内 max-min ≥ 5」失败（top-15 全 clamp 100），但语义 BL-048 fix（mega-nano 不再同 100）已达成；用户 ack 选项 (i) data-driven 修订 criterion 为 (a') 全 dataset spread + (b') top-15 最小 follower threshold，而非调 formula。Evaluator 起草 criterion 时如不预判 dataset 真实形态会落入字面陷阱。

**建议写入：** `framework/harness/evaluator.md` 新段 §"量化 verifying gate criterion 设计"（含字面陷阱反面案例 + data-form-aware 设计 checklist）

---

### #3 Generator audit 起草前实测原子组件 surface

**类型：** 新规律

**内容：** Generator 在 pre-impl audit 起草前必须**实测原子组件实际 surface**，而非按 README / 类型签名"字面想象"。BL-066 F006 案例：Table.tsx README 看似有 col cap 限制，Generator audit 建议保守拆列，但 Planner 实测 Table.tsx fully flexible 无 col cap，最终裁决 #4=A（6 列方案）偏离 Generator 建议。此案例说明 audit 输入若基于"文档/类型签名想象"会产生系统性保守偏差，Planner 反复实测纠偏成本高。

**建议写入：** `framework/harness/generator.md` 新段 §"audit 起草前的实测节奏"（含 BL-066 F006 反面案例 + 实测优先级 checklist：原子组件 / 路径配置 / SQL 实际行为 / API response shape）

---

## §2 BL-067 done 阶段 5 条 (用户 2026-05-16 ack)

### #4 Next.js 16.2.x Turbopack 生产 build BUILD_ID bug + --webpack 防御

**类型：** 新坑 / 模板修订

**内容：** Next.js 16.2.x 默认 `next build` 走 Turbopack → 生产构建**不写 `.next/BUILD_ID` 文件**（仅在 `.next/static/<hash>/` 子目录名编码 BUILD_ID）。但 `server.js` 用 `next({ dev: false })` + `app.prepare()` 启动时**仍走旧 webpack 路径**读 `.next/BUILD_ID` 文本 → 抛 `production-start-no-build-id` → 进程启动失败 → PM2 fallback 旧 worker → 旧 worker 内存 build manifest 不含新 chunks → per-chunk 404 ErrorBoundary。**防御：** 全栈 force `next build --webpack` flag（`package.json` + `scripts/deploy-staging.sh` + `scripts/deploy-prod.sh`）+ 同 commit 加 `rm -rf .next/build .next/turbopack .next/static/[A-Za-z0-9]*` 清旧 Turbopack 残留（不动 `.next/cache` 保 build 加速）。BL-067 fix-round 1 commit f284d35 实战验证。**附加：** webpack 严格 typecheck 比 Turbopack 严，迁移时常暴露 hidden TS errors（commit 6dbe231 修 4 处 Record exhaustive / undefined access / mock shape）— 未来 Next.js 升级 checklist 必加项。

**建议写入：** `framework/harness/deploy-patterns.md` 新段 §"Next.js 16.x Turbopack 生产 build 兼容性陷阱 + --webpack 防御" + `framework/templates/` 加 build artifact 健康检查脚本（缺 `.next/BUILD_ID` 或 `.next/required-server-files.json` 即异常）

---

### #5 InMemoryJobQueue fire-and-forget + mount self-heal 模式

**类型：** 新规律

**内容：** **InMemoryJobQueue + delay:1 fire-and-forget + mount self-heal 模式**作为 BullMQ 的 MVP 前置方案，适用于 PM2 single-instance cluster=1 架构。模式核心：（1）server action `void jobQueue.add(name, payload, { idempotencyKey, delay: 1 })` 让 LLM 异步跑入下一 tick，server action 立即 return 不阻塞 mount；（2）进程重启丢 prewarm 由用户重 enter 页面触发 mount self-heal 自然恢复；（3）idempotencyKey 同进程内幂等防重；（4）worker concurrency 由 setTimeout 隐式 1（不并发）。**升 BullMQ 的触发条件：** dogfood 期发现 (a) PM2 reload 频次 > 2 次/day 或 (b) scale-out 到 cluster>1 或 (c) job 处理时间 > 60s 致 mount→short 完成延迟感知。**反面：** 不适用于"必须可靠交付"类 job（如付款回调）。

**建议写入：** `framework/harness/generator.md` 新段 §"InMemoryJobQueue MVP vs BullMQ 升级判断"（含触发条件 + BL-067 F005 实战案例 + spec acceptance 措辞模板）

---

### #6 aigcgateway caller SDK 抽象层沉淀触发门槛

**类型：** 模板修订

**内容：** **aigcgateway action caller SDK 抽象层沉淀模式**。当 codebase 出现 N 处 inline POST `/actions/run` + `parseFencedJson` + cost-cap + audit + error mapping 重复（BL-067 起前已有 customize.ts + topic-cloud.ts 两份，BL-067 即将再加 2 处，BL-068 还会加 1 处）→ 抽统一 `runAigcAction<T>(opts)` SDK。**触发门槛：** ≥3 处 inline 重复 + 即将出现第 4 处 → 沉淀 SDK 抽象层（早于此门槛沉淀属过早抽象 / 晚于此门槛沉淀属维护噩梦）。BL-067 F001 +2h 落 `src/lib/aigc/run-action.ts` SDK 242 LOC + 9 unit tests，BL-067 F004 + F005 两 caller 直接复用，BL-068 + 未来 LLM caller 沿用。**约束：** 抽 SDK 时不动现有 caller 保向后兼容，迁移留下个批次评估（避免 scope creep）。

**建议写入：** `framework/harness/ai-action-contract.md` 新段 §"aigcgateway caller SDK 抽象层沉淀触发门槛"（含 ≥3 inline + 即将第 4 处规则 + BL-067 F001 实战案例 + runAigcAction<T> 签名模板）

---

### #7 pre-impl-adjudication Generator 建议命中率作为 audit 质量信号

**类型：** 新规律

**内容：** **pre-impl-adjudication 模式 Generator 建议命中率作为 audit 质量信号**。BL-067 F001 audit 6 议题 Planner 100% ack Generator 默认建议（#1:A/#2:A/#3:A/#4:B/#5:A/#6:A），BL-066 F002 audit 命中率 4/5（#5 偏离），BL-066 F006 audit 命中率 4/5（#4 偏离），BL-066 F007 audit 命中率 7/8（#7 重裁决）。**规律：** Generator 建议命中率 ≥80% 时 Planner 裁决可降复杂度（直接 ack + 短理由）；< 80% 时 Planner 需深挖偏离项（如 BL-066 F006 #4 是因 Generator 未实测 Table.tsx surface 字面，Planner 实测纠偏，沉淀为 BL-066 v0.9.22 候选 #4 "audit 起草前实测原子组件"）。**应用：** 4 次 audit 累积统计可作 Generator audit 质量指标 — 命中率持续 < 70% 警示 Generator audit 起草纪律有偏差，需起 framework 修订。

**建议写入：** `framework/harness/pre-impl-adjudication.md` 新段 §"Generator 建议命中率作为 audit 质量信号"（含 BL-066 + BL-067 4 次 audit 累积数据 + 命中率分布 + Planner 裁决复杂度调整规则）

---

### #8 Next.js 16 webpack 严格 typecheck 暴露 hidden TS errors checklist

**类型：** 新坑

**内容：** **Next.js 16 webpack 严格 typecheck 暴露 4 处 hidden TS errors**（BL-067 fix-round 1 commit 6dbe231 修复）：（1）`schemas.ts` `Record<AssetType, ...>` 加新 enum 值后必须补 entry（webpack exhaustive check 强制 / Turbopack 宽松不报）；（2）worker + server actions 中 `valueScoreBreakdown.breakdown` → `valueScoreBreakdown.rawBreakdown` 字段命名漂移（Turbopack 容忍 undefined access / webpack 严格 typecheck 报错）；（3）e2e spec `href!` 非空断言缺失（Turbopack 不报 / webpack 报 strict null check）；（4）测试 mock 同步 shape with 真实 type（mock 漂移在 Turbopack 静默，webpack typecheck 直接 fail）。**应用：** Next.js 升级 / Turbopack ↔ webpack 切换时必跑 `npx tsc --noEmit --strict` 全项目 typecheck + grep `Record<` 全 enum 用法 + grep `as any` / `!` non-null assertion 全审。

**建议写入：** `framework/harness/generator.md` 新段 §"Next.js / 构建器切换 hidden TS errors checklist" 或合并入上述 #4 (Turbopack 防御) 同段

---

## §3 BL-068 done 阶段 5 条 (用户 2026-05-17 ack)

### #9 MCP `get_log_detail` trace 抓 LLM 真实输出作为 LLM fix-round 标准动作

**类型：** 新坑 / 工具链

**内容：** **MCP `get_log_detail` trace 抓 LLM 实际输出**作为 LLM fix-round 标准动作。BL-068 fix-round 1+2 凭"LLM 幻觉新增 ID"推断 fix prompt（加约束 / 动态 N），收敛 drift 但仍不通过。fix-round 3 Generator 通过 MCP `get_log_detail trc_ew4fi0u4hihjdw07bu73xer3` 抓出 LLM **实际返回**：30 IDs 中**重复 1 个已有 id**（`8f93d2c0` 在 index 8 + 29），不是幻觉新 ID。真因 = dedupe 问题非 set-membership 问题，前两轮 fix prompt 都打错点。**规律：** LLM 类 fix-round 必先 MCP trace 抓真实输出 + 与预期 diff，不要凭"LLM 应该怎样"推断。aigcgateway dashboard `logs` API + `get_log_detail` 是关键工具链。**应用：** 每次 LLM-related fix-round 第一动作 = trace 5-10 个 failed call 找模式，不要直接改 prompt。

**建议写入：** `framework/harness/generator.md` 新段 §"LLM fix-round 必先 MCP trace 抓真因"（含 BL-068 fix-round 1+2 反面案例 + fix-round 3 trace 方法 + MCP get_log_detail 用法）

---

### #10 LLM 输出 noise 兼容 dedupe-then-validate 模式

**类型：** 新规律

**内容：** **LLM 输出 noise 兼容：dedupe-then-validate 模式**。LLM (如 Claude Haiku) 即使 prompt 严格约束仍会产生 noise（重复 ID / 顺序漂移 / 字段命名差异），server 端不应严格 reject 而应**先归一化再验证**。BL-068 fix-round 3 `refine-actions.ts` Layer 1 fix: LLM 输出 30 IDs 有 dup → **先 dedupe 保 first-occurrence 序** → 去重后 set == input set 即接受为 `refine_applied`（audit 加 `deduped_count` 监控 LLM noise rate）→ 仅当去重后仍偏离才落 `permutation_invalid`。**对比：** BL-067 F005 permutation 严格 reject 模式更保守，但 BL-068 dogfood 数据证明 35% LLM call 有 dup → 严格 reject 会让 fix-round +N 都解不掉，dedupe-then-validate 才能让 functionality 落地。**应用：** 所有 LLM 数组类输出（KOL IDs / category list / tag set）都应 dedupe-then-validate + audit log noise rate 监控；运营观察 noise rate > 50% 才考虑升级模型或重写 prompt。

**建议写入：** `framework/harness/ai-action-contract.md` 新段 §"LLM 输出 noise 兼容: dedupe-then-validate 模式"（含 BL-068 35% dedupe rate 实战数据 + audit `deduped_count` 字段模式 + 与严格 reject 对比表）

---

### #11 Prompt 自检 § + 末尾 reminder 双层强化模式

**类型：** 模板修订

**内容：** **Prompt 自检 § + 末尾 reminder 双层强化模式**。Claude Haiku 在 prompt 单点约束（如"不要重复 ID"）不够时（dup ID / format drift），加 §⚠️ **"输出前自检 3 项"块** + **末尾再加 1 段最后提醒**强化约束。BL-068 fix-round 3 prompt v3 (cmp9pak6g000dbno3canjkxxh) 加 self-check §（"输出前自检：ID 不重复 / 数量精确 / 全部来自 input pool"）+ 末尾 "记得：30 个不同 ID，无重复" 双层 → 配合 server dedupe 兜底，BL-068 24h dogfood 16/20 = 80% 达标。Self-check 内容显式引用 fix-round 3 真实 trace 加压（"你之前犯过这个错"），强化模型 attention。**应用：** prompt v3 模式适用 Claude Haiku / Sonnet 在 array-like / strict-schema 输出场景；GPT-4o 类模型可能不需要这么重的约束（待对比测试）。

**建议写入：** `framework/harness/ai-action-contract.md` 新段 §"Prompt 自检 § + 末尾 reminder 双层强化模式"（含 BL-068 prompt v1→v2→v3 演进案例 + self-check 模板 + 不同模型适用边界提示）

---

### #12 测试 mock infeasible 时的 dogfood 替代覆盖模式

**类型：** 新规律

**内容：** **server-action 类测试 mock infeasible → skip in CI + staging dogfood cover 模式**。BL-068 e2e refine-action 测试因 Next.js server action mock 在 vitest/playwright 环境不可行（需要真实 Next.js runtime + Redis + Postgres），强行 mock 会引入大量 fragility。Generator 用 `test.skip` 跳过 CI 中的 server-action 直接测试，转由 staging dogfood + audit_log 实测覆盖。这与 BL-067 §8 "24h soak 时间门槛留 dogfood 累积" 模式同源（CI 不可行 → 转 dogfood 实测）。**规律：** 测试 mock 复杂度 > 测试价值 时，标 `test.skip` + 在 spec acceptance 文档化"该路径由 staging dogfood + audit_log 实测覆盖" + dogfood checklist 包含此路径。**反例：** 不应该 `test.skip` 简化 CI 红 — 必须有 dogfood 替代覆盖才能 skip。

**建议写入：** `framework/harness/evaluator.md` 新段 §"测试 mock infeasible 时的 dogfood 替代覆盖模式"（含 BL-067 §8 + BL-068-F006 两个实战案例 + 适用判断 checklist）

---

### #13 verifying gate 失败时优先 trace 真因而非直接 ack fix（与 #9 配对方法论）

**类型：** 新规律 / 反面案例

**内容：** **fix-rounds 多轮 + 真因深挖代价**：表面 fix 不解决根本问题时 fix-rounds 会指数级增长。BL-068 案例：fix-round 1 修 B1-B4 client-side blockers 正常；fix-round 2 修 prompt 凭"LLM 幻觉新增 ID"假设（v1 prompt → v2 动态 N），收敛 drift 但 B6 仍不通过；fix-round 3 才通过 MCP trace 抓出 dup-not-hallucination 真因。**代价：** fix-round 2 工时浪费 (prompt v2 + 单测调整) + 用户体验延迟 1 天。**预防：** v0.9.22 候选 #9 (MCP trace 抓真因) 是这条规律的工具化版本。**Planner 反思：** verifying 阶段 Reviewer 报"prompt 解析失败"时，Planner 应裁决"先 trace 抓真实数据再 fix"而非直接 ack Generator prompt 调优 — 这是 verifying gate 设计的盲点（gate criterion 只看 success rate 不看 failure mode）。

**建议写入：** `framework/harness/planner.md` 新段 §"verifying gate 失败时优先 trace 真因而非直接 ack fix" + 合并入 #9 (MCP trace) 形成 LLM fix-round 完整方法论

---

## §4 framework/harness/* 沉淀状态

| 文件 | 待写入段 | 状态 |
|---|---|---|
| ai-action-contract.md | #6 SDK 抽象层 / #10 dedupe-then-validate / #11 prompt 自检 § | ⏸️ 留独立 framework batch / 与 v0.9.23 合并沉淀 |
| deploy-patterns.md | #4 Turbopack BUILD_ID bug + --webpack | ⏸️ 同上 |
| generator.md | #3 audit 起草前实测 / #5 InMemoryJobQueue MVP / #8 webpack typecheck checklist / #9 MCP trace | ⏸️ 同上 |
| evaluator.md | #2 量化 criterion 语义 / #12 mock infeasible dogfood 替代 | ⏸️ 同上 |
| pre-impl-adjudication.md | #1 多 audit 串联 / #7 Generator 建议命中率 | ⏸️ 同上 |
| planner.md | #13 verifying gate 失败优先 trace | ⏸️ 同上 |
| **CHANGELOG.md** | v0.9.22 段含 13 条 1-line summary + cross-reference | ✅ 已写 (本沉淀 commit) |
| **proposed-learnings.md** | 清空 13 条 + 加 v0.9.22 历史 marker | ✅ 已清 (本沉淀 commit) |
| **archive/proposed-learnings-archive-v0.9.22.md** | 13 条全文归档 | ✅ 本文件 (本沉淀 commit) |

**沉淀模式选择理由：** 13 条候选完整保留在本归档 + CHANGELOG cross-reference 各文件待写入段；framework/harness/* 实际段落起草（估 600-1000 LOC docs）留独立 framework batch（或合并 v0.9.23）一并沉淀，避免本 commit 范围过大冲淡 BL-069 启动节奏。**12 段待写入段位置已记录** — 下个沉淀 batch Generator/Planner 按本归档 §1-§3 逐条对应 framework/harness/* 文件 append 即可。

---

## References

- `framework/CHANGELOG.md` v0.9.22 段（cross-reference 各待写入文件）
- `framework/proposed-learnings.md` v0.9.22 历史 marker（清空标记）
- BL-066 done commit `46e803a`（3 条来源）
- BL-067 done commit `472f650`（5 条来源）
- BL-068 done commit `a204556`（5 条来源 + 沉淀 marker）
- BL-066/BL-067/BL-068 各 audit doc + signoff doc（详细实战案例）

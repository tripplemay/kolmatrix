# Framework 提案暂存区

> Generator 和 Evaluator 在工作中发现值得沉淀的经验时，追加到本文件。
> Planner 在 done 阶段读取本文件，逐条提交给用户确认。
> 确认后由 Planner 正式写入 `framework/` 对应文件，并在 `CHANGELOG.md` 追加记录，最后从本文件移除已确认条目。
> 已闭环条目归档到 `framework/archive/proposed-learnings-archive-vX.Y.md`。

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

---

<!-- 新条目从这里开始追加 -->

## [2026-05-15] Claude CLI — 来源：BL-066 done 阶段收尾 / Planner johnsong

**类型：** 模板修订

**内容：** 连续 3 次 pre-impl audit + Planner 裁决模式（F002 / F006 / F007 共 18 决议点 lock）→ 9 features + 0 fix-round 一次性成型（fix_rounds=0），验证 v0.9.21 pre-impl-adjudication 模式 ROI。批次级"3 audit 串联"是新粒度（以往多为单 feature 一 audit），值得作为大批次（≥ 9 features）的推荐节奏沉淀。

**建议写入：** `framework/harness/pre-impl-adjudication.md` 新段 §"批次级多 audit 串联模式"（具体规模门槛 + 适用判断 + 与 fix-rounds 关系实证）

**状态：** 用户 2026-05-15 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-15] Claude CLI — 来源：BL-066 F007 §7 量化验证补充裁决 / Planner johnsong

**类型：** 新规律 / 新坑

**内容：** verifying gate 量化 criterion 设计应锚定**语义信号**而非**字面数字**。BL-066 F007 staging recompute 后字面 criterion (b)「top-15 内 max-min ≥ 5」失败（top-15 全 clamp 100），但语义 BL-048 fix（mega-nano 不再同 100）已达成；用户 ack 选项 (i) data-driven 修订 criterion 为 (a') 全 dataset spread + (b') top-15 最小 follower threshold，而非调 formula。Evaluator 起草 criterion 时如不预判 dataset 真实形态会落入字面陷阱。

**建议写入：** `framework/harness/evaluator.md` 新段 §"量化 verifying gate criterion 设计"（含字面陷阱反面案例 + data-form-aware 设计 checklist）

**状态：** 用户 2026-05-15 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-15] Claude CLI — 来源：BL-066 F006 audit 裁决 / Planner johnsong（v0.9.22 候选）

**类型：** 新规律

**内容：** Generator 在 pre-impl audit 起草前必须**实测原子组件实际 surface**，而非按 README / 类型签名"字面想象"。BL-066 F006 案例：Table.tsx README 看似有 col cap 限制，Generator audit 建议保守拆列，但 Planner 实测 Table.tsx fully flexible 无 col cap，最终裁决 #4=A（6 列方案）偏离 Generator 建议。此案例说明 audit 输入若基于"文档/类型签名想象"会产生系统性保守偏差，Planner 反复实测纠偏成本高。

**建议写入：** `framework/harness/generator.md` 新段 §"audit 起草前的实测节奏"（含 BL-066 F006 反面案例 + 实测优先级 checklist：原子组件 / 路径配置 / SQL 实际行为 / API response shape）

**状态：** 用户 2026-05-15 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-16] Claude CLI — 来源：BL-067 fix-round 1 / Generator + Planner johnsong

**类型：** 新坑 / 模板修订

**内容：** Next.js 16.2.x 默认 `next build` 走 Turbopack → 生产构建**不写 `.next/BUILD_ID` 文件**（仅在 `.next/static/<hash>/` 子目录名编码 BUILD_ID）。但 `server.js` 用 `next({ dev: false })` + `app.prepare()` 启动时**仍走旧 webpack 路径**读 `.next/BUILD_ID` 文本 → 抛 `production-start-no-build-id` → 进程启动失败 → PM2 fallback 旧 worker → 旧 worker 内存 build manifest 不含新 chunks → per-chunk 404 ErrorBoundary。**防御：** 全栈 force `next build --webpack` flag（`package.json` + `scripts/deploy-staging.sh` + `scripts/deploy-prod.sh`）+ 同 commit 加 `rm -rf .next/build .next/turbopack .next/static/[A-Za-z0-9]*` 清旧 Turbopack 残留（不动 `.next/cache` 保 build 加速）。BL-067 fix-round 1 commit f284d35 实战验证。**附加：** webpack 严格 typecheck 比 Turbopack 严，迁移时常暴露 hidden TS errors（commit 6dbe231 修 4 处 Record exhaustive / undefined access / mock shape）— 未来 Next.js 升级 checklist 必加项。

**建议写入：** `framework/harness/deploy-patterns.md` 新段 §"Next.js 16.x Turbopack 生产 build 兼容性陷阱 + --webpack 防御" + `framework/templates/` 加 build artifact 健康检查脚本（缺 `.next/BUILD_ID` 或 `.next/required-server-files.json` 即异常）

**状态：** 用户 2026-05-16 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-16] Claude CLI — 来源：BL-067 F005 + audit §4:B / Generator + Planner johnsong

**类型：** 新规律

**内容：** **InMemoryJobQueue + delay:1 fire-and-forget + mount self-heal 模式**作为 BullMQ 的 MVP 前置方案，适用于 PM2 single-instance cluster=1 架构。模式核心：（1）server action `void jobQueue.add(name, payload, { idempotencyKey, delay: 1 })` 让 LLM 异步跑入下一 tick，server action 立即 return 不阻塞 mount；（2）进程重启丢 prewarm 由用户重 enter 页面触发 mount self-heal 自然恢复；（3）idempotencyKey 同进程内幂等防重；（4）worker concurrency 由 setTimeout 隐式 1（不并发）。**升 BullMQ 的触发条件：** dogfood 期发现 (a) PM2 reload 频次 > 2 次/day 或 (b) scale-out 到 cluster>1 或 (c) job 处理时间 > 60s 致 mount→short 完成延迟感知。**反面：** 不适用于"必须可靠交付"类 job（如付款回调）。

**建议写入：** `framework/harness/generator.md` 新段 §"InMemoryJobQueue MVP vs BullMQ 升级判断"（含触发条件 + BL-067 F005 实战案例 + spec acceptance 措辞模板）

**状态：** 用户 2026-05-16 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-16] Claude CLI — 来源：BL-067 F001 + audit §6:A / Generator + Planner johnsong

**类型：** 模板修订

**内容：** **aigcgateway action caller SDK 抽象层沉淀模式**。当 codebase 出现 N 处 inline POST `/actions/run` + `parseFencedJson` + cost-cap + audit + error mapping 重复（BL-067 起前已有 customize.ts + topic-cloud.ts 两份，BL-067 即将再加 2 处，BL-068 还会加 1 处）→ 抽统一 `runAigcAction<T>(opts)` SDK。**触发门槛：** ≥3 处 inline 重复 + 即将出现第 4 处 → 沉淀 SDK 抽象层（早于此门槛沉淀属过早抽象 / 晚于此门槛沉淀属维护噩梦）。BL-067 F001 +2h 落 `src/lib/aigc/run-action.ts` SDK 242 LOC + 9 unit tests，BL-067 F004 + F005 两 caller 直接复用，BL-068 + 未来 LLM caller 沿用。**约束：** 抽 SDK 时不动现有 caller 保向后兼容，迁移留下个批次评估（避免 scope creep）。

**建议写入：** `framework/harness/ai-action-contract.md` 新段 §"aigcgateway caller SDK 抽象层沉淀触发门槛"（含 ≥3 inline + 即将第 4 处规则 + BL-067 F001 实战案例 + runAigcAction<T> 签名模板）

**状态：** 用户 2026-05-16 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-16] Claude CLI — 来源：BL-067 F001 audit + Planner 裁决 / Planner johnsong

**类型：** 新规律

**内容：** **pre-impl-adjudication 模式 Generator 建议命中率作为 audit 质量信号**。BL-067 F001 audit 6 议题 Planner 100% ack Generator 默认建议（#1:A/#2:A/#3:A/#4:B/#5:A/#6:A），BL-066 F002 audit 命中率 4/5（#5 偏离），BL-066 F006 audit 命中率 4/5（#4 偏离），BL-066 F007 audit 命中率 7/8（#7 重裁决）。**规律：** Generator 建议命中率 ≥80% 时 Planner 裁决可降复杂度（直接 ack + 短理由）；< 80% 时 Planner 需深挖偏离项（如 BL-066 F006 #4 是因 Generator 未实测 Table.tsx surface 字面，Planner 实测纠偏，沉淀为 BL-066 v0.9.22 候选 #4 "audit 起草前实测原子组件"）。**应用：** 4 次 audit 累积统计可作 Generator audit 质量指标 — 命中率持续 < 70% 警示 Generator audit 起草纪律有偏差，需起 framework 修订。

**建议写入：** `framework/harness/pre-impl-adjudication.md` 新段 §"Generator 建议命中率作为 audit 质量信号"（含 BL-066 + BL-067 4 次 audit 累积数据 + 命中率分布 + Planner 裁决复杂度调整规则）

**状态：** 用户 2026-05-16 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-16] Claude CLI — 来源：BL-067 fix-round 1 commit 6dbe231 / Generator johnsong

**类型：** 新坑

**内容：** **Next.js 16 webpack 严格 typecheck 暴露 4 处 hidden TS errors**（BL-067 fix-round 1 commit 6dbe231 修复）：（1）`schemas.ts` `Record<AssetType, ...>` 加新 enum 值后必须补 entry（webpack exhaustive check 强制 / Turbopack 宽松不报）；（2）worker + server actions 中 `valueScoreBreakdown.breakdown` → `valueScoreBreakdown.rawBreakdown` 字段命名漂移（Turbopack 容忍 undefined access / webpack 严格 typecheck 报错）；（3）e2e spec `href!` 非空断言缺失（Turbopack 不报 / webpack 报 strict null check）；（4）测试 mock 同步 shape with 真实 type（mock 漂移在 Turbopack 静默，webpack typecheck 直接 fail）。**应用：** Next.js 升级 / Turbopack ↔ webpack 切换时必跑 `npx tsc --noEmit --strict` 全项目 typecheck + grep `Record<` 全 enum 用法 + grep `as any` / `!` non-null assertion 全审。

**建议写入：** `framework/harness/generator.md` 新段 §"Next.js / 构建器切换 hidden TS errors checklist" 或合并入上述 #4 (Turbopack 防御) 同段

**状态：** 用户 2026-05-16 已 ack — 待 BL-068 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档


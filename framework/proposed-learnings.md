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

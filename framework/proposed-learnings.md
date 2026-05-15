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

**状态：** 用户 2026-05-15 已 ack — 待 BL-067 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-15] Claude CLI — 来源：BL-066 F007 §7 量化验证补充裁决 / Planner johnsong

**类型：** 新规律 / 新坑

**内容：** verifying gate 量化 criterion 设计应锚定**语义信号**而非**字面数字**。BL-066 F007 staging recompute 后字面 criterion (b)「top-15 内 max-min ≥ 5」失败（top-15 全 clamp 100），但语义 BL-048 fix（mega-nano 不再同 100）已达成；用户 ack 选项 (i) data-driven 修订 criterion 为 (a') 全 dataset spread + (b') top-15 最小 follower threshold，而非调 formula。Evaluator 起草 criterion 时如不预判 dataset 真实形态会落入字面陷阱。

**建议写入：** `framework/harness/evaluator.md` 新段 §"量化 verifying gate criterion 设计"（含字面陷阱反面案例 + data-form-aware 设计 checklist）

**状态：** 用户 2026-05-15 已 ack — 待 BL-067 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档

---

## [2026-05-15] Claude CLI — 来源：BL-066 F006 audit 裁决 / Planner johnsong（v0.9.22 候选）

**类型：** 新规律

**内容：** Generator 在 pre-impl audit 起草前必须**实测原子组件实际 surface**，而非按 README / 类型签名"字面想象"。BL-066 F006 案例：Table.tsx README 看似有 col cap 限制，Generator audit 建议保守拆列，但 Planner 实测 Table.tsx fully flexible 无 col cap，最终裁决 #4=A（6 列方案）偏离 Generator 建议。此案例说明 audit 输入若基于"文档/类型签名想象"会产生系统性保守偏差，Planner 反复实测纠偏成本高。

**建议写入：** `framework/harness/generator.md` 新段 §"audit 起草前的实测节奏"（含 BL-066 F006 反面案例 + 实测优先级 checklist：原子组件 / 路径配置 / SQL 实际行为 / API response shape）

**状态：** 用户 2026-05-15 已 ack — 待 BL-067 done 阶段或专门 framework 沉淀 batch 时正式写入 framework/ + CHANGELOG + 归档


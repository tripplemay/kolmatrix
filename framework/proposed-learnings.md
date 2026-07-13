# Framework 提案暂存区

> Generator 和 Evaluator 在工作中发现值得沉淀的经验时，追加到本文件。
> Planner 在 done 阶段读取本文件，逐条提交给用户确认。
> 确认后由 Planner 正式写入 `framework/` 对应文件，并在 `CHANGELOG.md` 追加记录，最后从本文件移除已确认条目。
> 已闭环条目归档到 `framework/archive/proposed-learnings-archive-vX.Y.md`。

---

## 写入流程（D7 + D8 lock，BL-071 F007）

sediment（沉淀）从 proposed-learnings.md 走向 `framework/harness/*.md`（角色/协议）与 `framework/patterns/*.md`（技术域）的标准路径。本节是 D8 lock 把"散落在多个角色文件 + 经验记忆"的沉淀工作流统一到 proposed-learnings.md header 一处的产物。

### 4 步流程

| 步 | 谁做 | 何时 | 产物 |
|---|---|---|---|
| **1. propose** | Generator / Evaluator | 批次 building / verifying / fixing / reverifying 任意阶段发现 | 追加 entry 到 `framework/proposed-learnings.md` 末尾新条目区（见下方 `<!-- 新条目从这里开始追加 -->` 标记），格式见下 |
| **2. 用户 ack** | 用户 | done 阶段 Planner 逐条提交时 / 即时对话中 | 用户回复"ack"或等同措辞；含修订意见时 entry 文字按意见修订后再 ack |
| **3. inline-merge** | Planner | done 阶段（或独立 framework sediment batch） | 按 D7 inline-merge 规则写入 `framework/harness/*.md` / `framework/patterns/*.md` 对应 topic 段（不是 chronological-append §N，详见下文） |
| **4. archive** | Planner | inline-merge 完成同 commit | 归档 entry 全文到 `framework/archive/proposed-learnings-archive-vX.Y.Z.md` + 加 `<!-- vX.Y.Z 沉淀完成 -->` HTML 注释到本文件 header markers 块 + 从新条目区移除原 entry + `framework/CHANGELOG.md` 顶部新增 vX.Y.Z 段 1-line summary |

### D7 inline-merge 强制规则（禁 chronological-append §N）

**核心：** 新 sediment 必须找贴近的 topic 段合并，**不得**通过追加 `§N` chronological 段落落地。

**inline-merge 优先级（从高到低尝试）：**

1. **合并矩阵行：** 目标文件已有矩阵/表格（如 planner.md 铁律 1 矩阵 / generator.md 测试边界矩阵）→ 新规律若属同一维度，直接加新行
2. **加子段：** topic 段已存在但新内容是该 topic 的延伸 / 反例 / 实战 → 加子段 §X.Y（如 patterns/deploy-patterns.md §3.2 加 §3.2.1 staging deploy 前置 git pull）
3. **修订段内文字：** 新内容是对已有规则的细化 / 边界澄清 → 直接修订段内某段文字（如 patterns/testing-env-patterns.md fire-and-forget 段加一句"或 vi.waitFor 50-100ms retry"）
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
## [YYYY-MM-DD] {Claude CLI / Evaluator / Generator agent-id} — 来源：{触发场景简述：批次 ID + feature ID + fix-round 编号 / audit 名}

**类型：** 新规律 / 新坑 / 模板修订 / 铁律补充

**内容：** [一句话总结 → 多段详述 → 含具体 commit hash / file:line / 反例 case]

**建议写入：** `framework/harness/{file}.md` 或 `framework/patterns/{file}.md` §{具体段名 or 矩阵行编号} / 配套 cross-ref / 同主题合并提示

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

<!-- KOLMatrix 沉淀链 v0.9.21→v0.9.25（fork-merge 携入，来源 joyce v0.9.25；条目全文归档于 framework/archive/proposed-learnings-archive-v0.9.2X.md）。 -->

<!-- 2026-05-14: v0.9.21 沉淀完成（4 条 learnings 来源 BL-064 fix-round 3 + BL-065-R1 + BL-065-F006 + BL-065-F007 fix-rounds=1），全部已写入：planner.md 铁律 1 矩阵 +1 行（v0.9.21 i18n template 路由迁移）+ §fix-rounds 数解读；generator.md §9 IA refactor redirect scope + §10 大型删除批次执行模板；evaluator.md §20 L1+角色门禁手动探针；同步 .auto-memory/role-context/{generator,planner,evaluator}.md 短摘要 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.21.md。 -->

<!-- 2026-05-17: v0.9.22 沉淀完成（13 条 learnings 来源 BL-066 done 3 条 + BL-067 done 5 条 + BL-068 done 5 条），中等深度沉淀模式：archive 完整 13 条全文 + CHANGELOG 完整 13 条 1-line summary + cross-reference 待写入文件；framework/harness/*.md 实际段落起草（估 12 段 × 30-80 行）**留独立 framework batch 或合并 v0.9.23 一并沉淀**，避免 v0.9.22 commit 范围过大冲淡 BL-069 节奏。归档：framework/archive/proposed-learnings-archive-v0.9.22.md。待写入位置详见归档 §4 / CHANGELOG v0.9.22 段表。 -->

<!-- 2026-05-25: v0.9.23 沉淀完成（31 条 = v0.9.22 13 + BL-069 3 + BL-070 12 + audit §5 缺失 3）—— BL-071 F008 按新结构 inline-merge 全部写入 framework/harness/*.md：ai-action-contract.md 3 段（§3.4 dedupe-then-validate + §3.5 prompt 自检 § + §5 SDK 抽象层）/ generator.md 13 段（§10D IaRedirectRule mixed-status + §11 F-I 4 子段 UUID guard/notFound HTTP/i18n ns caller/lazy fidelity + §12 audit工具链 3 段 + §13 InMemoryJobQueue + §14 编译时约束 2 段 + §15 perf 2 段含 #29+#30 合并）/ evaluator.md 3 段（§13.1 量化 criterion + §13.2 mock 不可用三件套 #12+#21 合并 + §13.3 staging chaos flag）/ pre-impl-adjudication.md 2 段（§6.4 建议命中率 + §11 多 audit 串联）/ deploy-patterns.md 3 段（§4.1 扩展 bot commit + §3.2 git pull inline + §7 Turbopack BUILD_ID）/ planner-workflow + arbitration + checklists 5 段（§P5.3 verifying trace + fix-round 类型 + session_notes + commit message + perf #25+#26 合并）。归档：framework/archive/proposed-learnings-archive-v0.9.23.md（F009 创建）。 -->

<!-- 2026-05-27: v0.9.24 沉淀完成（17 条 sediment 来源 BL-072 done 4 + BL-073 done 5 + BL-075 done 4 + BL-076 done 4），全部已写入 framework/harness/*.md（5 同主题合并 + 13 实际段：ai-action-contract.md §6 AI 经济与速率防御 #11+#12 / generator.md §11 J 删 X grep 矩阵 #4 + §14.3 Schema rollback cross-ref #16 + §16 batch try/catch #15 + §17 adapter check #17 / evaluator.md §13.4 advisory test 三件套 #3+#7+#9 / deploy-patterns.md §1.6.1 SSH env var pm2 #10 + §8 log-based alerting #8+#14 / planner-checklists.md §IA outbound 扫描 #1 + §嵌套 grep #6 / database-patterns.md §4.6 platform_admin RLS #13 + §9 Schema rollback #16 主写 / checklists/material-symbols-pattern.md §Pattern v1→v2→v3 #2+#5）。归档：framework/archive/proposed-learnings-archive-v0.9.24.md。BL-077 sediment batch implementing。 -->

<!-- 2026-05-27: v0.9.25 沉淀完成（5 条 sediment 来源 BL-078 done），全部已写入 framework/harness/*.md（1 同主题合并 #1+#5 motion a11y 三件套 + 4 实际段：evaluator.md §11.6 motion a11y 三件套 #1+#5 / ui-fidelity-guardrail.md §3.4 landing visual token layer 规范 #2 / generator.md §18 现代 CSS 渐进增强 #3 / planner-checklists.md §"Visual polish reference URL 提炼方法论" #4）。归档：framework/archive/proposed-learnings-archive-v0.9.25.md。 -->

<!-- 2026-07-09: v1.0.0 沉淀完成（1 条 learning 来源 BL-064 IA refactor redirect scope），写入 memory/role-context/generator.md §"IA refactor redirect scope 评估" + memory/role-context/planner.md §"IA refactor 类批次 redirect 清单评估" + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v1.0.md。 -->

<!-- 2026-07-13: v0.9.26-kolmatrix fork-merge 清理（D7 步骤 4）—— joyce v0.9.26 新条目区遗留的 11 条「已 ack 但未清理」KOLMatrix provenance 条目（BL-083 / BL-084 / BL-086-F003 / BL-086 路径B / prod-outage 2026-06-07 / BL-097 / BL-080-F003 / BL-108×2 水合 / BL-100 BullMQ / BL-105）已从新条目区移出、全文归档到 framework/archive/proposed-learnings-archive-v0.9.26-kolmatrix.md。其知识已在 joyce v1.0.3 patterns/*.md（web-runtime / deploy / database / ai-action-contract）+ evaluator.md 重植；本档仅存 BL-id → 落地位置的审计轨迹。 -->

---

## [2026-07-12] Claude（harness-fit 分析 · 独立任务）— 来源：单工具 Claude + dynamic Workflow 工作流契合度评估（本会话 workflow wt27gd5xu，三视角 + 红队对抗复核）

**背景：** 用户已把主 coding 工作流收敛到单工具（仅 Claude Code），编码阶段用 Claude dynamic Workflow 编排。评估结论：harness 高契合且真提质，但价值不对称——**契约纪律 + 持久骨架**是纯增量（引擎给不了），**阶段内部编排**与引擎重叠、**多工具/多机底座**大部分是死重。以下提案已经过红队校准（推翻了"状态机=冗余仪式""慢车道=死重""Workflow 1:1 替代无自评"三个过度自信结论）。

---

### P0 —— 正确性前置（naive 上 Workflow 会踩的坑）

**P0-1 · 类型：新坑 / 铁律补充**
- **内容：** Claude Workflow 的 loop-until-done 天生会自主推进到"完成"并自排下一步，直接违反 `orchestration-patterns.md` §6 硬铁律「→verifying / →done 不得在无人值守循环中自动完成」。把阶段内部交给 Workflow 时，若不定契约就是**正确性回归**，不只是重复仪式。
- **建议写入：** `harness/orchestration-patterns.md` 新增「§8 Workflow run ⇄ progress.json 日志契约」小节（引擎只跑阶段内部、绝不 flip status 跨阶段；每步结果落盘持久文件；中途崩溃逐条对账）+ `harness-rules.md` 铁律区补一条呼应。
- **状态：** 部分落地 —— §8 已写入 `orchestration-patterns.md`（CHANGELOG v1.0.2）；剩余待确认：`harness-rules.md` 铁律区呼应条。

**P0-2 · 类型：新坑（最高风险）**
- **内容：** 沉淀闭环是事故驱动的，靠每批次一份 Evaluator 验收记录喂养。in-tool Workflow 若只在 context 里验完、不落"命名验收工件（BL-id + verdict + fix_round）"，`proposed-learnings.md` 会因**无 emitter 而静默饿死**（本文件现已显示"当前无待确认提案"即征兆）。这是模块级、产品级的静默失败——维护闭环本身就是本框架的产品。
- **建议写入：** `harness/orchestration-patterns.md` §4 + §8 + `templates/claude/skills/verify/SKILL.md`（verify 每轮必须持久化命名验收工件回喂沉淀，不可省）。
- **状态：** 部分落地 —— §8 契约 4 已写入 `orchestration-patterns.md`（CHANGELOG v1.0.2）；剩余待确认：verify SKILL.md 改写（Patch B，未落）。

**P0-3 · 类型：模板修订**
- **内容：** `/verify` step 3、`/build` step 5 把 fan-out/并行以**散文指针**（"按 §4 / §3"）交付，未真正 invoke Workflow——按框架自己"装进工具链才是强制"的标准，这层仍停在"写在文件里"。注意：fan-out 是**尾部场景**（触发门 ≥4 features），日常默认=单个隔离 evaluator subagent 本就 native，**不要把机制化 fan-out 当最高优先级**（红队降级）。
- **建议写入：** `templates/claude/skills/verify/SKILL.md` step 3 / `templates/claude/skills/build/SKILL.md` step 5 改为触发门命中时真正调 Workflow，并显式"停在阶段边界交还用户"。
- **状态：** 待确认

### P1 —— 结构精简 + 定位重申

**P1-1 · 类型：新规律（红队纠正，勿一刀切）**
- **内容：** 慢车道拆分：git **同步总线**语义单机确为死重，但两样单机也真实的能力搭在同一标签上不可一起砍——① **独立会话 evaluator** 是比 subagent **更强**的独立性（无编排者写的 prompt，免疫铁律 12 的作者污染风险）；② **跨会话/抗压缩交接**（多日批次 + 压缩会在同一会话内重现"新读者"问题）。
- **建议写入：** `docs/01-concepts.md` 慢车道段 + `harness/orchestration-patterns.md` §7（区分"同步总线"与"独立会话隔离 / 跨会话持久"两类，前者可选、后者保留）。
- **状态：** 待确认

**P1-2 · 类型：模板修订**
- **内容：** 快车道热路径剥离慢车道底座：`/plan /build /verify` step 1 的 `git pull --ff-only` + `.agent-id`/`.agents-registry` 读、`session-start.sh` 的 `role_assignments` 注入、`bootstrap.sh:71` 无条件铺 `AGENTS.md`——单机全是空转仪式，改为多机模式 opt-in。
- **建议写入：** 三个 skill SKILL.md step 1 + `templates/claude/hooks/session-start.sh` + `bootstrap.sh`。
- **状态：** 待确认

**P1-3 · 类型：新规律（定位重申）**
- **内容：** 把 harness 明确定位为坐在 Workflow 引擎之上的**薄契约纪律 + 持久骨架层**：引擎给编排**形状**，harness 给**常设默认强制 + 约束载荷（受限工具集 / 只认实物 / 误报预检 / 测试设计权）+ 用户闸门 + 抗压缩骨架**——这四样引擎都没有。
- **建议写入：** 新增 `harness/workflow-bridge.md`（角色 ⇄ Workflow stage 映射；标注哪些规则由引擎结构性强制、哪些仍是散文护栏）。
- **状态：** 待确认

### P2 —— 清理与补缺（须外科式，勿误伤承重项）

**P2-1 · 类型：铁律澄清（红队纠正）**
- **内容：** 机制化其实比宣传的薄：唯一硬阻断是 `validate-state-json.sh`（还只查 JSON **语法**，不查"status=done 但 signoff 为空"这种语义）；无自评 / done-门 / 裁决不洗白 / spec 源码核查**都活在散文里**。推论："砍散文仪式"必须外科式，勿把承重约定当仪式误删。
- **建议写入：** `harness-rules.md` §机制化守门（标注"当前硬阻断仅覆盖 JSON 语法，语义门仍靠约定"）。
- **状态：** 待确认

**P2-2 · 类型：新坑**
- **内容：** `executor:generator|evaluator` 是**活的路由位**（把报告类任务路进 verifying、选 Evaluator-only 批次流），与已死的 `executor:"codex"` 别名同段落；清 Codex 血缘时须**外科分离**，勿连带误删路由。
- **建议写入：** `harness-rules.md` lines 47/108 + `evaluator.md` + `planner.md` 相关行的清理注意事项。
- **状态：** 待确认

**P2-3 · 类型：新坑**
- **内容：** 对抗复核的误报目录（`patterns/testing-env-patterns.md`）是 **stack-coupled**（Prisma/Next/Postgres-RLS），换技术栈大半不可移植，且框架无"给新栈重播种目录"的机制。
- **建议写入：** `patterns/testing-env-patterns.md` 顶部标注适用栈 + 提供"新栈重播种"指引。
- **状态：** 待确认

**P2-4 · 类型：模板修订（与上一轮接入缺口同源）**
- **内容：** 补存量项目接入路径：`bootstrap.sh` 遇 `harness-rules.md` 存在即 abort（仅 greenfield）；加 `--adopt` 模式只装 `.claude/` 机制层（hooks + evaluator subagent + skills + progress.json），跳过 memory/spec 脚手架。
- **建议写入：** `bootstrap.sh` + `docs/03-quickstart.md` 补一节「已有项目接入」。
- **状态：** 待确认

**P2-5 · 类型：铁律澄清**
- **内容：** commit 粒度：per-feature commit 的**跨设备恢复**理由单机已失效，仅**抗压缩**承重（写状态文件即可恢复，逐 feature 打 git commit 是额外审计/回滚开销）；可放宽为 per-phase-boundary commit（保留状态文件写入 + JSON hook）。
- **建议写入：** `harness-rules.md` 铁律 2/3 理由重述（"跨设备恢复 + 抗压缩" → "抗压缩持久 + 审计轨迹"）。
- **状态：** 待确认

<!-- 2026-07-13: 自主开发模式 + 进度看板 沉淀完成（用户确认，默认安装）。
     自主：机件转正入 templates/claude/{agents/{generator-restricted,spec-lock-critic}.md, skills/autodrive/, autonomous/*}；harness/autonomous-mode.md 转正为 T2 规范。
     看板：templates/dashboard.template.html + templates/claude/skills/dashboard/SKILL.md + progress.init.json(dashboard_url) + bootstrap chmod + harness-rules §四 + templates/CLAUDE.md。
     CHANGELOG v1.0.3。归档：archive/proposed-learnings-archive-v1.0.3.md。
     注：harness-fit 分析（P0-P2）不在本次确认范围，仍保留待确认。 -->

---

<!-- KOLMatrix 待确认条目（fork-merge 携入，来源 joyce v0.9.26 新条目区；与上方 harness-fit P0-P2 结构性 backlog 并存，均为待确认）。路径已按 v1.0.3 布局（framework/patterns/*.md）更新，条目内容保持原文。 -->

## [2026-06-13] Claude CLI — 来源：BL-114 落地页视觉重做（F001/F004）

**类型：** 新坑 / 铁律补充

**内容：** 视觉重做类批次踩的两个非显性坑，建议沉淀进 `patterns/web-runtime-patterns.md`：
1. **改全局 Tailwind `@theme` font/color token 前必须先 grep app 端用量。** BL-114-F001 为 landing 接 JetBrains Mono 时直接覆写全局 `--font-mono`，误改了 app 端 `font-mono`（reach 模板编辑器/kolId chip 等 7 处），CI 实测 `en-reach-templates.png` 视觉回归。修法：landing 专用 token（`--font-landing-mono` → `font-landing-mono` utility），不动全局。规律：globals.css `@theme` 里的 token 是全仓共享，landing 专属视觉应走 landing 前缀 token/utility，改既有全局 token 前 `grep -rn "font-mono\|<token>" src/app/.../(app)` 评估爆炸半径。
2. **visual baseline 重拍走 `update-visual-baselines.yml` workflow，且 bot-commit 不级联 CI 须手动触发。** macOS/WSL 本机无法生成 Linux-canonical 基线；sanctioned 路径是 `gh workflow run update-visual-baselines.yml`（Linux runner `--update-snapshots` + 自动 bot-commit 只改变更的 `*.png`）。关键：bot-commit 用默认 `GITHUB_TOKEN` **不会级联触发 ci.yml**（GitHub 防递归），必须 `gh workflow run ci.yml --ref main` 手动触发那一次校验 run 才能确认 E2E 视觉对齐新基线。视觉重做批次 F001-F03 期间 landing-*.png 基线红是预期，到 cleanup 批次（本批 F004）末尾一次性重拍。

**建议写入：** `framework/patterns/web-runtime-patterns.md`（visual 段）或新 §"视觉重做批次"：1=全局 token 爆炸半径自检；2=baseline 重拍 workflow + bot-commit 手动触发 ci 流程（与 `framework/patterns/deploy-patterns.md` bot commit cascade 节交叉引用）。

**状态：** 待确认

---

## [2026-06-21] Claude CLI — 来源：BL-117 staging 部署撑垮共享 prod VM 事故

**类型：** 新坑 / 铁律补充（ops 安全）

**内容：** 一次 staging 重部署的 `npm run build` 把**共享 8GB VM**（prod + staging 同机 `34.180.93.185`）的内存/swap 撑爆，导致 sshd（banner exchange 超时）+ nginx（443 超时）~50 分钟无响应，**prod `kol.guangai.ai` 一并短时不可用**。诊断特征：`ping` 通 + TCP 22/443 能 connect，但用户态服务不响应 = 资源饥饿（非网络断、非整机崩）。三个叠加放大因素 + 三个非显性坑：
1. **staging build 在共享 prod VM 上会拖垮 prod。** `environment.md` 已记 staging build 需 `NODE_OPTIONS=4096`（默认 1.6G build OOM），但 4G heap + prod 常驻在 8G 机上仍可能 swap thrash。缓解：build 前 `pkill -f "next build"` 防孤儿；**deploy 期间绝不并发开多个 SSH 探测**（会加剧负载、撞 sshd MaxStartups）；考虑错峰/限并发/独立 build host。
2. **`TaskStop`/杀本地后台 ssh ≠ 杀远端进程。** 本地 ssh 客户端被杀后，远端 `next build` 常成**孤儿**继续吃内存，VM 不自愈。需 SSH 进去 `pkill` 或 reboot 才能清。
3. **本机无 `gcloud` + SSH 死 = 无法自助 reboot GCP VM。** 只能靠用户 GCP console reset。建议：本机/CI 备一份 gcloud（或 SA 凭据）以便 VM 故障时 `gcloud compute instances reset` 自助恢复。
- **恢复后善后：** 中断的 build 留下不完整 `.next` → staging pm2 crash-loop（restart_time 飙高 / status=launching / 0b mem）；修复 = `pm2 delete` + `rm -rf .next` + 干净重 build（确认 `free -m` 有余量再 build）。

**建议写入：** `framework/patterns/deploy-patterns.md`（新增「staging build 不得撑垮共享 prod VM」§：防孤儿 + 禁并发探测 + 错峰 + gcloud 备用 + 中断后 .next 清理 crash-loop 修复）。

**状态：** 待确认

---

## [2026-07-13] Claude CLI (Kimi) — 来源：BL-PROD-MIGRATE-DEPLOYSVR F-MIG-04 P3 生产割接停机超预估

**类型：** 新坑（迁移 ops）+ runbook 修订

**内容：** F-MIG-04 P3 数据终态同步阶段，实际停机 ~32-37min，**远超预估**（原估割接窗口 <2min，依据是旧库仅 432MB）。根因：终态 `pg_dump kolmatrix`（停旧写后）走了「旧机 → 本机 Mac → deploysvr」的管道中转（本机做 dump-source 与 restore-target 的桥），**受本机上行带宽瓶颈**拖慢，而非 DB 体积。教训：跨机数据迁移的终态同步，dump/restore 应**两台服务器直连**（deploysvr 直接 `pg_dump -h 旧机` 或旧机 `pg_dump | ssh deploysvr psql`），绝不让本地开发机做中转管道 —— 本机上行带宽通常是最窄的一段，把 432MB 的 <2min 传输放大成半小时级停机。停机窗口估算须基于**实际传输路径的最窄带宽段**，而非纯数据体积。已回填 runbook 实测记录。

**建议写入：** `framework/patterns/deploy-patterns.md` §7.1（最短停机窗口）—— 终态数据同步两服务器直连、禁本机中转管道 + 停机窗口按最窄带宽段估算（非数据体积）。

**状态：** 待确认

---

## [2026-07-13] Claude CLI (Kimi) — 来源：BL-PROD-MIGRATE-DEPLOYSVR F-MIG-03 apify fork 服务自身 migrate 建不出 schema

**类型：** 新坑（fork 迁移）+ 诊断洞察

**内容：** F-MIG-03 迁移 apify-kol-service（fork 服务）到 deploysvr 时，原计划让服务容器起来后自身 `migrate` 建 schema（drizzle + pgboss + public 6 张 app 表），但**服务自带的 migrate 建不出完整 schema = fork 镜像缺陷**。被迫改走 `pg_dump apify_kol`（7.8M，全表 0 行但含完整 schema 定义）→ deploysvr fresh pg restore schema 的路子拿到表结构。另一根因洞察：原 crash-loop 是 `apify-kol-service-postgres-1` 三周前 Exited（疑 VM OOM/reset）→ service `EAI_AGAIN getaddrinfo postgres` → crash-loop；新 compose 加 `restart:unless-stopped` 根治复发。教训：迁移**fork/第三方服务**时，别假设「服务自身 migrate 能重建 schema」—— fork 可能缺 migration 文件或 migrate 逻辑不全，迁移前应先 `pg_dump --schema-only` 拿到确定性 schema 作为 fallback，而非依赖服务首启自建。

**建议写入：** `framework/patterns/deploy-patterns.md` §7（新增 fork/第三方服务迁移子段）—— fork/第三方服务迁移别依赖服务自身 migrate 建 schema（可能缺失），先 pg_dump --schema-only 拿确定性 schema fallback；+ 与 joyce §3.5 路径 B fork sync 模板交叉引用。

**状态：** 待确认

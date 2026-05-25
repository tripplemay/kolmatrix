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

<!-- 2026-05-25: v0.9.23 沉淀完成（31 条 = v0.9.22 13 + BL-069 3 + BL-070 12 + audit §5 缺失 3）—— BL-071 F008 按新结构 inline-merge 全部写入 framework/harness/*.md：ai-action-contract.md 3 段（§3.4 dedupe-then-validate + §3.5 prompt 自检 § + §5 SDK 抽象层）/ generator.md 13 段（§10D IaRedirectRule mixed-status + §11 F-I 4 子段 UUID guard/notFound HTTP/i18n ns caller/lazy fidelity + §12 audit工具链 3 段 + §13 InMemoryJobQueue + §14 编译时约束 2 段 + §15 perf 2 段含 #29+#30 合并）/ evaluator.md 3 段（§13.1 量化 criterion + §13.2 mock 不可用三件套 #12+#21 合并 + §13.3 staging chaos flag）/ pre-impl-adjudication.md 2 段（§6.4 建议命中率 + §11 多 audit 串联）/ deploy-patterns.md 3 段（§4.1 扩展 bot commit + §3.2 git pull inline + §7 Turbopack BUILD_ID）/ planner-workflow + arbitration + checklists 5 段（§P5.3 verifying trace + fix-round 类型 + session_notes + commit message + perf #25+#26 合并）。归档：framework/archive/proposed-learnings-archive-v0.9.23.md（F009 创建）。 -->

---

<!-- 新条目从这里开始追加 -->


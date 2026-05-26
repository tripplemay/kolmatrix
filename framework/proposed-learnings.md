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

## [2026-05-26] Claude CLI — 来源：BL-072 prod hotfix done / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #1）

**内容：** **IA refactor / 大范围结构改动后必须做 outbound 一致性扫描清单**（4 维度合并 — visual 宽度 / i18n 消费侧 t() wiring / Material Symbols 子集 manifest / 路由 outbound 链接）。BL-072 4 prod issue 共性根因 = BL-070-F003/F004/F005 IA refactor 大改后 outbound 一致性扫描缺失：
- Issue #1 /brief 宽度 (768 vs 1600) → visual 宽度跨 4 路由一致性漏检
- Issue #2 /insight i18n hardcoded → page.tsx 创建后 i18n 消费侧 t() wiring 漏检
- Issue #3 /match TABLE_ROWS 字面文字 → 新加 ligature 时 Material Symbols manifest 漏更新
- Issue #4 10 处 outbound 404 → 删老路由时 outbound 链接漏 grep

**建议写入：** `framework/harness/planner-checklists.md` 新段 §"IA refactor / 路由删除批次 outbound 一致性扫描清单"（4 维度 spec acceptance 模板 + 触发 batch 类型）

**状态：** 待用户 ack — v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-072-F005 / Generator Kimi

**类型：** 模板修订（v0.9.24 候选 #2）

**内容：** **subset script grep Pattern 6 JSX 三元 模板 + manifest 维护惯例**。BL-072-F005 已实物落 `scripts/regenerate-material-symbols-subset.sh` Pattern 6（匹配 `material-symbols-outlined` 上下文 ±5 行内 quoted string + false-positive 词排除清单）+ `framework/harness/checklists/material-symbols-pattern.md` §"manifest 增量维护" 段（何时手工追 manifest / path label 含 file:line + JSX 三元/return 类型 / IA refactor 改名时同步 path label）。本沉淀把"实物模式"提到 framework 层方便其他项目复用（false-positive 排除清单 reusable / pattern grep 通用）。

**建议写入：** `framework/harness/checklists/material-symbols-pattern.md` （已落 BL-072-F005） + 抽象 false-positive 排除规则模板到 `framework/harness/generator.md` §15 类似位置（subset script 通用模式）

**状态：** 待用户 ack — v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-072-F007 / Generator Kimi

**类型：** 新规律（v0.9.24 候选 #3）

**内容：** **i18n 消费侧 test 探针 + 三件套模式（page-side hardcoded English sweep + link-target audit + Material Symbols glyph 三向断言）**。BL-072-F007 已实物落 3 个 advisory test (`tests/unit/{link-target-audit,material-symbols-coverage,i18n-page-side-consumption}.test.ts`)。共同模式 = "测试基建对 outbound/消费侧/三向闭环的 advisory 防御"。第一版 warning 不 fail 避免 false-positive 拦截合法 PR，稳定 1-2 周后转 strict。**沉淀价值：** 把 "advisory test → strict test" 升级路径 + 三件套覆盖维度（routing 链接 / icon font glyph / i18n 消费侧）作为通用模板，未来类似批次可复用。

**建议写入：** `framework/harness/evaluator.md` 新段 §"advisory test 三件套模式 — outbound/消费侧/三向闭环防御"（含 BL-072-F007 三测试模板 + advisory→strict 升级路径）

**状态：** 待用户 ack — v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-072-F006 / Generator Kimi

**类型：** 新规律（v0.9.24 候选 #4，扩展 v0.9.23 #19）

**内容：** **删路由前必须 grep 全仓 outbound 链接 — 扩展 BL-070 #19 "删 i18n deprecated ns 前必须 grep callers" 同主题合并到通用 "删 X 前 grep callers" 矩阵**。BL-072-F006 修 10 处 outbound 404 链接根因 = BL-070-F004 删 5 老路由 + middleware 即停 redirect 时没 grep 全仓更新 outbound `href` 字面字符串。模式扩展：删任何"被引用资源"（路由 / i18n namespace / enum value / API endpoint / DB table）前必须先 grep 全仓 callers + 同 commit 修。BL-072 同步加 `tests/unit/link-target-audit.test.ts` advisory 防御未来同类。

**建议写入：** `framework/harness/generator.md` §"删 X 前 grep callers" 矩阵扩展（v0.9.23 #19 i18n callers + v0.9.24 #4 路由 outbound 同主题合并；矩阵纵向 = X 类型，横向 = grep 模式 + 自动化防御 test）

**状态：** 待用户 ack — v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-073 prod hotfix done / Planner Kimi

**类型：** 模板修订（v0.9.24 候选 #5，扩展 BL-072-F005）

**内容：** **subset script grep Pattern 进化路径** — v1 (Pattern 1-5 只覆盖同行 `>icon<` / 多行 `-A 1` 裸 / `icon: "name"` / `icon="name"` / manifest 手工) → v2 (BL-072-F005 加 Pattern 6 覆盖 `"quoted"` JSX 三元) → **v3 (BL-073-F002 加 Pattern 7 覆盖 multi-line span 内 bare ligature on own line)**。穷举 JSX pattern 模板：JSX 内 ligature 可能出现位置 = 同行 quoted / 多行 bare / 三元 quoted / 对象 value / return statement / `??` fallback。本次 BL-073 issue #1 暴露 v2 漏 bare 模式（forward_to_inbox / refresh / article 等 8 个）。

**建议写入：** `framework/harness/checklists/material-symbols-pattern.md` §"Pattern 进化路径 v1 → v2 → v3" + 穷举 JSX pattern 模板（每种 pattern 含 1 例 + grep 实现 + false-positive 排除）

**状态：** 用户 5/26 ack（lock A 完整版含防御升级）— 待 v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-073 prod hotfix done / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #6）

**内容：** **spec acceptance "嵌套二级约束 grep 全仓"模板** — 视觉宽度 / i18n / CSS variant 类 acceptance 凡涉及"外层约束改变"必须加 acceptance 行 `grep -rn "<约束类>" <相关路由>/ --include='*.tsx'` 全 review，确认无嵌套二级约束破坏外层意图。BL-072-F001 修 `/brief/page.tsx:75` max-w-3xl → max-w-[1600px] 但漏检 `BriefPageClient.tsx:120` 嵌套 max-w-3xl → BL-073 同问题复现。Acceptance 模板：`grep -rn "max-w-" src/app/[locale]/(app)/<route>/ --include='*.tsx'` 输出 review，0 个意外二级约束。

**建议写入：** `framework/harness/planner-checklists.md` §"spec 起草 checklist 集合" 新加段 "嵌套二级约束 grep 防御"（含视觉/i18n/CSS variant 三类 grep 模板）

**状态：** 用户 5/26 ack — 待 v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-073-F005 / Generator + Planner Kimi

**类型：** 新规律（v0.9.24 候选 #7，扩展 BL-072-F007 i18n-page-side-consumption v1）

**内容：** **i18n page-side test v2 — key existence 检测**。BL-072-F007 v1 仅 grep raw English literal 在 JSX text/attr，**不验 page.tsx 调用 `t(key)` 时该 key 在 messages JSON 实际 exist**。BL-073 issue #4A 反例：`match.emptyState.body` 5 locale 全 MISSING 但 page.tsx 调 `t("body")`，next-intl prod fallback 返字面 key 字符串。BL-073-F005 实物落 i18n-page-side-consumption.test.ts v2：扫所有 page.tsx + *Client/*Panel/*Bar 的 `t("<key>")` 调用 → 拼 namespace → 验 messages/en.json exist → 不 exist fail。第一版 advisory（STRICT_I18N=false），稳定后转 strict。

**建议写入：** `framework/harness/evaluator.md` §"advisory test 三件套"（BL-072-F007 沉淀的） 加 v2 升级路径：i18n page-side test v1 raw English → v2 + key existence；同步 STRICT_MODE 渐进 flip 模式（仅 strict Material Symbols 维度，i18n + link-target 仍 advisory）

**状态：** 用户 5/26 ack（lock A 完整版）— 待 v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-073 prod log audit / Planner Kimi

**类型：** 新规律（v0.9.24 候选 #8）

**内容：** **prod error log 接告警链 — MISSING_MESSAGE 应触发告警**。BL-073 SSH prod log 实测 `match.emptyState.body` + `weeklyReport.title` MISSING_MESSAGE 已多次出现于 prod log（5/25 17:18 ~ 18:02 UTC 至少 6 次），但**未触发任何告警** → next-intl 默认 production fallback 返 key 字面 + log 但不 throw，CI 跑不到 prod log，prod log 也无监控钩子。Sediment：MISSING_MESSAGE / Prisma error / 5xx response 等关键 error pattern 应入 log-based alert（如 grep tail with Slack webhook 或 GCP Cloud Monitoring）。

**建议写入：** `framework/harness/deploy-patterns.md` 新段 §"prod error log alerting" — 含 MISSING_MESSAGE / Prisma error / 5xx grep pattern + Slack webhook / GCP alerting 模板

**状态：** 用户 5/26 ack（间接, A1 lock 含此防御）— 待 v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-073-F007 / Generator + Planner Kimi

**类型：** 新规律（v0.9.24 候选 #9）

**内容：** **STRICT_MODE 渐进升级路径 — advisory → strict 渐进 flip 模板**。BL-072-F007 三件套 test (link-target-audit / material-symbols-coverage / i18n-page-side-consumption) 首版全 advisory（STRICT_MODE=false，warning 不 fail），避免 false-positive 拦截合法 PR。BL-073-F007 实物落渐进升级：拆 STRICT_MODE 为 `STRICT_MS_ICONS=true`（Material Symbols 维度 flip strict，CI fail 拦未追 manifest 的 icon）+ `STRICT_I18N=false`（仍 advisory）+ `STRICT_LINK_TARGET=false`（仍 advisory）。模式：稳定 1-2 周后逐维度 flip，每 flip 都需 CHANGELOG 标记 + planner-checklists.md 加"未来 X 必更 Y" 强制要求。

**建议写入：** `framework/harness/evaluator.md` §"advisory test 三件套" 段加 §"STRICT_MODE 渐进升级路径"（含 flip 模式 + CHANGELOG marker + 维度独立 flag 模板）

**状态：** 用户 5/26 ack — 待 v0.9.24 framework sediment batch 落地

---

## [2026-05-26] Claude CLI — 来源：BL-075-F002 / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #10）

**内容：** **pm2 reload --update-env 不会重读 env_file — 单加 .env 行无效**。BL-075-F002 落 `AIGCGATEWAY_KOL_COUNTRY_ACTION_ID` 到 prod + staging .env 后 `pm2 reload kolmatrix --update-env` 出现新 var 不生效（/proc/$PID/environ 仍只有旧 vars）。根因：pm2 的 `--update-env` 只刷新当前 shell env 到进程，**不重读 ecosystem.config.js 中 `env_file` 路径**。`pm2 startOrReload ecosystem.config.js --update-env` 同样不会重读 env_file（pm2 dump 缓存先前 env 块）。修复模式：`set -a; source /opt/kolmatrix/.env.production; set +a; pm2 reload kolmatrix --update-env`（先注入到 shell env，再 reload 自动 carry over）。验证：`tr "\0" "\n" < /proc/$PID/environ | grep <NEW_VAR>` 确认实际进程 env 含新 var。

**建议写入：** `framework/harness/deploy-patterns.md` §3.x SSH 加 env var 模板段 — 含完整 4 步：(1) 备份 .env + 加新行 (2) `set -a; source .env; set +a` (3) `pm2 reload ... --update-env` (4) `/proc/PID/environ` 验证

**状态：** 待用户 ack — done 阶段提出，落 v0.9.24 framework sediment batch

---

## [2026-05-26] Claude CLI — 来源：BL-075-F004 / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #11）

**内容：** **AI_DAILY_COST_USD_PER_TENANT_MAX 用 DEFAULT_COST_PER_CALL_USD=$0.01 估算 → 一次性 backfill 被 5x 高估**。BL-075-F004 prod backfill 跑 1383 KOL × 实际 cost ~$0.0009/call ≈ $1.25 总成本，但 cost-cap 用 `event_log count × $0.01` 估算（src/lib/ai/cost-cap.ts:43 DEFAULT_COST_PER_CALL_USD），$5/天 cap 在 ~500 call 时触发，剩余 880 call LLM 全部 skip。两个坑：(a) 估算 5-10x 高估实际成本（生产环境每次 LLM call 含 token 计费走 recordAiUsage 真实 costUsd，但 cap pre-check 只 count 不 sum），(b) 一次性 backfill 类操作没有 bypass 通道，被 normal-usage 同一 tenant 的 cap 拦截。Workaround: `AI_DAILY_COST_USD_PER_TENANT_MAX=500 nohup npx tsx scripts/...` 单次提升 cap。

**建议写入：** `framework/harness/ai-action-contract.md` 加 §"cost-cap 估算 vs 实际"段：(1) 修 cost-cap 改用 sum(payload.costUsd) 而非 count × default；(2) backfill 类 script 默认带 cap bypass flag 或环境覆盖文档；(3) 建议 cost-cap 拆 `interactive` (default $5/day) vs `batch` (default unlimited) 两档

**状态：** 待用户 ack — done 阶段提出，落 v0.9.24 framework sediment batch

---

## [2026-05-26] Claude CLI — 来源：BL-075-F004 / Generator Kimi

**类型：** 新坑（v0.9.24 候选 #12）

**内容：** **aigcgateway 30 RPM 默认硬限 — concurrency=5 backfill 必死 + retry 1.5s 救不了**。BL-075-F004 dry-run 实测：concurrency=5 时几乎每个 LLM call 都返 429 `RPM limit exceeded on key (limit=30). Please retry after 60 seconds`，fetchWithRetry 单轮 1.5s jitter retry 远不够（30 RPM = 2s gap minimum）。修复：enrichment-stage 加 makeLlmRateGate(intervalMs=2100) 单进程内 timestamp serialize 所有 LLM dispatch，concurrency=5 的 worker 在 LLM 前排队，franc/audience-geo path 不 gate（CPU 本地）。验证后 0 个 429。

**建议写入：** `framework/harness/ai-action-contract.md` §"批量调用 LLM 限速"段：(1) 默认 default RPM 假设 30，超 5 concurrency 必须自带 rate gate；(2) 推荐 pattern: `makeLlmRateGate(intervalMs)` + 预测 LLM 调用路径（仅 LLM-bound 才等待）；(3) fetch-with-retry 的 1.5s retry 不替代 rate gate（only 救偶发 spike）

**状态：** 待用户 ack — done 阶段提出，落 v0.9.24 framework sediment batch


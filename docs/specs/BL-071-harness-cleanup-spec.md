# BL-071 Harness Cleanup + v0.9.23 Framework Sediment 大批次 Spec

> **Sprint：** BL-071-harness-cleanup
> **Type：** framework reliability batch（非业务 batch；framework/ + .auto-memory/ + harness-rules.md 维度，无产品代码改动）
> **预估工时：** ~5 day（A0 audit ✓ done + A1 lock ✓ done + B 重组 1-1.5d + C sediment 1.5-2d + D 收尾 0.5d + E Reviewer 0.5d）
> **关联：** docs/test-reports/BL-071-harness-audit-2026-05-25.md（Phase A0 深度审计报告 426 LOC）
> **状态：** A0+A1 完成 → 待 building（F001 起点）

---

## §1 背景与触发

### 1.1 触发

BL-070-reach-insight-cleanup 5/25 done 后，project-status.md 标 "v0.9.23 候选累计 28 条留专门 framework sediment batch"。Planner Kimi 5/25 顺带做了一次 framework 全面深读 audit（docs/test-reports/BL-071-harness-audit-2026-05-25.md），暴露出 28 条 sediment 积压之外的 framework 结构问题：

- 高置信度重复 5 处（harness-rules.md 双副本漂移 / framework/memory 与 .auto-memory 同形 / done 收尾散落 3 处 / spec 起草规则散落 ≥4 处 / PM2 reload 规则重复）
- chronological-append 反模式（evaluator.md §10-§20 11 段时间序，最严重）
- 编号错乱 4 处（pre-impl-adjudication.md §11 / deploy-patterns.md §5.1 / generator.md §7 / evaluator.md §3 §4）
- 死文档 + 悬空 reference（cowork-constraint-design.md + cowork-constraints.md）
- 5 项实践已成形但 framework 未明示（staging deploy 前置 git pull / session_notes 写作惯例 / commit message 格式 / 类型 B fix-round / fix_rounds 计数语义）

### 1.2 用户 5/25 lock 的 12 决策点（D1-D12）

| # | Decision | Final |
|---|---|---|
| D1 | harness-rules.md 双副本 | B: 保 framework/harness/ 原名 + 顶部 banner + 同步内容（含铁律 #12 抽象版）+ framework/README.md 加防漂移流程 |
| D2 | framework/memory/ 区分 | B: 保原名 + README banner + 每文件顶部 frontmatter `<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap -->` |
| D3 | cowork 死文档 | 全清: 删 framework/cowork-constraint-design.md + bootstrap.sh line 100 防御性 mv + framework/README.md line 88 §历史说明段；CHANGELOG / archive 保留 |
| D4 | planner.md 625 LOC 拆分 | B: 3 文件 (planner-workflow.md + planner-arbitration.md + planner-checklists.md) |
| D5 | evaluator.md §10-§20 重组 | B: 按 topic 重组单文件（L1 验收前置 / L2 验收手段 / 验收口径 / 测试设计） |
| D6 | scope tag | A: frontmatter 加 `scope: project-specific` 或 `scope: framework-generic` |
| D7 | sediment 写入规则 | A: 强制 inline-merge 到 topic 段；禁 chronological-append §N（除非真无对应 topic） |
| D8 | sediment workflow doc | B: 合并入 proposed-learnings.md header |
| D9 | 入口层级 | A: 保 3 层（CLAUDE.md → harness-rules.md → framework/）+ framework/README.md 顶部 banner |
| D10 | case 文件 subdir | B: 移 framework/harness/checklists/（material-symbols-pattern + i18n-namespace-add-checklist） |
| D11 | 批次范围 | A: 全做 5-day phased（A0+A1+B+C+D+E 一气呵成，不拆 BL-072） |
| D12 | fix_rounds 计数语义 | B: 写入 planner-workflow.md（拆分后新文件）的 §"阶段转换 + fix_rounds 计数" |

### 1.3 角色分配

- role_assignments: null（按默认映射）— Claude CLI = planner + generator，Codex = evaluator (Reviewer)
- 用户 5/25 ack 不指定特定 Generator agent（Kimi / johnsong 视会话承接情况）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- **结构重组**：D1-D6 + D9 + D10 — 文件去重 / 拆分 / 重组 / scope tag / subdir 移
- **死文档清理**：D3 全清
- **sediment 写入规则**：D7 + D8 入 proposed-learnings.md header
- **fix_rounds 计数语义**：D12 入 planner-workflow.md
- **31 条积压 sediment 写入**（按新结构 inline-merge）：
  - v0.9.22 待写 13 段（BL-066/067/068 archive ai-action-contract / generator / evaluator / pre-impl-adjudication / deploy-patterns / planner）
  - BL-069 user-acked 3 段（IaRedirectRule status + staging chaos flag runbook + fix-round 类型分类）
  - BL-070 user-acked 12 段（#17-19 + #21-24 + #25-28 + #29-30）
  - audit §5 缺失新规则 3 项（staging deploy 前置 git pull + session_notes 写作惯例 + commit message 格式）
- **编号错乱修复**：pre-impl-adjudication.md §11 / deploy-patterns.md §5.1 / generator.md §7 / evaluator.md §3 §4 重复
- **CHANGELOG + archive 收尾**：v0.9.23 段 + framework/archive/proposed-learnings-archive-v0.9.23.md
- **Reviewer L1+L2 抽样验证**：F010 (executor:codex)

### 2.2 OUT-OF-SCOPE（明示）

- 业务代码改动（src/ / prisma/ migrations 等）— 本批次 framework only，**0 行业务代码改动**
- 真客户 onboarding（db:seed / tenant cleanup / 监控仪表板）— 留独立批次
- Phase 5 个性化学习 / Brief 模板库 / comparative query / skip-replace 写 DB — 留 Phase 5 批次
- BL-062 KOL data coverage gap 治理 — 留 backlog
- BL-070 post-launch ops（24h audit + ≥5 marketer dogfood）— 已归用户手工待办 backlog
- BL-067/068/069/070 业务功能新增 / 修改 — 已 done，本批次不动业务行为

### 2.3 不变量 / 铁律

1. **0 行业务代码改动**：本批次仅 framework/ + .auto-memory/ + harness-rules.md + docs/ + 项目根 README/CLAUDE 维度。`src/` / `prisma/migrations/` / `tests/` 不变。
2. **bootstrap.sh 同步**：任何 framework/ 文件移动/改名都必须同步 bootstrap.sh cp/mv 路径，保证 template-bootstrap 仍 work。
3. **CHANGELOG 历史路径保留**：CHANGELOG.md 内部对 planner.md 等旧路径的历史引用不强改（标 v0.9.X 历史段不动），仅新增 v0.9.23 段说明结构变更。
4. **cross-reference 不可断**：任何文件移动/改名必须 grep 全仓更新所有引用（`grep -rln '<old-path>' framework/ .auto-memory/ docs/`）。
5. **sediment inline-merge 不丢内容**：31 条 sediment 全部写入新结构，archive 保留全文（不仅 1-line summary）；任何被合并的多条 sediment（如 #29 + #30 都是 Suspense fallback）合并段名要保留两条 source 信息。
6. **Reviewer L1+L2 全 PASS 才 done**：scope tag 完整 / 路径无 broken / 28+3 条 sediment 真 inline-merge（非 dump）/ banner 正确 / bootstrap.sh dry-run pass。

---

## §3 实施 Phase 划分（5-day）

| Phase | 范围 | 工时 | 谁做 | 状态 |
|---|---|---|---|---|
| **A0** | 深度 audit (docs/test-reports/BL-071-harness-audit-2026-05-25.md) | 0.5 day | Planner Kimi | ✅ done |
| **A1** | 用户 lock D1-D12 12 决策点 | 0.5 day | Planner + 用户 | ✅ done |
| **B** | 文件重组 (F001-F007)：cleanup + restructure + scope tag + subdir + 编号修 + sediment 规则正式化 | 1-1.5 day | Generator | pending |
| **C** | 31 条 sediment 写入 (F008)：按新结构 inline-merge，覆盖 v0.9.22 + BL-069/070 + §5 缺失 | 1.5-2 day | Generator | pending |
| **D** | 收尾 (F009)：CHANGELOG v0.9.23 段 + framework/archive/v0.9.23.md + backlog cleanup + proposed-learnings 清空 | 0.5 day | Generator | pending |
| **E** | Reviewer L1+L2 抽样验证 (F010) | 0.5 day | Codex (Reviewer) | pending |
| **总计** | | ~5 day | | |

---

## §4 Features 详细描述

### F001: 项目根 vs framework/ template 关系明示（D1+D2+D9）

**Why：** audit §2.1 + §2.2 暴露 harness-rules.md 双副本漂移 + framework/memory 同形混淆；D1/D2/D9 lock 选择"保原名 + banner + 内容同步 + 防漂移流程"路径。

**What：**
1. `framework/harness/harness-rules.md` 顶部加 banner: `<!-- TEMPLATE FILE: 本文件为 template，供 bootstrap.sh 拷到新项目根。项目运行时 agent 读项目根 harness-rules.md，不读本文件。新铁律先 add 到项目根，评估抽象后 port 到本文件。-->`
2. 同步 framework/harness/harness-rules.md 内容到与项目根 harness-rules.md 一致（含铁律 #12 `git diff --cached` 验 staged，抽象版去掉项目特定 BIx commit ref，保留通用原则）
3. `framework/memory/MEMORY.md` + `project-status.md` + `environment.md` + `user-role.md` + `reference-docs.md` 5 文件顶部加 frontmatter banner: `<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh -->`
4. `framework/README.md` 顶部加 banner: `<!-- 本目录是 template 维护人参考。项目运行时 agent 应读 CLAUDE.md → harness-rules.md（项目根）→ .auto-memory/。不读本文件。-->`
5. `framework/README.md` 新增 §"新规则演进流程"：（1）新铁律先 add 项目根 harness-rules.md；（2）评估是否项目特定 vs framework-generic；（3）后者 port 到 framework/harness/harness-rules.md template，前者标 scope: project-specific；（4）任何新铁律 commit 同时同步 framework/CHANGELOG.md。

**Acceptance：**
- [ ] 5 处 banner 落地（1 + 5 + 1）
- [ ] framework/harness/harness-rules.md 与项目根 diff 仅"项目特定 ref（如 BIx commit hash）"层面（铁律 #12 内容同步且抽象）
- [ ] framework/README.md §"新规则演进流程"段 ≥20 LOC 含 4 步流程
- [ ] grep `framework/harness/harness-rules.md` 验 cross-reference 无 broken

---

### F002: cowork 死文档全清（D3）

**Why：** audit §4.1 + §4.5 — cowork-constraint-design.md 自称"Cowork 不再参与"，bootstrap.sh line 100 防御性 mv 仍引用，README §历史说明仍提及，已不与现实匹配。

**What：**
1. 删 `framework/cowork-constraint-design.md`（git rm）
2. 改 `framework/bootstrap.sh` line 100：删除 `[ -f "$TARGET_DIR/cowork-constraint-design.md" ] && mv "$TARGET_DIR/cowork-constraint-design.md" "$TARGET_DIR/framework/"` 整行
3. 改 `framework/README.md` line 88 §"历史说明"段：删除 `> **历史说明：** 早期版本曾命名为 "Cowork + Harness"...` 整段（cowork 历史交给 CHANGELOG v0.7.0 + framework/archive/proposed-learnings-archive-v0.5.md 承担）
4. grep 验残留：`grep -rln -i "cowork" framework/ .auto-memory/ docs/specs/ docs/dev/ --include="*.md" --include="*.json" --include="*.sh"` 仅命中 CHANGELOG / archive / 本 spec / 本 audit 4 文件

**Acceptance：**
- [ ] `framework/cowork-constraint-design.md` 不存在
- [ ] `framework/bootstrap.sh` line 100 已删
- [ ] `framework/README.md` §"历史说明"段已删
- [ ] grep cowork 仅命中 4 历史保留文件
- [ ] `framework/bootstrap.sh` dry-run（如有）跑通

---

### F003: planner.md 拆 3 文件 + D12 fix_rounds 计数（D4 + D12）

**Why：** audit §3.1 + §6.4 + §5.5 — planner.md 625 LOC 已超易读阈值，混了 3 类内容（流程/裁决/检查）；spec 起草 checklist 散落 ≥4 处；fix_rounds 计数语义模糊。

**What：**
1. 拆 `framework/harness/planner.md` 为 3 文件：
   - `framework/harness/planner-workflow.md`（~200 LOC）：§0-§6 启动流程 / 阶段流转 / done 收尾 / 用户反馈处理 + 新增 §"阶段转换 + fix_rounds 计数语义"（D12：fix_rounds = verifying→fixing→reverifying 之间循环次数，不是任意 fix commit 数）
   - `framework/harness/planner-arbitration.md`（~200 LOC）：Pre-impl P1-P5 五级裁决 + spec 调整规则 + Generator 越界界定
   - `framework/harness/planner-checklists.md`（~250 LOC）：7 铁律矩阵 + spec 起草 checklist 集合（数据准备 / perf / UI / i18n / rate-limit 全集中）
2. `framework/harness/planner.md` 改为 ~30 LOC 索引页：列 3 子文件 + 一句话描述 + 跳转指向（保留旧文件名做向后兼容）
3. 同步 `.auto-memory/role-context/planner.md`（短摘要 44 LOC）：cross-reference 路径更新（指向 3 新文件而非旧 planner.md）
4. 同步 `framework/harness/pre-impl-adjudication.md` + `framework/harness/evaluator.md` + `framework/harness/generator.md` 等内部对 planner.md 段的 cross-reference，按内容定位到新文件
5. grep 全仓 `framework/harness/planner.md` 引用，逐个评估是否需改路径（spec / readme / archive 历史保留不动；活规则 cross-ref 更新）

**Acceptance：**
- [ ] 3 新文件 + 索引页 4 个文件落地，原 planner.md 转为索引页
- [ ] D12 fix_rounds 计数语义在 planner-workflow.md §"阶段转换"段含明确定义 ≥5 LOC + BL-070 反例
- [ ] .auto-memory/role-context/planner.md cross-ref 全部指向新文件
- [ ] grep 旧 `framework/harness/planner.md` 引用仅命中 archive / CHANGELOG / 旧 commit 引用历史保留
- [ ] 3 新文件 frontmatter scope tag 标好（按 F005）

---

### F004: evaluator.md 按 topic 重组 + 编号修（D5 + 编号错乱）

**Why：** audit §3.1 evaluator.md §10-§20 11 段时间序最严重；§3 §4 编号撞车。

**What：**
1. `framework/harness/evaluator.md` 432 LOC 单文件按 topic 重组：
   - §1-§9 核心 workflow 保留（修复 §3 §4 编号撞车）
   - 原 §10-§20 11 段合并到 4 个新 topic 段：
     - §10 **L1 验收前置**：原 §15 prisma generate + §16 .nvmrc + §17 lint warnings 矩阵
     - §11 **L2 验收手段**：原 §14 fire-and-forget audit + §18 E2E suite + §19 SQL RLS + §20 L1+角色门禁手动探针 + §13 Material Symbols 子集
     - §12 **验收口径**：原 §10 SHA 对齐 + §11 Smoke checklist 文本陈旧（升级到最新） + §12 首轮 PASS 硬条件
     - §13 **测试设计**：（占位，F008 时 BL-070 #21 e2e server-action mock 不可用、v0.9.22 #2 量化 criterion / #12 mock infeasible 等 inline-merge 至此段）
2. 修复 §3 §4 重复编号 / §7 重复编号（generator.md 也有同样问题但归 F007）
3. 同步 `.auto-memory/role-context/evaluator.md` 短摘要 cross-ref

**Acceptance：**
- [ ] evaluator.md §1-§13 编号连续无重复
- [ ] §10-§13 按 topic 命名而非 v0.9.X 时间序
- [ ] 原 §10-§20 内容无丢失（每条 sediment 都能在新结构找到归宿）
- [ ] LOC 在 ±10% 范围（不大膨胀也不大缩减；预期 ~432 → ~420 LOC 含编号 cleanup）
- [ ] .auto-memory/role-context/evaluator.md cross-ref 全部指向新段

---

### F005: framework/harness/*.md scope tag 添加（D6）

**Why：** audit §3.3 — framework/harness/ 含项目特定 (database-patterns RLS / i18n / material-symbols) 与通用 (planner / generator / evaluator / pre-impl-adjudication / ai-action-contract / deploy-patterns / ui-fidelity-guardrail) 混杂；未来复用时需 scope 筛选。

**What：**
逐文件评定 scope 加 frontmatter（F003 + F004 拆分/重组后的新文件结构，含 checklists subdir 内的）：

| 文件 | scope |
|---|---|
| harness-rules.md (template) | framework-generic |
| planner-workflow.md / planner-arbitration.md / planner-checklists.md | framework-generic |
| generator.md | framework-generic |
| evaluator.md | framework-generic |
| pre-impl-adjudication.md | framework-generic |
| ai-action-contract.md | framework-generic（v0.9.22 #6 SDK 抽象层等 inline-merge 后含 KOLMatrix 反例但原则通用） |
| deploy-patterns.md | mixed（共通部分通用 + KOLMatrix 部署路径项目特定 — 标 `scope: mixed` 加 `project-specific-sections: [§1.6, §3.2]` 标注哪些段项目特定） |
| database-patterns.md | mixed（RLS / NULLIF 通用 + kolmatrix_app role 名项目特定） |
| ui-fidelity-guardrail.md | framework-generic（设计原则通用，含 Stitch 引用但可作通用 visual baseline 工具） |
| checklists/material-symbols-pattern.md | project-specific |
| checklists/i18n-namespace-add-checklist.md | project-specific（5 locale CN/EN/JA/KO/ES 命中项目特定但模式通用，标 project-specific） |

frontmatter 格式：
```yaml
---
scope: framework-generic  # or project-specific or mixed
project-specific-sections: [§X, §Y]  # 仅 mixed 时填
last-updated: 2026-05-25
---
```

**Acceptance：**
- [ ] 11 框架文件 frontmatter scope tag 完整
- [ ] mixed 类（deploy-patterns + database-patterns）含 project-specific-sections 标注
- [ ] framework/README.md 新增 §"scope tag 用法说明"段（如何复用、如何筛选）

---

### F006: 项目特定 case 文件移 checklists/ subdir（D10）

**Why：** audit §6.10 — material-symbols / i18n-namespace 强项目特定，与 framework/harness/ 顶层通用文件混排不清。

**What：**
1. `mkdir -p framework/harness/checklists/`
2. `git mv framework/harness/material-symbols-pattern.md framework/harness/checklists/material-symbols-pattern.md`
3. `git mv framework/harness/i18n-namespace-add-checklist.md framework/harness/checklists/i18n-namespace-add-checklist.md`
4. grep 全仓更新 cross-reference 路径：
   - `framework/harness/material-symbols-pattern.md` → `framework/harness/checklists/material-symbols-pattern.md`
   - `framework/harness/i18n-namespace-add-checklist.md` → `framework/harness/checklists/i18n-namespace-add-checklist.md`
5. `framework/README.md` 新增 §"checklists subdir 用法"：subdir 内放项目特定 case checklist；framework-generic 留顶层
6. 检查 bootstrap.sh 是否需同步 cp 路径（如有 explicit 列举这两个文件，需改路径）

**Acceptance：**
- [ ] 2 文件移到 checklists/ subdir，原位置不存在
- [ ] grep `framework/harness/material-symbols-pattern.md` 仅命中 archive / CHANGELOG / 旧 commit 历史保留
- [ ] bootstrap.sh dry-run pass（如脚本中无 explicit 引用则跳过）
- [ ] framework/README.md §"checklists subdir 用法"段 ≥15 LOC

---

### F007: sediment 写入规则正式化 + 编号修复（D7 + D8 + 其余编号）

**Why：** audit §3.2 — 编号错乱 4 处（pre-impl-adjudication.md §11 / deploy-patterns.md §5.1 / generator.md §7 / evaluator.md §3 §4 — evaluator.md 归 F004）；D7 + D8 sediment 写入规则待正式化。

**What：**
1. `framework/proposed-learnings.md` 顶部新增 §"写入流程"段（D8 lock），含：
   - 4 步流程：propose → 用户 ack → inline-merge 入 framework/ → archive
   - D7 lock 的 inline-merge 强制规则：新 sediment 先 grep 贴近 topic 段做 inline-merge（合并矩阵行 / 加子段 / 修订段内文字），找不到贴近段才开新 topic 段；禁 chronological-append §N
   - sediment 类型分类：新规律（merge 入矩阵行）/ 新坑（merge 入"踩坑列表"段）/ 模板修订（直接 inline 改原段）/ 铁律补充（升级 harness-rules.md，影响所有项目）
   - 写入位置决策树：是否项目特定？是否影响多角色？是否需 ADR？
2. 修复编号错乱：
   - `framework/harness/pre-impl-adjudication.md` §11 位置在 §10 版本历史之前 → 重排为 §10（顺接） / §11 历史段 last
   - `framework/harness/deploy-patterns.md` §5.1 重命名为 §6（独立 topic 提到顶级 §）
   - `framework/harness/generator.md` §7 重复（"框架提案" + "Handoff 说明" 都是 §7） → 改为 §7 框架提案 / §8 Handoff 说明，原 §8-§10 顺延为 §9-§11

**Acceptance：**
- [ ] proposed-learnings.md 顶部 §"写入流程"段 ≥40 LOC 含 4 步 + D7 + 类型分类 + 决策树
- [ ] pre-impl-adjudication.md / deploy-patterns.md / generator.md 编号连续无重复
- [ ] 编号修复同步更新所有内部 cross-ref（grep `§N` 全文）

---

### F008: 31 条 sediment 写入（按新结构 inline-merge）

**Why：** Phase C 核心 — 28 积压 + audit §5 缺失 3 新 = 31 条，全部 inline-merge 到 F003-F007 重组后的新结构。

**What（按目标文件分组）：**

#### 8a. `framework/harness/ai-action-contract.md` 3 段（v0.9.22 #6 / #10 / #11）

- #6 SDK 抽象层不绑定 max_tokens → inline-merge 入 §4.7 现有段（合并子段）
- #10 dedupe-then-validate fallback → inline-merge 入 §5 server-side validation 现有段或新增 §5.X 子段
- #11 prompt v3 自检 § → inline-merge 入 §6 prompt design 现有段或新增 §6.X 子段

#### 8b. `framework/harness/generator.md` 4 段 + BL-070 8 段 = 12 段

- v0.9.22 #3 audit 实测 + #5 InMemoryJobQueue + #8 webpack typecheck + #9 MCP trace（4 段）
- BL-069 #14 IaRedirectRule status mixed-status（1 段）
- BL-070 #17 删显式子路由前 UUID guard + #18 notFound() + next-intl status / #19 i18n ns caller-grep + #22 prisma migrate ROLLBACK skeleton + #23 'use server' file-level / #27 next/image 异构 CDN unoptimized / #28 lazy boundary fidelity test 同步 / #29 Suspense skeleton 镜像 + #30 Suspense 宽度等宽（9 段 — #29 + #30 合并入同一"Suspense fallback 规范"段，逻辑 8 段）
- inline-merge 优先合并到 generator.md §"删除前自检矩阵"（如有）/ §"性能落地清单"等 topic；找不到现段才开新 §

#### 8c. `framework/harness/evaluator.md` 2 段 + BL-070 1 段 = 3 段

- v0.9.22 #2 量化 criterion + #12 mock infeasible → inline-merge 入 F004 重组后 §13 测试设计
- BL-070 #21 e2e server-action mock 不可用 → inline-merge 入同 §13 测试设计（与 #12 同主题合并）
- BL-069 #15 staging chaos flag runbook → inline-merge 入 §11 L2 验收手段（chaos test 子段）

#### 8d. `framework/harness/pre-impl-adjudication.md` 2 段

- v0.9.22 #1 多 audit 串联 + #7 命中率 → inline-merge 入现有 §3 audit 设计或 §9.1 Planner 写 spec 自检清单

#### 8e. `framework/harness/deploy-patterns.md` 1 段 + BL-070 1 段 + §5.1 缺失 1 段 = 3 段

- v0.9.22 #4 Turbopack（→ 新 §或 inline §1.X）
- BL-070 #24 github-actions[bot] 不 cascade CI workflow_dispatch（→ 新 §或 inline §3.X）
- audit §5.1 staging deploy 前置 git pull（→ inline §3.2 deploy 步骤）

#### 8f. `framework/harness/planner-workflow.md` / `planner-checklists.md` 分摊：

- v0.9.22 #13 verifying gate trace → planner-arbitration.md（P5 裁决相关）
- BL-069 #16 fix-round 类型分类 A vs B → planner-workflow.md §"阶段转换 + fix_rounds 计数"（与 D12 同段，合并）
- BL-070 #25 perf 量化门槛入 acceptance + #26 perf acceptance client/server 分类 → planner-checklists.md §"perf checklist"（合并两条到一段）
- audit §5.2 session_notes 写作惯例 → planner-workflow.md §"会话结束 5b session_notes"段
- audit §5.3 commit message 格式规范 → planner-workflow.md §"git workflow"段（或新建 §"commit message 规范"）

**Acceptance：**
- [ ] 31 条 sediment 全部 inline-merge 到对应文件（archive 留全文 source-of-truth）
- [ ] 0 条以 chronological-append §N 方式落地（D7 强制）
- [ ] 同主题多条 sediment 合并（如 BL-070 #29 + #30 Suspense fallback / v0.9.22 #12 + BL-070 #21 mock infeasible 合并段）
- [ ] 31 条对应的 framework/harness/*.md 新内容 LOC 合计 ~600-1000（与 audit 估一致）
- [ ] proposed-learnings.md 13 个 `<!-- vX 沉淀完成 -->` HTML 注释 + 15 条 BL-069/070 entries 全部清空（archive 保留全文）

---

### F009: CHANGELOG + archive + 收尾

**Why：** v0.9.23 沉淀闭环 + backlog cleanup + Phase 4 上线追踪记忆同步。

**What：**
1. `framework/CHANGELOG.md` 顶部新增 v0.9.23 段（~80-120 LOC）：
   - 31 条 sediment 1-line summary（按目标文件分组）
   - 11 项结构变更（D1-D12 各 1 行总结）
   - 编号错乱修 4 处
   - cowork 死文档清理 3 处
2. `framework/archive/proposed-learnings-archive-v0.9.23.md` 新建：
   - 31 条全文（不省略，保留 source-of-truth）
   - 11 项结构变更详细记录（每项含 before/after / decision lock 引 BL-071 spec）
3. `framework/proposed-learnings.md` 清空所有 entries（保留 header + §"写入流程" + 新增 `<!-- v0.9.23 沉淀完成 marker -->`）
4. `.auto-memory/MEMORY.md` 索引同步（如 framework/harness/planner.md 拆为 3 文件需同步 T2 链接）
5. `.auto-memory/project-status.md` 覆盖写 BL-071 进展（done 后再次覆盖写 marker）
6. `backlog.json` 整理（如有已完成项 BL-070 post-launch 移到用户手工待办；已 closed 项归 archive）

**Acceptance：**
- [ ] CHANGELOG v0.9.23 段含 31 + 11 完整列表
- [ ] archive v0.9.23.md 31 条全文 + 11 结构 detailed
- [ ] proposed-learnings.md 清空所有未 archived entries
- [ ] MEMORY.md cross-ref 同步
- [ ] backlog.json 整理后 valid JSON（`python3 -c "import json; json.load(open('backlog.json'))"`）

---

### F010: Reviewer L1+L2 抽样验证（executor:codex）

**Why：** 大型 framework 重组的最后验证，确保结构变更无 broken cross-reference / 内容无丢失 / scope tag 正确。

**What（Reviewer Codex 执行）：**

**L1 自动化（必跑）：**
1. `find framework/ -name "*.md" -exec head -10 {} \;` 验所有文件 frontmatter scope tag 完整
2. `grep -rln "framework/harness/planner.md" framework/ .auto-memory/ docs/specs/ docs/dev/ --include="*.md"` 仅命中 archive / CHANGELOG / 旧 audit 历史保留（不命中活规则）
3. `grep -rln -i "cowork" framework/ .auto-memory/ --include="*.md" --include="*.sh"` 仅命中 CHANGELOG / archive 历史保留
4. `python3 -c "import json; json.load(open('backlog.json'))"` 及 `progress.json` `features.json` 全 valid JSON
5. `bash framework/bootstrap.sh --dry-run /tmp/test-bootstrap` 验 bootstrap 仍 work（如脚本无 dry-run flag 则跑实际 cp 到 /tmp 比对）
6. `find framework/harness -maxdepth 1 -name "material-symbols*"` 应空 / `find framework/harness/checklists -name "material-symbols*"` 应 ✓

**L2 抽样选读（必跑，5 项）：**
1. 抽读 planner-workflow.md / planner-arbitration.md / planner-checklists.md 三新文件，验内容是否真按 topic 拆分（非简单切割）
2. 抽读 evaluator.md 新 §13 测试设计，验是否真按 topic 合并而非 dump（v0.9.22 #2 + #12 + BL-070 #21 是否真合并到 1-2 段）
3. 抽读 generator.md BL-070 #29 + #30 Suspense fallback 段，验是否真合并为 1 段含两条 source
4. 抽读 proposed-learnings.md header §"写入流程"，验 D7 + D8 是否真正式化
5. 抽读 framework/CHANGELOG v0.9.23 段 + archive v0.9.23.md，验对应关系（31 条 summary ↔ 31 条全文 1-to-1）

**Acceptance（Reviewer 出 signoff doc）：**
- [ ] L1 6 项 / L2 5 项全 PASS（其中 L2 抽样选读出报告含 sample 引用）
- [ ] 0 broken cross-reference
- [ ] 0 内容丢失（所有原 sediment + 原 planner.md/evaluator.md 段都能在新结构找到归宿）
- [ ] 0 scope tag 错配
- [ ] signoff doc `docs/test-reports/BL-071-signoff-2026-05-XX.md` 完整含 L1/L2 结果 + sample 引用 + 终签

---

## §5 风险 / 应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| F003 planner.md 拆分破坏 cross-reference | 中 | 中 | grep 全仓更新；F010 L1 #2 强制验证 |
| F004 evaluator.md 重组内容丢失（§10-§20 段合并时漏内容） | 中 | 高 | 拆前留 git tag bl071-before-restructure；F010 L2 #2 抽样验合并真实性 |
| F008 31 条 sediment 写入工作量超 1.5-2d | 中 | 中 | 按 8a-8f 分组 commit；先做高密度合并段（generator.md 12 段）/ 后做单点段（pre-impl 2 段） |
| Reviewer L2 报内容丢失需重做 | 低 | 高 | F004 / F008 commit 时附 audit doc cross-ref 让 Reviewer 验对 |
| F006 文件移 checklists/ 后 bootstrap.sh broken | 低 | 中 | F006 同步检查 bootstrap.sh + F010 L1 #5 dry-run |
| F002 cowork 清理误删历史信息 | 低 | 低 | CHANGELOG / archive 保留；删除前 git rm 而非 rm（保 git history） |

---

## §6 Out-of-Scope（明示）

- BL-070 post-launch ops（24h audit + ≥5 marketer dogfood）— 已归用户手工待办
- 业务代码改动（src/ / prisma/ / tests/ 全部不动）
- ADR 新增 / 修订（如 D6 scope tag 模式可能未来升 ADR-014 框架重组但本批次不做）
- framework/templates/ 内 spec / test-report 模板（如有）的同步更新（非 mandatory，留 backlog）

---

## §7 Done Definition

- [ ] F001-F010 全部 acceptance PASS
- [ ] Reviewer L1+L2 全 PASS（signoff doc 终签）
- [ ] progress.json status = done，fix_rounds 记录（预期 0-1 轮，本批次纯结构无业务逻辑，复杂度低）
- [ ] CHANGELOG v0.9.23 段 + archive v0.9.23.md 闭环
- [ ] proposed-learnings.md entries 清空
- [ ] .auto-memory/project-status.md 标 BL-071 DONE + framework v0.9.23 闭环
- [ ] 用户 ack 终签

---

## §8 后续批次预告（信息性，不在本批次范围）

- **Phase 5（个性化学习）：** 待 BL-071 done 后启动；Brief 模板库 / comparative query / skip-replace 写 DB / AI 学到偏好（5/25 ADR-013 转向决议）
- **BL-062：** KOL data coverage gap 治理
- **真客户 onboarding 准备：** db:seed 验证 + tenant cleanup + 监控仪表板
- **BL-070 post-launch ops：** 24h audit + ≥5 marketer dogfood 反馈循环（用户手工待办，非批次）

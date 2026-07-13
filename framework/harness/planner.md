# Planner 角色指令

## 你的唯一任务
把用户的需求拆解为具体、可逐条实现、可验证的功能列表，并准备好开发所需的规格文档。

## 执行步骤

### 0.0 会话启动先看 staged 索引（v0.9.26 — BL-083 铁律 #12 重演）

多角色同工作树并行时（慢车道多实例共享工作树 / 用户同机多开实例），开 session 第一动作必跑 `git status --short` 看**左列** staged 池（`M`/`A` 标记），确认哪些文件是别的 agent 已 `git add` 但未 commit 的 WIP，**不是自己的**。后续做任何 Planner ops commit 前再跑一次，确认 `git diff --cached --name-only` 仅含本 commit 应含文件。

> 反例：BL-083 fork .env ops 后 Planner 只看自己 `git add` 的 1 个文件就 commit，把 Generator/Evaluator 在制 BL-082 的 5 个 staged 文件一并打包推 main（commit 97339c6），违反铁律 #10 commit-tag 一致性。详见 `harness-rules.md` 铁律 #12 + 本文件铁律 1 矩阵 v0.9.26 行。

### 0. 读取需求池 + 用户反馈
启动新批次前，依次读取：

**0a. 用户反馈（`docs/test-reports/user_report/`）**
- 检查该目录是否有新增或未处理的反馈报告
- 有 → 向用户展示报告摘要和关键问题，询问是否纳入本批次
- 用户反馈是需求的重要来源，尤其是 P0/P1 级别的 DX 问题应优先考虑

**0b. 需求池（`backlog.json`）**
- 如果有待处理条目，向用户展示列表，询问本批次要包含哪些
- 用户选取后，将选中条目并入本批次的 features.json
- 选中的条目从 backlog.json 中移除（未选的保留）
- 如果 backlog 为空且无用户反馈，直接询问用户新需求

### 1. 深入理解需求
向用户提出以下问题（如果 progress.json 中已有 user_goal 则跳过）：
- 这个功能要解决什么问题？
- 主要用户是谁，他们会做什么操作？
- 有没有你特别想要或特别不要的功能？

### 2. 编写规格文档（按批次类型判断）

**新功能批次（硬性要求）：** 必须在 `docs/specs/` 下创建规格文档后才能进入 building 阶段。
文件名：`[批次名称]-spec.md`，内容包含：
- 背景与目标
- 功能范围
- 关键设计决策
- 接口/数据模型说明（如有）

**Bug 修复批次（软性）：** spec 可省略，features.json 的 acceptance 标准即为 Generator 的实现依据。
如省略，`docs.spec` 填 `null`。

### 2.5 检查 Stitch 设计稿（UI 页面变更时必须）

如果本批次涉及 **UI 页面的架构变更**（数据模型重构、页面新增/合并/拆分），必须：
1. 检查 Stitch 项目中是否有对应页面的设计稿
2. 有 → 追加一条 "更新 Stitch 设计稿" 的功能条目到 features.json
3. 无 → 评估是否需要新建设计稿（新页面建议先设计再编码）

**不做此检查会导致设计稿与代码架构脱节，后续需要额外的重构轮修复。**

**功能改造批次的设计稿一致性要求：** 即使批次不是 UI 重构，只要修改了 `design-draft/` 目录下有原型的页面（如清理假数据、补全交互），其 acceptance 必须包含以下条目之一：
- 「变更后页面布局与设计稿一致」（改动未影响布局结构时）
- 「设计稿已同步更新以反映本次变更」（改动涉及布局变更时，需追加更新设计稿的功能条目）

缺少此条目 = 验收时无法检查视觉一致性，可能导致设计稿与代码脱节。

### 3. 生成功能列表
将需求展开为 5-30 条具体功能，写入 features.json。

**每条功能必须声明 `executor` 字段：**
- `"generator"`（默认）：代码实现类，由 Generator 在 building 阶段完成
- `"evaluator"`：执行/评估类，由 Evaluator 在 verifying 阶段完成（历史项目的 `"codex"` 为等价别名）

executor:evaluator 的典型场景：压力测试执行、code review、安全审计、E2E 测试运行、性能分析报告。

```json
{
  "features": [
    {
      "id": "F001",
      "title": "编写压测脚本 scripts/stress-test.ts",
      "priority": "high",
      "executor": "generator",
      "status": "pending",
      "acceptance": "脚本存在，支持 BASE_URL，可正常执行"
    },
    {
      "id": "F002",
      "title": "执行压测并输出报告",
      "priority": "high",
      "executor": "evaluator",
      "status": "pending",
      "acceptance": "报告文件已生成，包含所有场景数据和结论"
    }
  ]
}
```

### 4. 按优先级排序
- high：核心功能，没有它项目无法使用
- medium：重要但非必须的功能
- low：锦上添花的功能，最后实现

### 5. 角色分配（多 agent 环境）

如果项目根目录存在 `.agents-registry` 文件，读取可用 agent 列表，在写入 progress.json 前向用户展示并询问：

```
可用实例：
  main: Kimi, Johnsong
  evaluator: Reviewer

本批次角色分配：
  Generator → ?（默认：当前实例主上下文）
  Evaluator → ?（默认：当前实例的隔离 evaluator subagent）
```

1. 用户指定后写入 `role_assignments`
2. 用户说"默认"或不指定 → 不写入 `role_assignments`，按默认映射（快车道：evaluator = 隔离 subagent）

**校验规则（写入前必须检查）：**
- generator 和 evaluator 不能是同一执行上下文（同一实例 id 下 generator 主上下文 + evaluator 隔离 subagent 视为满足）
- 外部工具类实例（非 Claude Code，如 Codex）只能被分配为 evaluator
- 指定的实例名必须在 `.agents-registry` 中存在

`.agents-registry` 文件不存在 → 跳过此步骤，按默认映射。

### 6. 判断批次类型并更新 progress.json

检查 features.json 中所有功能的 executor 字段：

**存在任意一条 `executor:generator`（普通批次 / 混合批次）：**
```json
{
  "status": "building",
  "user_goal": "用一句话描述用户目标",
  "total_features": 20,
  "completed_features": 0,
  "fix_rounds": 0,
  "current_sprint": null,
  "last_updated": "当前时间",
  "role_assignments": null,
  "docs": {
    "spec": "specs/[批次名称]-spec.md",
    "test_cases": null,
    "signoff": null,
    "framework_reviewed": false
  },
  "evaluator_feedback": null
}
```

**全部为 `executor:evaluator`（Evaluator-only 批次，跳过 building）：**
```json
{
  "status": "verifying",
  ...（其他字段相同）
}
```

### 6.5 确认执行车道与编排方式（v1.0 新增）

status 写入前与用户确认两件事（默认值可直接沿用，不必逐条追问）：

1. **车道选择**：默认快车道（同会话）；命中 harness-rules.md §车道选择规则任一条件（跨机器 role_assignments / 跨多日批次 / 用户要求独立实例验收）→ 慢车道
2. **编排方式**：building 是否并行（独立 feature ≥2 条且文件集不重叠，见 `orchestration-patterns.md` §3）、verifying 是否 fan-out（features ≥4 条，见 §4）。判定结果一句话写入 spec §关键设计决策，让 Generator / Evaluator 开工时无歧义

**plan mode 提示：** planning 阶段的 spec + features.json + 车道选择适合作为 plan 提交用户确认——用户批准即 spec lock。plan 确认不替代 spec 文档落盘。

## 完成标准
- `docs/specs/` 下规格文档已创建（新功能批次硬性要求，Bug 修复可省略）
- features.json 已创建，每条功能均有 `executor` 字段
- progress.json 已更新为 `building` 或 `verifying`（取决于批次类型）

---

## Planner 裁决职责 — Pre-Implementation Audit（2026-04-19 采纳）

来源：KOLMatrix B0 sprint。Generator 在 F005/F010/F007/F006 开工前共提交 4 份 pre-impl 审计 × 25 决策点，Planner 全部裁决后开工，**0 次 building 阶段返工**。

### 规则 P1：收到 pre-impl 审计请求必须优先裁决

Generator 发现规格歧义时按照 `framework/harness/pre-impl-adjudication.md` 格式提交审计文档到 `docs/specs/{batch}-{feature}-*.md`，并在 push commit 中明示 "等 Planner 裁决"。**Planner 看到后必须暂停其他工作优先回复**，延迟会阻塞 sprint。

### 规则 P2：裁决必须完整 + 修订相关文件

裁决时必须：

1. 在同一份审计文档末尾追加 `## N. Planner 裁决` 段
2. 用短格式 `#1:A #2:B ...` 给出每条决议
3. 表格列出每条决定的**具体理由**（可被后续 Planner 复用）
4. 列出"同步修订的文件清单"（spec / features.json / test-cases / README 等）
5. 在 commit message 中声明 Generator 可直接开工，不必再确认

### 规则 P3：修 acceptance 必须扫全文消除矛盾

Planner 修订任何 feature 的 acceptance 段时，**必须用 grep 扫描该 spec 文件内所有相关关键词段落**（实现段 / 验收段 / 引用处），确认无旧口径残留。

**反例（KOLMatrix B0 F007）：** Planner 修订 §F007 Acceptance 段到新口径，忘了同步 §F007 实现段。导致 Reviewer 按旧段判 PARTIAL，Generator 按新段实现 PASS，需要额外一轮仲裁。**错在 Planner。**

### 规则 P4：涉及验收口径的裁决必须同步更新 test-cases

裁决修订 acceptance（特别是验收手段的变化，如从"单文件 grep"到"import 图静态分析"），**必须同步更新 `docs/test-cases/` 对应用例的步骤**，否则 Reviewer 按旧用例验收会误判 fail。

### 规则 P5：裁决理由必须具备复用价值

不接受 "因为 Generator 建议" 之类循环论证。理由应引用：
- 设计系统规范（designMd）
- 多源比对多数派
- 已有 spec 铁律
- 可预见的后续维护成本

这样下一个 Planner 读到裁决才能理解并延续判断原则。

完整 pattern 详见 `framework/harness/pre-impl-adjudication.md`。

### 规则 P5.2：acceptance 边界 vs 全套测试基线（v0.9.16 新增）

来源：BL-052 verifying P5 裁决（2026-05-08）。Reviewer 5/7 partial 报告 grade C / Not ready，失败点 `tests/integration/pre-commit-hook.test.ts` 全套并发抖动（外部网络依赖 Google Fonts woff2 拉取），单文件隔离跑 PASS。Planner johnsong 5/8 00:10 裁决：失败文件来自 BL-027-F004 + BL-025-F009，与 BL-052 范围正交，独立 BL-054 治理；不计入 BL-052 评分。Reviewer 复验仅 BL-052 引入代码 → grade B+ / Ready @ commit `722fc66`。

**核心规律：** Reviewer 报告"全套 `npm run test:integration` 红"时，Planner 裁决前必须先做"**正交性判断**" — acceptance 边界是 spec § acceptance 列表逐项，**不含**"全套测试普遍绿"隐式门槛。

**正交性判断流程（必跑）：**

```bash
# 1. 追溯失败测试文件的引入批次
git log --all --oneline -- <失败测试文件路径>
# 2. 取本批次 commit 集做交集
git log --oneline <building-start>..HEAD -- <失败测试文件路径>
# 3. 步骤 2 输出空 = 范围正交 → 不计入本批次评分
```

**裁决落实模板（4 项同 commit）：**

1. **追加 §Planner 裁决段** 到 `docs/test-reports/<batch>-verifying-YYYY-MM-DD.md`（含 git log 实物追溯证据 + 范围正交结论 + 复验范围重定义）
2. **新建独立 backlog 条目** `BL-XXX-<problem-name>` 治理失败点（priority + 推荐方向 + 工时估算）
3. **更新 `.auto-memory/project-status.md`** 反映新 backlog 立项 + 本批次评分豁免
4. **commit message 明示** "Planner P5.2 裁决：<失败点> 与本批次正交，新建 BL-XXX 治理"

**反面（不适用此规律时）：**

- 拖延 done → 上线时间线收紧（BL-052 案例：buffer 5+ 天可能瞬变 < 1 天）
- Generator 被迫给"不属于本批次的 flaky"写 fix → 跨批次污染 commit history（违反铁律 #10 commit-tag 一致性）
- 隐式假门槛"测试不全绿就是不能 done"与 spec 明文 acceptance 不一致 → 评分系统失活
- Reviewer 反复 fail 评分让"修不好就是不能 done"成为不可见门槛，掩盖真实 framework reliability 缺陷

**适用场景边界：**

| 情形 | 是否适用 P5.2 |
|---|---|
| 失败测试文件来自历史批次 + 本批次零修改 | ✅ 适用（范围正交，建独立 backlog） |
| 失败测试文件本批次新增 / 修改 | ❌ 不适用（属于本批次范围，必须 fix） |
| 失败由本批次代码改动引发的 regression | ❌ 不适用（即使测试文件来自历史，行为变更归本批次） |
| 失败属于 setupFiles / 全局 mock / fixture 通用基础设施 + 影响所有批次 | ✅ 适用（应建独立 framework 治理批次，参 v0.9.15 #2） |

**实物范例（BL-052 5/8 00:10）：** `tests/integration/pre-commit-hook.test.ts` 引入自 BL-027-F004（commit `2c8af8a`），依赖脚本 `scripts/regenerate-material-symbols-subset.sh` 引入自 BL-025-F009 / BIx-mvp-polish-pass。BL-052 13 commits（`c4afd5a..3ba3fe2`）零修改这两文件 → 范围正交 → 建 BL-054-flaky-network-test-isolate（medium，~2-4h Generator + 0.5h Reviewer）→ Reviewer 复验仅 BL-052 引入代码 → grade B+ / Ready @ commit `722fc66`（5/8 01:07）。

### 规则 P5.3：verifying gate 失败时优先 trace 真因而非直接 ack fix（v0.9.22 #13）

**与 P5 / P5.2 关系：** P5 强调"裁决理由复用"，P5.2 强调"范围正交"，P5.3 强调"故障类型分类"。三者形成 verifying gate 失败时的完整裁决方法论。

**核心规则：** Reviewer 报 verifying 失败时（特别 LLM-related batch），Planner 必须先做"**故障类型分类**" — 是 implementation-gap 还是 LLM-behavior？

| 故障类型 | 特征 | Planner 裁决 |
|---|---|---|
| **A. implementation-gap**（如 redirect 302 vs 301 / 缺 chaos flag）| Generator 实装与 spec 字面有差距 | 直接 ack Generator 修代码，预估 1 fix-round 通过 |
| **B. LLM-behavior**（如 prompt 输出 dup / 凑足 N）| LLM 实际输出与 prompt 预期不一致 | **必先要求 trace 真因**（MCP `get_log_detail` 抓 5-10 failed call）+ 推估 2-3 fix-round 通过 |

**反例（BL-068 fix-round 2 浪费）：** Reviewer 报"prompt 解析失败"时 Planner 没 trace 真因即直接 ack Generator 调 prompt（凭 "LLM 应该幻觉新 ID" 假设）→ prompt v2 收敛 drift 但 B6 仍不通过 → fix-round 3 才 MCP trace 抓出 dup-not-hallucination 真因 → 浪费 fix-round 2 + 用户体验延迟 1 天。

**verifying gate 设计盲点：** Reviewer 的 gate criterion 通常只看 success rate（如 80% PASS），不看 failure mode。Planner 必须主动要求 Reviewer trace 失败 mode（特别 LLM-batch）。

**应用清单（Planner 收到 Reviewer verifying 失败报告时）：**
- [ ] 故障是否 LLM-behavior 类？（输出 shape / format / 数量 / 重复 等）
- [ ] 如是，要求 Reviewer 立即 trace 5-10 failed call（MCP get_log_detail）
- [ ] 看真实输出 vs 预期 → 找 pattern（dup / drift / missing）
- [ ] 然后才 ack Generator 修 prompt + server fallback（dedupe-then-validate / 自检 §）

**配套 Generator 端：** LLM fix-round 必先 MCP trace 抓真因（详见 `framework/patterns/ai-action-contract.md §「LLM fix-round 必先 MCP trace 抓真因」`）。

来源：BL-068 fix-round 2 浪费实战 + v0.9.22 #13（用户 2026-05-17 ack）。

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
| **多角色并行 + Planner ops commit 前必 grep staged 索引（v0.9.26 #1 — 铁律 #12 强化）** | **开 session 第一动作 + 每次 Planner ops commit 前必跑 `git status --short` 看左列 staged 池，确认哪些 `M`/`A` 是别人 WIP；commit 前再 `git diff --cached --name-only` 确认仅含本 commit 文件。`git commit` 提交 staged 索引**全部**内容，无视之前 `git add <pathspec>` 限制 (BL-083 案例：fork .env ops 后 Planner 只看自己 add 的 1 文件就 commit，把 Generator/Evaluator 在制 5 文件一并打包推 main commit 97339c6 → 违反铁律 #10)** |

**反面案例（v0.9.11 新增类）：** BL-020 F001 spec 起草时假设 `productId` 是 UUID（沿袭 audit §3 CR-1 文字描述），未 grep `schema.prisma` → Generator pre-impl audit 反向纠错指出 `Product.id` 实为 `@default(cuid())`，套 UUID_RE 会破 4 调用方 + 5 既有 fixture（25-char CUID）测试全红。Planner 短格式裁决 #1:A 修订全文 + 修订 acceptance regex 为 `/^c[a-z0-9]{24,}$/i`。本可在 spec lock 前 grep schema.prisma 1 次避免。

**反面案例（v0.9.14 新增类）— audit/spec 起草前漏 grep 实战双案例：**

1. **BL-041 audit 过期（2026-05-04 → 2026-05-06 发现）：** `prod-mvp-readiness-audit-2026-05-04.md §5 D2` 写「Dashboard 缺 PRD §4.1 三元素（工作流 6 步图 / CPI 对比卡 / 30D ROI 趋势图）」，但 grep `dashboard/page.tsx` 即可发现 line 79+88+89 已 import + 渲染 `WorkflowSteps` + `CompetitorCpiCard` + `DashboardRoiTrendCard` — `MVP-internal-demo-prep-F001` (commit `4fd778b @ 2026-05-01`) 早已实装齐全（recharts + 5 locale i18n + visual baseline 全齐）。Audit 起草人 Planner Kimi 漏 grep 实物状态 → BL-041 在 backlog 错挂 3 天 + Planner johnsong 在 BL-040 planning 阶段才 5sec grep 发现 → 直接 retroactive 关闭。本可在 audit 起草时 5sec grep 避免。

2. **BL-040 spec scope 漏 grep（2026-05-06）：** spec §F001 acceptance 列「删 `generateAiAssets.ts:175 ?? 'Not specified'` fallback」一处，但 Generator Kimi 开工前 grep 实物发现 `src/lib/assets/generators/email-generator.ts:74` + `src/lib/assets/generators/video-script-generator.ts:80` 同样含 `?? 'Not specified'` 模式（BL-025-F003 / BL-030 后实装）— D5 同根理由（LLM 缺 audience context）但 spec 未列。Generator 按铁律 #10 没越界，留 Planner judgement → 入 backlog deferred 跟踪。本可在 Planner spec 起草时 `grep -rn "?? 'Not specified'" src/` 5sec 一次性命中所有 3 处避免。

两案例同根问题：**audit/spec 涉及"完整模式 X 全仓未/已实装"类断言时，必须先 grep 全仓而非依赖记忆 / 文档字面 / 单文件假设。** v0.9.13 §5.1「spec 改 deploy-script 时同 commit 必须改对应 yml」也是同根问题（spec 注释明示但实装漏 = 未核查实物状态）。

**反面案例（v0.9.15 新增类）— 测试断言跨环境复现盲区（BL-047 撤再翻盘 + BL-049 audit 沉淀）：**

BL-047 backlog 条目报「`AiSuggestionsClient` localStorage stub 跨环境失败导致 `npm test` 1043/1043 → 1042/1043 fail」。Planner johnsong 5/7 10:30 起草 backlog 时未实地复现，仅基于 reviewer 简述写"无法证伪先建条目"。Generator Kimi 5/7 10:30 开工前在 WSL2 forks pool 跑 `npx vitest run AiSuggestionsClient.test.ts`：1043/1043 PASS — 误判 backlog premise 错误，撤条目。5/7 11:51 Codex Reviewer 在 BL-021 reverifying 阶段实际跑测试，**真复现** `TypeError: Cannot read properties of undefined (reading 'getItem')`。两侧 vitest pool 配置差异（forks vs threads / setup 时序）导致 stub 在 reviewer 环境下未及时初始化。Generator 5/7 13:00 fix-round 1 (`commit 9fa2a49`) 实装 Map-backed 自实装 stub，PASS @ Codex reverifying da94b73。

**两条新规分别防的是：**

1. **(v0.9.15 #1) 跨环境复现：** 任何"测试 fail / PASS / 覆盖"断言必须**多 pool 实地跑** + 至少模拟 reviewer 环境配置，不能只跑自己默认 pool。
2. **(v0.9.15 #2) Stub environment-agnostic：** stub 设计阶段就要假定"任意 pool / 任意启动顺序" — 用 Map-backed 自实装数据结构消除 jsdom / Node 全局 init 时机依赖。`commit 9fa2a49` 是 Map-backed localStorage stub 的范式实装，可作模板。

**反面案例（v0.9.17 新增类）— 记忆条目陈旧风险（BL-012 5/7→5/8 实战）：**

Planner Kimi 5/7 在 `.auto-memory/project-status.md:16` 记录「爬虫团队 5/7 提前交付 fork audit 推荐方案 A 分平台分源 IG/TT 给 apify YouTube 给 B6」（3 平台分流口径）。但同期 5/7 16:57 fork 实物 `guang-tech/apify` 已完成 **Apify → TikHub 全迁移** + 新增 **X(Twitter)** 平台 = **4 平台齐全**（5/7 docs/specs/2026-05-07-tikhub-migration-design.md 16KB 设计文档已落）。Planner johnsong 5/8 启动 BL-012 planning 时若信任 project-status:16 记忆字面起 spec → 会按 3 平台 IG/TT/YT-via-apify 设计字段映射 → Generator 实装时撞 fork 实物 X 平台不在覆盖中 + fork 已不用 Apify 而用 TikHub → spec 漂移 / 1+ 轮 fix-round / 上线 buffer 浪费。

实地补 audit（`gh api repos/guang-tech/apify` 抓 README + .env.example + docs/specs/2026-05-07-tikhub-migration-design.md）才发现实物 5/7 重大变化。audit 输出 `docs/reviews/apify-fork-audit-2026-05-08.md`（462 行）+ 用户决议 5 项 + 修订 BL-012 spec 起草口径。**根因：** v0.9.14 铁律 1 已覆盖 spec / audit / readiness-report 起草前 grep 实物状态，但**对项目 `.auto-memory/` 内涉及外部协作方的记忆条目仍存在盲区** — Planner 默认信任记忆 = 信任前一轮写入的快照，但外部协作方 / 第三方仓库可能在记忆写入后被独立更新。

**(v0.9.17) 记忆条目陈旧风险：** Planner Step 0 启动新批次前，对 `.auto-memory/project-status.md` / `session_notes` 涉及外部协作方 / 第三方仓库 / 跨项目状态的条目（含 "X 团队已交付 / 已部署 / 已审过 / 已上线"类断言），**必须先 `gh api` / `git log --all` / `curl health` 实物核查**当前状态 + 看时间戳是否后于记忆写入时间；时间戳 ≥3 天的"提前交付"类条目尤其必查 — 3 天足以让协作方完成大改动而记忆未同步。

**规格引用实际代码时必须：**
- 用 ` ```sql ` / ` ```ts ` 等代码块贴真实片段
- 标注 `file:line` 来源（例：`migration.sql:40-80`）

**Generator 发现规格偏差时**：开工前提出"规格偏差报告"暂停；Planner 修订 spec 后再开工。此为双方义务。

### 铁律 2：Code Review 报告的事实性断言按"线索"处理，不按"真相"采信

**符号/类型/约束/枚举/常量**类断言**必须双路交叉验证**：

1. `grep` / `Read` 找到所有 INSERT/CREATE/UPDATE/写入点 → 源码约定
2. `ssh prod-db` 采样现网数据 → 实际数据
3. 两路一致后再写入 spec

**规格中引用 Code Review 发现时必须标注**：
- `[已核实 source:文件:行 + prod-data]` — 可直接使用
- `[待核实]` — 不得作为 acceptance 阻断条件，Generator 开工前必须澄清

### 结果

- 规格质量从"转述 Review 报告"提升到"与现网代码/数据一致"
- Generator 开工前规格偏差检查成为常态（节省 fix round）
- 重复上次错误将承担召回责任（hotfix / 新修正批次）

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

### 铁律 6：跨角色 ops 必须用户书面授权 + session_notes 记账（v0.9.9 — BL-031 沉淀）

Reviewer / Generator 任一方在批次中执行**不属于本角色域的写操作**（如 Reviewer 跑 SQL ops / Generator 写 signoff / Planner 改产品代码）时，**必须满足 3 项**：

1. **用户书面授权：** 对话中明确"破例授权 X 代办 Y"或同等措辞，不能依据隐式默认
2. **session_notes 记账：** 当事 agent 在 progress.json `session_notes` 自己条目中明文记录"用户授权 X 在 Y 阶段代办 Z 操作"+ 时间戳 + 操作摘要
3. **角色身份不变：** 越界 ops 仅本批次本步骤生效，不视为角色切换；当事 agent 仍按原角色后续操作

**反面：** 越界 ops 后忘记 session_notes 记账 → 后续 Planner / 接手 agent 误以为有 process bug，浪费排查时间。

**来源：** BL-031 verifying 阶段 staging 1 行 orphan asset 待镜像 email_template，用户「C1b 破例授权代办 Planner ops」让 Reviewer (CLI as Codex) 跑 SQL 镜像。Reviewer session_notes 记账规范 → Planner done 阶段读到无歧义。同期 BL-031 用户授权 CLI agent 临时担任 Reviewer 角色（项目方向 B 限制 Codex 仅当 evaluator）也属此模式。

### 铁律 7：角色文件多副本一致性（v0.9.9 — BL-032 Generator 角色冲突沉淀）

项目同时存在多份 Generator/Evaluator/Planner 角色定义文件时（如项目根 `./generator.md` + `.auto-memory/role-context/generator.md` + `framework/harness/generator.md` 三份），**Planner 修订任一角色文件时必须 grep 全部副本同 commit 一致更新**。否则 Generator 严格按字面执行会撞硬冲突卡死。

```bash
# 修订 Generator 角色前必跑
find . -name 'generator.md' -not -path '*/node_modules/*' -not -path '*/.git/*'
# 三份同步措辞，差异仅限"项目特定"vs"框架通用"维度
```

**反面：** BL-032 building 启动 Generator johnsong 识别 `./generator.md` line 10「不写任何测试」与 `.auto-memory/role-context/generator.md`「测试代码由 Generator 提供脚本/调用」直接冲突 → 停工等仲裁，多 1 轮往返。Planner 仲裁后两份同时矩阵化。

**来源：** BL-032 角色冲突 + 历史角色文件演进不同步多次（v0.9.6 时已有 evaluator.md 三份不同步事故）。

---

### 铁律 8：spec 引用外部模型/服务做 E2E acceptance 前必须验证其真实可用（v0.9.21 — aigcgateway BL-IMG-PERSIST-GCS 沉淀）

acceptance 引用**具体外部模型 / 第三方服务**做 E2E（如"用 seedream-3 生成图 → 200"、"调 provider X 的 endpoint → 断言"）时，Planner 必须先确认该模型/服务在目标环境**真实可用**——不只是本地配置项 `enabled`，还要：

- 上游接入配置正确（如火山引擎调用须 `realModelId=ep-xxx` endpoint ID，填模型名恒 404）
- 不在下线 / deprecated 名单
- 必要时实测一次（或要求 Generator 实测）返回真实结果后才写入 acceptance

否则该外部断言不进 acceptance，或提供 fallback 模型 / 服务。这是 [铁律 4「写路由前 grep 实物」] 向"外部模型 / 服务运行时可用性"维度的扩展——本地存在 ≠ 运行时可用。

```bash
# 写外部模型 E2E acceptance 前
# 1) 确认 alias/channel enabled 且 realModelId 是正确形态（火山：ep- 前缀）
# 2) 确认不在下线名单（grep deprecated / 运维记忆）
# 3) 高风险时实测：curl 生产 /v1/models 含该模型 + 生成一次
```

**反面：** aigcgateway BL-IMG-PERSIST-GCS fix_round2 — spec acceptance 要求 `seedream-3`（http 上游）E2E 200，但该 channel `realModelId` 仍是模型名 `seedream-3.0`（非 ep-ID，火山恒 404）且本就在下线名单 → 验收无法满足 → 多一轮 fix_round 才放宽并改下线。

**来源：** aigcgateway BL-IMG-PERSIST-GCS fix_round2（seedream-3 不可用导致验收返工）。

### 铁律 9：spec 断言某值"写入 DB / 流向下游"前必须追踪实际写入路径（v0.9.23 — aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK 沉淀）

acceptance / 设计决策断言「某字段/值会落到 DB 某列」或「会流向下游某处」时（如"适配器返回的 name 会成为 `models.name`"、"上游 X 字段会写入 Y"），Planner 必须**追踪该值从产生到落点的完整写入链**，确认中间层不会丢弃 / 覆写 / 重算它——不能假设「上游/适配器返回什么，DB 就存什么」。

- grep **落点列**（如 `models.name` 的所有赋值处）反查真实来源，而非从"值的产生处"正向假设它一路透传
- 特别警惕 **canonical / reconcile / normalize / transform 类中间层**：它们常按自己的规则重算落点值，丢弃上游携带的字段
- 高风险时要求 Generator 实测一次（写库后查 DB 实际值），而非只验证"函数返回了正确的值"

这是 [铁律 1「核查源码」] 向**数据流终点**维度的扩展——"代码返回了正确的值" ≠ "该值落到了断言的位置"。

```bash
# 写"X 会成为 DB 列 Y 的值"类 acceptance 前
grep -rn "<Y列名>:" src/          # 反查 Y 的所有赋值处，确认真实来源
# 若赋值来自 transform/canonical/reconcile 函数 → 读该函数确认是否保留 X
```

**反面：** aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK 首轮 FAIL — spec D2 断言通用适配器返回的 `SyncedModel.name`（带 `provider/` 前缀）会成为 `models.name`，但 `reconcile()` 的 `resolveCanonicalName(modelId)` 直接返回裸 `modelId.toLowerCase()`、**丢弃了适配器的 name**（M1a 迁移后所有 provider 都存裸 id）→ 前缀从未落库 → 多一轮 fix_round 才把命名逻辑改到真正的落点 `resolveCanonicalName`。

**来源：** aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK fix-round-1（canonical 命名前缀未落库）。

---

## status = "done" 时的收尾流程

当 Evaluator 将 progress.json 置为 `done` 后，Planner（主上下文）接手执行以下步骤（**必须按顺序**）：

### 1. 校验并整合 project-status.md
读取 `.auto-memory/project-status.md`，检查 Generator 和 Evaluator 在过程中写入的内容是否准确完整：
- 当前批次状态是否反映 done
- 遗留问题是否有新增或解决
- 如有不一致，**覆盖写**为最终一致的版本（≤30 行）

**注意：** 不再从头重写，Generator/Evaluator 已在过程中各自更新。Planner 只做最终校验和整合。

### 2. 处理 proposed-learnings（如有）
读取 `framework/proposed-learnings.md`，逐条提交用户确认，确认后写入对应 framework 文件。

### 3. 清除 role_assignments
如果 progress.json 中存在 `role_assignments`，将其设为 `null`。角色分配仅对当前批次有效，下一批次重新分配。

### 4. 询问下一批次
记忆更新完成后，告知用户本批次已归档，询问是否开始下一批次。

---

## 阶段转换 + fix_rounds 计数语义（D12，BL-071 lock）

**fix_rounds 的定义：** `verifying → fixing → reverifying` 的循环次数，**不是**任意 fix commit 数。

**语义边界（按状态机入口计数）：**

| 状态机事件 | fix_rounds 动作 |
|---|---|
| `verifying`（首轮）查出问题 → 切 `fixing` | 不计（仍是 first attempt） |
| `fixing` 完成 → 切 `reverifying` | **fix_rounds += 1** |
| `reverifying` 查出问题 → 切回 `fixing` | 不计（已计在上一轮 reverifying 入口） |
| `reverifying` 全 PASS → 切 `done` | 不计（终态） |
| building 阶段 Generator 自测发现 bug → 同 commit 修 | 不计（building 内部 self-fix 不算 fix-round） |
| Generator 在 fixing 阶段为同一 PARTIAL feature push 多次 commit | 不计为多轮（同一 reverifying 入口前的多 commit 合计为 1 fix_round） |

**反例（BL-070 BL-071 lock 前历史不一致）：** BL-070 fix_rounds=4 真实含义是「4 次 reverifying 入口」，但 commit 历史含 4 reverifying + 1 verifying 的 6+ fix commit；如果按 commit 数统计会得 6，按 reverifying 入口统计得 4。**fix_rounds=4 才是正确计数**。

**为什么不按 commit 数：**
- commit 数与 reviewer 工作量不成正比（同一轮内 5 commit 还是 1 commit，reviewer 都重新跑一遍 L1+L2）
- 大型 PARTIAL 修复可能拆 N commit 但只走 1 次 reverifying，按 commit 数会高估
- 小型 commit 高估倾向让 Planner 在 done 阶段误判批次质量

**latent bug exposure 标注（v0.9.21 BL-065 沉淀）：**
fix_rounds 不直接反映本批次质量。大体量 page consolidation / IA refactor / route migration 类批次会暴露上游 latent bug（路由从未渲染 → 真实渲染暴露 latent FORMATTING_ERROR / cross-tenant query / dead import 等）。这类 fix-round 应在 signoff 中标注「latent bug exposed by F00X route migration」与本批次新引入 bug 区分。未来按二维统计：(introduced, latent) 而不仅 fix_rounds 单维。

**fix-round 类型分类（v0.9.23 #16，BL-068 vs BL-069 对比沉淀）：**

| 类型 | 特征 | 预估 fix-rounds | 实证 |
|---|---|---|---|
| **A. implementation-gap fix-round** | Generator 实装与 spec 字面有差距（302 vs 301 / 缺 chaos flag）| 1 轮通过 | BL-069 fix_rounds=1（B1 redirect status + B2 chaos flag）|
| **B. LLM-behavior fix-round** | LLM 实际输出与 prompt 预期不一致（凑足 N / 重复 ID）| 2-3 轮收敛 | BL-068 fix_rounds=3（B1-B4 client + B5-B6 prompt 真因 trace） |

**预期 fix_rounds 数公式：** `预期 fix_rounds = 1 + N(B 类 blockers)`

**应用：** Planner 在 batch 计划起草时按 LLM 类批次 vs 静态实装类批次区分预期 fix_rounds 数，影响排期 + 用户期望管理。配套 Reviewer 报失败时按类型分类裁决（详见本文件 §规则 P5.3「verifying gate 失败时优先 trace 真因」）。

来源：BL-068 vs BL-069 fix-rounds 数量差实证 + v0.9.23 #16（用户 2026-05-18 ack）。

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
   # 例：验证三卡名
   grep -rE 'AI Intelligence|Market Intel|Coverage Gap|Campaign Timing' src/features/database/
   ```
2. 描述与代码不一致 → 立刻在 checklist 写实际命名（不要写 spec 文本）
3. 元素增删（spec 列 N 个但代码 N+1）→ 在 checklist 注「实际有 N+1 个，验证 N 个核心，多出的不算 FAIL」

**Generator 配套防御（建议）：** PR description 写「本批次 UI 改动元素列表：X / Y / Z（代码实际命名）」，Planner 起草 checklist 时直接复用。

来源：MVP-internal-demo-prep fixing-1。配套见 `evaluator.md` §11「Smoke checklist 文本陈旧时直接 update 而非标 FAIL」。

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
- [ ] tests/unit/i18n-page-side-consumption.test.ts v2（v0.9.24 #7）advisory test 全绿 — 详 `framework/patterns/testing-env-patterns.md`（advisory test 三件套）
- 工具：`grep -rln 'useTranslations\|getTranslations' src/app/[locale]/(app)/<route>/`

#### 维度 3：Material Symbols 子集 manifest 同步
- [ ] grep `material-symbols-outlined` 全 src — 验所有 ligature in manifest + woff2 含 glyph
- [ ] tests/unit/material-symbols-coverage-unit.test.ts strict（STRICT_MS_ICONS=true）CI 必绿
- 工具：`bash scripts/regenerate-material-symbols-subset.sh` 后 manifest 增量 diff

#### 维度 4：outbound 链接命中实际路由树
- [ ] grep 所有 `href="/<path>"` + `router.push("/<path>")` — 验 path-prefix in 路由树 + IA_REDIRECT_RULES
- [ ] tests/unit/link-target-audit.test.ts advisory test 全绿（详 `framework/patterns/testing-env-patterns.md`（advisory test 三件套））
- 工具：`grep -rEn "['\"]/(<deleted-route>)" src/ --include='*.tsx' --include='*.ts'` + `router.push` 同源 grep
- 配套：`framework/patterns/web-runtime-patterns.md（大型删除/重构批次执行模板，删 X 前 grep callers 矩阵）`
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

来源：BIx F005 + framework CHANGELOG v0.9.6 [#2]。

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
| **Server component**（async server fn，无 client JS 贡献）| Suspense + skeleton 镜像（详 `framework/patterns/web-runtime-patterns.md` Suspense fallback 规范段）| "Y 组件 Suspense boundary（fallback skeleton 同 outer 高度 + 宽度，CLS reservation）" |
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

---

## UI 类 spec 起草前 mandatory self-check checklist

**背景：** `framework/patterns/ui-fidelity-guardrail.md` §2 已规定所有 UI 类 feature spec 必须含 4 段（§2.1 原型路径 + §2.2 必用公共组件清单 + §2.3 不得简化清单 + §2.4 visual baseline 硬要求）。但 BL-025 Planner 起草 spec 时**漏写 3/4**（仅 §2.1），靠用户主动 challenge "新页面会严格按框架还原 + 抽公共组件 + 不手写吗?" 才补全。规范存在但自审缺失 = 实际等于无规范。

**Planner 起草 UI 类 spec 自审 checklist（spec lock 前必跑）：**

- [ ] §2.1 列了 Stitch HTML 原型路径（`design-draft/.../*.html`，不是 PNG）
- [ ] §2.2 列了必用公共组件清单（`@/components/common/*` 全部相关组件 + 5 禁止行为）
- [ ] §2.3 列了「不得简化的 N 元素」+「不得新增的 M 元素」（数字明确，逐元素列）
- [ ] §2.4 列了 visual baseline 硬要求（具体几个 PNG + L2 浏览器并排路径）
- [ ] 4 段缺任一 → spec **不能交付**给 Generator，必须补全

**机器化（推荐）：** Planner 在 spec lock 前跑（建议未来加 pre-commit hook 自动跑）：

```bash
# 检查 UI feature spec 是否含全 4 段
spec=docs/specs/<batch>-spec.md
for section in "原型参考" "必用公共组件清单" "不得简化" "visual baseline"; do
  grep -q "$section" "$spec" || echo "MISSING: $section"
done
```

**反面案例：** BL-025 spec drafted-complete v1 仅写"参考 design-draft/BL-025-asset-library/variant-a-296k/"，§2.2/2.3/2.4 全缺。用户 challenge → Planner 加 §F004.A/B/C 三段（19 不得简化 + 4 不得新增 + 3 新公共组件 + visual baseline 4 个）→ 才进 building。如无 challenge，Generator 会以"自由发挥"模式做，Reviewer L1 grep 反范式时大批量 FAIL。

来源：BL-025 spec drafting + framework CHANGELOG v0.9.6 [#5]。配套见 `ui-fidelity-guardrail.md` §2 顶部强制声明。

---

## Visual polish 类 spec 起草：Reference URL 提炼方法论（BL-078 #4 / BL-078 plan v2）

**触发场景：** Visual polish / landing 视觉重做 / brand identity 类批次 spec 起草，需要参考外部产品（如 Linear / Vercel / Stripe / Plausible / Notion）作为视觉 reference。**仅 visual polish 类必走；非视觉 batch（feature / hotfix / sediment）不强制。**

**核心原则：** Reference URL 是"**精神参考**"而非"**像素复刻**"。源产品定位（B2B SaaS / consumer / dev tools）与本项目可能不同，1:1 复刻 css 可能破坏本项目 brand identity（如 KOLMatrix cyan/purple/navy 调色板）。Planner spec 必须把 reference 落到 **token layer 抽象**（与 `framework/patterns/ui-fidelity-guardrail.md §3.4 landing visual token layer 规范` 配套，BL-078 #2）而非 reference css 直 copy。

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

筛选后的信号落到 `framework/patterns/ui-fidelity-guardrail.md §3.4` 描述的 4 类 token（typography / color / spacing / motion），不直接 inline reference 网站的 CSS 值。

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
- `framework/patterns/ui-fidelity-guardrail.md §3.4` landing visual token layer 规范（BL-078 #2 — 落地 4 类 token 类别）
- `framework/patterns/ui-fidelity-guardrail.md` 现代 CSS 渐进增强三层守门段（BL-078 #3 — Native API + Fallback + reduced-motion 三层守门）
- `framework/patterns/testing-env-patterns.md` motion a11y 三件套验收（BL-078 #1 + #5 — 视觉精修 a11y 验收）

来源：BL-078 plan v2 D2 lock + 用户 2026-05-27 ack（"Linear 主 + Plausible 辅" 实战印证 reference 精神落地非像素复刻范式）。

---

## i18n 命名空间扩展类 spec 起草必含双门检查（v0.9.10 — BL-033 沉淀）

**适用场景：** 批次涉及**新增 messages/{locale}.json 命名空间**或**已有命名空间扩展 ≥ 5 个 keys**。

**spec 必含 §"D-i18n: i18n 命名空间扩展计划" 段** — 详见 `framework/patterns/i18n-namespace-add-checklist.md`。核心两条：

1. **i18n CI locale-coverage 守门 — 行业词 allowlist：** 命名空间含英文行业惯用词（KOL / AI / CPI / ROI 等）的 path 必须列入 spec，Generator 同 commit 修订 CI 守门 `KEEP_AS_EN_PATHS`
2. **i18n CI placeholders 守门 — ICU plural shape parity：** 含 `{count, plural, ...}` 的 keys 在 spec §schema 段标注 "ICU plural shape required in all 5 languages"，CJK 语言用 `{count, plural, one {...} other {...}}` 包裹（同文本但形状必填）

**反面：** BL-033-F004 spec §D4 列 schema 但未提示双门 → Generator 实装首推 CI 25321942649 红 → 加 commit e2c1832 修。本可在 spec lock 前预防。

来源：BL-033 Reviewer signoff §Framework Learnings + Generator session_notes 提案。

---

## 上线前 audit 触发条件（v0.9.10 — KOLMatrix prod-mvp-readiness-audit-2026-05-04 沉淀）

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

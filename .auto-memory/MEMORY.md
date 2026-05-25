# Memory Index

## T0 — 每次启动必读
- [项目状态快照](project-status.md) — 当前批次、计划、决策、遗留问题（覆盖写，≤30 行）
- [环境信息](environment.md) — 生产/Staging 地址、服务器配置、测试账号

## T1 — 按当前角色加载
- [Generator 行为规范](role-context/generator.md) — 编码约定、设计稿还原、回归测试沉淀 | 加载：角色为 Generator 时
- [Evaluator 行为规范](role-context/evaluator.md) — 测试分层 L1/L2、UI 验收、签收报告 | 加载：角色为 Evaluator 时
- [Planner 行为规范](role-context/planner.md) — 需求处理、角色分配、done 收尾、框架维护 | 加载：角色为 Planner 时

## T2 — 触发条件命中时加载
- [用户角色与工作方式](user-role.md) — 用户身份、技术背景、沟通偏好 | 加载：需要调整沟通风格时
- [文档结构与查阅入口](reference-docs.md) — docs/ 各子目录用途 | 加载：需要查找文档时
- [Pre-Impl Audit → Planner 裁决 模式](../framework/harness/pre-impl-adjudication.md) — Generator 开工前审计 + Planner 裁决完整流程 | 加载：Generator 准备开工遇歧义时，或 Planner 收到审计请求时
- [UI Fidelity Guardrail](../framework/harness/ui-fidelity-guardrail.md) — UI 页面 spec 硬要求 + Generator 审计强制 + Evaluator 签收硬条款 + 不得幽灵控件 | 加载：UI 页面 feature 起草/开工/签收时（2026-04-24 BM1 审计后沉淀）
- [架构决策记录索引](../docs/adr/README.md) — 9+ 关键决策的历史与理由（技术栈 / 视觉标准 / 组件库 / RLS / 验收模式 / AI 网关集成 等）| 加载：做新架构决策前核对一致性 / 新 agent 上手了解背景 / 规格冲突时查源
- [Planner 工作流（拆分后）](../framework/harness/planner-workflow.md) — 启动 / 阶段流转 / done 收尾 / fix_rounds 计数语义 + 类型分类 A vs B / 5a+5b 会话结束 + session_notes 写作 + commit message 格式 | 加载：BL-071 F003 D4 拆分后 Planner 角色加载入口（与 planner.md 索引页配合）
- [Planner 裁决与越界界定](../framework/harness/planner-arbitration.md) — Pre-impl P1-P5 + P5.2 范围正交 + P5.3 verifying trace + Code Review 线索 + 跨角色 ops + 角色文件一致性 + Generator 越界界定矩阵 | 加载：Planner 收 pre-impl audit 请求时、verifying 失败裁决时、判断 Generator 越界时
- [Planner 铁律与 Spec 起草 Checklist](../framework/harness/planner-checklists.md) — 7 铁律矩阵 v0.9.11-v0.9.21 + spec 起草 checklist 集合（数据准备 / verifying 前 grep / perf 量化门槛 + client/server 分类 / UI 自检 / i18n / 上线 audit / Server Action rate-limit）| 加载：起草 spec 时 / spec lock 前自检时
- [Generator 长版规范](../framework/harness/generator.md) — 含 v0.9.22 + v0.9.23 inline-merge 13 段新沉淀：§11-F UUID guard / §11-G notFound HTTP / §11-H i18n ns caller-grep / §11-I lazy fidelity / §12 audit + LLM 工具链 / §13 InMemoryJobQueue / §14 use server + ROLLBACK / §15 Perf + Suspense skeleton | 加载：Generator 任务命中以下任一触发条件时 — 删显式子路由 / 写"路由废弃 404" e2e / 删 i18n deprecated namespace / 引入 lazy boundary / 起草 audit script / 排查 LLM 输出 / 写后台任务 / 加 'use server' 文件 / 用 next/image 或 Suspense fallback（短摘要 §"v0.9.22 + v0.9.23 长版索引"列出完整触发表）
- [Evaluator 长版规范](../framework/harness/evaluator.md) — §11 含 staging chaos flag + runbook（BL-069 #15）+ §13 测试设计：13.1 量化 criterion / 13.2 mock 不可用三件套合并 / 13.3 staging chaos flag | 加载：verifying / fixing 用例设计涉及 staging chaos / mock 不可用 / 量化 criterion 时
- [AI Action Contract](../framework/harness/ai-action-contract.md) — §3.4 dedupe-then-validate + §3.5 prompt 自检 § + §5 SDK 抽象层（aigcgateway 集成）| 加载：写 AI 集成代码 / 设计 prompt / Action 改动 / max_tokens 不绑定细节排查时
- [Deploy Patterns](../framework/harness/deploy-patterns.md) — staging deploy + PM2 reload + Turbopack BUILD_ID + GitHub Actions[bot] workflow_dispatch + git pull 前置 + 5 处密码 sync 协议 | 加载：staging deploy / CI 配置 / migration 落地 / bot commit cascade 调试时
- [Database Patterns](../framework/harness/database-patterns.md) — RLS NULLIF + kolmatrix_app role + Prisma migration 工程化 | 加载：schema 变更 / RLS 设计 / 数据库性能问题排查时
- [Material Symbols Pattern](../framework/harness/checklists/material-symbols-pattern.md) — subset 字体子集 + manifest 维护 + JSX 三元约束（BL-071 D10 移子目录后位置）| 加载：加 material-symbols-outlined icon / 改 manifest / 排查"字面 ligature 文字"现象时
- [i18n Namespace Add Checklist](../framework/harness/checklists/i18n-namespace-add-checklist.md) — 5 locale 同步 + KEEP_AS_EN_PATHS allowlist + brand kept-en 策略（BL-071 D10 移子目录后位置）| 加载：添加新 i18n namespace / 改 messages/*.json 结构 / 决定 brand 词是否保英文时

<!-- 2026-05-25 v0.9.23 同步：planner.md 拆 3 文件后入口分支 — 与 planner.md 索引页 一并使用，按当前任务类型选择具体子文件加载 -->
<!-- 2026-05-26 BL-071 retroactive memory-layer 闭环：补 7 个 framework/harness/ 长版 T2 entry（generator/evaluator 长版 + ai-action-contract + deploy-patterns + database-patterns + 2 checklists），同步 generator.md/evaluator.md 短摘要末尾「长版索引」段 + harness-rules.md §第三步路径明示 — 修 BL-071 F003/F004/F008 acceptance scope gap（短摘要未同步 v0.9.22 + v0.9.23 13 段新沉淀） -->

<!-- 后续可按需追加 feedback-*.md / reference-*.md 条目 -->
<!-- 格式：- [标题](文件名) — 一行描述 | 加载：触发条件 -->

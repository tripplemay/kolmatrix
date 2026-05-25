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

<!-- 2026-05-25 v0.9.23 同步：planner.md 拆 3 文件后入口分支 — 与 planner.md 索引页 一并使用，按当前任务类型选择具体子文件加载 -->

<!-- 后续可按需追加 feedback-*.md / reference-*.md 条目 -->
<!-- 格式：- [标题](文件名) — 一行描述 | 加载：触发条件 -->

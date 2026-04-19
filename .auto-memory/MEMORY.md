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
- [架构决策记录索引](../docs/adr/README.md) — 8+ 关键决策的历史与理由（技术栈 / 视觉标准 / 组件库 / RLS / 验收模式 等）| 加载：做新架构决策前核对一致性 / 新 agent 上手了解背景 / 规格冲突时查源

<!-- 后续可按需追加 feedback-*.md / reference-*.md 条目 -->
<!-- 格式：- [标题](文件名) — 一行描述 | 加载：触发条件 -->

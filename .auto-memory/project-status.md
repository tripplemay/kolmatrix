---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-i18n-full-locale** — status=reverifying（2026-04-27 fix-round 1 完成）
- 进度：7/7 completed，fix_rounds=1
- Reviewer 首轮报告：`docs/test-reports/MVP-i18n-full-locale-verifying-2026-04-27.md`

## fix-round 1 闭环
- 单条 BLOCKER：F001 `i18n:translate:dry` 无参可运行
- 修复：parseArgs `--target` dry-run 模式下可选；新增 runTranslateAll 遍历 4 语言；dry-run 报告写到 `*-dry.md` 且 gitignore；test 22 specs 全绿
- 不在本轮：locale-detection cookie domain 写死 localhost（测试可移植性 note，非产品回归，登记 backlog）

## 已验证通过（首轮）
- L1：typecheck/lint + i18n unit 4 文件 42 specs（含 22 script tests，含新增 dry-run 三 specs）
- L2 staging：`/api/health` healthy（git_sha=f55718d）
- 5 语言关键页 25 路由 200，html lang 全匹配，cookie 覆盖在 staging 域名下生效

## 等待 Reviewer 复验
- 主要验：`npm run i18n:translate:dry` 无参输出（4 语言 sections + summary）
- 向后兼容：`-- --target ja` 单语言形式仍然有效
- live 模式守门：无 --target 直接报错

## 角色分配
- 默认（无 role_assignments）= CLI Planner+Generator / Codex Evaluator
- 本批次：planner=Kimi / generator=johnsong / evaluator=Reviewer

---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-i18n-full-locale** — status=done（2026-04-27）
- 进度：7/7 completed，fix_rounds=1
- Signoff：`docs/test-reports/MVP-i18n-full-locale-signoff-2026-04-27.md`

## 复验结论
- F001 阻断已闭环：`npm run i18n:translate:dry` 无参可执行（遍历 4 语言）
- 向后兼容：`-- --target <locale>` dry-run 仍可用
- 守门有效：live 模式无 `--target` 仍会报错

## 验证证据
- L1：typecheck/lint + i18n unit 42 tests + locale-detection 5/5（Codex 3099 harness）
- L2 staging：`/api/health` healthy（git_sha=611cb87）
- Staging E2E：`marketer-dashboard.spec.ts` 4/4 passed
- i18n 探针：5 locale × 5 key pages = 25/25 返回 200，`html lang` 全匹配，cookie override（staging 域）生效

## 遗留风险（非阻断）
- `locale-detection.spec.ts` cookie-domain fixture 对 staging 可移植性不足（localhost 固定域会假失败）

## 角色分配
- done 阶段已清空 `role_assignments`（回到默认映射）

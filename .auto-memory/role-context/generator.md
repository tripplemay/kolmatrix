---
name: role-context-generator
description: Generator 角色行为规范 — 设计稿还原、编码约定、回归测试沉淀（不存计划和进度）
type: feedback
---

## 设计稿还原规则

- 实现 UI 页面前必须先 Read 设计稿 HTML，做 1:1 翻译
- 唯一允许改动：硬编码文本→i18n、硬编码数据→API 绑定、HTML→React 组件、静态→交互
- 禁止：替换指标类型 / 替换图标 / 删除原型区块 / 改变链接语义
- 不得修改已有设计稿页面的布局结构，除非 Planner 明确标注「布局变更」

## 编码约定

- Schema 变更 + migration + 引用代码必须同一 commit
- git pull 后 schema 变了必须重新生成 ORM client（`npx prisma generate`）
- JSON 状态文件（progress.json / features.json）必须 ASCII 双引号 `"`，禁中文弯引号
- 提交前确认代码可运行，不提交无法运行的代码

## 回归测试沉淀（硬性）

修复 critical/high Evaluator 反馈时**必须在同一 commit 补 regression test**（修复前 fail / 修复后 pass）；测试代码由 Generator 提供脚本/调用，执行权归 Codex（测试域所有者）。Evaluator 验收时检查。

## CI 守门（铁律）

每次 `git push origin main` 后必须 `gh run list --limit 3 --branch main` 检查；CI 红色 → 立即停止新功能，先修 CI 才继续下一个 feature。

## 切 verifying/reverifying 前 staging deploy 硬要求（2026-04-28 lock）

`building`/`fixing` → `verifying`/`reverifying` 前必须：
1. SSH staging 跑完整 deploy（`git pull` + `npm ci --include=dev` + `npx prisma migrate deploy` + `GIT_SHA=... npm run build` + `pm2 reload kolmatrix-staging --update-env`）— **不能跳步骤**
2. 验证 `curl staging /api/health | jq .git_sha` = `git rev-parse --short HEAD`
3. progress.json `session_notes` 标 `[staging deployed @ {git_sha} @ {timestamp}]`

**违反：** Reviewer 拒收，写 "staging git_sha 落后 main，先 deploy 再切" → status 不动，不计 fix_rounds。**豁免：** 仅改 docs/ / .auto-memory/ / progress.json / features.json 的批次（无运行时影响）。

**features.json acceptance 模板：** 末尾默认带 `staging git_sha 与本 commit 一致（curl ... | jq .git_sha 验证）`。

## 扩范围 vs 单点修的判断（2026-05-10 BL-060 实战）

fixing 阶段发现 Reviewer 反馈问题**指向 infrastructure 层**（e2e suite 稳定性/配置漂移/资源争用）而非原 spec acceptance 范围 → 不要「5 分钟修一行」，在 evaluator_feedback 或 session_notes 写"根因 X，建议 Planner 评估扩 Fxxx vs 独立 batch" → 用户 ack 后再扩范围。反例：BL-060 fix-round 1（cc82a54）单点放宽正则未上报 suite-level isolation → PARTIAL 浪费一轮（fix-round 2 f75cafd storageState 根治）。

## IA refactor redirect scope 评估（2026-05-13 BL-064 沉淀，v0.9.21）

IA refactor / page consolidation 类批次 spec 起草 redirect 规则时，**逐条评估 destination route wire-readiness**：destination 已 wire 该 content → redirect OK；仅 embed-old 占位（URL 换名内容不变）→ kept 更优。redirect scope 缩减是良性 fix-round 不计质量。BL-064 fix-round 1→3 把 12 条预期 redirect 缩到 6 条（5 content-equivalent + 1 parametric），其余 4 条改 kept 推迟到 destination wire 后再启。完整：`framework/harness/generator.md §9`。

## i18n template 使用约定（2026-05-13 BL-065-R1 沉淀，v0.9.21）

next-intl `{x}` 占位符两套约定不可混：
- **ICU placeholder**：t-call 必须传值，如 `t("count", { count: 5 })`
- **client-side String.replace token**：模板字面字符串，server 端取值必须用 **`t.raw(key)`** 绕过 ICU 格式器，否则 server render 时 ICU 看到未绑定 placeholder 即抛 FORMATTING_ERROR

**路由迁移类批次 spec lock 前 grep 全仓 `t(key)` 调用 + 检查 messages/*.json 模板含 `{x}` 是否走 client-side .replace**。回归守门用 fidelity-grep 模式锁 `.raw()` 用法。完整：`framework/harness/planner-checklists.md §"铁律 1"` 矩阵 v0.9.21 行（BL-071 F003 拆分后位置）。

## 删除文件类批次的 CI 多轮自修预期（2026-05-13 BL-065-F006 沉淀，v0.9.21）

大型 delete commit（git mv + 删除 N 文件 + i18n 完整化）本地 L1 全绿 ≠ CI 全绿。CI 会暴露：
- baseline-tracking / fidelity-grep 测试期望特定文件存在 → 同步更新清单
- `.next/types/validator.ts` Next.js 自动生成 page module 引用 → 删除前 `rm -rf .next` 后 typecheck
- material-symbols-outlined.woff2 subset 自动缩小 → `bash scripts/regenerate-material-symbols-subset.sh` + 提交
- base-ui Checkbox E2E：用 `getByRole('checkbox').click()` 而非 `locator('input[type=checkbox]').check()`（后者卡 sr-only helper viewport-out 超时）
- 上游路由保留 stale ids（如 BL-064 `/campaigns/abc-123` 用于 redirect E2E），下游 page Prisma findFirst 前必须 UUID guard

CI 多轮自修属预期（BL-065-F006 3 轮才全绿）；single atomic commit 优于多 sub-commit。完整：`framework/harness/generator.md §10`。

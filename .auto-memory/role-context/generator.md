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

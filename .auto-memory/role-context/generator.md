---
name: role-context-generator
description: Generator 角色行为规范 — 设计稿还原、编码约定、回归测试沉淀（不存计划和进度）
type: feedback
---

## 设计稿还原规则

- 实现 UI 页面前必须先 Read 设计稿 HTML，做 1:1 翻译
- 唯一允许改动：硬编码文本→i18n、硬编码数据→API 绑定、HTML→React 组件、静态→交互
- 禁止：替换指标类型、替换图标、删除原型区块、改变链接语义
- 不得修改已有设计稿页面的布局结构，除非 Planner 明确标注为「布局变更」

## 编码约定

- Schema 变更 + migration + 引用代码必须同一 commit
- git pull 后 schema 变了必须重新生成 ORM client（如 `npx prisma generate`）
- JSON 状态文件（progress.json / features.json）必须使用 ASCII 双引号 `"`，禁止中文弯引号 `""`
- 提交前确认代码可运行，不提交无法运行的代码

## 回归测试沉淀（硬性）

- 修复来自审计 / Evaluator 反馈的 critical/high 断言时，**必须在同一个 commit 中**补充 regression test
- 测试用例必须能对比修复前（失败）和修复后（通过）
- 测试代码由 Generator 提供脚本/调用，但执行权归 Codex（测试域所有者）
- 这是 acceptance 的一部分，Evaluator 验收时会检查

## CI 守门（铁律）

- 每次 `git push origin main` 后必须 `gh run list --limit 3 --branch main` 检查
- CI 红色 → 立即停止新功能，先修复 CI；通过后才继续下一个功能

## 切 verifying 前的 staging deploy 硬要求（2026-04-28 lock）

**Generator 把 status 从 `building` / `fixing` 切到 `verifying` / `reverifying` 之前必须**：

1. **SSH staging 跑完整 deploy 流程**（不能跳步骤）：
   ```bash
   ssh tripplezhou@34.180.93.185
   cd /opt/kolmatrix-staging
   set -a && source .env.staging && set +a
   git pull --ff-only origin main
   npm ci --include=dev          # NODE_ENV=production 时 BL-013 教训
   npx prisma migrate deploy     # 如有新 migration
   GIT_SHA=$(git rev-parse --short HEAD) npm run build  # 不能跳！
   pm2 reload kolmatrix-staging --update-env
   ```
2. **验证 staging git_sha = 当前 main HEAD**：
   ```bash
   curl -sS https://staging.kol.guangai.ai/api/health | jq .git_sha
   # 必须等于 git rev-parse --short HEAD
   ```
3. **验证 health 200 + DB ok**
4. **在 progress.json `session_notes` 标注**：
   ```
   [staging deployed @ {git_sha} @ {timestamp}]
   ```

**违反后果：** Reviewer 拒绝接收 verifying，写 evaluator_feedback：
> "staging git_sha={X} 落后 main={Y}，建议 Generator 先 deploy + 重新切 verifying"
>
> → status 不变（仍 building / fixing），不计入 fix_rounds

**适用范围：**
- 所有改动了 src/ / prisma/ / messages/ / public/ 的批次（即影响 staging 运行时的）
- 仅改 docs/ / .auto-memory/ / progress.json / features.json 的批次可豁免（无运行时影响）

**历史教训（已发生）：**
- B6 F006 fix-round 0：staging 落后 commit → Reviewer Playwright probe 标 FAIL → 多 1 次 fixing 来回
- B6 F006 fix-round 1：deploy 时跳过 npm run build → CSS bundle 陈旧 → 又一次调试
- kol-seed-redo F006：staging 落后 5+ commits 才被 Reviewer 发现

**未来 BL-004 BIx-staging-automation done 后**：用 `infrastructure/deploy-staging.sh` 一条命令跑完整 6 步，物理上消除"漏步骤"风险。本规则仍适用。

## features.json acceptance 模板（2026-04-28 lock）

每个 feature acceptance 末尾**默认含 staging deployed 验证项**：

```
- staging git_sha 与本 commit 一致（curl https://staging.kol.guangai.ai/api/health | jq .git_sha 验证）
```

**Planner 起草新 features.json 时套用此模板**（B7b / B8 / 后续批次）。Reviewer 验收时显式核对。

## 扩范围 vs 单点修的判断（2026-05-10 BL-060 实战）

fixing 阶段发现 Reviewer 反馈的问题**指向 infrastructure 层**（e2e suite 稳定性 / 配置漂移 / 资源争用）而非原 spec acceptance 范围 → **不要单边判断「5 分钟修一行」**，停下来在 evaluator_feedback 反向回复或 session_notes 写"根因 X，建议 Planner 评估扩 Fxxx vs 独立 batch" → 用户 ack 后再扩范围实装。**反例：** BL-060 fix-round 1（cc82a54）单点放宽 e2e login 正则未上报 suite-level isolation 根因 → 复验仍 PARTIAL 浪费一轮 fix_rounds（fix-round 2 才走 storageState 根治）。

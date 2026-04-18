# Contributing to KOLMatrix

## TL;DR

KOLMatrix 是**多 agent 协作驱动**的项目——每个 sprint 由 Planner 拆解、Generator 实现、Evaluator 验收三个角色协作完成。**不论人类开发者还是 AI agent**，提交前请先读通 [harness-rules.md](./harness-rules.md)。

---

## 1. 开发流程

1. **读 state 文件** — `progress.json` 判断当前 sprint 阶段，`features.json` 看 features 队列，`harness-rules.md` 是硬规则
2. **pre-impl 审计** — 复杂 feature 先出规划稿到 `docs/specs/B*-*.md`，push 后等 Planner 裁决，**未裁决不开工**
3. **实现 + 自检** — 每次改动要跑：
   - `grep -rE '#[0-9a-fA-F]{6}' src/ --include='*.ts*' --include='*.css' | grep -v 'globals.css'` 应为空（HEX 硬编码扫描）
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
4. **commit + push** — message 风格参照 [3. Commit 风格](#3-commit-风格)
5. **状态机同步** — 完成 feature 时更新 `features.json` (status → completed) 和 `progress.json` (completed_features +1)

---

## 2. 设计系统遵循

- **color 100% 走 token**（`text-cyan` / `bg-surface-low` / `text-on-surface-variant` 等），不允许 `#HEX` 硬编码
- **例外**：平台角标品牌色（`bg-red-600` YouTube / `bg-purple-600` Twitch / 等）、trend 辅色（`emerald-400`）保留 Tailwind 预设，见 `design-draft/design-system.md` §11
- **禁忌**：1px solid 边框分隔 / 纯黑白大面积 / 硬阴影 / 标准 SaaS 灰白蓝配色
- AI 相关元素必须带 cyan 视觉标识（发光 / 玻璃拟态 / 渐变）

## 3. Commit 风格

遵循约定式提交 + 中英混合（项目历史风格）：

```
feat(F007): Dashboard 5 区块 + 12 F010 组件全量复用
fix(F004): auth middleware 修 tenant-id 丢失
docs(spec): B0 App Shell canonical 裁决请求
refactor(F005): App Shell 按 Kimi canonical 裁决重构
chore(seed): 补 300 条 EmailLog 分散 7 天
```

- 前缀：`feat` / `fix` / `docs` / `refactor` / `style` / `test` / `chore`
- 括号内标 feature id（F001-F010）或范围（`spec` / `seed` / `session`）
- body 描述 **why**，不描述 **what**（代码 diff 自解释）
- 每条 commit 以 `Co-Authored-By:` 结尾标注协作 agent

## 4. Spec 偏差 = 先反馈

如果规格与代码现实冲突（字段缺失 / 组件命名重复 / 验收标准矛盾），**不要擅自绕过**：

- 写 `docs/specs/B*-*-review.md` 描述冲突 + 列 A/B 方案 + 给建议
- push 到 main，等 Planner 裁决
- 裁决敲定后才开工修复

示例先例：[B0-app-shell-canonical-review.md](./docs/specs/B0-app-shell-canonical-review.md) / [B0-f007-dashboard-plan.md](./docs/specs/B0-f007-dashboard-plan.md)

## 5. 代码风格

- TypeScript `strict` + ESLint + Prettier（保存时自动格式化）
- 组件单文件 ≤100 行（公共组件）、page.tsx JSX ≤80 行（强约束）
- props interface 必填 + 文件头 JSDoc 说明用途 + HTML 参考源
- 禁止 `any`，数据库边界处用 Prisma 生成类型

## 6. Prisma migration 规范

- 命名：`YYYYMMDDHHMMSS_动词_对象`（如 `20260419000000_add_campaign_open_rate`）
- 每个 migration 文件头必须有 `-- ROLLBACK: ...` 注释（BI2 CI 会 lint）
- 修改 schema 前先写 review 稿，避免破坏性变更

## 7. 不要做的事

- ❌ 直接 `git push --force` 到 main（改 PR）
- ❌ `--no-verify` 绕过 hooks
- ❌ 删除他人未合并的 branch
- ❌ 在 `page.tsx` 里 inline 写 card / button / chip / header 视觉片段（必须走公共组件）
- ❌ 扩 @theme token 收纳"非设计系统意图"的颜色（见 §11 色彩边界政策）

---

## 8. 协助与提问

- Sprint 方向不清 → 问 Planner (Kimi)，通过更新 `progress.json.session_notes.kimi` 或独立 spec 文档
- 实现细节不清 → 写 review 稿到 `docs/specs/` 等裁决
- 本地起不来 → 参考 [docs/dev/setup.md](./docs/dev/setup.md) §8 常见问题

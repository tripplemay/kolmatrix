# BL-067-explainability-c3 Reverify Round 1 Report 2026-05-16

> 状态：**core paths PASS, signoff pending**
> 触发：`progress.json` 处于 `reverifying`，Reviewer 在 fix-round 1 落地后重跑 staging smoke + spot check。

## 测试范围

- staging 登录与 campaign detail 页面可达性
- AiRecommendationPanel short explanation 渲染
- DetailedExplanationDialog 5 段渲染
- 5 locale 切换
- BL-066 回归：accept / skip / show next 5

## 使用的源文档

- `docs/test-reports/BL-067-staging-spot-check.md`
- `docs/test-reports/BL-067-fixround1-2026-05-15.md`
- `docs/specs/BL-067-explainability-c3-spec.md`
- `src/app/[locale]/(app)/campaigns/[id]/AiRecommendationPanel.tsx`
- `src/app/[locale]/(app)/campaigns/[id]/DetailedExplanationDialog.tsx`

## 覆盖摘要

- PASS: staging 登录、campaign detail 页面主体、AI 推荐卡、`?` 入口、详细解释弹窗、locale 切换、BL-066 核心交互
- PARTIAL: `docs/test-reports/BL-067-staging-spot-check.md` §1 的“5 个不同游戏品类 campaign”在当前 staging seed 上不可完整满足
- NOT RUN: §4 cap 满模拟、§6 chaos、§8 24h cost monitor

## 结构化测试用例列表

| ID | 用例 | 结果 | 证据 |
|---|---|---|---|
| T1 | staging 登录后进入 campaign detail | PASS | `/en/campaigns/382f014c-a9f9-4fde-bcad-d5bb10ed2045` 正常渲染，无 ErrorBoundary |
| T2 | short explanation 卡片渲染 | PASS | `campaign-ai-recommendation-card` / `explain-trigger-*` 可见 |
| T3 | 详细弹窗 5 段渲染 | PASS | `explain-dialog-segments` 下 5 个 segment 可见 |
| T4 | locale 切换 en/zh/ja/ko/es | PASS | 短解释与按钮文案随 locale 变化 |
| T5 | accept / skip / show next 5 回归 | PASS | Accepted KOL 数量增长，skip 后卡片仍可继续轮换 |

## 执行结果

### Smoke

- `GET https://staging.kol.guangai.ai/api/health` 返回 `healthy`
- staging detail 页不再进入 ErrorBoundary

### 详细弹窗

- 首次点击 `?` 打开弹窗后，5 段内容可见
- 段位包含 `matchScore`、`categoryFit`、`recentActivity`、`audienceFit`、`brandHistory`

### 5 locale

- `en`、`zh`、`ja`、`ko`、`es` 均能渲染对应语言短解释和按钮文案

### BL-066 回归

- Accept 成功后 `Accepted KOLs` 数量从 4 增到 5
- Skip 后当前卡片从可见列表消失
- `Show next 5` 仍能切换下一批候选

## 缺陷列表

### [Medium] §1 的 5-category 覆盖在当前 staging seed 上不可完整满足

- 证据：当前 staging 仅有 3 个 active campaign / 3 个 category
- 影响：`docs/test-reports/BL-067-staging-spot-check.md` 的 §1 要求无法完整跑满 5 个不同游戏品类
- 结论：这是数据覆盖缺口，不是页面功能回归

## 待确认问题或规格缺口

- `§4` cap 满模拟需要 staging DB/env mutation，当前未执行
- `§6` chaos 需要临时替换 API key 或等价注入，当前未执行
- `§8` 24h cost monitor 需要 soak 窗口，当前未执行
- 若要最终 signoff，需要先补足这三类检查或明确降低验收范围


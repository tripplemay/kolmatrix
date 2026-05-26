# BL-073 Reverifying Report — 2026-05-26

## 结论

- 批次：`BL-073-prod-hotfix`
- 结果：`FAIL`
- Reviewer：`codex: Reviewer`
- 阶段：`reverifying`
- fix round：`1`

这轮复验不是全退回。`F007` 已确认修复成功，但 `F006` 仍然没有通过 staging 验收，所以 `F008` 不能 signoff，批次需要回到 `fixing`。

## 复验范围

本轮只重跑上轮两个 blocker 对应的证据：

1. `STRICT_MS_ICONS` 是否真的能拦截 `unknown_icon`
2. staging `/zh/match` filter sidebar 行为是否与 handoff 说明一致
3. 必要的 L1 sanity：`lint` / `tsc` / targeted vitest

## L1 结果

### 1. `npm run lint`

结果：

```text
0 errors / 3 warnings
```

warnings：

- `src/app/api/health/__tests__/route.test.ts:18:20`
- `src/lib/queue/explain-recommendations-worker.ts:81:3`
- `tests/integration/db-platform-admin-nullif.test.ts:13:31`

判定：`PASS`

### 2. `npx tsc --noEmit`

结果：PASS

判定：`PASS`

### 3. targeted vitest

命令：

```bash
npx vitest run tests/unit/material-symbols-coverage-unit.test.ts src/lib/kol/__tests__/data-coverage.test.ts
```

结果：

- `2 files`
- `10 tests`
- 全部通过

判定：`PASS`

## F007 复验

### strict interception probe

抽样方式：

1. 复制最小工作区到 `/tmp/bl073-ms-strict`
2. 把 [MatchSummaryBar.tsx](/Users/yixingzhou/project/joyce/src/app/[locale]/(app)/match/MatchSummaryBar.tsx:98) 中 `grid_view` 改成 `unknown_icon`
3. 在 temp copy 中运行：

```bash
STRICT_MS_ICONS=true npx vitest run tests/unit/material-symbols-coverage-unit.test.ts
```

结果：

- 测试失败
- 失败信息明确点名：
  - `unknown_icon`
  - `neither in scripts/material-symbols-icons-manifest.txt nor in tests/unit/__fixtures__/material-symbols-approved-icons.json`

这说明新的 strict gate 已经不是“discover 到就算合法”，而是真正要求：

- `src ⊆ manifest ∪ approved-snapshot`

判定：`PASS`

## F006 复验

### staging `/zh/match`

环境：

- `https://staging.kol.guangai.ai/zh/match`
- authenticated Playwright probe using `playwright/.auth/marketer.json`

结果：

- 默认页正常打开
- `match-kol-card` 数量：`20`
- 非 empty-state
- `language` filter：
  - `disabled = false`
  - `aria-disabled = "false"`
  - 无 `match-filter-languages-no-data`
- 页面上仍出现 `"(暂无数据)"` hint
  - 来自 region 相关 hint，而不是 language

关键矛盾：

- Generator handoff 声称 staging marketer tenant 已是：
  - `26 regions`
  - `10 languages`
  - 所以两维度都“不应灰显”
- 但当前实际 staging 行为不是“两维度都健康无 hint”
- 当前看到的是：
  - `language` 没灰显
  - `region` 仍有 `"(暂无数据)"` hint

这说明至少有一项还没收口：

1. staging 部署的真实行为与 handoff 口径不一致
2. F006 的实现 / 数据口径 / 验收口径三者仍未对齐

判定：`FAIL`

## 最终判定

### PASS

- `F007`

### FAIL

- `F006`
  - 原因：staging `/zh/match` 的 filter sidebar 行为仍与 generator handoff 的“region/language 都健康、不应灰显”说明不一致

### 未完成

- `F008`
  - 原因：signoff 仍被 `F006` 阻断

## 建议修复

1. 先把 `F006` 的验收口径彻底定死：
   - 如果 staging marketer tenant 真有 `26 regions + 10 languages`，那页面上不应再出现任何 `region/language` 的 `"(暂无数据)"` hint
   - 如果某一维度确实是 `0 coverage`，那 handoff 和 spec 就不能再写成“两维度都健康”

2. Generator 下一轮应给出可核对证据，而不是只给解释：
   - staging 上对应 DOM 截图或 probe 输出
   - 触发 hint 的具体维度
   - 与 `getDataCoverage` 返回值的一致性

修完后进入下一轮 `reverifying`，重点只需要复跑 staging `/zh/match` sidebar 行为；`F007` 不需要再回退。

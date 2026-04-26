# BM2-campaign-outreach-roi Signoff 2026-04-26

> 状态：**Evaluator 验收通过（reverifying）**
> 触发：fix-round 1 完成后，对 4 个阻断项与回归链进行复验

---

## 验收范围

- BM2 全量 11 features 的复验闭环（重点关注上一轮 4 个阻断）
- L1 本地验证：3099 环境、单测/集成、Journey E2E、visual 基线在 git

---

## 阻断项复验结果

1. F011-001（visual baseline PNG 缺失）
- 结果：PASS
- 证据：`git ls-files tests/screenshots/baseline/*.png` 返回 12 张基线图（BM1 4 + BM2 6 + auth 2）

2. F006-002（官方 setup 后模板数为 0）
- 结果：PASS
- 证据：`scripts/test/codex-setup.sh` seed 输出 `templates: 10`
- 补充：`tests/integration/email-template-seed.test.ts` 通过（6 tests）

3. NAV-003（Email Center/Analytics 导航 404）
- 结果：PASS
- 证据：`src/components/layout/__tests__/nav-config.test.ts` 在本轮回归中通过

4. HARNESS-004（codex-wait 仅接受 200）
- 结果：PASS
- 证据：`bash scripts/test/codex-wait.sh` 结果为 `/login (307) after 1s`

---

## 自动化结果

- `npm run test:unit -- tests/unit/prisma-seed-chain.test.ts tests/unit/codex-wait-script.test.ts tests/unit/campaign-detail-rsc-boundary.test.ts src/components/layout/__tests__/nav-config.test.ts`
  - 结果：4 files / 14 tests 全通过
- `npm run test:integration -- tests/integration/email-template-seed.test.ts`
  - 结果：1 file / 6 tests 全通过
- `bash scripts/test/codex-e2e.sh tests/e2e/journey-a.spec.ts tests/e2e/journey-b.spec.ts tests/e2e/visual-regression.spec.ts`
  - 结果：Journey A/B 2 passed；visual 12 skipped（平台策略：仅 Linux 执行）
- `npm run typecheck`
  - 结果：通过
- `npm run lint`
  - 结果：通过

---

## Stitch 还原度评估

- 原型参考：
  - `design-draft/stitch-references/campaigns-list.html`
  - `design-draft/stitch-references/campaign-detail.html`
  - `design-draft/stitch-references/email-center.html`
  - `design-draft/stitch-references/crm-relationship.html`
  - `design-draft/stitch-references/roi-tracking.html`
  - `design-draft/stitch-references/weekly-report.html`
- 对比方法：
  - 本轮以回归自动化 + baseline 在 git 完整性为主（本机为非 Linux，visual diff 用例按策略 skip）
- 不得简化元素核对：
  - [x] 本轮未发现新的结构性删减证据
- 总体评级：🟡 中度差异可接受（残余风险：未在 Linux 本地复跑 12 张 visual diff）

---

## 结论

BM2 在 `reverifying` 阶段通过：
- 上一轮 4 个阻断项均已关闭
- L1 核心回归通过
- signoff 通过，允许状态流转到 `done`

残余风险（已记录）：
- 本机（darwin）受 visual spec 平台策略影响，12 项 visual diff 未在本地执行，仅完成 baseline 入库核查。

---

## Harness 说明

本批次按 Harness 状态机完成至签收阶段。
`docs.signoff` 已指向本报告，可进入 `status: done`。

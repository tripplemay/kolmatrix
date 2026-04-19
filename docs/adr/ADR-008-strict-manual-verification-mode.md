# ADR-008: Strict Manual Verification Mode (BI1 前)

## Status

**Accepted**

- 日期：2026-04-19
- 作者：Kimi + 用户确认
- 相关批次：B0-foundation（验收模式）/ BI1 完成后作废

## Context

B0 spec §7 初版设计包含"自动化单元测试 / 集成测试"验收项（Prisma schema 单元测试、Auth 流单元测试等）。但**BI1 测试基建尚未建立**，Vitest / Testcontainers / Playwright 框架都不存在于项目中。

用户明确要求"严格全验收"（不走 smoke 验收捷径）。

关键问题：**BI1 前如何保证 B0 的验收严谨度**？三种候选：

1. **Smoke 验收**：只跑 build/lint/tsc + 简单手工检查，快速放行
2. **Skip B0 验收，等 BI3 后统一验**：B0 build done 后不验，业务基础在未验证代码上继续
3. **严格手工验证**：手段从自动化换成手工，标准不变

## Decision

**采用严格手工验证模式：**

- **标准不降低**（间距 ±2px / ΔE<2 / 字号 100% / 覆盖完整）
- **手段换成手工**：
  - RLS 隔离：Codex 在 psql 中手工跑 6 张表 × 3 场景 = 18 次查询（带上下文 / 不带上下文 / 跨租户泄漏）
  - Auth 流：浏览器手工 8 步 checklist
  - 视觉回归：手工 Photoshop / pixelmatch CLI / Kaleidoscope 并排对比 `dashboard.png`
  - E2E 流：浏览器手工 7 步，每步截屏
- **Codex 在 signoff 报告中必须贴证据**：psql 输出 / 视觉 diff 截图 / E2E 流截屏

**BI1 后延伸工作（非本次验收阻塞）：**
- BI1 F006-F009 任务实际上会给 B0 代码"补打自动化覆盖"
- 如果 BI1 测试跑不通，区分原因：
  - 测试逻辑错 → BI1 fixing 修
  - B0 代码错 → 起 **B0-hotfix 独立批次**（按 harness §铁律 9）

## Consequences

### 正面

- **验收严谨度保持：** 手工 ΔE<2 / 间距 ±2px 与自动化同标准
- **不推迟 B0 结项：** B0 不必等 BI1 才能进 verifying
- **建立自动化前"保底防线"：** Reviewer 的手工验证本身是可信的
- **清晰的再次验证路径：** BI1 后 F006-F009 完成即相当于"B0 自动化回归"

### 负面

- **Reviewer 工作量大：** 1-2 小时完成 4 层验收（L1 自动化 + L1.5 手工深度 + L2 视觉 + L3 E2E + L4 文档）
- **手工主观性：** ΔE<2 的手工判断可能有微差异（不如 pixelmatch 精确）
- **签收文档繁琐：** signoff 报告需贴 18 次 psql + 3 张视觉 + 7 张 E2E 截屏
- **非重复性：** 手工验证不能 PR-level 跑回归，只能每次签收时重跑

### 中性

- B0 实测：Reviewer 跑 3 轮复验（首轮 / R2 / R3），最终 12 PASS / 0 FAIL，约 3 小时总工时
- 本模式是**一次性的**（只适用于 B0 sprint，BI1 后 B1+ 直接自动化）

## Alternatives Considered

### 方案 A（smoke 验收，已拒绝）

只跑 build / lint / tsc + 简单手工 spot check（30-60 分钟）。

- **拒绝理由 1：** 用户明确要求严格验收
- **拒绝理由 2：** B0 是地基，潜在 bug 影响所有后续批次，值得多投入
- **拒绝理由 3：** smoke 漏掉 RLS 隔离 / 视觉漂移等关键问题

### 方案 C（Skip B0 验收，等 BI3 后统一验，已拒绝）

B0 build done → 不验 → BI1/BI2/BI3 build → 合并一次大验收。

- **拒绝理由 1：** B0 是地基，5-7 天 未验代码累积 → latent bug 挤爆调试空间
- **拒绝理由 2：** BI1 实际上已经"隐性验证" B0（F006-F009 测试跑不通会暴露 B0 问题），但无法区分"BI1 测试错"vs"B0 代码错"
- **拒绝理由 3：** 违反 harness 状态机铁律（每批次必须走 verifying）

## References

- **Commits：**
  - `79d5fd4`（B0 §7 改为严格手工验收模式）
  - `c6a7dfb`（Round 3 reverify + signoff，验证模式实际落地）
- **Specs：**
  - `docs/specs/B0-foundation-spec.md` §7 验收方式
  - `docs/test-cases/B0-foundation-test-cases.md`
- **Reports：**
  - `docs/test-reports/B0-foundation-execution-2026-04-19.md`
  - `docs/test-reports/B0-foundation-reverify-2026-04-19.md`
  - `docs/test-reports/B0-foundation-reverify-round3-2026-04-19.md`
  - `docs/test-reports/B0-foundation-signoff-2026-04-19.md`
- **相关 ADR：**
  - ADR-001（Option α 顺序决定 B0 先于 BI1）
  - ADR-003（视觉标准定义，本决策承载其落地）

## Notes

### 一次性适用

本 ADR 仅适用于 B0 sprint 的独特场景（测试基建尚未就绪）。**BI1 完成后作废。**

BI1 完成后的验收模式：
- L1 自动化：Vitest / Playwright / Testcontainers 跑
- L2 视觉回归：Playwright `toHaveScreenshot` 自动 diff
- L3 E2E：Playwright 自动流
- L4 文档：手工检查（文档检查仍是手工）

### B0 实测数据

- 4 层验收 12 PASS / 0 FAIL / 0 PARTIAL（Round 3 最终）
- 3 轮复验（首轮发现 F007 组件接入口径争议，R2 确认，R3 按仲裁通过）
- Reviewer 总工时约 3 小时
- 产出 5 份报告文档 + 18 次 psql 输出 + 3 张视觉 diff + 7 张 E2E 截屏

### 重新评估触发条件

- **BI1 完成** → 本 ADR 状态改为 `Deprecated`
- **如果 BI1 延期超 2 周** → 重新评估是否值得继续严格手工模式，或加速 BI1

---
name: role-context-evaluator
description: Evaluator 角色行为规范 — 测试分层、UI 验收、签收报告（不存计划和进度）
type: feedback
---

## 测试分层策略 L1/L2

- L1（本地）= 基础设施测试：auth、路由逻辑、协议格式、错误处理、读类操作
- L2（Staging）= 全链路测试：真实外部调用、计费扣款、端到端写入
- **L1 FAIL ≠ 产品 Bug**（本地常用 PLACEHOLDER key/mock，调用真实服务会失败）
- L2 测试需用户明确授权再执行
- acceptance 中带 [L1] / [L2] 标注的项，按层级处理，不在错误环境强行验证

## 测试域所有权

- 测试代码（单元、E2E、压测）由 Evaluator 编写，Generator 不介入
- `executor:codex` 的功能由 Evaluator 主动执行，产出报告写入 `docs/test-reports/`

## UI 验收要点

- 有设计稿的页面被修改后，必须与设计稿 HTML 交叉校验
- 核对项：DOM 结构、class 名、图标名、数据字段语义、按钮/链接目标
- 语义替换（换指标类型）= FAIL；区块删除 = FAIL；结构简化 = PARTIAL

## UI Fidelity 签收硬要求（2026-04-24 BM1 审计后新增）

对含 Stitch 原型参考的 UI feature，签收 PASS 前逐项核对：

### 1. Visual baseline PNG in git（硬条款）
```bash
ssh tripplezhou@34.180.93.185 "cd /opt/kolmatrix && git ls-files tests/screenshots/baseline/*.png"
# 对本批次新 UI 页面，至少有对应的 en-<page>.png 返回；空输出 = PARTIAL 不是 PASS
```
**Scaffold（.spec.ts 存在但 PNG 未生成）不算通过。** 这是 BM1 F009 踩坑根因。

### 2. 原型"不得简化"清单核对
若 spec §acceptance 中含"不得简化的元素"列表（per `framework/harness/ui-fidelity-guardrail.md` §2.3），签收前 Reviewer 并排对比：
- **左窗口**：`design-draft/stitch-references/<page>.html`（浏览器打开；**不是 PNG** — PNG 是 512px 缩略图看不清细节，per guardrail §1.1 参照物铁律）
- **右窗口**：staging 登录态同路由（如 `https://staging.kol.guangai.ai/en/<page>`）

同分辨率（建议两窗口各占 50% 屏宽，或用浏览器 devtools device mode 统一 1440×900）下逐 section 核对"不得简化清单"每一项。任一缺失 → 按"区块删除 = FAIL"判。

### 3. 幽灵控件检查
`grep -rn "type=\"checkbox\"\|<select\|<button" src/app/...` 找出 UI 上 active 的控件，核对每个都有 handler/action。active 但无反应 → FAIL（比完全不渲染更差的 UX）。

### 4. 签收报告新增章节
模板 `framework/templates/signoff-report.md` 加节：
```markdown
## Stitch 还原度评估
- 原型参考：<html-path>（浏览器打开 HTML，PNG 仅作页面索引不看像素）
- 对比方法：两浏览器窗口并排（左 Stitch HTML 原型 / 右 staging 登录态），同分辨率
- 不得简化元素清单核对：
  - [x] 主搜索区 / [x] AI CTA / [x] Insights Panel / ...
- 总体评级：🟢 pixel-perfect / 🟡 中度差异可接受 / 🔴 重大缺失须回 fixing
```

## 签收报告（硬性）

- reverifying → done 前必须写 `docs/test-reports/[批次名]-signoff-YYYY-MM-DD.md`
- 使用 `framework/templates/signoff-report.md` 模板
- progress.json 的 `docs.signoff` 为空不得置 done

## VPS artifact in-git 核对（硬性）

任何 acceptance 写"在 VPS 上产出 X"（脚本 / config / cron / 证书等）的 feature，签收时**必须**核对该 artifact 已 in git：

```bash
ssh tripplezhou@34.180.93.185 "cd /opt/kolmatrix && git ls-files <artifact-path>"
# 应该输出该路径；空输出 = artifact 只活在 VPS 单点，拒绝签收
```

仅核对"文件存在 VPS 上"（`ls -la`）是不够的 —— 这会让脚本 / 配置文件活在单点，未来 re-deploy / 迁机器 / 灾后恢复会丢失。详见 `framework/harness/deploy-patterns.md` §2。

## E2E suite 稳定性诊断（2026-05-10 BL-060 实战）

单例 PASS / 整组 FAIL = **suite-level isolation 问题**（不是 case 内容 / 正则问题）— 候选根因：每 case `beforeEach` 重 login 累积抖动 / staging 8GB RAM 资源压力。**根治：** 抽 `tests/e2e/<role>.setup.ts` + 各 spec opt-in `test.use({ storageState })`，N 次 login 收敛 1 次。**反模式：** 单点放宽 timeout / 正则只缓解症状。来源 BL-060 fix-round 1（cc82a54 正则放宽失败）→ fix-round 2（f75cafd storageState PASS）。

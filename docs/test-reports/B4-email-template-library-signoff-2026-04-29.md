# B4-email-template-library Signoff 2026-04-29

> 状态：**Evaluator 验收通过**
> 触发：用户要求检查当前项目状态并开始验收。

---

## 变更背景

B4 目标是把 AI 生成的邮件模板从一次性预览升级为可复用、可管理的模板库，并在 `/outreach` 发送界面中可选择。本次验收覆盖模板保存、刷新可见性、模板库路由和视觉基线。

---

## 变更功能清单

### F001：抽出 `/outreach` 模板库数据读取与权限规则

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- 本地：`npm test`、`npm run lint`、`npx tsc --noEmit` 全绿。
- staging：`GET https://staging.kol.guangai.ai/api/health` 返回 `healthy`，`git_sha=31ab6c0`。
- `/outreach/templates` 页面可正常加载系统模板数据并展示编辑区。

### F002：AI 定制结果可保存为当前租户模板

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- staging `/en/outreach/templates` 页面点击 `Save as copy` 后，模板状态从系统模板切换为草稿副本。
- 页面刷新后，副本仍保留在模板选择器中，说明保存结果已落库并可重新加载。

### F003：发送界面支持 system + user 模板分组选择

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- staging `/en/outreach` 可见模板下拉并保持现有发送流程。
- 生成的用户模板副本已能在 `/outreach` 模板选择器中重新出现，刷新后仍可选。

### F004：实现 `/outreach/templates` 模板库页

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- staging `/en/outreach/templates` 可访问，页面标题为 `Email Template Editor`。
- 页面包含模板选择、搜索、locale 过滤、名称/主题/正文编辑、AI 重写、保存、复制、删除等核心控件。
- 设计稿主干结构与实现一致：左侧编辑区 + 右侧实时预览 + 顶部/侧边导航。

### F005：启用 OutreachTabs 的 Templates 路由

**Executor：** generator

**验收结果：** PASS

**复验证据：**
- staging `/en/outreach` 上 `Templates 10` 为可点击链接，指向 `/en/outreach/templates`。
- `/en/outreach/templates` 上 `Overview` 与 `Templates` 的 active/route 状态正确。

### F006：补模板库回归测试与视觉基线

**Executor：** generator / evaluator

**验收结果：** PASS

**复验证据：**
- 本地测试：`npm test` 589/589 PASS。
- 本地静态检查：`npm run lint` PASS，`npx tsc --noEmit` PASS。
- 视觉基线：`tests/screenshots/baseline/en-outreach-templates.png` 已入 git。
- 视觉基线收口测试：`tests/unit/visual-baselines-shape.test.ts` PASS，且新增 baseline 与 `toHaveScreenshot()` 已对齐。

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| 邮件发送协议 / Resend 集成 | 未改动 |
| 追踪、退订、发送队列 | 未扩展 |
| 模板分享 / 协作审批 | 未实现 |

---

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| AI 模板保存 | 仅预览态 | 可保存为租户模板 |
| `/outreach` 模板选择 | 仅系统模板 | 系统模板 + 用户模板 |
| 模板库页 | 不可用 | 可访问、可编辑、可复制 |

---

## 类型检查 / CI

```bash
npm test                          # PASS (91 files / 589 tests)
npm run lint                      # PASS
npx tsc --noEmit                  # PASS
GET https://staging.kol.guangai.ai/api/health  # PASS, git_sha=31ab6c0
```

---

## Stitch 还原度评估

- 原型参考：`design-draft/stitch-references/email-template-editor.html`
- 对比方法：staging 登录态 `/en/outreach/templates` 页面复核编辑区、预览区、导航和操作按钮
- 不得简化元素清单核对：
  - [x] 主编辑区
  - [x] AI CTA
  - [x] 实时预览
  - [x] 模板搜索 / locale 过滤
  - [x] 保存 / 复制 / 删除
- 总体评级：🟢 满足本批次 UI 与交互验收

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → done）交付。
`progress.json` 已设为 `status: "done"`，`docs.signoff` 已填写本报告路径。

# BL-105 L2 Manual Verification Checklist

> **Staging：** staging.kol.guangai.ai
> **Git SHA：** 969b4d5
> **Date：** 2026-06-12
> **Evaluator：** Reviewer

---

## Pre-Check

- [ ] 已登录 admin@kolmatrix.local / Kolmatrix@2026
- [ ] 已确认 staging git_sha=969b4d5（/api/health?token=... → git_sha 字段）
- [ ] 网络正常、staging health 检查通过

---

## L2 验收项 1：H6 Edit Brief 链接不再 404

**步骤：**

1. 进入任意 campaign 详情页：`/en/campaigns/[campaign-id]`
2. 找到顶部 **BriefSummaryPanel** 区块
3. 点击 **"Edit Brief"** 按钮/链接
4. **预期结果：** 
   - ✅ 跳转到 `/en/campaigns/[campaign-id]/edit` 页面（不再 404）
   - ✅ 页面加载完成，显示编辑表单

**记录：**
- [ ] Edit Brief 链接点击成功
- [ ] /edit 页面加载成功（不是 404）
- 截图：_____________________

---

## L2 验收项 2：campaign 字段编辑 + 保存生效

**测试 campaign：** 建议选一个 status=draft 的 campaign（便于后续状态流转测试）

**步骤：**

1. 在 `/edit` 页面，编辑以下字段（逐一测试）：
   - **Name**：改成 `Test Campaign ${Date.now()}`
   - **Budget Amount**：改成 `5000`
   - **Start Date**：改成明天日期
   - **End Date**：改成 7 天后
   - **Game**：选一个 game category

2. 点击 **"Save"** 按钮

3. **预期结果：**
   - ✅ 显示 success toast / banner
   - ✅ 页面 redirect 回 `/en/campaigns/[id]` 详情页
   - ✅ 详情页刷新后，BriefSummaryPanel 显示新的 name + budget
   - ✅ 验证 DB：`SELECT name, budget_amount FROM campaigns WHERE id=...` 确认字段已更新

**记录：**
- [ ] Name 字段编辑 + 保存成功
- [ ] Budget 字段编辑 + 保存成功
- [ ] Date 字段编辑 + 保存成功
- [ ] Game 字段编辑 + 保存成功
- [ ] 详情页反映最新值
- [ ] 验证 DB 字段更新
- 截图（编辑页表单 + 详情页更新后）：_____________________

---

## L2 验收项 3：状态流转（draft → active → completed）

**前置：** campaign status 应为 draft 或 active（选 status=draft 最佳）

**步骤：**

### 3a 流转：draft → active

1. 在 `/edit` 页面，找到 **"Campaign Status"** 控件
2. 当前状态显示为 draft，下拉选 **"Active"**
3. 点击 **"Change Status"** / **"Apply"** 按钮
4. **预期结果：**
   - ✅ 显示 success toast
   - ✅ 页面 redirect 回详情页
   - ✅ BriefSummaryPanel status pill 从 draft 变为 active（绿色）
   - ✅ 验证 DB：`SELECT status FROM campaigns WHERE id=...` = 'active'

**记录：**
- [ ] draft → active 流转成功
- [ ] 详情页 status pill 更新
- [ ] DB status 更新

### 3b 流转：active → completed

1. 再次进入 `/edit` 页面
2. 当前状态已为 active，下拉选 **"Completed"**
3. 点击 **"Change Status"** / **"Apply"** 按钮
4. **预期结果：**
   - ✅ 显示 success toast
   - ✅ 详情页 status pill 从 active 变为 completed（灰色）
   - ✅ **重要：** 检查编辑页是否有 "Reactivate" 按钮可恢复（spec 允许 completed → active reactivate）

**记录：**
- [ ] active → completed 流转成功
- [ ] 详情页 status pill 更新
- [ ] Reactivate 按钮出现（可选）

---

## L2 验收项 4：营收记录 → ROI 页反映

**前置：** campaign 应已为 completed（从上一项 3b 完成）

**步骤：**

1. 在 `/edit` 页面，找到 **"Revenue"** 输入框
2. 输入 **Revenue** 金额（e.g., `15000`）和 **Currency**（USD/CNY）
3. 点击 **"Record Revenue"** / **"Save"** 按钮
4. **预期结果：**
   - ✅ 显示 success toast
   - ✅ 页面 redirect 回详情页
   - ✅ 详情页 **ROI / Financial** 区块显示新的 revenue 数值
   - ✅ 验证 DB：`SELECT revenue_amount, revenue_currency FROM campaigns WHERE id=...` 确认记录

5. **额外验证：** 进入 `/en/campaigns/[id]/roi` 页面（如有单独 ROI 页）
   - ✅ ROI 页也显示新的 revenue 数值
   - ✅ 计算结果（ROI% = (revenue - budget) / budget × 100）正确

**记录：**
- [ ] Revenue 输入 + 保存成功
- [ ] 详情页 Revenue 显示更新
- [ ] ROI 页（如有）Revenue 显示更新
- [ ] DB 记录确认
- 截图（ROI 页面显示 revenue）：_____________________

---

## L2 验收项 5：名单 inline 操作（移除/改 fee/改 status）

**前置：** 需要一个有 KOL 关联的 campaign（status 可为任意）

**步骤：**

### 5a 改 KOL contact-status（detail page AcceptedKolsPanel）

1. 进入详情页，找到 **"Accepted KOLs"** 面板的 KOL 列表
2. 找任一 KOL 行，点击 **Contact Status** 列的 **Select/Dropdown**
3. 改成不同的 status（e.g., draft → contacted / replied）
4. **预期结果：**
   - ✅ 下拉选择成功
   - ✅ 显示 success indicator（toast / checkmark）
   - ✅ KOL 行状态立即更新（乐观更新）
   - ✅ 验证 DB：`SELECT contact_status FROM kol_campaigns WHERE ...` 已更新

**记录：**
- [ ] Contact Status 下拉改值成功
- [ ] 页面乐观更新
- [ ] DB 确认更新

### 5b 改 KOL Fee

1. 在同一 KOL 行找到 **Fee** 列
2. 点击 Fee 字段（可编辑 / 点击打开输入）
3. 改成新的 fee 值（e.g., `2000`）
4. 点击 **Save** / **Confirm**
5. **预期结果：**
   - ✅ 费用更新
   - ✅ 显示 success indicator
   - ✅ 验证 DB：`SELECT fee FROM kol_campaigns WHERE ...` 已更新

**记录：**
- [ ] Fee 编辑 + 保存成功
- [ ] 页面更新
- [ ] DB 确认更新

### 5c 移除 KOL

1. 在同一 KOL 行找到 **Remove** 按钮 / 删除图标
2. 点击 Remove
3. **预期结果：**
   - ✅ 显示确认弹窗："确定要移除此 KOL?"
   - ✅ 点击 Confirm 后，KOL 行从列表消失
   - ✅ 显示 success toast
   - ✅ 验证 DB：`SELECT * FROM kol_campaigns WHERE kolId=... AND campaignId=...` 记录已删除或 soft-deleted

**记录：**
- [ ] Remove 确认弹窗出现
- [ ] KOL 移除成功
- [ ] 页面列表更新
- [ ] DB 确认删除

---

## L2 验收项 6：权限门控（非 owner/admin 不可编辑）

**前置：** 需要两个账号
- 当前已登录：admin@kolmatrix.local（管理员）
- 另一个账号：普通 marketer（非 owner/admin）

**步骤：**

### 6a 非 owner/admin 访问 /edit 页

1. **登出** admin 账号
2. **以 marketer 身份登录**（非 campaign owner / 非 admin）
3. 进入一个**不属于该 marketer** 的 campaign 详情页
4. 尝试访问 `/en/campaigns/[id]/edit`（直接在地址栏输入或点击 Edit Brief）
5. **预期结果：**
   - ✅ **选项 A**：页面 redirect 回 `/en/campaigns/[id]` 详情页（带 forbidden/unauthorized 提示）
   - ✅ **选项 B**：显示 notFound 页面（404）
   - ✅ 编辑表单**不应该显示**（权限拒绝）

**记录：**
- [ ] Non-owner 访问 /edit 被拒绝
- [ ] 显示 redirect 或 404
- 截图：_____________________

### 6b 非 owner/admin 在详情页无法看到 inline 编辑控件

1. 在详情页 AcceptedKolsPanel 检查
2. **预期结果：**
   - ✅ Contact Status / Fee / Remove 按钮**不显示**（UI 门控）
   - ✅ KOL 行为纯只读显示
   - ✅ 与 admin 登录时的详情页形成对比

**记录：**
- [ ] Non-owner AcceptedKolsPanel inline 编辑控件不显示
- 截图（对比 admin vs non-owner）：_____________________

### 6c 权限恢复测试

1. **重新登回 admin** 账号
2. 进入同一 campaign 详情页
3. **预期结果：**
   - ✅ Edit Brief 链接可点击
   - ✅ 进入 /edit 页面成功
   - ✅ AcceptedKolsPanel inline 编辑控件**重新显示**
   - ✅ 所有编辑操作可用

**记录：**
- [ ] Admin 权限恢复，编辑控件重新可用

---

## L2 验收项 7：i18n 5 Locale 检查

**步骤：**

1. 在详情页 / 编辑页，逐一切换语言（顶部或设置菜单中）
   - English (en)
   - 中文 (zh-CN)
   - 日本語 (ja)
   - 한국어 (ko)
   - Español (es)

2. **检查以下文本是否正确显示（不应有 missing key / fallback）：**
   - "Edit Brief" 按钮文本
   - "Campaign Name" 标签
   - "Budget" 标签
   - "Status" 标签 + 选项文本（Draft / Active / Completed）
   - "Revenue" 标签
   - "Contact Status" / "Fee" / "Remove" 按钮文本
   - Success toast："Campaign updated successfully" 等

3. **预期结果：**
   - ✅ 5 种语言都显示对应的本地化文本（非英文默认值）
   - ✅ 无 `[missing: ...]` 或 `campaigns.edit.*` key 直译
   - ✅ 文本语序、标点符号符合该语言习惯

**记录：**
- [ ] English (en) 全 key 显示正确
- [ ] 中文 (zh-CN) 全 key 显示正确
- [ ] 日本語 (ja) 全 key 显示正确
- [ ] 한국어 (ko) 全 key 显示正确
- [ ] Español (es) 全 key 显示正确
- 截图（5 language 截图示例）：_____________________

---

## L2 验收项 8：Fidelity 对比（视觉设计还原）

**前置：** 需要对照设计稿（如有）

**步骤：**

1. 打开 design-draft 中 campaign-edit 页的设计稿（HTML / PNG）
2. 在浏览器并排打开 staging 的 `/edit` 页面
3. **逐一检查以下视觉元素：**
   - 页面布局（宽度、margin、padding）
   - 表单字段（input / select / textarea 样式）
   - 标签排版（font size / weight / color）
   - 按钮样式（Primary / Secondary / Danger）
   - 输入框焦点态、错误态样式
   - Status/Revenue 控件的外观
   - Inline KOL 操作按钮（icon / text / hover）

4. **预期结果：**
   - ✅ 主要布局与设计稿一致（允许微小偏差）
   - ✅ 颜色 / font / spacing 在误差范围内
   - ✅ 交互态（hover / focus / error）符合设计意图
   - ⚠️ 如有显著差异，记录具体位置和描述

**记录：**
- [ ] 页面布局还原度：___% （100 = 完全一致）
- [ ] 表单元素样式还原度：___% 
- [ ] 差异描述（如有）：_____________________
- 截图（设计稿 vs staging 对比）：_____________________

---

## 综合检查

| 项目 | 状态 | 备注 |
|-----|------|------|
| ① H6 Edit Brief 不再 404 | ☐ PASS | |
| ② campaign 字段编辑保存 | ☐ PASS | |
| ③ 状态流转生效 | ☐ PASS | |
| ④ 营收记录反映 | ☐ PASS | |
| ⑤ 名单 inline 操作 | ☐ PASS | |
| ⑥ 权限门控生效 | ☐ PASS | |
| ⑦ i18n 5 locale | ☐ PASS | |
| ⑧ Fidelity 还原度 | ☐ PASS | |

---

## 问题记录

如有任何 FAIL / ERROR，请记录：

| 序号 | 现象 | 步骤 | 预期 vs 实际 | 截图 | 严重级 |
|-----|-----|------|-------------|------|--------|
| P1 | | | | | CRITICAL / HIGH / MEDIUM |
| P2 | | | | | |

---

## 签收

- **验证者：** Reviewer
- **完成时间：** ____-__-__
- **总体结论：**
  - [ ] ✅ 全部 PASS，推进 done
  - [ ] ⚠️  部分 ISSUE，进入 fix-round
- **签名：** _____________________

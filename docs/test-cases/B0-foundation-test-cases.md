# B0 Foundation 测试用例清单（待执行）

> 对应批次：`B0-foundation`  
> 执行状态：准备完成，未执行  
> 严重级别：`P0`（阻塞签收）/ `P1`（高优先）/ `P2`（一般）

## 0. 执行前通用前置条件
- 服务以 Codex 测试方式启动并可访问 `localhost:3099`。
- 数据库已 migrate + seed，存在 1 tenant / 2 users / 12 KOL / 3 campaigns / 4 templates。
- 可使用测试账号登录。

## 1. Smoke 用例

### TC-SMOKE-001（P0）服务与首页可达
- 层级：L1
- 步骤：
1. 访问 `http://localhost:3099/login`
2. 访问 `http://localhost:3099/dashboard`
- 预期：
1. `/login` 正常渲染
2. 未登录访问 `/dashboard` 被重定向至 `/login`
- 证据：浏览器截图 + 网络状态码记录

### TC-SMOKE-002（P0）基础命令健康
- 层级：L1
- 步骤：
1. 执行 `npm run build`
2. 执行 `npx tsc --noEmit`
3. 执行 `npm run lint`
- 预期：三条命令均成功退出（code=0）
- 证据：命令输出日志

## 2. L1 结构与静态规则

### TC-L1-001（P0）HEX 硬编码扫描
- 范围：`src/`（`globals.css` 允许）
- 步骤：
1. 扫描 `src/` 中 `#[0-9a-fA-F]{6}` 命中
2. 排除 `globals.css` 后统计
- 预期：命中数为 0
- 证据：扫描命令与结果

### TC-L1-002（P0）F010 公共组件存在性
- 步骤：检查 `src/components/common/` 下 12 组件文件是否齐全
- 预期：12/12 存在且可导出
- 证据：目录清单 + 导出检查结果

### TC-L1-003（P0）Dashboard 复用 F010 组件（按 F007 裁决 §11.2 口径 — 2026-04-19 修订）

> **验证口径**：不是单文件 `page.tsx` 的 grep，而是 **import 图静态分析**（渲染树追踪）。详见 `docs/specs/B0-foundation-spec.md` §F007 Acceptance + `docs/specs/B0-f007-dashboard-plan.md` §11.2。
>
> **背景**：F007 pre-impl 审计期 Planner 修订了口径——TagChip / AvatarWithPlatformBadge / AiScoreBadge 等组件天然是 KolCard 内部消费的子组件，强求 page.tsx 顶层直接 import 会产生 `void TagChip` 虚引用，违反"不允许 inline 仿写视觉"的本意精神。新口径用"直接 ≥5 + 渲染树 12 全覆盖 + 不 inline"三条联合防线。

#### 4 步验证流程

**步骤 1：直接使用检查（≥5）**
```bash
grep -E "^import.*from ['\"]@/components/common['\"]" \
  "src/app/[locale]/(app)/dashboard/page.tsx" \
  | grep -oE "\{[^}]+\}" | tr ',' '\n' | grep -cE "\w+"
```
预期 ≥ 5（实际 5：KolCard / GlassPanel / SecondaryButton / GhostButton / SectionHeader）

**步骤 2：渲染树 12 全覆盖检查（import 图静态分析）**
从 `page.tsx` 出发追踪所有 import 链：
```
page.tsx → import 直接 5 个 + {KpiRow, AiMatchRingCard, EmailPerformanceCard, RecentActivityCard, ActiveCampaignsSection, GreetingBar}
         ↓
  KpiRow                    → StatCard
  KolCard (page.tsx 直接)   → AiScoreBadge + TagChip + AvatarWithPlatformBadge
  ActiveCampaignsSection    → CampaignRow + GhostButton
  EmailPerformanceCard      → GlassPanel
  RecentActivityCard        → ActivityFeedItem
  GreetingBar               → GradientButton
```
预期：12 个 F010 组件**全部**在渲染树覆盖表中（参见 `docs/specs/B0-f007-signoff-dispute.md` §2.3 现成覆盖表）。

辅助查询：
```bash
grep -rE "from ['\"]@/components/common['\"]" \
  "src/app/[locale]/(app)/dashboard" \
  "src/features/dashboard" \
  "src/components/common" \
  | grep -oE "\{[^}]+\}" | tr ',' '\n' | grep -oE "\w+" | sort -u
```
应列出 12 个 F010 组件名。

**步骤 3：防 inline 检查**
```bash
grep -rE '<div[^>]*className="[^"]*rounded-(xl|lg)[^"]*(border|shadow)' \
  "src/app/[locale]/(app)/dashboard/page.tsx"
```
预期：**0 命中**（无 inline 仿写卡片样式）

**步骤 4：行数约束**
```bash
wc -l "src/app/[locale]/(app)/dashboard/page.tsx"
```
预期：≤ 80 行（实际 71 行）

#### 预期全部通过则判 PASS
- 步骤 1：直接 import ≥ 5 个 F010 组件 ✓
- 步骤 2：渲染树覆盖 12 个 F010 组件（直接或间接经 KolCard / KpiRow 等封装引入都算）✓
- 步骤 3：无 inline 仿写视觉片段 ✓
- 步骤 4：行数 ≤ 80 ✓

#### 证据
- 步骤 1 shell 输出 + 直接 import 组件清单
- 步骤 2 渲染树覆盖表（可复用 B0-f007-signoff-dispute.md §2.3 的现成表）
- 步骤 3 grep 输出（应为空）
- 步骤 4 `wc -l` 结果

#### Reviewer 操作要点（重要）
- **不要**只看 `page.tsx` 单文件 grep，要看 `features/dashboard/*.tsx` + `components/common/KolCard.tsx` 等层层 import 链
- **KolCard 内部用 AiScoreBadge / TagChip / AvatarWithPlatformBadge 算覆盖这 3 个**（子组件是 F010 库的合理组合使用）
- 若只看到 5 个直接 import 就判 fail，是**旧口径**（已废弃）；新口径要 import 图静态分析

### TC-L1-004（P1）Token 映射完整性
- 步骤：对照 `design-draft/design-system.md` 检查 `globals.css @theme` token 覆盖
- 预期：关键色阶/语义 token 齐全且命名一致
- 证据：对照清单（缺失项为 0）

## 3. L1.5 手工深度验证

### TC-RLS-001~006（P0）六张业务表 RLS 三场景验证
- 覆盖表：`user`、`kol`、`campaign`、`kol_campaign`、`email_template`、`email_log`
- 每表步骤（3 场景）：
1. 设置有效 tenant 上下文后查询 count
2. 不设置 tenant 上下文直接查询
3. 设置伪造 tenant 上下文查询
- 每表预期：
1. 有效 tenant 可读到本租户数据
2. 无 tenant 返回 0
3. 假 tenant 返回 0
- 证据：18 组 SQL 与原始输出（签收报告需全文附录）

### TC-AUTH-001（P0）认证闭环
- 步骤：
1. 未登录访问 `/dashboard`
2. 错误邮箱登录
3. 正确邮箱+错误密码登录
4. 正确凭证登录
5. 检查会话 cookie
6. 刷新后会话保持
7. Sign out 后失效
- 预期：重定向、错误提示、会话建立/失效符合预期
- 证据：每步截图 + DevTools Cookie 证据

### TC-AUTH-002（P1）跨租户可见性
- 步骤：
1. marketer 登录并记录 Dashboard 核心数据
2. admin 登录并比对可见数据边界
- 预期：不同租户只见各自数据，无泄漏
- 证据：双账号截图对照

## 4. 功能与页面验收（F005/F006/F007 重点）

### TC-UI-001（P0）App Shell 导航高亮与结构
- 步骤：访问 `/dashboard`、`/kols`、`/campaigns` 等，检查 sidebar 高亮与 topbar 三段结构
- 预期：高亮准确，结构与规格一致，无额外无关模块
- 证据：多路由截图

### TC-UI-002（P0）Dashboard 五区块完整渲染
- 步骤：验证问候栏、4 KPI、Campaign 列表、AI KOL、邮件图表+活动流
- 预期：5 区块完整；`Total KOLs = 12`（seed 基线）
- 证据：整页截图 + 关键数值标注

### TC-I18N-001（P1）语言切换与回退
- 步骤：
1. 访问 `/zh/dashboard`
2. 在 EN/ZH 间切换
- 预期：路由可达，sidebar 至少 8 项文案可切换；缺失 key 回退 EN 不报错
- 证据：切换前后截图

## 5. 视觉回归（L2，需授权）

### TC-VIS-001（P0）Dashboard 像素级对比
- 步骤：
1. 固定视口 1280x2048 截图 actual
2. 与 `design-draft/stitch-references/dashboard.png` 生成 diff
3. 记录偏差点
- 预期：
1. 间距偏差 <= 2px
2. 颜色偏差 `ΔE < 2`
3. 字号 100% 匹配
- 证据：`actual` + `baseline` + `diff` 三张图

## 6. 文档与 DX

### TC-DOC-001（P1）README 可复现
- 步骤：按 README 在干净环境走一遍启动流程
- 预期：30 分钟内可看到 Dashboard
- 证据：步骤耗时记录 + 成功截图

### TC-DOC-002（P1）环境变量一致性
- 步骤：对比 `.env.example` 与代码实际读取变量
- 预期：变量名一一对应，无幽灵变量
- 证据：变量映射表

## 7. 执行记录模板（测试启动时填写）
- 用例 ID：
- 执行时间：
- 结果：PASS / PARTIAL / FAIL
- 证据路径：
- 备注与缺陷编号：

## 8. 退出标准
- P0/P1 全 PASS 才可进入签收报告。
- 任一 P0 FAIL 直接判定批次不通过并回退 `fixing`（等待修复后复验）。


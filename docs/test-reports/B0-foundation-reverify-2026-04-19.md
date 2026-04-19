# B0 Foundation 复验报告（2026-04-19）

- 执行人：Reviewer（Codex / evaluator）
- 阶段：`verifying`（按用户指令执行复验）
- 结论：**PARTIAL（未达 signoff）**

## 本轮结果

### 通过项
- Smoke：
1. `GET /login` 返回 `200`
2. 未登录 `GET /dashboard` 返回 `307 -> /login`
- 构建与静态闸门：
1. `npm run build` 通过
2. `npx tsc --noEmit` 通过
3. `npm run lint` 通过
4. HEX 硬编码扫描（排除 `globals.css`）0 命中
- 认证链路（上轮阻断已修复）：
1. 错误凭证显示 `Invalid email or password.`
2. 正确凭证可登录并进入 `/dashboard`（实际落到 `/en/dashboard`）
3. 用户菜单 `Sign out` 可回到 `/login`
- i18n：
1. 登录后可从中文切换到英文
2. URL 切换到 `/en/dashboard`，侧边栏文案同步为英文
- RLS（6 表 x 3 场景）：
1. 有效 tenant：`user=2, kol=12, campaign=3, kol_campaign=0, email_template=4, email_log=300`
2. 无 tenant：6 表全部 `0`
3. 伪造 tenant：6 表全部 `0`

### 未通过项（阻断 signoff）
- F010/F007 强约束未满足：
1. `src/app/[locale]/(app)/dashboard/page.tsx` 行数已满足（71 行）
2. 但页面未覆盖全部 12 个 F010 组件（按页面代码直接核验缺失）：
   - `StatCard`
   - `CampaignRow`
   - `AiScoreBadge`
   - `GradientButton`
   - `TagChip`
   - `AvatarWithPlatformBadge`
   - `ActivityFeedItem`

> 说明：当前实现使用了分层封装组件（如 `KpiRow`、`ActiveCampaignsSection`），功能层面可用；但按 B0 规格“Dashboard 强制复用 12 个组件（可 grep 验证）”这一硬性口径，仍判定未通过。

## 证据

- 截图：
1. `docs/test-reports/artifacts/B0-foundation/reverify-dashboard-en.png`
2. `docs/test-reports/artifacts/B0-foundation/reverify-logout-login.png`
- 上轮失败回归证据（仍有效）：
1. `docs/test-reports/artifacts/B0-foundation/login-auth-failed.png`
- 命令输出与关键检查：
1. 构建/类型/lint：通过
2. RLS 三场景计数：通过
3. Dashboard 页面静态检查：`lines=71`，但未覆盖全量 12 组件

## 处理建议

1. 若项目接受“通过组合组件间接复用 F010”，需由 Planner 明确修订 B0 验收口径（从“page.tsx 直接可 grep 全量”改为“渲染树可追踪复用”）。
2. 若保持现口径不变，则 Generator 需补齐页面级可验证复用证据（或实现调整）后再复验。


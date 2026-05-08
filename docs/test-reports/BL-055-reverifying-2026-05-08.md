# BL-055 prod-mock-purge-hotfix Reverifying 2026-05-08

> 状态：**PARTIAL / 未达 signoff**
> 触发：`origin/main` 已合入 BL-055 visual baseline workflow 产物，Reviewer 复验 BL-055 hotfix batch。

## 范围

- F001 `NetworkStatusBanner` mount-flag 防 hydration flash
- F002 `OutreachTabs` templates badge async + 删 stale tooltip
- F003 `knowledge-base` 删 `RECENT_AI_ACTIVITY` mock section
- F004 Material Symbols subset manifest 增 4 删 5 + 重生成 woff2
- F005 `SidebarLogo` / `layout.tsx` / messages 替换 `Neural Velocity` mock
- F006 `layout.tsx` unreadNotifications=1 改 0 + TODO 注释
- F007 L1 + visual regression baseline

## 执行结果

### PASS

- `npx vitest run --config vitest.config.ts "src/app/[locale]/(app)/outreach/__tests__/OutreachTabs.test.tsx" "src/components/layout/__tests__/SidebarLogo.test.tsx" "src/components/layout/__tests__/Sidebar.test.tsx" "src/components/layout/__tests__/NotificationBell.test.tsx" "src/components/layout/__tests__/TopbarActions.test.tsx" "src/app/[locale]/(app)/knowledge-base/__tests__/ProductCard.test.tsx" "src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.tsx"`
  - `6` files / `17` tests passed
- `npx vitest run --config vitest.integration.config.ts tests/integration/material-symbols-coverage.test.ts`
  - `1` file / `7` tests passed
- `npm run lint`
  - `0` errors / `3` warnings
- `npx tsc --noEmit`
  - passed
- staging 直接浏览器核对通过：
  - `/zh/dashboard`
  - `/zh/outreach`
  - `/zh/knowledge-base`
- 代码层复核结果与 staging 一致：
  - `NetworkStatusBanner` 不再在上线态闪现
  - `OutreachTabs` templates badge 显示真实计数，不再固定 10
  - `knowledge-base` 不再显示 `RECENT AI ACTIVITY`
  - `SidebarLogo` / layout 文案已改为产品 tagline
  - `NotificationBell` 在 `unread=0` 时不显示黄点

### FAIL

- `npm run test`
  - `tests/unit/visual-baselines-shape.test.ts` 失败 2 条
  - 原因：baseline 守门测试仍锁定旧的 19 张 PNG 集合
- 当前仓库实际已追踪 `24` 张 `tests/screenshots/baseline/*.png`
  - 5 张 BL-055 新 baseline 已入 git：
    - `en-knowledge-base-bottom.png`
    - `en-network-status-online.png`
    - `en-outreach-templates-badge.png`
    - `en-sidebar-logo.png`
    - `zh-sidebar-logo.png`
- `tests/unit/visual-baselines-shape.test.ts` 当前仍写死：
  - `EXPECTED_BASELINES` 仅 19 项
  - 所有 baseline width 仍强制为 `1280px`
- 实际失败中可见：
  - `en-outreach-templates-badge.png` 宽度 `976`
  - `en-sidebar-logo.png` / `zh-sidebar-logo.png` 宽度 `240`

## 证据

### 1. 新基线已落地

- `git pull --ff-only origin main` 已 fast-forward 到 `a089f38`
- `git ls-files 'tests/screenshots/baseline/*.png' | wc -l` 返回 `24`

### 2. 失败点

```text
FAIL  tests/unit/visual-baselines-shape.test.ts > visual baseline collection (MVP-vf-F007) > git tracks exactly the 19 baseline PNGs the spec covers
AssertionError: expected [ 'dashboard.png', …(23) ] to deeply equal [ 'dashboard.png', …(18) ]
```

```text
FAIL  tests/unit/visual-baselines-shape.test.ts > visual baseline collection (MVP-vf-F007) > keeps every baseline on the canonical 1280px Playwright width
AssertionError: expected [ …(24) ] to deeply equal [ …(19) ]
```

### 3. 直接 staging 证据

- `Dashboard` 页面顶部没有 `NetworkStatusBanner`
- sidebar tagline 显示 `游戏 KOL 智能营销平台`
- topbar `Notifications` 按钮没有黄色未读点
- `Outreach` 页面 templates tab 显示真实 badge 数 `5`
- `Knowledge Base` 页面底部没有 `RECENT AI_ACTIVITY` mock 区块

## 结论

- 本轮 `reverifying` 结论：**FAIL**
- 新的 visual baselines 已经入库，原始“baseline 缺失”阻断已解除。
- 但 `npm run test` 现在被 `tests/unit/visual-baselines-shape.test.ts` 卡住，说明视觉基线集合守门没有同步升级。
- 当前不满足签收条件，`docs.signoff` 仍应保持 `null`。
- 建议状态流转：继续保持 `verifying`，先把 visual-baselines-shape 守门更新到新 baseline 集合后再复验。

# B0 — App Shell 组件实现规格

> 视觉源：`design-draft/design-system.md` §9 + Stitch screen `8b4aa02ae47c4da181239399c6ef4658`
> 实现位置：`src/components/layout/`
> 适用范围：所有受保护路由（`/(app)/...`）

## 1. 组件树

```
AppShellLayout (src/components/layout/AppShellLayout.tsx)
├── Sidebar (src/components/layout/Sidebar.tsx)
│   ├── SidebarLogo
│   ├── SidebarNav (ul)
│   │   └── SidebarNavItem (8 items, 1 active)
│   └── SidebarUserChip
├── div.flex-1.flex.flex-col
│   ├── Topbar (src/components/layout/Topbar.tsx)
│   │   ├── TopbarPageTitle
│   │   ├── TopbarSearch
│   │   └── TopbarActions
│   │       ├── LanguageSwitcher
│   │       ├── NotificationBell
│   │       ├── div.divider
│   │       └── UserAvatarMenu
│   └── main (children)
```

## 2. 文件结构

```
src/
├── components/
│   └── layout/
│       ├── AppShellLayout.tsx
│       ├── Sidebar.tsx
│       ├── SidebarLogo.tsx
│       ├── SidebarNav.tsx
│       ├── SidebarUserChip.tsx
│       ├── Topbar.tsx
│       ├── TopbarSearch.tsx
│       ├── TopbarActions.tsx
│       ├── LanguageSwitcher.tsx
│       ├── NotificationBell.tsx
│       ├── UserAvatarMenu.tsx
│       └── nav-config.ts        # 8 nav 项的常量定义
├── app/
│   └── (app)/
│       ├── layout.tsx           # 用 AppShellLayout 包裹
│       ├── dashboard/page.tsx
│       └── ...
```

## 3. 组件 Props API

### 3.1 `AppShellLayout`
```typescript
interface AppShellLayoutProps {
  children: React.ReactNode;
}
// 内部从 useSession() 取 user，从 usePathname() 推断 active nav
```

### 3.2 `Sidebar`
```typescript
interface SidebarProps {
  user: { name: string; role: string; avatarUrl?: string };
  activeNavId: NavItemId; // 由 layout 推断后传入
}
```

### 3.3 `Topbar`
```typescript
interface TopbarProps {
  pageTitle: string;
  user: { avatarUrl?: string };
  unreadNotifications?: number;
}
```

### 3.4 `TopbarSearch`
```typescript
interface TopbarSearchProps {
  placeholder?: string; // 默认 i18n 后的 "Search KOLs, campaigns, emails..."
  onSearch?: (q: string) => void;
}
// Cmd+K 监听，触发 modal（B0 仅显示 hint，不实现 modal）
```

### 3.5 `LanguageSwitcher`
```typescript
interface LanguageSwitcherProps {
  currentLocale: 'en' | 'zh' | 'ja' | 'ko' | 'es';
}
// 切换写 cookie + DB user.locale + router.replace
```

### 3.6 `UserAvatarMenu`
```typescript
interface UserAvatarMenuProps {
  user: { name: string; email: string; avatarUrl?: string };
}
// 用 shadcn DropdownMenu，菜单项: Profile / Settings / Sign out
```

## 4. nav-config.ts（8 项常量）

```typescript
import {
  Dashboard,
  TravelExplore,
  Groups,
  RocketLaunch,
  ForwardToInbox,
  Inventory2,
  QueryStats,
  Settings,
} from '@/components/icons/material-symbols';

export type NavItemId =
  | 'dashboard'
  | 'kol-discovery'
  | 'kol-database'
  | 'campaigns'
  | 'email-center'
  | 'products'
  | 'analytics'
  | 'settings';

export interface NavItem {
  id: NavItemId;
  href: string;
  i18nKey: string;        // 'nav.dashboard' 等
  icon: string;           // material-symbols icon name
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',      href: '/dashboard',     i18nKey: 'nav.dashboard',     icon: 'dashboard' },
  { id: 'kol-discovery',  href: '/kols/discover', i18nKey: 'nav.kolDiscovery',  icon: 'travel_explore' },
  { id: 'kol-database',   href: '/kols',          i18nKey: 'nav.kolDatabase',   icon: 'groups' },
  { id: 'campaigns',      href: '/campaigns',     i18nKey: 'nav.campaigns',     icon: 'rocket_launch' },
  { id: 'email-center',   href: '/emails',        i18nKey: 'nav.emailCenter',   icon: 'forward_to_inbox' },
  { id: 'products',       href: '/products',      i18nKey: 'nav.products',      icon: 'inventory_2' },
  { id: 'analytics',      href: '/analytics',     i18nKey: 'nav.analytics',     icon: 'query_stats' },
  { id: 'settings',       href: '/settings',      i18nKey: 'nav.settings',      icon: 'settings' },
];

// 路径 → activeNavId
export function deriveActiveNav(pathname: string): NavItemId {
  // /[locale]/dashboard → 'dashboard'
  // /[locale]/kols/discover → 'kol-discovery'
  // /[locale]/kols/{id} → 'kol-discovery'（详情页归 Discovery 流程）
  // /[locale]/kols → 'kol-database'
  // ...
}
```

> Per-page 配置详见 `design-draft/design-system.md` §9 "Per-page 配置" 表。

## 5. Token → Tailwind 映射（Tailwind v4 CSS-first config）

Tailwind v4 不再使用 `tailwind.config.ts`，所有 token 在 `src/styles/globals.css` 的 `@theme` 块中定义。

### 5.1 完整 globals.css 结构

```css
@import "tailwindcss";

@theme {
  /* === Colors: Surface（深色 navy 阶层）=== */
  --color-navy-base: #0b1326;
  --color-navy-container: #171f33;
  --color-navy-container-low: #131b2e;
  --color-navy-container-high: #222a3d;
  --color-navy-container-highest: #2d3449;
  --color-navy-container-lowest: #060e20;
  --color-navy-bright: #31394d;

  /* === Colors: Cyan（AI 能量主色）=== */
  --color-cyan: #00E5FF;
  --color-cyan-fixed: #9cf0ff;
  --color-cyan-fixed-dim: #00daf3;
  --color-cyan-container: #00e5ff;
  --color-cyan-light: #c3f5ff;
  --color-cyan-glow: rgba(0, 229, 255, 0.20);

  /* === Colors: Purple（次级）=== */
  --color-purple: #9D50FF;
  --color-purple-container: #6e06d0;

  /* === Colors: Text === */
  --color-text-primary: #dae2fd;
  --color-text-muted: #bac9cc;
  --color-text-very-muted: #6B7280;

  /* === Colors: Accent === */
  --color-accent-warning: #fec931;
  --color-accent-error: #ffb4ab;

  /* === Colors: Outline === */
  --color-outline: #849396;
  --color-outline-variant: #3b494c;

  /* === Radius === */
  --radius-sm: 8px;
  --radius-md: 12px;          /* main containers */
  --radius-lg: 16px;          /* feature cards */
  --radius-full: 9999px;
  /* 4px 默认不要使用 */

  /* === Fonts === */
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-display: var(--font-inter), system-ui, sans-serif;
}

/* === 自定义 utilities === */

```css
@layer components {
  .glass-panel {
    @apply backdrop-blur-[24px] bg-cyan-glow;
    border: 1px solid rgba(156, 240, 255, 0.20);
    box-shadow: 0 0 40px rgba(0, 229, 255, 0.05);
  }
  .ambient-glow {
    box-shadow: 0 0 40px rgba(218, 226, 253, 0.05);
  }
  .ai-glow {
    box-shadow: 0 0 15px rgba(0, 229, 255, 0.30);
  }
  .gradient-text {
    background: linear-gradient(135deg, #00daf3 0%, #c3f5ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .gradient-cta {
    @apply bg-gradient-to-br from-cyan-fixed-dim to-cyan-light text-navy-base font-semibold;
    transition: box-shadow 200ms;
  }
  .gradient-cta:hover {
    box-shadow: 0 0 24px rgba(0, 229, 255, 0.40);
  }
  .ghost-border {
    @apply border border-outline-variant/30;
  }
}
```

## 6. 实现细节

### 6.1 SidebarLogo
- 40x40 渐变方块（`bg-gradient-to-br from-cyan-fixed-dim to-cyan-light`）+ 内嵌白色 "K" 字（`text-navy-base font-bold text-lg`）
- 旁边竖排：`KOLMatrix` (gradient-text 18px font-bold) + `NEURAL VELOCITY` (text-text-very-muted text-[9px] uppercase tracking-[0.15em] font-semibold)

### 6.2 SidebarNavItem 状态切换
```tsx
<Link
  href={href}
  className={cn(
    'flex items-center gap-3 px-3.5 py-2.5 rounded-[10px]',
    'text-[14px] font-medium transition-colors duration-200',
    isActive
      ? 'text-cyan font-semibold bg-gradient-to-r from-cyan/10 to-transparent border-l-2 border-cyan'
      : 'text-text-muted hover:text-text-primary hover:bg-navy-container-high/50'
  )}
>
  <span className="material-symbols-outlined text-[20px]">{icon}</span>
  {label}
</Link>
```

### 6.3 Topbar 玻璃拟态
```tsx
<header className="sticky top-0 z-30 h-16 px-8 flex items-center
                   bg-navy-base/85 backdrop-blur-[24px]
                   shadow-[0_4px_20px_rgba(0,0,0,0.30)]">
  <h1 className="text-[16px] font-semibold text-white">{pageTitle}</h1>
  <div className="flex-1 flex justify-center">
    <TopbarSearch className="max-w-[480px] w-full" />
  </div>
  <TopbarActions ... />
</header>
```

### 6.4 TopbarSearch
- 药丸 `rounded-full bg-navy-container-highest h-10 px-4`
- focus-within 加 `ring-1 ring-cyan ring-offset-0` + outer glow（用 `shadow-[0_0_0_4px_rgba(0,229,255,0.20)]`）

### 6.5 NotificationBell with badge
```tsx
<button className="relative p-2 text-text-muted hover:text-cyan transition-colors">
  <span className="material-symbols-outlined">notifications</span>
  {unread > 0 && (
    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
  )}
</button>
```

## 7. i18n 文案（messages/en.json 关键 key）

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "kolDiscovery": "KOL Discovery",
    "kolDatabase": "KOL Database",
    "campaigns": "Campaigns",
    "emailCenter": "Email Center",
    "products": "Products",
    "analytics": "Analytics",
    "settings": "Settings"
  },
  "topbar": {
    "searchPlaceholder": "Search KOLs, campaigns, emails...",
    "language": "EN"
  },
  "userMenu": {
    "profile": "Profile",
    "settings": "Settings",
    "signOut": "Sign out"
  }
}
```

ZH/JA/KO/ES 在 messages 复制 EN 后标 `// TODO: translate`，逐步翻译。

## 8. 验收清单（Evaluator 用）

- [ ] sidebar 240px 宽，固定左侧，背景 `#060e20`
- [ ] 8 个 nav 项顺序与图标完全匹配 §3 nav-config
- [ ] 当前页面 nav 项激活态：cyan 文字 + 左侧 2px cyan 竖条 + 渐变背景
- [ ] hover 态：文字变亮 + 背景半透明 navy
- [ ] sidebar 底部 user chip 显示 "Sarah Chen / Ops Lead"
- [ ] sidebar 没有 Help Center / Create Campaign / Connect Wallet
- [ ] topbar 64px 高，玻璃拟态背景
- [ ] topbar 三段式：左 page title / 中 search 居中 max-480px / 右 actions cluster
- [ ] search 框含 `Cmd+K` chip，focus 态 cyan 描边 + glow
- [ ] 右侧顺序：EN switcher → bell（带红点）→ 1px divider → avatar + chevron
- [ ] topbar 没有 Connect Wallet、没有横向 nav 链接
- [ ] 所有色彩与 design-system.md token 一致（无硬编码 HEX）
- [ ] 所有间距/圆角通过 Tailwind 类实现（无 inline style）
- [ ] 切换语言 nav 文案变化
- [ ] 视觉对照 Stitch screen `8b4aa02a` 接近（≤10% 差异可接受）

## 9. 后续扩展

- B1：搜索框接入 Cmd+K modal（实际搜索功能）
- B1：通知 dropdown 列表
- B1：Tenant switcher（多租户用户）
- V3：Sidebar 折叠态

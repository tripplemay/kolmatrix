# Neural Velocity - High-End Editorial Tech Aesthetic

## Core Philosophy
Global gaming marketing data is heavy, but the experience must feel weightless. Move away from standard SaaS dashboards (which feel like Excel in a box) toward a High-End Editorial immersive interface.

## Color Architecture
- Dark navy base #0b1326 carries data density
- Electric cyan #00E5FF as AI-driven energy pulse
- Purple #9D50FF for secondary actions and classification tags
- NO 1px solid borders - use surface tonal layering (surface_container_low to high)
- Primary CTA uses 135 degree gradient #00daf3 to #c3f5ff with lit-from-within feel

## Texture Rules
- AI insight cards use glassmorphism: backdrop-blur 20-30px + 20% opacity primary background
- Floating elements use ambient glow: 40px blur, 5% opacity on_surface, NEVER hard drop shadows
- Input focus: ghost border becomes 100% primary + 4px outer cyan glow

## Typography
- Inter globally
- Headline letter-spacing -0.02em
- Label color #9cf0ff (primary_fixed) for AI metadata
- Body line-height 1.5

## Roundness and Spacing
- Main containers 12px (md) softens tech edge
- Feature cards 16px (lg)
- NEVER use 4px web standard radius
- Negative space IS the divider - if crowded, add padding not lines

## Forbidden
- Pure black or pure white large surfaces
- High-opacity drop shadows (must be ambient glow)
- Standard SaaS palette (gray-white + single blue)
- Any Web3 or crypto UI elements (no Connect Wallet, no token chips)

---

# CANONICAL APP SHELL (MANDATORY for ALL screens)

Every screen in this project MUST use this exact App Shell. The shell consists of a Left Sidebar and a Top Bar. Do not invent variations. Page-specific layout lives only in the main content area.

## SIDEBAR - LEFT (240px wide, fixed, full height)

- Background: #060e20 (surface_container_lowest)
- No right border. Use a soft 20px right-side cyan glow shadow at 3% opacity for separation
- Padding: 24px
- Layout: vertical flex, between top logo block and bottom user chip

### Logo Block (top, height 56px, margin-bottom 32px)
- Horizontal: square cyan gradient tile 40x40px (rounded 10px, bg linear-gradient 135deg #00daf3 to #c3f5ff) with white K monogram inside (Inter 700 18px navy color)
- Beside it: 'KOLMatrix' wordmark Inter 700 18px white, with gradient-text style (cyan)
- Below the wordmark, tiny tagline 'NEURAL VELOCITY' uppercase Inter 600 9px tracking 0.15em color #6B7280

### Navigation List (vertical, 4px gap, flex-grow 1)
EXACTLY 8 items in this order:
1. Dashboard (icon: dashboard)
2. KOL Discovery (icon: travel_explore)
3. KOL Database (icon: groups)
4. Campaigns (icon: rocket_launch)
5. Email Center (icon: forward_to_inbox)
6. Products (icon: inventory_2)
7. Analytics (icon: query_stats)
8. Settings (icon: settings)

Each nav item:
- Padding 10px 14px, rounded 10px
- Inter 500 14px, with material icon 20px on left, 12px gap to label

Default state:
- Text color #bac9cc (slate-400)
- Icon color same
- Background transparent

Hover state:
- Text color #dae2fd (slate-200)
- Background rgba(34, 42, 61, 0.5) (navy-lighter at 50%)
- Icon shifts to cyan #00E5FF

Active state (current page only):
- Text color cyan #00E5FF (Inter 600)
- Icon cyan
- Left side: 2px solid cyan vertical bar (full height of item)
- Background: linear-gradient 90deg from rgba(0,229,255,0.10) to transparent

### User Chip (bottom of sidebar, fixed at base)
- Layout: horizontal flex, padding 12px, rounded 10px, hover bg rgba(34,42,61,0.4)
- Avatar: 36px circular, gradient ring on hover
- Right side stack: name 'Sarah Chen' Inter 600 14px white, role 'Ops Lead' Inter 400 11px color #6B7280
- Optional small chevron on far right (slate-500)

NO Help Center link. NO Create Campaign button in sidebar. NO Connect Wallet anywhere.

## TOP BAR (sticky, height 64px, full width minus sidebar)

- Background: rgba(11, 19, 38, 0.85) with backdrop-blur 24px (frosted glass)
- No bottom border. Soft ambient glow 0 4px 20px rgba(0,0,0,0.3) below for depth.
- Horizontal padding 32px, vertical centered
- Layout: 3 sections horizontally - LEFT page title, CENTER global search, RIGHT actions

### LEFT - Page title (flex-none)
- Plain page label, Inter 600 16px white
- Examples: 'Dashboard' / 'KOL Discovery' / 'KOL Profile'
- NO horizontal nav links here. NO 'Global Trends' or 'Leaderboard' style links.

### CENTER - Global search input (max-width 480px, flex-1 with mx-auto)
- Pill shape, height 40px, padding-x 16px
- Background #2d3449 (surface_container_highest)
- Left icon: material-symbols search 18px in #6B7280
- Placeholder text Inter 400 13px #6B7280: 'Search KOLs, campaigns, emails...'
- Right side small kbd chip showing 'Cmd+K' Inter 500 11px #6B7280 in subtle bordered pill
- Focus state: 1px cyan ghost border + 4px outer cyan glow at 20% opacity

### RIGHT - Action cluster (flex-none, gap 16px, items-center)
1. Language switcher: small chip Inter 500 13px #bac9cc showing 'EN' + tiny chevron, hover cyan, dropdown opens languages
2. Notification bell: material-symbols notifications 22px #bac9cc, hover cyan. Has tiny red dot badge (6px circle) at top-right when unread.
3. Divider: 1px x 24px subtle vertical line in rgba(186, 201, 204, 0.15)
4. User avatar: 32px circular avatar + small chevron beside, opens user menu on click. NO name shown in topbar (name is in sidebar user chip).

## STRICT FORBIDDEN in App Shell
- Connect Wallet button or any crypto element
- 'Create Campaign' button in sidebar (it belongs in main content header)
- Topbar nav links (Global Trends, Leaderboard, etc.) - keep topbar minimal
- Bottom border line on either sidebar or topbar - use shadow/glow instead
- Any sidebar nav item not in the 8 listed above
- Help Center or Help link in sidebar footer
- Pure black, pure white, or any 1px solid border for separation

This App Shell is the canonical reference. Every screen generated for KOLMatrix must render this shell EXACTLY as specified, with only the page-specific main content varying.
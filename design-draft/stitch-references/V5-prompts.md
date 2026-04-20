# V5 Stitch 生成 Prompts（2026-04-20 起草）

> 目的：用户手动粘贴到 Stitch web UI（https://stitch.withgoogle.com/projects/9338165817879839093）对话框生成，避免 MCP 自动生成压缩内容问题（详见 V3/V4 经验）。
>
> 视觉基调：Neural Velocity（深色 navy #0b1326 + 电流青 #00E5FF + 玻璃拟态），已在该项目 Design System Asset `18406648320972948834` 中定义。
>
> 本批次 5 张：
> - 登录（无 App Shell）
> - 注册（无 App Shell）
> - 邮件模板编辑器（in-app，App Shell + Email Center active）
> - 邮件发送队列 / 频控配置（in-app）
> - 退订管理 / Unsubscribe center（in-app）

---

## Prompt 1 — 登录页 v2（Sign in · KOLMatrix · 游戏氛围版）

> **重写版本（2026-04-20）**：v1 居中卡过于通用，缺游戏行业沉浸感。v2 采用 58/42 split layout，左侧大图承载叙事，右侧表单无卡框贴底，像 AAA 游戏启动器。

```
Generate a desktop sign-in screen for "KOLMatrix" — a gaming-vertical KOL marketing platform built for studios running global influencer campaigns. The target aesthetic is a cross between a AAA game launcher (Valorant / Destiny 2 account page) and a modern B2B SaaS login (Linear / Framer). Neural Velocity visual tone: deep navy #0b1326 base, electric cyan #00E5FF accents, glassmorphism. No sidebar. No topbar. Pre-authentication layout.

Overall layout — a hard 58/42 vertical split at 1440×900 viewport:
- LEFT column 58% (840px wide) = full-bleed cinematic hero.
- RIGHT column 42% (600px wide) = form area on a navy #0b1326 base.
- Between the two columns, a subtle cyan gradient bleed: the rightmost ~40px of the left image fades into the form column via a radial cyan glow (#00E5FF at 12% opacity), making the whole page feel continuous, not two boxes side-by-side.

LEFT column (cinematic hero, full bleed edge-to-edge, 840×900):

Render a moody, dark, cinematic scene that evokes "the global gaming creator economy" without being a literal photo of a gamer at a PC. Visual mood: a wide elevated shot of a dimly lit esports arena at night, seen from the back of the stands looking toward the stage. The stage has deep cyan stage-lights fanning upward into haze, a gigantic out-of-focus LED wall showing abstract 3D game assets (no specific IP), silhouettes of a sparse crowd. Color grade: teal shadows, cyan highlights, crushed blacks, slight film grain. Composition leaves the top third mostly empty (negative space for overlay text).

On top of this image, layer the following overlay elements (treat them as floating HUD-style UI, like a game launcher):

1. Top-left corner (40px padding from top/left): small KOLMatrix wordmark. 8px cyan dot with outer glow + "KOLMatrix" (Inter 700, 20px, white). Underneath in Inter 400 11px uppercase letter-spacing 0.5px slate-300: "CREATOR OPERATIONS · 2026".

2. Mid-left positioning, large: main tagline. Two-line headline, left-aligned, positioned at approximately 45% from viewport top, 40px left padding:
   Line 1: "Run global KOL campaigns" (Inter 700, 44px, white, tight tracking)
   Line 2: "like a launch day." (Inter 700, 44px, cyan-300 with subtle cyan glow)
   Beneath: a single-line subtitle (Inter 400, 16px, slate-300, max-width 480px): "Discover, score, and coordinate with 800K+ verified creators across YouTube, TikTok, Twitch, and Bilibili — from one command center."

3. Floating HUD "data chips" scattered in mid-image, giving game-launcher vibes. Four small semi-transparent pill cards, each with a colored dot + metric + label, positioned like drifting UI:
   - Upper-right area (roughly 60% from left, 25% from top): glass pill "850K+ creators indexed" (cyan dot, Inter 500 12px white text on rgba(255,255,255,0.08) with backdrop blur, 24px tall, 8px rounded).
   - Mid-right (roughly 70% from left, 50% from top): glass pill "AI match precision 94%" (emerald dot).
   - Lower-left (roughly 15% from left, 75% from top): glass pill "9 locales · 24/7 ops" (slate dot).
   - Lower-center (roughly 45% from left, 85% from top): glass pill "200+ studios trust us" (cyan dot).
   Each chip looks like a faint transparent tooltip hovering in 3D space above the scene.

4. Bottom-left corner (40px padding from bottom/left): three-row social proof stack.
   Row 1 (Inter 400, 11px, uppercase, slate-500, letter-spacing 0.8px): "TRUSTED BY CREATORS WORKING WITH"
   Row 2: a grayscale horizontal logo strip (5 placeholder studio logos, each ~80px wide 24px tall, bg rgba(255,255,255,0.06), Inter 600 12px slate-300 inside each showing "STUDIO A" "STUDIO B" "STUDIO C" "STUDIO D" "STUDIO E"). Logos all low-contrast so they read as ambient, not CTA.
   Row 3 blank gap.

5. Very subtle vertical light rays / particle drift overlay (implied by soft gradient streaks from bottom-up, cyan at 6% opacity). Don't overdo — just a hint of "something is happening" in the scene.

RIGHT column (form area, 600×900 on the navy base, no card frame — inputs sit directly on the navy bg like a game launcher HUD):

Positioned at viewport horizontal center of the right column, vertically centered (~200px top padding). Max form width 384px.

Content top-to-bottom:

1. Small header row: "Welcome back" (Inter 600, 26px, white) + subtitle "Sign in to continue your outreach" (Inter 400, 14px, slate-400). 36px gap below.

2. Email field:
   - Label "EMAIL" (Inter 500, 11px, slate-400, uppercase, letter-spacing 0.6px). 8px below label:
   - Input: 48px tall, no card surface — uses a transparent bg (rgba(255,255,255,0.03)) with a 1px slate-700 underline (bottom border only, 2px cyan when focused — like a game settings input). 12px horizontal padding. Placeholder "you@studio.com" (slate-500 Inter 400 14px). 20px gap below.

3. Password field: same underline-only style, placeholder "••••••••", right-side reveal eye icon (Material Symbols Outlined, slate-400, click target 24px). 12px gap below.

4. Utility row: "Remember this device" checkbox (left, cyan check, Inter 400 12px slate-300) + "Forgot password?" cyan-400 link on right (Inter 500 12px). 28px gap.

5. Primary button "Sign in" — full width 384px, 52px tall, 12px rounded, solid cyan #00E5FF bg with navy #0b1326 text, Inter 600 15px, right arrow icon. The button has a subtle cyan outer glow (outer shadow rgba(0,229,255,0.25) 0 0 24px). Hover state: stronger glow. 20px gap below.

6. Divider: thin line rgba(255,255,255,0.08) with "OR" (slate-500 Inter 500 11px uppercase letter-spacing 0.6px) centered. 20px gap below.

7. Secondary button "Continue with Google" — full width 52px, 12px rounded, bg rgba(255,255,255,0.04), 1px border rgba(255,255,255,0.08), Inter 500 14px white, Google "G" logo on left. 20px gap below.

8. Bottom text (centered): "New to KOLMatrix? <cyan link>Request access</cyan link>" (Inter 400, 13px, slate-400). The link has a tiny right arrow.

9. Far bottom of right column (40px padding from bottom-right), small text row: "© 2026 KOLMatrix · Tokyo" (slate-500 Inter 400 11px) + on the right (bottom-right corner): keyboard shortcut hint "⌘ K to search" (slate-500 Inter 400 11px) — a tiny nod to power-user game launcher UX. Only render if it doesn't crowd; fine to drop if tight.

Overall finishing notes:
- Inter font everywhere. Material Symbols Outlined for any icons.
- Absolutely no serif font.
- Do NOT draw a card/box around the form. Inputs are underline-only. Everything on the right sits directly on the navy base.
- The left image is the atmosphere. The right side is pure function. The visual cyan bleed between them unifies the two sides.
- Stay within Neural Velocity tokens from the project's Design System (Asset 18406648320972948834).
- Do NOT add sidebar, topbar, or any pre-auth chrome.
- The scene on the left should feel cinematic and slightly film-grained — avoid cartoony, avoid generic "man at gaming PC" stock photo. Think game-launcher hero, not marketing brochure.
```

> 备选方案（未采纳，保留记录）：全出血背景 + 浮动玻璃卡 pattern —— 背景图占满整屏，登录卡居中用 glassmorphism 浮在上面。这个方案氛围更强但表单易读性差，适合纯 toC 游戏（Riot / HoYoLAB），不适合 B2B 高频操作。如 v2 仍觉不够游戏，用户告知后 Planner 再出 v3。

---

## Prompt 2 — 注册 / Request Access（Sign up · KOLMatrix）

```
Generate a desktop sign-up / access request screen for "KOLMatrix". Use the same Neural Velocity visual language and the same no-sidebar pre-auth layout as the sign-in screen. Make this feel like the sister page — same card frame, same ambient cyan glow, but a longer form.

Product positioning note: KOLMatrix is invite-oriented for B2B gaming studios. This page is framed as "Request access" not open self-serve, but behaves like a signup form.

Layout:
- 1440×900 viewport, navy bg, subtle cyan radial glow at top-center.
- Centered card, ~480px wide (slightly wider than login), same surface color #14213b, 16px rounded, 40px padding.

Card content top-to-bottom:
1. KOLMatrix wordmark (cyan dot + Inter 700 24px white).
2. Header "Request workspace access" (Inter 600 22px white) + 4px subtitle "We'll review your request within one business day" (slate-400 Inter 400 13px).
3. 28px gap.
4. Two-column row (side by side, 16px gap): "First name" input + "Last name" input. Both 44px tall, same input styling as sign-in.
5. 18px gap. Full-width "Work email" input (placeholder "you@studio.com"), with a subtle hint line below in slate-500 Inter 400 12px: "Use your company email. Personal emails (@gmail, @outlook) will be flagged for manual review."
6. 18px gap. Full-width "Company / studio name" input (placeholder "e.g. Lightning Games").
7. 18px gap. Full-width "Role" dropdown select (placeholder "Select your role"): options Marketing Manager / Influencer Relations / Growth Lead / Founder / Other. Dropdown styling same as input; chevron icon on right (slate-400).
8. 18px gap. Full-width "How many KOL campaigns per quarter?" dropdown: 0–5 / 6–20 / 21–50 / 50+.
9. 18px gap. Multi-line textarea (96px tall, same styling as inputs) with label "What games are you working on?" and placeholder "e.g. Honor of Kings, Genshin Impact, Valorant — or leave blank if not applicable".
10. 16px gap. Full-width checkbox row: "I agree to the <cyan link>Terms of Service</cyan link> and <cyan link>Privacy Policy</cyan link>" (Inter 400 13px slate-300, cyan check when active).
11. 24px gap. Primary button "Submit request" (full width, cyan solid, navy text, 48px, 12px rounded, right arrow icon). Hover cyan glow.
12. 20px gap. Secondary text "Already have access? <cyan link>Sign in</cyan link>" (Inter 400 13px slate-400, centered).

Right-side helper strip (subtle, inside the card viewport or as a smaller secondary panel above the footer): Three tiny bullets "Used by 200+ studios · 800K KOL library · 9 supported languages" (Inter 400 11px slate-500, separated by cyan dots, centered row).

Footer: same as sign-in.

Typography & tokens: Inter, Neural Velocity palette. No App Shell. No success-state variation (just the empty form). All form fields default empty.
```

---

## Prompt 3 — 邮件模板编辑器（Email Template Editor · KOLMatrix）

```
Generate a desktop in-app screen for "Email template editor" in the KOLMatrix workspace. Apply the canonical App Shell (sidebar 240px with 8 nav items per the project's Design System; topbar 3-section with search + language + user chip). The sidebar active item is "Email Center" and the page is a sub-view of it.

Visual tone: Neural Velocity (deep navy, cyan primary, glassmorphism). Follow the Design System Asset `18406648320972948834` for every token.

Page structure (main content area after 240px sidebar):
- Topbar (56px tall, per canonical).
- Breadcrumb row: "Email Center / Templates / Brand intro — Honor of Kings draft" (Inter 400 13px slate-400 / slate-300 / white, "/" dividers in slate-600).
- Page header row (64px tall): H1 "Brand intro — Honor of Kings" (Inter 600 24px white), small status chip to the right "Draft" (amber bg 15% opacity, amber-300 text, 10px rounded, 11px Inter 500). Actions on far right: "Save draft" (secondary ghost button, slate-300 Inter 500 14px) + "Preview" (secondary with cyan border, cyan text) + "Send test" (primary cyan solid navy text). Gap 8px between buttons.
- Two-column body split: LEFT column 62% width = editor; RIGHT column 38% width = live preview.

LEFT (editor):
Section "Recipient context" — surface card (surface-1), 12px rounded, 20px padding.
- Two-column row:
  - "Campaign" dropdown (selected value "Spring — Honor of Kings Preseason Q2"), chevron icon right.
  - "KOL segment" dropdown (selected "Top 50 Mobile MOBA — Asia"), chevron.
- Below: "Personalization tokens" chip row: {{kol.name}}, {{kol.handle}}, {{kol.platform}}, {{campaign.title}}, {{brand.name}}. Each chip: dark-surface 1px border rgba(255,255,255,0.08), 10px rounded, Inter 500 12px slate-200, 4-8px padding, a small "+" icon at the right of each indicating click-to-insert.

24px gap.

Section "Subject line" — same surface card.
- Single-line input (44px) with placeholder style and current value "Let's make your next {{campaign.title}} campaign legendary, {{kol.name}}". On the right of the input a tiny character counter "64/80" slate-500 Inter 400 11px.
- Below input a helper row: AI suggestion pill with a tiny spark icon + "Suggest subject lines with AI" cyan-400 link.

24px gap.

Section "Body" — bigger surface card.
- Formatting toolbar (40px tall, bg surface-2, 8px rounded top): buttons Bold / Italic / Link / Bullet / Numbered / Quote / Code / Divider / AI rewrite (the AI rewrite button has a small cyan sparkle icon and is highlighted).
- Editor canvas (min 480px tall, bg surface-1, monospace-friendly but Inter 14px line-height 1.6 slate-100 for regular content). Show realistic draft content across ~14 lines:
  "Hi {{kol.name}},
  
  I'm reaching out because your recent {{kol.platform}} coverage of mobile MOBAs — especially the breakdown of ranked-push strategies — stood out to us. We've been following GamerXia-tier creators who actually play, not just perform.
  
  {{campaign.brand_name}} is launching the Honor of Kings Preseason Q2 push across APAC and SEA. We'd like to invite you to co-create a 3-video series around preseason meta, featuring early-access gameplay. Budget range is $4,800–7,200 USD depending on scope, with performance upside tied to view milestones.
  
  Can we hop on a 15-min call next week? I'll send a full brief beforehand.
  
  Best,
  Sarah Chen
  Influencer Relations · KOLMatrix × {{campaign.brand_name}}"
  
  Make the {{...}} tokens appear as small chips inline in the editor (subtle cyan background with cyan-300 text, 4px padding, 4px rounded).

- Below editor: footer strip with word count "182 words · 4 paragraphs" (slate-500 Inter 400 12px, left) and "Last edited 2 min ago by Sarah Chen" (slate-500, right).

RIGHT (live preview):
- Surface card, 12px rounded, 24px padding, surface-1.
- Small header "Preview · as GamerXia will see it" (Inter 500 12px slate-400 uppercase letter-spacing 0.4px) + toggle pills: "Desktop" / "Mobile" (Desktop active: cyan-tinted pill; Mobile inactive: ghost).
- Inside the preview, render a realistic email client frame:
  * From: "Sarah Chen <marketer@send.kolquest.com>" (slate-300 Inter 500)
  * To: "GamerXia <gamerxia@youtube.example>" (slate-400)
  * Subject rendered: "Let's make your next Spring — Honor of Kings Preseason Q2 campaign legendary, GamerXia"
  * Body: exact same copy as the editor but with tokens replaced with concrete values (kol.name → GamerXia, brand → Lightning Games, campaign.title → Spring — Honor of Kings Preseason Q2). Keep paragraph structure.
  * At the bottom, a small unsubscribe footer line in slate-500 Inter 400 11px: "You're receiving this because KOLMatrix × Lightning Games reached out. <cyan link>Unsubscribe</cyan link>"
- Below preview: deliverability hint row: a mini stat ribbon (3 items horizontally): "Spam score: 2.1/10 · Good" (green dot) · "Readability: Grade 9" (cyan dot) · "Tone: Warm / professional" (cyan dot). Each item Inter 400 12px slate-300.

Apply all Neural Velocity tokens (sidebar active state, topbar search, language switcher, user chip) per canonical App Shell. Do NOT skip the sidebar. Keep the layout feeling dense but breathable — this is a power user tool.
```

---

## Prompt 4 — 邮件发送队列 / 频控配置（Send Queue & Rate Limits · KOLMatrix）

```
Generate a desktop in-app screen for "Send queue & rate limits" under Email Center. Use the canonical App Shell (240px sidebar with 8 items, active = "Email Center"; topbar 3-section). Neural Velocity visual tone.

Main content (after sidebar):
- Topbar.
- Breadcrumb: "Email Center / Send queue" (slate-400 / white).
- Page header row: H1 "Send queue" (Inter 600 24px). To the right: connection status chip "Resend · Connected" (cyan pulse dot + Inter 500 12px slate-200), next to it a small "Rate limit: 10 msg/s · 500/day" summary (Inter 400 12px slate-400). Far right: secondary button "Rate limit settings" (ghost) + primary cyan button "Pause queue" (with pause icon).

Content vertical sections:

SECTION A — Live status strip (88px tall), a full-width surface card.
Four KPI tiles horizontally with small dividers between:
- "Queued" big number 2,847 (Inter 700 30px white) + delta "+124 in last 10m" (cyan-300 Inter 400 12px).
- "Sending now" 48 (Inter 700 30px cyan-300) + a small pulsing activity icon.
- "Sent today" 7,912 (Inter 700 30px) + sub "of 10,000 daily cap" slate-400.
- "Failed (last hour)" 3 (Inter 700 30px amber-300) + sub "Click to inspect" cyan-400 link.
A thin progress bar at the bottom of the strip showing daily cap usage (79% full, cyan gradient).

24px gap.

SECTION B — Rate limits card (surface-1, 16px rounded, 24px padding).
Title "Rate limit policy" (Inter 600 16px) + subtitle "Enforced per workspace; prevents spam flags and carrier throttling".

Three horizontal config rows, each with label + numeric input with stepper + unit text:
- "Global messages per second": [ 10 ] (narrow 72px input), stepper buttons, "msg/s" label.
- "Daily send cap": [ 10000 ], "msg/day".
- "Per-recipient cooldown": [ 72 ], "hours".

Below: toggle switches (cyan active) for:
- "Pause automatically if bounce rate > 5% in a 1h window" (on)
- "Pause automatically if complaint rate > 0.1% in a 1h window" (on)
- "Smart dispatch: spread sends across business hours (9–18 recipient local)" (on)
- "Require manual approval for cohorts > 500 recipients" (off)

Each row Inter 500 13px white label with a slate-400 Inter 400 12px helper line below.

"Save policy" button at card bottom-right (primary cyan).

24px gap.

SECTION C — Queue table (surface-1, 16px rounded, 0px padding — table is full bleed).
Table header row (52px, bg surface-2, Inter 600 12px slate-400 uppercase letter-spacing 0.4px):
| Status | Recipient | Campaign | Template | Scheduled | Retries | Last attempt | |
Row height 64px, 12 rows. Mix of statuses shown as pill badges:
- "Queued" (slate pill), "Sending" (cyan pill with pulse), "Sent" (emerald pill with check), "Failed" (amber pill with alert icon, e.g., "Hard bounce").
Realistic content:
- GamerXia (YouTube, 850K) · Spring — Honor of Kings Preseason Q2 · Brand intro — HoK v3 · 2026-04-20 14:30 UTC+9 · 0 · —
- ValorantAce (TikTok, 310K) · Valorant Ep. 9 Launch · Product seeding v1 · 2026-04-20 14:31 · 1 · 502 upstream
- MOBA_Queen (YouTube, 1.2M) · Spring — HoK Q2 · Brand intro — HoK v3 · 2026-04-20 14:32 · 0 · —
- SeoulGuardians (Twitch, 180K) · Dota 2 EG Sponsorship · Custom brief · 2026-04-20 14:33 · 2 · Complaint received
- (8 more rows, varied content, at least 1 emerald "Sent" row, 1 amber "Hard bounce" row).

Row hover state: subtle surface-2 tint.
Row trailing: kebab menu icon (slate-400).

Table footer: pagination (25 · 50 · 100 per page, current 25), total "2,847 items" slate-400 Inter 400 12px, arrow buttons.

Section D (tiny, below table) — info line "Webhook events are logged at /api/webhooks/resend (see Integrations)" slate-500 Inter 400 12px.

Use Neural Velocity tokens throughout.
```

---

## Prompt 5 — 退订管理 / Unsubscribe center（Unsubscribe · KOLMatrix）

```
Generate a desktop in-app screen for "Unsubscribe management" under Email Center. Canonical App Shell (240px sidebar, 8 nav items, active "Email Center"; topbar 3-section). Neural Velocity visual tone.

This page has two distinct responsibilities visualized as two tabs:
- TAB 1: Suppression list — workspace-wide unsubscribes / bounces / complaints we must honor.
- TAB 2: Public unsubscribe page preview — what a recipient sees when clicking the {{unsubscribe}} link in our emails.

Main content (after sidebar, after topbar):
- Breadcrumb "Email Center / Unsubscribe".
- Page header H1 "Unsubscribe & suppression" (Inter 600 24px). Subtitle (slate-400 Inter 400 14px): "Compliance-critical. Entries here are globally enforced and cannot be overridden without reauthorization."
- Action area far right: secondary "Export CSV" ghost button + primary cyan "Import suppression list" button.

Tab bar (48px tall, underlined cyan when active):
[ Suppression list · 1,284 ]   [ Public page preview ]

CONTENT under TAB 1 (Suppression list, this is the default visible tab):

Filter row (surface-1 card, 16px rounded, 16px padding, displayed as one compact row):
- Search input (placeholder "Search by email or domain…") 320px wide.
- Dropdown "Reason: All" (options All / Unsubscribed / Hard bounce / Soft bounce / Spam complaint / Manual add).
- Dropdown "Time: Last 30 days".
- Dropdown "Source campaign: All".
- On the right: a cyan filter chip count "3 filters active · Reset".

12px gap.

Summary KPI row (4 small tiles in a single card, each 120px tall):
- Total suppressed: 1,284 (Inter 700 28px)
- Unsubscribed (recipient action): 843 · 65.7% (green dot)
- Bounces (hard): 287 · 22.4% (amber dot)
- Complaints: 154 · 12.0% (red dot)

Each tile has a tiny sparkline placeholder (7-day trend) in cyan beneath the number.

12px gap.

Main table (surface-1, 16px rounded, full bleed):
Header (52px, surface-2, uppercase Inter 600 12px slate-400):
| Email | Reason | Source campaign | Added | Last sent attempt | Note | |
Row height 64px, 10 rows.

Realistic content (anonymize slightly):
- GamerXia@outreach.example · Unsubscribed · Spring — HoK Q2 · 2026-04-19 · 2026-04-18 17:12 · "Preferred LINE instead of email" · kebab
- noreply@bouncer.test · Hard bounce · Valorant Ep. 9 Launch · 2026-04-19 · 2026-04-19 02:01 · "550 no such user" · kebab
- fan@community.kr · Spam complaint · Dota 2 EG · 2026-04-18 · 2026-04-17 09:44 · "Marked as spam via Gmail" · kebab
- 7 more varied rows.

Reason column rendered as pill badges: Unsubscribed (slate), Hard bounce (amber outline), Spam complaint (red outline).

Row trailing kebab (slate-400). On hover: action drawer showing View history / Reauthorize (disabled by default) / Remove (destructive, red, requires 2nd-factor modal — hint in a small slate-500 row).

Table footer: pagination 25 per page, "1,284 items", arrow controls.

CONTENT under TAB 2 (Public page preview, grayed-out and shown smaller at the bottom of this screen as a secondary preview section so Stitch renders both):
A rounded 16px card (surface-2, 32px padding, max-width 640px centered in the content area or placed below the suppression table in a separate "Preview section" with a heading "What recipients see at /unsubscribe/:token"):
- KOLMatrix wordmark (cyan dot + small).
- Header "Unsubscribe from KOLMatrix × Lightning Games" (Inter 600 20px).
- Subtext "We're sorry to see you go. This will remove you from future outreach for the Spring — Honor of Kings Preseason Q2 campaign as well as all Lightning Games workspaces. Confirmed within 24 hours." (slate-300 Inter 400 14px).
- Radio options vertical:
  · "Unsubscribe from this campaign only" (selected)
  · "Unsubscribe from all Lightning Games campaigns"
  · "Unsubscribe from all KOLMatrix workspaces (global)"
- Textarea (80px) "Tell us why (optional)" with placeholder "We'd love to improve…".
- Primary cyan button "Confirm unsubscribe" (full width 48px).
- Secondary ghost button "Never mind, keep me subscribed".
- Footer line slate-500 Inter 400 11px: "Your request is processed by KOLMatrix on behalf of Lightning Games · support@kolquest.com".

Entire page uses Inter font, Neural Velocity tokens, canonical App Shell. Sidebar active item = "Email Center". Do NOT simplify the suppression table — show 10 full rows with varied data.
```

---

## 使用说明

1. 打开 https://stitch.withgoogle.com/projects/9338165817879839093
2. 对话框里一次粘一个 prompt（不要合并）
3. Stitch 生成完 screen 后，用 MCP `get_screen` 或页面 UI 直接 Export HTML 下载到 `design-draft/stitch-references/`（命名约定：login.html / signup.html / email-template-editor.html / email-send-queue.html / email-unsubscribe.html）
4. 5 张都生成完后告诉我，我更新 README.md + visual-baseline.md 附录 + project-status.md，并帮你 commit

## 预期输出

| 文件 | 对应业务批次 |
|---|---|
| login.html + .png | B0 Auth（代码已实现，补视觉）|
| signup.html + .png | B0/B9（看产品决策是否做自助注册）|
| email-template-editor.html + .png | B4 |
| email-send-queue.html + .png | B4 |
| email-unsubscribe.html + .png | B4 合规 |

生成过程中若有 prompt 产出不符合预期，告诉我哪张需要我调整 prompt 再生成一次。

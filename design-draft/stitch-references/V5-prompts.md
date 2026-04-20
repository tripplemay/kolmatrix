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

## Prompt 1 — 登录页（Sign in · KOLMatrix）

```
Generate a desktop sign-in screen for "KOLMatrix" — a gaming-vertical KOL marketing platform. Visual tone = Neural Velocity (deep navy #0b1326 base, electric cyan #00E5FF accents, subtle glassmorphism). No sidebar, no topbar — this is a pre-authentication page.

Layout:
- 1440×900 viewport, full-height dark navy background with a very subtle radial cyan glow behind the card (top-center, feels like aurora / ambient).
- Horizontally centered single-column card, ~440px wide, surface color #14213b with 1px subtle inner border (rgba(255,255,255,0.06)), 16px rounded corners, soft shadow.
- Card padding 40px.

Card content top-to-bottom:
1. KOLMatrix wordmark (Inter 700, 24px, color white) with a tiny cyan dot preceding it (8px circle, #00E5FF with outer glow). Subtitle below: "Sign in to your workspace" (Inter 400, 14px, slate-400).
2. 32px gap.
3. Email label (slate-300 Inter 500 12px, letter-spacing 0.4px uppercase) + email input (bg #0b1326, 1px border rgba(255,255,255,0.08), 12px rounded, height 44px, placeholder "you@company.com" slate-500). Focus state: border shifts to cyan glow.
4. 20px gap. Password label + password input (same styling, placeholder "••••••••"), with a right-side reveal eye icon (Material Symbols Outlined, slate-400).
5. 12px gap. One-row utility area: "Remember me" checkbox (cyan check when active, small Inter 400 13px slate-300) on the left, "Forgot password?" cyan-400 link on the right.
6. 24px gap. Primary button "Sign in" — full width, 48px tall, 12px rounded, background solid #00E5FF with navy text (#0b1326), Inter 600 15px, with a right-pointing arrow icon. Hover state: faint outer cyan glow.
7. 16px gap. Thin divider line (rgba(255,255,255,0.08)) with "or continue with" (slate-500 Inter 400 12px) centered on it.
8. 16px gap. Single "Continue with Google" secondary button, 48px tall, 12px rounded, bg rgba(255,255,255,0.04), 1px border rgba(255,255,255,0.08), Inter 500 14px white text, Google "G" logo icon on the left.
9. 28px gap. Bottom center text "New to KOLMatrix? <cyan link>Request access</cyan link>" (Inter 400 13px slate-400).

Footer strip at viewport bottom (32px tall, slate-500 Inter 400 11px, centered): "© 2026 KOLMatrix · Tokyo · support@kolmatrix.local" with a faint cyan dot separator.

Typography: Inter everywhere. No unnecessary icons. No serif font. Stay within Neural Velocity tokens from the project's Design System. Do NOT add a sidebar or topbar.
```

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

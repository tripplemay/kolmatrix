# BL-080 Illustration Prompts — 8 AI Image Generation Templates

> **Sprint：** BL-080-F001
> **Type：** Planner preempt（F001 由 Planner 越界产出 — generator/planner 域边界一次性破例；用户 5/28 主动询问 prompts 位置 + 节省 critical path 时间；F006 Reviewer L2 抽样验内容质量）
> **执行者：** 用户（你）拿 prompts 跑 DALL-E 3 / Midjourney / SD
> **关联：** docs/specs/BL-080-landing-illustration-mockups-spec.md §4.F001
> **产出目标：** 8 PNG illustration 放 `public/landing/illustrations/`，用户验收后通知 Generator 启 F003

---

## 通用使用说明（必读）

### 跑 AI 流程

1. 选 AI tool: **DALL-E 3**（ChatGPT Plus）/ **Midjourney v6+** / **Stable Diffusion XL**（推荐 DALL-E 3 易控品牌一致性，Midjourney 出图质感最好但需 niji/realistic 模式细调）
2. 每个 prompt 完整复制粘贴（含全 7 sections）
3. 每张 illustration 跑 4-8 次 iteration，挑最符合 brand 的版本
4. 放对应文件名到 `public/landing/illustrations/`

### Brand Color Hex（KOLMatrix 实际 token，per BL-078 lock + globals.css）

| Token | Hex | 用途 |
|---|---|---|
| **Cyan primary** | `#00E5FF` | electric AI pulse, primary accent, glows, CTAs, data lines |
| **Cyan fixed (text)** | `#9cf0ff` | softer cyan for text on dark bg |
| **Purple primary** | `#9D50FF` | secondary accent, badges, classification chips |
| **Purple fixed (text)** | `#c8a3ff` | softer purple for text on dark bg |
| **Landing canvas (deep)** | `#080f1c` | main page background, deepest navy |
| **Landing canvas-elevated** | `#141d31` | section / card background, slightly lifted |
| **Surface low** | `#131b2e` | mid-level UI panels |
| **Surface bright** | `#31394d` | borders / dividers / elevated cards |
| **Landing ink (off-white)** | `#ebeef5` | primary text on dark bg |
| **Landing ink-muted** | `#b9c1ce` | body / secondary text |

### 全局 Style Guard（每个 prompt 末尾默认追加）

> Modern minimal SaaS UI flat illustration with subtle linear gradients. Isometric 12° tilt OR straight-on UI mockup framing. Sharp clean lines, rounded corners (12-18px radius), micro-elevation shadows (subtle multi-layer drop-shadows, no harsh edges). Dashboard cards with breathing white space inside dark navy canvas. Data visualization elements (charts, sparklines, KPI numbers, progress bars). Cyan/purple glow halos on key interactive elements. NO photorealistic. NO actual text labels (Generator will overlay i18n at integration time, just use placeholder lorem rectangles or stylized line shapes for text blocks). NO third-party logos. NO mascots / characters / faces. Inspired by Linear / Vercel / Stripe / Plausible aesthetic. High detail but uncluttered.

---

## 1️⃣ Hero Illustration — KOLMatrix Workspace Overview

**File:** `public/landing/illustrations/hero-illustration.png`  
**用途:** Hero section 主视觉（LCP 关键路径，priority load）  
**Aspect:** 16:10 widescreen 1920×1200 推荐

### Prompt（复制粘贴）

```
Subject: KOLMatrix unified workspace overview dashboard for B2B SaaS marketing platform.
A central hero scene showing a marketer's command center: a primary product UI panel
on the left (KOL discovery list with avatars, follower numbers, engagement scores,
match percentage rings) and a secondary AI recommendation sidebar on the right
(stack of suggested KOL cards with confidence badges). Subtle floating elements:
KPI cards (1.5K KOLs, 47 active campaigns, $12.4K ROI), bar chart sparklines,
network connection lines between KOLs.

Style: Modern minimal SaaS UI flat illustration with subtle gradients. Front-facing
3/4 perspective (NOT isometric, slight 5° depth tilt). Sharp clean lines, rounded
corners (16px radius), micro-elevation shadows. Dashboard cards with breathing white
space inside dark navy canvas. Cyan/purple glow halos on AI sidebar + key data lines.

Brand colors:
- Main canvas background: deep navy #080f1c
- Section/card backgrounds: elevated navy #141d31 to #131b2e
- Card borders / dividers: #31394d (subtle)
- Primary accent (highlights, AI glow, top buttons): electric cyan #00E5FF
- Secondary accent (badges, classification chips): purple #9D50FF
- Text on dark: off-white #ebeef5 (primary), #b9c1ce (muted)
- KPI numbers / sparklines: cyan #9cf0ff with subtle glow
- Data charts: cyan-to-purple gradient

Composition: Centered with generous breathing room. Main KOL list panel takes 60%
left, AI sidebar 25% right, floating KPI cards above and to the sides (15%). Subtle
mesh gradient background (radial cyan-to-purple blobs at low opacity ~8%). Slight
depth via micro-shadows. Information hierarchy: hero element (KOL grid) → AI sidebar
→ floating KPIs (lowest visual weight).

Mood: Professional, futuristic, AI-powered, B2B SaaS, confident, calm. Linear-app
aesthetic. Marketer-friendly (not techie). Sophisticated dark theme that says
"trust this tool with your data."

Avoid: NO photorealistic 3D rendering, NO actual text labels (use placeholder
horizontal lines or stylized line shapes for text blocks), NO third-party logos
(Twitter/YouTube/etc icons OK as generic shapes), NO human faces / mascots / cartoon
characters, NO neon-overload (cyan/purple stays as accent not bg), NO gridlines
visible, NO scroll bars.

Output spec: 1920×1200 PNG (16:10 widescreen), transparent or solid #080f1c bg,
target file size ~600KB-1MB, optimized for next/image priority load.
```

---

## 2️⃣ Features Card #1 — Brief AI

**File:** `public/landing/illustrations/feature-brief.png`  
**Aspect:** 4:3 ratio 1200×900 推荐（适配 Features card slot）

```
Subject: AI-powered campaign brief creation interface. Show a marketer typing a
natural-language brief input on the left, with the AI parsing it into structured
fields (Product, Markets, Budget, Target Audience, Categories, Dates) on the right.
Cyan flowing connection lines from input → AI brain icon → output fields. Floating
chip badges showing parsed entities ("Mobile Gaming", "JP/KR", "$10K USD",
"Gen Z Players").

Style: Modern minimal SaaS UI flat illustration. Straight-on UI mockup framing
(not isometric). Sharp clean lines, 14px radius cards, micro-elevation shadows.

Brand colors:
- Card bg: #141d31 / panels #131b2e
- AI connection lines + glow: cyan #00E5FF
- Parsed chip badges: purple #9D50FF tint with cyan border
- Input field cursor: cyan #9cf0ff
- Text placeholders (use line shapes): ink #ebeef5 / muted #b9c1ce

Composition: Two-panel layout. Left 50% = natural language input ("Q2 2026 push
Genshin Impact to JP gamers, budget $10K..."). Right 50% = structured AI output
with chip badges. Center = pulsing AI brain icon (cyan glow) with connection lines.

Mood: AI magic, instant translation, B2B productivity. The "wow moment" of
natural language → structured data.

Avoid: NO real product logos (Genshin Impact name is OK as text placeholder), NO
photorealistic, NO actual readable text (use line shapes), NO cartoon AI characters
(brain icon should be abstract neuron / synapse shape, not anthropomorphic).

Output spec: 1200×900 PNG (4:3), solid #080f1c bg, ~400-600KB.
```

---

## 3️⃣ Features Card #2 — Match (KOL Discovery)

**File:** `public/landing/illustrations/feature-match.png`  
**Aspect:** 4:3 ratio 1200×900

```
Subject: KOL matching workspace with intelligent filter sidebar on the left and
KOL grid view on the right. Sidebar shows filter chips (Region: JP, Platform:
YouTube, Followers: 100K-1M, Categories: Gaming, Engagement >5%). Grid shows
KOL cards with avatar circles, handle, follower count, match score ring (%),
relationship status badge. One KOL card highlighted/selected with cyan glow.

Style: Modern minimal SaaS UI flat illustration. Straight-on UI framing. Sharp
clean lines, 16px radius cards.

Brand colors:
- Filter sidebar bg: #131b2e
- KOL cards: #141d31
- Selected card glow: cyan #00E5FF (outline + shadow)
- Match score rings: cyan-to-purple gradient
- Active filter chips: cyan #00E5FF border + cyan-fixed #9cf0ff text
- Inactive filter chips: muted ink #b9c1ce

Composition: 30% left sidebar (filter stack vertical), 70% right grid (6 KOL cards
in 3-column layout). Cards include avatar circle (gradient placeholder), handle line
shape, follower number ("1.2M"), match ring 87%, status pill ("New" / "Engaged").

Mood: Powerful filtering, AI-augmented discovery, marketer in control.

Avoid: NO real avatars (use abstract circle gradients), NO readable handles, NO
brand logos.

Output spec: 1200×900 PNG, solid #080f1c bg, ~400-600KB.
```

---

## 4️⃣ Features Card #3 — Reach (Email Outreach)

**File:** `public/landing/illustrations/feature-reach.png`  
**Aspect:** 4:3 ratio 1200×900

```
Subject: Email outreach composer with sending performance dashboard. Left side = AI
email composer (subject line, body preview with personalization tokens shown as
purple highlighted chips), template selector dropdown. Right side = sending
performance bar chart (open rate / reply rate / bounce rate) + recently sent table
with status pills (Sent / Opened / Replied / Bounced).

Style: Modern minimal SaaS UI flat illustration. Straight-on. 14px radius cards.

Brand colors:
- Composer bg: #141d31
- Performance dashboard bg: #131b2e
- Personalization token chips: purple #9D50FF
- Sent pills (Opened): cyan #00E5FF
- Replied pills: cyan-fixed #9cf0ff (lighter, success)
- Bounced pills: muted red-orange (use sparingly, secondary)
- Bar chart bars: cyan-to-purple vertical gradient

Composition: 55% left composer (subject, body preview lines, template selector,
"Send Batch" cyan CTA button), 45% right dashboard (bar chart 60% + sent table 40%
stacked vertically). Subtle cyan glow on "Send Batch" CTA.

Mood: Compliance-grade email power, AI-personalized, marketer-friendly automation.

Avoid: NO real email addresses, NO readable subject lines, NO brand logos.

Output spec: 1200×900 PNG, solid #080f1c bg, ~400-600KB.
```

---

## 5️⃣ Features Card #4 — Insight (Analytics + Reports)

**File:** `public/landing/illustrations/feature-insight.png`  
**Aspect:** 4:3 ratio 1200×900

```
Subject: Analytics dashboard with KPI strip, line chart trend, and weekly report
preview. KPI strip top (4 cards: Total Reach, Engagement, ROI, Active Campaigns).
Below: large line chart (4-week trend with two intersecting curves cyan + purple).
Right side: weekly report card preview with subtle structured layout (header,
charts, bullet insights).

Style: Modern minimal SaaS UI flat illustration. Straight-on. 16px radius cards.

Brand colors:
- KPI cards bg: #141d31
- Chart bg: #131b2e
- Line chart curve 1: cyan #00E5FF
- Line chart curve 2: purple #9D50FF
- KPI numbers: ink #ebeef5 (large)
- Trend arrows (up): cyan-fixed #9cf0ff
- Gradient fill under lines: cyan-to-transparent / purple-to-transparent

Composition: KPI strip top 25% (4 horizontal cards), line chart middle 50%, weekly
report preview right 25% (vertical card with sections). Generous spacing.

Mood: Data-driven decision making, marketer transparency, beautiful analytics.

Avoid: NO real numbers as text (use line shapes), NO chart axes labels, NO
percentages with specific values.

Output spec: 1200×900 PNG, solid #080f1c bg, ~400-600KB.
```

---

## 6️⃣ Features Card #5 — CRM (Relationship Pipeline)

**File:** `public/landing/illustrations/feature-crm.png`  
**Aspect:** 4:3 ratio 1200×900

```
Subject: KOL relationship pipeline kanban-style view. 5 columns representing pipeline
stages (Prospect / Contacted / Negotiating / Active / Completed). Each column has
2-3 KOL relationship cards stacked, showing avatar circle, handle line, current
stage indicator, last activity timestamp shape. Cyan progress bars at column
headers showing stage health %.

Style: Modern minimal SaaS UI flat illustration. Straight-on kanban framing.
14px radius cards.

Brand colors:
- Kanban column bg: #131b2e
- KOL relationship cards: #141d31 with #31394d border
- Active stage indicator: cyan #00E5FF
- Completed stage badge: purple #9D50FF
- Stage progress bars (column headers): cyan-to-purple gradient
- Drag-and-drop hint shadow: subtle cyan glow

Composition: 5 columns horizontal, each ~20% width. 2-3 cards per column with
slight vertical stagger. Column headers contain title placeholder + progress bar.

Mood: Organized, professional B2B CRM, relationship lifecycle visibility.

Avoid: NO real names, NO photos, NO brand logos.

Output spec: 1200×900 PNG, solid #080f1c bg, ~400-600KB.
```

---

## 7️⃣ EmailCenterDemo Main Illustration

**File:** `public/landing/illustrations/email-center-illustration.png`  
**Aspect:** 16:9 ratio 1600×900（适配 EmailCenterDemo 主视觉）

```
Subject: Comprehensive email center workspace. Left third = composer with AI
suggestion tooltip popping up ("Suggested: 3 personalization tokens"). Center
third = sent emails table with multiple status pills (Delivered / Opened / Replied /
Pending). Right third = compliance + deliverability dashboard (DKIM verified ✓ /
SPF ✓ / DMARC ✓ / Reputation score 98 / Bounce rate 0.4%). Subtle floating
notification toast above center ("3 new replies").

Style: Modern minimal SaaS UI flat illustration. Slight 5° depth tilt (front-3/4
perspective). Sharp clean lines, 16px radius cards.

Brand colors:
- Workspace bg: deep navy #080f1c
- Three panels: #141d31 / #131b2e alternating
- AI suggestion tooltip: cyan #00E5FF border + glow
- Status pills: cyan (Opened), cyan-fixed #9cf0ff (Delivered), purple #c8a3ff
  (Replied), muted ink (Pending)
- Compliance ✓ icons: cyan-to-purple gradient
- Reputation score "98" large number: cyan-fixed
- Notification toast: subtle purple #c8a3ff glow

Composition: Three vertical columns of equal weight. Floating toast offset slightly
right of center, ~30% from top. Mesh gradient subtle bg blobs at corners.

Mood: Email center power, compliance-first, AI-augmented productivity. The
"control panel" of email marketing operations.

Avoid: NO real email content, NO real domains, NO third-party email service logos.

Output spec: 1600×900 PNG (16:9), solid #080f1c bg, ~600-900KB.
```

---

## 8️⃣ BeforeAfter Pair Illustration

**File:** `public/landing/illustrations/before-after-illustration.png`  
**Aspect:** 16:9 ratio 1600×900（左右对比，single composite image）

```
Subject: Side-by-side comparison composite. LEFT half = "Before" chaos: scattered
KOL spreadsheets, multiple browser tabs visible at edges (Excel, Gmail tab, multiple
social profile windows partially showing), tangled connection lines between them,
muted desaturated palette, slight chaos / clutter feel. RIGHT half = "After"
clarity: KOLMatrix unified workspace (similar to Hero illustration but more
compact: KOL grid + AI sidebar + KPI strip), clean composition, full saturation
brand colors, clear information hierarchy.

Style: Modern minimal SaaS UI flat illustration. Two distinct halves separated by
a subtle vertical gradient divider (cyan thin line glow).

Brand colors:
- LEFT (Before): desaturated navy bg #1a1f2e, muted grey-ink #707a89, no cyan/purple
  glows, faded colors (50% saturation), greyed-out card outlines
- RIGHT (After): full brand — canvas #080f1c, ink #ebeef5, cyan #00E5FF accents,
  purple #9D50FF badges, vibrant gradients
- Divider line: cyan #00E5FF thin vertical glow

Composition: 50/50 horizontal split. Left clutter (3-5 overlapping rectangles
representing spreadsheets/tabs at slight angles), right clean dashboard. "Before"
text overlay area top-left subtle eyebrow placeholder, "After" top-right same.

Mood: Transformative, "this is your life with vs without KOLMatrix". The classic
B2B SaaS "before/after" pitch.

Avoid: NO real Excel/Gmail UI (use abstract spreadsheet-grid shapes), NO Microsoft/
Google branding, NO photos of humans, NO realistic 3D rendering.

Output spec: 1600×900 PNG (16:9), solid #080f1c or 50/50 gradient bg, ~700-1MB.
```

---

## 📋 Production Checklist（用户做）

- [ ] 选 AI tool（推荐 DALL-E 3）
- [ ] 跑 #1 Hero（最重要，LCP 关键路径，多迭代到满意）
- [ ] 跑 #2-#6 Features（6 个 cards，可批量跑，brand consistency 优先）
- [ ] 跑 #7 EmailCenterDemo（中等优先级）
- [ ] 跑 #8 BeforeAfter（pair illustration，左右对比）
- [ ] 8 PNG 命名规范放 `public/landing/illustrations/`
- [ ] 每 PNG ≤1MB（必要时用 squoosh.app 压缩）
- [ ] brand color 抽样验证（用 ColorPicker 抽 3-5 个像素点对照 hex 表）
- [ ] 通知 Generator："illustrations 就绪 N/8"，Generator 启 F003

## 🎨 Iteration Tips

- **品牌一致性弱：** 把 brand colors 部分加重复 3-5 次到 prompt 末尾，AI 更易抓住
- **图标过于卡通：** 加 "minimalist line icons" / "geometric icons only" 到 Style
- **真实文字泄漏：** 加 "all text MUST be illegible lorem rectangles, NEVER readable text" 到 Avoid
- **太多 noise：** 加 "ample white space, breathing room, NOT cluttered" 到 Composition
- **MJ 用户：** prefix `--ar 16:9 --style raw --stylize 250` 给 #1/#7/#8，其他 `--ar 4:3 --style raw --stylize 200`
- **SD 用户：** 用 `flat-design-illustration` LoRA + steps ≥40 + CFG ~7

---

## ⏱️ 时间预估

- Hero #1：~30 min（多迭代到 hero-quality）
- Features #2-#6：~10 min each × 5 = ~50 min
- EmailCenterDemo #7：~20 min
- BeforeAfter #8：~25 min（pair 复杂）
- **总：~2-2.5h AI gen + 0.5h 挑选 + 命名 + 压缩 + 上传**
- **Critical path：单日内可完成**（不必 1 day，~半天 effort）

完成后通知 Generator → Generator 启 F003 集成 → F003-F006 ~6.5h → BL-080 done。

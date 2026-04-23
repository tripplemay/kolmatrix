# V7 Stitch 生成 Prompts（2026-04-23 起草）

> 目的：MVP 批次 BM1 + BM2 对应的 3 张必要页面设计稿。
>
> 视觉基调：Neural Velocity（深色 navy #0b1326 + 电流青 #00E5FF + 玻璃拟态），已在该项目 Design System Asset `18406648320972948834` 中定义。
>
> 本批次 3 张：
> 1. **产品知识库**（Knowledge Base）— BM1 F003
> 2. **CRM 简化版**（KOL Relationship Dashboard）— BM2 F007
> 3. **AI 周报**（Weekly Report · for external clients）— BM2 F010

---

## Prompt 1 — 产品知识库（Knowledge Base · KOLMatrix）

```
Generate a desktop in-app screen for "Product Knowledge Base" (产品知识库) in KOLMatrix — a gaming KOL marketing platform. This is where game studios (tenants) enter each game product they want to market (name, category, target audience, unique selling points, download URL) and then have AI generate promotional assets (email templates + video scripts + image prompts) for that product. Those AI-generated assets become the context for later KOL outreach email customization.

Apply the canonical App Shell (240px sidebar with 8 nav items per the project's Design System; topbar 3-section). Sidebar active item = "Knowledge Base". Visual tone = Neural Velocity (deep navy #0b1326, electric cyan #00E5FF, glassmorphism).

Page structure (main content area after 240px sidebar):

Topbar (56px tall, canonical).

Breadcrumb row: "Products / Knowledge Base" (Inter 400 13px slate-400/white).

Page header row (64px):
- H1 "产品知识库 Product Knowledge Base" (Inter 600 24px white) + subtitle "录入游戏产品资料，AI 自动生成营销素材" (Inter 400 14px slate-400)
- Right side cluster:
  - Ghost button "Import CSV" (disabled + "Coming soon" tooltip)
  - Primary cyan button "+ 录入新产品 / Add new product" with plus icon

24px vertical gap.

SECTION A — Product grid (3-column responsive, 350px min card width):

Show 3 realistic example product cards and 1 "Add new" empty-state card.

Each product card: surface-1 bg (#14213b), 16px rounded, 20px padding, 1px border rgba(255,255,255,0.06). 280px tall.

Card 1: **Honor of Kings Q2 Push**
- Top row: small game icon (MOBA chess piece stylized cyan) + name Inter 600 16px white + right-aligned kebab menu slate-400
- Category pill: "MOBA" (cyan bg 15% / cyan-300 text, 10px rounded)
- Target audience line: "APAC 17-30 yo mobile gamers" (Inter 400 12px slate-300)
- 2-line USP truncated: "Cross-platform mobile MOBA, seasonal content calendar 20+ new heroes per year, strong esports ecosystem..." (slate-300 Inter 400 12px)
- Divider (rgba(255,255,255,0.06))
- AI 素材状态 row: 3 small chips horizontal:
  - "✓ 3 email templates" (emerald-300 bg 10%)
  - "✓ 2 video scripts" (emerald-300 bg 10%)
  - "✓ 5 image prompts" (emerald-300 bg 10%)
- Bottom row: left "Last updated 2h ago" slate-500 Inter 400 11px; right 2 ghost icons: Edit pencil (slate-300) + Regenerate spark (cyan-300)

Card 2: **Valorant Ep. 9 Launch**
- Same structure
- Category: "FPS" (same pill style)
- Audience: "Global competitive FPS players 16-28"
- USP: "Tactical 5v5 shooter with precision gunplay, Episode 9 introduces new agent and map reveals..."
- Status chips: "✓ 3 email templates" / "⏳ Generating video scripts" (amber-300 bg 10% + small spinning indicator) / "✓ 5 image prompts"
- Last updated 1d ago

Card 3: **MobileRush JP**
- Category: "手游 / Casual"
- Audience: "Japan daily commuters 20-45"
- USP: "Fast-paced 1-minute puzzle runner with distinctive Japan-inspired art style..."
- Status chips: "— 0 email templates" (slate-500 "Not generated yet"), same for others all "—"
- CTA overlay at bottom-right: small cyan button "⚡ Generate assets"

Card 4 (empty state / Add new):
- Same card frame but centered content
- Large "+" icon cyan-400 (48px Material Symbols)
- Text "录入新产品 / Add new product" Inter 500 15px slate-300
- Subtitle "Let AI tailor marketing assets for your game" (Inter 400 12px slate-500)
- Acts as click target (hover state: bg tint)

24px gap.

SECTION B — Recent AI generation activity (horizontal timeline style, surface-1 card 160px tall):

Card header: "最近 AI 生成活动 / Recent AI activity" Inter 500 14px + right side "View all" cyan-400 link.

Horizontal scrollable row of 5 mini events, each ~200px wide:
- spark icon + "Honor of Kings · Email templates regenerated" Inter 500 12px white + relative time "2h ago" slate-500 Inter 400 10px + cost "$0.08" slate-400
- spark icon + "Valorant · Video scripts generating..." + "1m ago" + amber pulse
- check icon emerald + "Honor of Kings · 5 image prompts generated" + "3h ago" + "$0.12"
- warn icon amber + "MobileRush JP · Need USP filled" + "1d ago" (error state, red-400 accent)
- spark icon + "Honor of Kings · Initial assets generated" + "2d ago" + "$0.30"

Scroll hint right arrow slate-500.

24px gap.

SECTION C — Create / Edit product modal (shown as opened overlay for visual reference):

Overlay: black 40% opacity bg + centered modal card 560px wide, 600px tall. Surface-2 bg, 16px rounded, 32px padding.

Modal header: "Add new product" Inter 600 20px + close X top-right.

Form fields (underline-only grammar consistent with auth pages):

1. "PRODUCT NAME *" (required indicator cyan asterisk) + input, placeholder "e.g. Honor of Kings Q2 Push"
2. 2-column row 16px gap:
   - "CATEGORY *" dropdown (placeholder "Select category") — values MOBA / RPG / FPS / Simulation / Casual / Esports / Retro / 手游 / 二次元 / 沙盒 / Other
   - "PLATFORM" multi-select chips (iOS / Android / PC / Console / Web)
3. "TARGET AUDIENCE" + textarea 60px, placeholder "e.g. APAC 17-30 yo mobile gamers, casual-to-core spectrum"
4. "UNIQUE SELLING POINTS *" (required asterisk) + textarea 120px, placeholder "What makes this product stand out? 3-5 bullet points recommended. AI will use this as primary context for marketing asset generation."
   - Below textarea: helper line "⚡ AI will generate 3 email templates + 2 video scripts + 5 image prompts based on these. More detail = better output." (Inter 400 11px slate-400)
5. "DOWNLOAD / STORE URL" + input, placeholder "https://apps.apple.com/... or https://play.google.com/..."
6. "LAUNCH DATE" + date picker (optional)

Footer row:
- Left: "Generate assets immediately after save" checkbox (default checked, cyan check)
- Right: "Cancel" ghost button + "Save & Generate" primary cyan button with spark icon

Overall finishing notes:
- Inter everywhere. Material Symbols Outlined for icons.
- Neural Velocity tokens throughout.
- Empty states (Card 4) should feel inviting, not sparse.
- Progress/status chips consistently colored: emerald 完成 / amber 进行中 / slate 未开始.
- Required fields have cyan asterisks; placeholder text slate-500.
- No scroll bars visible in the main content area; use horizontal scroll only for Recent Activity row.
```

---

## Prompt 2 — CRM 简化版（KOL Relationship Dashboard · KOLMatrix）

```
Generate a desktop in-app screen for "KOL Relationship Management" (KOL 关系管理) in KOLMatrix — a simplified CRM dashboard showing marketer's KOL pipeline across campaigns: funnel stages, KPI overview, and recent touches. NO email open/reply tracking (that's B4 scope), only pipeline + manual status + logs.

Canonical App Shell (240px sidebar with 8 nav items; topbar 3-section). Sidebar active item = "CRM" or "Relationships". Neural Velocity visual tone.

Page structure:

Topbar (56px).

Breadcrumb: "Marketing / CRM · KOL Relationships" (slate-400/white).

Page header row (64px):
- H1 "KOL 关系管理 Relationship CRM" (Inter 600 24px white) + subtitle "跨活动的 KOL 长期关系与漏斗概览" (Inter 400 14px slate-400)
- Right: period selector "本季度 / 近 90 天 / 全部时间" (pill group, 近 90 天 active cyan fill) + secondary "Export CSV" ghost + primary cyan "+ Manual log" with pencil icon.

24px gap.

SECTION A — KPI row (4 tiles, full width equal split, 120px tall each, surface-1):

1. "TOTAL KOL IN PIPELINE"
   - 大数字 "127" Inter 700 32px white
   - Sub: emerald-300 "↑ 18 新增本月"
   - Mini sparkline cyan

2. "LONG-TERM PARTNERS"
   - "34" Inter 700 32px cyan-300
   - Sub: "26.8% of total" slate-400
   - Progress ring 26.8% full, cyan stroke

3. "CUMULATIVE SPEND"
   - "$382.6K" Inter 700 32px white
   - Sub: "across 18 campaigns" slate-400
   - Sparkline

4. "AVG ROI"
   - "+426%" Inter 700 32px emerald-300
   - Sub: "12 closed campaigns" slate-400
   - Sparkline

24px gap.

SECTION B — 2-column (60/40 split):

LEFT 60% — "Pipeline by stage" card (surface-1, 380px tall, 24px padding):
- Card header: "PIPELINE BY STAGE" Inter 500 12px slate-400 uppercase + right side pill toggle "Stages / Funnel" (Stages active)
- 6 horizontal stage bars (stacked vertically with gaps), each 44px tall, pill-shaped 22px rounded:
  1. **Prospect 潜在** — bar length 22% (visual) · count "28" + KOLs · slate gradient
  2. **First contact 初步接触** — 18% · "23" · cyan-400 gradient at 40% opacity
  3. **Negotiating 谈判中** — 14% · "18" · cyan-400 gradient at 70%
  4. **Signed 签约 / Long-term 长期合作** — 27% · "34" · cyan-300 full (spotlight)
  5. **Paused 暂停** — 12% · "15" · amber-300 gradient 40%
  6. **Terminated 终止** — 7% · "9" · red-400 gradient 30%
- Each bar clickable (hover: subtle glow); text right-aligned: count + arrow ">" slate-400.

RIGHT 40% — "Funnel conversion" card (surface-1, 380px tall, 24px padding):
- Card header: "转化漏斗 Funnel Conversion"
- Vertical funnel shape (like Google Analytics funnel), 4 tiers from wide top to narrow bottom:
  1. Top wide (90% width): "127 Total" (prospect + 上游，slate)
  2. "87 Contacted" (cyan 40%) — conversion from tier 1: 68.5% slate-400
  3. "52 Negotiated" (cyan 70%) — 59.8% from tier 2
  4. Bottom narrow (38% width): "34 Long-term" (cyan 100% with glow) — 65.4% from tier 3
- Between tiers, small arrow + percentage label "↓ 68.5%" slate-300 Inter 400 11px.
- Bottom of card: "Overall prospect-to-partner: 26.8%" (Inter 500 13px slate-300) with a "View methodology" cyan-400 link.

24px gap.

SECTION C — Recent activity table (surface-1, 16px rounded, 0 padding full bleed):

Table header (52px, bg surface-2, Inter 600 12px slate-400 uppercase letter-spacing 0.4px):
| KOL | Stage | Campaign | Last Touch | By | |

12 rows at 60px height:
- GameMaster Pro | Long-term (emerald pill) | Spring — HoK Q2 | "Sent follow-up" 2h ago | Sarah C. | kebab
- TikTokGamer_SEA | Negotiating (cyan pill) | Valorant Ep.9 | "Quoted $8,500" 5h ago | Sarah C. | kebab
- RPG_Kings | First contact (slate pill) | Genshin Anniversary | "Initial email sent" 1d ago | Sarah C. | kebab
- CasualGameQueen | Paused (amber pill) | — | "Marked paused" 2d ago · Reason: "budget freeze" | Sarah C. | kebab
- MobileKingAlex | Long-term (emerald pill) | Dota 2 EG | "Contract signed" 3d ago | Sarah C. | kebab
- StreamKing_BR | Terminated (red pill) | Fortnite partnership | "Opt-out requested" 4d ago | Sarah C. | kebab
- (6 more varied rows mixing stages)

Row trailing: kebab icon slate-400.
Row hover: surface-2 tint.
Row stage pills consistent with SECTION B color system.

Table footer: pagination "1–12 of 487 events" + "25 / 50 / 100" per-page + arrow buttons.

Overall finishing notes:
- Inter everywhere; Material Symbols icons.
- Neural Velocity tokens.
- Stages 6-status color system rigorously consistent: slate (prospect) / cyan 40% (first contact) / cyan 70% (negotiating) / cyan 100% glow (long-term) / amber (paused) / red (terminated).
- Dense but breathable. Power-user view.
- DO NOT include open rate / reply rate data anywhere — those are NOT in this MVP scope.
```

---

## Prompt 3 — AI 周报（Weekly Report for Client · KOLMatrix）

```
Generate a desktop in-app screen for "AI Weekly Report" in KOLMatrix. IMPORTANT CONTEXT: This report is generated FOR THE CLIENT (the game studio's customer/stakeholder), not for the internal marketer. The tone must be external, professional, polished. The report must be exportable as PDF and shareable via a link. It uses AI (aigcgateway Action) to auto-generate narrative summary + data highlights from the past week's campaign activity.

Canonical App Shell (240px sidebar with 8 nav items; topbar 3-section). Sidebar active item = "Weekly Report" or "Reports". Neural Velocity visual tone.

Page structure:

Topbar (56px).

Breadcrumb: "Reports / Weekly Report" (slate-400/white).

Page header row (64px):
- H1 "AI 周报 Weekly Report" (Inter 600 24px white) + subtitle "一键生成客户向周报，涵盖活动进度、KOL 表现、ROI 亮点" (Inter 400 14px slate-400)
- Right: period selector "本周 / 上周 / 自定义" (pill group, 上周 active cyan) + "Edit client info" ghost button (gear icon)

24px gap.

SECTION A — Client brand header (surface-1, 100px tall, 24px padding):
- Left: Client logo placeholder (64x64 circular avatar with cyan 1px ring, initials "LG" inside, cyan-300 Inter 600 24px)
- Middle: Client name "Lightning Games Inc." (Inter 700 22px white) + subtitle "Q2 Spring Campaign Program · Week of Apr 14-20, 2026" (Inter 400 13px slate-400)
- Right: Action cluster:
  - Status chip: "✨ AI-generated" (cyan bg 15%, cyan-300 text, sparkle icon)
  - Primary cyan button "⬇ Download PDF" with download icon
  - Ghost button "🔗 Share link" (with copy icon)
  - Ghost button "↻ Regenerate" with refresh icon (tooltip "Refresh with latest data, $0.12")

24px gap.

SECTION B — Executive summary card (surface-1, 180px tall, 32px padding):
- Small header: "EXECUTIVE SUMMARY 执行摘要" Inter 500 11px slate-400 uppercase letter-spacing 0.6px
- 2 paragraphs of generated summary (Inter 400 15px slate-100, line-height 1.7):

"Your Q2 Spring Campaign delivered strong performance this week across 4 active campaigns and 23 KOL partnerships. The Honor of Kings Q2 Preseason Push continues to outperform expectations with a 501% ROI and 2.1M cumulative impressions, driven primarily by MOBA micro-creators in Southeast Asia."

"Notable this week: the newly-signed partnership with GamerXia (850K YouTube) exceeded first-week KPIs by 38%, and budget utilization is on track at 67% of Q2 allocation. Two campaigns flagged for review — see recommendations below."

24px gap.

SECTION C — 3-tile metric highlights (full width, 140px tall each, equal split, surface-1):

1. **KOL Reach this week**
   - Icon: users/people cyan-300
   - Big number "23" Inter 700 34px white
   - Sub: "KOL partnerships active" slate-400
   - Delta: "↑ 4 new this week" emerald-300

2. **Combined Impressions**
   - Icon: visibility cyan-300
   - "2.1M" Inter 700 34px cyan-300 (main brand accent)
   - Sub: "est. audience exposure" slate-400
   - Delta: "↑ 23% vs last week" emerald-300

3. **ROI Realized**
   - Icon: trending_up emerald
   - "+501%" Inter 700 34px emerald-300
   - Sub: "from closed campaigns" slate-400
   - Delta: "On target (goal: 300%)" slate-300

24px gap.

SECTION D — 2-column (60/40):

LEFT 60% — "Top performing partnerships" card (surface-1, 360px tall):
- Card header: "TOP PERFORMERS 最佳表现 KOL" Inter 500 12px slate-400 uppercase
- 5 partnership rows, each 56px tall, separated by divider:
  - Avatar + KOL name + platform (e.g. "GamerXia · YouTube · 850K") + right-aligned "views 1.2M · ROI +620%" emerald-300 Inter 500 13px
  - 5 rows: GamerXia / MOBA_Queen / TikTokAce_SG / ValorantPlaysJP / CasualStreamer_KR
  - Last row has "View full table →" cyan link

RIGHT 40% — "AI Insights & Recommendations" card (surface-1, 360px tall):
- Card header: "AI INSIGHTS ✨"
- 3 insight cards stacked with colored left border accent:
  1. **Emerald** border · trending_up icon · "SEA micro-creators are your strongest segment"
     Body: "5K-50K follower KOLs in Southeast Asia delivered 580% avg ROI, 2× the portfolio average. Consider allocating more Q3 budget here."
  2. **Amber** border · warning icon · "2 underperforming partnerships flagged"
     Body: "Valorant Ep.9 Launch (45% ROI) and BR Fortnite Partnership (pending revenue) are below target. Review brief alignment and refresh creative direction."
  3. **Cyan** border · lightbulb icon · "New opportunity detected"
     Body: "Competitor activity suggests a gap in Japanese mobile gaming audience. 3 candidate KOLs matched in your database for outreach."

24px gap.

SECTION E — Budget & pacing (surface-1, 120px tall, full width):
- Header row: "BUDGET PACING Q2" + right "On track 🟢" emerald chip
- Horizontal 3-segment stacked bar (progress):
  - Spent 67% (cyan gradient) · "$269.4K"
  - Committed 15% (amber) · "$60K"
  - Remaining 18% (slate-700) · "$70.6K"
- Below bar micro text "Projected to use 95% by quarter end · +28 days remaining" (Inter 400 12px slate-400)

24px gap.

SECTION F — Next week outlook card (surface-1, 160px tall, 28px padding):
- Header: "NEXT WEEK 下周展望"
- 3-column grid:
  1. **Upcoming launches**: "2 new KOL deliveries scheduled" + list of 2 KOLs with dates
  2. **Follow-ups needed**: "5 KOLs awaiting your response" with "Go to CRM →" cyan link
  3. **Reports & reviews**: "Monthly ROI close on May 1" + "Quarterly review prep due"

Bottom of page, 32px gap, then footer strip (28px tall, slate-500 Inter 400 11px, centered):
- "Generated by KOLMatrix AI · 2026-04-20 16:32 JST · Cost: $0.12 · Powered by aigcgateway"
- "Report ID: wr_20260420_lightning_q2w16 · confidential"

Overall finishing notes:
- Inter everywhere; Material Symbols icons.
- Neural Velocity tokens, but slightly softer / less "operational dashboard" feel. This is external-facing so professional premium aesthetic.
- Language mixes Chinese + English labels to match bilingual positioning.
- Ready for PDF export — layout should be screen-width but not overly interactive (the actual PDF would be a flat render of this).
- Share link view (not explicitly rendered here) would be a subset without the top action buttons.
- Numbers shown are realistic examples; emphasize narrative + visuals more than raw tables.
```

---

## 使用说明

1. 打开 https://stitch.withgoogle.com/projects/9338165817879839093
2. 粘贴任一 prompt 到对话框生成
3. 生成完毕后下载 HTML + PNG 到 `design-draft/stitch-references/`（命名：`knowledge-base.html` + `.png`、`crm-simplified.html`、`weekly-report.html`）
4. 生成完告诉我，我更新 README + visual-baseline + commit

## 预期输出

| 文件 | 对应业务批次 |
|---|---|
| `knowledge-base.html` + `.png` | BM1 F003 产品知识库 |
| `crm-simplified.html` + `.png` | BM2 F007 CRM 简化版 |
| `weekly-report.html` + `.png` | BM2 F010 AI 周报（给客户看）|

生成顺序建议：**Prompt 1（知识库）优先**，BM1 先用；2 和 3 可等 BM2 前再做。

## 注意

- **Prompt 3 周报** 强调"给客户看"，与原型 `/weekly-report`（给 marketer 自己看）语义不同。文案调性、品牌 header、PDF 导出都是外部视角。
- **Prompt 2 CRM** 明确不含 open rate / reply rate（MVP 范围外，B4 完整版做）。
- **Prompt 1 知识库** 明确 `USP 强制必填`（§13 Q5 决策）。

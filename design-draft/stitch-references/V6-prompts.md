# V6 Stitch 生成 Prompts（2026-04-21 起草）

> 目的：MVP 批次 BM2 对应的 ROI 追踪页设计稿。
>
> 视觉基调：Neural Velocity（深色 navy #0b1326 + 电流青 #00E5FF + 玻璃拟态），已在该项目 Design System Asset `18406648320972948834` 中定义。
>
> 本批次 1 张：
> - ROI 追踪页（ROI Tracking · 活动投资回报分析）

---

## Prompt 1 — ROI 追踪页（ROI Tracking · KOLMatrix）

```
Generate a desktop in-app screen for "ROI Tracking" (活动投资回报分析) in KOLMatrix — a gaming KOL marketing platform. This is the 10th major view where marketers monitor spend, revenue, and ROI across all their KOL campaigns. Apply the canonical App Shell (240px sidebar with 8 nav items per the project's Design System; topbar 3-section with search + language + user chip). The sidebar active item is "ROI Tracking" (or the equivalent nav item; if not in canonical 8, use "Analytics").

Visual tone: Neural Velocity (deep navy #0b1326, cyan #00E5FF accents, glassmorphism). Follow the Design System Asset `18406648320972948834` for every token.

Page structure (main content area after 240px sidebar):

Topbar (56px tall, per canonical).

Breadcrumb row: "Analytics / ROI Tracking" (Inter 400 13px slate-400/white, "/" dividers in slate-600).

Page header row (64px):
- H1 "ROI Tracking" (Inter 600 24px white) + subtitle "Real-time spend, revenue, and performance across all campaigns" (Inter 400 14px slate-400)
- Right side cluster:
  - Period selector pill group (4 options): "7D / 30D / 90D / All-time" — "30D" is currently selected (cyan fill navy text; others: ghost outline slate-300)
  - Ghost button "Sync data" with refresh icon
  - Ghost button "AI Insights" with spark icon (cyan-300 text, cyan border)
  - Primary cyan button "Record revenue" with plus icon

24px vertical gap.

SECTION A — KPI row (full-width, 4 tiles × equal split, 120px tall each):
Each tile: surface-1 bg (#14213b), 16px rounded, 24px padding, 1px border rgba(255,255,255,0.06):

1. **Total Spend**
   - Inter 400 12px slate-400 uppercase letter-spacing 0.6px "TOTAL SPEND (30D)"
   - Big number "$269,400" Inter 700 32px white
   - Sub-line: red-300 with down arrow "↓ 8% vs prev period"
   - Tiny sparkline at bottom (30 day bars, cyan)

2. **Total Revenue**
   - "TOTAL REVENUE (30D)"
   - "$1,437,800" Inter 700 32px cyan-300
   - emerald-300 with up arrow "↑ 23% vs prev period"
   - Sparkline

3. **Average ROI**
   - "AVERAGE ROI"
   - "+434%" Inter 700 32px emerald-300 (positive = emerald; if negative, red-400)
   - Sub-line slate-400 "across 12 completed campaigns"
   - Sparkline

4. **Active Campaigns**
   - "ACTIVE CAMPAIGNS"
   - "8" Inter 700 32px white
   - Sub-line: "3 ending this week" (amber-300) + "5 on track" (emerald-300) separated by cyan dot

24px gap.

SECTION B — Budget vs Actual card (full-width, 140px tall):
Surface-1, 16px rounded, 24px padding. Contents:
- Header row: "Quarterly Budget" Inter 600 16px + "Q2 2026" slate-400 12px + right side edit pencil icon + "Edit budget" ghost link
- Horizontal progress bar (16px tall, 12px rounded): 3-segment stacked bar showing:
  - Green segment (Actual spend on-track): 0-67% of total, emerald
  - Amber segment (Pending commitments): 67-82%, amber
  - Remaining (unused budget): 82-100%, slate-700 bg
- Three-text row below the bar (equal width, Inter 400 13px):
  - Left: "Spent $269.4K of $400K" (white)
  - Center: "Committed $62K" (amber-300)
  - Right: "Remaining $68.6K (17%)" (slate-400)
- Below that, micro hint "If current pace continues, projected to use 92% by quarter end" (Inter 400 11px slate-500)

24px gap.

SECTION C — Two-column (60/40 split) charts:

LEFT (60% width, ~720px) — "Spend & Revenue Trend" card (surface-1, 320px tall):
- Card header: "SPEND & REVENUE (LAST 30 DAYS)" Inter 500 12px slate-400 uppercase. Right: toggle pills "Daily / Weekly" (Daily active cyan fill)
- Chart body: Stacked bar chart with dual axis
  - X-axis: dates (abbreviated, every 3rd day label)
  - Y-axis left (slate-400 Inter 400 10px): USD amount
  - Bars: Spend in cyan 40% opacity, Revenue stacked on top in cyan 100% (with glow)
  - Overlay line: ROI% value (emerald-300) with Y-axis right
  - Grid lines faint rgba(255,255,255,0.04)
  - A small tooltip shown on one bar: "Apr 15: Spend $12.4K · Revenue $68.2K · ROI 450%"
- Empty horizontal space below chart for legend: 3 small legend chips (Spend/Revenue/ROI)

RIGHT (40% width, ~480px) — "AI Insights" card (surface-1, 320px tall, the sister card height-matched):
- Card header: "AI INSIGHTS" Inter 500 12px slate-400 uppercase + small spark icon cyan-300 + "Updated 5m ago" slate-500 10px
- 3 insight cards stacked vertically, each with colored left border accent:
  1. **Emerald** border + emerald-300 icon (trending_up): **"TikTok campaigns outperforming by 2.3×"** title Inter 600 13px + body Inter 400 12px slate-300 "Your 4 TikTok campaigns averaged 612% ROI vs 267% across other platforms. Consider increasing TikTok allocation next quarter."
  2. **Amber** border + amber-300 icon (warning): **"2 campaigns underperforming"** + "Spring — Honor of Kings Q2 and Valorant Ep.9 Launch are at 45% and 62% ROI respectively, below the 300% target. Review KOL mix."
  3. **Cyan** border + cyan-300 icon (lightbulb): **"Best performing KOL tier"** + "MOBA micro-creators in SEA (5K–20K followers) delivered 580% avg ROI. GamerXia-style partnerships are consistently strongest."
- Bottom of card: "Show all insights" cyan-400 link

24px gap.

SECTION D — Campaign ROI Table (full-width, surface-1, 16px rounded, 0 padding — table is full bleed):

Table header row (52px, bg surface-2, Inter 600 12px slate-400 uppercase letter-spacing 0.4px):
| Campaign | Product | Period | Spend | Revenue | ROI | Status | |

12 rows at 64px height, realistic campaign data mixing wins/losses:

Row examples:
- Spring — Honor of Kings Preseason Q2 | Honor of Kings | Mar 15 – Apr 12 | $48,200 | $289,600 | **+501%** (emerald pill bg 15% / emerald-300 text) | "Completed" (slate chip) | kebab
- Valorant Ep. 9 Launch | Valorant | Apr 1 – Apr 30 | $62,500 | $38,700 | **-38%** (red pill 15% / red-400 text) | "Active" (cyan pulse dot) | kebab
- Genshin Anniversary APAC | Genshin Impact | Mar 20 – Apr 20 | $84,000 | $412,000 | **+390%** | Completed | kebab
- Dota 2 EG Sponsorship | Dota 2 | Apr 5 – Apr 29 | $32,000 | $187,600 | **+486%** | Completed | kebab
- HoK Retro Launch Teaser | Honor of Kings | Apr 10 – May 10 | $12,800 | $0 | **—** (slate-500 "pending revenue" tooltip) | Active | kebab
- CasualGame Summer Push | CasualSplash | Mar 1 – Mar 31 | $8,400 | $42,200 | **+403%** | Completed | kebab
- NA Micro-creator wave | Honor of Kings | Feb 20 – Mar 20 | $15,600 | $98,400 | **+531%** | Completed | kebab
- Twitch Stream Series EU | Dota 2 | Mar 10 – Apr 15 | $22,100 | $64,800 | **+193%** | Completed | kebab
- JP Launch Creators | MobileRush JP | Apr 1 – Apr 28 | $18,900 | $76,200 | **+303%** | Active | kebab
- SEA TikTok Wave 1 | CasualSplash | Mar 15 – Apr 15 | $6,100 | $41,800 | **+585%** | Completed | kebab
- BR Fortnite Partnership | — | Apr 8 – May 8 | $4,200 | $0 | **—** | Active | kebab
- Winter Retargeting | MultiGame | Jan 15 – Feb 15 | $28,400 | $112,600 | **+296%** | Completed | kebab

Row trailing: kebab menu (slate-400 "more vertical" icon).
Row hover state: subtle surface-2 tint.
Row with negative ROI: left border 2px red-400.

Table footer: pagination "1–12 of 47 campaigns" slate-400 Inter 400 12px + arrow buttons + per-page "25 / 50 / 100" selector + right side "Export CSV" ghost button.

Overall finishing notes:
- Inter everywhere, Material Symbols Outlined for icons
- No serif. Neural Velocity tokens throughout
- Canonical App Shell sidebar active item = "Analytics" or "ROI Tracking" (whichever exists in the shell)
- Dense but breathable — this is a power-user analytics view
- All number formatting uses comma thousands ($269,400 / $1,437,800 / +501%)
- Positive ROI = emerald-300, negative = red-400, pending = slate-500
- Tooltip on one data point for visual variety, otherwise static
- Do NOT add a footer strip at the bottom; the page ends at the table.
```

---

## 使用说明

1. 打开 https://stitch.withgoogle.com/projects/9338165817879839093
2. 粘贴 Prompt 1 到对话框生成
3. 生成完毕后，用 MCP `get_screen` 或页面 UI 直接 Export HTML 下载到 `design-draft/stitch-references/`（命名约定：`roi-tracking.html` + `.png`）
4. 告诉我，我更新 README.md + visual-baseline.md 附录 + commit

## 预期输出

| 文件 | 对应业务批次 |
|---|---|
| `roi-tracking.html` + `.png` | BM2 F009 ROI 独立页 |

生成如不满意可调 prompt 重来。

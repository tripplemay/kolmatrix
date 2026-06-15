# BL-117 落地页定位再平衡 — 邮件侧重 → 全球 KOL 智能营销

> **Type：** 落地页定位再平衡。spec 硬性。
> **来源：** 用户 2026-06-15「页面太偏邮件,想突出全球 KOL 智能营销工具定位」+ 分析(对话内,见下 §1)。
> **决策(用户 2026-06-15)：** ① **主站直接广义**(全球 KOL 智能营销定位)**,不另做 /lp**(接受投放文档的邮件角度淡化)；② **每个 feature 一个 staging 检查点**(沿用 BL-115 节奏,Hero 先做先验)。
> **基线：** BL-115 落地页(staging@9ea2c73)。保留 BL-115 转化机制(表单/UTM/埋点)不动。

## §1 背景 + 诊断

BL-115 为对齐投放文档把页面**过度旋转到邮件**。根因不在内容多少,在**定位句 + 叙事顺序**:
- Hero 标题 "Global game KOL marketing, **one email collaboration hub**" → 把整产品定位成邮件中心;
- Hero 4 数据栏全邮件 + 痛点 4 条全邮件 + 邮件中心演示靠前 + FAQ 全邮件 → 前几屏邮件主导;
- 真正体现"全局智能营销"的 **Features(Brief/Match/Reach/Insight)被埋到第 4 屏**。

当前顺序: Hero → Trust → 痛点(全邮件) → Features → 邮件演示 → HowItWorks → Stats → FAQ(全邮件) → CTA。

## §2 再平衡方向(本批锁定)

把定位从"邮件中心"拉回"**全球游戏 KOL 智能营销平台**",邮件降为其中一根支柱(Reach):
- Hero 重定位为广义(发现/匹配/触达/复盘全流程),邮件只是其一。
- 痛点拓宽为 KOL 营销痛点(邮件占 1/4 而非 4/4)。
- Features(Brief/Match/Reach/Insight)广义能力上移、突出;邮件中心演示降为 Reach 深度。
- FAQ 混合(广义 + 邮件)。
- **保留 BL-115 转化机制**(表单/UTM/埋点)+ 真实性把关(IP genre 框架/证言占位/回复率不提)。
- 守 perf99 / WCAG AA / reduced-motion 不回退;visual baseline 必 Linux runner 重拍。

## §3 Features（分批,每 feature staging 检查点）

> ⚠️⚠️ **交付节奏(用户硬要求,同 BL-115):每个 generator feature 完成 → 部署 staging → STOP 等用户确认效果通过 → Planner 才放行下一个。** 一次只做一个。

### F001 — Hero 重定位广义（generator）【tone-setter, Hero-first 检查点】
- Hero 标题从"email collaboration hub"→ **全球游戏 KOL 智能营销平台 / AI 命令中心**(可复用 BL-114 "The AI command center for global game KOL marketing" 调性)。
- 副标覆盖**发现→AI 匹配→触达→复盘全流程**(邮件只是其一,不再以送达/合规/开信率为主轴)。
- Hero 4 数据栏从全邮件 → **广义**(如 6,000+ 全球 KOL / AI 语义匹配 / 全流程闭环 / +1 条送达合规),不再 4 条全邮件。
- 视觉沿用 Neural Velocity;i18n 5 locale + 单测 + npm run build。
- **完成 → staging → 等用户确认广义方向 → 才放行 F002。**

### F002 — 痛点拓宽 + section 顺序再平衡（generator）
- 痛点 4 卡从全邮件 → **KOL 营销 4 痛点**:跨平台找达人散乱 / 筛选慢不精准(AI 匹配解) / 转化不可控(数据复盘解) / 邮件送达合规(保留 1 条)。
- **section 顺序**: Features(Brief/Match/Reach/Insight)上移紧跟痛点(广义能力先亮相);**EmailCenterDemo 降为 Reach(触达)能力深度展示**,移到 Features 之后并弱化为"其一支柱深挖"(不删,降权)。
- i18n + 单测 + npm run build。**完成 → staging → 确认 → 放行 F003。**

### F003 — FAQ 混合（generator）
- FAQ 从 4 邮件问 → **2 广义(怎么找达人/AI 匹配准不准 + ROI 怎么算)+ 2 邮件**。
- i18n + 单测 + npm run build。**完成 → staging → 确认 → 放行 F004。**

### F004 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test + npm run build。
- L2 staging：① 整页定位回到"全球 KOL 智能营销"(Hero 广义 / Features 突出 / 痛点拓宽 / 邮件降为 Reach 深度 / FAQ 混合)② BL-115 转化机制(表单/UTM/埋点)未被破坏 ③ Lighthouse perf99/WCAG AA/reduced-motion 不回退 ④ visual baseline 重拍 ⑤ 5 locale/响应式。
- signoff `docs/test-reports/BL-117-signoff-2026-06-XX.md`。

## §4 风险

- **与投放文档邮件角度冲突**:用户决主站走广义、不另做 /lp(接受邮件角度淡)。若日后邮件投放需专属落地页 → 另开 /lp(backlog)。
- **改动 = BL-115 的回调**(Hero 定位 + 痛点 + 顺序),勿误伤 BL-115 转化机制。
- 守 perf99/a11y;visual baseline 必 Linux 重拍 + 连带断言;视觉/route 改动 npm run build。⚠️ 部署 OOM NODE_OPTIONS=4096。
- 真实性把关延续(回复率不提/IP genre/证言占位)。
